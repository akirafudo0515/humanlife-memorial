const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const plans = require('./plans');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const uploadsDir = path.join(root, 'uploads');
const adminFile = path.join(dataDir, 'admin.local.txt');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'app.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) { /* already closed */ }
    throw error;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 32);
  const current = Buffer.from(hash, 'hex');
  if (current.length !== next.length) return false;
  return crypto.timingSafeEqual(current, next);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    relation TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'suspended')),
    verify_hash TEXT,
    verify_expires TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memorials (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id),
    deceased_name TEXT NOT NULL,
    years TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    story TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    capsule_status TEXT NOT NULL CHECK (capsule_status IN ('sealed', 'open')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    summary TEXT NOT NULL,
    price INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('offering', 'capsule', 'commission')),
    media_kind TEXT CHECK (media_kind IS NULL OR media_kind IN ('photo', 'video')),
    shelf TEXT NOT NULL CHECK (shelf IN ('on', 'off')),
    sort_order INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id),
    product_id TEXT REFERENCES products(id),
    payer_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('envelope', 'offering', 'capsule', 'commission')),
    item_label TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('paid')),
    service_status TEXT CHECK (service_status IS NULL OR service_status IN ('producing', 'delivered')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id),
    kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
    source TEXT NOT NULL CHECK (source IN ('family', 'house')),
    caption TEXT NOT NULL,
    file_path TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending_review', 'public', 'hidden')),
    order_id TEXT REFERENCES orders(id),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ritual_events (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id),
    type TEXT NOT NULL CHECK (type IN ('light', 'flower', 'prayer')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id),
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('ritual', 'note')),
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'hidden')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    need TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'closed')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    subject_type TEXT NOT NULL CHECK (subject_type IN ('member', 'admin')),
    subject_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL
  );
