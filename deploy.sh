#!/bin/bash
set -e

echo "Deploying to Raspberry Pi..."

# Push to GitHub
git add -A
git commit -m "${1:-Update}" 2>/dev/null || echo "Nothing new to commit"
git push

# Pull on Pi and restart
ssh -i ~/.ssh/pi_key Axrid@192.168.0.34 "
  cd Axrids-Website-Repository &&
  git pull &&
  npm install --silent &&
  npm run build &&
  pm2 restart axrid-website
"

echo "Done! Site updated at http://192.168.0.34:3000"
