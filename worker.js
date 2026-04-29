/**
 * Retail Engine v12 — Cloudflare Worker + D1 Backend
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return String(h) + ':' + str.length;
}

function randomToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function randomId() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

async function getSession(request, db) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const row = await db
    .prepare("SELECT * FROM sessions WHERE token=? AND expires_at > datetime('now')")
    .bind(token)
    .first();
  return row || null;
}

async function pushAudit(db, username, action, detail = '') {
  await db
    .prepare("INSERT INTO audit(ts,username,action,detail) VALUES(datetime('now'),?,?,?)")
    .bind(username, action, detail)
    .run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight — always return early
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // All /api/* routes handled by worker — NEVER fall through to assets
    if (path.startsWith('/api/')) {
      try {
        if (!env.DB) {
          return err('Database not configured. Check wrangler.toml D1 binding.', 500);
        }
        return await handleApi(request, env.DB, path.slice(4), url);
      } catch (e) {
        console.error('Worker error:', e);
        return err('Internal server error: ' + (e.message || String(e)), 500);
      }
    }

    // Static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleApi(request, db, path, url) {
  const method = request.method;

  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return err('Invalid JSON body', 400);
    }
  }

  /* ─── AUTH ─── */
  if (path === '/auth/login' && method === 'POST') {
    const { username, password } = body;
    if (!username || !password) return err('Missing credentials');
    const user = await db
      .prepare('SELECT * FROM users WHERE username=?')
      .bind(String(username).trim())
      .first();
    if (!user) return err('Utilizator sau parolă greșite', 401);
    if (user.password_hash !== simpleHash(String(password))) return err('Utilizator sau parolă greșite', 401);
    if (user.pending && !user.approved) return err('Contul tău este în așteptarea aprobării.', 403);

    const token = randomToken();
    const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db
      .prepare('INSERT INTO sessions(token,username,role,expires_at) VALUES(?,?,?,?)')
      .bind(token, user.username, user.role, expires)
      .run();
    await pushAudit(db, user.username, 'Login', 'Autentificare');
    return json({ token, username: user.username, role: user.role });
  }

  if (path === '/auth/register-owner' && method === 'POST') {
    const count = await db.prepare('SELECT COUNT(*) as c FROM users').first();
    if (count.c > 0) return err('Owner există deja.', 403);
    const { username, password } = body;
    if (!username || !password) return err('Missing fields');
    const id = randomId();
    await db
      .prepare('INSERT INTO users(id,username,password_hash,role,approved) VALUES(?,?,?,?,1)')
      .bind(id, String(username).trim(), simpleHash(String(password)), 'owner')
      .run();
    const token = randomToken();
    const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db
      .prepare('INSERT INTO sessions(token,username,role,expires_at) VALUES(?,?,?,?)')
      .bind(token, String(username).trim(), 'owner', expires)
      .run();
    await pushAudit(db, String(username).trim(), 'Login', 'Creare cont Owner');
    return json({ token, username: String(username).trim(), role: 'owner' });
  }

  if (path === '/auth/register-staff' && method === 'POST') {
    const { username, password, invite_code } = body;
    if (!username || !password || !invite_code) return err('Missing fields');
    const setting = await db.prepare("SELECT value FROM settings WHERE key='invite_code'").first();
    if (!setting || setting.value !== String(invite_code).trim()) return err('Cod invitație invalid.', 403);
    const exists = await db.prepare('SELECT id FROM users WHERE username=?').bind(String(username).trim()).first();
    if (exists) return err('Utilizatorul există deja.');
    const id = randomId();
    await db
      .prepare('INSERT INTO users(id,username,password_hash,role,approved) VALUES(?,?,?,?,1)')
      .bind(id, String(username).trim(), simpleHash(String(password)), 'staff')
      .run();
    const token = randomToken();
    const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db
      .prepare('INSERT INTO sessions(token,username,role,expires_at) VALUES(?,?,?,?)')
      .bind(token, String(username).trim(), 'staff', expires)
      .run();
    await pushAudit(db, String(username).trim(), 'Login', 'Înregistrare Staff');
    return json({ token, username: String(username).trim(), role: 'staff' });
  }

  if (path === '/auth/logout' && method === 'POST') {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (token) {
      const sess = await db.prepare("SELECT username FROM sessions WHERE token=?").bind(token).first();
      await db.prepare('DELETE FROM sessions WHERE token=?').bind(token).run();
      if (sess) await pushAudit(db, sess.username, 'Login', 'Deconectare');
    }
    return json({ ok: true });
  }

  if (path === '/auth/users-empty' && method === 'GET') {
    const count = await db.prepare('SELECT COUNT(*) as c FROM users').first();
    return json({ empty: count.c === 0 });
  }

  /* ─── PRODUCTS ─── */
  if (path === '/products' && method === 'GET') {
    const sess = await getSession(request, db);
    if (!sess) return err('Unauthorized', 401);
    const rows = await db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    return json(rows.results || []);
  }

  if (path === '/products' && method === 'POST') {
    const sess = await getSession(request, db);
    if (!sess) return err('Unauthorized', 401);
    const { ean, name, base_price, discount_pct = 0, shelf = '', valid_until = '' } = body;
    if (!ean || !name) return err('EAN și denumire sunt obligatorii.');
    const id = randomId();
    await db
      .prepare('INSERT INTO products(id,ean,name,base_price,discount_pct,shelf,valid_until,created_by) VALUES(?,?,?,?,?,?,?,?)')
      .bind(id, String(ean), String(name), Number(base_price) || 0, Number(discount_pct) || 0, String(shelf), String(valid_until), sess.username)
      .run();
    await pushAudit(db, sess.username, 'Adăugare', 'Produs EAN ' + ean);
    const p = await db.prepare('SELECT * FROM products WHERE id=?').bind(id).first();
    return json(p, 201);
  }

  const productMatch = path.match(/^\/products\/([^/]+)$/);
  if (productMatch) {
    const id = productMatch[1];
    const sess = await getSession(request, db);
    if (!sess) return err('Unauthorized', 401);

    if (method === 'PUT') {
      if (sess.role === 'staff') return err('Forbidden', 403);
      const { ean, name, base_price, discount_pct = 0, shelf = '', valid_until = '' } = body;
      await db
        .prepare("UPDATE products SET ean=?,name=?,base_price=?,discount_pct=?,shelf=?,valid_until=?,updated_at=datetime('now') WHERE id=?")
        .bind(String(ean), String(name), Number(base_price) || 0, Number(discount_pct) || 0, String(shelf), String(valid_until), id)
        .run();
      await pushAudit(db, sess.username, 'Modificare', 'Produs EAN ' + ean);
      const p = await db.prepare('SELECT * FROM products WHERE id=?').bind(id).first();
      return json(p);
    }

    if (method === 'DELETE') {
      if (sess.role === 'staff') return err('Forbidden', 403);
      const p = await db.prepare('SELECT ean FROM products WHERE id=?').bind(id).first();
      await db.prepare('DELETE FROM products WHERE id=?').bind(id).run();
      await pushAudit(db, sess.username, 'Ștergere', 'Produs id ' + id + (p ? ' EAN ' + p.ean : ''));
      return json({ ok: true });
    }
  }

  /* ─── AUDIT ─── */
  if (path === '/audit' && method === 'GET') {
    const sess = await getSession(request, db);
    if (!sess || !['owner', 'manager'].includes(sess.role)) return err('Forbidden', 403);
    const q = url.searchParams.get('q') || '';
    let rows;
    if (q) {
      rows = await db
        .prepare("SELECT * FROM audit WHERE username LIKE ? OR action LIKE ? OR detail LIKE ? ORDER BY ts DESC LIMIT 500")
        .bind(`%${q}%`, `%${q}%`, `%${q}%`)
        .all();
    } else {
      rows = await db.prepare('SELECT * FROM audit ORDER BY ts DESC LIMIT 500').all();
    }
    return json(rows.results || []);
  }

  /* ─── FORTRESS ─── */
  if (path === '/fortress/invite' && method === 'GET') {
    const sess = await getSession(request, db);
    if (!sess || !['owner', 'manager'].includes(sess.role)) return err('Forbidden', 403);
    const row = await db.prepare("SELECT value FROM settings WHERE key='invite_code'").first();
    return json({ code: row ? row.value : '' });
  }

  if (path === '/fortress/invite' && method === 'POST') {
    const sess = await getSession(request, db);
    if (!sess || !['owner', 'manager'].includes(sess.role)) return err('Forbidden', 403);
    const newCode = 'RE-' + randomToken().slice(0, 8).toUpperCase();
    await db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('invite_code',?)").bind(newCode).run();
    await pushAudit(db, sess.username, 'Modificare', 'Cod invitație regenerat');
    return json({ code: newCode });
  }

  if (path === '/fortress/pending' && method === 'GET') {
    const sess = await getSession(request, db);
    if (!sess || sess.role !== 'owner') return err('Forbidden', 403);
    const rows = await db.prepare("SELECT username FROM users WHERE pending=1 AND approved=0").all();
    return json(rows.results || []);
  }

  if (path === '/fortress/add-manager' && method === 'POST') {
    const sess = await getSession(request, db);
    if (!sess || sess.role !== 'owner') return err('Forbidden', 403);
    const { username, password } = body;
    if (!username || !password) return err('Missing fields');
    const exists = await db.prepare('SELECT id FROM users WHERE username=?').bind(String(username).trim()).first();
    if (exists) return err('Utilizatorul există.');
    const activeCount = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role='manager' AND approved=1 AND pending=0").first();
    if (activeCount.c >= 5) return err('Limită: maxim 5 manageri activi.');
    const id = randomId();
    await db
      .prepare('INSERT INTO users(id,username,password_hash,role,approved,pending) VALUES(?,?,?,?,0,1)')
      .bind(id, String(username).trim(), simpleHash(String(password)), 'manager')
      .run();
    await pushAudit(db, sess.username, 'Modificare', 'Manager nou în așteptare: ' + String(username).trim());
    return json({ ok: true });
  }

  const approveMatch = path.match(/^\/fortress\/approve\/(.+)$/);
  if (approveMatch && method === 'POST') {
    const sess = await getSession(request, db);
    if (!sess || sess.role !== 'owner') return err('Forbidden', 403);
    const username = decodeURIComponent(approveMatch[1]);
    await db.prepare('UPDATE users SET approved=1, pending=0 WHERE username=?').bind(username).run();
    await pushAudit(db, sess.username, 'Aprobare', 'Manager aprobat: ' + username);
    return json({ ok: true });
  }

  const rejectMatch = path.match(/^\/fortress\/reject\/(.+)$/);
  if (rejectMatch && method === 'POST') {
    const sess = await getSession(request, db);
    if (!sess || sess.role !== 'owner') return err('Forbidden', 403);
    const username = decodeURIComponent(rejectMatch[1]);
    await db.prepare('DELETE FROM users WHERE username=? AND pending=1').bind(username).run();
    await pushAudit(db, sess.username, 'Respingere', 'Manager respins: ' + username);
    return json({ ok: true });
  }

  return err('Not found', 404);
}
