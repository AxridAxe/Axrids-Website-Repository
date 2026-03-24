#!/usr/bin/env python3
import tkinter as tk
import subprocess
import glob
import threading
import time

BG     = "#0a0a0a"
CARD   = "#111111"
CARD2  = "#161616"
ACCENT = "#ffffff"
DIM    = "#444444"
DIM2   = "#2a2a2a"
GREEN  = "#00ff88"
RED    = "#ff4444"
BLUE   = "#4488ff"
YELLOW = "#ffcc00"

class Dashboard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Axrid Server")
        self.geometry("560x780")
        self.resizable(False, False)
        self.configure(bg=BG)
        self.build()
        self.schedule_update()

    def cmd(self, c):
        try:
            return subprocess.check_output(c, shell=True, stderr=subprocess.DEVNULL, text=True).strip()
        except:
            return ""

    def build(self):
        # Header
        tk.Label(self, text="AXRID", font=("Helvetica", 30, "bold"), bg=BG, fg=ACCENT).pack(pady=(24, 0))
        tk.Label(self, text="S E R V E R  D A S H B O A R D", font=("Helvetica", 9), bg=BG, fg=DIM).pack()
        tk.Frame(self, bg=DIM2, height=1).pack(fill="x", padx=30, pady=14)

        # Server status
        card1 = tk.Frame(self, bg=CARD)
        card1.pack(fill="x", padx=24, pady=4)
        tk.Label(card1, text="SERVER", font=("Helvetica", 7, "bold"), bg=CARD, fg=DIM).grid(row=0, column=0, sticky="w", padx=16, pady=(12,2))
        self.dot = tk.Label(card1, text="●", font=("Helvetica", 14), bg=CARD, fg=GREEN)
        self.dot.grid(row=1, column=0, sticky="w", padx=16)
        self.status_lbl = tk.Label(card1, text="online", font=("Helvetica", 13, "bold"), bg=CARD, fg=GREEN)
        self.status_lbl.grid(row=1, column=1, sticky="w", padx=(4,0))
        self.uptime_lbl = tk.Label(card1, text="uptime: ...", font=("Helvetica", 9), bg=CARD, fg=DIM)
        self.uptime_lbl.grid(row=2, column=0, columnspan=2, sticky="w", padx=16, pady=(2,12))

        # Addresses
        card2 = tk.Frame(self, bg=CARD)
        card2.pack(fill="x", padx=24, pady=4)
        tk.Label(card2, text="ADDRESS", font=("Helvetica", 7, "bold"), bg=CARD, fg=DIM).pack(anchor="w", padx=16, pady=(12,4))
        addr_row = tk.Frame(card2, bg=CARD)
        addr_row.pack(fill="x", padx=16, pady=(0,12))
        self.domain_lbl = tk.Label(addr_row, text="axrid.com", font=("Helvetica", 12, "bold"), bg=CARD, fg=GREEN)
        self.domain_lbl.pack(side="left")
        tk.Label(addr_row, text="  |  ", font=("Helvetica", 12), bg=CARD, fg=DIM).pack(side="left")
        self.ip_lbl = tk.Label(addr_row, text="...", font=("Helvetica", 12, "bold"), bg=CARD, fg=BLUE)
        self.ip_lbl.pack(side="left")

        # System stats row
        stats = tk.Frame(self, bg=BG)
        stats.pack(fill="x", padx=24, pady=4)
        for i in range(4): stats.columnconfigure(i, weight=1)
        self.cpu_val  = self.stat_card(stats, "CPU",    0)
        self.temp_val = self.stat_card(stats, "TEMP",   1)
        self.mem_val  = self.stat_card(stats, "MEMORY", 2)
        self.disk_val = self.stat_card(stats, "DISK",   3)

        # Website stats
        card4 = tk.Frame(self, bg=CARD)
        card4.pack(fill="x", padx=24, pady=4)
        tk.Label(card4, text="WEBSITE", font=("Helvetica", 7, "bold"), bg=CARD, fg=DIM).pack(anchor="w", padx=16, pady=(12,6))
        ws = tk.Frame(card4, bg=CARD)
        ws.pack(fill="x", padx=16, pady=(0,12))
        ws.columnconfigure(0, weight=1)
        ws.columnconfigure(1, weight=1)
        ws.columnconfigure(2, weight=1)

        self.tracks_val   = self._ws_item(ws, "TRACKS",   0)
        self.visitors_val = self._ws_item(ws, "VISITORS TODAY", 1)
        self.requests_val = self._ws_item(ws, "REQUESTS TODAY", 2)

        # Recent activity
        card5 = tk.Frame(self, bg=CARD)
        card5.pack(fill="x", padx=24, pady=4)
        tk.Label(card5, text="RECENT ACTIVITY", font=("Helvetica", 7, "bold"), bg=CARD, fg=DIM).pack(anchor="w", padx=16, pady=(12,6))
        self.activity_labels = []
        for _ in range(4):
            lbl = tk.Label(card5, text="", font=("Helvetica", 8), bg=CARD, fg=DIM, anchor="w", wraplength=500)
            lbl.pack(fill="x", padx=16, pady=1)
            self.activity_labels.append(lbl)
        tk.Frame(card5, bg=BG, height=8).pack()

        # Controls
        ctrl = tk.Frame(self, bg=BG)
        ctrl.pack(fill="x", padx=24, pady=8)
        tk.Button(ctrl, text="RESTART SERVER", font=("Helvetica", 8, "bold"), bg=CARD, fg=YELLOW,
                  activebackground=DIM2, activeforeground=YELLOW, relief="flat", cursor="hand2",
                  command=self.restart_server, padx=16, pady=8).pack(side="left", padx=(0,8))
        tk.Button(ctrl, text="OPEN IN BROWSER", font=("Helvetica", 8, "bold"), bg=CARD, fg=BLUE,
                  activebackground=DIM2, activeforeground=BLUE, relief="flat", cursor="hand2",
                  command=self.open_browser, padx=16, pady=8).pack(side="left")

        # Clock
        tk.Frame(self, bg=DIM2, height=1).pack(fill="x", padx=30, pady=10)
        self.clock_lbl = tk.Label(self, text="", font=("Helvetica", 9), bg=BG, fg=DIM)
        self.clock_lbl.pack(pady=(0,16))

    def _ws_item(self, parent, label, col):
        f = tk.Frame(parent, bg=CARD)
        f.grid(row=0, column=col, sticky="ew", padx=4)
        tk.Label(f, text=label, font=("Helvetica", 6, "bold"), bg=CARD, fg=DIM).pack(pady=(0,2))
        val = tk.Label(f, text="...", font=("Helvetica", 13, "bold"), bg=CARD, fg=ACCENT)
        val.pack()
        return val

    def stat_card(self, parent, label, col):
        f = tk.Frame(parent, bg=CARD)
        f.grid(row=0, column=col, sticky="ew", padx=4)
        tk.Label(f, text=label, font=("Helvetica", 7, "bold"), bg=CARD, fg=DIM).pack(pady=(10,2))
        val = tk.Label(f, text="...", font=("Helvetica", 11, "bold"), bg=CARD, fg=ACCENT)
        val.pack(pady=(0,10))
        return val

    def restart_server(self):
        self.cmd("pm2 restart axrid-website")

    def open_browser(self):
        self.cmd("xdg-open https://axrid.com")

    def fetch_data(self):
        pm2 = self.cmd("pm2 list 2>/dev/null | grep axrid-website")
        online = "online" in pm2
        uptime = pm2.split()[13] if online and len(pm2.split()) > 13 else "—"
        ip = self.cmd("hostname -I | awk '{print $1}'")
        cpu = self.cmd("top -bn1 | grep 'Cpu(s)' | awk '{print $2+$4\"%\"}'") or "N/A"
        temp = self.cmd("vcgencmd measure_temp 2>/dev/null | cut -d= -f2") or "N/A"
        mem = self.cmd("free -h | grep Mem | awk '{print $3\"/\"$2}'") or "N/A"
        disk = self.cmd("df -h / | tail -1 | awk '{print $5}'") or "N/A"
        mp3s = len(glob.glob("/home/Axrid/Axrids-Website-Repository/uploads/*.mp3"))

        today = time.strftime("%d/%b/%Y")
        log_today = self.cmd(f"grep '{today}' /var/log/nginx/access.log 2>/dev/null | wc -l")
        unique_ips = self.cmd(f"grep '{today}' /var/log/nginx/access.log 2>/dev/null | awk '{{print $1}}' | sort -u | wc -l")

        recent_raw = self.cmd("tail -4 /var/log/nginx/access.log 2>/dev/null")
        recent_lines = []
        for line in recent_raw.splitlines():
            parts = line.split('"')
            if len(parts) >= 4:
                req = parts[1]
                status = parts[2].strip().split()[0] if parts[2].strip() else "?"
                ts = line.split('[')[1].split(']')[0][:17] if '[' in line else ""
                color_hint = "ok" if status.startswith("2") or status.startswith("3") else "err"
                recent_lines.append((f"{ts}  {req}  [{status}]", color_hint))

        clock = time.strftime("%H:%M:%S   %d %b %Y")
        return online, uptime, ip, cpu, temp, mem, disk, mp3s, log_today, unique_ips, recent_lines, clock

    def apply_data(self, data):
        online, uptime, ip, cpu, temp, mem, disk, mp3s, requests, visitors, recent, clock = data

        color = GREEN if online else RED
        status_text = "online" if online else "offline"
        if self.dot.cget("fg") != color:
            self.dot.config(fg=color)
            self.status_lbl.config(text=status_text, fg=color)

        self._set(self.uptime_lbl, f"uptime: {uptime}")
        self._set(self.ip_lbl, f"http://{ip}:3000")
        self._set(self.cpu_val,  cpu)
        self._set(self.temp_val, temp)
        self._set(self.mem_val,  mem)
        self._set(self.disk_val, disk)
        self._set(self.tracks_val,   str(mp3s))
        self._set(self.visitors_val, str(visitors))
        self._set(self.requests_val, str(requests))
        self._set(self.clock_lbl, clock)

        for i, lbl in enumerate(self.activity_labels):
            if i < len(recent):
                text, hint = recent[i]
                col = DIM if hint == "ok" else RED
                if lbl.cget("text") != text: lbl.config(text=text, fg=col)
            else:
                if lbl.cget("text") != "": lbl.config(text="")

    def _set(self, widget, value):
        if widget.cget("text") != value:
            widget.config(text=value)

    def schedule_update(self):
        def run():
            data = self.fetch_data()
            self.after(0, lambda: self.apply_data(data))
        threading.Thread(target=run, daemon=True).start()
        self.after(5000, self.schedule_update)

if __name__ == "__main__":
    app = Dashboard()
    app.mainloop()
