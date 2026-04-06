"""
Abstract base class for all TV device controllers.
Each platform (Apple TV, Chromecast, Android TV, Roku, etc.) implements this interface.
"""
from abc import ABC, abstractmethod
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


class DeviceType(str, Enum):
    APPLE_TV = "appletv"
    CHROMECAST = "chromecast"
    ANDROID_TV = "androidtv"
    FIRE_TV = "firetv"
    ROKU = "roku"
    SAMSUNG = "samsung"
    LG = "lg"
    UNKNOWN = "unknown"


class PlaybackState(str, Enum):
    PLAYING = "playing"
    PAUSED = "paused"
    IDLE = "idle"
    LOADING = "loading"
    UNKNOWN = "unknown"


@dataclass
class DeviceInfo:
    """Discovered device info from network scan."""
    name: str
    address: str
    identifier: str
    device_type: DeviceType
    protocols: List[str] = field(default_factory=list)
    model: str = ""
    manufacturer: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)


class DeviceController(ABC):
    """
    Abstract controller for a TV device.
    All platforms implement the same interface so the automation script
    works identically regardless of the underlying device.
    """

    device_type: DeviceType = DeviceType.UNKNOWN

    @abstractmethod
    async def connect(self, credentials: Optional[dict] = None) -> bool:
        """Connect to the device. Returns True on success."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the device."""
        ...

    @abstractmethod
    async def play(self) -> None:
        """Send play command."""
        ...

    @abstractmethod
    async def pause(self) -> None:
        """Send pause command."""
        ...

    @abstractmethod
    async def play_pause(self) -> None:
        """Toggle play/pause."""
        ...

    @abstractmethod
    async def select(self) -> None:
        """Send select/OK/enter command."""
        ...

    @abstractmethod
    async def up(self) -> None:
        ...

    @abstractmethod
    async def down(self) -> None:
        ...

    @abstractmethod
    async def left(self) -> None:
        ...

    @abstractmethod
    async def right(self) -> None:
        ...

    @abstractmethod
    async def menu(self) -> None:
        """Send menu/back command."""
        ...

    @abstractmethod
    async def home(self) -> None:
        """Send home command."""
        ...

    @abstractmethod
    async def get_playback_state(self) -> PlaybackState:
        """Get current playback state."""
        ...

    @abstractmethod
    async def get_playing_app(self) -> Optional[str]:
        """Get the currently active app identifier/name."""
        ...

    async def launch_app(self, app_id: str) -> None:
        """Launch an app by its identifier. Optional — not all platforms support this."""
        raise NotImplementedError(f"{self.device_type} does not support launch_app")

    async def turn_on(self) -> None:
        """Turn on the device. Optional."""
        raise NotImplementedError(f"{self.device_type} does not support turn_on")

    async def turn_off(self) -> None:
        """Turn off the device. Optional."""
        raise NotImplementedError(f"{self.device_type} does not support turn_off")

    async def volume_up(self) -> None:
        """Increase volume. Optional."""
        raise NotImplementedError(f"{self.device_type} does not support volume_up")

    async def volume_down(self) -> None:
        """Decrease volume. Optional."""
        raise NotImplementedError(f"{self.device_type} does not support volume_down")

    @property
    def is_connected(self) -> bool:
        """Return True if currently connected to the device."""
        return False

    @staticmethod
    @abstractmethod
    async def scan(timeout: float = 5.0) -> List[DeviceInfo]:
        """Scan the network for devices of this type."""
        ...
