"""
wifi_monitor.py — Core WiFi monitoring loop.
Run this via watchdog.py for auto-restart behavior.
"""

import json
import time
import subprocess
import traceback
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
import ctypes

# ── Optional Windows imports ─────────────────────────────────────────────────
try:
    import win32api, win32con
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

try:
    from zoneinfo import ZoneInfo
    TIMEZONE = ZoneInfo("Asia/Kolkata")
except Exception:
    TIMEZONE = None

# ── Selenium ──────────────────────────────────────────────────────────────────
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import WebDriverException

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════════
ROUTER_URL    = "http://192.168.0.1"
PASSWORD      = "[REMOVED-ROTATED]"
NETWORK_CIDR  = "192.168.0.0/24"
SCAN_INTERVAL = 180          # seconds between scans
DEVICE_FILE   = "connected_devices.json"
LOG_FILE      = "wifi_monitor.log"

SUPABASE_URL  = "https://pvqxzbabstyhskhydbvl.supabase.co/rest/v1/wifi_snapshots"
SUPABASE_KEY  = (
    "[REMOVED-ROTATED]"
    "[REMOVED-ROTATED]"
    "[REMOVED-ROTATED]"
    "[REMOVED-ROTATED]"
)

# ═══════════════════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════════════════
# Force UTF-8 on Windows terminal -- prevents cp1252 UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# GLOBALS
# ═══════════════════════════════════════════════════════════════════════════════
PING_PROCESSES: dict[str, subprocess.Popen] = {}
_shutdown_requested = False


# ═══════════════════════════════════════════════════════════════════════════════
# KEEP AWAKE
# ═══════════════════════════════════════════════════════════════════════════════
def keep_awake():
    """Prevent Windows sleep / screen-off."""
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000002)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# DRIVER
# ═══════════════════════════════════════════════════════════════════════════════
def create_driver(retries: int = 3) -> webdriver.Chrome:
    """Create a headless Chrome driver, retrying on failure."""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--ignore-certificate-errors")
    options.add_argument("--allow-insecure-localhost")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--log-level=3")
    # Required when running as SYSTEM (no user session / no display)
    options.add_argument("--remote-debugging-port=0")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-default-apps")
    options.add_argument("--disable-sync")
    options.add_argument("--metrics-recording-only")
    options.add_argument("--mute-audio")
    options.add_argument("--no-first-run")
    options.add_argument("--safebrowsing-disable-auto-update")
    # Fixed user-data-dir so SYSTEM always has a writable Chrome profile
    options.add_argument(r"--user-data-dir=C:\wifi_monitor_chrome_profile")

    for attempt in range(1, retries + 1):
        try:
            driver = webdriver.Chrome(options=options)
            driver.set_page_load_timeout(30)
            driver.set_script_timeout(30)
            log.info("Chrome driver created (attempt %d)", attempt)
            return driver
        except WebDriverException as e:
            log.warning("Driver creation failed (attempt %d/%d): %s", attempt, retries, e)
            time.sleep(5 * attempt)

    raise RuntimeError("Could not create Chrome driver after %d attempts" % retries)


def safe_quit_driver(driver):
    try:
        if driver:
            driver.quit()
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# LOGIN
# ═══════════════════════════════════════════════════════════════════════════════
def is_logged_in(driver) -> bool:
    try:
        driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        return False
    except Exception:
        return True


def login(driver, retries: int = 3):
    for attempt in range(1, retries + 1):
        try:
            driver.get(ROUTER_URL)
            time.sleep(3)

            pw_fields = driver.find_elements(By.CSS_SELECTOR, "input[type='password']")
            if not pw_fields:
                log.info("Already logged in")
                return

            pw = pw_fields[0]
            pw.clear()
            pw.send_keys(PASSWORD)
            pw.send_keys(Keys.RETURN)
            time.sleep(5)

            if is_logged_in(driver):
                log.info("Login successful (attempt %d)", attempt)
                return
            else:
                log.warning("Login attempt %d failed, retrying…", attempt)

        except Exception as e:
            log.warning("Login error (attempt %d): %s", attempt, e)
            time.sleep(5 * attempt)

    raise RuntimeError("Login failed after %d attempts" % retries)


# ═══════════════════════════════════════════════════════════════════════════════
# FETCH CLIENTS
# ═══════════════════════════════════════════════════════════════════════════════
def wait_for_stable_clients(driver, timeout: int = 20) -> bool:
    last_count, stable = -1, 0
    deadline = time.time() + timeout
    while time.time() < deadline:
        rows = driver.find_elements(By.CSS_SELECTOR, "tr.grid-content-tr")
        count = len(rows)
        stable = (stable + 1) if count == last_count else 0
        if stable >= 2:
            return True
        last_count = count
        time.sleep(1)
    return False


