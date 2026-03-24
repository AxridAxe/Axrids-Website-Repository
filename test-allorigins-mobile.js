async function testAllOriginsMobile() {
  const url = "https://api.allorigins.win/get?url=" + encodeURIComponent("https://m.soundcloud.com/axridaxe/tracks");
  const res = await fetch(url);
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text.substring(0, 200));
}
testAllOriginsMobile();
