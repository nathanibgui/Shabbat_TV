"""
Android TV / Fire TV controller using ADB (Android Debug Bridge).
Supports: Nvidia Shield, Fire TV Stick, Mi Box, any Android TV device.
Requires ADB debugging enabled on the device.
"""
import asyncio
import logging
import subprocess
from typing import Optional, List

from .base import DeviceController, DeviceType, DeviceInfo, PlaybackState

logger = logging.getLogger(__name__)

# ADB key events
KEY_PLAY = 126
KEY_PAUSE = 127
KEY_PLAY_PAUSE = 85
KEY_DPAD_UP = 19
KEY_DPAD_DOWN = 20
KEY_DPAD_LEFT = 21
KEY_DPAD_RIGHT = 22
KEY_ENTER = 66
KEY_BACK = 4
KEY_HOME = 3
KEY_VOLUME_UP = 24
KEY_VOLUME_DOWN = 25
KEY_POWER = 26


class AndroidTVController(DeviceController):
    """Controller for Android TV and Fire TV devices via ADB."""

    def __init__(self, address: str, identifier: str, name: str = "Android TV",
                 is_firetv: bool = False):
        self.address = address
        self.identifier = identifier
        self.name = name
        self.device_type = DeviceType.FIRE_TV if is_firetv else DeviceType.ANDROID_TV
        self._connected = False
        self._adb_target = f"{address}:5555"

    async def _adb(self, *args: str) -> str:
        """Run an ADB command and return output."""
        cmd = ["adb", "-s", self._adb_target] + list(args)
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
            return stdout.decode().strip()
        except Exception as e:
            logger.error(f"ADB command failed: {' '.join(cmd)} — {e}")
            return ""

    async def _keyevent(self, keycode: int) -> None:
        await self._adb("shell", "input", "keyevent", str(keycode))

    async def connect(self, credentials: Optional[dict] = None) -> bool:
        try:
            result = await self._adb("connect", self._adb_target)
            if "connected" in result.lower() or "already" in result.lower():
                self._connected = True
                logger.info(f"Connected to {self.name} ({self._adb_target})")
                return True
            logger.error(f"ADB connect failed: {result}")
            return False
        except Exception as e:
            logger.error(f"Failed to connect to Android TV: {e}")
            return False

    async def disconnect(self) -> None:
        await self._adb("disconnect", self._adb_target)
        self._connected = False

    async def play(self) -> None:
        await self._keyevent(KEY_PLAY)

    async def pause(self) -> None:
        await self._keyevent(KEY_PAUSE)

    async def play_pause(self) -> None:
        await self._keyevent(KEY_PLAY_PAUSE)

    async def select(self) -> None:
        await self._keyevent(KEY_ENTER)

    async def up(self) -> None:
        await self._keyevent(KEY_DPAD_UP)

    async def down(self) -> None:
        await self._keyevent(KEY_DPAD_DOWN)

    async def left(self) -> None:
        await self._keyevent(KEY_DPAD_LEFT)

    async def right(self) -> None:
        await self._keyevent(KEY_DPAD_RIGHT)

    async def menu(self) -> None:
        await self._keyevent(KEY_BACK)

    async def home(self) -> None:
        await self._keyevent(KEY_HOME)

    async def get_playback_state(self) -> PlaybackState:
        try:
            result = await self._adb("shell", "dumpsys", "media_session")
            if "state=3" in result:  # PlaybackState.STATE_PLAYING
                return PlaybackState.PLAYING
            elif "state=2" in result:  # STATE_PAUSED
                return PlaybackState.PAUSED
            elif "state=1" in result:  # STATE_STOPPED
                return PlaybackState.IDLE
            return PlaybackState.UNKNOWN
        except Exception:
            return PlaybackState.UNKNOWN

    async def get_playing_app(self) -> Optional[str]:
        try:
            result = await self._adb("shell", "dumpsys", "window", "windows")
            for line in result.split("\n"):
                if "mCurrentFocus" in line or "mFocusedApp" in line:
                    # Extract package name: com.netflix.ninja/com.netflix.ninja.MainActivity
                    parts = line.split("/")
                    if len(parts) >= 2:
                        pkg = parts[0].split()[-1]
                        return pkg
            return None
        except Exception:
            return None

    async def launch_app(self, app_id: str) -> None:
        await self._adb("shell", "monkey", "-p", app_id, "-c",
                        "android.intent.category.LAUNCHER", "1")

    async def turn_on(self) -> None:
        # Wake up the device
        state = await self._adb("shell", "dumpsys", "power")
        if "mWakefulness=Asleep" in state or "mWakefulness=Dozing" in state:
            await self._keyevent(KEY_POWER)

    async def turn_off(self) -> None:
        state = await self._adb("shell", "dumpsys", "power")
        if "mWakefulness=Awake" in state:
            await self._keyevent(KEY_POWER)

    async def volume_up(self) -> None:
        await self._keyevent(KEY_VOLUME_UP)

    async def volume_down(self) -> None:
        await self._keyevent(KEY_VOLUME_DOWN)

    @property
    def is_connected(self) -> bool:
        return self._connected

    @staticmethod
    async def scan(timeout: float = 5.0) -> List[DeviceInfo]:
        """
        Scan for Android TV devices.
        Uses ADB to check for devices already connected + nmap for discovery.
        Note: ADB devices need to have wireless debugging enabled.
        """
        devices = []
        try:
            proc = await asyncio.create_subprocess_exec(
                "adb", "devices",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            lines = stdout.decode().strip().split("\n")[1:]  # Skip header

            for line in lines:
                if not line.strip() or "offline" in line:
                    continue
                parts = line.split("\t")
                if len(parts) >= 2 and parts[1].strip() == "device":
                    addr = parts[0].strip()
                    ip = addr.split(":")[0] if ":" in addr else addr

                    # Try to get device model
                    try:
                        model_proc = await asyncio.create_subprocess_exec(
                            "adb", "-s", addr, "shell", "getprop", "ro.product.model",
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        )
                        model_out, _ = await asyncio.wait_for(model_proc.communicate(), timeout=3)
                        model = model_out.decode().strip()
                    except Exception:
                        model = ""

                    # Detect Fire TV
                    is_firetv = "fire" in model.lower() or "aftt" in model.lower() or "afts" in model.lower()
                    dtype = DeviceType.FIRE_TV if is_firetv else DeviceType.ANDROID_TV

                    devices.append(DeviceInfo(
                        name=model or f"Android TV ({ip})",
                        address=ip,
                        identifier=addr,
                        device_type=dtype,
                        protocols=["adb"],
                        model=model,
                        manufacturer="Amazon" if is_firetv else "Android",
                    ))
        except FileNotFoundError:
            logger.info("ADB not found — Android TV scan disabled")
        except Exception as e:
            logger.error(f"Android TV scan error: {e}")

        return devices
