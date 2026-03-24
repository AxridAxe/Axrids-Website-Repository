async function testStreamApi2() {
  const url = "https://api-widget.soundcloud.com/media/soundcloud:tracks:2287659347/01417046-3c7c-4a6d-a2f8-2e270b58fc3c/stream/progressive?client_id=IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB";
  const res = await fetch(url);
  const data = await res.json();
  console.log("Stream URL:", data.url);
}
testStreamApi2();
