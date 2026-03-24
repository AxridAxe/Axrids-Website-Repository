import "dotenv/config";
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";
import { execSync } from "child_process";
import os from "os";
import db from "./src/database.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer storage — preserve original extension, unique filename
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}_${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

// ---------------------------------------------------------------------------
// TypeScript: extend Express.User so req.user is typed throughout
// ---------------------------------------------------------------------------
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      displayName: string;
      alias: string | null;
      role: "admin" | "user";
      photoURL: string | null;
      passwordHash: string;
      theme: "light" | "dark";
    }
  }
}

// ---------------------------------------------------------------------------
// Passport – Local Strategy (email + password)
// ---------------------------------------------------------------------------
passport.use(
  new LocalStrategy({ usernameField: "email" }, (email, password, done) => {
    try {
      const user = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email) as Express.User | undefined;

      if (!user) return done(null, false, { message: "No account found with that email." });
      if (!user.passwordHash) return done(null, false, { message: "This account has no password set." });

      bcrypt.compare(password, user.passwordHash, (err, match) => {
        if (err) return done(err);
        if (!match) return done(null, false, { message: "Incorrect password." });
        return done(null, user);
      });
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser((id: string, done) => {
  try {
    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(id) as Express.User | undefined;
    done(null, user ?? false);
  } catch (err) {
    done(err);
  }
});

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function isAuthenticated(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Authentication required." });
}

function isAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.isAuthenticated() && req.user?.role === "admin") return next();
  return res.status(403).json({ error: "Admin access required." });
}

// Strip passwordHash before sending user objects to the client
function sanitizeUser(user: Express.User) {
  const { passwordHash: _pw, ...safe } = user;
  return safe;
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------
async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`Server starting...`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

  // --- Core middleware ---
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "change-this-secret-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // --- Rate limiter ---
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: "Too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/", limiter);

  // --- HTTPS / www redirect (production only) ---
  app.use((req, res, next) => {
    const host = req.get("host") ?? "";
    const isHttps = req.headers["x-forwarded-proto"] === "https";
    if (host.toLowerCase() === "www.axrid.com") {
      return res.redirect(301, `https://axrid.com${req.url}`);
    }
    if (host.toLowerCase() === "axrid.com" && !isHttps) {
      return res.redirect(301, `https://axrid.com${req.url}`);
    }
    next();
  });

  // Serve uploaded files statically
  app.use("/uploads", express.static(UPLOADS_DIR));

  // =========================================================================
  // HEALTH
  // =========================================================================
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  // =========================================================================
  // FILE UPLOAD
  // =========================================================================

  // POST /api/upload  – accepts a single file (field: "file"), returns { url }
  app.post("/api/upload", isAuthenticated, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided." });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  // =========================================================================
  // AUTH ROUTES
  // =========================================================================

  // POST /api/auth/register
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: "email, password, and displayName are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const id = crypto.randomUUID();
      const role = email === process.env.OWNER_EMAIL ? "admin" : "user";

      db.prepare(
        `INSERT INTO users (id, email, displayName, alias, role, passwordHash)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, email, displayName, displayName, role, passwordHash);

      const newUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Express.User;

      req.login(newUser, (err) => {
        if (err) return res.status(500).json({ error: "Registration succeeded but login failed." });
        return res.status(201).json({ user: sanitizeUser(newUser) });
      });
    } catch (err: any) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Registration failed." });
    }
  });

  // POST /api/auth/login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string }) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message ?? "Login failed." });

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json({ user: sanitizeUser(user) });
      });
    })(req, res, next);
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => res.json({ ok: true }));
    });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    res.json({ user: sanitizeUser(req.user) });
  });

  // =========================================================================
  // USERS
  // =========================================================================

  // GET /api/users  – public, returns minimal profile data for all users
  app.get("/api/users", (_req, res) => {
    const users = db
      .prepare("SELECT id, email, displayName, alias, role, photoURL, theme FROM users")
      .all();
    res.json(users);
  });

  // GET /api/users/:id
  app.get("/api/users/:id", (req, res) => {
    const user = db
      .prepare("SELECT id, email, displayName, alias, role, photoURL, theme FROM users WHERE id = ?")
      .get(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  });

  // PUT /api/users/:id  – user can update their own profile; admin can update any
  app.put("/api/users/:id", isAuthenticated, (req, res) => {
    const { id } = req.params;
    if (req.user!.id !== id && req.user!.role !== "admin") {
      return res.status(403).json({ error: "You can only update your own profile." });
    }

    const { displayName, alias, photoURL, theme } = req.body;
    db.prepare(
      `UPDATE users
          SET displayName = COALESCE(?, displayName),
              alias       = COALESCE(?, alias),
              photoURL    = COALESCE(?, photoURL),
              theme       = COALESCE(?, theme)
        WHERE id = ?`
    ).run(displayName ?? null, alias ?? null, photoURL ?? null, theme ?? null, id);

    const updated = db
      .prepare("SELECT id, email, displayName, alias, role, photoURL, theme FROM users WHERE id = ?")
      .get(id);
    res.json(updated);
  });

  // =========================================================================
  // POSTS
  // =========================================================================

  // GET /api/posts  – public see visible only; admin sees all
  app.get("/api/posts", (req, res) => {
    const isAdminUser = req.isAuthenticated() && req.user?.role === "admin";
    const posts = isAdminUser
      ? db.prepare("SELECT * FROM posts ORDER BY createdAt DESC").all()
      : db.prepare("SELECT * FROM posts WHERE isVisible = 1 ORDER BY createdAt DESC").all();
    res.json(posts);
  });

  // POST /api/posts  (admin)
  app.post("/api/posts", isAdmin, (req, res) => {
    const { title, subtitle, content, isVisible, authorName, authorPhoto } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "content is required." });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO posts (id, title, subtitle, content, isVisible, authorId, authorName, authorPhoto, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      title ?? null,
      subtitle ?? null,
      content,
      isVisible !== false ? 1 : 0,
      req.user!.id,
      authorName ?? req.user!.displayName,
      authorPhoto ?? req.user!.photoURL ?? null,
      now
    );
    res.status(201).json(db.prepare("SELECT * FROM posts WHERE id = ?").get(id));
  });

  // PUT /api/posts/:id  (admin)
  app.put("/api/posts/:id", isAdmin, (req, res) => {
    const { title, subtitle, content, isVisible } = req.body;
    db.prepare(
      `UPDATE posts
          SET title     = COALESCE(?, title),
              subtitle  = COALESCE(?, subtitle),
              content   = COALESCE(?, content),
              isVisible = COALESCE(?, isVisible)
        WHERE id = ?`
    ).run(
      title ?? null,
      subtitle ?? null,
      content ?? null,
      isVisible !== undefined ? (isVisible ? 1 : 0) : null,
      req.params.id
    );
    res.json(db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id));
  });

  // DELETE /api/posts/:id  (admin)
  app.delete("/api/posts/:id", isAdmin, (req, res) => {
    db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // GET /api/posts/:id/comments
  app.get("/api/posts/:id/comments", (req, res) => {
    const comments = db
      .prepare("SELECT * FROM comments WHERE postId = ? ORDER BY createdAt ASC")
      .all(req.params.id);
    res.json(comments);
  });

  // POST /api/posts/:id/comments  (authenticated)
  app.post("/api/posts/:id/comments", isAuthenticated, (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "content is required." });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO comments (id, postId, content, authorId, authorName, authorPhoto, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.params.id,
      content,
      req.user!.id,
      req.user!.displayName,
      req.user!.photoURL ?? null,
      now
    );
    res.status(201).json(db.prepare("SELECT * FROM comments WHERE id = ?").get(id));
  });

  // DELETE /api/posts/:id/comments/:commentId  (admin or comment author)
  app.delete("/api/posts/:id/comments/:commentId", isAuthenticated, (req, res) => {
    const comment = db
      .prepare("SELECT * FROM comments WHERE id = ?")
      .get(req.params.commentId) as any;
    if (!comment) return res.status(404).json({ error: "Comment not found." });

    if (req.user!.role !== "admin" && comment.authorId !== req.user!.id) {
      return res.status(403).json({ error: "Not authorised to delete this comment." });
    }
    db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.commentId);
    res.json({ ok: true });
  });

  // =========================================================================
  // TRACKS
  // =========================================================================

  // GET /api/tracks
  app.get("/api/tracks", (req, res) => {
    const isAdminUser = req.isAuthenticated() && req.user?.role === "admin";
    const userId = req.user?.id;

    let tracks: any[];
    if (isAdminUser) {
      tracks = db.prepare("SELECT * FROM tracks ORDER BY releaseDate DESC, createdAt DESC").all();
    } else if (userId) {
      tracks = db
        .prepare(
          "SELECT * FROM tracks WHERE isVisible = 1 OR authorId = ? ORDER BY releaseDate DESC, createdAt DESC"
        )
        .all(userId);
    } else {
      tracks = db
        .prepare("SELECT * FROM tracks WHERE isVisible = 1 ORDER BY releaseDate DESC, createdAt DESC")
        .all();
    }

    // Attach sharedWith array to each track
    const withShared = tracks.map((t: any) => ({
      ...t,
      isVisible: Boolean(t.isVisible),
      isExplicit: Boolean(t.isExplicit),
      enableDirectDownloads: Boolean(t.enableDirectDownloads),
      offlineListening: Boolean(t.offlineListening),
      displayEmbedCode: Boolean(t.displayEmbedCode),
      allowComments: Boolean(t.allowComments),
      showCommentsToPublic: Boolean(t.showCommentsToPublic),
      sharedWith: db
        .prepare("SELECT userId FROM track_shared_with WHERE trackId = ?")
        .all(t.id)
        .map((r: any) => r.userId),
    }));

    res.json(withShared);
  });

  // POST /api/tracks  (admin)
  app.post("/api/tracks", isAdmin, (req, res) => {
    const {
      title, artist, audioUrl, coverUrl, isVisible, trackLink, genre, album,
      description, privacy, buyLink, recordLabel, releaseDate, publisher,
      soundcloudUrl, isExplicit, enableDirectDownloads, offlineListening,
      displayEmbedCode, allowComments, showCommentsToPublic, licenseType, sharedWith,
    } = req.body;

    if (!title || !artist || !releaseDate) {
      return res.status(400).json({ error: "title, artist, and releaseDate are required." });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO tracks (
         id, title, artist, audioUrl, coverUrl, isVisible, authorId, createdAt, releaseDate,
         trackLink, genre, album, description, privacy, buyLink, recordLabel, publisher,
         soundcloudUrl, isExplicit, enableDirectDownloads, offlineListening, displayEmbedCode,
         allowComments, showCommentsToPublic, licenseType
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, title, artist, audioUrl, coverUrl,
      isVisible !== false ? 1 : 0,
      req.user!.id, now, releaseDate,
      trackLink ?? null, genre ?? null, album ?? null, description ?? null,
      privacy ?? "public", buyLink ?? null, recordLabel ?? null, publisher ?? null,
      soundcloudUrl ?? null,
      isExplicit ? 1 : 0, enableDirectDownloads ? 1 : 0, offlineListening ? 1 : 0,
      displayEmbedCode !== false ? 1 : 0, allowComments !== false ? 1 : 0,
      showCommentsToPublic !== false ? 1 : 0,
      licenseType ?? "all-rights-reserved"
    );

    // Insert sharedWith entries
    if (Array.isArray(sharedWith)) {
      const insertShared = db.prepare(
        "INSERT OR IGNORE INTO track_shared_with (trackId, userId) VALUES (?, ?)"
      );
      for (const uid of sharedWith) insertShared.run(id, uid);
    }

    res.status(201).json(db.prepare("SELECT * FROM tracks WHERE id = ?").get(id));
  });

  // PUT /api/tracks/:id  (admin)
  app.put("/api/tracks/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    const fields = [
      "title", "artist", "audioUrl", "coverUrl", "trackLink", "genre", "album",
      "description", "privacy", "buyLink", "recordLabel", "releaseDate", "publisher",
      "soundcloudUrl", "licenseType",
    ];
    const boolFields = [
      "isVisible", "isExplicit", "enableDirectDownloads", "offlineListening",
      "displayEmbedCode", "allowComments", "showCommentsToPublic",
    ];

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        setClauses.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    for (const f of boolFields) {
      if (req.body[f] !== undefined) {
        setClauses.push(`${f} = ?`);
        values.push(req.body[f] ? 1 : 0);
      }
    }

    if (setClauses.length > 0) {
      values.push(id);
      db.prepare(`UPDATE tracks SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
    }

    // Replace sharedWith if provided
    if (Array.isArray(req.body.sharedWith)) {
      db.prepare("DELETE FROM track_shared_with WHERE trackId = ?").run(id);
      const insertShared = db.prepare(
        "INSERT OR IGNORE INTO track_shared_with (trackId, userId) VALUES (?, ?)"
      );
      for (const uid of req.body.sharedWith) insertShared.run(id, uid);
    }

    res.json(db.prepare("SELECT * FROM tracks WHERE id = ?").get(id));
  });

  // PATCH /api/tracks/:id/visibility  (admin)
  app.patch("/api/tracks/:id/visibility", isAdmin, (req, res) => {
    const { isVisible } = req.body;
    db.prepare("UPDATE tracks SET isVisible = ? WHERE id = ?").run(
      isVisible ? 1 : 0,
      req.params.id
    );
    res.json({ ok: true });
  });

  // DELETE /api/tracks/:id  (admin)
  app.delete("/api/tracks/:id", isAdmin, (req, res) => {
    db.prepare("DELETE FROM tracks WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // =========================================================================
  // ALBUMS
  // =========================================================================

  // GET /api/albums
  app.get("/api/albums", (_req, res) => {
    const albums = db
      .prepare("SELECT * FROM albums ORDER BY createdAt DESC")
      .all() as any[];

    const withTracks = albums.map((a) => ({
      ...a,
      isVisible: Boolean(a.isVisible),
      trackIds: db
        .prepare("SELECT trackId FROM album_tracks WHERE albumId = ? ORDER BY position ASC")
        .all(a.id)
        .map((r: any) => r.trackId),
    }));
    res.json(withTracks);
  });

  // POST /api/albums  (admin)
  app.post("/api/albums", isAdmin, (req, res) => {
    const { title, artist, coverUrl, releaseDate, description, isVisible, trackIds } = req.body;
    if (!title) return res.status(400).json({ error: "title is required." });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO albums (id, title, artist, coverUrl, releaseDate, description, isVisible, authorId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, title, artist ?? null, coverUrl ?? null, releaseDate ?? null,
      description ?? null, isVisible !== false ? 1 : 0, req.user!.id, now
    );

    if (Array.isArray(trackIds)) {
      const insertTrack = db.prepare(
        "INSERT OR IGNORE INTO album_tracks (albumId, trackId, position) VALUES (?, ?, ?)"
      );
      trackIds.forEach((tid, pos) => insertTrack.run(id, tid, pos));
    }

    res.status(201).json(db.prepare("SELECT * FROM albums WHERE id = ?").get(id));
  });

  // PUT /api/albums/:id  (admin)
  app.put("/api/albums/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    const { title, artist, coverUrl, releaseDate, description, isVisible, trackIds } = req.body;

    db.prepare(
      `UPDATE albums
          SET title       = COALESCE(?, title),
              artist      = COALESCE(?, artist),
              coverUrl    = COALESCE(?, coverUrl),
              releaseDate = COALESCE(?, releaseDate),
              description = COALESCE(?, description),
              isVisible   = COALESCE(?, isVisible)
        WHERE id = ?`
    ).run(
      title ?? null, artist ?? null, coverUrl ?? null, releaseDate ?? null,
      description ?? null,
      isVisible !== undefined ? (isVisible ? 1 : 0) : null,
      id
    );

    if (Array.isArray(trackIds)) {
      db.prepare("DELETE FROM album_tracks WHERE albumId = ?").run(id);
      const insertTrack = db.prepare(
        "INSERT OR IGNORE INTO album_tracks (albumId, trackId, position) VALUES (?, ?, ?)"
      );
      trackIds.forEach((tid, pos) => insertTrack.run(id, tid, pos));
    }

    res.json(db.prepare("SELECT * FROM albums WHERE id = ?").get(id));
  });

  // DELETE /api/albums/:id  (admin)
  app.delete("/api/albums/:id", isAdmin, (req, res) => {
    db.prepare("DELETE FROM albums WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // =========================================================================
  // SETTINGS
  // =========================================================================

  // GET /api/settings  – public
  app.get("/api/settings", (_req, res) => {
    const settings = db.prepare("SELECT * FROM settings WHERE id = 'main'").get();
    res.json(settings ?? {});
  });

  // PUT /api/settings  (admin) – upsert
  app.put("/api/settings", isAdmin, (req, res) => {
    const { aboutText, instagramUrl, youtubeUrl, soundcloudUrl } = req.body;
    db.prepare(
      `INSERT INTO settings (id, aboutText, instagramUrl, youtubeUrl, soundcloudUrl)
       VALUES ('main', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         aboutText     = excluded.aboutText,
         instagramUrl  = excluded.instagramUrl,
         youtubeUrl    = excluded.youtubeUrl,
         soundcloudUrl = excluded.soundcloudUrl`
    ).run(aboutText ?? null, instagramUrl ?? null, youtubeUrl ?? null, soundcloudUrl ?? null);
    res.json(db.prepare("SELECT * FROM settings WHERE id = 'main'").get());
  });

  // =========================================================================
  // CONVERSATIONS
  // =========================================================================

  // GET /api/conversations  – authenticated, returns only the user's conversations
  app.get("/api/conversations", isAuthenticated, (req, res) => {
    const conversations = db
      .prepare(
        `SELECT c.* FROM conversations c
         JOIN conversation_participants cp ON cp.conversationId = c.id
         WHERE cp.userId = ?
         ORDER BY c.lastMessageAt DESC`
      )
      .all(req.user!.id) as any[];

    const withParticipants = conversations.map((c) => ({
      ...c,
      participants: db
        .prepare("SELECT userId FROM conversation_participants WHERE conversationId = ?")
        .all(c.id)
        .map((r: any) => r.userId),
      unreadCount: Object.fromEntries(
        (
          db
            .prepare(
              "SELECT userId, unreadCount FROM conversation_unread_counts WHERE conversationId = ?"
            )
            .all(c.id) as any[]
        ).map((r) => [r.userId, r.unreadCount])
      ),
    }));

    res.json(withParticipants);
  });

  // POST /api/conversations  – find-or-create a conversation between two users
  app.post("/api/conversations", isAuthenticated, (req, res) => {
    const { otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ error: "otherUserId is required." });

    // Deterministic ID (same pair always gets same conversation)
    const convId = [req.user!.id, otherUserId].sort().join("_");
    const existing = db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(convId);

    if (!existing) {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO conversations (id, lastMessage, lastMessageAt) VALUES (?, ?, ?)`
      ).run(convId, "Conversation started", now);

      const insertParticipant = db.prepare(
        "INSERT OR IGNORE INTO conversation_participants (conversationId, userId) VALUES (?, ?)"
      );
      insertParticipant.run(convId, req.user!.id);
      insertParticipant.run(convId, otherUserId);

      const insertUnread = db.prepare(
        "INSERT OR IGNORE INTO conversation_unread_counts (conversationId, userId, unreadCount) VALUES (?, ?, 0)"
      );
      insertUnread.run(convId, req.user!.id);
      insertUnread.run(convId, otherUserId);
    }

    const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(convId) as any;
    res.json({
      ...conv,
      participants: db
        .prepare("SELECT userId FROM conversation_participants WHERE conversationId = ?")
        .all(convId)
        .map((r: any) => r.userId),
    });
  });

  // DELETE /api/conversations/:id  (admin)
  app.delete("/api/conversations/:id", isAdmin, (req, res) => {
    db.prepare("DELETE FROM conversations WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // GET /api/conversations/:id/messages  (authenticated participant)
  app.get("/api/conversations/:id/messages", isAuthenticated, (req, res) => {
    const participant = db
      .prepare(
        "SELECT 1 FROM conversation_participants WHERE conversationId = ? AND userId = ?"
      )
      .get(req.params.id, req.user!.id);

    if (!participant && req.user!.role !== "admin") {
      return res.status(403).json({ error: "Not a participant in this conversation." });
    }

    const messages = db
      .prepare("SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC")
      .all(req.params.id);
    res.json(messages);
  });

  // POST /api/conversations/:id/messages  (authenticated participant)
  app.post("/api/conversations/:id/messages", isAuthenticated, (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "content is required." });

    const participant = db
      .prepare(
        "SELECT 1 FROM conversation_participants WHERE conversationId = ? AND userId = ?"
      )
      .get(req.params.id, req.user!.id);
    if (!participant) return res.status(403).json({ error: "Not a participant in this conversation." });

    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO messages (id, conversationId, senderId, content, createdAt) VALUES (?, ?, ?, ?, ?)"
    ).run(msgId, req.params.id, req.user!.id, content, now);

    // Update conversation summary
    db.prepare(
      "UPDATE conversations SET lastMessage = ?, lastMessageAt = ?, lastSenderId = ? WHERE id = ?"
    ).run(content, now, req.user!.id, req.params.id);

    // Increment unread count for other participants
    db.prepare(
      `UPDATE conversation_unread_counts
          SET unreadCount = unreadCount + 1
        WHERE conversationId = ? AND userId != ?`
    ).run(req.params.id, req.user!.id);

    res.status(201).json(db.prepare("SELECT * FROM messages WHERE id = ?").get(msgId));
  });

  // PATCH /api/conversations/:id/messages/:msgId  (sender or admin – edit content)
  app.patch("/api/conversations/:id/messages/:msgId", isAuthenticated, (req, res) => {
    const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.msgId) as any;
    if (!msg) return res.status(404).json({ error: "Message not found." });
    if (msg.senderId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ error: "Not authorised." });
    }
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "content is required." });
    db.prepare("UPDATE messages SET content = ? WHERE id = ?").run(content.trim(), req.params.msgId);
    res.json(db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.msgId));
  });

  // DELETE /api/conversations/:id/messages/:msgId  (sender or admin)
  app.delete("/api/conversations/:id/messages/:msgId", isAuthenticated, (req, res) => {
    const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.msgId) as any;
    if (!msg) return res.status(404).json({ error: "Message not found." });
    if (msg.senderId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ error: "Not authorised." });
    }
    db.prepare("DELETE FROM messages WHERE id = ?").run(req.params.msgId);
    res.json({ ok: true });
  });

  // GET /api/admin/conversations  (admin – all conversations for moderation)
  app.get("/api/admin/conversations", isAdmin, (_req, res) => {
    const conversations = db
      .prepare("SELECT * FROM conversations ORDER BY lastMessageAt DESC LIMIT 50")
      .all() as any[];
    const withParticipants = conversations.map((c) => ({
      ...c,
      participants: db
        .prepare("SELECT userId FROM conversation_participants WHERE conversationId = ?")
        .all(c.id)
        .map((r: any) => r.userId),
    }));
    res.json(withParticipants);
  });

  // =========================================================================
  // CHANGELOG
  // =========================================================================

  // GET /api/changelog  – public
  app.get("/api/changelog", (_req, res) => {
    const entries = db
      .prepare("SELECT * FROM changelog_entries ORDER BY createdAt DESC")
      .all();
    res.json(entries);
  });

  // POST /api/changelog  (admin)
  app.post("/api/changelog", isAdmin, (req, res) => {
    const { title, description, date, time, type } = req.body;
    if (!title || !description || !date || !time || !type) {
      return res.status(400).json({ error: "title, description, date, time, and type are required." });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO changelog_entries (id, title, description, date, time, type, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, title, description, date, time, type, now);

    res.status(201).json(
      db.prepare("SELECT * FROM changelog_entries WHERE id = ?").get(id)
    );
  });

  // DELETE /api/changelog/:id  (admin)
  app.delete("/api/changelog/:id", isAdmin, (req, res) => {
    db.prepare("DELETE FROM changelog_entries WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // =========================================================================
  // ── Live dashboard HTML page ─────────────────────────────────────────────
  app.get("/admin", (req, res, next) => {
    if (!req.isAuthenticated() || req.user?.role !== "admin") {
      return res.redirect("/login");
    }
    next();
  }, (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Axrid Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:#080808;color:#aaa;font-family:Helvetica,Arial,sans-serif;font-size:13px}
#wrap{display:flex;flex-direction:column;height:100vh;overflow:hidden}
/* topbar */
#topbar{flex-shrink:0;background:#131313;display:flex;align-items:center;gap:12px;padding:0 14px;border-bottom:1px solid #1a1a1a;height:44px}
#topbar .ab{width:4px;align-self:stretch;background:#2979ff}
#topbar .title{font-size:19px;font-weight:bold;color:#fff;letter-spacing:-0.5px}
#topbar .sub{font-size:11px;color:#333;font-weight:bold;text-transform:uppercase;letter-spacing:2px}
#topbar .sdot{font-size:11px}
#topbar .stxt{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px}
#topbar .upt{font-size:9px;color:#333;margin-left:2px}
#topbar .clk{font-size:11px;font-weight:bold;color:#aaa;margin-left:auto;font-family:monospace}
/* main 3-col body */
#body{flex:1;display:grid;grid-template-columns:1fr 2fr 1fr;gap:6px;padding:6px 8px;min-height:0}
.col{display:flex;flex-direction:column;gap:5px;min-height:0;overflow:hidden}
.card{background:#0e0e0e;border:1px solid #1a1a1a;flex-shrink:0}
.card.grow{flex:1;min-height:0;overflow:hidden}
.ch{background:#131313;border-bottom:1px solid #1a1a1a;display:flex;align-items:center;padding:5px 10px;gap:5px}
.ch .b{width:3px;height:12px;flex-shrink:0}
.ch span{font-size:9px;font-weight:bold;color:#333;text-transform:uppercase;letter-spacing:2px}
.cb{padding:8px 10px}
.lbl{font-size:8px;font-weight:bold;color:#333;text-transform:uppercase;letter-spacing:1px;margin-bottom:1px}
.val{font-size:14px;font-weight:bold;margin-bottom:5px}
.val.big{font-size:20px}
.val.sm{font-size:11px}
.rb{width:100%;height:3px;background:#1c1c1c;border-radius:2px;margin-top:2px;margin-bottom:7px}
.rbf{height:100%;border-radius:2px;transition:width .4s}
.ng{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:5px}
canvas{width:100%;height:44px;display:block}
.dv{height:1px;background:#1a1a1a;margin:5px 0}
.tc{display:grid;grid-template-columns:1fr 2fr;gap:8px}
.ir{display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #1a1a1a}
.ir:last-child{border:none}
.ir .k{font-size:10px;font-weight:bold;color:#333;text-transform:uppercase;letter-spacing:1px}
.ir .v{font-size:14px;font-weight:bold}
.dr{display:flex;align-items:center;gap:5px;padding:2px 0;border-bottom:1px solid #1a1a1a;overflow:hidden}
.dr:last-child{border:none}
.dr .h{font-family:monospace;font-size:8px;color:#333;flex-shrink:0;width:46px}
.dr .m{font-size:9px;color:#aaa;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dr .t{font-family:monospace;font-size:8px;color:#333;flex-shrink:0}
/* log */
#logwrap{flex-shrink:0;background:#0e0e0e;border-top:1px solid #1a1a1a;border-bottom:1px solid #1a1a1a}
#loghdr{display:flex;align-items:center;gap:5px;padding:4px 10px;background:#131313;border-bottom:1px solid #1a1a1a}
#log{padding:2px 10px}
.lr{display:flex;align-items:center;gap:8px;padding:2px 0;border-bottom:1px solid #111;font-family:monospace;font-size:9px;color:#444}
.lr:last-child{border:none}
.lr .dot{font-size:8px;flex-shrink:0}
.lr .ts{flex-shrink:0;width:120px}
.lr .rq{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lr .st{flex-shrink:0;width:32px;text-align:right}
/* footer */
#foot{flex-shrink:0;background:#131313;border-top:1px solid #1a1a1a;display:flex;align-items:center;padding:0 12px;height:32px}
#foot .dt{font-size:8px;color:#333}
#foot a{margin-left:auto;font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#2979ff;text-decoration:none;background:#1c1c1c;padding:4px 10px}
.green{color:#00e676}.blue{color:#2979ff}.yellow{color:#ffd600}.red{color:#ff1744}.purple{color:#d500f9}.teal{color:#00bcd4}.orange{color:#ff6d00}.white{color:#fff}
</style>
</head><body>
<div id="wrap">
<div id="topbar">
  <div class="ab"></div>
  <span class="title">AXRID</span>
  <span class="sub">Server Dashboard</span>
  <span class="sdot green" id="dot">●</span>
  <span class="stxt green" id="status">ONLINE</span>
  <span class="upt" id="uptime"></span>
  <span class="clk" id="clock"></span>
  <a href="https://axrid.com" target="_blank" style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#2979ff;text-decoration:none;background:#1c1c1c;padding:4px 10px;margin-left:10px">⇗ Site</a>
  <button onclick="location.reload()" style="font-size:14px;background:none;border:none;color:#333;cursor:pointer;padding:0 6px" title="Reload">↺</button>
  <a href="/admin/panel" style="font-size:14px;color:#333;text-decoration:none;padding:0 6px" title="Admin Panel">⚙</a>
  <a href="/" style="font-size:14px;color:#333;text-decoration:none;padding:0 6px" title="Home">⌂</a>
</div>

<div id="body">
  <!-- LEFT -->
  <div class="col">
    <div class="card">
      <div class="ch"><div class="b" style="background:#00bcd4"></div><span>Address</span></div>
      <div class="cb">
        <div class="lbl">Domain</div><div class="val green">axrid.com</div>
        <div class="lbl">Local</div><div class="val blue sm" id="localIp">—</div>
        <div class="lbl">Public IP</div><div class="val teal sm" id="publicIp">—</div>
      </div>
    </div>
    <div class="card grow">
      <div class="ch"><div class="b" style="background:#d500f9"></div><span>System</span></div>
      <div class="cb">
        <div class="lbl">CPU</div><div class="val blue" id="cpu">—</div>
        <div class="rb"><div class="rbf" id="cpu-bar" style="width:0%;background:#2979ff"></div></div>
        <div class="lbl">Memory</div><div class="val purple" id="mem">—</div>
        <div class="rb"><div class="rbf" id="mem-bar" style="width:0%;background:#d500f9"></div></div>
        <div class="lbl">Disk</div><div class="val teal" id="disk">—</div>
        <div class="rb"><div class="rbf" id="disk-bar" style="width:0%;background:#00bcd4"></div></div>
        <div class="lbl">Temperature</div><div class="val yellow" id="temp">—</div>
      </div>
    </div>
  </div>

  <!-- CENTER -->
  <div class="col">
    <div class="card">
      <div class="ch"><div class="b" style="background:#00e676"></div><span>Live Traffic</span></div>
      <div class="cb">
        <div class="ng">
          <div><div class="lbl">Req / Min</div><div class="val big green" id="rpm">—</div></div>
          <div><div class="lbl">Visitors Today</div><div class="val big blue" id="visitors">—</div></div>
          <div><div class="lbl">Requests Today</div><div class="val big white" id="reqtoday">—</div></div>
          <div><div class="lbl">Active Conns</div><div class="val big teal" id="conns">—</div></div>
        </div>
        <div class="dv"></div>
        <div class="lbl" style="margin-bottom:3px">Requests Per Minute</div>
        <canvas id="spark"></canvas>
      </div>
    </div>
    <div class="card">
      <div class="ch"><div class="b" style="background:#ff6d00"></div><span>Transfer &amp; Top Track</span></div>
      <div class="cb tc">
        <div><div class="lbl">Bandwidth Today</div><div class="val orange" id="bw">—</div></div>
        <div><div class="lbl">Top Track Today</div><div class="val white sm" id="top">—</div></div>
      </div>
    </div>
    <div class="card grow">
      <div class="ch"><div class="b" style="background:#333"></div><span>Recent Deploys</span></div>
      <div class="cb" id="deploys"></div>
    </div>
  </div>

  <!-- RIGHT -->
  <div class="col">
    <div class="card">
      <div class="ch"><div class="b" style="background:#2979ff"></div><span>Site Content</span></div>
      <div class="cb">
        <div class="ir"><span class="k">Tracks</span><span class="v white" id="tracks">—</span></div>
        <div class="ir"><span class="k">Users</span><span class="v white" id="users">—</span></div>
        <div class="ir"><span class="k">Albums</span><span class="v white" id="albums">—</span></div>
        <div class="ir"><span class="k">Posts</span><span class="v white" id="posts">—</span></div>
      </div>
    </div>
    <div class="card">
      <div class="ch"><div class="b" style="background:#ffd600"></div><span>Today at a Glance</span></div>
      <div class="cb">
        <div class="ir"><span class="k">Unique Visitors</span><span class="v green" id="unique">—</span></div>
        <div class="ir"><span class="k">Track Plays</span><span class="v blue" id="plays">—</span></div>
        <div class="ir"><span class="k">Errors 4xx/5xx</span><span class="v red" id="errors">—</span></div>
      </div>
    </div>
  </div>
</div>

<div id="logwrap">
  <div id="loghdr"><div style="width:3px;height:12px;background:#333"></div><span style="font-size:9px;font-weight:bold;color:#333;text-transform:uppercase;letter-spacing:2px">Live Activity Log</span></div>
  <div id="log"></div>
</div>

<div id="foot">
  <span class="dt" id="last-deploy"></span>
  <a href="https://axrid.com" target="_blank">⇗ Open Site</a>
</div>
</div>

<script>
const sparkData = new Array(60).fill(0);
let canvas, ctx;

function bar(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;
  const c = pct > 80 ? '#ff1744' : pct > 60 ? '#ffd600' : el.style.background || '#aaa';
  el.style.width = Math.min(pct,100) + '%';
  el.style.background = c;
}

function drawSpark() {
  if (!canvas) { canvas = document.getElementById('spark'); ctx = canvas.getContext('2d'); }
  const W = canvas.offsetWidth; const H = 50;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0,0,W,H);
  const mx = Math.max(...sparkData) || 1;
  ctx.beginPath();
  sparkData.forEach((v,i) => {
    const x = i * W / (sparkData.length-1);
    const y = H - (v/mx)*(H-4) - 2;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.strokeStyle='#00e676'; ctx.lineWidth=2; ctx.stroke();
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
  ctx.fillStyle='rgba(0,230,118,0.1)'; ctx.fill();
}

function set(id, val) { const e=document.getElementById(id); if(e&&e.textContent!==String(val??'—')) e.textContent=val??'—'; }

async function poll() {
  try {
    const d = await fetch('/api/stats',{credentials:'include'}).then(r=>r.json());
    const s = d.system; const t = d.traffic; const sv = d.server;

    // topbar
    const on = sv?.online;
    document.getElementById('dot').className = 'sdot ' + (on?'green':'red');
    document.getElementById('status').textContent = on ? 'ONLINE' : 'OFFLINE';
    document.getElementById('status').className = 'stxt ' + (on?'green':'red');
    set('uptime', sv?.pm2Uptime ? 'uptime: ' + sv.pm2Uptime : '');

    // address
    set('localIp', sv?.localIp ? 'http://' + sv.localIp + ':3000' : '—');
    set('publicIp', sv?.publicIp || '—');

    // system
    set('cpu', s.cpu + '%'); bar('cpu-bar', s.cpu);
    set('mem', s.memory.used + ' / ' + s.memory.total); bar('mem-bar', s.memory.pct);
    set('disk', s.disk.pct + '%  ' + s.disk.used + ' / ' + s.disk.total); bar('disk-bar', s.disk.pct);
    set('temp', s.temp || 'N/A');

    // traffic
    set('rpm', t.rpm ?? '—');
    set('visitors', t.uniqueVisitors);
    set('reqtoday', t.requestsToday);
    set('conns', t.activeConns ?? 0);
    sparkData.push(t.rpm ?? 0); sparkData.shift(); drawSpark();

    // transfer
    set('bw', t.bandwidth);
    set('top', t.topTrack || '—');

    // site content
    set('tracks', d.counts.tracks); set('users', d.counts.users);
    set('albums', d.counts.albums); set('posts', d.counts.posts);

    // today at a glance
    set('unique', t.uniqueVisitors); set('plays', t.mp3Plays); set('errors', t.errors4xx5xx);

    // deploys
    const dep = document.getElementById('deploys');
    if (dep && d.deploys?.length) {
      dep.innerHTML = d.deploys.slice(0,5).map(x =>
        '<div class="dr"><span class="h">' + x.hash + '</span>' +
        '<span class="m">' + x.subject + '</span>' +
        '<span class="t">' + x.relTime + '</span></div>'
      ).join('');
      set('last-deploy', 'Last deploy: ' + d.deploys[0].subject + '  ·  ' + d.deploys[0].relTime);
    }

    // log
    const log = document.getElementById('log');
    if (log && d.recentRequests?.length) {
      log.innerHTML = d.recentRequests.map(r => {
        const c = r.status?.startsWith('2') ? 'green' : r.status?.startsWith('3') ? 'yellow' : 'red';
        return '<div class="lr"><span class="dot ' + c + '">●</span><span class="ts">' +
          r.ts + '</span><span class="rq">' + r.req + '</span><span class="st ' + c + '">' + r.status + '</span></div>';
      }).join('');
    }
  } catch(e) { console.error(e); }
}

// clock
setInterval(() => {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString() + '   ' + now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}, 1000);

poll();
setInterval(poll, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
</script>
</body></html>`);
  });

  // SERVER STATS  (admin only)
  // =========================================================================

  app.get("/api/stats", isAdmin, (_req, res) => {
    function sh(cmd: string): string {
      try { return execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] }).toString().trim(); }
      catch { return ""; }
    }

    // ── System ──────────────────────────────────────────────────────────────
    const uptimeSecs = os.uptime();
    const h = Math.floor(uptimeSecs / 3600);
    const m = Math.floor((uptimeSecs % 3600) / 60);
    const uptime = `${h}h ${m}m`;

    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    const usedMem  = totalMem - freeMem;
    const memPct   = Math.round(usedMem / totalMem * 100);
    const fmt = (b: number) => b > 1e9 ? `${(b/1e9).toFixed(1)} GB` : `${(b/1e6).toFixed(0)} MB`;
    const memory = { used: fmt(usedMem), total: fmt(totalMem), pct: memPct };

    // Read CPU from /proc/stat (instant, no shell overhead)
    let cpu = 0;
    try {
      const stat = require("fs").readFileSync("/proc/stat", "utf8").split("\n")[0].split(/\s+/).slice(1).map(Number);
      const idle = stat[3]; const total = stat.reduce((a: number, b: number) => a + b, 0);
      cpu = Math.round((1 - idle / total) * 100);
    } catch { cpu = 0; }

    const diskRaw = sh("df / | tail -1").split(/\s+/);
    const disk = {
      pct: parseInt(diskRaw[4] ?? "0"),
      used: diskRaw[2] ? `${Math.round(parseInt(diskRaw[2]) / 1024 / 1024)}G` : "?",
      total: diskRaw[1] ? `${Math.round(parseInt(diskRaw[1]) / 1024 / 1024)}G` : "?",
    };

    const temp = sh("vcgencmd measure_temp 2>/dev/null | cut -d= -f2") || null;

    // ── DB counts ────────────────────────────────────────────────────────────
    const counts = {
      tracks:  (db.prepare("SELECT COUNT(*) as n FROM tracks").get() as any).n,
      users:   (db.prepare("SELECT COUNT(*) as n FROM users").get() as any).n,
      albums:  (db.prepare("SELECT COUNT(*) as n FROM albums").get() as any).n,
      posts:   (db.prepare("SELECT COUNT(*) as n FROM posts").get() as any).n,
    };

    // ── Nginx log (today) ────────────────────────────────────────────────────
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "/");
    const log = "/var/log/nginx/access.log";
    const requestsToday  = parseInt(sh(`grep "${today}" ${log} 2>/dev/null | wc -l`) || "0");
    const uniqueVisitors = parseInt(sh(`grep "${today}" ${log} 2>/dev/null | awk '{print $1}' | sort -u | wc -l`) || "0");
    const errors4xx5xx   = parseInt(sh(`grep "${today}" ${log} 2>/dev/null | awk '$9~/^[45]/' | wc -l`) || "0");
    const mp3Plays       = parseInt(sh(`grep "${today}" ${log} 2>/dev/null | grep -c 'uploads.*\\.mp3'`) || "0");
    const bwBytes        = parseInt(sh(`grep "${today}" ${log} 2>/dev/null | awk '{sum+=$10} END{print sum+0}'`) || "0");
    const bandwidth      = bwBytes > 1e9 ? `${(bwBytes/1e9).toFixed(2)} GB` : bwBytes > 1e6 ? `${(bwBytes/1e6).toFixed(1)} MB` : `${(bwBytes/1e3).toFixed(0)} KB`;

    // ── Recent deploys (git log) ─────────────────────────────────────────────
    const gitDir = "/home/Axrid/Axrids-Website-Repository";
    const rawLog = sh(`git -C ${gitDir} log -20 --pretty="%H|%s|%ar|%ad|%an" --date=short 2>/dev/null`);
    const deploys = rawLog.split("\n").filter(Boolean).map(line => {
      const [hash, subject, relTime, date, author] = line.split("|");
      return { hash: hash?.slice(0, 7), subject, relTime, date, author };
    });

    // ── PM2 status ───────────────────────────────────────────────────────────
    const pm2Raw    = sh("pm2 list 2>/dev/null | grep axrid-website");
    const pm2Up     = pm2Raw.includes("online");
    const pm2Show   = sh("pm2 show axrid-website 2>/dev/null");
    const uptimeMatch = pm2Show.match(/uptime\s*[│|]\s*([^\n│|]+)/i);
    const pm2Uptime = pm2Up ? (uptimeMatch?.[1]?.trim() ?? null) : null;

    // ── Network / address ────────────────────────────────────────────────────
    const localIp  = sh("hostname -I 2>/dev/null | awk '{print $1}'") || null;
    const publicIp = sh("curl -s --max-time 3 ifconfig.me 2>/dev/null") || null;
    const activeConnsRaw = sh("ss -tn state established '( dport = :80 or dport = :3000 )' 2>/dev/null | wc -l");
    const activeConns = Math.max(0, (parseInt(activeConnsRaw) || 1) - 1);

    // ── Req/min (lines from current minute in nginx log) ─────────────────────
    const nowH = new Date().getHours().toString().padStart(2, "0");
    const nowM = new Date().getMinutes().toString().padStart(2, "0");
    const rpm = parseInt(sh(`grep "${today}" ${log} 2>/dev/null | grep ":${nowH}:${nowM}:" | wc -l`) || "0");

    // ── Top track today ───────────────────────────────────────────────────────
    const topTrackRaw = sh(`grep "${today}" ${log} 2>/dev/null | grep 'uploads.*\\.mp3' | awk '{print $7}' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}' | sed 's|/uploads/||' | sed 's|\\.mp3||'`);
    const topTrack = topTrackRaw || null;

    // ── Recent nginx log entries ─────────────────────────────────────────────
    const recentRaw = sh(`tail -8 ${log} 2>/dev/null`);
    const recentRequests = recentRaw.split("\n").filter(Boolean).map(line => {
      try {
        const ts  = line.split("[")[1]?.split("]")[0]?.slice(0, 17) ?? "";
        const req = line.split('"')[1]?.slice(0, 60) ?? "";
        const st  = line.split('"')[2]?.trim().split(" ")[0] ?? "";
        return { ts, req, status: st };
      } catch { return null; }
    }).filter(Boolean).reverse();

    res.json({
      system: { uptime, memory, cpu, disk, temp },
      counts,
      traffic: { requestsToday, uniqueVisitors, errors4xx5xx, mp3Plays, bandwidth, rpm, activeConns, topTrack },
      deploys,
      server: { online: pm2Up, pm2Uptime, localIp, publicIp },
      recentRequests,
    });
  });

  // =========================================================================
  // SOUNDCLOUD PROXY ROUTES  (unchanged)
  // =========================================================================

  app.get("/api/soundcloud/metadata", async (req, res) => {
    let { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "SoundCloud URL is required" });
    }

    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === "m.soundcloud.com") urlObj.hostname = "soundcloud.com";
      url = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${urlObj.search}`;
    } catch (e) {}

    try {
      console.log(`[SoundCloud Metadata] Fetching for: ${url}`);

      let metadata: any = {
        title: "",
        artist: "",
        genre: "",
        artworkUrl: "",
        releaseDate: new Date().toISOString().split("T")[0],
      };

      try {
        const oEmbedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oEmbedUrl);
        if (response.ok) {
          const data = await response.json();
          let rawTitle = data.title || "";
          let rawArtist = data.author_name || "";

          if (rawTitle.includes(" - ")) {
            const parts = rawTitle.split(" - ");
            if (
              parts[0].toLowerCase().includes(rawArtist.toLowerCase()) ||
              rawArtist.toLowerCase().includes(parts[0].toLowerCase())
            ) {
              metadata.title = parts[1].trim();
              metadata.artist = rawArtist;
            } else {
              metadata.artist = parts[0].trim();
              metadata.title = parts[1].trim();
            }
          } else if (rawTitle.includes(" by ")) {
            const parts = rawTitle.split(" by ");
            metadata.title = parts[0].trim();
            metadata.artist = parts[1].trim();
          } else {
            metadata.title = rawTitle;
            metadata.artist = rawArtist;
          }

          metadata.artworkUrl = data.thumbnail_url || "";
        }
      } catch (e) {
        console.warn(`[SoundCloud Metadata] oEmbed failed:`, e);
      }

      try {
        let pageResponse = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
          },
        });

        let html = "";
        if (!pageResponse.ok) {
          if (pageResponse.status === 403) {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url as string)}`;
            const proxyResponse = await fetch(proxyUrl);
            if (proxyResponse.ok) {
              const proxyData = await proxyResponse.json();
              html = proxyData.contents;
            }
          }
        } else {
          html = await pageResponse.text();
        }

        if (html) {
          const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)?.[1];
          const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)?.[1];
          const genreMatch = html.match(/"genre":"([^"]+)"/i);
          const artistMatch = html.match(/"artist":"([^"]+)"/i);

          if (ogTitle && !metadata.title) {
            if (ogTitle.includes(" - ")) {
              const parts = ogTitle.split(" - ");
              metadata.artist = parts[0].trim();
              metadata.title = parts[1].trim();
            } else if (ogTitle.includes(" by ")) {
              const parts = ogTitle.split(" by ");
              metadata.title = parts[0].trim();
              metadata.artist = parts[1].trim();
            } else {
              metadata.title = ogTitle;
            }
          }

          if (ogImage && !metadata.artworkUrl) metadata.artworkUrl = ogImage;
          if (genreMatch) metadata.genre = genreMatch[1];
          if (artistMatch && !metadata.artist) metadata.artist = artistMatch[1];

          const dateMatch =
            html.match(/"datePublished":"([^"]+)"/i) ||
            html.match(/"releaseDate":"([^"]+)"/i) ||
            html.match(/"created_at":"([^"]+)"/i) ||
            html.match(/"display_date":"([^"]+)"/i) ||
            html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i) ||
            html.match(/<meta[^>]*itemprop="datePublished"[^>]*content="([^"]+)"/i) ||
            html.match(/<time[^>]*datetime="([^"]+)"/i);

          if (dateMatch) {
            try {
              const date = new Date(dateMatch[1]);
              if (!isNaN(date.getTime())) {
                metadata.releaseDate = date.toISOString().split("T")[0];
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn(`[SoundCloud Metadata] Scraping failed:`, e);
      }

      res.json(metadata);
    } catch (error: any) {
      console.error("[SoundCloud Metadata] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/soundcloud/artwork", async (req, res) => {
    let { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "SoundCloud URL is required" });
    }

    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === "m.soundcloud.com") urlObj.hostname = "soundcloud.com";
      url = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${urlObj.search}`;
    } catch (e) {}

    try {
      console.log(`[SoundCloud Artwork] Syncing for: ${url}`);
      let artworkUrl: string | null = null;

      try {
        const oEmbedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oEmbedUrl);
        if (response.ok) {
          const data = await response.json();
          artworkUrl = data.thumbnail_url;
        }
      } catch (e) {
        console.warn(`[SoundCloud Artwork] oEmbed attempt failed:`, e);
      }

      if (!artworkUrl) {
        let pageResponse = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
          },
        });

        let html = "";
        if (!pageResponse.ok) {
          if (pageResponse.status === 403) {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url as string)}`;
            const proxyResponse = await fetch(proxyUrl);
            if (proxyResponse.ok) {
              const proxyData = await proxyResponse.json();
              html = proxyData.contents;
            }
          } else if (pageResponse.status === 404) {
            return res.status(404).json({ error: "Track not found. Please ensure the URL is correct and the track is public." });
          }
        } else {
          html = await pageResponse.text();
        }

        if (html) {
          const ogImageMatch =
            html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
            html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i);
          const twitterImageMatch =
            html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i) ||
            html.match(/<meta[^>]*content="([^"]+)"[^>]*name="twitter:image"/i);
          const schemaImageMatch =
            html.match(/"image":"([^"]+)"/i) || html.match(/"thumbnailUrl":"([^"]+)"/i);

          artworkUrl = ogImageMatch?.[1] ?? twitterImageMatch?.[1] ?? schemaImageMatch?.[1] ?? null;

          if (!artworkUrl) {
            const anyImageMatch =
              html.match(/https:\/\/i1\.sndcdn\.com\/artworks-[^"]+-t500x500\.jpg/) ||
              html.match(/https:\/\/i1\.sndcdn\.com\/artworks-[^"]+-large\.jpg/) ||
              html.match(/https:\/\/i1\.sndcdn\.com\/avatars-[^"]+-t500x500\.jpg/);
            artworkUrl = anyImageMatch?.[0] ?? null;
          }
        }
      }

      if (artworkUrl) {
        let highResUrl = artworkUrl
          .replace("-large.jpg", "-t500x500.jpg")
          .replace("-t300x300.jpg", "-t500x500.jpg")
          .replace("-badge.jpg", "-t500x500.jpg");

        if (highResUrl.includes("sndcdn.com") && !highResUrl.includes("-t500x500")) {
          highResUrl = highResUrl.replace(/\.(jpg|png|jpeg)$/, "-t500x500.$1");
        }

        try {
          const imgResponse = await fetch(highResUrl);
          const targetUrl = imgResponse.ok ? highResUrl : artworkUrl;
          const finalResponse = imgResponse.ok ? imgResponse : await fetch(artworkUrl);
          if (!finalResponse.ok) throw new Error(`Failed to fetch image: ${finalResponse.status}`);
          const buffer = await finalResponse.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const mimeType = finalResponse.headers.get("content-type") ?? "image/jpeg";
          return res.json({ artworkUrl: targetUrl, base64: `data:${mimeType};base64,${base64}` });
        } catch (imgErr) {
          console.error(`[SoundCloud Artwork] Error converting image to base64:`, imgErr);
          res.json({ artworkUrl });
        }
      } else {
        res.status(404).json({ error: "Could not find artwork for this track." });
      }
    } catch (error: any) {
      console.error("[SoundCloud Artwork] Fatal error:", error);
      res.status(500).json({ error: "Internal server error during artwork sync" });
    }
  });

  app.get("/api/soundcloud/stream", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "SoundCloud URL is required" });
    }

    try {
      let clientId = "IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB";
      try {
        const scRes = await fetch("https://soundcloud.com");
        const scHtml = await scRes.text();
        const scriptUrls = Array.from(
          scHtml.matchAll(/<script crossorigin src="([^"]+)"><\/script>/g)
        ).map((m) => m[1]);
        for (const scriptUrl of scriptUrls) {
          const jsRes = await fetch(scriptUrl);
          const js = await jsRes.text();
          const match = js.match(/client_id:"([^"]+)"/);
          if (match) { clientId = match[1]; break; }
        }
      } catch (e) {
        console.warn("[SoundCloud Stream] Failed to extract client_id, using fallback");
      }

      const resolveUrl = `https://api-widget.soundcloud.com/resolve?url=${encodeURIComponent(url)}&format=json&client_id=${clientId}`;
      const resolveRes = await fetch(resolveUrl);
      if (!resolveRes.ok) throw new Error(`Failed to resolve track: ${resolveRes.status}`);
      const trackData = await resolveRes.json();

      if (!trackData.media?.transcodings) throw new Error("No media found for this track");

      const progressiveTranscoding = trackData.media.transcodings.find(
        (t: any) => t.format.protocol === "progressive"
      );
      if (!progressiveTranscoding) throw new Error("No progressive stream found for this track");

      const streamUrlRes = await fetch(`${progressiveTranscoding.url}?client_id=${clientId}`);
      if (!streamUrlRes.ok) throw new Error(`Failed to get stream URL: ${streamUrlRes.status}`);
      const streamData = await streamUrlRes.json();

      res.redirect(streamData.url);
    } catch (error: any) {
      console.error("[SoundCloud Stream] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/soundcloud/profile", async (req, res) => {
    const { profileUrl } = req.query;
    if (!profileUrl || typeof profileUrl !== "string") {
      return res.status(400).json({ error: "Profile URL is required" });
    }

    try {
      let clientId = "IvZsSdfTxP6ovYz9Nn4XGqmQVKs1vzbB";
      try {
        const scRes = await fetch("https://soundcloud.com");
        const scHtml = await scRes.text();
        const scriptUrls = Array.from(
          scHtml.matchAll(/<script crossorigin src="([^"]+)"><\/script>/g)
        ).map((m) => m[1]);
        for (const scUrl of scriptUrls) {
          const jsRes = await fetch(scUrl);
          const js = await jsRes.text();
          const match = js.match(/client_id:"([^"]+)"/);
          if (match) { clientId = match[1]; break; }
        }
      } catch (e) {
        console.warn("[SoundCloud Profile] Failed to extract client_id, using fallback");
      }

      const resolveUrl = `https://api-widget.soundcloud.com/resolve?url=${encodeURIComponent(profileUrl)}&format=json&client_id=${clientId}`;
      const resolveRes = await fetch(resolveUrl);
      if (!resolveRes.ok) throw new Error(`Failed to resolve profile: ${resolveRes.status}`);
      const userData = await resolveRes.json();
      const userId = userData.id;
      const username = userData.permalink;

      const trackLinks = new Set<string>();
      let rssUrl: string | null = `https://feeds.soundcloud.com/users/soundcloud:users:${userId}/sounds.rss`;

      while (rssUrl) {
        const rssRes = await fetch(rssUrl);
        if (!rssRes.ok) break;
        const rssText = await rssRes.text();

        const matches = rssText.match(/<link>(.*?)<\/link>/g);
        if (matches) {
          matches.forEach((m) => {
            const link = m.replace(/<\/?link>/g, "");
            if (link.includes(`soundcloud.com/${username}/`) && link !== `https://soundcloud.com/${username}`) {
              trackLinks.add(link);
            }
          });
        }

        const nextMatch = rssText.match(/<atom:link href="([^"]+)" rel="next"/);
        rssUrl = nextMatch ? nextMatch[1] : null;
      }

      res.json({ tracks: Array.from(trackLinks) });
    } catch (error: any) {
      console.error("[SoundCloud Profile] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // VITE / STATIC FILE SERVING
  // =========================================================================
  if (process.env.NODE_ENV !== "production") {
    console.log("Using Vite middleware (development mode)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files from dist (production mode)");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
