const puppeteer = require('puppeteer-extra');
const stealth   = require('puppeteer-extra-plugin-stealth');
const fs        = require('fs');
const path      = require('path');

puppeteer.use(stealth());

function findChromium() {
    const isWin = process.platform === 'win32';
    const paths = isWin ? [
        process.env.CHROMIUM_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ] : [
        process.env.CHROMIUM_PATH,
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
    ];

    for (const p of paths) {
        if (p && fs.existsSync(p)) return p;
    }
    return undefined;
}

const CHROMIUM = findChromium();
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
        ],
    });
    _browser.on('disconnected', () => { _browser = null; });
    return _browser;
}

/**
 * Generalized scraper for Facebook, Pinterest, and Snapchat.
 * Returns { title, thumbnail, duration, formats, provider }
 */
const browserScraper = {
    
    async extractFacebook(videoUrl) {
        let page;
        try {
            const browser = await getBrowser();
            page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

            // Use mobile FB often bypasses desktop restrictions
            const targetUrl = videoUrl.includes('m.facebook.com') ? videoUrl : videoUrl.replace('www.facebook.com', 'm.facebook.com');
            
            console.log('[BrowserScraper] FB Navigating:', targetUrl);
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));

            const data = await page.evaluate(() => {
                const results = { title: 'Facebook Video', thumbnail: '', formats: [] };
                
                // 1. Try to find HD/SD in script tags
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const s of scripts) {
                    const content = s.textContent;
                    if (content.includes('playable_url')) {
                        // Extract HD/SD links via regex
                        const hdMatch = content.match(/"browser_native_hd_url":"([^"]+)"/);
                        const sdMatch = content.match(/"browser_native_sd_url":"([^"]+)"/);
                        const thumbMatch = content.match(/"preferred_thumbnail":{"image":{"uri":"([^"]+)"/);
                        
                        if (hdMatch) results.formats.push({ height: 'HD', url: hdMatch[1].replace(/\\/g, ''), ext: 'mp4' });
                        if (sdMatch) results.formats.push({ height: 'SD', url: sdMatch[1].replace(/\\/g, ''), ext: 'mp4' });
                        if (thumbMatch) results.thumbnail = thumbMatch[1].replace(/\\/g, '');
                    }
                }

                // 2. Fallback to video tags
                if (results.formats.length === 0) {
                    const v = document.querySelector('video');
                    if (v && (v.src || v.currentSrc)) {
                        results.formats.push({ height: 'HD', url: v.currentSrc || v.src, ext: 'mp4' });
                    }
                }

                return results;
            });

            return data.formats.length > 0 ? { ...data, provider: 'facebook' } : null;
        } catch (err) {
            console.error('[BrowserScraper] FB Error:', err.message);
            return null;
        } finally {
            if (page) await page.close().catch(() => {});
        }
    },

    async extractPinterest(videoUrl) {
        let page;
        try {
            const browser = await getBrowser();
            page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            
            console.log('[BrowserScraper] Pinterest Navigating:', videoUrl);
            await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            const data = await page.evaluate(() => {
                const results = { title: 'Pinterest Video', thumbnail: '', formats: [] };
                
                // Pinterest stores data in a script tag
                const jsonScript = document.querySelector('script[id="__PINTEREST_ANYWHERE_DATA__"], script[type="application/json"]');
                if (jsonScript) {
                    try {
                        const json = JSON.parse(jsonScript.textContent);
                        // Search for video links in the nested objects
                        const traverse = (obj) => {
                            if (!obj || typeof obj !== 'object') return;
                            if (obj.v720p || obj.v480p || obj.vMobile) {
                                if (obj.v720p?.url) results.formats.push({ height: '720p', url: obj.v720p.url, ext: 'mp4' });
                                if (obj.v480p?.url) results.formats.push({ height: '480p', url: obj.v480p.url, ext: 'mp4' });
                            }
                            Object.values(obj).forEach(traverse);
                        };
                        traverse(json);
                    } catch(e) {}
                }

                // Fallback: search for video tag
                if (results.formats.length === 0) {
                    const v = document.querySelector('video');
                    if (v && (v.src || v.currentSrc)) {
                        results.formats.push({ height: 'HD', url: v.currentSrc || v.src, ext: 'mp4' });
                    }
                }

                return results;
            });

            return data.formats.length > 0 ? { ...data, provider: 'pinterest' } : null;
        } catch (err) {
            console.error('[BrowserScraper] Pinterest Error:', err.message);
            return null;
        } finally {
            if (page) await page.close().catch(() => {});
        }
    },

    async extractSnapchat(videoUrl) {
        let page;
        try {
            const browser = await getBrowser();
            page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            console.log('[BrowserScraper] Snapchat Navigating:', videoUrl);
            await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            const data = await page.evaluate(() => {
                const results = { title: 'Snapchat Video', thumbnail: '', formats: [] };
                const v = document.querySelector('video');
                if (v && (v.src || v.currentSrc)) {
                    results.formats.push({ height: 'HD', url: v.currentSrc || v.src, ext: 'mp4' });
                }
                return results;
            });

            return data.formats.length > 0 ? { ...data, provider: 'snapchat' } : null;
        } catch (err) {
            console.error('[BrowserScraper] Snapchat Error:', err.message);
            return null;
        } finally {
            if (page) await page.close().catch(() => {});
        }
    }
};

module.exports = browserScraper;
