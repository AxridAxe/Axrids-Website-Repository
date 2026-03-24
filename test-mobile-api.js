async function testMobileApi() {
  const clientId = "IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB";
  const res = await fetch(`https://api-mobi.soundcloud.com/resolve?permalink_url=https://soundcloud.com/axridaxe&client_id=${clientId}`);
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Data:", data);
}
testMobileApi();
