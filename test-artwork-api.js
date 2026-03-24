async function testArtworkApi() {
  const res = await fetch("http://localhost:3000/api/soundcloud/artwork?url=https://soundcloud.com/axridaxe/jazz");
  const data = await res.json();
  console.log("Artwork URL:", data.artworkUrl);
  console.log("Base64 length:", data.base64 ? data.base64.length : 0);
}
testArtworkApi();
