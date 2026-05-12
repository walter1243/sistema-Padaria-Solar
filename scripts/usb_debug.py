#!/usr/bin/env python3
"""Debug USB device structure for thermal printer."""

import usb.backend.libusb1
import usb.core
import usb.util
from libusb_package import find_library

backend = usb.backend.libusb1.get_backend(find_library=find_library)

# Find device 0x062a:0x4101
device = usb.core.find(idVendor=0x062a, idProduct=0x4101, backend=backend)

if device is None:
    print("Device not found")
    exit(1)

print(f"Found device: {device}")
print(f"VID:PID = {device.idVendor:#06x}:{device.idProduct:#06x}")

try:
    device.set_configuration()
    print("Configuration set successfully")
except Exception as e:
    print(f"Configuration error (may be already set): {e}")

cfg = device.get_active_configuration()
print(f"\nActive configuration: {cfg.bConfigurationValue}")
print(f"Number of interfaces: {cfg.bNumInterfaces}")

for intf_idx, interface in enumerate(cfg):
    print(f"\n--- Interface {intf_idx} ---")
    print(f"  Class: {interface.bInterfaceClass}")
    print(f"  SubClass: {interface.bInterfaceSubClass}")
    print(f"  Protocol: {interface.bInterfaceProtocol}")
    print(f"  Number of endpoints: {interface.bNumEndpoints}")
    
    for ep_idx, endpoint in enumerate(interface):
        direction = usb.util.endpoint_direction(endpoint.bEndpointAddress)
        direction_name = "OUT" if direction == usb.util.ENDPOINT_OUT else "IN"
        print(f"    Endpoint {ep_idx}: {direction_name} @ {endpoint.bEndpointAddress:#04x}")
        print(f"      Type: {usb.util.endpoint_type(endpoint.bmAttributes)}")
        print(f"      Max packet size: {endpoint.wMaxPacketSize}")

print("\n--- Trying to claim interface 0 ---")
try:
    device.detach_kernel_driver(0)
    print("Kernel driver detached")
except Exception as e:
    print(f"Could not detach kernel driver: {e}")

try:
    cfg = device.get_active_configuration()
    intf = cfg[(0, 0)]
    device.claim_interface(intf)
    print("Interface claimed successfully")
except Exception as e:
    print(f"Interface claim error: {e}")

print("\n✓ Device structure inspected successfully")
