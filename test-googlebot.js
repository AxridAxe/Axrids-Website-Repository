import fs from 'fs';
async function testGooglebot() {
  const res = await fetch("https://soundcloud.com/axridaxe/tracks", {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    }
  });
  console.log("Status:", res.status);
  const html = await res.text();
  const matches = html.match(/axridaxe\/[^"/?#]+/g);
  if (matches) {
    const unique = Array.from(new Set(matches));
    console.log("Matches:", unique.slice(0, 10));
  } else {
    console.log("No matches");
  }
}
testGooglebot();
