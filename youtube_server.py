from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, StreamingResponse
import yt_dlp
import asyncio
import os
import tempfile
from typing import Optional

app = FastAPI(title="YouTube Engine V7 - Simplified")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_cookies_file():
    """Dynamically look for the best cookies file available."""
    search_dirs = [
        os.path.join(BASE_DIR, 'ads-backend', 'data'),
        BASE_DIR
    ]
    target_names = ["cookies_youtube.txt", "cookies (1).txt", "cookies.txt", "cookie.txt"]
    
    for d in search_dirs:
        if not os.path.exists(d): continue
        for name in target_names:
            path = os.path.join(d, name)
            if os.path.exists(path) and os.path.getsize(path) > 100:
                return path
    return None

def get_ydl_opts(extra=None):
    opts = {
        'quiet': True,
        'no_warnings': True,
        'no_playlist': True,
        'cookiefile': get_cookies_file(),
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.youtube.com/',
        }
    }
    if extra: opts.update(extra)
    return opts

@app.get("/info")
async def get_info(url: str):
    def extract():
        with yt_dlp.YoutubeDL(get_ydl_opts()) as ydl:
            return ydl.extract_info(url, download=False)

    try:
        info = await asyncio.to_thread(extract)
    except Exception as e:
        err = str(e)
        if "Sign in" in err or "bot" in err.lower():
            raise HTTPException(status_code=403, detail="YouTube bot detection. Update cookies.")
        raise HTTPException(status_code=500, detail=err)

    formats = info.get("formats", [])
    
    # Get best audio URL for HD modal
    audio_formats = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
    best_audio = sorted(audio_formats, key=lambda x: x.get('abr', 0) or 0, reverse=True)
    audio_url = best_audio[0].get('url') if best_audio else None

    # Build height map
    height_map = {}
    for f in formats:
        h = f.get("height")
        if not h or h <= 0 or f.get("vcodec") == "none": continue
        existing = height_map.get(h)
        if not existing or ("avc" in (f.get("vcodec") or "").lower() and "avc" not in (existing.get("vcodec") or "").lower()):
            height_map[h] = f

    formatted_formats = []
    for h in sorted(height_map.keys(), reverse=True):
        f = height_map[h]
        is_progressive = f.get('acodec') is not None and f.get('acodec') != 'none'
        entry = {
            "height": h,
            "fid": f.get("format_id"),
            "progressive": is_progressive,
            "size": f.get('filesize') or f.get('filesize_approx')
        }
        if is_progressive:
            entry["url"] = f.get("url")
        else:
            entry["video_url"] = f.get("url")
            entry["audio_url"] = audio_url
        formatted_formats.append(entry)

    return {
        "title": info.get("title", ""),
        "thumbnail": info.get("thumbnail", ""),
        "duration": info.get("duration_string", "0:00"),
        "formats": formatted_formats,
        "provider": info.get("extractor_key", "youtube").lower()
    }

@app.get("/download")
async def download(url: str, height: Optional[str] = None, fid: Optional[str] = None):
    try:
        is_audio = height == 'audio'
        
        # If it's audio, we FORCE server-side download and MP3 conversion
        if is_audio:
            async def stream_mp3():
                with tempfile.TemporaryDirectory() as tmpdir:
                    opts = get_ydl_opts({
                        'format': 'bestaudio/best',
                        'outtmpl': os.path.join(tmpdir, 'audio.%(ext)s'),
                        'postprocessors': [{
                            'key': 'FFmpegExtractAudio',
                            'preferredcodec': 'mp3',
                            'preferredquality': '192',
                        }]
                    })
                    
                    def do_dl():
                        with yt_dlp.YoutubeDL(opts) as ydl:
                            ydl.download([url])
                    
                    await asyncio.to_thread(do_dl)
                    
                    # Find the mp3 file
                    out_file = os.path.join(tmpdir, 'audio.mp3')
                    if os.path.exists(out_file):
                        with open(out_file, 'rb') as f:
                            while chunk := f.read(1024*1024):
                                yield chunk
                    else:
                        raise Exception("MP3 conversion failed")
            
            return StreamingResponse(stream_mp3(), media_type="audio/mpeg", headers={
                "Content-Disposition": f'attachment; filename="audio.mp3"'
            })

        # For video, extract and redirect to the direct CDN link
        fmt = fid if fid else 'best'
        def get_url():
            with yt_dlp.YoutubeDL(get_ydl_opts({'format': fmt})) as ydl:
                return ydl.extract_info(url, download=False).get('url')
        
        direct_url = await asyncio.to_thread(get_url)
        if direct_url:
            return RedirectResponse(url=direct_url)
        
        raise HTTPException(status_code=404, detail="Format not found")
        
    except Exception as e:
        print(f"[DOWNLOAD ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
