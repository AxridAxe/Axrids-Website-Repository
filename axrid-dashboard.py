#!/usr/bin/env python3
import tkinter as tk
import subprocess
import glob
import threading
import time
import os

# ── Palette ───────────────────────────────────────────────────────────────────
BG      = "#080808"
CARD    = "#101010"
CARD2   = "#141414"
BORDER  = "#1e1e1e"
ACCENT  = "#ffffff"
DIM     = "#3a3a3a"
DIM2    = "#222222"
GREEN   = "#00e676"
RED     = "#ff1744"
BLUE    = "#2979ff"
YELLOW  = "#ffd600"
PURPLE  = "#d500f9"
TEAL    = "#00bcd4"
FG      = "#cccccc"

W = 680

def label(parent, text, size=9, bold=False, color=FG, anchor="w", bg=None, **kw):
    weight = "bold" if bold else "normal"
    bg = bg or parent.cget("bg")
    return tk.Label(parent, text=text, font=("Helvetica", size, weight),
                    bg=bg, fg=color, anchor=anchor, **kw)

class Bar(tk.Canvas):
    def __init__(self, parent, color=BLUE, **kw):
        super().__init__(parent, height=6, bg=parent.cget("bg"),
                         highlightthickness=0, **kw)
        self._color = color
        self._pct   = 0

    def set(self, pct):
        self._pct = max(0, min(100, pct))
        self._draw()

    def _draw(self):
        self.update_idletasks()
        w = self.winfo_width() or 200
        self.delete("all")
        self.create_rectangle(0, 0, w, 6, fill=DIM2, outline="")
        fill = self._color
        if self._pct > 80: fill = RED
        elif self._pct > 60: fill = YELLOW
        self.create_rectangle(0, 0, int(w * self._pct / 100), 6,
                              fill=fill, outline="")

class Section(tk.Frame):
    def __init__(self, parent, title, **kw):
        super().__init__(parent, bg=CARD, **kw)
        hdr = tk.Frame(self, bg=CARD2)
        hdr.pack(fill="x")
        label(hdr, f"  {title}", size=7, bold=True, color=DIM,
              bg=CARD2).pack(side="left", pady=6)
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        self.body = tk.Frame(self, bg=CARD)
        self.body.pack(fill="x", padx=14, pady=10)

class StatCard(tk.Frame):
    def __init__(self, parent, title, color=ACCENT, use_bar=False):
        super().__init__(parent, bg=CARD, padx=10, pady=8)
        label(self, title, size=6, bold=True, color=DIM).pack(anchor="w")
        self.val = tk.Label(self, text="—", font=("Helvetica", 14, "bold"),
                            bg=CARD, fg=color, anchor="w")
        self.val.pack(anchor="w", pady=(2, 0))
        self.bar = None
        if use_bar:
            self.bar = Bar(self, color=color)
            self.bar.pack(fill="x", pady=(4, 0))

    def set(self, text, pct=None):
        if self.val.cget("text") != text:
            self.val.config(text=text)
        if self.bar and pct is not None:
            self.bar.set(pct)

