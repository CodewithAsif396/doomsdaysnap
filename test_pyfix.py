from pytubefix import YouTube
try:
    url = "https://www.youtube.com/watch?v=hxMNYkLN7tI"
    yt = YouTube(url)
    print(f"Title: {yt.title}")
    for stream in yt.streams:
        print(f"Stream: {stream.itag} - {stream.resolution}")
except Exception as e:
    import traceback
    traceback.print_exc()
