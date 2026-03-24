async function testMetadataApi() {
  const res = await fetch("http://localhost:3000/api/soundcloud/metadata?url=https://soundcloud.com/axridaxe/jazz");
  const data = await res.json();
  console.log("Metadata:", data);
}
testMetadataApi();
