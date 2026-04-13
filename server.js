const express = require('express');
const cors = require('cors');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const ffmpegPath = require('ffmpeg-static');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files (like index.html)
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper to sanitize URLs for shell command execution
function sanitizeUrl(url) {
    try {
        const parsed = new URL(url);
        // YouTube special handling: Keep only the video ID to prevent playlist/mix issues
        if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
            let videoId = parsed.searchParams.get('v');
            if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
            
            // Handle youtu.be/VIDEO_ID
            if (parsed.hostname.includes('youtu.be')) {
                const pathId = parsed.pathname.slice(1);
                if (pathId) return `https://www.youtube.com/watch?v=${pathId}`;
            }
        }
    } catch (e) {
        // Fallback to original if URL parsing fails
    }

    // Generic cleanup: Remove everything after first & or ? for other platforms
    // Note: Some platforms need parameters, so we do this carefully.
    return url.split('&list=')[0].split('&index=')[0];
}

app.post('/api/info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`Processing URL for info: ${url}`);
        const safeUrl = sanitizeUrl(url);
        
        // Execute yt-dlp to get a single JSON output
        const output = await youtubedl(safeUrl, {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            noPlaylist: true,
            forceIpv4: true, // Often helps on cloud platforms
            extractorArgs: 'youtube:player_client=ios,android,web', // Multimodal bypass
            ffmpegLocation: ffmpegPath
        }, { timeout: 18000 }); // Slightly longer timeout for deep extraction

        // Parse relevant info
        const title = output.title || 'Unknown Title';
        const thumbnail = output.thumbnail || 'https://via.placeholder.com/600x400?text=No+Thumbnail';
        const duration = output.duration_string || (output.duration ? new Date(output.duration * 1000).toISOString().substr(14, 5) : '00:00');

        // Extract available resolutions dynamically with file sizes
        const formats = output.formats || [];
        
        // Filter for unique heights that have video
        const uniqueFormats = [];
        const seenHeights = new Set();

        formats.filter(f => f.vcodec !== 'none' && f.height).forEach(f => {
            if (!seenHeights.has(f.height)) {
                seenHeights.add(f.height);
                uniqueFormats.push({
                    height: f.height,
                    ext: f.ext || 'mp4',
                    size: f.filesize || f.filesize_approx || null
                });
            }
        });

        // Sort by height descending
        uniqueFormats.sort((a, b) => b.height - a.height);

        // We return the raw URL back so the frontend can send it to our /api/download endpoint
        return res.json({
            title,
            thumbnail,
            duration,
            formats: uniqueFormats,
            originalUrl: url
        });

    } catch (error) {
        console.error('Error fetching info:', error.message);
        return res.status(500).json({ error: 'Failed to extract video information. The video might be private or link is invalid.' });
    }
});

// Endpoint to securely proxy the download to the user
app.get('/api/download', (req, res) => {
    const { url, type } = req.query;
    if (!url) return res.status(400).send('URL is required');

    console.log(`Starting Download Proxy (${type}): ${url}`);
    
    // Set yt-dlp string formats based on quality
    let format = 'best[ext=mp4]/best'; 
    let ext = 'mp4';
    let mime = 'video/mp4';

    if (type === 'audio') {
        // Audio only extraction
        format = 'bestaudio/best';
        ext = 'mp3';
        mime = 'audio/mpeg';
    } else {
        // Handle specific heights
        const height = parseInt(type) || 720;
        format = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}][ext=mp4]/best`;
    }

    // Set headers to trigger a file download in the browser
    // Encode filename securely
    res.header('Content-Disposition', `attachment; filename="snapload_video_${Date.now()}.${ext}"`);
    res.header('Content-Type', mime);

    const safeUrl = sanitizeUrl(url);

    // Run youtube-dl-exec and pipe its standard output (the media file) directly to the response object
    const subprocess = youtubedl.exec(safeUrl, {
        f: format,
        noWarnings: true,
        noCheckCertificate: true,
        noPlaylist: true,
        forceIpv4: true,
        extractorArgs: 'youtube:player_client=ios,android,web', // Multimodal bypass
        ffmpegLocation: ffmpegPath,
        extractAudio: type === 'audio',
        audioFormat: type === 'audio' ? 'mp3' : undefined,
        o: '-' // '-' tells yt-dlp to output binary data directly to stdout instead of saving a file!
    }, { timeout: 120000 }); // Prevent stream processes from sitting permanently if the network drops

    subprocess.stdout.pipe(res);

    subprocess.catch((err) => {
        console.error('Download stream error:', err.message);
        if (!res.headersSent) {
            res.status(500).send('Direct Download failed.');
        }
    });

    // Handle client disconnects to prevent memory leaks / dangling yt-dlp processes
    req.on('close', () => {
        if (!subprocess.killed) {
            console.log('Client aborted download. Killing yt-dlp subprocess.');
            subprocess.kill('SIGKILL');
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 SnapLoad Proxy Server running at http://localhost:${PORT}`);
});