`);

const memorialColumns = db.prepare(`PRAGMA table_info(memorials)`).all().map((column) => column.name);
if (!memorialColumns.includes('birth_date')) db.exec(`ALTER TABLE memorials ADD COLUMN birth_date TEXT NOT NULL DEFAULT ''`);
if (!memorialColumns.includes('death_date')) db.exec(`ALTER TABLE memorials ADD COLUMN death_date TEXT NOT NULL DEFAULT ''`);
if (!memorialColumns.includes('frame_sku')) db.exec(`ALTER TABLE memorials ADD COLUMN frame_sku TEXT NOT NULL DEFAULT 'plain'`);
if (!memorialColumns.includes('life_state')) db.exec(`ALTER TABLE memorials ADD COLUMN life_state TEXT NOT NULL DEFAULT 'deceased'`);
if (!memorialColumns.includes('hall_kind')) db.exec(`ALTER TABLE memorials ADD COLUMN hall_kind TEXT NOT NULL DEFAULT 'single'`);
if (!memorialColumns.includes('trustee_member_id')) db.exec(`ALTER TABLE memorials ADD COLUMN trustee_member_id TEXT`);
if (!memorialColumns.includes('origin_member_id')) db.exec(`ALTER TABLE memorials ADD COLUMN origin_member_id TEXT`);

const messageColumns = db.prepare(`PRAGMA table_info(messages)`).all().map((column) => column.name);
if (!messageColumns.includes('parent_id')) db.exec(`ALTER TABLE messages ADD COLUMN parent_id TEXT`);
if (!messageColumns.includes('member_id')) db.exec(`ALTER TABLE messages ADD COLUMN member_id TEXT`);

const memberColumns = db.prepare(`PRAGMA table_info(members)`).all().map((column) => column.name);
['email_verified', 'phone_verified'].forEach((column) => {
  if (!memberColumns.includes(column)) db.exec(`ALTER TABLE members ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`);
});
['phone_verify_hash', 'phone_verify_expires', 'email_code', 'phone_code'].forEach((column) => {
  if (!memberColumns.includes(column)) db.exec(`ALTER TABLE members ADD COLUMN ${column} TEXT`);
});
db.exec(`UPDATE members SET email_verified = 1, phone_verified = 1 WHERE status = 'active' AND email_verified = 0 AND phone_verified = 0`);

const mediaColumns = db.prepare(`PRAGMA table_info(media)`).all().map((column) => column.name);
if (!mediaColumns.includes('bytes')) db.exec(`ALTER TABLE media ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0`);
if (!mediaColumns.includes('duration_seconds')) db.exec(`ALTER TABLE media ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0`);
if (!mediaColumns.includes('role')) db.exec(`ALTER TABLE media ADD COLUMN role TEXT NOT NULL DEFAULT 'album'`);

const productColumns = db.prepare(`PRAGMA table_info(products)`).all().map((column) => column.name);
if (!productColumns.includes('motion')) db.exec(`ALTER TABLE products ADD COLUMN motion TEXT NOT NULL DEFAULT 'still'`);
db.prepare(`UPDATE products SET motion = 'live' WHERE sku = 'lamp'`).run();
db.prepare(`UPDATE products SET motion = 'still' WHERE motion IS NULL OR motion NOT IN ('still', 'live')`).run();

db.exec(`
  CREATE TABLE IF NOT EXISTS room_items (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id),
    order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
    sku TEXT NOT NULL,
    label TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS checkouts (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id),
    memorial_id TEXT REFERENCES memorials(id),
    category TEXT NOT NULL,
    sku TEXT NOT NULL DEFAULT '',
    item_label TEXT NOT NULL,
    amount INTEGER NOT NULL,
    payer_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
    merchant_trade_no TEXT NOT NULL UNIQUE,
    plan_sku TEXT NOT NULL DEFAULT '',
    plan_cycle TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    paid_at TEXT
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id),
    plan_sku TEXT NOT NULL,
    cycle TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'ended')),
    amount INTEGER NOT NULL,
    merchant_trade_no TEXT NOT NULL,
    started_at TEXT,
    ends_at TEXT,
    last_paid_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS hall_visits (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id),
    member_id TEXT NOT NULL REFERENCES members(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'allowed', 'refused')),
    created_at TEXT NOT NULL,
    UNIQUE (memorial_id, member_id)
  );
  CREATE TABLE IF NOT EXISTS plan_frames (
    member_id TEXT NOT NULL REFERENCES members(id),
    sku TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (member_id, sku)
  );
  CREATE TABLE IF NOT EXISTS capsules (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    years INTEGER NOT NULL,
    opens_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS capsule_shares (
    capsule_id TEXT NOT NULL REFERENCES capsules(id),
    member_id TEXT NOT NULL REFERENCES members(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY (capsule_id, member_id)
  );
`);

const shareColumns = db.prepare(`PRAGMA table_info(capsule_shares)`).all().map((column) => column.name);
if (!shareColumns.includes('status')) {
  db.exec(`ALTER TABLE capsule_shares ADD COLUMN status TEXT NOT NULL DEFAULT 'allowed'`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS member_notices (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id),
    kind TEXT NOT NULL CHECK (kind IN ('capsule_share', 'trustee_invite')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'refused')),
    from_member_id TEXT NOT NULL REFERENCES members(id),
    memorial_id TEXT REFERENCES memorials(id),
    capsule_id TEXT REFERENCES capsules(id),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS capsule_media (
    id TEXT PRIMARY KEY,
    capsule_id TEXT NOT NULL REFERENCES capsules(id),
    caption TEXT NOT NULL,
    file_path TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'photo',
    duration_seconds INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS hall_people (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id),
    name TEXT NOT NULL,
    birth_date TEXT NOT NULL DEFAULT '',
    death_date TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    story TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const capsuleMediaColumns = db.prepare(`PRAGMA table_info(capsule_media)`).all().map((column) => column.name);
if (!capsuleMediaColumns.includes('kind')) db.exec(`ALTER TABLE capsule_media ADD COLUMN kind TEXT NOT NULL DEFAULT 'photo'`);
if (!capsuleMediaColumns.includes('duration_seconds')) db.exec(`ALTER TABLE capsule_media ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0`);

const DEFAULT_SETTINGS = {
  site_name: '時光仙境',
  site_phone: '',
  site_email: '',
  site_address: '',
  about_lead: '時光仙境為家人預備一處陽光裡的福地。\n隨時回來，把想說的話留下。'
};

const FRAME_PRODUCTS = [
  ['frame-wood', '素木框', '淺木相框，用於遺影。', 390, 21],
  ['frame-dark', '深木框', '深色木相框，用於遺影。', 390, 22],
  ['frame-ebony', '黑檀框', '黑檀相框，內緣描金。', 390, 23],
  ['frame-gold', '描金框', '金線相框，用於遺影。', 390, 24],
  ['frame-mat', '留白框', '寬邊留白，如裱褙。', 390, 25],
  ['frame-round', '圓光框', '圓角相框，用於遺影。', 390, 26],
  ['frame-lotus', '蓮紋框', '四角蓮紋，用於遺影。', 390, 27],
  ['frame-bamboo', '竹節框', '竹節相框，用於遺影。', 390, 28],
  ['frame-cloud', '雲紋框', '四角雲紋，用於遺影。', 390, 29],
  ['frame-double', '雙線框', '雙線相框，用於遺影。', 390, 30]
];

const FLOWER_PRODUCTS = [
  ['flower-lily', '百合', '獻於靈堂的一束百合。', 300, 2],
  ['flower-lotus', '素蓮', '獻於靈堂的一枝素蓮。', 300, 3],
  ['flower-orchid', '蕙蘭', '獻於靈堂的一枝蕙蘭。', 300, 4],
  ['flower-carnation', '康乃馨', '獻於靈堂的一束康乃馨。', 300, 5],
  ['flower-gladiolus', '劍蘭', '獻於靈堂的一枝劍蘭。', 300, 6]
];

const DEFAULT_PRODUCTS = [
  ['flower', '白菊', '獻於靈堂的一束白菊。', 300, 'offering', null, 1],
  ['lamp', '祈福燈座', '為先人長燃一盞燈。', 600, 'offering', null, 7],
  ['gift', '紀念禮盒', '鮮花、長燈與卡片，一併奉上。', 1200, 'offering', null, 8],
  ['capsule', '時光膠囊', '開啟後，已公開的遺影留在靈堂，親友可一同觀看。', 3000, 'capsule', null, 9],
  ['video', '生平影片', '由時光仙境製作，完成後放入頁面。', 8000, 'commission', 'video', 10],
  ['album', '紀念相簿', '由時光仙境整理照片，完成後放入頁面。', 4000, 'commission', 'photo', 11]
];

function ensureFoundations() {
  const insertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`);
  Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => insertSetting.run(key, value));
  db.prepare(`UPDATE settings SET value = '時光仙境' WHERE key = 'site_name'`).run();
  db.prepare(`UPDATE settings SET value = ? WHERE key = 'about_lead' AND (value LIKE '%人本%' OR value LIKE '%線上靈堂%' OR value LIKE '%燦陽%')`).run(DEFAULT_SETTINGS.about_lead);
  const count = db.prepare(`SELECT COUNT(*) AS n FROM products`).get().n;
  if (!count) {
    const insert = db.prepare(`INSERT INTO products (id, sku, name, summary, price, kind, media_kind, shelf, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, 'on', ?)`);
    DEFAULT_PRODUCTS.forEach((item) => insert.run(id(), ...item));
  } else {
    const revise = db.prepare(`UPDATE products SET summary = ? WHERE sku = ? AND summary = ?`);
    [
      ['lamp', '為這一頁點一盞長燈。', '為先人長燃一盞燈。'],
      ['gift', '花、燈與卡片，一併留下。', '鮮花、長燈與卡片，一併奉上。'],
      ['capsule', '開啟後，已公開的影像留在這一頁，親友可一同觀看。', '開啟後，已公開的遺影留在靈堂，親友可一同觀看。'],
      ['video', '由人本製作，完成後放入靈堂。', '由時光仙境製作，完成後放入頁面。'],
      ['video', '由人本製作，完成後奉入靈堂。', '由時光仙境製作，完成後放入頁面。'],
      ['video', '由燦陽製作，完成後放入頁面。', '由時光仙境製作，完成後放入頁面。'],
      ['album', '由人本整理照片，完成後放入靈堂。', '由時光仙境整理照片，完成後放入頁面。'],
      ['album', '由人本整理遺影，完成後奉入靈堂。', '由時光仙境整理照片，完成後放入頁面。'],
      ['album', '由燦陽整理照片，完成後放入頁面。', '由時光仙境整理照片，完成後放入頁面。']
    ].forEach(([sku, previous, next]) => revise.run(next, sku, previous));
  }
  db.prepare(`UPDATE products SET name = '白菊', summary = '獻於靈堂的一束白菊。' WHERE sku = 'flower' AND name = '追思花禮'`).run();
  db.prepare(`UPDATE products SET shelf = 'off' WHERE sku = 'capsule'`).run();
  [
    ['lamp', 2, 7],
    ['gift', 3, 8],
    ['capsule', 4, 9],
    ['video', 5, 10],
    ['album', 6, 11]
  ].forEach(([sku, from, to]) => {
    db.prepare(`UPDATE products SET sort_order = ? WHERE sku = ? AND sort_order = ?`).run(to, sku, from);
  });
  const insertFlower = db.prepare(`INSERT INTO products (id, sku, name, summary, price, kind, media_kind, shelf, sort_order) VALUES (?, ?, ?, ?, ?, 'offering', null, 'on', ?)`);
  FLOWER_PRODUCTS.forEach((item) => {
    const found = db.prepare(`SELECT id FROM products WHERE sku = ?`).get(item[0]);
    if (!found) insertFlower.run(id(), ...item);
  });
  const sea = db.prepare(`SELECT id FROM products WHERE sku = 'flower-sea'`).get();
  if (!sea) {
    insertFlower.run(id(), 'flower-sea', '花海', '安放在遺影前方。一份為完整單座；兩份左右接成滿版連貫花海。', 800, 12);
  } else {
    db.prepare(`UPDATE products SET summary = '安放在遺影前方。一份為完整單座；兩份左右接成滿版連貫花海。' WHERE sku = 'flower-sea'`).run();
  }
  const insertFrame = db.prepare(`INSERT INTO products (id, sku, name, summary, price, kind, media_kind, shelf, sort_order) VALUES (?, ?, ?, ?, ?, 'offering', null, 'on', ?)`);
  FRAME_PRODUCTS.forEach((item) => {
    const found = db.prepare(`SELECT id FROM products WHERE sku = ?`).get(item[0]);
    if (!found) insertFrame.run(id(), ...item);
  });
  const bundle = db.prepare(`SELECT id FROM products WHERE sku = 'frame-set'`).get();
  if (!bundle) insertFrame.run(id(), 'frame-set', '十款相框', '十款相框一併奉上，之後都可換在遺影上。', 2900, 31);
  const admin = db.prepare(`SELECT username FROM admin_users LIMIT 1`).get();
  if (admin) return;
  const password = crypto.randomBytes(9).toString('base64url');
  db.prepare(`INSERT INTO admin_users (id, username, password_hash) VALUES (?, 'admin', ?)`).run(id(), hashPassword(password));
  fs.writeFileSync(adminFile, `username=admin\npassword=${password}\n`, { encoding: 'utf8' });
}

