from pytubefix import YouTube
import traceback

clients = ["WEB", "WEB_CREATOR", "ANDROID", "TVHTML5", "IOS"]
url = "https://www.youtube.com/watch?v=hxMNYkLN7tI"

for client_name in clients:
    print(f"\n--- Testing Client: {client_name} ---")
    try:
        # Note: some newer pytubefix versions use client as a param or in inner logic
        yt = YouTube(url, client=client_name, use_oauth=True, allow_oauth_cache=True)
        print(f"Title: {yt.title}")
        print(f"Streams found: {len(yt.streams)}")
    except Exception as e:
        print(f"Failed for {client_name}: {e}")
