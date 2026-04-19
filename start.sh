#!/bin/bash
cd "$(dirname "$0")"

pip3 install -q flask requests gunicorn

# TikTok Flask server (port 5000)
gunicorn --bind 127.0.0.1:5000 tiktok_server:app --daemon --log-file /tmp/tiktok_flask.log
echo "TikTok Flask started on port 5000"

# Social Flask server (port 5001)
gunicorn --bind 127.0.0.1:5001 social_server:app --daemon --log-file /tmp/social_flask.log
# TikTok Flask started on port 5000
# Social Flask started on port 5001

# YouTube FastAPI server (port 5002) - Hybrid Pro High Speed Engine
uvicorn youtube_server:app --port 5002 --host 127.0.0.1 > /tmp/youtube_fastapi.log 2>&1 &
echo "YouTube Hybrid Pro started on port 5002"

# Node.js server
node server.js
