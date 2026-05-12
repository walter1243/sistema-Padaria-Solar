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

from escpos.printer import Usb

HOST = "127.0.0.1"
PORT = int(os.environ.get("THERMAL_PRINTER_PORT", "8765"))
VENDOR_ID = int(os.environ.get("THERMAL_PRINTER_VENDOR_ID", "0x04b8"), 16)
PRODUCT_ID = int(os.environ.get("THERMAL_PRINTER_PRODUCT_ID", "0x0e15"), 16)

LAST_RECEIPT: dict[str, Any] | None = None


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


def _print_receipt(receipt: dict[str, Any]) -> None:
    printer = Usb(VENDOR_ID, PRODUCT_ID)
        printer.set(density=15)  # Aumentar densidade de impressão

    table_id = _safe_text(receipt.get("tableId", ""))
    method = _safe_text(receipt.get("method", ""))
    total = float(receipt.get("total", 0))
    order_count = int(receipt.get("orderCount", 0))
    lines = receipt.get("lines", []) or []

    closed_at = _safe_text(receipt.get("closedAt", ""))
    if not closed_at:
        closed_at = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    printer.set(align="center", font="a", width=2, height=2)
        # ===== CABEÇALHO =====
        printer.set(align="center", font="a", width=2, height=2, text_type="B")
        printer.text("PADARIA SOLAR\n")
    printer.set(align="center", width=1, height=1)
        printer.set(align="center", width=1, height=1, text_type="B")
        printer.text("SUPERMERCADO\n")
        printer.set(align="center", font="a", text_type="B")
        printer.text("CNPJ: 13.487.922/0001-17\n")
    printer.text("-" * 42 + "\n")

        # ===== DADOS DA MESA =====
        printer.set(align="left", text_type="B", font="a")
        printer.text(f"MESA: {table_id}\n")
        printer.text(f"PAGAMENTO: {method.upper()}\n")
        printer.text("-" * 42 + "\n")

        # ===== ITENS =====
        header = "{:<3}{:<19}{:>9}".format("QTD", "DESCRICAO", "VALOR")
    printer.set(align="left", text_type="NORMAL")
    printer.text(header + "\n")
    printer.text("-" * 42 + "\n")

    for line in lines:
        qty = int(line.get("quantity", 0))
            desc = _safe_text(line.get("description", ""))[:19]
        line_total = float(line.get("total", 0))

            row = "{:<3}{:<19}{:>9}".format(
            qty,
            desc,
            _money(line_total),
        )
        printer.text(row + "\n")

    printer.text("-" * 42 + "\n")
    printer.set(align="right", text_type="B")
    printer.text(f"TOTAL: {_money(total)}\n")

    printer.set(align="left", text_type="NORMAL")
    printer.text(f"Pedidos: {order_count}\n")
    printer.set(align="right")
    printer.text(f"{closed_at}\n")

        # ===== CORTE DE PAPEL =====
        printer.text("_" * 42 + "\n")
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
                    "vendorId": hex(VENDOR_ID),
                    "productId": hex(PRODUCT_ID),
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
    print(f"[thermal-printer-bridge] USB vendor={hex(VENDOR_ID)} product={hex(PRODUCT_ID)}")
    print("[thermal-printer-bridge] Ctrl+C to stop")
    server.serve_forever()


if __name__ == "__main__":
    main()
