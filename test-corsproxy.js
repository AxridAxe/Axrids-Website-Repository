async function testCorsProxy() {
  const url = "https://corsproxy.io/?url=" + encodeURIComponent("https://soundcloud.com/axridaxe/tracks");
  const res = await fetch(url);
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
testCorsProxy();
