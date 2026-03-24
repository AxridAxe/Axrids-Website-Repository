import fs from 'fs';
async function testCodetabs() {
  const url = "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent("https://soundcloud.com/axridaxe/tracks");
  const res = await fetch(url);
  const html = await res.text();
  fs.writeFileSync('codetabs.html', html);
  console.log("Saved to codetabs.html");
}
testCodetabs();
