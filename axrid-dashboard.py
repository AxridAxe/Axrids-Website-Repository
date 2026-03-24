#!/usr/bin/env python3
import tkinter as tk
import subprocess, glob, threading, time, os, signal, collections, urllib.request, urllib.parse, json

# ── Palette ───────────────────────────────────────────────────────────────────
BG     = "#080808"
CARD   = "#0e0e0e"
CARD2  = "#131313"
BORDER = "#1a1a1a"
ACCENT = "#ffffff"
DIM    = "#333333"
DIM2   = "#1c1c1c"
FG     = "#aaaaaa"
GREEN  = "#00e676"
RED    = "#ff1744"
BLUE   = "#2979ff"
YELLOW = "#ffd600"
PURPLE = "#d500f9"
TEAL   = "#00bcd4"
ORANGE = "#ff6d00"

FONT   = "Helvetica"

# ── Helpers ───────────────────────────────────────────────────────────────────
def lbl(parent, text="", size=9, bold=False, color=FG, anchor="w", bg=None, **kw):
    w = "bold" if bold else "normal"
    return tk.Label(parent, text=text, font=(FONT, size, w),
                    bg=bg if bg is not None else parent.cget("bg"),
                    fg=color, anchor=anchor, **kw)

def sep(parent, pad=0):
    tk.Frame(parent, bg=BORDER, height=1).pack(fill="x", padx=pad, pady=4)

class Card(tk.Frame):
    def __init__(self, parent, title=None, accent=None, **kw):
        super().__init__(parent, bg=CARD, **kw)
        if title:
            hdr = tk.Frame(self, bg=CARD2)
            hdr.pack(fill="x")
            if accent:
                tk.Frame(hdr, bg=accent, width=3).pack(side="left", fill="y")
            lbl(hdr, f"  {title}", size=11, bold=True, color=DIM,
                bg=CARD2).pack(side="left", pady=7)
            tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        self.body = tk.Frame(self, bg=CARD)
        self.body.pack(fill="both", expand=True, padx=12, pady=10)

class StatRow(tk.Frame):
    """Label + value + optional bar on one row."""
    def __init__(self, parent, title, color=FG, bar=False):
        super().__init__(parent, bg=CARD)
        lbl(self, title, size=11, bold=True, color=DIM).pack(anchor="w")
        self.val = tk.Label(self, text="—", font=(FONT, 19, "bold"),
                            bg=CARD, fg=color, anchor="w")
        self.val.pack(anchor="w")
        self.bar = None
        if bar:
            c = tk.Canvas(self, height=4, bg=CARD, highlightthickness=0)
            c.pack(fill="x", pady=(3, 0))
            self.bar = c
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x", pady=6)

    def set(self, text, pct=None, color=None):
        if color and self.val.cget("fg") != color:
            self.val.config(fg=color)
        if self.val.cget("text") != text:
            self.val.config(text=text)
        if self.bar and pct is not None:
            self.bar.update_idletasks()
            w = self.bar.winfo_width()
            self.bar.delete("all")
            self.bar.create_rectangle(0, 0, w, 4, fill=DIM2, outline="")
            fc = RED if pct > 80 else YELLOW if pct > 60 else \
                 self.val.cget("fg")
            self.bar.create_rectangle(0, 0, int(w * pct / 100), 4,
                                      fill=fc, outline="")

class Sparkline(tk.Canvas):
    def __init__(self, parent, color=BLUE, maxpts=60, **kw):
        super().__init__(parent, bg=CARD, highlightthickness=0,
                         height=50, **kw)
        self._color  = color
        self._maxpts = maxpts
        self._data   = collections.deque([0] * maxpts, maxlen=maxpts)

    def push(self, val):
        self._data.append(val)
        self._draw()

    def _draw(self):
        self.update_idletasks()
        w = self.winfo_width() or 200
        h = self.winfo_height() or 50
        self.delete("all")
        self.create_rectangle(0, 0, w, h, fill=CARD, outline="")
        mx = max(self._data) or 1
        pts = list(self._data)
        n   = len(pts)
        coords = []
        for i, v in enumerate(pts):
            x = int(i * w / (n - 1)) if n > 1 else 0
            y = h - int(v / mx * (h - 4)) - 2
            coords += [x, y]
        if len(coords) >= 4:
            self.create_line(*coords, fill=self._color, width=2, smooth=True)
        # fill under line
        poly = [0, h] + coords + [w, h]
        self.create_polygon(*poly, fill=self._color, stipple="gray25",
                            outline="")

