#!/usr/bin/env python3
"""Test Win32Raw printer connection."""

from escpos.printer import Win32Raw

printer_names = ["ELGIN i9(USB)", "ELGIN i9 USB", "ELGIN i9", "Bematech i9"]

for name in printer_names:
    try:
        print(f"\n[TESTING] {name}")
        printer = Win32Raw(name)
        printer.open()
        print(f"  ✓ Opened successfully")
        
        # Try simple test print
        printer._raw(b'\x1b\x40')  # ESC @
        printer.set(align='center', font='a', bold=True, width=1, height=1)
        printer.text('TESTE WIN32RAW\n')
        printer.text('ELGIN I9\n')
        printer.cut()
        printer.close()
        
        print(f"  ✓ Print test successful!")
        break
    except Exception as e:
        print(f"  ✗ Error: {e}")

print("\nDone.")