function getSettings() {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  const settings = { ...DEFAULT_SETTINGS };
  rows.forEach((row) => { settings[row.key] = row.value; });
  return settings;
}

function saveSettings(values) {
  const update = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  transaction(() => {
    ['site_phone', 'site_email', 'site_address', 'about_lead'].forEach((key) => {
      if (values[key] !== undefined) update.run(key, values[key]);
    });
  });
}

function createMember({ name, email, phone, password, relation }) {
  const memberId = id();
  db.prepare(`INSERT INTO members (id, name, email, phone, password_hash, relation, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).run(
    memberId, name, email, phone, hashPassword(password), relation, now()
  );
  return getMember(memberId);
}

function getMember(memberId) {
  return db.prepare(`SELECT * FROM members WHERE id = ?`).get(memberId) || null;
}

function getMemberByEmail(email) {
  return db.prepare(`SELECT * FROM members WHERE email = ?`).get(email) || null;
}

function listMembers() {
  return db.prepare(`SELECT id, name, email, phone, relation, status, email_verified, phone_verified, email_code, phone_code, created_at FROM members ORDER BY created_at DESC`).all();
}

function setMemberStatus(memberId, status) {
  db.prepare(`UPDATE members SET status = ? WHERE id = ? AND status != 'pending'`).run(status, memberId);
}

function issueVerifyCode(memberId) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare(`UPDATE members SET verify_hash = ?, verify_expires = ?, email_code = ?, email_verified = 0 WHERE id = ? AND status = 'pending'`).run(hashToken(code), expires, code, memberId);
  return code;
}

function issuePhoneCode(memberId) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare(`UPDATE members SET phone_verify_hash = ?, phone_verify_expires = ?, phone_code = ?, phone_verified = 0 WHERE id = ? AND status = 'pending'`).run(hashToken(code), expires, code, memberId);
  return code;
}

function markChannel(member, channel) {
  if (channel === 'email') db.prepare(`UPDATE members SET email_verified = 1, verify_hash = NULL, verify_expires = NULL, email_code = NULL WHERE id = ?`).run(member.id);
  else db.prepare(`UPDATE members SET phone_verified = 1, phone_verify_hash = NULL, phone_verify_expires = NULL, phone_code = NULL WHERE id = ?`).run(member.id);
  const next = getMember(member.id);
  if (next.email_verified && next.phone_verified) {
    db.prepare(`UPDATE members SET status = 'active' WHERE id = ? AND status = 'pending'`).run(member.id);
    return 'verified';
  }
  return 'partial';
}

function consumeVerifyCode(email, code, channel) {
  const member = getMemberByEmail(email);
  if (!member || member.status === 'suspended') return 'missing';
  if (member.status === 'active') return 'active';
  const given = Buffer.from(hashToken(String(code || '').trim()), 'hex');
  const hash = channel === 'phone' ? member.phone_verify_hash : member.verify_hash;
  const expires = channel === 'phone' ? member.phone_verify_expires : member.verify_expires;
  const current = Buffer.from(hash || '', 'hex');
  if (current.length !== given.length || !crypto.timingSafeEqual(current, given)) return 'bad';
  if (!expires || expires <= now()) return 'expired';
  return markChannel(member, channel === 'phone' ? 'phone' : 'email');
}

function createSession(type, subjectId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions (id, subject_type, subject_id, token, expires_at) VALUES (?, ?, ?, ?, ?)`).run(
    id(), type, subjectId, token, expires
  );
  return token;
}

function readSession(token) {
  if (!token) return null;
  return db.prepare(`SELECT * FROM sessions WHERE token = ? AND expires_at > ?`).get(token, now()) || null;
}

function deleteSession(token) {
  if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

function verifyAdmin(username, password) {
  const row = db.prepare(`SELECT id, password_hash FROM admin_users WHERE username = ?`).get(username);
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return row;
}

function listProducts(shelf) {
  if (shelf) return db.prepare(`SELECT * FROM products WHERE shelf = ? ORDER BY sort_order`).all(shelf);
  return db.prepare(`SELECT * FROM products ORDER BY sort_order`).all();
}

function getProduct(productId) {
  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId) || null;
}

function getProductBySku(sku) {
  return db.prepare(`SELECT * FROM products WHERE sku = ?`).get(sku) || null;
}

function updateProduct(productId, { name, summary, price, shelf, motion }) {
  const kind = motion === 'live' ? 'live' : 'still';
  db.prepare(`UPDATE products SET name = ?, summary = ?, price = ?, shelf = ?, motion = ? WHERE id = ?`).run(name, summary, price, shelf, kind, productId);
}

function inviteCode() {
  return crypto.randomBytes(6).toString('hex');
}

function createMemorial({ memberId, deceasedName, birthDate, deathDate, years, title, story, lifeState, hallKind }) {
  const memorialId = id();
  const kind = hallKind === 'family' ? 'family' : 'single';
  const life = kind === 'family' ? 'deceased' : (lifeState === 'deceased' ? 'deceased' : 'living');
  db.prepare(`INSERT INTO memorials (id, member_id, deceased_name, birth_date, death_date, years, title, story, invite_code, capsule_status, created_at, life_state, hall_kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sealed', ?, ?, ?)`).run(
    memorialId, memberId, deceasedName, birthDate || '', deathDate || '', years, title, story, inviteCode(), now(), life, kind
  );
  return getMemorial(memorialId);
}

function updateMemorial(memorialId, { deceasedName, birthDate, deathDate, years, title, story }) {
  db.prepare(`UPDATE memorials SET deceased_name = ?, birth_date = ?, death_date = ?, years = ?, title = ?, story = ? WHERE id = ?`).run(
    deceasedName, birthDate, deathDate, years, title, story, memorialId
  );
  return getMemorial(memorialId);
}

function getMemorial(memorialId) {
  return db.prepare(`SELECT * FROM memorials WHERE id = ?`).get(memorialId) || null;
}

function getMemorialByCode(code) {
  return db.prepare(`SELECT * FROM memorials WHERE invite_code = ?`).get(code) || null;
}

function listMemorialsByMember(memberId) {
  return db.prepare(`SELECT * FROM memorials WHERE member_id = ? ORDER BY created_at DESC`).all(memberId);
}

function listMemorialsAsTrustee(memberId) {
  return db.prepare(`
    SELECT memorials.*, members.name AS owner_name
    FROM memorials
    JOIN members ON members.id = memorials.member_id
    WHERE memorials.trustee_member_id = ? AND memorials.life_state = 'living'
    ORDER BY memorials.created_at DESC
  `).all(memberId);
}

