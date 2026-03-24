import fs from 'fs';
const html = fs.readFileSync('mobile-tracks.html', 'utf-8');
const matches = html.match(/axridaxe\/[^"/?#]+/g);
if (matches) {
  const unique = Array.from(new Set(matches));
  console.log("Matches:", unique);
} else {
  console.log("No matches");
}
