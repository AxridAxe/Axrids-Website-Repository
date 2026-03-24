const url = "https://api.allorigins.win/get?url=" + encodeURIComponent("https://soundcloud.com/axridaxe/tracks");
fetch(url).then(r => r.json()).then(d => {
  console.log("Status:", d.status);
  console.log("Content length:", d.contents.length);
}).catch(e => console.error(e));