function listMemorialsAdmin() {
  return db.prepare(`
    SELECT memorials.*, members.name AS member_name, members.email AS member_email
    FROM memorials JOIN members ON members.id = memorials.member_id
    ORDER BY memorials.created_at DESC
  `).all();
}

function addMedia({ memorialId, kind, source, caption, filePath, status, orderId, bytes, durationSeconds, role }) {
  const mediaId = id();
  db.prepare(`INSERT INTO media (id, memorial_id, kind, source, caption, file_path, status, order_id, created_at, bytes, duration_seconds, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    mediaId, memorialId, kind, source, caption, filePath || null, status, orderId || null, now(), bytes || 0, durationSeconds || 0, role === 'portrait' ? 'portrait' : 'album'
  );
  return getMedia(mediaId);
}

function getMedia(mediaId) {
  return db.prepare(`SELECT * FROM media WHERE id = ?`).get(mediaId) || null;
}

function listMedia(memorialId) {
  return db.prepare(`SELECT * FROM media WHERE memorial_id = ? ORDER BY created_at DESC`).all(memorialId);
}

function listPublicMedia(memorialId) {
  return db.prepare(`SELECT * FROM media WHERE memorial_id = ? AND status = 'public' AND file_path IS NOT NULL ORDER BY created_at`).all(memorialId);
}

function listMediaAdmin() {
  return db.prepare(`
    SELECT media.*, memorials.deceased_name
    FROM media JOIN memorials ON memorials.id = media.memorial_id
    ORDER BY media.created_at DESC
  `).all();
}

function setMediaStatus(mediaId, status) {
  const row = getMedia(mediaId);
  if (!row || !row.file_path) return false;
  db.prepare(`UPDATE media SET status = ? WHERE id = ?`).run(status, mediaId);
  return true;
}

function listRitualsAdmin() {
  return db.prepare(`
    SELECT ritual_events.*, memorials.deceased_name
    FROM ritual_events JOIN memorials ON memorials.id = ritual_events.memorial_id
    ORDER BY ritual_events.created_at DESC
  `).all();
}

function confirmMember(memberId) {
  const result = db.prepare(`UPDATE members SET status = 'active', email_verified = 1, phone_verified = 1, verify_hash = NULL, verify_expires = NULL, phone_verify_hash = NULL, phone_verify_expires = NULL, email_code = NULL, phone_code = NULL WHERE id = ? AND status = 'pending'`).run(memberId);
  return result.changes > 0;
}

function addRitual(memorialId, type) {
  db.prepare(`INSERT INTO ritual_events (id, memorial_id, type, created_at) VALUES (?, ?, ?, ?)`).run(id(), memorialId, type, now());
}

function ritualCounts(memorialId) {
  const rows = db.prepare(`SELECT type, COUNT(*) AS n FROM ritual_events WHERE memorial_id = ? GROUP BY type`).all(memorialId);
  const counts = { light: 0, flower: 0, prayer: 0 };
  rows.forEach((row) => { counts[row.type] = row.n; });
  return counts;
}

function addMessage({ memorialId, author, body, parentId, memberId }) {
  db.prepare(`INSERT INTO messages (id, memorial_id, author, body, kind, visibility, created_at, parent_id, member_id) VALUES (?, ?, ?, ?, 'note', 'public', ?, ?, ?)`).run(
    id(), memorialId, author, body, now(), parentId || null, memberId || null
  );
}

function listPublicMessages(memorialId) {
  return db.prepare(`SELECT * FROM messages WHERE memorial_id = ? AND visibility = 'public' AND kind = 'note' ORDER BY created_at DESC`).all(memorialId);
}

function listMessagesAdmin() {
  return db.prepare(`
    SELECT messages.*, memorials.deceased_name
    FROM messages JOIN memorials ON memorials.id = messages.memorial_id
    WHERE messages.kind = 'note'
    ORDER BY messages.created_at DESC
  `).all();
}

function hideMessage(messageId) {
  db.prepare(`UPDATE messages SET visibility = 'hidden' WHERE id = ?`).run(messageId);
}

function listRoomItems(memorialId) {
  return db.prepare(`
    SELECT room_items.id, room_items.sku, room_items.label, room_items.x, room_items.y,
      COALESCE(products.motion, 'still') AS motion
    FROM room_items
    LEFT JOIN products ON products.sku = room_items.sku
    WHERE room_items.memorial_id = ?
    ORDER BY room_items.created_at
  `).all(memorialId);
}

function addRoomItem({ memorialId, orderId, sku, label }) {
  const existing = db.prepare(`SELECT id FROM room_items WHERE order_id = ?`).get(orderId);
  if (existing) return existing.id;
  const itemId = id();
  db.prepare(`INSERT INTO room_items (id, memorial_id, order_id, sku, label, x, y, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    itemId, memorialId, orderId, sku || 'gift', label || '奉上', 50, 78, now()
  );
  return itemId;
}

function backfillRoomItems() {
  const rows = db.prepare(`
    SELECT orders.id AS order_id, orders.memorial_id, orders.item_label, products.sku
    FROM orders
    JOIN products ON products.id = orders.product_id
    WHERE orders.category = 'offering'
      AND products.sku NOT LIKE 'frame-%'
      AND NOT EXISTS (SELECT 1 FROM room_items WHERE room_items.order_id = orders.id)
    ORDER BY orders.created_at
  `).all();
  rows.forEach((row) => addRoomItem({
    memorialId: row.memorial_id,
    orderId: row.order_id,
    sku: row.sku,
    label: row.item_label
  }));
}

function listOwnedFrames(memorialId) {
  const rows = db.prepare(`
    SELECT DISTINCT products.sku
    FROM orders
    JOIN products ON products.id = orders.product_id
    WHERE orders.memorial_id = ? AND orders.status = 'paid' AND products.sku LIKE 'frame-%'
  `).all(memorialId).map((row) => row.sku);
  if (!rows.includes('frame-set')) return rows;
  const all = db.prepare(`SELECT sku FROM products WHERE sku LIKE 'frame-%' AND sku != 'frame-set'`).all().map((row) => row.sku);
  return [...new Set([...rows.filter((sku) => sku !== 'frame-set'), ...all])];
}

function setMemorialFrame(memorialId, sku) {
  db.prepare(`UPDATE memorials SET frame_sku = ? WHERE id = ?`).run(sku, memorialId);
}

function saveRoomLayout(memorialId, items) {
  const update = db.prepare(`UPDATE room_items SET x = ?, y = ? WHERE id = ? AND memorial_id = ?`);
  transaction(() => {
    items.forEach((item) => {
      const x = Number(item.x);
      const y = Number(item.y);
      if (!item.id || !Number.isFinite(x) || !Number.isFinite(y)) return;
      update.run(
        Math.min(94, Math.max(6, x)),
        Math.min(92, Math.max(46, y)),
        String(item.id),
        memorialId
      );
    });
  });
}

function addOrder({ memorialId, productId, payerName, category, itemLabel, amount, serviceStatus }) {
  const orderId = id();
  db.prepare(`INSERT INTO orders (id, memorial_id, product_id, payer_name, category, item_label, amount, status, service_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`).run(
    orderId, memorialId, productId || null, payerName, category, itemLabel, amount, serviceStatus || null, now()
  );
  return orderId;
}

function listOrders() {
  return db.prepare(`
    SELECT orders.*, memorials.deceased_name
    FROM orders JOIN memorials ON memorials.id = orders.memorial_id
    ORDER BY orders.created_at DESC
  `).all();
}

function getOrder(orderId) {
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) || null;
}

