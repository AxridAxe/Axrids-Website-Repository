async function testThingProxy() {
  const url = "https://thingproxy.freeboard.io/fetch/" + "https://soundcloud.com/axridaxe/tracks";
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
testThingProxy();
