async function testCors() {
  const res = await fetch("https://api-v2.soundcloud.com/resolve?url=https://soundcloud.com/axridaxe&client_id=IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB", {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "GET"
    }
  });
  console.log("CORS Headers:", res.headers.get("access-control-allow-origin"));
}
testCors();
