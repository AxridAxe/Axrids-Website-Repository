async function testRss() {
  const url = "https://feeds.soundcloud.com/users/soundcloud:users:825367603/sounds.rss";
  const res = await fetch(url);
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Text:", text.substring(0, 500));
}
testRss();
