"""
Chromecast / Google TV controller using pychromecast.
Supports Chromecast, Chromecast with Google TV, Google TV devices.
"""
import asyncio
import logging
from typing import Optional, List

from .base import DeviceController, DeviceType, DeviceInfo, PlaybackState

logger = logging.getLogger(__name__)

try:
    import pychromecast
    PYCHROMECAST_AVAILABLE = True
except ImportError:
    PYCHROMECAST_AVAILABLE = False
    logger.info("pychromecast not installed — Chromecast support disabled. Install with: pip install pychromecast")


class ChromecastController(DeviceController):
    device_type = DeviceType.CHROMECAST

    def __init__(self, address: str, identifier: str, name: str = "Chromecast"):
        self.address = address
        self.identifier = identifier
        self.name = name
        self._cast = None
        self._mc = None  # Media controller
        self._connected = False

    async def connect(self, credentials: Optional[dict] = None) -> bool:
        if not PYCHROMECAST_AVAILABLE:
            raise RuntimeError("pychromecast is not installed")

        try:
            def _connect():
                chromecasts, browser = pychromecast.get_listed_chromecasts(
                    friendly_names=[self.name]
                )
                if not chromecasts:
                    # Try by UUID
                    chromecasts, browser = pychromecast.get_chromecasts()
                    chromecasts = [c for c in chromecasts if str(c.uuid) == self.identifier]
                if chromecasts:
                    cast = chromecasts[0]
                    cast.wait()
                    browser.stop_discovery()
                    return cast
                browser.stop_discovery()
                return None

            self._cast = await asyncio.get_event_loop().run_in_executor(None, _connect)
            if self._cast:
                self._mc = self._cast.media_controller
                self._connected = True
                logger.info(f"Connected to Chromecast: {self.name} ({self.address})")
                return True
            else:
                logger.error(f"Chromecast {self.name} not found")
                return False

        except Exception as e:
            logger.error(f"Failed to connect to Chromecast: {e}")
            return False

    async def disconnect(self) -> None:
        if self._cast:
            self._cast.disconnect()
        self._cast = None
        self._mc = None
        self._connected = False

    async def play(self) -> None:
        if self._mc:
            await asyncio.get_event_loop().run_in_executor(None, self._mc.play)

    async def pause(self) -> None:
        if self._mc:
            await asyncio.get_event_loop().run_in_executor(None, self._mc.pause)

    async def play_pause(self) -> None:
        state = await self.get_playback_state()
        if state == PlaybackState.PLAYING:
            await self.pause()
        else:
            await self.play()

    async def select(self) -> None:
        # Chromecast doesn't have a select button — play acts as resume
        await self.play()

    async def up(self) -> None:
        pass  # Not supported on Chromecast

    async def down(self) -> None:
        pass

    async def left(self) -> None:
        pass

    async def right(self) -> None:
        pass

    async def menu(self) -> None:
        pass  # No menu button on Chromecast

    async def home(self) -> None:
        if self._cast:
            await asyncio.get_event_loop().run_in_executor(None, self._cast.quit_app)

    async def get_playback_state(self) -> PlaybackState:
        if not self._mc:
            return PlaybackState.UNKNOWN
        try:
            status = self._mc.status
            if status and status.player_is_playing:
                return PlaybackState.PLAYING
            elif status and status.player_is_paused:
                return PlaybackState.PAUSED
            elif status and status.player_is_idle:
                return PlaybackState.IDLE
            return PlaybackState.UNKNOWN
        except Exception:
            return PlaybackState.UNKNOWN

    async def get_playing_app(self) -> Optional[str]:
        if not self._cast:
            return None
        try:
            app = self._cast.app_id
            return app
        except Exception:
            return None

    async def launch_app(self, app_id: str) -> None:
        if self._cast:
            await asyncio.get_event_loop().run_in_executor(
                None, self._cast.start_app, app_id
            )

    async def volume_up(self) -> None:
        if self._cast:
            vol = min(1.0, self._cast.status.volume_level + 0.1)
            await asyncio.get_event_loop().run_in_executor(
                None, self._cast.set_volume, vol
            )

    async def volume_down(self) -> None:
        if self._cast:
            vol = max(0.0, self._cast.status.volume_level - 0.1)
            await asyncio.get_event_loop().run_in_executor(
                None, self._cast.set_volume, vol
            )

    @property
    def is_connected(self) -> bool:
        return self._connected and self._cast is not None

    @staticmethod
    async def scan(timeout: float = 5.0) -> List[DeviceInfo]:
        if not PYCHROMECAST_AVAILABLE:
            return []
        try:
            def _scan():
                services, browser = pychromecast.discovery.discover_chromecasts(timeout=timeout)
                browser.stop_discovery()
                return services

            services = await asyncio.get_event_loop().run_in_executor(None, _scan)
            devices = []
            for service in services:
                devices.append(DeviceInfo(
                    name=service.friendly_name or "Chromecast",
                    address=str(service.host),
                    identifier=str(service.uuid),
                    device_type=DeviceType.CHROMECAST,
                    protocols=["cast"],
                    model=service.model_name or "",
                    manufacturer=service.manufacturer or "Google",
                ))
            return devices
        except Exception as e:
            logger.error(f"Chromecast scan error: {e}")
            return []
