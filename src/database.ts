import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Users
// passwordHash added for local Passport.js authentication (replaces Firebase Auth)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    displayName  TEXT NOT NULL,
    alias        TEXT,
    role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    photoURL     TEXT,
    passwordHash TEXT
  );
`);

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id          TEXT PRIMARY KEY,
    title       TEXT,
    subtitle    TEXT,
    content     TEXT NOT NULL,
    isVisible   INTEGER NOT NULL DEFAULT 1,
    authorId    TEXT NOT NULL,
    authorName  TEXT NOT NULL,
    authorPhoto TEXT,
    createdAt   TEXT NOT NULL,
    FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ---------------------------------------------------------------------------
// Comments  (child of posts)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id          TEXT PRIMARY KEY,
    postId      TEXT NOT NULL,
    content     TEXT NOT NULL,
    authorId    TEXT NOT NULL,
    authorName  TEXT NOT NULL,
    authorPhoto TEXT,
    createdAt   TEXT NOT NULL,
    FOREIGN KEY (postId)   REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ---------------------------------------------------------------------------
// Settings  (keyed by a settingId, e.g. "global")
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id             TEXT PRIMARY KEY,
    aboutText      TEXT,
    instagramUrl   TEXT,
    youtubeUrl     TEXT,
    soundcloudUrl  TEXT
  );
`);

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id                    TEXT PRIMARY KEY,
    title                 TEXT NOT NULL,
    artist                TEXT NOT NULL,
    audioUrl              TEXT NOT NULL,
    coverUrl              TEXT NOT NULL,
    isVisible             INTEGER NOT NULL DEFAULT 1,
    authorId              TEXT NOT NULL,
    createdAt             TEXT NOT NULL,
    releaseDate           TEXT NOT NULL,
    trackLink             TEXT,
    genre                 TEXT,
    album                 TEXT,
    description           TEXT,
    privacy               TEXT DEFAULT 'public' CHECK (privacy IN ('public', 'private', 'scheduled')),
    buyLink               TEXT,
    recordLabel           TEXT,
    publisher             TEXT,
    soundcloudUrl         TEXT,
    isExplicit            INTEGER NOT NULL DEFAULT 0,
    enableDirectDownloads INTEGER NOT NULL DEFAULT 0,
    offlineListening      INTEGER NOT NULL DEFAULT 0,
    displayEmbedCode      INTEGER NOT NULL DEFAULT 1,
    allowComments         INTEGER NOT NULL DEFAULT 1,
    showCommentsToPublic  INTEGER NOT NULL DEFAULT 1,
    licenseType           TEXT DEFAULT 'all-rights-reserved' CHECK (licenseType IN ('all-rights-reserved', 'creative-commons')),
    FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Track.sharedWith  (array of user IDs)
db.exec(`
  CREATE TABLE IF NOT EXISTS track_shared_with (
    trackId TEXT NOT NULL,
    userId  TEXT NOT NULL,
    PRIMARY KEY (trackId, userId),
    FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (userId)  REFERENCES users(id)  ON DELETE CASCADE
  );
`);

// ---------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS albums (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    artist      TEXT,
    coverUrl    TEXT,
    releaseDate TEXT,
    description TEXT,
    isVisible   INTEGER NOT NULL DEFAULT 1,
    authorId    TEXT NOT NULL,
    createdAt   TEXT NOT NULL,
    FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Album.trackIds  (ordered list — position preserves track order)
db.exec(`
  CREATE TABLE IF NOT EXISTS album_tracks (
    albumId  TEXT    NOT NULL,
    trackId  TEXT    NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (albumId, trackId),
    FOREIGN KEY (albumId) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE
  );
`);

// ---------------------------------------------------------------------------
// Conversations  (direct messages between two or more users)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT PRIMARY KEY,
    lastMessage   TEXT,
    lastMessageAt TEXT NOT NULL,
    lastSenderId  TEXT,
    FOREIGN KEY (lastSenderId) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// Conversation.participants  (array of user IDs)
db.exec(`
  CREATE TABLE IF NOT EXISTS conversation_participants (
    conversationId TEXT NOT NULL,
    userId         TEXT NOT NULL,
    PRIMARY KEY (conversationId, userId),
    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (userId)         REFERENCES users(id)         ON DELETE CASCADE
  );
`);

// Conversation.unreadCount  (object keyed by userId)
db.exec(`
  CREATE TABLE IF NOT EXISTS conversation_unread_counts (
    conversationId TEXT    NOT NULL,
    userId         TEXT    NOT NULL,
    unreadCount    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (conversationId, userId),
    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (userId)         REFERENCES users(id)         ON DELETE CASCADE
  );
`);

// ---------------------------------------------------------------------------
// Messages  (child of conversations)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id             TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    senderId       TEXT NOT NULL,
    content        TEXT NOT NULL,
    createdAt      TEXT NOT NULL,
    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (senderId)       REFERENCES users(id)         ON DELETE CASCADE
  );
`);

// ---------------------------------------------------------------------------
// Changelog entries
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS changelog_entries (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    date        TEXT NOT NULL,
    time        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('major', 'minor')),
    createdAt   TEXT NOT NULL
  );
`);

export default db;
