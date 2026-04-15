const youtubedl    = require('youtube-dl-exec');
const ffmpegPath    = require('ffmpeg-static');
const { quoteArg }  = require('../utils/shell');

const test = async () => {
    try {
        console.log('FFMPEG Path:', ffmpegPath);
        const output = await youtubedl('https://www.youtube.com/watch?v=LS7woAN6O3s', {
            dumpSingleJson: true,
            ffmpegLocation: quoteArg(ffmpegPath),
            userAgent: 'Mozilla/5.0'
            // extractorArgs: 'youtube:player_client=tv_embedded,ios,mweb'
        });
        console.log('Success!');
    } catch (err) {
        console.error('Error:', err.message);
    }
};

test();
