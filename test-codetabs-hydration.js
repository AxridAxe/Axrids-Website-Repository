import fs from 'fs';
async function testCodetabsHydration() {
  const url = "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent("https://soundcloud.com/axridaxe/tracks");
  const res = await fetch(url);
  const html = await res.text();
  const hydrationScriptMatch = html.match(/<script>window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);<\/script>/i);
  if (hydrationScriptMatch) {
    fs.writeFileSync('hydration.json', hydrationScriptMatch[1]);
    console.log("Saved to hydration.json");
  }
}
testCodetabsHydration();
