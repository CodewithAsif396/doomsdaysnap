const BaseProvider = require('./BaseProvider');
const browserScraper = require('../utils/browserScraper');

class SocialProvider extends BaseProvider {
    async getInfo(url) {
        const isSnapchat  = url.includes('snapchat.com') || url.includes('t.snapchat.com');
        const isPinterest = url.includes('pinterest.com') || url.includes('pin.it');

        if (isSnapchat || isPinterest) {
            console.log(`[Social] Attempting browser extraction for ${isSnapchat ? 'Snapchat' : 'Pinterest'}...`);
            const result = isSnapchat 
                ? await browserScraper.extractSnapchat(url)
                : await browserScraper.extractPinterest(url);

            if (result) {
                return {
                    title:     result.title,
                    thumbnail: result.thumbnail,
                    duration:  '0:00',
                    formats:   result.formats.map(f => ({
                        height: f.height,
                        ext:    f.ext,
                        url:    f.url,
                        size:   null,
                    })),
                    provider:  isSnapchat ? 'snapchat' : 'pinterest',
                };
            }
        }

        // Fallback for generic or if browser fails
        console.log('[Social] Browser extraction failed or generic link, using yt-dlp fallback...');
        const output = await this.executeYtdlp(url);

        const provider = isSnapchat  ? 'snapchat'
                       : isPinterest ? 'pinterest'
                       : 'generic';

        return {
            title:     output.title           || 'Video',
            thumbnail: output.thumbnail       || '',
            duration:  output.duration_string || '0:00',
            formats:   this.parseFormats(output.formats),
            provider,
        };
    }
}

module.exports = SocialProvider;
