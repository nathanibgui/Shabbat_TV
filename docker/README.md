# ShabbatTV Hub - Docker

**100% local — aucun cloud, aucune dépendance externe.**
La base de données SQLite est stockée dans un volume Docker sur votre Raspberry Pi.

## Démarrage rapide (Raspberry Pi)

### 1. Installer Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Se déconnecter et se reconnecter
```

### 2. Créer les dossiers de données
```bash
git clone <repo-url> shabbat-hub
cd shabbat-hub/docker
mkdir -p data logs
```

### 3. Démarrer le Hub
```bash
docker-compose up -d
```

### 4. Accès
- Dashboard web : `http://<ip-raspberry>:8080`
- Connexion depuis l'app mobile ShabbatTV → IP du Raspberry

## Configuration

Editer `docker-compose.yml` pour changer :
- **Fuseau horaire** : `TZ=Europe/Paris`
- **Port** : `SHABBAT_PORT=8080`

## Base de données

SQLite locale, stockée dans `./data/shabbat.db` sur le Raspberry Pi.

Tables :
- `devices` — Apple TV appairées
- `events` — historique des actions
- `shabbat_log` — Shabbat passés (paracha, bougies, havdalah)
- `notification_prefs` — préférences de notifications

Aucune donnée ne quitte votre réseau local.

## Commandes utiles

```bash
docker-compose up -d              # Démarrer
docker-compose down               # Arrêter
docker-compose logs -f            # Logs en direct
docker-compose restart            # Redémarrer
docker-compose pull && \
  docker-compose up -d            # Mettre à jour
```

## Sauvegarder la base

```bash
cp data/shabbat.db data/shabbat.db.backup
```

## Architecture

```
App mobile (iPhone/Android)
        │
        │ REST API + WebSocket (réseau local)
        ▼
   Hub Docker (Raspberry Pi :8080)
        │
        ├── SQLite (./data/shabbat.db) ← base de données locale
        ├── pyatv → Apple TV (Companion + AirPlay)
        └── Hebcal API → horaires Shabbat
```
