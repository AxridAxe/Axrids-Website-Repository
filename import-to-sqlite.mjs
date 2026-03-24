import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('./firestore-export.json', 'utf8'));
const PI = 'http://192.168.0.34:3000';

// Helper to convert Firestore timestamp to ISO string
const toISO = (val) => {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val._seconds) return new Date(val._seconds * 1000).toISOString();
  if (val.seconds) return new Date(val.seconds * 1000).toISOString();
  return new Date().toISOString();
};

// First login as admin to get session
const loginRes = await fetch(`${PI}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'kurtdolan2@gmail.com', password: 'raspberry' }),
  credentials: 'include'
});

if (!loginRes.ok) {
  console.error('Login failed - make sure admin account exists with password "raspberry"');
  console.error(await loginRes.text());
  process.exit(1);
}

const cookies = loginRes.headers.get('set-cookie');
console.log('✓ Logged in as admin');

const headers = { 'Content-Type': 'application/json', 'Cookie': cookies };

// Import tracks
console.log('\nImporting tracks...');
let trackCount = 0;
for (const track of data.tracks || []) {
  const body = {
    id: track.id,
    title: track.title || 'Untitled',
    artist: track.artist || 'Axrid',
    audioUrl: track.audioUrl || '',
    coverUrl: track.coverUrl || '',
    isVisible: track.isVisible !== false ? 1 : 0,
    authorId: track.authorId || 'import',
    createdAt: toISO(track.createdAt),
    releaseDate: track.releaseDate || new Date().toISOString().split('T')[0],
    trackLink: track.trackLink || null,
    genre: track.genre || null,
    album: track.album || null,
    description: track.description || null,
    privacy: track.privacy || 'public',
    buyLink: track.buyLink || null,
    recordLabel: track.recordLabel || null,
    publisher: track.publisher || null,
    soundcloudUrl: track.soundcloudUrl || null,
    isExplicit: track.isExplicit ? 1 : 0,
    enableDirectDownloads: track.enableDirectDownloads ? 1 : 0,
    allowComments: track.allowComments !== false ? 1 : 0,
    showCommentsToPublic: track.showCommentsToPublic !== false ? 1 : 0,
    licenseType: track.licenseType || 'all-rights-reserved',
  };

  const res = await fetch(`${PI}/api/tracks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (res.ok) {
    trackCount++;
    console.log(`  ✓ ${track.title}`);
  } else {
    console.log(`  ✗ ${track.title}: ${await res.text()}`);
  }
}
console.log(`\n✓ Imported ${trackCount}/${data.tracks.length} tracks`);

// Import albums
console.log('\nImporting albums...');
let albumCount = 0;
for (const album of data.albums || []) {
  const body = {
    id: album.id,
    title: album.title || 'Untitled Album',
    artist: album.artist || 'Axrid',
    coverUrl: album.coverUrl || '',
    releaseDate: album.releaseDate || null,
    description: album.description || null,
    isVisible: album.isVisible !== false ? 1 : 0,
    authorId: album.authorId || 'import',
    createdAt: toISO(album.createdAt),
    trackIds: album.trackIds || [],
  };

  const res = await fetch(`${PI}/api/albums`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (res.ok) {
    albumCount++;
    console.log(`  ✓ ${album.title}`);
  } else {
    console.log(`  ✗ ${album.title}: ${await res.text()}`);
  }
}
console.log(`✓ Imported ${albumCount}/${data.albums.length} albums`);

// Import posts
console.log('\nImporting posts...');
let postCount = 0;
for (const post of data.posts || []) {
  const body = {
    id: post.id,
    title: post.title || null,
    subtitle: post.subtitle || null,
    content: post.content || '',
    isVisible: post.isVisible !== false ? 1 : 0,
    authorId: post.authorId || 'import',
    authorName: post.authorName || 'Axrid',
    authorPhoto: post.authorPhoto || null,
    createdAt: toISO(post.createdAt),
  };

  const res = await fetch(`${PI}/api/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (res.ok) {
    postCount++;
    console.log(`  ✓ ${post.title || post.id}`);
  } else {
    console.log(`  ✗ ${post.id}: ${await res.text()}`);
  }
}
console.log(`✓ Imported ${postCount}/${data.posts.length} posts`);

// Import settings
console.log('\nImporting settings...');
for (const setting of data.settings || []) {
  const res = await fetch(`${PI}/api/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(setting),
  });
  console.log(res.ok ? '  ✓ Settings imported' : `  ✗ ${await res.text()}`);
}

console.log('\nDone! All data imported.');
