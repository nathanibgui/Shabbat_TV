# Shabbat TV - Point Projet

## Concept

Application permettant de ne jamais toucher la telecommande Apple TV pendant Shabbat.
Le script detecte automatiquement quand la lecture s'arrete (fin d'episode, "Etes-vous toujours la?", pub, etc.) et relance la lecture.
Fonctionne avec toutes les apps de streaming (Netflix, Disney+, YouTube, Prime Video, Apple TV+, Molotov...).

---

## Architecture actuelle

### Fichiers du projet

```
D:\Dev\Shabbat\
  pair.py              # Appairage universel Apple TV (scan + choix + PIN)
  shabbat_auto.py      # Auto-continue v1.1 (event-driven, push updater)
  server.py            # Dashboard API + WebSocket (aiohttp, port 8080)
  app.html             # Frontend PWA (onboarding + setup + accueil)
  shabbat.db           # SQLite (devices, events, settings, shabbat_log)
  logs/                # Logs par appareil (device_1.log, etc.)
  _archive/            # Anciens fichiers (plus utilises)
  .claude/launch.json  # Config serveur de dev
```

### Base de donnees (shabbat.db)

| Table | Role |
|-------|------|
| `devices` | Appareils appaires (nom, IP, identifiant, credentials, enabled) |
| `events` | Historique des actions (relances, erreurs, connexions) |
| `shabbat_log` | Historique des Shabbats (horaires, parasha) |
| `settings` | Preferences (notifications, ntfy topic) |

---

## Backend (Python)

### pair.py
- Scan reseau via pyatv
- Selection interactive d'une Apple TV
- Appairage Companion + AirPlay avec code PIN
- Sauvegarde des credentials en DB

### shabbat_auto.py (v1.1)
- **Event-driven** : utilise `PushUpdater` de pyatv (plus de polling)
- **DeviceListener** pour detecter les pertes de connexion instantanement
- **Heartbeat** toutes les 30s
- **Reconnexion avec backoff** : 5s -> 10s -> 20s -> 30s -> 60s
- **Fallback** : Play + Select toutes les 25min en cas de doute
- **Mode --auto-shabbat** : attend l'entree de Shabbat (Hebcal), s'arrete a havdalah + 30min
- **Notifications** via ntfy.sh (push mobile gratuit)

### server.py (v4.1)
- API REST dynamique (plus de TV hardcodees)
- WebSocket pour logs temps reel
- Watchdog : relance les scripts morts pendant Shabbat
- Horaires Shabbat via API Hebcal (Paris par defaut)

#### Routes API

| Route | Methode | Role |
|-------|---------|------|
| `/api/devices` | GET | Liste des appareils avec status |
| `/api/scan` | GET | Scan reseau Apple TV |
| `/api/pair/start` | POST | Demarre l'appairage reel (pyatv) |
| `/api/pair/pin` | POST | Envoie le code PIN |
| `/api/pair/cancel` | POST | Annule l'appairage |
| `/api/playback/{id}` | GET | Etat de lecture |
| `/api/command/{id}` | POST | Envoie une commande (play, select...) |
| `/api/script/start/{id}` | POST | Demarre le mode Shabbat |
| `/api/script/stop/{id}` | POST | Arrete le mode Shabbat |
| `/api/device/rename/{id}` | POST | Renomme un appareil |
| `/api/device/delete/{id}` | POST | Supprime un appareil |
| `/api/device/toggle/{id}` | POST | Active/desactive un appareil |
| `/api/shabbat` | GET | Horaires Shabbat + countdown |
| `/api/history` | GET | Historique + stats |
| `/api/settings` | GET/POST | Preferences utilisateur |
| `/api/watchdog` | POST | Toggle watchdog |
| `/ws` | WS | Logs temps reel |

---

## Frontend (app.html - PWA)

### Flow utilisateur complet

```
1. Onboarding (5 ecrans)
   - Bienvenue
   - Comment ca marche
   - Connexion (Google OAuth / email)
   - Personnalisation (genre homme/femme, style Jewbot)
   - "Tout est pret !"

2. Setup Wizard (4 ecrans)
   - Scan reseau + selection d'UNE Apple TV (cartes cliquables)
   - Appairage reel avec code PIN (progress bar + etapes visuelles)
   - Notifications (5 toggles granulaires)
   - Mega toggle Shabbat Mode (cercle 180px avec confettis)

3. Accueil (utilisation quotidienne)
   - Hero Shabbat (parasha, horaires, countdown temps reel)
   - Cartes Apple TV avec toggle ON/OFF + "Modifier"
   - Bento grid : Ajouter, Programmer, Statistiques, Ma ville
   - Profil en haut a droite (avatar avec initiale ou photo Google)
```

### Design
- Theme clair (`#f5f3ff`)
- Blobs flottants animes en arriere-plan
- Glassmorphism sur le header
- Animations spring sur les toggles
- Confettis a l'activation du mode Shabbat et apres appairage
- Vibration haptic sur mobile
- Flash violet a la selection
- Barre de progression animee pendant l'appairage
- Bottom sheets avec courbe de bezier fluide
- Google Sign-In avec popup responsive (bottom sheet sur mobile)
- Gestion appareils : renommer (champ inline 22px bold), supprimer (zone de danger)

### Authentification
- Google OAuth via Google Identity Services (GIS)
- Client ID : `752558880706-4fh0m4j075f7qjt0d1kqca1c0njr5ndm.apps.googleusercontent.com`
- Fallback : inscription par email
- Stockage local (localStorage) — pas de backend auth pour l'instant

---

## Ce qui fonctionne

- [x] Scan reseau Apple TV
- [x] Appairage reel Companion + AirPlay via l'interface web (code PIN)
- [x] Detection play/pause event-driven (PushUpdater)
- [x] Reconnexion automatique avec backoff
- [x] Horaires Shabbat automatiques (Hebcal)
- [x] Mode auto-shabbat (attend les bougies, s'arrete a havdalah)
- [x] Watchdog (relance les scripts morts)
- [x] Dashboard web avec WebSocket temps reel
- [x] Google Sign-In
- [x] Inscription email
- [x] Onboarding 5 etapes
- [x] Setup wizard 4 etapes
- [x] Gestion appareils (renommer, supprimer)
- [x] Notifications granulaires (5 types)
- [x] Confettis, animations, vibrations haptic

## Ce qui reste a faire

- [ ] Backend auth reel (JWT, sessions) au lieu de localStorage
- [ ] Choix de la ville (geonameid Hebcal)
- [ ] Strategies par app (Netflix "still watching?", etc.)
- [ ] Portage Raspberry Pi (toujours allume)
- [ ] PWA offline + service worker
- [ ] Tests automatises
- [ ] App Store (React Native / Flutter)
- [ ] Multi-foyer / multi-utilisateur
- [ ] Chiffrement des credentials en DB

---

## Pour lancer

```bash
# 1. Installer les dependances
pip install pyatv aiohttp

# 2. Lancer le serveur
python server.py

# 3. Ouvrir dans le navigateur
http://localhost:8080
```

## Pour appairer en ligne de commande (alternative)

```bash
python pair.py           # Scan + choix + appairage interactif
python pair.py --list    # Voir les appareils appaires
python pair.py --scan    # Scanner sans appairer
```

## Pour lancer le mode Shabbat manuellement

```bash
python shabbat_auto.py --start --device 1
python shabbat_auto.py --start --device 1 --auto-shabbat
python shabbat_auto.py --start --device 1 --ntfy shabbat-famille
```
