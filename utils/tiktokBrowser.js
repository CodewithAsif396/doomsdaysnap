/**
 * TikTok Browser — headless Chromium with stealth plugin.
 * Intercepts the actual video CDN request the browser makes, capturing both
 * the URL and the exact request headers (including tt_chain_token cookie).
 * The server then replays that request to get original-quality video.
 */
const puppeteer = require('puppeteer-extra');
const stealth   = require('puppeteer-extra-plugin-stealth');
puppeteer.use(stealth());

function findChromium() {
    const fs = require('fs');
    const candidates = [
        process.env.CHROMIUM_PATH,
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
    ];
    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
    }
    return undefined;
}

const CHROMIUM = findChromium();
console.log('[TikTokBrowser] Chromium:', CHROMIUM || 'bundled');

let _browser = null;

async function getBrowser() {
    if (_browser && _browser.isConnected()) return _browser;
    _browser = await puppeteer.launch({
        headless: 'new',
        executablePath: CHROMIUM,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--disable-extensions',
        ],
    });
    _browser.on('disconnected', () => {
        _browser = null;
        console.log('[TikTokBrowser] Browser disconnected');
    });
    console.log('[TikTokBrowser] Browser launched');
    return _browser;
}

// Detect TikTok video CDN URLs (actual video stream, not thumbnails/audio)
function isVideoCdnUrl(url) {
    const isFromCdn = url.includes('tiktokcdn.com')
                   || url.includes('tokcdn.com')
                   || url.includes('tiktokv.com');
    const isVideo   = url.includes('/video/tos/')
                   || url.includes('mime_type=video_mp4')
                   || (url.includes('.mp4') && !url.includes('cover') && !url.includes('thumb'));
    return isFromCdn && isVideo;
}

/**
 * Returns { url, headers } where headers includes the browser's cookies
 * (tt_chain_token etc.) needed to get HD quality from TikTok CDN.
 * Returns null on failure.
 */
async function getTikTokCdnUrl(videoUrl) {
    let page;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();

        await page.setViewport({ width: 1280, height: 800 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

        let captured = null;

        // Intercept every request — capture the first video CDN hit
        await page.setRequestInterception(true);

        page.on('request', (request) => {
            const url = request.url();
            if (!captured && isVideoCdnUrl(url)) {
                captured = {
                    url,
                    // Grab ALL headers the browser sends (incl. Cookie: tt_chain_token)
                    headers: { ...request.headers() },
                };
                console.log(`[TikTokBrowser] Captured CDN: ${url.slice(0, 80)}`);
            }
            request.continue();
        });

        // Also intercept API JSON responses as a fallback source for the URL
        let apiUrl = null;
        page.on('response', async (resp) => {
            if (apiUrl) return;
            if (resp.status() !== 200) return;
            const u = resp.url();
            if (!u.includes('/api/item/detail') && !u.includes('/api/aweme/detail')) return;
            try {
                const json  = await resp.json();
                const video = json?.itemInfo?.itemStruct?.video
                           || json?.aweme_detail?.video
                           || json?.data?.aweme_detail?.video;
                if (!video) return;
                const bitrates = video.bitrateInfo || video.bit_rate || [];
                const sorted   = [...bitrates].sort((a, b) =>
                    (b.Bitrate || b.bitrate || 0) - (a.Bitrate || a.bitrate || 0));
                const best = sorted[0];
                const u2   = best?.PlayAddr?.UrlList?.[0] || best?.play_addr?.url_list?.[0];
                if (u2) {
                    apiUrl = u2;
                    console.log(`[TikTokBrowser] API bitrate: ${best?.Bitrate || '?'}kbps`);
                }
            } catch { /* ignore */ }
        });

        await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

        // Wait up to 8 seconds for the video player to start streaming
        for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 1000));
            if (captured) break;
        }

        // Prefer the intercepted CDN request (has live cookies) over API URL
        if (captured) {
            console.log(`[TikTokBrowser] Using intercepted CDN URL + cookies`);
            return captured;
        }

        // Fallback: use API URL with current page cookies
        if (apiUrl) {
            console.log(`[TikTokBrowser] Using API URL, fetching page cookies`);
            const cookies = await page.cookies();
            const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            return {
                url: apiUrl,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer':    'https://www.tiktok.com/',
                    'Cookie':     cookieStr,
                },
            };
        }

        // Last resort: parse embedded JSON in page HTML
        const data = await page.evaluate(() => {
            for (const id of ['__UNIVERSAL_DATA_FOR_REHYDRATION__', 'SIGI_STATE']) {
                const el = document.getElementById(id);
                if (el) { try { return JSON.parse(el.textContent); } catch {} }
            }
            return null;
        });
        if (data) {
            const scope = data?.__DEFAULT_SCOPE__;
            const item  = scope?.['webapp.video-detail']?.itemInfo?.itemStruct
                       || Object.values(data?.ItemModule || {})[0];
            const video = item?.video;
            if (video) {
                const bitrates = video.bitrateInfo || video.bit_rate || [];
                const sorted   = [...bitrates].sort((a, b) =>
                    (b.Bitrate || b.bitrate || 0) - (a.Bitrate || a.bitrate || 0));
                const u = sorted[0]?.PlayAddr?.UrlList?.[0]
                       || video.playAddr?.urlList?.[0]
                       || video.play_addr?.url_list?.[0];
                if (u) {
                    const cookies  = await page.cookies();
                    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                    console.log(`[TikTokBrowser] Using embedded JSON URL`);
                    return {
                        url: u,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                            'Referer':    'https://www.tiktok.com/',
                            'Cookie':     cookieStr,
                        },
                    };
                }
            }
        }

        console.log('[TikTokBrowser] No video URL found');
        return null;

    } catch (err) {
        console.error('[TikTokBrowser] Error:', err.message);
        return null;
    } finally {
        if (page) await page.close().catch(() => {});
    }
}

// Warm up browser at startup
getBrowser().catch(err => console.error('[TikTokBrowser] Warmup failed:', err.message));

module.exports = { getTikTokCdnUrl };
