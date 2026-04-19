from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.responses import StreamingResponse
import yt_dlp
import asyncio
import httpx
import re
import os
import json
from typing import Optional

app = FastAPI(title="YouTube Hybrid Pro Engine V6.3")

# Parallel Download Settings
MAX_CHUNK_SIZE = 1024 * 1024 * 2 # 2MB chunks
CONCURRENCY = 12 # Parallel connections
TIMEOUT = httpx.Timeout(20.0, connect=30.0)

# ─── EXTRACTION ENGINE ────────────────────────────────────────────────────────
class ExplodeEngine:
    @staticmethod
    async def get_info(url: str):
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'format': 'bestvideo+bestaudio/best',
            'ignoreerrors': True,
            'no_playlist': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'web']
                }
            }
        }
        
        def extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        info = await asyncio.to_thread(extract)
        if not info:
            raise Exception("Could not extract metadata.")

        formats = info.get("formats", [])
        
        # Filter and deduplicate formats (Prefer mp4/avc)
        height_map = {}
        # Find best audio size for estimation
        audio_formats = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none' and f.get('ext') == 'm4a']
        best_audio = sorted(audio_formats, key=lambda x: x.get('abr', 0), reverse=True)[0] if audio_formats else {}
        audio_size = best_audio.get('filesize') or best_audio.get('filesize_approx') or 0

        for f in formats:
            h = f.get("height")
            if f.get("vcodec") != "none" and h and h > 0:
                is_avc = "avc" in (f.get("vcodec") or "").lower()
                existing = height_map.get(h)
                
                # Selection logic: Prefer H.264 (avc) for compatibility
                if not existing or (is_avc and "avc" not in (existing.get("vcodec") or "").lower()):
                    height_map[h] = f
                elif is_avc == ("avc" in (existing.get("vcodec") or "").lower()):
                    if f.get("ext") == "mp4" and existing.get("ext") != "mp4":
                        height_map[h] = f

        formatted_formats = []
        for h in sorted(height_map.keys(), reverse=True):
            f = height_map[h]
            v_size = f.get('filesize') or f.get('filesize_approx') or 0
            formatted_formats.append({
                "height": h,
                "ext": "mp4",
                "size": v_size + audio_size if v_size else None,
                "fid": f.get("format_id")
            })

        return {
            "title": info.get("title", "YouTube Video"),
            "thumbnail": info.get("thumbnail", ""),
            "duration": info.get("duration_string", "0:00"),
            "formats": formatted_formats,
            "provider": "youtube"
        }

# ─── PARALLEL DOWNLOAD ENGINE ──────────────────────────────────────────────────
async def download_chunk(client, url, start, end, chunk_id):
    headers = {"Range": f"bytes={start}-{end}"}
    for attempt in range(3):
        try:
            resp = await client.get(url, headers=headers)
            if resp.status_code in [200, 206]:
                return resp.content
        except Exception:
            await asyncio.sleep(1)
    return None

async def stream_media_parallel(video_url: str, audio_url: Optional[str] = None):
    # For now, we prioritize single stream or high-speed video piping.
    # If audio is separate, it requires ffmpeg which is slow.
    # Hybrid Pro V6.3 focuses on saturating bandwidth for the main stream.
    
    async with httpx.AsyncClient(timeout=TIMEOUT, limits=httpx.Limits(max_connections=CONCURRENCY)) as client:
        # Get head for size
        head = await client.head(video_url, follow_redirects=True)
        total_size = int(head.headers.get("content-length", 0))
        
        if total_size == 0:
            # Fallback to direct pipe if size unknown
            async with client.stream("GET", video_url) as r:
                async for chunk in r.aiter_bytes(65536):
                    yield chunk
            return

        chunks = []
        start = 0
        while start < total_size:
            end = min(start + MAX_CHUNK_SIZE - 1, total_size - 1)
            chunks.append((start, end))
            start += MAX_CHUNK_SIZE

        # Use a semaphore to control concurrency
        sem = asyncio.Semaphore(CONCURRENCY)
        
        async def wrapped_download(s, e, i):
            async with sem:
                return await download_chunk(client, video_url, s, e, i)

        # Process in batches to keep memory low but speed high
        batch_size = CONCURRENCY * 2
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            tasks = [wrapped_download(s, e, i+idx) for idx, (s, e) in enumerate(batch)]
            results = await asyncio.gather(*tasks)
            for res in results:
                if res:
                    yield res

# ─── ROUTES ───────────────────────────────────────────────────────────────────
@app.get("/info")
async def get_info(url: str):
    try:
        info = await ExplodeEngine.get_info(url)
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download")
async def download(url: str, fid: Optional[str] = None):
    try:
        ydl_opts = {
            'quiet': True,
            'format': f'{fid}+bestaudio/best' if fid else 'best',
            'no_warnings': True,
        }
        
        def get_urls():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if 'entries' in info: info = info['entries'][0]
                
                # If separate streams
                if info.get('requested_formats'):
                    return [f['url'] for f in info['requested_formats']]
                return [info['url']]

        urls = await asyncio.to_thread(get_urls)
        
        if not urls:
            raise HTTPException(status_code=404, detail="No streams found")

        # For production stability, if 2 streams (v+a), we pipe them via the first one 
        # (Parallel engine currently optimized for single high-speed stream)
        # In a real tool, we might use ffmpeg for merging, but here we prioritize raw speed.
        target_url = urls[0] 
        
        return StreamingResponse(
            stream_media_parallel(target_url),
            media_type="video/mp4",
            headers={
                "Content-Disposition": f"attachment; filename=doomsdaysnap_youtube.mp4",
                "Accept-Ranges": "bytes"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
