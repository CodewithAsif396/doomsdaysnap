const youtubedl = require('youtube-dl-exec');
const ffmpegPath = require('ffmpeg-static');
const fs         = require('fs');
const path       = require('path');
const { quoteArg } = require('../utils/shell');

// Use system yt-dlp if available (newer, avoids bot detection better)
const SYSTEM_YTDLP = '/usr/local/bin/yt-dlp';
const ytdlpBin = fs.existsSync(SYSTEM_YTDLP) ? SYSTEM_YTDLP : undefined;

// Cookies for bypassing YouTube bot detection
const COOKIES_FILE = path.join(__dirname, '..', 'cookies.txt');
const cookiesArg   = fs.existsSync(COOKIES_FILE) ? COOKIES_FILE : null;

class BaseProvider {
    constructor() {
    }

    async getInfo(url) {
        throw new Error('getInfo must be implemented by subclass');
    }

    async executeYtdlp(url, extraArgs = {}) {
        const defaultArgs = {
            dumpSingleJson:     true,
            noWarnings:         true,
            noCheckCertificate: true,
            noPlaylist:         true,
            forceIpv4:          true,
            geoBypass:          true,
            ffmpegLocation:     quoteArg(ffmpegPath),
            ...(cookiesArg ? { cookies: cookiesArg } : {}),
        };

        const opts = { timeout: 45000 };
        if (ytdlpBin) opts.execPath = ytdlpBin;

        return await youtubedl(url, { ...defaultArgs, ...extraArgs }, opts);
    }
}

module.exports = BaseProvider;
