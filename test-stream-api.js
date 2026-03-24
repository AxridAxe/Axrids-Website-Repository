async function testStreamApi() {
  const url = "https://api-widget.soundcloud.com/resolve?url=https://soundcloud.com/axridaxe/jazz&format=json&client_id=IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB";
  const res = await fetch(url);
  const data = await res.json();
  console.log("Track Data:", data.media ? data.media.transcodings.map(t => t.url) : "No media");
}
testStreamApi();
