const BaseProvider = require('./BaseProvider');
const browserScraper = require('../utils/browserScraper');

class FacebookProvider extends BaseProvider {
    async getInfo(url) {
        console.log('[Facebook] Attempting high-quality browser extraction...');
        const result = await browserScraper.extractFacebook(url);

        if (result) {
            return {
                title:     result.title,
                thumbnail: result.thumbnail,
                duration:  '0:00',
                formats:   result.formats.map(f => ({
                    height: f.height,
                    ext:    f.ext,
                    url:    f.url, // Note: We return direct URL for browser extraction
                    size:   null,
                })),
                provider:  'facebook',
            };
        }

        // Fallback to BaseProvider (yt-dlp) if browser fails
        console.log('[Facebook] Browser extraction failed, falling back to yt-dlp...');
        const output = await this.executeYtdlp(url, {
            referer: 'https://www.facebook.com/',
        });

        return {
            title:     output.title           || 'Facebook Video',
            thumbnail: output.thumbnail       || '',
            duration:  output.duration_string || '0:00',
            formats:   this.parseFormats(output.formats),
            provider:  'facebook',
        };
    }
}

module.exports = FacebookProvider;