function pageTotal(memorialId) {
  return db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM orders WHERE memorial_id = ? AND status = 'paid'`).get(memorialId).n;
}

function openCapsule(memorial, product, payerName) {
  if (!product || product.kind !== 'capsule' || product.shelf !== 'on') return 'off-shelf';
  if (memorial.capsule_status === 'open') return 'already-open';
  transaction(() => {
    addOrder({
      memorialId: memorial.id,
      productId: product.id,
      payerName,
      category: 'capsule',
      itemLabel: product.name,
      amount: product.price
    });
    db.prepare(`UPDATE memorials SET capsule_status = 'open' WHERE id = ?`).run(memorial.id);
  });
  return 'opened';
}

function orderCommission(memorial, product, payerName) {
  if (!product || product.kind !== 'commission' || product.shelf !== 'on') return 'off-shelf';
  addOrder({
    memorialId: memorial.id,
    productId: product.id,
    payerName,
    category: 'commission',
    itemLabel: product.name,
    amount: product.price,
    serviceStatus: 'producing'
  });
  return 'ordered';
}

function deliverOrder(orderId, { filePath, caption }) {
  const order = getOrder(orderId);
  if (!order || order.category !== 'commission' || order.service_status !== 'producing') return false;
  const product = order.product_id ? getProduct(order.product_id) : null;
  const kind = product && product.media_kind === 'video' ? 'video' : 'photo';
  transaction(() => {
    addMedia({
      memorialId: order.memorial_id,
      kind,
      source: 'house',
      caption: caption || order.item_label,
      filePath,
      status: 'public',
      orderId: order.id
    });
    db.prepare(`UPDATE orders SET service_status = 'delivered' WHERE id = ?`).run(order.id);
  });
  return true;
}

function addInquiry({ name, contact, need }) {
  db.prepare(`INSERT INTO inquiries (id, name, contact, need, status, created_at) VALUES (?, ?, ?, ?, 'new', ?)`).run(
    id(), name, contact, need || '', now()
  );
}

function listInquiries() {
  return db.prepare(`SELECT * FROM inquiries ORDER BY created_at DESC`).all();
}

function setInquiryStatus(inquiryId, status) {
  db.prepare(`UPDATE inquiries SET status = ? WHERE id = ?`).run(status, inquiryId);
}

function adminSnapshot() {
  const members = listMembers().map((item) => ({ ...item, plan_name: memberPlan(item.id).name }));
  const rituals = listRitualsAdmin();
  const messages = listMessagesAdmin();
  const orders = listOrders();
  const media = listMediaAdmin();
  const inquiries = listInquiries();
  const ritualMap = {};
  rituals.forEach((item) => {
    const row = ritualMap[item.memorial_id] || { light: 0, flower: 0, prayer: 0 };
    row[item.type] += 1;
    ritualMap[item.memorial_id] = row;
  });
  const messageMap = {};
  messages.forEach((item) => {
    if (item.visibility === 'public') messageMap[item.memorial_id] = (messageMap[item.memorial_id] || 0) + 1;
  });
  const moneyMap = {};
  orders.forEach((item) => {
    moneyMap[item.memorial_id] = (moneyMap[item.memorial_id] || 0) + item.amount;
  });
  const memorials = listMemorialsAdmin().map((item) => {
    const rites = ritualMap[item.id] || { light: 0, flower: 0, prayer: 0 };
    return {
      ...item,
      light_count: rites.light,
      flower_count: rites.flower,
      prayer_count: rites.prayer,
      message_count: messageMap[item.id] || 0,
      revenue: moneyMap[item.id] || 0
    };
  });
  const amount = (category) => orders.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0);
  const countStatus = (status) => members.filter((item) => item.status === status).length;
  return {
    members,
    memorials,
    products: listProducts(),
    media,
    messages,
    rituals,
    orders,
    inquiries,
    totals: {
      members: members.length,
      membersPending: countStatus('pending'),
      membersActive: countStatus('active'),
      membersSuspended: countStatus('suspended'),
      memorials: memorials.length,
      capsulesOpen: memorials.filter((item) => item.capsule_status === 'open').length,
      lights: rituals.filter((item) => item.type === 'light').length,
      flowers: rituals.filter((item) => item.type === 'flower').length,
      prayers: rituals.filter((item) => item.type === 'prayer').length,
      messages: messages.filter((item) => item.visibility === 'public').length,
      messagesHidden: messages.filter((item) => item.visibility === 'hidden').length,
      revenue: orders.reduce((sum, item) => sum + item.amount, 0),
      envelope: amount('envelope'),
      offering: amount('offering'),
      capsule: amount('capsule'),
      commission: amount('commission'),
      mediaPending: media.filter((item) => item.status === 'pending_review').length,
      inquiriesNew: inquiries.filter((item) => item.status === 'new').length,
      producing: orders.filter((item) => item.service_status === 'producing').length
    }
  };
}

function memberByPhone(phone) {
  return db.prepare(`SELECT id, email, status FROM members WHERE phone = ?`).get(phone) || null;
}

function activeSubscription(memberId) {
  return db.prepare(`SELECT * FROM subscriptions WHERE member_id = ? AND status = 'active' AND ends_at > ? ORDER BY ends_at DESC`).get(memberId, now()) || null;
}

function memberPlan(memberId) {
  const row = activeSubscription(memberId);
  const plan = plans.planBySku(row ? row.plan_sku : 'free');
  return { ...plan, cycle: row ? row.cycle : '', endsAt: row ? row.ends_at : '', subscriptionId: row ? row.id : '' };
}

function memberUsage(memberId) {
  const hall = db.prepare(`
    SELECT
      COALESCE(SUM(media.bytes), 0) AS bytes,
      COALESCE(SUM(CASE WHEN media.kind = 'photo' THEN 1 ELSE 0 END), 0) AS photos,
      COALESCE(SUM(CASE WHEN media.kind = 'video' THEN media.duration_seconds ELSE 0 END), 0) AS video_seconds
    FROM media
    JOIN memorials ON memorials.id = media.memorial_id
    WHERE memorials.member_id = ?
  `).get(memberId);
  const capsule = db.prepare(`
    SELECT
      COALESCE(SUM(capsule_media.bytes), 0) AS bytes,
      COALESCE(SUM(CASE WHEN capsule_media.kind = 'photo' OR capsule_media.kind IS NULL THEN 1 ELSE 0 END), 0) AS photos,
      COALESCE(SUM(CASE WHEN capsule_media.kind = 'video' THEN capsule_media.duration_seconds ELSE 0 END), 0) AS video_seconds
    FROM capsule_media
    JOIN capsules ON capsules.id = capsule_media.capsule_id
    WHERE capsules.member_id = ?
  `).get(memberId);
  return {
    bytes: hall.bytes + capsule.bytes,
    photos: hall.photos + capsule.photos,
    video_seconds: hall.video_seconds + capsule.video_seconds,
    hall_bytes: hall.bytes,
    capsule_bytes: capsule.bytes,
    hall_photos: hall.photos,
    capsule_photos: capsule.photos,
    hall_video_seconds: hall.video_seconds,
    capsule_video_seconds: capsule.video_seconds
  };
}

function memberUsageDetail(memberId) {
  const total = memberUsage(memberId);
  const halls = db.prepare(`
    SELECT
      memorials.id,
      memorials.deceased_name,
      memorials.life_state,
      memorials.hall_kind,
      COALESCE(SUM(media.bytes), 0) AS bytes,
      COALESCE(SUM(CASE WHEN media.kind = 'photo' THEN 1 ELSE 0 END), 0) AS photos,
      COALESCE(SUM(CASE WHEN media.kind = 'video' THEN media.duration_seconds ELSE 0 END), 0) AS video_seconds
    FROM memorials
    LEFT JOIN media ON media.memorial_id = memorials.id
    WHERE memorials.member_id = ?
    GROUP BY memorials.id
    ORDER BY bytes DESC, memorials.created_at DESC
  `).all(memberId);
  const capsules = db.prepare(`
    SELECT
      capsules.id,
      capsules.title,
      capsules.opens_at,
      COALESCE(SUM(capsule_media.bytes), 0) AS bytes,
      COALESCE(SUM(CASE WHEN capsule_media.kind = 'photo' OR capsule_media.kind IS NULL THEN 1 ELSE 0 END), 0) AS photos,
      COALESCE(SUM(CASE WHEN capsule_media.kind = 'video' THEN capsule_media.duration_seconds ELSE 0 END), 0) AS video_seconds
    FROM capsules
    LEFT JOIN capsule_media ON capsule_media.capsule_id = capsules.id
    WHERE capsules.member_id = ?
    GROUP BY capsules.id
    ORDER BY bytes DESC, capsules.created_at DESC
  `).all(memberId);
  return { ...total, halls, capsules };
}

function hallAllowance(memberId) {
  const plan = memberPlan(memberId);
  const halls = db.prepare(`SELECT id, hall_kind, life_state, created_at FROM memorials WHERE member_id = ? ORDER BY created_at`).all(memberId);
  const livingPages = halls.filter((item) => item.hall_kind !== 'family' && item.life_state === 'living');
  const deceasedHalls = halls.filter((item) => item.hall_kind !== 'family' && item.life_state !== 'living');
  const families = halls.filter((item) => item.hall_kind === 'family');
  return {
    plan,
    usage: memberUsage(memberId),
    livingCount: livingPages.length,
    hallCount: deceasedHalls.length,
    familyCount: families.length,
    canCreate: livingPages.length < (plan.living || 0),
    canCreateFamily: families.length < (plan.family || 0),
    canConvert: deceasedHalls.length < (plan.halls || 0),
    openIds: [
      ...livingPages.slice(0, plan.living || 0),
      ...deceasedHalls.slice(0, plan.halls || 0),
      ...families.slice(0, plan.family || 0)
    ].map((item) => item.id)
  };
}

function planFrameSkus(memberId) {
  return db.prepare(`SELECT sku FROM plan_frames WHERE member_id = ?`).all(memberId).map((row) => row.sku);
}

function grantPlanFrame(memberId, sku) {
  db.prepare(`INSERT INTO plan_frames (member_id, sku, created_at) VALUES (?, ?, ?) ON CONFLICT(member_id, sku) DO NOTHING`).run(memberId, sku, now());
}

function visitOf(memorialId, memberId) {
  return db.prepare(`SELECT * FROM hall_visits WHERE memorial_id = ? AND member_id = ?`).get(memorialId, memberId) || null;
}

function askVisit(memorialId, memberId) {
  const existing = visitOf(memorialId, memberId);
  if (existing) return existing.status;
  db.prepare(`INSERT INTO hall_visits (id, memorial_id, member_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)`).run(id(), memorialId, memberId, now());
  return 'pending';
}

function setVisit(memorialId, memberId, status) {
  db.prepare(`UPDATE hall_visits SET status = ? WHERE memorial_id = ? AND member_id = ?`).run(status, memorialId, memberId);
}

function listVisits(memorialId) {
  return db.prepare(`
    SELECT hall_visits.*, members.name, members.email, members.relation
    FROM hall_visits JOIN members ON members.id = hall_visits.member_id
    WHERE hall_visits.memorial_id = ?
    ORDER BY hall_visits.created_at DESC
  `).all(memorialId);
}

function createCheckout({ memberId, memorialId, category, sku, itemLabel, amount, payerName, planSku, planCycle, tradeNo }) {
  const checkoutId = id();
  db.prepare(`INSERT INTO checkouts (id, member_id, memorial_id, category, sku, item_label, amount, payer_name, status, merchant_trade_no, plan_sku, plan_cycle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`).run(
    checkoutId, memberId, memorialId || null, category, sku || '', itemLabel, amount, payerName, tradeNo, planSku || '', planCycle || '', now()
  );
  return getCheckout(checkoutId);
}

function getCheckout(checkoutId) {
  return db.prepare(`SELECT * FROM checkouts WHERE id = ?`).get(checkoutId) || null;
}

function getCheckoutByTrade(tradeNo) {
  return db.prepare(`SELECT * FROM checkouts WHERE merchant_trade_no = ?`).get(tradeNo) || null;
}

function extendSubscription(memberId, planSku, cycle, amount, tradeNo) {
  const gap = cycle === 'year' ? 300 : 20;
  const current = activeSubscription(memberId);
  if (current && current.plan_sku === planSku && current.cycle === cycle && current.last_paid_at) {
    const since = Date.now() - new Date(current.last_paid_at).getTime();
    if (since < gap * 24 * 60 * 60 * 1000) return current;
  }
  const startFrom = current && new Date(current.ends_at) > new Date() ? current.ends_at : now();
  const ends = plans.addCycle(startFrom, cycle);
  if (current && current.plan_sku === planSku && current.cycle === cycle) {
    db.prepare(`UPDATE subscriptions SET ends_at = ?, last_paid_at = ?, amount = ? WHERE id = ?`).run(ends, now(), amount, current.id);
    return activeSubscription(memberId);
  }
  db.prepare(`UPDATE subscriptions SET status = 'ended' WHERE member_id = ? AND status = 'active'`).run(memberId);
  db.prepare(`INSERT INTO subscriptions (id, member_id, plan_sku, cycle, status, amount, merchant_trade_no, started_at, ends_at, last_paid_at, created_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`).run(
    id(), memberId, planSku, cycle, amount, tradeNo, now(), ends, now(), now()
  );
  return activeSubscription(memberId);
}

function fulfillCheckout(checkout) {
  if (!checkout || checkout.status === 'paid') return checkout;
  if (checkout.status === 'failed') return null;
  transaction(() => {
    const paid = db.prepare(`UPDATE checkouts SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'`).run(now(), checkout.id);
    if (!paid.changes) return;
    if (checkout.category === 'plan') {
      extendSubscription(checkout.member_id, checkout.plan_sku, checkout.plan_cycle, checkout.amount, checkout.merchant_trade_no);
      return;
    }
    const product = checkout.sku ? getProductBySku(checkout.sku) : null;
    const orderId = addOrder({
      memorialId: checkout.memorial_id,
      productId: product ? product.id : null,
      payerName: checkout.payer_name,
      category: checkout.category,
      itemLabel: checkout.item_label,
      amount: checkout.amount,
      serviceStatus: checkout.category === 'commission' ? 'producing' : null
    });
    if (checkout.category === 'offering' && String(checkout.sku).startsWith('frame-')) {
      if (checkout.sku !== 'frame-set') setMemorialFrame(checkout.memorial_id, checkout.sku);
    } else if (checkout.category === 'offering') {
      addRoomItem({ memorialId: checkout.memorial_id, orderId, sku: checkout.sku, label: checkout.item_label });
    } else if (checkout.category === 'capsule') {
      db.prepare(`UPDATE memorials SET capsule_status = 'open' WHERE id = ?`).run(checkout.memorial_id);
    }
  });
  return getCheckout(checkout.id);
}

