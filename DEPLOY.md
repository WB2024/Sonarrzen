# Sonarrzen TV Deployment

Deploy the Sonarrzen app (Sonarr TV browser for Samsung Frame TV) after making changes.

---

## One-command deploy

```bash
./deploy.sh
```

This calls the SAWSUBE API which injects config, signs, and installs the WGT on the TV automatically.

---

## Manual commands

### Via SAWSUBE API (recommended)
```bash
# Trigger build + install:
curl -X POST http://127.0.0.1:8000/api/tizenbrew/1/build-install-sonarrzen

# Monitor progress:
tail -f /tmp/sawsube.log
```

### Directly via build.sh (bypasses SAWSUBE)
```bash
# Package only:
./build.sh

# Package and install to TV:
./build.sh 192.168.1.202:26101 TestProfile
```

---

## Ensure SAWSUBE is running first

```bash
# Check:
curl -s http://127.0.0.1:8000/api/health

# Start if not running:
cd /home/will/Github/SAWSUBE
nohup .venv/bin/python -m backend.main > /tmp/sawsube.log 2>&1 &
sleep 3 && curl -s http://127.0.0.1:8000/api/health
```

---

## Configuration

Sonarrzen gets its config injected by SAWSUBE from `/home/will/Github/SAWSUBE/.env`:

| Variable | Purpose |
|---|---|
| `Sonarr_URL` | Sonarr server URL (`http://192.168.1.250:8989`) |
| `Sonarr_API_KEY` | Sonarr API key |
| `SAWSUBE_URL` | SAWSUBE URL (`http://192.168.1.48:8000`) |
| `SONARRZEN_SRC_PATH` | Path to this repo's `src/` folder |
| `SONARRZEN_TIZEN_PROFILE` | Tizen signing profile (`TestProfile`) |

---

## TV details

| | |
|---|---|
| TV | Samsung Frame 55 |
| IP | `192.168.1.202:26101` |
| SAWSUBE TV ID | `1` |
