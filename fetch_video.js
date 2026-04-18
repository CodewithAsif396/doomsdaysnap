const fs = require('fs');

const SESSION_ID = "b05e5b33c6b4ad91577ba3ea5338f41f";
const VIDEO_URL = "https://www.tiktok.com/@kyliejenner/video/7627308836575005983";

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.tiktok.com/",
    "Cookie": `sessionid=${SESSION_ID}`,
};

async function get_video_info(url) {
    try {
        console.log(`Fetching: ${url}`);
        const response = await fetch(url, { headers });
        console.log("Status:", response.status);
        
        const html = await response.text();
        
        // Match the script tag
        const match = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s);
        
        if (match) {
            const data = JSON.parse(match[1]);
            fs.writeFileSync("raw_data.json", JSON.stringify(data, null, 2), "utf-8");
            console.log("Data saved to raw_data.json");
        } else {
            console.log("Data nahi mila — page source check karo");
            fs.writeFileSync("page.html", html, "utf-8");
            console.log("HTML saved to page.html");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

get_video_info(VIDEO_URL);
