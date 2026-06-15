# WiFi Network Monitor

A lightweight, self-healing network intelligence system that continuously monitors all devices on a local WiFi network, persists snapshots to the cloud, and auto-recovers from any failure — including rebooting Windows if necessary.

Built to run 24/7 on a home router without any human intervention.

---

## What It Does

Every 3 minutes, the system:

1. **Scrapes the router admin panel** via headless Chrome (Selenium) to get real-time connected device data — name, IP, MAC address, signal strength, upload/download stats, and connection duration
2. **Runs an nmap ARP scan** across the subnet to catch devices the router UI might miss (e.g. wired clients, stealthy IoT)
3. **Merges both data sources** into a unified device list, deduplicating by MAC address
4. **Pushes a timestamped snapshot** to a Supabase (PostgreSQL) backend for historical analysis
5. **Keeps ARP cache warm** by running background pings to all active IPs

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Windows Boot                       │
│              (Task Scheduler / SYSTEM)               │
└────────────────────┬────────────────────────────────┘
                     │ starts after 60s
                     ▼
┌─────────────────────────────────────────────────────┐
│                  watchdog.py                         │
│                                                      │
│  • Launches wifi_monitor.py as subprocess            │
│  • Detects crashes (exit code, uptime < 60s)         │
│  • Exponential back-off restarts                     │
│  • After 5 consecutive fast deaths → reboot Windows  │
└────────────────────┬────────────────────────────────┘
                     │ spawns
                     ▼
┌─────────────────────────────────────────────────────┐
│                wifi_monitor.py                       │
│                                                      │
│  ┌─────────────┐    ┌──────────────┐                │
│  │  Selenium   │    │    nmap      │                │
│  │  (Chrome    │    │  ARP scan    │                │
│  │  headless)  │    │  /24 subnet  │                │
│  └──────┬──────┘    └──────┬───────┘                │
│         │                  │                         │
│         └────────┬─────────┘                         │
│                  │ merge by MAC                      │
│                  ▼                                   │
│         ┌────────────────┐                          │
│         │ Unified Device │                          │
│         │     List       │                          │
│         └───┬────────┬───┘                          │
│             │        │                              │
│     ┌───────▼──┐  ┌──▼──────────┐                  │
│     │  Local   │  │  Supabase   │                  │
│     │  JSON    │  │ (Postgres)  │                  │
│     │  file    │  │   REST API  │                  │
│     └──────────┘  └─────────────┘                  │
│                                                      │
│  + Background pings to keep ARP cache warm           │
└─────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Role |
|---|---|
| `wifi_monitor.py` | Core monitoring loop — scraping, scanning, merging, pushing |
| `watchdog.py` | Process supervisor — restarts monitor on any crash, reboots OS on catastrophic failure |
| `install_startup.ps1` | One-time setup — registers watchdog as a Windows Task Scheduler job at boot |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Browser Automation | Selenium 4 + Chrome (headless) |
| Network Scanning | nmap (ARP ping sweep) |
| Cloud Storage | Supabase (PostgreSQL via REST API) |
| Local Persistence | JSON (atomic write via temp-file swap) |
| Process Supervision | Python subprocess + exponential back-off |
| OS Integration | Windows Task Scheduler (SYSTEM account, boot trigger) |
| Graceful Shutdown | Win32 console control handler (`pywin32`) |

---

## Failure Handling

This system is designed to survive everything:

| Failure | Recovery |
|---|---|
| Chrome crashes | Driver torn down, re-created with 3 retries |
| Router session timeout | Detected via DOM check, re-login attempted |
| Supabase push fails | 3 retries with back-off, error logged and skipped |
| `wifi_monitor.py` crashes | Watchdog restarts it within 5–120s (exponential back-off) |
| Chrome unrecoverable (5 fast deaths) | Watchdog issues `shutdown /r` — Windows reboots |
| Windows reboot | Task Scheduler re-launches watchdog 60s after boot |
| SYSTEM account PATH issues | nmap and Python resolved by absolute path, not PATH env |
| Unicode logging errors on Windows | `stdout.reconfigure(encoding='utf-8')` applied at startup |
| Corrupt JSON on crash | Atomic write (write to `.tmp`, then `os.replace`) |

---

## Data Schema

Each snapshot pushed to Supabase:

```json
{
  "captured_at": "2025-05-20T14:30:00+05:30",
  "iw_dump": [
    {
      "name": "Aaman's iPhone",
      "mac": "A1-B2-C3-D4-E5-F6",
      "ip": "192.168.0.105",
      "signal": "4",
      "status": "online",
      "upload": "1.2 MB/s",
      "download": "3.4 MB/s",
      "duration": "2h 15m"
    }
  ],
  "error": null
}
```

---

## Setup

### Prerequisites

- Windows 10/11
- Python 3.10+
- Google Chrome
- nmap (installer from nmap.org)

### Install

```bash
# 1. Clone / copy files to a permanent directory
# 2. Install dependencies
pip install selenium pywin32 webdriver-manager

# 3. Test manually
python watchdog.py

# 4. Register as a boot startup task (run PowerShell as Admin)
powershell -File install_startup.ps1
```

### Configuration

Edit the constants at the top of `wifi_monitor.py`:

```python
ROUTER_URL    = "http://192.168.0.1"    # your router's admin page
PASSWORD      = "your_password"
NETWORK_CIDR  = "192.168.0.0/24"        # your subnet
SCAN_INTERVAL = 180                      # seconds between scans
SUPABASE_URL  = "https://..."           # your Supabase project URL
SUPABASE_KEY  = "..."                   # your Supabase service role key
```

---

## Project Structure

```
wifi_monitor/
├── wifi_monitor.py       # Core monitoring loop
├── watchdog.py           # Process supervisor with auto-reboot
├── install_startup.ps1   # Windows Task Scheduler registration
├── connected_devices.json  # Latest device snapshot (auto-updated)
├── wifi_monitor.log      # Monitor logs
└── watchdog.log          # Supervisor logs
```

---

## Why This Is Interesting (Engineering Notes)

**Dual-source device discovery** — The router admin UI only shows WiFi clients. nmap catches wired Ethernet clients and devices that connected and disconnected between scrape cycles. Merging by normalized MAC (colon → dash, uppercase) gives a complete picture.

**Headless Chrome over router API** — Consumer routers don't expose REST APIs. Selenium scrapes the admin panel exactly as a browser would, making this work on any router brand with a web UI.

**SYSTEM account compatibility** — Running as Windows SYSTEM (no user session) requires explicit absolute paths for binaries, a fixed Chrome user-data-dir, and extra Chrome flags to prevent the `DevToolsActivePort` crash that occurs with no desktop session.

**Self-healing vs. self-rebooting** — Most failures are transient (flaky network, Chrome hiccup) and recovered with a restart. But some failures are systemic (corrupted Chrome profile, bad OS state). The watchdog distinguishes between them by counting fast deaths and escalating to an OS reboot only when local recovery has failed repeatedly.

---

## License

MIT
