async function testProfileApi() {
  const res = await fetch("http://localhost:3000/api/soundcloud/profile?profileUrl=https://soundcloud.com/axridaxe");
  const data = await res.json();
  console.log("Data:", data);
}
testProfileApi();
