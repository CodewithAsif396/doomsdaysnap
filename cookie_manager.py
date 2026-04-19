"""
Cookie Manager - VPS Mode
User manually uploads cookies.txt via SCP.
This module only validates and monitors cookie health.
"""
import os
import time
import yt_dlp

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIE_FILE = os.path.join(PROJECT_DIR, "cookies.txt")
LOG_FILE = os.path.join(PROJECT_DIR, "maintenance.log")
TEST_URL = "https://www.youtube.com/watch?v=BaW_jenozKc"


def log(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] [CookieManager] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def find_cookie_file():
    for name in ["cookies.txt", "cookies (1).txt"]:
        path = os.path.join(PROJECT_DIR, name)
        if os.path.exists(path) and os.path.getsize(path) > 500:
            return path
    return None


def cookie_age_days() -> float:
    path = find_cookie_file()
    if not path:
        return 999.0
    return (time.time() - os.path.getmtime(path)) / 86400


def validate_cookies() -> tuple[bool, str]:
    path = find_cookie_file()
    if not path:
        return False, "Cookie file missing — upload cookies.txt via SCP"

    opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'cookiefile': path,
        'extractor_args': {'youtube': {'player_client': ['tvhtml5_embedded']}},
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(TEST_URL, download=False)
            if info and info.get('formats'):
                return True, "OK"
            return False, "No formats returned"
    except Exception as e:
        err = str(e)
        if "Sign in" in err or "bot" in err.lower():
            return False, "BOT_DETECTED — upload fresh cookies.txt"
        if "unavailable" in err.lower() or "private" in err.lower():
            return True, "Test video issue (not cookies)"
        return False, err[:150]


def should_refresh() -> tuple[bool, str]:
    age = cookie_age_days()
    if age > 5:
        return True, f"Cookies {age:.0f} days old — consider uploading fresh ones"
    valid, reason = validate_cookies()
    if not valid:
        return True, reason
    return False, "OK"


# No-op for compatibility with maintenance_worker.py
def refresh_cookies(force: bool = False) -> bool:  # noqa: ARG001
    valid, reason = validate_cookies()
    if valid:
        log(f"Cookies valid (age={cookie_age_days():.1f}d)")
        return True
    log(f"Cookies INVALID: {reason}")
    log("ACTION: Upload fresh cookies.txt → scp cookies.txt user@vps:/path/to/project/")
    return False


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    valid, reason = validate_cookies()
    age = cookie_age_days()
    print(f"Cookie file : {find_cookie_file() or 'NOT FOUND'}")
    print(f"Age         : {age:.1f} days")
    print(f"Valid       : {valid}")
    print(f"Reason      : {reason}")
