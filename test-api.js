async function testApi() {
  const clientId = "IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB";
  const profileUrl = "https://soundcloud.com/axridaxe";
  
  const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(profileUrl)}&client_id=${clientId}`;
  const res = await fetch(resolveUrl);
  const data = await res.json();
  console.log("User ID:", data.id);
  
  const tracksUrl = `https://api-v2.soundcloud.com/users/${data.id}/tracks?client_id=${clientId}&limit=100`;
  const tracksRes = await fetch(tracksUrl);
  const tracksData = await tracksRes.json();
  console.log("TracksData:", tracksData);
}
testApi();
