import yt_dlp
import json

url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

ydl_opts = {
    'quiet': True,
    'no_warnings': True,
}

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        print("SUCCESS")
        print(json.dumps(info.get('title', 'NO TITLE'), indent=2))
except Exception as e:
    print(f"FAILED: {e}")
