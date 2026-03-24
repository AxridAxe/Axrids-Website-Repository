async function testWidgetApiTracks() {
  const url = "https://api-widget.soundcloud.com/users/825367603/tracks?format=json&client_id=IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB&limit=100";
  const res = await fetch(url);
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Tracks:", data.collection ? data.collection.map(t => t.permalink_url) : data);
}
testWidgetApiTracks();
