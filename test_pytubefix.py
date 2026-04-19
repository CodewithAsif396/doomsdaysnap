from pytubefix import YouTube
import json

url = "https://www.youtube.com/watch?v=Dp6lbdc-v3o"

try:
    yt = YouTube(url, use_oauth=False, allow_oauth_cache=True)
    print(f"TITLE: {yt.title}")
    print("SUCCESS")
except Exception as e:
    print(f"FAILED: {e}")
