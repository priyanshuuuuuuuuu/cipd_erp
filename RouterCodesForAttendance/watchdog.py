"""
watchdog.py - Restarts wifi_monitor.py whenever it crashes.
If Chrome keeps failing, reboots Windows automatically.
"""

import subprocess
import sys
import time
import logging
import os
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT   = Path(__file__).parent / "wifi_monitor.py"
PYTHON   = sys.executable
LOG_FILE = Path(__file__).parent / "watchdog.log"

# After this many consecutive fast deaths, reboot Windows instead of retrying
REBOOT_AFTER_FAST_DEATHS = 5

# Back-off delays between restarts (seconds)
BACKOFF = [5, 10, 30, 60, 120]

# A "fast death" is when the process dies in under this many seconds
FAST_DEATH_THRESHOLD = 60

# ── Logging (ASCII-safe, no Unicode box chars) ────────────────────────────────
# Force UTF-8 on stdout to prevent cp1252 crashes on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WATCHDOG] %(message)s",
    handlers=[
        logging.FileHandler(str(LOG_FILE), encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


# ── Windows reboot ─────────────────────────────────────────────────────────────
def reboot_windows(reason: str):
    log.critical("REBOOTING WINDOWS. Reason: %s", reason)
    try:
        # Write reboot reason to log before we disappear
        with open(str(LOG_FILE), "a", encoding="utf-8") as f:
            f.write(f"\n[REBOOT TRIGGERED] {reason}\n")
    except Exception:
        pass
    # /r = restart, /t 10 = wait 10 seconds, /f = force close apps
    subprocess.run(["shutdown", "/r", "/t", "10", "/f",
                    "/c", f"WiFiMonitor watchdog: {reason}"],
                   capture_output=True)
    time.sleep(30)   # wait for shutdown to take effect
    sys.exit(0)


# ── Main loop ─────────────────────────────────────────────────────────────────
def run_forever():
    attempt     = 0
    fast_deaths = 0

    log.info("Watchdog started. Script: %s", SCRIPT)

    if not SCRIPT.exists():
        log.critical("wifi_monitor.py not found at: %s", SCRIPT)
        sys.exit(1)

    while True:
        attempt += 1
        log.info("--- Launch attempt #%d (fast_deaths=%d) ---", attempt, fast_deaths)

        start = time.time()

        try:
            proc = subprocess.run([PYTHON, str(SCRIPT)])
            exit_code = proc.returncode
        except FileNotFoundError:
            log.critical("Python not found: %s", PYTHON)
            sys.exit(1)
        except KeyboardInterrupt:
            log.info("Watchdog stopped by user.")
            sys.exit(0)
        except Exception as e:
            log.error("Unexpected error launching script: %s", e)
            exit_code = -1

        uptime = time.time() - start
        log.warning("wifi_monitor.py exited | code=%s | uptime=%.0fs", exit_code, uptime)

        # Track fast deaths
        if uptime < FAST_DEATH_THRESHOLD:
            fast_deaths += 1
            log.warning("Fast death #%d (died in %.0fs)", fast_deaths, uptime)
        else:
            fast_deaths = 0   # healthy run resets the counter

        # Too many consecutive fast deaths = Chrome is broken, reboot
        if fast_deaths >= REBOOT_AFTER_FAST_DEATHS:
            reboot_windows(
                f"Chrome failed {fast_deaths} times in a row (each run <{FAST_DEATH_THRESHOLD}s)"
            )

        # Normal back-off before restart
        delay = BACKOFF[min(fast_deaths - 1, len(BACKOFF) - 1)] if fast_deaths > 0 else BACKOFF[0]
        log.info("Restarting in %ds...", delay)
        time.sleep(delay)


if __name__ == "__main__":
    run_forever()
