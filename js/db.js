// ─────────────────────────────────────────
//  db.js — SH Grip Pro IndexedDB 전담 모듈
// ─────────────────────────────────────────

const DB_NAME    = 'shGripProDB';
const DB_VERSION = 1;

let _db = null;

// ── 초기화 ──────────────────────────────
export function initDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // profile store (단일 레코드)
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }

      // sessions store
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('date', 'date', { unique: true });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ── 트랜잭션 헬퍼 ───────────────────────
function tx(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

// ══════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════

export function getProfile() {
  return promisify(tx('profile').get('main'));
}

export function saveProfile(profile) {
  profile.id = 'main';
  return promisify(tx('profile', 'readwrite').put(profile));
}

// ══════════════════════════════════════════
//  SESSIONS
// ══════════════════════════════════════════

export function getSessionByDate(date) {
  return promisify(tx('sessions').index('date').get(date));
}

export function saveSession(session) {
  return promisify(tx('sessions', 'readwrite').put(session));
}

export function getAllSessions() {
  return promisify(tx('sessions').getAll());
}

export function getRecentSessions(count = 10) {
  return new Promise((resolve, reject) => {
    const store   = tx('sessions');
    const results = [];

    const req = store.openCursor(null, 'prev'); // 최신순
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor && results.length < count) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export function deleteSession(id) {
  return promisify(tx('sessions', 'readwrite').delete(id));
}

// ── 오늘 날짜 키 ─────────────────────────
export function todayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}
