import fs from 'fs';
const html = fs.readFileSync('codetabs.html', 'utf-8');
const matches = html.match(/axridaxe/gi);
console.log("Count:", matches ? matches.length : 0);
