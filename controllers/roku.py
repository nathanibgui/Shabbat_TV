"""
Roku controller using the Roku External Control Protocol (ECP).
REST API on port 8060 — no library needed, just HTTP requests.
"""
import asyncio
import logging
from typing import Optional, List
from xml.etree import ElementTree

from .base import DeviceController, DeviceType, DeviceInfo, PlaybackState

logger = logging.getLogger(__name__)

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False


class RokuController(DeviceController):
    device_type = DeviceType.ROKU

    def __init__(self, address: str, identifier: str, name: str = "Roku"):
        self.address = address
        self.identifier = identifier
        self.name = name
        self._base_url = f"http://{address}:8060"
        self._connected = False

    async def _post(self, path: str) -> None:
        if not AIOHTTP_AVAILABLE:
            return
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self._base_url}{path}", timeout=aiohttp.ClientTimeout(total=5)):
                pass

    async def _get(self, path: str) -> str:
        if not AIOHTTP_AVAILABLE:
            return ""
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self._base_url}{path}", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                return await resp.text()

    async def connect(self, credentials: Optional[dict] = None) -> bool:
        try:
            info = await self._get("/query/device-info")
            if info:
                self._connected = True
                logger.info(f"Connected to Roku: {self.name} ({self.address})")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to connect to Roku: {e}")
            return False

    async def disconnect(self) -> None:
        self._connected = False

    async def play(self) -> None:
        await self._post("/keypress/Play")

    async def pause(self) -> None:
        await self._post("/keypress/Play")  # Toggle

    async def play_pause(self) -> None:
        await self._post("/keypress/Play")

    async def select(self) -> None:
        await self._post("/keypress/Select")

    async def up(self) -> None:
        await self._post("/keypress/Up")

    async def down(self) -> None:
        await self._post("/keypress/Down")

    async def left(self) -> None:
        await self._post("/keypress/Left")

    async def right(self) -> None:
        await self._post("/keypress/Right")

    async def menu(self) -> None:
        await self._post("/keypress/Back")

    async def home(self) -> None:
        await self._post("/keypress/Home")

    async def get_playback_state(self) -> PlaybackState:
        try:
            result = await self._get("/query/media-player")
            if "<state>play</state>" in result:
                return PlaybackState.PLAYING
            elif "<state>pause</state>" in result:
                return PlaybackState.PAUSED
            return PlaybackState.IDLE
        except Exception:
            return PlaybackState.UNKNOWN

    async def get_playing_app(self) -> Optional[str]:
        try:
            result = await self._get("/query/active-app")
            root = ElementTree.fromstring(result)
            app = root.find("app")
            if app is not None:
                return app.get("id") or app.text
            return None
        except Exception:
            return None

    async def launch_app(self, app_id: str) -> None:
        await self._post(f"/launch/{app_id}")

    async def turn_off(self) -> None:
        await self._post("/keypress/PowerOff")

    async def volume_up(self) -> None:
        await self._post("/keypress/VolumeUp")

    async def volume_down(self) -> None:
        await self._post("/keypress/VolumeDown")

    @property
    def is_connected(self) -> bool:
        return self._connected

    @staticmethod
    async def scan(timeout: float = 5.0) -> List[DeviceInfo]:
        """Scan for Roku devices via SSDP (Simple Service Discovery Protocol)."""
        devices = []
        try:
            import socket
            SSDP_ADDR = "239.255.255.250"
            SSDP_PORT = 1900
            SEARCH_MSG = (
                'M-SEARCH * HTTP/1.1\r\n'
                f'HOST: {SSDP_ADDR}:{SSDP_PORT}\r\n'
                'MAN: "ssdp:discover"\r\n'
                f'MX: {int(timeout)}\r\n'
                'ST: roku:ecp\r\n'
                '\r\n'
            ).encode()

            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(timeout)
            sock.sendto(SEARCH_MSG, (SSDP_ADDR, SSDP_PORT))

            seen = set()
            try:
                while True:
                    data, addr = sock.recvfrom(4096)
                    ip = addr[0]
                    if ip in seen:
                        continue
                    seen.add(ip)

                    # Get device info
                    if AIOHTTP_AVAILABLE:
                        async with aiohttp.ClientSession() as session:
                            async with session.get(
                                f"http://{ip}:8060/query/device-info",
                                timeout=aiohttp.ClientTimeout(total=3)
                            ) as resp:
                                info_xml = await resp.text()
                                root = ElementTree.fromstring(info_xml)
                                name = root.findtext("friendly-device-name") or root.findtext("user-device-name") or "Roku"
                                model = root.findtext("model-name") or ""
                                serial = root.findtext("serial-number") or ip

                                devices.append(DeviceInfo(
                                    name=name,
                                    address=ip,
                                    identifier=serial,
                                    device_type=DeviceType.ROKU,
                                    protocols=["ecp"],
                                    model=model,
                                    manufacturer="Roku",
                                ))
            except socket.timeout:
                pass
            finally:
                sock.close()

        except Exception as e:
            logger.error(f"Roku scan error: {e}")

        return devices
