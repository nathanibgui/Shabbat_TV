# ShabbatTV — Architecture de controle a distance

## Le probleme fondamental

Pour controler une TV (Apple TV, Chromecast, Fire TV...), il faut envoyer des commandes **sur le reseau local** (WiFi). Un serveur dans le cloud (VPS) ne peut pas atteindre directement une Apple TV chez l'utilisateur.

## Comment font les autres apps ?

### 1. Home Assistant (domotique)
- **Architecture** : Hub local (Raspberry Pi) + cloud relay optionnel (Nabu Casa)
- **Comment** : Le hub tourne chez l'utilisateur. Le cloud relay fait un tunnel chiffre entre le hub et l'app mobile via WebSocket
- **Probleme** : L'utilisateur doit installer un hub (technique)

### 2. Google Home / Alexa
- **Architecture** : Le device (enceinte/ecran) est DEJA sur le reseau local
- **Comment** : L'enceinte recoit les commandes du cloud Google/Amazon via HTTPS, puis les execute localement
- **Probleme** : Necessite un device Google/Amazon chez l'utilisateur

### 3. SmartThings (Samsung)
- **Architecture** : App mobile = hub + cloud relay
- **Comment** : L'app mobile decouvre les devices localement, se connecte au cloud Samsung pour la synchronisation, et execute les commandes localement
- **C'est exactement ce qu'on veut faire**

### 4. Plex / Spotify Connect
- **Architecture** : App mobile = telecommande, cloud = coordinateur
- **Comment** : L'app mobile et le device sont tous les deux connectes au cloud. Le cloud dit au device quoi jouer, mais le streaming est local
- **Limitation** : Necessite que le device supporte le protocole (pas le cas Apple TV pour nous)

---

## Notre solution : le telephone comme hub local

### Architecture

```
                    INTERNET
    ┌─────────────────────────────────────┐
    │     VPS (shabbat.nathanibgui.com)   │
    │                                     │
    │  ┌─────────────────────────────┐    │
    │  │  API Backend (Python)       │    │
    │  │  - Comptes utilisateurs     │    │
    │  │  - PostgreSQL               │    │
    │  │  - Horaires Hebcal          │    │
    │  │  - Programmations           │    │
    │  │  - WebSocket server         │    │
    │  └──────────┬──────────────────┘    │
    └─────────────┼───────────────────────┘
                  │ WebSocket (persistent)
                  │
    ┌─────────────┼───────────────────────┐
    │  TELEPHONE  │  (app mobile)         │
    │             │                       │
    │  ┌──────────▼──────────────────┐    │
    │  │  Foreground Service         │    │
    │  │  - Connecte au VPS (WS)     │    │
    │  │  - Recoit les ordres        │    │
    │  │  - Controle les TV (local)  │    │
    │  │  - Notification permanente  │    │
    │  └──────────┬──────────────────┘    │
    │             │ WiFi local            │
    └─────────────┼───────────────────────┘
                  │ mDNS / ADB / REST
    ┌─────────────┼───────────────────────┐
    │             ▼                       │
    │  ┌────────┐ ┌────────┐ ┌────────┐  │
    │  │Apple TV│ │Chromec.│ │Fire TV │  │
    │  └────────┘ └────────┘ └────────┘  │
    │         RESEAU LOCAL                │
    └─────────────────────────────────────┘
```

### Flow utilisateur

