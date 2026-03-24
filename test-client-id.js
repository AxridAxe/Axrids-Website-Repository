async function getClientId() {
  const res = await fetch("https://soundcloud.com");
  const html = await res.text();
  const scriptUrls = Array.from(html.matchAll(/<script crossorigin src="([^"]+)"><\/script>/g)).map(m => m[1]);
  for (const url of scriptUrls) {
    const jsRes = await fetch(url);
    const js = await jsRes.text();
    const match = js.match(/client_id:"([^"]+)"/);
    if (match) {
      console.log("Found client_id:", match[1]);
      return match[1];
    }
  }
  console.log("Not found");
}
getClientId();
