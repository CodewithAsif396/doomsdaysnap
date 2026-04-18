import requests
import json
import re

SESSION_ID = "b05e5b33c6b4ad91577ba3ea5338f41f"  # apna session id yahan daalo

VIDEO_URL = "https://www.tiktok.com/@kyliejenner/video/7627308836575005983"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.tiktok.com/",
    "Cookie": f"sessionid={SESSION_ID}",
}

def get_video_info(url):
    response = requests.get(url, headers=headers, allow_redirects=True)
    print("Status:", response.status_code)

    # page source se video data nikalo
    match = re.search(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', response.text, re.DOTALL)
    if match:
        data = json.loads(match.group(1))
        with open("raw_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Data saved to raw_data.json")
    else:
        print("Data nahi mila — page source check karo")
        with open("page.html", "w", encoding="utf-8") as f:
            f.write(response.text)
        print("HTML saved to page.html")

get_video_info(VIDEO_URL)
