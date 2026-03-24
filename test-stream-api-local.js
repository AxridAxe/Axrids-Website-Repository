async function testStreamApi() {
  const url = "http://localhost:3000/api/soundcloud/stream?url=https://soundcloud.com/axridaxe/jazz";
  const res = await fetch(url);
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get('content-type'));
  console.log("Content-Length:", res.headers.get('content-length'));
}
testStreamApi();
