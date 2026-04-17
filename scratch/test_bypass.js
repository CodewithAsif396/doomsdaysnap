const SocialProvider = require('../providers/SocialProvider');

async function test() {
    const provider = new SocialProvider();
    const url = 'https://pin.it/2cWh7kFIR';
    console.log(`Testing Pinterest extraction for: ${url}`);
    
    try {
        const info = await provider.getInfo(url);
        console.log('SUCCESS!');
        console.log('Title:', info.title);
        console.log('Formats:', info.formats.length);
        console.log('Provider:', info.provider);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

test();