def is_data_ready(driver) -> bool:
    for row in driver.find_elements(By.CSS_SELECTOR, "tr.grid-content-tr"):
        try:
            mac = row.find_element(By.CSS_SELECTOR, ".mac").text
            if mac:
                return True
        except Exception:
            pass
    return False


_FETCH_JS = """
var devices = [];
var rows = document.querySelectorAll('tr.grid-content-tr');
for (var row of rows) {
    var offline = row.querySelector('.offline-tag:not(.hidden)');
    if (offline) continue;

    var d = { name:"", mac:"", ip:"", upload:"", download:"", duration:"", signal:"", status:"online" };

    var name = row.querySelector('.td-content .content div');
    if (name) d.name = name.childNodes[0].textContent.trim();

    var mac  = row.querySelector('.mac');         if (mac)  d.mac      = mac.textContent.trim();
    var ip   = row.querySelector('.ip');          if (ip)   d.ip       = ip.textContent.trim();
    var up   = row.querySelector('.uploadLimit'); if (up)   d.upload   = up.textContent.trim();
    var down = row.querySelector('.downloadLimit');if(down) d.download = down.textContent.trim();
    var dur  = row.querySelector('.duration-container');if(dur) d.duration = dur.textContent.trim();
    var sig  = row.querySelector('.icon-wireless');
    if (sig) { var m = sig.className.match(/signal-(\\d)/); if (m) d.signal = m[1]; }

    devices.push(d);
}
return devices;
"""


def get_active_clients(driver) -> list:
    driver.execute_script('window.location.hash="wirelessSta"')
    wait_for_stable_clients(driver)

    for _ in range(6):
        if is_data_ready(driver):
            break
        time.sleep(1)

    return driver.execute_script(_FETCH_JS) or []


def safe_get_clients(driver) -> list:
    """Fetch clients, re-logging if session expired."""
    if not is_logged_in(driver):
        log.info("Session expired → re-login")
        login(driver)

    clients = get_active_clients(driver)

    if not clients:
        page = driver.page_source.lower()
        if "password" in page:
            log.info("Logout detected → re-login")
            login(driver)
            clients = get_active_clients(driver)

    return clients


# ═══════════════════════════════════════════════════════════════════════════════
# NMAP
# ═══════════════════════════════════════════════════════════════════════════════
def normalize_mac(mac: str) -> str:
    if not mac:
        return ""
    return mac.lower().replace(":", "-").upper()


