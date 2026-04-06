"""
Apple TV controller using pyatv.
Refactored from the existing shabbat_auto.py implementation.
"""
import asyncio
import logging
from typing import Optional, List

from .base import DeviceController, DeviceType, DeviceInfo, PlaybackState

logger = logging.getLogger(__name__)

try:
    import pyatv
    PYATV_AVAILABLE = True
except ImportError:
    PYATV_AVAILABLE = False
    logger.warning("pyatv not installed — Apple TV support disabled")


class AppleTVController(DeviceController):
    device_type = DeviceType.APPLE_TV

    def __init__(self, address: str, identifier: str, name: str = "Apple TV"):
        self.address = address
        self.identifier = identifier
        self.name = name
        self._atv = None
        self._remote = None
        self._connected = False

    async def connect(self, credentials: Optional[dict] = None) -> bool:
        if not PYATV_AVAILABLE:
            raise RuntimeError("pyatv is not installed")

        try:
            atvs = await pyatv.scan(asyncio.get_event_loop(), identifier=self.identifier, timeout=5)
            if not atvs:
                logger.error(f"Apple TV {self.identifier} not found on network")
                return False

            conf = atvs[0]

            # Apply stored credentials
            if credentials:
                for protocol_name, cred_data in credentials.items():
                    try:
                        protocol = pyatv.const.Protocol[protocol_name]
                        conf.set_credentials(protocol, cred_data)
                    except (KeyError, Exception) as e:
                        logger.warning(f"Failed to set credentials for {protocol_name}: {e}")

            self._atv = await pyatv.connect(conf, asyncio.get_event_loop())
            self._remote = self._atv.remote_control
            self._connected = True
            logger.info(f"Connected to Apple TV: {self.name} ({self.address})")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Apple TV: {e}")
            self._connected = False
            return False

    async def disconnect(self) -> None:
        if self._atv:
            self._atv.close()
            self._atv = None
            self._remote = None
        self._connected = False

    async def play(self) -> None:
        if self._remote:
            await self._remote.play()

    async def pause(self) -> None:
        if self._remote:
            await self._remote.pause()

    async def play_pause(self) -> None:
        if self._remote:
            await self._remote.play_pause()

    async def select(self) -> None:
        if self._remote:
            await self._remote.select()

    async def up(self) -> None:
        if self._remote:
            await self._remote.up()

    async def down(self) -> None:
        if self._remote:
            await self._remote.down()

    async def left(self) -> None:
        if self._remote:
            await self._remote.left()

    async def right(self) -> None:
        if self._remote:
            await self._remote.right()

    async def menu(self) -> None:
        if self._remote:
            await self._remote.menu()

    async def home(self) -> None:
        if self._remote:
            await self._remote.home()

    async def get_playback_state(self) -> PlaybackState:
        if not self._atv:
            return PlaybackState.UNKNOWN
        try:
            playing = await self._atv.metadata.playing()
            state = playing.device_state
            if state == pyatv.const.DeviceState.Playing:
                return PlaybackState.PLAYING
            elif state == pyatv.const.DeviceState.Paused:
                return PlaybackState.PAUSED
            elif state == pyatv.const.DeviceState.Idle:
                return PlaybackState.IDLE
            elif state == pyatv.const.DeviceState.Loading:
                return PlaybackState.LOADING
            return PlaybackState.UNKNOWN
        except Exception:
            return PlaybackState.UNKNOWN

    async def get_playing_app(self) -> Optional[str]:
        if not self._atv:
            return None
        try:
            playing = await self._atv.metadata.playing()
            return playing.app_identifier or None
        except Exception:
            return None

    async def launch_app(self, app_id: str) -> None:
        if self._atv:
            await self._atv.apps.launch_app(app_id)

    async def turn_on(self) -> None:
        if self._remote:
            await self._remote.turn_on()

    async def turn_off(self) -> None:
        if self._remote:
            await self._remote.turn_off()

    async def volume_up(self) -> None:
        if self._remote:
            await self._remote.volume_up()

    async def volume_down(self) -> None:
        if self._remote:
            await self._remote.volume_down()

    @property
    def is_connected(self) -> bool:
        return self._connected and self._atv is not None

    @staticmethod
    async def scan(timeout: float = 5.0) -> List[DeviceInfo]:
        if not PYATV_AVAILABLE:
            return []
        try:
            atvs = await pyatv.scan(asyncio.get_event_loop(), timeout=timeout)
            devices = []
            for atv in atvs:
                protocols = [str(s.protocol.name) for s in atv.services]
                devices.append(DeviceInfo(
                    name=atv.name,
                    address=str(atv.address),
                    identifier=atv.identifier,
                    device_type=DeviceType.APPLE_TV,
                    protocols=protocols,
                    model=atv.device_info.model_str if hasattr(atv, 'device_info') else "",
                    manufacturer="Apple",
                ))
            return devices
        except Exception as e:
            logger.error(f"Apple TV scan error: {e}")
            return []
