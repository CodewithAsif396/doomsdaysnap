#!/bin/bash
cd "$(dirname "$0")"

pip3 install -q flask requests gunicorn

# TikTok Flask server (port 5000)
gunicorn --bind 127.0.0.1:5000 tiktok_server:app --daemon --log-file /tmp/tiktok_flask.log
echo "TikTok Flask started on port 5000"

# Social Flask server (port 5001)
gunicorn --bind 127.0.0.1:5001 social_server:app --daemon --log-file /tmp/social_flask.log
echo "Social Flask started on port 5001"

# Node.js server
node server.js