function endSubscription(memberId) {
  db.prepare(`UPDATE subscriptions SET status = 'ended' WHERE member_id = ? AND status = 'active'`).run(memberId);
}

function failCheckout(checkout) {
  if (!checkout || checkout.status !== 'pending') return;
  db.prepare(`UPDATE checkouts SET status = 'failed' WHERE id = ?`).run(checkout.id);
}

function trustCount(memberId) {
  const active = db.prepare(`SELECT COUNT(*) AS n FROM memorials WHERE trustee_member_id = ?`).get(memberId).n;
  const pending = db.prepare(`
    SELECT COUNT(*) AS n FROM member_notices
    WHERE member_id = ? AND kind = 'trustee_invite' AND status = 'pending'
  `).get(memberId).n;
  return active + pending;
}

function setTrustee(memorialId, memberId) {
  db.prepare(`UPDATE memorials SET trustee_member_id = ? WHERE id = ? AND life_state = 'living'`).run(memberId, memorialId);
  return getMemorial(memorialId);
}

function clearTrustee(memorialId) {
  db.prepare(`UPDATE memorials SET trustee_member_id = NULL WHERE id = ? AND life_state = 'living'`).run(memorialId);
  cancelPendingTrusteeInvites(memorialId);
  return getMemorial(memorialId);
}

