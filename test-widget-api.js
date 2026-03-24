async function testWidgetApi() {
  const url = "https://api-widget.soundcloud.com/resolve?url=https://soundcloud.com/axridaxe/tracks&format=json&client_id=IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB";
  const res = await fetch(url);
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Data:", data);
}
testWidgetApi();
