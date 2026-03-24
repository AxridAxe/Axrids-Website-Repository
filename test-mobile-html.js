import fs from 'fs';
async function testMobileHtml() {
  const res = await fetch("https://m.soundcloud.com/axridaxe/tracks", {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    }
  });
  const html = await res.text();
  fs.writeFileSync('mobile-tracks.html', html);
  console.log("Saved to mobile-tracks.html");
}
testMobileHtml();