function cancelPendingTrusteeInvites(memorialId) {
  db.prepare(`
    UPDATE member_notices SET status = 'refused'
    WHERE memorial_id = ? AND kind = 'trustee_invite' AND status = 'pending'
  `).run(memorialId);
}

function pendingTrusteeInvite(memorialId) {
  return db.prepare(`
    SELECT member_notices.*, members.name, members.email
    FROM member_notices
    JOIN members ON members.id = member_notices.member_id
    WHERE member_notices.memorial_id = ?
      AND member_notices.kind = 'trustee_invite'
      AND member_notices.status = 'pending'
    ORDER BY member_notices.created_at DESC
    LIMIT 1
  `).get(memorialId) || null;
}

function inviteTrustee(memorialId, fromMemberId, toMemberId) {
  return transaction(() => {
    cancelPendingTrusteeInvites(memorialId);
    db.prepare(`UPDATE memorials SET trustee_member_id = NULL WHERE id = ? AND life_state = 'living'`).run(memorialId);
    const noticeId = id();
    db.prepare(`
      INSERT INTO member_notices (id, member_id, kind, status, from_member_id, memorial_id, capsule_id, created_at)
      VALUES (?, ?, 'trustee_invite', 'pending', ?, ?, NULL, ?)
    `).run(noticeId, toMemberId, fromMemberId, memorialId, now());
    return getNotice(noticeId);
  });
}

function getNotice(noticeId) {
  return db.prepare(`SELECT * FROM member_notices WHERE id = ?`).get(noticeId) || null;
}

function listNoticesForMember(memberId) {
  return db.prepare(`
    SELECT
      member_notices.*,
      from_member.name AS from_name,
      from_member.email AS from_email,
      memorials.deceased_name AS memorial_name,
      memorials.invite_code AS memorial_code,
      capsules.opens_at AS capsule_opens_at,
      capsules.title AS capsule_title
    FROM member_notices
    JOIN members AS from_member ON from_member.id = member_notices.from_member_id
    LEFT JOIN memorials ON memorials.id = member_notices.memorial_id
    LEFT JOIN capsules ON capsules.id = member_notices.capsule_id
    WHERE member_notices.member_id = ?
    ORDER BY
      CASE member_notices.status WHEN 'pending' THEN 0 ELSE 1 END,
      member_notices.created_at DESC
  `).all(memberId);
}

function pendingNoticeCount(memberId) {
  return db.prepare(`
    SELECT COUNT(*) AS n FROM member_notices
    WHERE member_id = ? AND status = 'pending'
  `).get(memberId).n;
}

function respondNotice(noticeId, memberId, decision) {
  const notice = getNotice(noticeId);
  if (!notice || notice.member_id !== memberId || notice.status !== 'pending') return 'missing';
  const status = decision === 'accepted' ? 'accepted' : 'refused';
  if (notice.kind === 'trustee_invite') {
    if (status === 'accepted') {
      const memorial = getMemorial(notice.memorial_id);
      if (!memorial || memorial.life_state !== 'living') {
        db.prepare(`UPDATE member_notices SET status = 'refused' WHERE id = ?`).run(noticeId);
        return 'missing';
      }
      const cap = memberPlan(memberId).trusts || 1;
      const used = db.prepare(`SELECT COUNT(*) AS n FROM memorials WHERE trustee_member_id = ?`).get(memberId).n;
      if (used >= cap) return 'trust-full';
      return transaction(() => {
        cancelPendingTrusteeInvites(notice.memorial_id);
        setTrustee(notice.memorial_id, memberId);
        db.prepare(`UPDATE member_notices SET status = 'accepted' WHERE id = ?`).run(noticeId);
        return 'accepted';
      });
    }
    db.prepare(`UPDATE member_notices SET status = 'refused' WHERE id = ?`).run(noticeId);
    return 'refused';
  }
  if (notice.kind === 'capsule_share') {
    if (status === 'accepted') {
      db.prepare(`UPDATE capsule_shares SET status = 'allowed' WHERE capsule_id = ? AND member_id = ?`).run(notice.capsule_id, memberId);
      db.prepare(`UPDATE member_notices SET status = 'accepted' WHERE id = ?`).run(noticeId);
      return 'accepted';
    }
    db.prepare(`UPDATE capsule_shares SET status = 'refused' WHERE capsule_id = ? AND member_id = ?`).run(notice.capsule_id, memberId);
    db.prepare(`UPDATE member_notices SET status = 'refused' WHERE id = ?`).run(noticeId);
    return 'refused';
  }
  return 'missing';
}

function convertToDeceased(memorialId, trusteeId) {
  const memorial = getMemorial(memorialId);
  if (!memorial || memorial.life_state !== 'living' || memorial.trustee_member_id !== trusteeId) return null;
  if (!hallAllowance(trusteeId).canConvert) return 'hall-limit';
  db.prepare(`UPDATE memorials SET life_state = 'deceased', origin_member_id = member_id, member_id = ? WHERE id = ?`).run(trusteeId, memorialId);
  return getMemorial(memorialId);
}

