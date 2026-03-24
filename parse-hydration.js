import fs from 'fs';
const data = JSON.parse(fs.readFileSync('hydration.json', 'utf-8'));
let tracks = [];
data.forEach(item => {
  if (item.data) {
    if (Array.isArray(item.data)) {
      item.data.forEach(d => {
        if (d.permalink_url && d.permalink_url.includes('axridaxe')) {
          tracks.push(d.permalink_url);
        }
      });
    } else if (item.data.permalink_url && item.data.permalink_url.includes('axridaxe')) {
      tracks.push(item.data.permalink_url);
    }
  }
});
console.log("Tracks:", Array.from(new Set(tracks)));
