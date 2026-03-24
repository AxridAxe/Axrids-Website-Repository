async function testMobileApiTracks() {
  const clientId = "IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB";
  const userId = 825367603;
  const res = await fetch(`https://api-mobi.soundcloud.com/users/${userId}/tracks?client_id=${clientId}&limit=100`);
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Tracks:", data.collection ? data.collection.map(t => t.permalink_url) : data);
}
testMobileApiTracks();
