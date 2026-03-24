#!/bin/bash
while true; do
  clear
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║            AXRID SERVER DASHBOARD                   ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
  STATUS=$(pm2 list 2>/dev/null | grep axrid-website | awk '{print $18}' | tr -d ' ')
  UPTIME=$(pm2 list 2>/dev/null | grep axrid-website | awk '{print $14}' | tr -d ' ')
  IP=$(hostname -I | awk '{print $1}')
  DISK=$(df -h / | tail -1 | awk '{print $3 " used / " $2 " total (" $5 " full)"}')
  MEM=$(free -h | grep Mem | awk '{print $3 " used / " $2 " total"}')
  TEMP=$(vcgencmd measure_temp 2>/dev/null || echo "N/A")

  echo "  Server:   $STATUS"
  echo "  Address:  http://$IP:3000"
  echo "  Uptime:   $UPTIME"
  echo "  Disk:     $DISK"
  echo "  Memory:   $MEM"
  echo "  Temp:     $TEMP"
  echo ""
  echo "  ------------------------------------------------"
  echo "  TRACK DOWNLOAD PROGRESS"

  MP3S=$(ls /home/Axrid/Axrids-Website-Repository/uploads/*.mp3 2>/dev/null | wc -l)
  TOTAL=51
  PERCENT=$((MP3S * 100 / TOTAL))
  FILLED=$((PERCENT / 5))
  BAR=""
  i=0
  while [ $i -lt 20 ]; do
    if [ $i -lt $FILLED ]; then
      BAR="${BAR}#"
    else
      BAR="${BAR}."
    fi
    i=$((i + 1))
  done

  echo "  [$BAR] $MP3S/$TOTAL tracks ($PERCENT%)"
  echo ""
  LAST=$(tail -1 /home/Axrid/download.log 2>/dev/null | cut -c1-50)
  echo "  Last: $LAST"
  echo "  ------------------------------------------------"
  echo ""
  echo "  Refreshing every 3s... Ctrl+C to close"
  sleep 3
done