# ── Settings Overlay ──────────────────────────────────────────────────────────
class SettingsOverlay(tk.Toplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.overrideredirect(True)
        sw = parent.winfo_screenwidth()
        sh = parent.winfo_screenheight()
        self.geometry(f"{sw}x{sh}+0+0")
        self.configure(bg=BG)
        self.lift()
        self.focus_force()
        self._session_cookie = None
        self._build()

    def _build(self):
        # Full-screen dark overlay
        outer = tk.Frame(self, bg=BG)
        outer.place(relx=0.5, rely=0.5, anchor="center")

        # Close button top-right
        tk.Button(self, text="✕", font=(FONT, 14), bg=BG, fg=DIM,
                  activebackground=BG, activeforeground=ACCENT,
                  relief="flat", cursor="hand2", bd=0,
                  command=self.destroy).place(relx=1.0, rely=0.0,
                                              anchor="ne", x=-20, y=20)

        # Card
        card = tk.Frame(outer, bg=CARD, padx=40, pady=40)
        card.pack()

        tk.Label(card, text="SERVER SETTINGS", font=(FONT, 11, "bold"),
                 bg=CARD, fg=DIM).pack(anchor="w", pady=(0, 4))
        tk.Label(card, text="Sign in with your Axrid account",
                 font=(FONT, 9), bg=CARD, fg=DIM).pack(anchor="w", pady=(0, 20))

        # Email
        tk.Label(card, text="EMAIL", font=(FONT, 8, "bold"),
                 bg=CARD, fg=DIM).pack(anchor="w")
        self.email_var = tk.StringVar()
        email_entry = tk.Entry(card, textvariable=self.email_var,
                               font=(FONT, 11), bg=CARD2, fg=ACCENT,
                               insertbackground=ACCENT, relief="flat",
                               width=28, bd=4)
        email_entry.pack(anchor="w", pady=(2, 12))
        email_entry.focus_set()

        # Password
        tk.Label(card, text="PASSWORD", font=(FONT, 8, "bold"),
                 bg=CARD, fg=DIM).pack(anchor="w")
        self.pass_var = tk.StringVar()
        tk.Entry(card, textvariable=self.pass_var, show="•",
                 font=(FONT, 11), bg=CARD2, fg=ACCENT,
                 insertbackground=ACCENT, relief="flat",
                 width=28, bd=4).pack(anchor="w", pady=(2, 16))

        self.error_lbl = tk.Label(card, text="", font=(FONT, 9),
                                  bg=CARD, fg=RED)
        self.error_lbl.pack(anchor="w", pady=(0, 8))

        tk.Button(card, text="SIGN IN", font=(FONT, 10, "bold"),
                  bg=ACCENT, fg="#000000", activebackground=FG,
                  relief="flat", cursor="hand2", padx=20, pady=8, bd=0,
                  command=self._login).pack(anchor="w")

    def _login(self):
        email = self.email_var.get().strip()
        pw    = self.pass_var.get()
        if not email or not pw:
            self.error_lbl.config(text="Enter email and password.")
            return
        self.error_lbl.config(text="Signing in…")
        threading.Thread(target=self._do_login, args=(email, pw), daemon=True).start()

    def _do_login(self, email, pw):
        try:
            data = urllib.parse.urlencode({"email": email, "password": pw}).encode()
            req  = urllib.request.Request(
                "http://localhost:3000/api/auth/login",
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = json.loads(resp.read())
                cookie = resp.headers.get("Set-Cookie", "")
            if body.get("user", {}).get("role") == "admin":
                self._session_cookie = cookie
                self.after(0, self._show_settings)
            else:
                self.after(0, lambda: self.error_lbl.config(text="Admin access required."))
        except Exception as e:
            msg = "Invalid email or password."
            self.after(0, lambda: self.error_lbl.config(text=msg))

    def _show_settings(self):
        for w in self.winfo_children():
            w.destroy()

        tk.Button(self, text="✕", font=(FONT, 14), bg=BG, fg=DIM,
                  activebackground=BG, activeforeground=ACCENT,
                  relief="flat", cursor="hand2", bd=0,
                  command=self.destroy).place(relx=1.0, rely=0.0,
                                              anchor="ne", x=-20, y=20)

        outer = tk.Frame(self, bg=BG)
        outer.place(relx=0.5, rely=0.5, anchor="center")

        tk.Label(outer, text="SERVER SETTINGS", font=(FONT, 13, "bold"),
                 bg=BG, fg=ACCENT).pack(anchor="w", pady=(0, 20))

        def _action_btn(label, color, cmd):
            tk.Button(outer, text=label, font=(FONT, 10, "bold"),
                      bg=CARD, fg=color, activebackground=CARD2,
                      activeforeground=color, relief="flat", cursor="hand2",
                      padx=20, pady=10, bd=0, width=28,
                      command=cmd).pack(pady=4, anchor="w")

        self._status_lbl = tk.Label(outer, text="", font=(FONT, 9),
                                    bg=BG, fg=GREEN)
        self._status_lbl.pack(anchor="w", pady=(0, 10))

        _action_btn("⟳  Restart Website Server", YELLOW, self._restart_server)
        _action_btn("⏹  Stop Website Server",    RED,    self._stop_server)
        _action_btn("▶  Start Website Server",   GREEN,  self._start_server)
        _action_btn("⟳  Reboot Raspberry Pi",    ORANGE, self._reboot_pi)

    def _run(self, cmd, msg):
        def go():
            subprocess.run(cmd, shell=True, stderr=subprocess.DEVNULL)
            self.after(0, lambda: self._status_lbl.config(text=msg))
        threading.Thread(target=go, daemon=True).start()

    def _restart_server(self): self._run("pm2 restart axrid-website", "✓ Server restarted")
    def _stop_server(self):    self._run("pm2 stop axrid-website",    "✓ Server stopped")
    def _start_server(self):   self._run("pm2 start axrid-website",   "✓ Server started")
    def _reboot_pi(self):      self._run("sudo reboot",               "Rebooting…")


# ── Main App ──────────────────────────────────────────────────────────────────
class Dashboard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Axrid Server Dashboard")
        self.configure(bg=BG)
        self.overrideredirect(True)
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        self.geometry(f"{sw}x{sh}+0+0")
        signal.signal(signal.SIGUSR1, lambda s, f: self.after(0, self._show))

        self._req_history  = collections.deque([0]*60, maxlen=60)
        self._last_req_cnt = 0
        self._tick         = 0

        self._build()
        self._fast_tick()   # every 1s
        self._slow_tick()   # every 5s

    # ── Build ─────────────────────────────────────────────────────────────────
    def _build(self):
        # ── Top bar
        topbar = tk.Frame(self, bg=CARD2)
        topbar.pack(fill="x")
        tk.Frame(topbar, bg=BLUE, width=4).pack(side="left", fill="y")
        tk.Label(topbar, text="AXRID", font=(FONT, 20, "bold"),
                 bg=CARD2, fg=ACCENT).pack(side="left", padx=(10, 4), pady=8)
        tk.Label(topbar, text="SERVER DASHBOARD", font=(FONT, 12),
                 bg=CARD2, fg=DIM).pack(side="left", pady=8)

        # Status
        sf = tk.Frame(topbar, bg=CARD2)
        sf.pack(side="left", padx=20)
        self.dot = tk.Label(sf, text="●", font=(FONT, 12), bg=CARD2, fg=GREEN)
        self.dot.pack(side="left")
        self.status_lbl = tk.Label(sf, text="ONLINE", font=(FONT, 10, "bold"),
                                   bg=CARD2, fg=GREEN)
        self.status_lbl.pack(side="left", padx=4)
        self.uptime_lbl = tk.Label(sf, text="", font=(FONT, 9),
                                   bg=CARD2, fg=DIM)
        self.uptime_lbl.pack(side="left")

        # Right side of topbar
        self.clock_lbl = tk.Label(topbar, text="", font=(FONT, 11, "bold"),
                                  bg=CARD2, fg=FG)
        self.clock_lbl.pack(side="right", padx=12)
        tk.Button(topbar, text="⊟", font=(FONT, 12), bg=CARD2, fg=DIM,
                  activebackground=CARD2, activeforeground=ACCENT,
                  relief="flat", cursor="hand2", bd=0,
                  command=self._hide).pack(side="right", padx=4)
        tk.Button(topbar, text="⚙", font=(FONT, 12), bg=CARD2, fg=DIM,
                  activebackground=CARD2, activeforeground=ACCENT,
                  relief="flat", cursor="hand2", bd=0,
                  command=self._open_settings).pack(side="right", padx=4)
        tk.Frame(topbar, bg=BORDER, width=1).pack(side="right", fill="y",
                                                   pady=4)

        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")

        # ── 3-column body
        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True, padx=10, pady=8)
        body.columnconfigure(0, weight=1)
        body.columnconfigure(1, weight=2)
        body.columnconfigure(2, weight=1)
        body.rowconfigure(0, weight=1)

        self._build_left(body)
        self._build_center(body)
        self._build_right(body)

        # ── Bottom bar — live log
        self._build_log()

        # ── Footer
        foot = tk.Frame(self, bg=CARD2)
        foot.pack(fill="x")
        tk.Frame(foot, bg=BORDER, height=1).pack(fill="x")
        inner = tk.Frame(foot, bg=CARD2)
        inner.pack(fill="x", padx=12, pady=6)
        self.deploy_lbl = tk.Label(inner, text="", font=(FONT, 9),
                                   bg=CARD2, fg=DIM, anchor="w")
        self.deploy_lbl.pack(side="left")
        for txt, col, cmd in [
            ("⟳ RESTART", YELLOW, self._restart),
            ("⇗ OPEN SITE", BLUE,  self._open_browser),
        ]:
            tk.Button(inner, text=txt, font=(FONT, 9, "bold"),
                      bg=DIM2, fg=col, activebackground=BORDER,
                      activeforeground=col, relief="flat",
                      cursor="hand2", command=cmd,
                      padx=10, pady=4, bd=0).pack(side="right", padx=4)

    def _build_left(self, parent):
        col = tk.Frame(parent, bg=BG)
        col.grid(row=0, column=0, sticky="nsew", padx=(0, 6))

        # Address card
        c = Card(col, "ADDRESS", accent=TEAL)
        c.pack(fill="x", pady=(0, 6))
        lbl(c.body, "DOMAIN", size=8, bold=True, color=DIM).pack(anchor="w")
        self.domain_lbl = tk.Label(c.body, text="axrid.com",
                                   font=(FONT, 15, "bold"), bg=CARD, fg=GREEN)
        self.domain_lbl.pack(anchor="w", pady=(0, 6))
        lbl(c.body, "LOCAL", size=8, bold=True, color=DIM).pack(anchor="w")
        self.local_lbl = tk.Label(c.body, text="—",
                                  font=(FONT, 11), bg=CARD, fg=BLUE)
        self.local_lbl.pack(anchor="w", pady=(0, 6))
        lbl(c.body, "PUBLIC IP", size=8, bold=True, color=DIM).pack(anchor="w")
        self.public_lbl = tk.Label(c.body, text="—",
                                   font=(FONT, 11), bg=CARD, fg=TEAL)
        self.public_lbl.pack(anchor="w")

        # System card
        c2 = Card(col, "SYSTEM", accent=PURPLE)
        c2.pack(fill="x", pady=(0, 6))
        self.cpu_row  = StatRow(c2.body, "CPU",         BLUE,   bar=True)
        self.cpu_row.pack(fill="x")
        self.mem_row  = StatRow(c2.body, "MEMORY",      PURPLE, bar=True)
        self.mem_row.pack(fill="x")
        self.disk_row = StatRow(c2.body, "DISK",        TEAL,   bar=True)
        self.disk_row.pack(fill="x")
        self.temp_row = StatRow(c2.body, "TEMPERATURE", YELLOW)
        self.temp_row.pack(fill="x")

    def _build_center(self, parent):
        col = tk.Frame(parent, bg=BG)
        col.grid(row=0, column=1, sticky="nsew", padx=6)

        # Live traffic
        ct = Card(col, "LIVE TRAFFIC", accent=GREEN)
        ct.pack(fill="x", pady=(0, 6))

        nums = tk.Frame(ct.body, bg=CARD)
        nums.pack(fill="x")
        for i in range(4): nums.columnconfigure(i, weight=1)

        def _num(parent, title, color, col):
            f = tk.Frame(parent, bg=CARD)
            f.grid(row=0, column=col, sticky="ew", padx=4)
            lbl(f, title, size=10, bold=True, color=DIM).pack(anchor="w")
            v = tk.Label(f, text="—", font=(FONT, 24, "bold"),
                         bg=CARD, fg=color)
            v.pack(anchor="w")
            return v

        self.rps_lbl      = _num(nums, "REQ / MIN",        GREEN,  0)
        self.visitors_lbl = _num(nums, "VISITORS TODAY",   BLUE,   1)
        self.requests_lbl = _num(nums, "REQUESTS TODAY",   FG,     2)
        self.conns_lbl    = _num(nums, "ACTIVE CONNS",     TEAL,   3)

        # Sparkline
        tk.Frame(ct.body, bg=BORDER, height=1).pack(fill="x", pady=6)
        lbl(ct.body, "REQUESTS PER MINUTE", size=10, bold=True,
            color=DIM).pack(anchor="w")
        self.spark = Sparkline(ct.body, color=GREEN)
        self.spark.pack(fill="x", pady=(4, 0))

        # Bandwidth + top track
        cb = Card(col, "TRANSFER & TOP TRACK", accent=ORANGE)
        cb.pack(fill="x", pady=(0, 6))
        br = tk.Frame(cb.body, bg=CARD)
        br.pack(fill="x")
        br.columnconfigure(0, weight=1)
        br.columnconfigure(1, weight=2)

        bwf = tk.Frame(br, bg=CARD)
        bwf.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        lbl(bwf, "BANDWIDTH TODAY", size=8, bold=True, color=DIM).pack(anchor="w")
        self.bw_lbl = tk.Label(bwf, text="—", font=(FONT, 17, "bold"),
                               bg=CARD, fg=ORANGE)
        self.bw_lbl.pack(anchor="w")

        ttf = tk.Frame(br, bg=CARD)
        ttf.grid(row=0, column=1, sticky="ew")
        lbl(ttf, "TOP TRACK TODAY", size=8, bold=True, color=DIM).pack(anchor="w")
        self.top_lbl = tk.Label(ttf, text="—", font=(FONT, 12, "bold"),
                                bg=CARD, fg=FG, wraplength=220, justify="left")
        self.top_lbl.pack(anchor="w")

        # Recent deploys
        cd = Card(col, "RECENT DEPLOYS", accent=DIM)
        cd.pack(fill="x")
        self.deploy_rows = []
        for _ in range(5):
            rf = tk.Frame(cd.body, bg=CARD)
            rf.pack(fill="x", pady=1)
            hash_lbl = tk.Label(rf, text="", font=("Courier", 9),
                                bg=CARD, fg=DIM, width=7, anchor="w")
            hash_lbl.pack(side="left")
            msg_lbl = tk.Label(rf, text="", font=(FONT, 10),
                               bg=CARD, fg=FG, anchor="w")
            msg_lbl.pack(side="left", fill="x", expand=True)
            time_lbl = tk.Label(rf, text="", font=("Courier", 9),
                                bg=CARD, fg=DIM, anchor="e")
            time_lbl.pack(side="right")
            self.deploy_rows.append((rf, hash_lbl, msg_lbl, time_lbl))

    def _build_right(self, parent):
        col = tk.Frame(parent, bg=BG)
        col.grid(row=0, column=2, sticky="nsew", padx=(6, 0))

        # Site content
        cs = Card(col, "SITE CONTENT", accent=BLUE)
        cs.pack(fill="x", pady=(0, 6))

        def _item(title, color):
            f = tk.Frame(cs.body, bg=CARD)
            f.pack(fill="x", pady=3)
            lbl(f, title, size=11, bold=True, color=DIM).pack(side="left")
            v = tk.Label(f, text="—", font=(FONT, 17, "bold"),
                         bg=CARD, fg=color)
            v.pack(side="right")
            tk.Frame(cs.body, bg=BORDER, height=1).pack(fill="x")
            return v

        self.tracks_lbl  = _item("TRACKS",  ACCENT)
        self.users_lbl   = _item("USERS",   ACCENT)
        self.albums_lbl  = _item("ALBUMS",  ACCENT)
        self.posts_lbl   = _item("POSTS",   ACCENT)

        # Quick stats
        cq = Card(col, "TODAY AT A GLANCE", accent=YELLOW)
        cq.pack(fill="x", pady=(0, 6))

        def _qitem(title, color):
            f = tk.Frame(cq.body, bg=CARD)
            f.pack(fill="x", pady=3)
            lbl(f, title, size=11, bold=True, color=DIM).pack(side="left")
            v = tk.Label(f, text="—", font=(FONT, 17, "bold"),
                         bg=CARD, fg=color)
            v.pack(side="right")
            tk.Frame(cq.body, bg=BORDER, height=1).pack(fill="x")
            return v

        self.unique_lbl  = _qitem("UNIQUE VISITORS", GREEN)
        self.mp3_lbl     = _qitem("TRACK PLAYS",     BLUE)
        self.errors_lbl  = _qitem("ERRORS (4xx/5xx)", RED)

    def _build_log(self):
        cl = Card(self, "LIVE ACTIVITY LOG", accent=DIM)
        cl.pack(fill="x", padx=10, pady=(0, 6))
        self.log_labels = []
        for _ in range(5):
            lf = tk.Frame(cl.body, bg=CARD)
            lf.pack(fill="x", pady=1)
            dot = tk.Label(lf, text="●", font=(FONT, 9),
                           bg=CARD, fg=DIM)
            dot.pack(side="left", padx=(0, 6))
            txt = tk.Label(lf, text="", font=("Courier", 10),
                           bg=CARD, fg=DIM, anchor="w")
            txt.pack(side="left", fill="x")
            self.log_labels.append((dot, txt))

    # ── Commands ──────────────────────────────────────────────────────────────
    def _cmd(self, c):
        try:
            return subprocess.check_output(
                c, shell=True, stderr=subprocess.DEVNULL, text=True).strip()
        except: return ""

    def _restart(self):     self._cmd("pm2 restart axrid-website")
    def _open_browser(self): self._cmd("DISPLAY=:0 chromium-browser --new-window https://axrid.com &")
    def _hide(self):        self.withdraw()
    def _show(self):
        sw = self.winfo_screenwidth(); sh = self.winfo_screenheight()
        self.geometry(f"{sw}x{sh}+0+0")
        self.deiconify(); self.lift()

    def _open_settings(self):
        SettingsOverlay(self)

    def _s(self, w, v):
        if w.cget("text") != v: w.config(text=v)

    # ── Fast tick (1s) — clock, CPU, connections ──────────────────────────────
    def _fast_tick(self):
        def run():
            clock = time.strftime("%H:%M:%S   %d %b %Y")
            cpu_raw = self._cmd("top -bn1 | grep 'Cpu(s)'")
            try:
                cpu_pct = float(cpu_raw.split()[1].replace(",",".")) + \
                          float(cpu_raw.split()[3].replace(",","."))
            except: cpu_pct = 0.0
            conns = self._cmd(
                "ss -tn state established '( dport = :80 or dport = :3000 )' | wc -l")
            try: conns = str(max(0, int(conns)-1))
            except: conns = "0"

            # req/min from log tail
            log = "/var/log/nginx/access.log"
            total_today = self._cmd(
                f"grep \"{time.strftime('%d/%b/%Y')}\" {log} 2>/dev/null | wc -l")
            try: total_today = int(total_today)
            except: total_today = self._last_req_cnt
            delta = max(0, total_today - self._last_req_cnt)
            self._last_req_cnt = total_today
            self._req_history.append(delta)
            rpm = sum(list(self._req_history)[-60:])

            self.after(0, lambda: self._apply_fast(
                clock, cpu_pct, conns, rpm))
        threading.Thread(target=run, daemon=True).start()
        self.after(1000, self._fast_tick)

    def _apply_fast(self, clock, cpu_pct, conns, rpm):
        self._s(self.clock_lbl, clock)
        self.cpu_row.set(f"{cpu_pct:.1f}%", cpu_pct)
        self._s(self.conns_lbl, conns)
        self._s(self.rps_lbl, str(rpm))
        self.spark.push(rpm)

    # ── Slow tick (5s) — everything else ─────────────────────────────────────
    def _slow_tick(self):
        def run():
            pm2    = self._cmd("pm2 list 2>/dev/null | grep axrid-website")
            online = "online" in pm2
            parts  = pm2.split()
            uptime = parts[13] if online and len(parts) > 13 else "—"

            local  = self._cmd("hostname -I | awk '{print $1}'")
            public = self._cmd("curl -s --max-time 3 ifconfig.me")
            temp   = self._cmd("vcgencmd measure_temp 2>/dev/null | cut -d= -f2") or "N/A"

            mem_out = self._cmd("free | grep Mem")
            try:
                m = mem_out.split()
                mu, mt = int(m[2]), int(m[1])
                mp = int(mu/mt*100)
                def fmt(kb): return f"{kb/1024/1024:.1f}G" if kb>1048576 else f"{kb/1024:.0f}M"
                mem_str = f"{fmt(mu)} / {fmt(mt)}"
            except: mp=0; mem_str="N/A"

            disk_out = self._cmd("df / | tail -1")
            try:
                d = disk_out.split()
                dp = int(d[4].replace("%",""))
                def gb(kb): return f"{int(kb)//1024//1024}G"
                disk_str = f"{d[4]}  {gb(d[2])} / {gb(d[1])}"
            except: dp=0; disk_str="N/A"

            db = "/home/Axrid/Axrids-Website-Repository/database.sqlite"
            tracks = self._cmd(f'sqlite3 {db} "SELECT COUNT(*) FROM tracks;"')
            users  = self._cmd(f'sqlite3 {db} "SELECT COUNT(*) FROM users;"')
            albums = self._cmd(f'sqlite3 {db} "SELECT COUNT(*) FROM albums;"')
            posts  = self._cmd(f'sqlite3 {db} "SELECT COUNT(*) FROM posts;"')

            today = time.strftime("%d/%b/%Y")
            log   = "/var/log/nginx/access.log"
            total_req  = self._cmd(f"grep '{today}' {log} 2>/dev/null | wc -l")
            unique     = self._cmd(f"grep '{today}' {log} 2>/dev/null | awk '{{print $1}}' | sort -u | wc -l")
            mp3_plays  = self._cmd(f"grep '{today}' {log} 2>/dev/null | grep -c 'uploads.*\\.mp3'")
            errors     = self._cmd(f"grep '{today}' {log} 2>/dev/null | awk '$9~/^[45]/' | wc -l")
            bw_bytes   = self._cmd(f"grep '{today}' {log} 2>/dev/null | awk '{{sum+=$10}} END{{print sum+0}}'")
            try:
                bw = int(bw_bytes)
                bw_str = f"{bw/1e9:.2f} GB" if bw>1e9 else f"{bw/1e6:.1f} MB" if bw>1e6 else f"{bw/1e3:.0f} KB"
            except: bw_str = "N/A"

            top = self._cmd(
                f"grep '{today}' {log} 2>/dev/null | grep 'uploads.*\\.mp3' | "
                f"awk '{{print $7}}' | sort | uniq -c | sort -rn | head -1 | "
                f"awk '{{print $2}}' | sed 's|/uploads/||' | sed 's|\\.mp3||'")

            raw_deploys = self._cmd(
                "git -C /home/Axrid/Axrids-Website-Repository "
                "log -5 --pretty='%h|%s|%cr' 2>/dev/null")
            deploys = []
            for line in raw_deploys.splitlines():
                parts = line.split("|", 2)
                if len(parts) == 3:
                    deploys.append(parts)
            deploy_msg  = deploys[0][1] if deploys else "—"
            deploy_time = deploys[0][2] if deploys else ""

            recent_raw = self._cmd(f"tail -5 {log} 2>/dev/null")
            recent = []
            for line in recent_raw.splitlines():
                try:
                    ts  = line.split('[')[1].split(']')[0][:17]
                    req = line.split('"')[1][:55]
                    st  = line.split('"')[2].strip().split()[0]
                    col = GREEN if st.startswith("2") else \
                          YELLOW if st.startswith("3") else RED
                    recent.append((f"{ts}  {req}  [{st}]", col))
                except: pass

            self.after(0, lambda: self._apply_slow(
                online, uptime, local, public, temp,
                mem_str, mp, disk_str, dp,
                tracks, users, albums, posts,
                total_req, unique, mp3_plays, errors,
                bw_str, top, deploy_msg, deploy_time, recent, deploys))

        threading.Thread(target=run, daemon=True).start()
        self.after(5000, self._slow_tick)

    def _apply_slow(self, online, uptime, local, public, temp,
                    mem_str, mp, disk_str, dp,
                    tracks, users, albums, posts,
                    total_req, unique, mp3_plays, errors,
                    bw_str, top, deploy_msg, deploy_time, recent, deploys):
        col = GREEN if online else RED
        txt = "ONLINE" if online else "OFFLINE"
        if self.dot.cget("fg") != col:
            self.dot.config(fg=col); self.status_lbl.config(text=txt, fg=col)
        self._s(self.uptime_lbl, f"uptime: {uptime}")
        self._s(self.local_lbl,  f"http://{local}:3000")
        self._s(self.public_lbl, public or "—")

        self.mem_row.set(mem_str, mp)
        self.disk_row.set(disk_str, dp)
        self.temp_row.set(temp)

        self._s(self.tracks_lbl,  tracks)
        self._s(self.users_lbl,   users)
        self._s(self.albums_lbl,  albums)
        self._s(self.posts_lbl,   posts)

        self._s(self.visitors_lbl, unique)
        self._s(self.requests_lbl, total_req)
        self._s(self.unique_lbl,   unique)
        self._s(self.mp3_lbl,      mp3_plays)
        self._s(self.errors_lbl,   errors)
        self._s(self.bw_lbl,       bw_str)
        self._s(self.top_lbl,      top or "—")
        self._s(self.deploy_lbl, f"Last deploy: {deploy_msg}  ·  {deploy_time}")
        for i, (rf, hl, ml, tl) in enumerate(self.deploy_rows):
            if i < len(deploys):
                h, msg, rel = deploys[i]
                if hl.cget("text") != h:   hl.config(text=h)
                if ml.cget("text") != msg: ml.config(text=msg[:52] + ("…" if len(msg) > 52 else ""))
                if tl.cget("text") != rel: tl.config(text=rel)
                rf.pack(fill="x", pady=1)
            else:
                rf.pack_forget()

        for i, (dot, txt_lbl) in enumerate(self.log_labels):
            if i < len(recent):
                text, c = recent[-(i+1)]
                if txt_lbl.cget("text") != text:
                    dot.config(fg=c); txt_lbl.config(text=text, fg=c)
            else:
                self._s(txt_lbl, "")

if __name__ == "__main__":
    app = Dashboard()
    app.mainloop()
