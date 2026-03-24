async function testStreamCORS() {
  const url = "http://localhost:3000/api/soundcloud/stream?url=https://soundcloud.com/axridaxe/jazz";
  const res = await fetch(url);
  console.log("CORS:", res.headers.get('access-control-allow-origin'));
}
testStreamCORS();