1. **Inscription** : L'utilisateur cree un compte sur `shabbat.nathanibgui.com`
2. **App mobile** : Il installe l'app, se connecte avec son compte
3. **Detection** : L'app detecte automatiquement les TV sur son WiFi
4. **Pairing** : Il connecte sa TV (PIN sur l'ecran)
5. **Activation** : Il active le mode Shabbat (ou programme un horaire)
6. **Avant Shabbat** : L'app lance le foreground service
7. **Pendant Shabbat** : Le VPS envoie "c'est l'heure" via WebSocket → le telephone execute les commandes sur la TV
8. **Apres Shabbat** : Le service s'arrete automatiquement

### Flow technique detaille

```
VENDREDI 18h (1h avant Shabbat):
  VPS → WS → telephone : { type: "prepare", message: "Shabbat dans 1h" }
  telephone : affiche notification "ShabbatTV se prepare"
  telephone : verifie connexion a la TV

VENDREDI 19h16 (allumage bougies):
  VPS → WS → telephone : { type: "start", mode: "shabbat" }
  telephone : active le monitoring TV
  telephone : boucle toutes les 15s — detecte si la TV est en pause → play + select

SAMEDI 21h26 (havdalah):
  VPS → WS → telephone : { type: "stop" }
  telephone : arrete le monitoring
  telephone : notification "Shabbat termine, Shavua Tov !"
```

---

## Plan d'implementation

### Phase 1 — Backend API sur le VPS (1-2 jours)

**Objectif** : API REST + WebSocket + PostgreSQL sur le VPS

**Fichiers a creer :**
- `backend/` — nouveau dossier pour le backend propre
- `backend/app.py` — API aiohttp (routes REST + WebSocket)
- `backend/models.py` — modeles SQLAlchemy (User, Device, Schedule, Event)
- `backend/auth.py` — authentification JWT (register, login, Google OAuth)
- `backend/ws_manager.py` — gestionnaire WebSocket (track des telephones connectes)
- `backend/scheduler.py` — cron qui check les horaires et envoie les commandes via WS
- `backend/hebcal.py` — service Hebcal (horaires par ville)

**Endpoints :**
```
POST /api/auth/register     — creer un compte
POST /api/auth/login        — login email/password
POST /api/auth/google       — login Google OAuth
GET  /api/auth/me           — profil utilisateur

GET  /api/devices           — liste des devices de l'utilisateur
POST /api/devices           — ajouter un device
PUT  /api/devices/:id       — modifier un device
DELETE /api/devices/:id     — supprimer un device

GET  /api/schedules         — liste des programmations
POST /api/schedules         — creer une programmation
PUT  /api/schedules/:id     — modifier
DELETE /api/schedules/:id   — supprimer

GET  /api/shabbat           — horaires Shabbat pour la ville de l'utilisateur
GET  /api/events            — historique des evenements
GET  /api/stats             — statistiques

WS   /ws                    — WebSocket bidirectionnel (VPS ↔ telephone)
```

**Base de donnees (PostgreSQL) :**
```sql
users (id, email, password_hash, first_name, last_name, gender,
       tradition, city_name, geonameid, language, streaming_apps,
       google_id, avatar_url, created_at)

devices (id, user_id, name, type, identifier, address,
         credentials, strategy, paired_at, last_seen)

schedules (id, user_id, device_id, mode, days, start_time,
           end_time, auto_off, enabled, created_at)

events (id, user_id, device_id, type, message, created_at)

sessions (id, user_id, token, device_info, connected_at, last_ping)
```

### Phase 2 — App mobile : foreground service (2-3 jours)

**Objectif** : L'app mobile peut controler les TV localement et communiquer avec le VPS

**Approche technique :**
- **Android** : Foreground Service avec notification permanente "ShabbatTV actif"
  - Tourne indefiniment tant que l'utilisateur ne l'arrete pas
  - Utilise `expo-task-manager` + `expo-background-fetch`
  - Ou module natif via `expo-modules-core`

- **iOS** : Plus restrictif
  - Background Audio (jouer un silence) pour maintenir l'app active
  - Ou Background Processing (30s max, mais peut etre re-demande)
  - Ou VoIP push notifications (necessite un certificat Apple)
  - **Solution pragmatique** : garder l'ecran allume en mode "kiosk" (luminosite minimale)

**Module natif TV Control :**
- Expo ne supporte pas nativement mDNS ou les protocoles Apple TV
- Option 1 : `expo-dev-client` avec module natif
- Option 2 : Le telephone fait un tunnel HTTP vers le VPS, qui route les commandes
- Option 3 : WebRTC data channel entre le VPS et le telephone

**Flow mobile :**
1. L'app se connecte au VPS via WebSocket
2. L'app scanne le reseau local pour trouver les TV
3. L'app enregistre les TV trouvees sur le VPS
4. Le VPS envoie les commandes au bon moment
5. L'app execute les commandes localement

### Phase 3 — Integration web + mobile (1 jour)

**Objectif** : Le dashboard web et l'app mobile partagent le meme backend

- Login unique (JWT)
- Meme API
- Le web montre le status en temps reel (la TV est-elle connectee ? le telephone est-il en ligne ?)
- Le web permet de programmer, le telephone execute

### Phase 4 — Notifications push (1 jour)

- **Firebase Cloud Messaging** (FCM) pour Android
- **Apple Push Notification Service** (APNs) pour iOS
- Rappel avant Shabbat
- Notification quand le mode demarre/arrete
- Alerte si le telephone perd la connexion

---

## Alternative simplifiee (MVP rapide)

Si le foreground service est trop complexe a implementer rapidement, on peut commencer par une approche plus simple :

### "Mode Shabbat" dans le navigateur

1. L'utilisateur ouvre `shabbat.nathanibgui.com` sur son **telephone**
2. Il clique "Activer le mode Shabbat"
3. La page reste ouverte (ecran allume, ou en arriere-plan)
4. Le JavaScript sur la page fait les appels API locaux vers la TV
5. **Probleme** : un navigateur ne peut pas faire de mDNS. Mais il PEUT faire des requetes HTTP vers une IP locale si l'utilisateur la connait

### Le telephone comme serveur Python

1. Sur Android, on peut executer Python via **Termux** ou **Pydroid**
2. L'utilisateur installe Termux + pip install pyatv aiohttp
3. `python server.py` tourne en arriere-plan
4. Pas ideal pour le grand public mais fonctionnel

---

## Recommandation

**Phase 1 (Backend VPS)** est la priorite. Ca donne :
- Comptes utilisateurs persistants
- API propre pour web ET mobile
- WebSocket pour la communication temps reel
- PostgreSQL comme les autres apps du VPS

**Phase 2 (Foreground service)** est le gros morceau technique. A faire apres.

**Le MVP le plus rapide** : Phase 1 + utiliser le navigateur mobile comme "hub" temporaire (pas ideal mais fonctionnel).
