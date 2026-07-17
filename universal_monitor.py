#!/usr/bin/env python3
"""
Universal Monitor — auto-continue pour TOUT type d'appareil
============================================================
Moniteur generique base sur l'interface DeviceController (controllers/).
La ou shabbat_auto.ShabbatController est specifique Apple TV (event-driven
via pyatv PushUpdater), ce moniteur fonctionne par POLLING avec n'importe
quel controller : Chromecast, Fire TV / Android TV (ADB), Roku, etc.

Meme logique metier que ShabbatController :
  - Detecte lecture -> arret, attend REACT_DELAY, envoie play puis select
  - Fallback play+select periodique en cas de doute
  - Reconnexion avec backoff
"""
import asyncio
import logging
from datetime import datetime

from controllers.base import DeviceController, PlaybackState

log = logging.getLogger("universal_monitor")

POLL_INTERVAL = 15       # Secondes entre polls d'etat
REACT_DELAY = 15         # Secondes avant de reagir a un arret
FALLBACK_MINUTES = 25    # Minutes entre fallback play+select
RECONNECT_DELAYS = [5, 10, 20, 30, 60]

STOPPED_STATES = {PlaybackState.PAUSED, PlaybackState.IDLE}
PLAYING_STATES = {PlaybackState.PLAYING, PlaybackState.LOADING}


class UniversalMonitor:
    """
    Boucle de monitoring par polling pour un DeviceController generique.
    API compatible avec ShabbatController pour le hub_agent :
      .running, .press_count, .reconnect_count, .apple_tv (alias .connected)
    """

    def __init__(self, device: dict, controller: DeviceController,
                 notifier, fallback_minutes: int = FALLBACK_MINUTES):
        self.device = device
        self.controller = controller
        self.notifier = notifier
        self.fallback_minutes = fallback_minutes

        self.running = False
        self.press_count = 0
        self.reconnect_count = 0
        self.was_playing = False
        self.stopped_since = None
        self.last_fallback = datetime.now()
        # Compat avec l'API ShabbatController utilisee par hub_agent
        self.connection_lost_event = asyncio.Event()

    @property
    def apple_tv(self):
        """Compat hub_agent : truthy si connecte (nom historique)."""
        return self.controller if self.controller.is_connected else None

    # ── Connexion ──

    async def connect(self) -> bool:
        try:
            ok = await self.controller.connect(self.device.get("credentials") or {})
            if ok:
                self.reconnect_count += 1
                log.info(f"[{self.device['name']}] Connecte "
                         f"(connexion #{self.reconnect_count})")
            return ok
        except Exception as e:
            log.warning(f"[{self.device['name']}] Connexion echouee: {e}")
            return False

    async def reconnect_with_backoff(self) -> bool:
        for i, delay in enumerate(RECONNECT_DELAYS):
            if not self.running:
                return False
            log.info(f"[{self.device['name']}] Reconnexion dans {delay}s "
                     f"({i + 1}/{len(RECONNECT_DELAYS)})...")
            await asyncio.sleep(delay)
            if await self.connect():
                return True
        # Retry infini toutes les 60s tant que le mode est actif
        while self.running:
            await asyncio.sleep(60)
            if await self.connect():
                return True
        return False

    # ── Relance ──

    async def _react_to_stop(self):
        """Arret detecte et confirme -> play, puis select si besoin."""
        self.press_count += 1
        name = self.device["name"]
        log.info(f"[{name}] [#{self.press_count}] Arret confirme -> Play")
        try:
            await self.controller.play()
            await asyncio.sleep(5)
            state = await self.controller.get_playback_state()
            if state in STOPPED_STATES:
                log.info(f"[{name}]   Toujours arrete -> Select")
                await self.controller.select()
                await asyncio.sleep(2)
            self.stopped_since = None
            self.last_fallback = datetime.now()
            await self.notifier.notify_action(name, "Relance auto", self.press_count)
        except Exception as e:
            log.warning(f"[{name}] Relance echouee: {e}")
            self.stopped_since = None
            raise

    async def _fallback_if_due(self):
        """Play+Select periodique en cas de doute (etats UNKNOWN...)."""
        elapsed = (datetime.now() - self.last_fallback).total_seconds()
        if elapsed < self.fallback_minutes * 60:
            return
        self.press_count += 1
        log.info(f"[{self.device['name']}] [#{self.press_count}] "
                 f"Fallback Play+Select ({self.fallback_minutes}min)")
        try:
            await self.controller.play()
            await asyncio.sleep(2)
            await self.controller.select()
            self.last_fallback = datetime.now()
        except Exception as e:
            log.warning(f"[{self.device['name']}] Fallback echoue: {e}")
            raise

    # ── Boucle principale ──

    async def run(self, end_time: datetime):
        """Polling jusqu'a end_time. Compatible ShabbatController.run()."""
        self.running = True
        name = self.device["name"]
        dtype = self.device.get("type", "?")

        log.info(f"=== Universal Monitor ({dtype}) ===")
        log.info(f"  Appareil: {name} ({self.device.get('address')})")
        log.info(f"  Poll: {POLL_INTERVAL}s | React: {REACT_DELAY}s | "
                 f"Fallback: {self.fallback_minutes}min")
        log.info(f"  Fin prevue: {end_time.strftime('%a %d/%m %H:%M')}")

        if not await self.connect():
            await self.notifier.notify_error(name, "Connexion initiale echouee")
            if not await self.reconnect_with_backoff():
                log.error(f"[{name}] Impossible de se connecter. Abandon.")
                self.running = False
                return
        await self.notifier.notify_connected(name)

        consecutive_errors = 0
        try:
            while self.running and datetime.now() < end_time:
                # Attente interruptible (stop via connection_lost_event)
                try:
                    await asyncio.wait_for(
                        self.connection_lost_event.wait(), timeout=POLL_INTERVAL
                    )
                    self.connection_lost_event.clear()
                    if not self.running:
                        break
                except asyncio.TimeoutError:
                    pass

                try:
                    state = await self.controller.get_playback_state()
                    consecutive_errors = 0

                    if state in PLAYING_STATES:
                        if self.stopped_since is not None:
                            log.info(f"[{name}] Lecture reprise ({state.value})")
                        self.stopped_since = None
                        self.was_playing = True

                    elif state in STOPPED_STATES and self.was_playing:
                        if self.stopped_since is None:
                            self.stopped_since = datetime.now()
                            log.info(f"[{name}] Arret detecte ({state.value}), "
                                     f"confirmation dans {REACT_DELAY}s...")
                        elif (datetime.now() - self.stopped_since).total_seconds() >= REACT_DELAY:
                            await self._react_to_stop()

                    else:
                        # UNKNOWN ou jamais joue -> fallback periodique
                        await self._fallback_if_due()

                except Exception as e:
                    consecutive_errors += 1
                    log.warning(f"[{name}] Erreur poll ({consecutive_errors}): {e}")
                    if consecutive_errors >= 3:
                        # Connexion probablement morte -> reconnexion
                        await self.notifier.notify_disconnected(name)
                        try:
                            await self.controller.disconnect()
                        except Exception:
                            pass
                        if not await self.reconnect_with_backoff():
                            break
                        consecutive_errors = 0
                        await self.notifier.notify_connected(name)

        finally:
            self.running = False
            try:
                await self.controller.disconnect()
            except Exception:
                pass

        log.info(f"[{name}] Termine. {self.press_count} relances, "
                 f"{self.reconnect_count} connexions.")
        await self.notifier.notify_finished(
            name, self.press_count, self.reconnect_count, 0
        )
