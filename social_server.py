from flask import Flask, request, Response, jsonify
import requests
import re
import json

app = Flask(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
}

# ─── FACEBOOK ────────────────────────────────────────────────────────────────

def fetch_facebook(url):
    """Use fdown.net to extract Facebook video URL"""
    try:
        r = requests.post(
            "https://fdown.net/download.php",
            data={"URLz": url},
            headers={**HEADERS, "Referer": "https://fdown.net/"},
            timeout=15
        )
        html = r.text
        # Extract HD link first, then SD
        hd = re.search(r'href="(https://[^"]+\.mp4[^"]*)"[^>]*>\s*HD', html, re.IGNORECASE)
        sd = re.search(r'href="(https://[^"]+\.mp4[^"]*)"[^>]*>\s*SD', html, re.IGNORECASE)
        video_url = (hd or sd)
        if video_url:
            return {"video_url": video_url.group(1), "title": "Facebook Video", "platform": "facebook"}
    except Exception as e:
        print(f"[Facebook] fdown.net error: {e}")

    # Fallback: getfvid.com
    try:
        r = requests.post(
            "https://getfvid.com/downloader",
            data={"url": url, "action": "post"},
            headers={**HEADERS, "Referer": "https://getfvid.com/"},
            timeout=15
        )
        html = r.text
        hd = re.search(r'"(https://[^"]+fbcdn[^"]+\.mp4[^"]*)"', html)
        if hd:
            return {"video_url": hd.group(1), "title": "Facebook Video", "platform": "facebook"}
    except Exception as e:
        print(f"[Facebook] getfvid error: {e}")

    return None


# ─── SNAPCHAT ────────────────────────────────────────────────────────────────

def fetch_snapchat(url):
    """Use snapsave.app to extract Snapchat video URL"""
    try:
        r = requests.post(
            "https://snapsave.app/action.php",
            data={"url": url, "lang": "en", "plat": "desktop"},
            headers={**HEADERS, "Referer": "https://snapsave.app/"},
            timeout=15
        )
        data = r.json()
        if data.get("status") and data.get("data"):
            for item in data["data"]:
                if item.get("type") == "video" and item.get("url"):
                    return {"video_url": item["url"], "title": "Snapchat Video", "platform": "snapchat"}
    except Exception as e:
        print(f"[Snapchat] snapsave error: {e}")

    # Fallback: snapinsta style scrape
    try:
        r = requests.get(url, headers={**HEADERS, "Referer": "https://www.snapchat.com/"}, timeout=15)
        # Snapchat Spotlight videos have playback URL in page JSON
        match = re.search(r'"playbackUrl"\s*:\s*"(https://[^"]+)"', r.text)
        if not match:
            match = re.search(r'"snapMediaType"\s*:\s*"VIDEO"[^}]*"mediaUrl"\s*:\s*"(https://[^"]+)"', r.text)
        if match:
            video_url = match.group(1).replace("\\u0026", "&")
            return {"video_url": video_url, "title": "Snapchat Video", "platform": "snapchat"}
    except Exception as e:
        print(f"[Snapchat] direct scrape error: {e}")

    return None


# ─── PINTEREST ───────────────────────────────────────────────────────────────

def fetch_pinterest(url):
    """Use cobalt.tools or direct page scrape for Pinterest"""
    # Try cobalt.tools instances
    cobalt_instances = [
        "https://api.cobalt.tools/",
        "https://cobalt.privacydev.net/",
        "https://cobalt.api.timelessnesses.me/",
    ]
    for api in cobalt_instances:
        try:
            r = requests.post(
                api,
                json={"url": url, "videoQuality": "1080", "filenameStyle": "basic"},
                headers={**HEADERS, "Accept": "application/json"},
                timeout=12
            )
            data = r.json()
            status = data.get("status")
            if status in ("stream", "tunnel", "redirect") and data.get("url"):
                return {"video_url": data["url"], "title": "Pinterest Video", "platform": "pinterest"}
            if status == "picker" and data.get("picker"):
                return {"video_url": data["picker"][0]["url"], "title": "Pinterest Video", "platform": "pinterest"}
        except Exception as e:
            print(f"[Pinterest] cobalt {api} error: {e}")

    # Fallback: direct page scrape for pinimg.com URL
    try:
        # Resolve short URL
        r = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=15)
        html = r.text
        # Look for video URL in page JSON
        match = re.search(r'"url"\s*:\s*"(https://v[^"]+pinimg\.com[^"]+\.mp4[^"]*)"', html)
        if not match:
            match = re.search(r'(https://v\d+\.pinimg\.com/videos/[^"\'>\s]+\.mp4)', html)
        if match:
            video_url = match.group(1).replace("\\u002F", "/")
            return {"video_url": video_url, "title": "Pinterest Video", "platform": "pinterest"}
    except Exception as e:
        print(f"[Pinterest] page scrape error: {e}")

    return None


# ─── PROXY ───────────────────────────────────────────────────────────────────

@app.route("/social/download", methods=["POST"])
def social_download():
    body = request.get_json()
    url = body.get("url", "").strip()
    if not url:
        return jsonify({"error": "URL missing"}), 400

    result = None
    if "facebook.com" in url or "fb.watch" in url:
        result = fetch_facebook(url)
    elif "snapchat.com" in url or "t.snapchat.com" in url:
        result = fetch_snapchat(url)
    elif "pinterest.com" in url or "pin.it" in url:
        result = fetch_pinterest(url)
    else:
        return jsonify({"error": "Unsupported platform"}), 400

    if not result:
        return jsonify({"error": "Could not extract video. Make sure the video is public."}), 404

    return jsonify(result)


@app.route("/social/proxy")
def social_proxy():
    video_url = request.args.get("url", "")
    platform  = request.args.get("platform", "")
    if not video_url:
        return "URL missing", 400

    referers = {
        "facebook":  "https://www.facebook.com/",
        "snapchat":  "https://www.snapchat.com/",
        "pinterest": "https://www.pinterest.com/",
    }
    hdrs = {
        **HEADERS,
        "Referer": referers.get(platform, "https://www.google.com/"),
        "Range": request.headers.get("Range", "bytes=0-"),
    }

    r = requests.get(video_url, headers=hdrs, stream=True, timeout=30)
    return Response(
        r.iter_content(chunk_size=1024 * 64),
        status=r.status_code,
        headers={
            "Content-Type": "video/mp4",
            "Content-Disposition": f"attachment; filename={platform}_video.mp4",
            "Content-Length": r.headers.get("Content-Length", ""),
            "Accept-Ranges": "bytes",
        }
    )


if __name__ == "__main__":
    print("Social server running: http://localhost:5001")
    app.run(debug=False, host="0.0.0.0", port=5001)
