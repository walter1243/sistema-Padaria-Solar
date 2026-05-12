#!/usr/bin/env python3
"""Local USB thermal printer bridge for Padaria app.

Run on Windows:
  C:/Users/USER/AppData/Local/Programs/Python/Python313/python.exe scripts/thermal_printer_service.py

Endpoints:
- GET  /health
- POST /print-receipt
- POST /reprint-last
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import usb.backend.libusb1
import usb.core
import usb.util
from escpos.printer import Usb, Win32Raw
from libusb_package import find_library

HOST = "127.0.0.1"
PORT = int(os.environ.get("THERMAL_PRINTER_PORT", "8765"))
DEFAULT_USB_CANDIDATES = "04b8:0e15,04b8:0202,062a:4101"
USB_CANDIDATES_RAW = os.environ.get("THERMAL_PRINTER_USB_CANDIDATES", DEFAULT_USB_CANDIDATES)
WINDOWS_PRINTER_NAME = os.environ.get("THERMAL_PRINTER_WINDOWS_NAME", "").strip()
WINDOWS_PRINTER_CANDIDATES = [
    name.strip()
    for name in os.environ.get(
        "THERMAL_PRINTER_WINDOWS_CANDIDATES",
        "ELGIN i9(USB),ELGIN i9 USB,ELGIN i9,Bematech i9",
    ).split(",")
    if name.strip()
]

LAST_RECEIPT: dict[str, Any] | None = None


def _parse_usb_candidates(raw: str) -> list[tuple[int, int]]:
    pairs: list[tuple[int, int]] = []
    for token in raw.split(","):
        item = token.strip().lower()
        if not item:
            continue
        if ":" not in item:
            continue
        vendor_hex, product_hex = item.split(":", 1)
        try:
            pairs.append((int(vendor_hex, 16), int(product_hex, 16)))
        except ValueError:
            continue
    return pairs


USB_DEVICE_CANDIDATES = _parse_usb_candidates(USB_CANDIDATES_RAW)


def _respond(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    # Required by modern browsers when an HTTPS site calls localhost/private network.
    handler.send_header("Access-Control-Allow-Private-Network", "true")
    handler.end_headers()
    handler.wfile.write(body)


def _money(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def _safe_text(value: Any) -> str:
    text = str(value if value is not None else "")
    return text.replace("\n", " ").strip()


def _connect_printer() -> Any:
    win_names = [WINDOWS_PRINTER_NAME] if WINDOWS_PRINTER_NAME else WINDOWS_PRINTER_CANDIDATES
    win_errors: list[str] = []

    for printer_name in win_names:
        try:
            printer = Win32Raw(printer_name)
            printer.open()
            return printer
        except Exception as exc:  # pylint: disable=broad-except
            win_errors.append(f"{printer_name}: {exc}")

    last_error: Exception | None = None
    seen_ids: set[tuple[int, int]] = set()

    for vendor_id, product_id in USB_DEVICE_CANDIDATES:
        candidate = (vendor_id, product_id)
        if candidate in seen_ids:
            continue
        seen_ids.add(candidate)

        try:
            backend = usb.backend.libusb1.get_backend(find_library=find_library)
            usb_device = usb.core.find(idVendor=vendor_id, idProduct=product_id, backend=backend)
            if usb_device is None:
                raise RuntimeError("dispositivo USB nao encontrado")

            try:
                usb_device.set_configuration()
            except Exception:
                # Em alguns drivers a configuracao ja esta ativa.
                pass

            cfg = usb_device.get_active_configuration()
            out_ep: int | None = None
            in_ep: int | None = None
            for interface in cfg:
                for endpoint in interface:
                    direction = usb.util.endpoint_direction(endpoint.bEndpointAddress)
                    if direction == usb.util.ENDPOINT_OUT and out_ep is None:
                        out_ep = endpoint.bEndpointAddress
                    if direction == usb.util.ENDPOINT_IN and in_ep is None:
                        in_ep = endpoint.bEndpointAddress

            if out_ep is None:
                raise RuntimeError("endpoint OUT nao encontrado")

            printer = Usb(
                vendor_id,
                product_id,
                timeout=0,
                backend=backend,
                out_ep=out_ep,
                in_ep=in_ep,
            )
            printer.open()
            return printer
        except Exception as exc:  # pylint: disable=broad-except
            last_error = exc

    raise RuntimeError(
        "Falha ao conectar na termica via Win32Raw/USB. "
        f"Win32Raw: {' | '.join(win_errors) if win_errors else 'nao testado'}; "
        "USB candidatos "
        + ", ".join(f"{hex(v)}:{hex(p)}" for v, p in seen_ids)
    ) from last_error


def _print_receipt(receipt: dict[str, Any]) -> None:
    printer = _connect_printer()
    printer._raw(b"\x1b\x40")
    printer.set(
        align="left",
        font="a",
        width=1,
        height=1,
        bold=True,
    )

    table_id = _safe_text(receipt.get("tableId", ""))
    method = _safe_text(receipt.get("method", ""))
    total = float(receipt.get("total", 0))
    order_count = int(receipt.get("orderCount", 0))
    lines = receipt.get("lines", []) or []

    closed_at = _safe_text(receipt.get("closedAt", ""))
    if not closed_at:
        closed_at = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    # Cabeçalho grande e escuro para a i9
    printer.set(align="center", font="a", width=2, height=2, bold=True)
    printer.text("PADARIA SOLAR\n")
    printer.text("SUPERMERCADO\n")
    printer.set(align="center", font="a", width=1, height=1, bold=True)
    printer.text("CNPJ: 13.487.922/0001-17\n")
    printer.text("=" * 42 + "\n")

    # Dados da mesa
    printer.set(align="left", font="a", bold=True)
    printer.text(f"MESA: {table_id}\n")
    printer.text(f"PAGAMENTO: {method.upper()}\n")
    printer.text("-" * 42 + "\n")

    # Cabeçalho dos itens
    printer.set(align="left", font="a", bold=True)
    header = "{:<4}{:<20}{:>10}".format("QTD", "DESCRICAO", "VALOR")
    printer.text(header + "\n")
    printer.text("-" * 42 + "\n")

    for line in lines:
        qty = int(line.get("quantity", 0))
        desc = _safe_text(line.get("description", ""))[:20]
        line_total = float(line.get("total", 0))

        row = "{:<4}{:<20}{:>10}".format(
            qty,
            desc,
            _money(line_total),
        )
        printer.text(row + "\n")

    # Espaço mínimo apenas para o corte ficar abaixo da última linha
    printer.text("\n")
    printer.text("-" * 42 + "\n")
    printer.set(align="right", font="a", bold=True)
    printer.text(f"TOTAL: {_money(total)}\n")

    printer.set(align="left", font="a", bold=True)
    printer.text(f"Pedidos: {order_count}\n")
    printer.set(align="right")
    printer.text(f"{closed_at}\n")

    # Pequena alimentação para o corte sair logo abaixo da data, sem papel sobrando.
    printer.text("\n")
    printer.cut()


class PrinterHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:  # noqa: N802
        _respond(self, 204, {})

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            _respond(
                self,
                200,
                {
                    "ok": True,
                    "service": "thermal-printer-bridge",
                    "host": HOST,
                    "port": PORT,
                    "usbCandidates": [f"{hex(v)}:{hex(p)}" for v, p in USB_DEVICE_CANDIDATES],
                    "windowsPrinterName": WINDOWS_PRINTER_NAME or None,
                    "hasLastReceipt": LAST_RECEIPT is not None,
                },
            )
            return

        _respond(self, 404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        global LAST_RECEIPT

        if self.path not in ("/print-receipt", "/reprint-last"):
            _respond(self, 404, {"ok": False, "error": "Not found"})
            return

        if self.path == "/reprint-last":
            if LAST_RECEIPT is None:
                _respond(self, 404, {"ok": False, "error": "No last receipt to reprint"})
                return
            try:
                _print_receipt(LAST_RECEIPT)
                _respond(self, 200, {"ok": True, "mode": "reprint-last"})
                return
            except Exception as exc:  # pylint: disable=broad-except
                _respond(self, 500, {"ok": False, "error": str(exc)})
                return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Invalid JSON payload")
        except Exception as exc:  # pylint: disable=broad-except
            _respond(self, 400, {"ok": False, "error": f"Invalid JSON: {exc}"})
            return

        try:
            _print_receipt(payload)
            LAST_RECEIPT = payload
            _respond(self, 200, {"ok": True, "mode": "print-receipt"})
        except Exception as exc:  # pylint: disable=broad-except
            _respond(self, 500, {"ok": False, "error": str(exc)})

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        # Keep output clean in terminal.
        return


def main() -> None:
    server = HTTPServer((HOST, PORT), PrinterHandler)
    print(f"[thermal-printer-bridge] Running on http://{HOST}:{PORT}")
    print(
        "[thermal-printer-bridge] USB candidates="
        + ", ".join(f"{hex(v)}:{hex(p)}" for v, p in USB_DEVICE_CANDIDATES)
    )
    print("[thermal-printer-bridge] Ctrl+C to stop")
    server.serve_forever()


if __name__ == "__main__":
    main()
