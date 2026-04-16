/**
 * TikTok Browser — headless Chromium with stealth plugin.
 * TikTok sees a real Chrome user → returns original HEVC bit_rate[] CDN URLs.
 */
const puppeteer = require('puppeteer-extra');
const stealth   = require('puppeteer-extra-plugin-stealth');
puppeteer.use(stealth());

// Find system Chromium on Linux VPS (saves 300MB vs bundled)
function findChromium() {
    const fs = require('fs');
    const candidates = [
        process.env.CHROMIUM_PATH,
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
    ];
    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
    }
    return undefined; // puppeteer will use its own bundled Chrome
}

const CHROMIUM = findChromium();
console.log('[TikTokBrowser] Chromium:', CHROMIUM || 'bundled');

// Single reusable browser instance (avoids cold-start per request)
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
            '--disable-background-networking',
            '--disable-sync',
            '--metrics-recording-only',
            '--mute-audio',
        ],
    });

    _browser.on('disconnected', () => {
        _browser = null;
        console.log('[TikTokBrowser] Browser disconnected — will relaunch on next request');
    });

    console.log('[TikTokBrowser] Browser launched');
    return _browser;
}

// ─── Helper: pull best video URL out of TikTok's API JSON ─────────────────────
function extractBestUrl(video) {
    if (!video) return null;

    let bestUrl     = null;
    let bestBitrate = 0;

    // bitrateInfo / bit_rate — array of {Bitrate, CodecType, PlayAddr: {UrlList}}
    const bitrates = video.bitrateInfo || video.bit_rate || [];
    for (const b of bitrates) {
        const br  = b.Bitrate || b.bitrate || 0;
        const url = b.PlayAddr?.UrlList?.[0]
                 || b.play_addr?.url_list?.[0]
                 || b.playAddr?.urlList?.[0];
        if (url && br > bestBitrate) {
            bestBitrate = br;
            bestUrl     = url;
        }
    }

    // Fallback to default playAddr
    if (!bestUrl) {
        bestUrl = video.playAddr?.urlList?.[0]
               || video.play_addr?.url_list?.[0]
               || video.downloadAddr?.urlList?.[0]
               || video.download_addr?.url_list?.[0];
    }

    if (bestUrl) console.log(`[TikTokBrowser] Best quality: ${bestBitrate}kbps → ${bestUrl.slice(0, 60)}...`);
    return bestUrl;
}

// ─── Main export ───────────────────────────────────────────────────────────────
/**
 * Launch headless Chrome, navigate to the TikTok video URL, intercept API
 * responses and parse embedded JSON to find the highest-bitrate CDN URL.
 * @returns {Promise<string|null>} Direct CDN video URL or null on failure.
 */
async function getTikTokCdnUrl(videoUrl) {
    let browser, page;
    try {
        browser = await getBrowser();
        page    = await browser.newPage();

        await page.setViewport({ width: 1280, height: 800 });
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
        });

        let bestUrl = null;

        // ── Intercept JSON API responses ────────────────────────────────────
        page.on('response', async (resp) => {
            if (bestUrl) return; // already got it
            if (resp.status() !== 200) return;

            const url = resp.url();
            const isApiUrl = url.includes('/api/item/detail')
                          || url.includes('/api/aweme/detail')
                          || url.includes('tiktokv.com/aweme/v1/feed')
                          || url.includes('tiktokv.com/aweme/v1/aweme/detail');
            if (!isApiUrl) return;

            try {
                const json  = await resp.json();
                const video = json?.itemInfo?.itemStruct?.video
                           || json?.aweme_detail?.video
                           || json?.data?.aweme_detail?.video
                           || json?.aweme_list?.[0]?.video;
                const u = extractBestUrl(video);
                if (u) bestUrl = u;
            } catch { /* ignore parse errors */ }
        });

        // Navigate — domcontentloaded is enough, no need to wait for all assets
        await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

        // Give the page 4s to fire API calls and receive responses
        await new Promise(r => setTimeout(r, 4000));

        // ── Fallback: parse embedded JSON in <script> tags ───────────────────
        if (!bestUrl) {
            const data = await page.evaluate(() => {
                for (const id of ['__UNIVERSAL_DATA_FOR_REHYDRATION__', 'SIGI_STATE']) {
                    const el = document.getElementById(id);
                    if (el) { try { return JSON.parse(el.textContent); } catch {} }
                }
                return null;
            });

            if (data) {
                // __UNIVERSAL_DATA_FOR_REHYDRATION__ structure
                const scope  = data?.__DEFAULT_SCOPE__;
                const detail = scope?.['webapp.video-detail']?.itemInfo?.itemStruct
                            || scope?.['webapp.video-detail']?.itemInfo?.item;

                // SIGI_STATE structure
                const sigi  = data?.ItemModule;
                const sigiItem = sigi ? Object.values(sigi)[0] : null;

                const video = detail?.video || sigiItem?.video;
                const u     = extractBestUrl(video);
                if (u) bestUrl = u;
            }
        }

        return bestUrl;

    } catch (err) {
        console.error('[TikTokBrowser] Error:', err.message);
        return null;
    } finally {
        if (page) await page.close().catch(() => {});
    }
}

// Warm up the browser at startup (optional — comment out if memory is tight)
getBrowser().catch(err => console.error('[TikTokBrowser] Warmup failed:', err.message));

module.exports = { getTikTokCdnUrl };
