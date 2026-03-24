#!/usr/bin/env python3
import tkinter as tk
import subprocess
import glob
import threading
import time

BG = "#0a0a0a"
CARD = "#111111"
ACCENT = "#ffffff"
DIM = "#444444"
GREEN = "#00ff88"
RED = "#ff4444"
BLUE = "#4488ff"

class Dashboard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Axrid Server")
        self.geometry("520x600")
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
        tk.Label(self, text="AXRID", font=("Helvetica", 28, "bold"), bg=BG, fg=ACCENT).pack(pady=(24, 0))
        tk.Label(self, text="S E R V E R  D A S H B O A R D", font=("Helvetica", 9), bg=BG, fg=DIM).pack()
        tk.Frame(self, bg=DIM, height=1).pack(fill="x", padx=30, pady=16)

        # Server status
        card1 = tk.Frame(self, bg=CARD)
        card1.pack(fill="x", padx=24, pady=6)
        tk.Label(card1, text="SERVER", font=("Helvetica", 8, "bold"), bg=CARD, fg=DIM).grid(row=0, column=0, sticky="w", padx=16, pady=(12,2))
        self.dot = tk.Label(card1, text="●", font=("Helvetica", 14), bg=CARD, fg=GREEN)
        self.dot.grid(row=1, column=0, sticky="w", padx=16)
        self.status_lbl = tk.Label(card1, text="online", font=("Helvetica", 13, "bold"), bg=CARD, fg=GREEN)
        self.status_lbl.grid(row=1, column=1, sticky="w")
        self.uptime_lbl = tk.Label(card1, text="uptime: ...", font=("Helvetica", 9), bg=CARD, fg=DIM)
        self.uptime_lbl.grid(row=2, column=0, columnspan=2, sticky="w", padx=16, pady=(0,12))

        # Address
        card2 = tk.Frame(self, bg=CARD)
        card2.pack(fill="x", padx=24, pady=6)
        tk.Label(card2, text="ADDRESS", font=("Helvetica", 8, "bold"), bg=CARD, fg=DIM).pack(anchor="w", padx=16, pady=(12,2))
        self.ip_lbl = tk.Label(card2, text="...", font=("Helvetica", 13, "bold"), bg=CARD, fg=BLUE)
        self.ip_lbl.pack(anchor="w", padx=16, pady=(0,12))

        # Stats row
        stats = tk.Frame(self, bg=BG)
        stats.pack(fill="x", padx=24, pady=6)
        for i in range(3): stats.columnconfigure(i, weight=1)
        self.temp_val, self.mem_val, self.disk_val = [self.stat_card(stats, l, i) for l, i in [("TEMP", 0), ("MEMORY", 1), ("DISK", 2)]]

        # Download progress
        card3 = tk.Frame(self, bg=CARD)
        card3.pack(fill="x", padx=24, pady=6)
        tk.Label(card3, text="TRACK DOWNLOADS", font=("Helvetica", 8, "bold"), bg=CARD, fg=DIM).pack(anchor="w", padx=16, pady=(12,4))
        self.prog_lbl = tk.Label(card3, text="0 / 51 tracks (0%)", font=("Helvetica", 13, "bold"), bg=CARD, fg=ACCENT)
        self.prog_lbl.pack(anchor="w", padx=16)
        self.bar_canvas = tk.Canvas(card3, bg=CARD, height=12, highlightthickness=0)
        self.bar_canvas.pack(fill="x", padx=16, pady=8)
        self.dl_lbl = tk.Label(card3, text="", font=("Helvetica", 8), bg=CARD, fg=DIM, wraplength=460, justify="left")
        self.dl_lbl.pack(anchor="w", padx=16, pady=(0,12))

        # Clock
        tk.Frame(self, bg=DIM, height=1).pack(fill="x", padx=30, pady=12)
        self.clock_lbl = tk.Label(self, text="", font=("Helvetica", 9), bg=BG, fg=DIM)
        self.clock_lbl.pack()

    def stat_card(self, parent, label, col):
        f = tk.Frame(parent, bg=CARD)
        f.grid(row=0, column=col, sticky="ew", padx=4)
        tk.Label(f, text=label, font=("Helvetica", 7, "bold"), bg=CARD, fg=DIM).pack(pady=(10,2))
        val = tk.Label(f, text="...", font=("Helvetica", 11, "bold"), bg=CARD, fg=ACCENT)
        val.pack(pady=(0,10))
        return val

    def fetch_data(self):
        pm2 = self.cmd("pm2 list 2>/dev/null | grep axrid-website")
        online = "online" in pm2
        uptime = pm2.split()[13] if online and len(pm2.split()) > 13 else "—"
        ip = self.cmd("hostname -I | awk '{print $1}'")
        temp = self.cmd("vcgencmd measure_temp 2>/dev/null | cut -d= -f2") or "N/A"
        mem = self.cmd("free -h | grep Mem | awk '{print $3}'") or "N/A"
        disk = self.cmd("df -h / | tail -1 | awk '{print $5}'") or "N/A"
        mp3s = len(glob.glob("/home/Axrid/Axrids-Website-Repository/uploads/*.mp3"))
        total = 51
        pct = int(mp3s / total * 100)
        running = bool(self.cmd("pgrep -f yt-dlp"))
        last = self.cmd("grep 'Destination:' /home/Axrid/download.log 2>/dev/null | tail -1 | sed 's/.*Destination: //'")
        dl_state = "Downloading..." if running else ("Complete!" if mp3s >= total else "Idle")
        clock = time.strftime("%H:%M:%S   %d %b %Y")
        return online, uptime, ip, temp, mem, disk, mp3s, total, pct, last, dl_state, clock

    def apply_data(self, data):
        online, uptime, ip, temp, mem, disk, mp3s, total, pct, last, dl_state, clock = data

        color = GREEN if online else RED
        status_text = "online" if online else "offline"

        # Only update if value changed to avoid flicker
        if self.dot.cget("fg") != color:
            self.dot.config(fg=color)
            self.status_lbl.config(text=status_text, fg=color)

        self._set(self.uptime_lbl, f"uptime: {uptime}")
        self._set(self.ip_lbl, f"http://{ip}:3000")
        self._set(self.temp_val, temp)
        self._set(self.mem_val, mem)
        self._set(self.disk_val, disk)
        self._set(self.prog_lbl, f"{mp3s} / {total} tracks  ({pct}%)")
        self._set(self.clock_lbl, clock)

        # Progress bar
        self.bar_canvas.update_idletasks()
        w = self.bar_canvas.winfo_width()
        self.bar_canvas.delete("all")
        self.bar_canvas.create_rectangle(0, 0, w, 12, fill="#222", outline="")
        fill_color = GREEN if pct >= 100 else BLUE
        self.bar_canvas.create_rectangle(0, 0, int(w * pct / 100), 12, fill=fill_color, outline="")

        dl_text = dl_state
        if last:
            dl_text += f"  —  {last[:50]}"
        self._set(self.dl_lbl, dl_text)

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
