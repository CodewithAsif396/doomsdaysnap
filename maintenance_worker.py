import time
import subprocess
import requests
import os

# Configuration
ENGINE_URL = "http://127.0.0.1:5002/health"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(PROJECT_DIR, "maintenance.log")

def log(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] [yt-doctor] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def run_repair():
    log("FAIL detected! Initiating Auto-Repair...")
    try:
        # 1. Update yt-dlp to latest
        log("Updating yt-dlp...")
        subprocess.run(["pip3", "install", "--upgrade", "yt-dlp"], check=True)
        
        # 2. Pull latest code (in case of bug patches)
        log("Pulling latest code from GitHub...")
        subprocess.run(["git", "pull", "origin", "main"], cwd=PROJECT_DIR, check=True)
        
        # 3. Restart Services via PM2
        log("Restarting services via PM2...")
        subprocess.run(["pm2", "restart", "all"], check=True)
        
        log("Repair completed successfully. Site should be back online.")
    except Exception as e:
        log(f"REPAIR FAILED: {str(e)}")

def check_health():
    try:
        resp = requests.get(ENGINE_URL, timeout=10)
        data = resp.json()
        if data.get("status") == "healthy":
            return True
        log(f"Engine reported warning: {data.get('details')}")
        return False
    except Exception as e:
        log(f"Connection error to engine: {str(e)}")
        return False

def main():
    log("Maintenance Worker (yt-doctor) Started.")
    consecutive_failures = 0
    
    while True:
        if check_health():
            consecutive_failures = 0
            # log("Health check passed.")
        else:
            consecutive_failures += 1
            log(f"Health check failed ({consecutive_failures}/3)")
            
            if consecutive_failures >= 3:
                run_repair()
                consecutive_failures = 0
                time.sleep(60) # Cool down after repair
        
        time.sleep(120) # Check every 2 minutes

if __name__ == "__main__":
    main()