class Dashboard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Axrid Server")
        self.geometry(f"{W}x900")
        self.resizable(False, False)
        self.configure(bg=BG)
        self._build()
        self._schedule()

    # ── Build UI ──────────────────────────────────────────────────────────────
    def _build(self):
        # ── Header
        hdr = tk.Frame(self, bg=BG)
        hdr.pack(fill="x", padx=20, pady=(20, 0))
        tk.Label(hdr, text="AXRID", font=("Helvetica", 32, "bold"),
                 bg=BG, fg=ACCENT).pack(side="left")
        self.clock_lbl = tk.Label(hdr, text="", font=("Helvetica", 9),
                                  bg=BG, fg=DIM)
        self.clock_lbl.pack(side="right", anchor="s", pady=(0, 6))
        label(self, "S E R V E R  D A S H B O A R D", size=8,
              color=DIM, anchor="w").pack(padx=20)
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x", padx=20, pady=12)

        # ── Status + Controls row
        row0 = tk.Frame(self, bg=BG)
        row0.pack(fill="x", padx=20, pady=(0, 8))
        row0.columnconfigure(0, weight=1)
        row0.columnconfigure(1, weight=0)

        # Status card
        sc = tk.Frame(row0, bg=CARD)
        sc.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        inner = tk.Frame(sc, bg=CARD)
        inner.pack(fill="x", padx=14, pady=10)
        self.dot = tk.Label(inner, text="●", font=("Helvetica", 16),
                            bg=CARD, fg=GREEN)
        self.dot.pack(side="left")
        txt = tk.Frame(inner, bg=CARD)
        txt.pack(side="left", padx=8)
        self.status_lbl = tk.Label(txt, text="ONLINE", font=("Helvetica", 13, "bold"),
                                   bg=CARD, fg=GREEN)
        self.status_lbl.pack(anchor="w")
        self.uptime_lbl = tk.Label(txt, text="uptime: —", font=("Helvetica", 8),
                                   bg=CARD, fg=DIM)
        self.uptime_lbl.pack(anchor="w")

        # Controls
        ctrl = tk.Frame(row0, bg=BG)
        ctrl.grid(row=0, column=1, sticky="ns")
        tk.Button(ctrl, text="⟳  RESTART", font=("Helvetica", 8, "bold"),
                  bg=CARD, fg=YELLOW, activebackground=DIM2,
                  activeforeground=YELLOW, relief="flat", cursor="hand2",
                  command=self._restart, padx=14, pady=10,
                  bd=0).pack(fill="x", pady=(0, 4))
        tk.Button(ctrl, text="⇗  OPEN SITE", font=("Helvetica", 8, "bold"),
                  bg=CARD, fg=BLUE, activebackground=DIM2,
                  activeforeground=BLUE, relief="flat", cursor="hand2",
                  command=self._open_browser, padx=14, pady=10,
                  bd=0).pack(fill="x")

        # ── Addresses
        sec_addr = Section(self, "ADDRESS")
        sec_addr.pack(fill="x", padx=20, pady=(0, 8))
        ar = tk.Frame(sec_addr.body, bg=CARD)
        ar.pack(fill="x")
        self._addr_item(ar, "DOMAIN",    "axrid.com",  GREEN, 0)
        self._addr_item(ar, "LOCAL",     "...",         BLUE,  1)
        self._addr_item(ar, "PUBLIC IP", "...",         TEAL,  2)
        ar.columnconfigure(0, weight=1)
        ar.columnconfigure(1, weight=1)
        ar.columnconfigure(2, weight=1)

        # ── System stats
        sec_sys = Section(self, "SYSTEM")
        sec_sys.pack(fill="x", padx=20, pady=(0, 8))
        sr = sec_sys.body
        sr.columnconfigure(0, weight=1)
        sr.columnconfigure(1, weight=1)
        sr.columnconfigure(2, weight=1)
        sr.columnconfigure(3, weight=1)
        self.cpu_card  = StatCard(sr, "CPU",        BLUE,   use_bar=True)
        self.mem_card  = StatCard(sr, "MEMORY",     PURPLE, use_bar=True)
        self.disk_card = StatCard(sr, "DISK",       TEAL,   use_bar=True)
        self.temp_card = StatCard(sr, "TEMPERATURE",YELLOW)
        for i, c in enumerate([self.cpu_card, self.mem_card,
                                self.disk_card, self.temp_card]):
            c.grid(row=0, column=i, sticky="ew", padx=4)

        # ── Site stats
        sec_site = Section(self, "SITE")
        sec_site.pack(fill="x", padx=20, pady=(0, 8))
        wr = sec_site.body
        for i in range(5): wr.columnconfigure(i, weight=1)
        self.tracks_card   = StatCard(wr, "TRACKS",          ACCENT)
        self.users_card    = StatCard(wr, "USERS",           ACCENT)
        self.albums_card   = StatCard(wr, "ALBUMS",          ACCENT)
        self.visitors_card = StatCard(wr, "VISITORS TODAY",  GREEN)
        self.requests_card = StatCard(wr, "REQUESTS TODAY",  GREEN)
        for i, c in enumerate([self.tracks_card, self.users_card,
                                self.albums_card, self.visitors_card,
                                self.requests_card]):
            c.grid(row=0, column=i, sticky="ew", padx=4)

        # ── Traffic stats
        sec_traffic = Section(self, "TRAFFIC")
        sec_traffic.pack(fill="x", padx=20, pady=(0, 8))
        tr = sec_traffic.body
        tr.columnconfigure(0, weight=1)
        tr.columnconfigure(1, weight=1)
        tr.columnconfigure(2, weight=1)
        self.bw_card     = StatCard(tr, "BANDWIDTH TODAY", BLUE)
        self.conns_card  = StatCard(tr, "ACTIVE CONNECTIONS", TEAL)
        self.top_card    = StatCard(tr, "TOP TRACK TODAY", PURPLE)
        for i, c in enumerate([self.bw_card, self.conns_card, self.top_card]):
            c.grid(row=0, column=i, sticky="ew", padx=4)

        # ── Last deploy
        sec_deploy = Section(self, "LAST DEPLOY")
        sec_deploy.pack(fill="x", padx=20, pady=(0, 8))
        self.deploy_lbl = tk.Label(sec_deploy.body, text="—",
                                   font=("Helvetica", 8), bg=CARD,
                                   fg=FG, anchor="w", wraplength=W-60)
        self.deploy_lbl.pack(anchor="w")
        self.deploy_time = tk.Label(sec_deploy.body, text="",
                                    font=("Helvetica", 7), bg=CARD,
                                    fg=DIM, anchor="w")
        self.deploy_time.pack(anchor="w", pady=(2, 0))

        # ── Recent activity
        sec_act = Section(self, "RECENT ACTIVITY")
        sec_act.pack(fill="x", padx=20, pady=(0, 8))
        self.act_labels = []
        for _ in range(5):
            lbl = tk.Label(sec_act.body, text="", font=("Courier", 8),
                           bg=CARD, fg=DIM, anchor="w",
                           wraplength=W-60, justify="left")
            lbl.pack(fill="x", pady=1)
            self.act_labels.append(lbl)

        # ── Footer
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x", padx=20, pady=6)
        label(self, "  axrid.com  ·  Raspberry Pi  ·  self-hosted",
              size=7, color=DIM, anchor="center").pack(pady=(0, 10))

    def _addr_item(self, parent, label_text, value, color, col):
        f = tk.Frame(parent, bg=CARD)
        f.grid(row=0, column=col, sticky="ew", padx=4)
        tk.Label(f, text=label_text, font=("Helvetica", 6, "bold"),
                 bg=CARD, fg=DIM).pack(anchor="w")
        lbl = tk.Label(f, text=value, font=("Helvetica", 11, "bold"),
                       bg=CARD, fg=color)
        lbl.pack(anchor="w")
        if label_text == "LOCAL":     self.local_lbl  = lbl
        if label_text == "PUBLIC IP": self.public_lbl = lbl

    # ── Commands ──────────────────────────────────────────────────────────────
    def _cmd(self, c):
        try:
            return subprocess.check_output(
                c, shell=True, stderr=subprocess.DEVNULL, text=True).strip()
        except:
            return ""

    def _restart(self):
        self._cmd("pm2 restart axrid-website")

    def _open_browser(self):
        self._cmd("xdg-open https://axrid.com")

    # ── Data fetch ────────────────────────────────────────────────────────────
    def _fetch(self):
        # Server
        pm2     = self._cmd("pm2 list 2>/dev/null | grep axrid-website")
        online  = "online" in pm2
        parts   = pm2.split()
        uptime  = parts[13] if online and len(parts) > 13 else "—"

        # Addresses
        local_ip  = self._cmd("hostname -I | awk '{print $1}'")
        public_ip = self._cmd("curl -s --max-time 4 ifconfig.me")

        # System
        cpu_raw  = self._cmd("top -bn1 | grep 'Cpu(s)'")
        try:
            cpu_pct = float(cpu_raw.split()[1].replace(",", ".")) + \
                      float(cpu_raw.split()[3].replace(",", "."))
        except:
            cpu_pct = 0.0

        mem_out  = self._cmd("free | grep Mem")
        try:
            m = mem_out.split()
            mem_used = int(m[2]); mem_total = int(m[1])
            mem_pct  = int(mem_used / mem_total * 100)
            def _fmt(kb):
                return f"{kb/1024/1024:.1f}G" if kb > 1024*1024 \
                       else f"{kb/1024:.0f}M"
            mem_str = f"{_fmt(mem_used)} / {_fmt(mem_total)}"
        except:
            mem_pct = 0; mem_str = "N/A"

        disk_out = self._cmd("df / | tail -1")
        try:
            d = disk_out.split()
            disk_pct = int(d[4].replace("%", ""))
            disk_str = f"{d[4]}  ({d[2]} / {d[1]})"
            # convert to GB
            def _gb(kb): return f"{int(kb)//1024//1024}G"
            disk_str = f"{d[4]}  ({_gb(d[2])} / {_gb(d[1])})"
        except:
            disk_pct = 0; disk_str = "N/A"

        temp = self._cmd("vcgencmd measure_temp 2>/dev/null | cut -d= -f2") or "N/A"

        # DB stats
        db = "/home/Axrid/Axrids-Website-Repository/database.sqlite"
        tracks_n = self._cmd(f'sqlite3 {db} "SELECT COUNT(*) FROM tracks;"')
        users_n  = self._cmd(f'sqlite3 {db} "SELECT COUNT(*) FROM users;"')
        albums_n = self._cmd(f'sqlite3 {db} "SELECT COUNT(*) FROM albums;"')

        # Traffic
        today = time.strftime("%d/%b/%Y")
        log   = "/var/log/nginx/access.log"
        requests_n  = self._cmd(f"grep '{today}' {log} 2>/dev/null | wc -l")
        unique_ips  = self._cmd(
            f"grep '{today}' {log} 2>/dev/null | awk '{{print $1}}' | sort -u | wc -l")
        bw_bytes    = self._cmd(
            f"grep '{today}' {log} 2>/dev/null | awk '{{sum+=$10}} END{{print sum}}'")
        try:
            bw = int(bw_bytes or 0)
            if bw > 1_000_000_000: bw_str = f"{bw/1e9:.1f} GB"
            elif bw > 1_000_000:   bw_str = f"{bw/1e6:.1f} MB"
            else:                  bw_str = f"{bw/1e3:.0f} KB"
        except:
            bw_str = "N/A"

        conns = self._cmd("ss -tn state established '( dport = :80 or dport = :3000 )' | wc -l")
        try: conns = str(max(0, int(conns) - 1))
        except: conns = "0"

        top_track = self._cmd(
            f"grep '{today}' {log} 2>/dev/null | grep 'uploads.*\\.mp3' | "
            f"awk '{{print $7}}' | sort | uniq -c | sort -rn | head -1 | "
            f"awk '{{print $2}}' | sed 's|/uploads/||' | sed 's|\\.mp3||'")

        # Last deploy
        deploy_msg  = self._cmd(
            "git -C /home/Axrid/Axrids-Website-Repository log -1 --pretty='%s'")
        deploy_time = self._cmd(
            "git -C /home/Axrid/Axrids-Website-Repository log -1 --pretty='%cr  ·  %cd' --date=short")

        # Recent activity
        recent_raw = self._cmd(f"tail -5 {log} 2>/dev/null")
        recent = []
        for line in recent_raw.splitlines():
            try:
                ts  = line.split('[')[1].split(']')[0][:17]
                req = line.split('"')[1]
                st  = line.split('"')[2].strip().split()[0]
                col = GREEN if st.startswith("2") else \
                      YELLOW if st.startswith("3") else RED
                recent.append((f"{ts}   {req}   [{st}]", col))
            except:
                pass

        clock = time.strftime("%H:%M:%S   %d %b %Y")
        return dict(
            online=online, uptime=uptime,
            local_ip=local_ip, public_ip=public_ip,
            cpu_pct=cpu_pct, mem_pct=mem_pct, mem_str=mem_str,
            disk_pct=disk_pct, disk_str=disk_str, temp=temp,
            tracks_n=tracks_n, users_n=users_n, albums_n=albums_n,
            requests_n=requests_n, unique_ips=unique_ips,
            bw_str=bw_str, conns=conns, top_track=top_track or "—",
            deploy_msg=deploy_msg, deploy_time=deploy_time,
            recent=recent, clock=clock,
        )

    # ── Apply data ────────────────────────────────────────────────────────────
    def _apply(self, d):
        col = GREEN if d["online"] else RED
        txt = "ONLINE" if d["online"] else "OFFLINE"
        if self.dot.cget("fg") != col:
            self.dot.config(fg=col)
            self.status_lbl.config(text=txt, fg=col)
        self._set(self.uptime_lbl, f"uptime: {d['uptime']}")
        self._set(self.clock_lbl,  d["clock"])

        self._set(self.local_lbl,  f"http://{d['local_ip']}:3000")
        self._set(self.public_lbl, d["public_ip"] or "—")

        self.cpu_card.set(f"{d['cpu_pct']:.1f}%",  d["cpu_pct"])
        self.mem_card.set(d["mem_str"],              d["mem_pct"])
        self.disk_card.set(d["disk_str"],            d["disk_pct"])
        self.temp_card.set(d["temp"])

        self.tracks_card.set(d["tracks_n"])
        self.users_card.set(d["users_n"])
        self.albums_card.set(d["albums_n"])
        self.visitors_card.set(d["unique_ips"])
        self.requests_card.set(d["requests_n"])

        self.bw_card.set(d["bw_str"])
        self.conns_card.set(d["conns"])
        self.top_card.set(d["top_track"][:18] if d["top_track"] else "—")

        self._set(self.deploy_lbl,  d["deploy_msg"] or "—")
        self._set(self.deploy_time, d["deploy_time"] or "")

        for i, lbl in enumerate(self.act_labels):
            if i < len(d["recent"]):
                text, col = d["recent"][i]
                if lbl.cget("text") != text:
                    lbl.config(text=text, fg=col)
            else:
                if lbl.cget("text"): lbl.config(text="")

    def _set(self, w, v):
        if w.cget("text") != v:
            w.config(text=v)

    # ── Scheduler ─────────────────────────────────────────────────────────────
    def _schedule(self):
        def run():
            data = self._fetch()
            self.after(0, lambda: self._apply(data))
        threading.Thread(target=run, daemon=True).start()
        self.after(5000, self._schedule)

if __name__ == "__main__":
    app = Dashboard()
    app.mainloop()
