import fs from 'fs';
const html = fs.readFileSync('codetabs.html', 'utf-8');
const titleMatch = html.match(/<title>(.*?)<\/title>/i);
console.log("Title:", titleMatch ? titleMatch[1] : "No title");
