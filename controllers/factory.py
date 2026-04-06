"""
Factory for creating device controllers and scanning all platforms.
"""
import asyncio
import logging
from typing import List, Optional

from .base import DeviceController, DeviceType, DeviceInfo
from .appletv import AppleTVController
from .chromecast import ChromecastController
from .androidtv import AndroidTVController
from .roku import RokuController

logger = logging.getLogger(__name__)

# Registry of all controller classes
CONTROLLER_CLASSES = {
    DeviceType.APPLE_TV: AppleTVController,
    DeviceType.CHROMECAST: ChromecastController,
    DeviceType.ANDROID_TV: AndroidTVController,
    DeviceType.FIRE_TV: AndroidTVController,  # Fire TV uses same ADB controller
    DeviceType.ROKU: RokuController,
}


def create_controller(
    device_type: DeviceType,
    address: str,
    identifier: str,
    name: str = "",
    **kwargs
) -> DeviceController:
    """Create a device controller for the given device type."""
    cls = CONTROLLER_CLASSES.get(device_type)
    if not cls:
        raise ValueError(f"Unsupported device type: {device_type}")

    if device_type == DeviceType.FIRE_TV:
        return cls(address=address, identifier=identifier, name=name, is_firetv=True, **kwargs)

    return cls(address=address, identifier=identifier, name=name, **kwargs)


async def scan_all_devices(timeout: float = 5.0) -> List[DeviceInfo]:
    """
    Scan all supported platforms in parallel.
    Returns a combined list of discovered devices.
    """
    scanners = [
        AppleTVController.scan(timeout),
        ChromecastController.scan(timeout),
        AndroidTVController.scan(timeout),
        RokuController.scan(timeout),
    ]

    results = await asyncio.gather(*scanners, return_exceptions=True)
    all_devices: List[DeviceInfo] = []

    platform_names = ["Apple TV", "Chromecast", "Android TV/Fire TV", "Roku"]
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.warning(f"{platform_names[i]} scan failed: {result}")
        elif isinstance(result, list):
            logger.info(f"{platform_names[i]}: found {len(result)} device(s)")
            all_devices.extend(result)

    # Deduplicate by IP address
    seen_ips = set()
    unique = []
    for d in all_devices:
        if d.address not in seen_ips:
            seen_ips.add(d.address)
            unique.append(d)

    logger.info(f"Total devices found: {len(unique)}")
    return unique
