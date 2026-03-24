async function testRssFull() {
  const url = "https://feeds.soundcloud.com/users/soundcloud:users:825367603/sounds.rss";
  const res = await fetch(url);
  const text = await res.text();
  const matches = text.match(/<link>(.*?)<\/link>/g);
  if (matches) {
    console.log("Matches:", matches.map(m => m.replace(/<\/?link>/g, '')).filter(l => l.includes('soundcloud.com')));
  }
}
testRssFull();