def find_nmap() -> str | None:
    """Find nmap binary — checks PATH and common install locations.
    Needed because SYSTEM account has a minimal PATH that excludes user installs.
    """
    import shutil
    # 1. Try PATH first (works when running as normal user)
    found = shutil.which("nmap")
    if found:
        return found
    # 2. Check standard nmap Windows install locations
    candidates = [
        r"C:\Program Files (x86)\Nmap\nmap.exe",
        r"C:\Program Files\Nmap\nmap.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def scan_nmap(network: str = NETWORK_CIDR, timeout: int = 90) -> list:
    nmap_exe = find_nmap()
    if not nmap_exe:
        log.warning("nmap not found - skipping network scan")
        return []
    try:
        result = subprocess.run(
            [nmap_exe, "-sn", network],
            capture_output=True, text=True, timeout=timeout
        )
        devices, current = [], {}
        for line in result.stdout.split("\n"):
            if "Nmap scan report for" in line:
                if current:
                    devices.append(current)
                current = {"ip": line.split()[-1]}
            elif "MAC Address:" in line:
                raw = line.split("MAC Address:")[1].strip().split()[0]
                current["mac"] = raw.replace(":", "-").upper()
        if current:
            devices.append(current)
        return devices
    except FileNotFoundError:
        log.warning("nmap not found — skipping network scan")
        return []
    except Exception as e:
        log.warning("nmap error: %s", e)
        return []


def merge_devices(ui_devices: list, nmap_devices: list) -> list:
    merged, ui_macs = [], set()

    for d in ui_devices:
        mac = normalize_mac(d.get("mac", ""))
        d["mac"] = mac
        if mac:
            ui_macs.add(mac)
        merged.append(d)

    for d in nmap_devices:
        mac = normalize_mac(d.get("mac", ""))
        if mac and mac not in ui_macs:
            merged.append({
                "name": "unknown", "mac": mac, "ip": d.get("ip", ""),
                "signal": None, "status": "unknown",
                "upload": "", "download": "", "duration": "",
            })

    return merged


# ═══════════════════════════════════════════════════════════════════════════════
# SUPABASE
# ═══════════════════════════════════════════════════════════════════════════════
def push_to_supabase(devices=None, error=None, current_time=None, retries: int = 3):
    payload = {
        "captured_at": current_time,
        "iw_dump": json.dumps(devices) if devices is not None else None,
        "error": str(error) if error else None,
    }

    for attempt in range(1, retries + 1):
        try:
            subprocess.run(
                [
                    "curl", "-X", "POST", SUPABASE_URL,
                    "-H", f"apikey: {SUPABASE_KEY}",
                    "-H", f"Authorization: Bearer {SUPABASE_KEY}",
                    "-H", "Content-Type: application/json",
                    "-d", json.dumps(payload),
                ],
                timeout=15, capture_output=True,
            )
            return
        except Exception as e:
            log.warning("Supabase push failed (attempt %d/%d): %s", attempt, retries, e)
            time.sleep(3 * attempt)

    log.error("Supabase push gave up after %d attempts", retries)


# ═══════════════════════════════════════════════════════════════════════════════
# FILE SAVE
# ═══════════════════════════════════════════════════════════════════════════════
def save_devices(devices: list):
    try:
        tmp = DEVICE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(devices, f, indent=2)
        os.replace(tmp, DEVICE_FILE)   # atomic write — never leaves corrupt file
    except Exception as e:
        log.error("File save error: %s", e)


# ═══════════════════════════════════════════════════════════════════════════════
# PING KEEPALIVE
# ═══════════════════════════════════════════════════════════════════════════════
def stop_all_pings():
    global PING_PROCESSES
    for proc in PING_PROCESSES.values():
        try:
            proc.terminate()
        except Exception:
            pass
    PING_PROCESSES.clear()


def start_pings(devices: list):
    for d in devices:
        ip = d.get("ip")
        if not ip or ip in PING_PROCESSES:
            continue
        try:
            proc = subprocess.Popen(
                ["ping", ip, "-t"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            PING_PROCESSES[ip] = proc
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════════════════════
# CONSOLE CTRL HANDLER (Windows)
# ═══════════════════════════════════════════════════════════════════════════════
def _console_handler(event):
    global _shutdown_requested
    SHUTDOWN_EVENTS = {
        win32con.CTRL_C_EVENT,
        win32con.CTRL_CLOSE_EVENT,
        win32con.CTRL_LOGOFF_EVENT,
        win32con.CTRL_SHUTDOWN_EVENT,
    }
    if event in SHUTDOWN_EVENTS:
        log.info("Shutdown signal received (%s)", event)
        _shutdown_requested = True
        stop_all_pings()
        push_to_supabase(error="Shutdown")
        return True
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN LOOP
# ═══════════════════════════════════════════════════════════════════════════════
def current_timestamp() -> str:
    try:
        return datetime.now(TIMEZONE).isoformat()
    except Exception:
        return datetime.utcnow().isoformat() + "Z"


def run():
    global _shutdown_requested

    if HAS_WIN32:
        win32api.SetConsoleCtrlHandler(_console_handler, True)

    driver = None
    consecutive_driver_failures = 0

    def reinit_driver():
        nonlocal driver, consecutive_driver_failures
        safe_quit_driver(driver)
        driver = None

        for wait in [10, 30, 60, 120, 300]:
            try:
                driver = create_driver()
                login(driver)
                consecutive_driver_failures = 0
                log.info("Driver reinitialized successfully")
                return
            except Exception as e:
                consecutive_driver_failures += 1
                log.error("Driver reinit failed, waiting %ds: %s", wait, e)
                time.sleep(wait)

        log.critical("Cannot reinitialize driver — exiting so watchdog can restart")
        sys.exit(1)   # watchdog.py will catch this and restart the process

    try:
        driver = create_driver()
        login(driver)

        while not _shutdown_requested:
            keep_awake()
            ts = current_timestamp()
            log.info("── Scan cycle @ %s ──", ts)

            try:
                ui_clients   = safe_get_clients(driver)
                nmap_clients = scan_nmap()
                clients      = merge_devices(ui_clients, nmap_clients)

                log.info("Devices found: %d", len(clients))
                for c in clients:
                    log.info(
                        "  %-20s %-15s %-20s %s  Signal:%s",
                        c.get("name", ""), c.get("ip", ""), c.get("mac", ""),
                        c.get("status", ""), c.get("signal", ""),
                    )

                save_devices(clients)
                push_to_supabase(devices=clients, current_time=ts)

                stop_all_pings()
                start_pings(clients)

            except WebDriverException as e:
                log.error("WebDriver error: %s\n%s", e, traceback.format_exc())
                push_to_supabase(error=str(e), current_time=ts)
                reinit_driver()
                continue   # skip sleep, retry immediately

            except Exception as e:
                log.error("Loop error: %s\n%s", e, traceback.format_exc())
                push_to_supabase(error=str(e), current_time=ts)
                # Non-driver error — just log and continue after a short pause
                time.sleep(15)
                continue

            # ── Normal wait ────────────────────────────────────────────────
            log.info("Sleeping %ds until next scan…", SCAN_INTERVAL)
            for _ in range(SCAN_INTERVAL):
                if _shutdown_requested:
                    break
                time.sleep(1)

    finally:
        log.info("Cleaning up…")
        safe_quit_driver(driver)
        stop_all_pings()
        log.info("wifi_monitor.py exited cleanly")


if __name__ == "__main__":
    run()