function addHallPerson({ memorialId, name, birthDate, deathDate, title, story }) {
  const sort = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS n FROM hall_people WHERE memorial_id = ?`).get(memorialId).n + 1;
  const personId = id();
  db.prepare(`INSERT INTO hall_people (id, memorial_id, name, birth_date, death_date, title, story, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    personId, memorialId, name, birthDate || '', deathDate || '', title || '', story || '', sort, now()
  );
  return listHallPeople(memorialId);
}

function listHallPeople(memorialId) {
  return db.prepare(`SELECT * FROM hall_people WHERE memorial_id = ? ORDER BY sort_order`).all(memorialId);
}

function addYears(from, years) {
  const date = new Date(from);
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString();
}

function createCapsule({ memberId, title, body, years }) {
  const capsuleId = id();
  const stamp = now();
  db.prepare(`INSERT INTO capsules (id, member_id, title, body, years, opens_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    capsuleId, memberId, title, body, years, addYears(stamp, years), stamp
  );
  return getCapsule(capsuleId);
}

function updateCapsule(capsuleId, { title, body }) {
  db.prepare(`UPDATE capsules SET title = ?, body = ? WHERE id = ?`).run(title, body, capsuleId);
  return getCapsule(capsuleId);
}

function getCapsule(capsuleId) {
  return db.prepare(`SELECT capsules.*, members.name AS owner_name FROM capsules JOIN members ON members.id = capsules.member_id WHERE capsules.id = ?`).get(capsuleId) || null;
}

function listCapsulesByMember(memberId) {
  return db.prepare(`SELECT capsules.*, members.name AS owner_name FROM capsules JOIN members ON members.id = capsules.member_id WHERE capsules.member_id = ? ORDER BY capsules.created_at DESC`).all(memberId);
}

function listCapsulesSharedWith(memberId) {
  return db.prepare(`
    SELECT capsules.*, members.name AS owner_name
    FROM capsule_shares
    JOIN capsules ON capsules.id = capsule_shares.capsule_id
    JOIN members ON members.id = capsules.member_id
    WHERE capsule_shares.member_id = ? AND capsule_shares.status = 'allowed'
    ORDER BY capsules.opens_at
  `).all(memberId);
}

function capsuleShareCount(capsuleId) {
  return db.prepare(`SELECT COUNT(*) AS n FROM capsule_shares WHERE capsule_id = ? AND status != 'refused'`).get(capsuleId).n;
}

function listCapsuleShares(capsuleId) {
  return db.prepare(`
    SELECT capsule_shares.member_id, capsule_shares.status, members.name, members.email
    FROM capsule_shares JOIN members ON members.id = capsule_shares.member_id
    WHERE capsule_shares.capsule_id = ?
    ORDER BY capsule_shares.created_at
  `).all(capsuleId);
}

function addCapsuleShare(capsuleId, memberId, fromMemberId) {
  const existing = db.prepare(`SELECT status FROM capsule_shares WHERE capsule_id = ? AND member_id = ?`).get(capsuleId, memberId);
  if (existing) return existing.status;
  db.prepare(`
    INSERT INTO capsule_shares (capsule_id, member_id, created_at, status)
    VALUES (?, ?, ?, 'pending')
  `).run(capsuleId, memberId, now());
  db.prepare(`
    INSERT INTO member_notices (id, member_id, kind, status, from_member_id, memorial_id, capsule_id, created_at)
    VALUES (?, ?, 'capsule_share', 'pending', ?, NULL, ?, ?)
  `).run(id(), memberId, fromMemberId, capsuleId, now());
  return 'pending';
}

function hasCapsuleShare(capsuleId, memberId) {
  const row = db.prepare(`SELECT status FROM capsule_shares WHERE capsule_id = ? AND member_id = ?`).get(capsuleId, memberId);
  return Boolean(row && row.status === 'allowed');
}

function addCapsuleMedia({ capsuleId, caption, filePath, bytes, kind, durationSeconds }) {
  const mediaId = id();
  db.prepare(`INSERT INTO capsule_media (id, capsule_id, caption, file_path, bytes, created_at, kind, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    mediaId, capsuleId, caption || (kind === 'video' ? '影片' : '照片'), filePath, bytes || 0, now(), kind === 'video' ? 'video' : 'photo', durationSeconds || 0
  );
  return mediaId;
}

function sealCapsule({ memberId, title, body, years, shareIds, files }) {
  return transaction(() => {
    const capsule = createCapsule({ memberId, title, body, years });
    shareIds.forEach((shareId) => addCapsuleShare(capsule.id, shareId, memberId));
    files.forEach((file) => addCapsuleMedia({ capsuleId: capsule.id, ...file }));
    return capsule;
  });
}

function listCapsuleMedia(capsuleId) {
  return db.prepare(`SELECT * FROM capsule_media WHERE capsule_id = ? ORDER BY created_at`).all(capsuleId);
}

function getCapsuleMedia(mediaId) {
  return db.prepare(`SELECT * FROM capsule_media WHERE id = ?`).get(mediaId) || null;
}

function capsuleOpened(capsule) {
  return Boolean(capsule && capsule.opens_at <= now());
}

ensureFoundations();
backfillRoomItems();

module.exports = {
  root,
  uploadsDir,
  getSettings,
  saveSettings,
  createMember,
  getMember,
  getMemberByEmail,
  listMembers,
  setMemberStatus,
  confirmMember,
  issueVerifyCode,
  issuePhoneCode,
  consumeVerifyCode,
  memberByPhone,
  memberPlan,
  memberUsage,
  memberUsageDetail,
  hallAllowance,
  planFrameSkus,
  grantPlanFrame,
  visitOf,
  askVisit,
  setVisit,
  listVisits,
  createCheckout,
  getCheckout,
  getCheckoutByTrade,
  extendSubscription,
  fulfillCheckout,
  failCheckout,
  endSubscription,
  verifyPassword,
  createSession,
  readSession,
  deleteSession,
  verifyAdmin,
  listProducts,
  getProduct,
  getProductBySku,
  updateProduct,
  createMemorial,
  updateMemorial,
  getMemorial,
  getMemorialByCode,
  listMemorialsByMember,
  listMemorialsAsTrustee,
  addMedia,
  getMedia,
  listMedia,
  listPublicMedia,
  setMediaStatus,
  addRitual,
  ritualCounts,
  addMessage,
  listPublicMessages,
  hideMessage,
  addOrder,
  listRoomItems,
  addRoomItem,
  listOwnedFrames,
  setMemorialFrame,
  saveRoomLayout,
  pageTotal,
  openCapsule,
  orderCommission,
  getOrder,
  deliverOrder,
  addInquiry,
  setInquiryStatus,
  adminSnapshot,
  trustCount,
  setTrustee,
  inviteTrustee,
  pendingTrusteeInvite,
  listNoticesForMember,
  pendingNoticeCount,
  getNotice,
  respondNotice,
  hasCapsuleShare,
  clearTrustee,
  convertToDeceased,
  addHallPerson,
  listHallPeople,
  createCapsule,
  updateCapsule,
  getCapsule,
  listCapsulesByMember,
  listCapsulesSharedWith,
  capsuleShareCount,
  listCapsuleShares,
  addCapsuleShare,
  addCapsuleMedia,
  sealCapsule,
  listCapsuleMedia,
  getCapsuleMedia,
  capsuleOpened
};
