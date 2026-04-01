// ── Helpers ────────────────────────────────────────────────────────────────

function b64uDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function b64uEncode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function concat(...arrays) {
  const out = new Uint8Array(arrays.reduce((s, a) => s + a.length, 0));
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return b64uEncode(buf);
}

// ── HKDF via HMAC-SHA-256 ──────────────────────────────────────────────────

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

const hkdfExtract = (salt, ikm) => hmac(salt, ikm);

async function hkdfExpand(prk, info, len) {
  let t = new Uint8Array(0), okm = new Uint8Array(0);
  for (let i = 1; okm.length < len; i++) {
    t = await hmac(prk, concat(t, info, new Uint8Array([i])));
    okm = concat(okm, t);
  }
  return okm.slice(0, len);
}

// ── RFC 8291 Web Push payload encryption ──────────────────────────────────

async function encryptWebPush(subscription, payloadStr) {
  const enc = new TextEncoder();
  const auth = b64uDecode(subscription.keys.auth);
  const receiverPub = b64uDecode(subscription.keys.p256dh);

  const senderKP = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const senderPub = new Uint8Array(await crypto.subtle.exportKey('raw', senderKP.publicKey));

  const receiverKey = await crypto.subtle.importKey(
    'raw', receiverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, senderKP.privateKey, 256)
  );

  // RFC 8291 key derivation
  const keyInfo = concat(enc.encode('WebPush: info\0'), receiverPub, senderPub);
  const prk1 = await hkdfExtract(auth, ecdhSecret);
  const ikm = await hkdfExpand(prk1, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk2 = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk2, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk2, enc.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Append 0x02 (end-of-record delimiter per RFC 8291)
  const plaintext = concat(enc.encode(payloadStr), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext)
  );

  // RFC 8188 content coding header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  return concat(salt, rs, new Uint8Array([senderPub.length]), senderPub, ciphertext);
}

// ── VAPID JWT ──────────────────────────────────────────────────────────────

async function vapidJWT(endpoint, subject, pubB64, privB64) {
  const enc = new TextEncoder();
  const { protocol, host } = new URL(endpoint);
  const header = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64uEncode(enc.encode(JSON.stringify({
    aud: `${protocol}//${host}`,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  })));
  const sigInput = `${header}.${payload}`;

  const pubBytes = b64uDecode(pubB64); // 65 bytes: 04 | x(32) | y(32)
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256',
    d: privB64,
    x: b64uEncode(pubBytes.slice(1, 33)),
    y: b64uEncode(pubBytes.slice(33, 65)),
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(sigInput))
  );
  return `${sigInput}.${b64uEncode(sig)}`;
}

// ── Send one Web Push notification ────────────────────────────────────────

async function sendPush(subscription, payload, env) {
  const jwt = await vapidJWT(
    subscription.endpoint, env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY
  );
  const body = await encryptWebPush(subscription, JSON.stringify(payload));
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body,
  });
  return res.status;
}

// ── Flipp API helpers ──────────────────────────────────────────────────────

const GROCERY_RE = /supermarket|grocery|food mart|food store|whole foods|trader joe|safeway|kroger|albertsons|publix|hy-vee|wegmans|stop.?shop|giant|food lion|harris teeter|meijer|winn.?dixie|aldi|lidl|costco|walmart|target|sam.?s club|bj.?s wholesale|price.?rite|shoprite|associated|c-?town|key food|bravo|western beef|fairway|met food|fine fare/i;

async function fetchDeals(zip) {
  const res = await fetch(`https://backflipp.wishabi.com/flipp/flyers?locale=en-us&postal_code=${zip}`);
  const data = await res.json();
  const now = new Date();
  const flyers = (data?.flyers ?? []).filter(f => {
    const name = f.merchant_name || f.merchant || f.name || '';
    return GROCERY_RE.test(name) && !(f.valid_to && new Date(f.valid_to) < now);
  });

  const items = [];
  await Promise.all(flyers.map(async f => {
    try {
      const fid = String(f.id || f.flyer_id);
      const r = await fetch(`https://backflipp.wishabi.com/flipp/flyers/${fid}?locale=en-us`);
      const detail = await r.json();
      const storeName = f.merchant_name || f.merchant || f.name;
      for (const item of detail?.items ?? []) {
        if (item.name) items.push({ name: item.name, storeName, flyerId: fid, price: item.current_price });
      }
    } catch {}
  }));
  return items;
}

// ── Cron: check deals and send alerts ─────────────────────────────────────

async function runAlerts(env) {
  const list = await env.ALERTS_KV.list({ prefix: 'alert:' });
  if (!list.keys.length) return;

  const alerts = (await Promise.all(
    list.keys.map(async ({ name }) => {
      const d = await env.ALERTS_KV.get(name);
      return d ? { id: name.slice(6), ...JSON.parse(d) } : null;
    })
  )).filter(Boolean);

  // Group by zip to avoid duplicate API calls
  const byZip = {};
  for (const a of alerts) {
    (byZip[a.zip] ??= []).push(a);
  }

  for (const [zip, group] of Object.entries(byZip)) {
    let items;
    try { items = await fetchDeals(zip); } catch { continue; }
    if (!items.length) continue;

    for (const alert of group) {
      const matches = items.filter(i => i.name.toLowerCase().includes(alert.keyword));
      for (const match of matches) {
        const sentKey = `sent:${alert.id}:${match.flyerId}`;
        if (await env.ALERTS_KV.get(sentKey)) continue; // already notified

        const status = await sendPush(alert.subscription, {
          title: `🛒 ${match.storeName} has ${alert.keyword} on sale!`,
          body: `${match.name}${match.price != null ? ` — $${Number(match.price).toFixed(2)}` : ''} near ${zip}`,
          tag: `deal-${alert.id}`,
          url: `/?search=${encodeURIComponent(alert.keyword)}`,
        }, env).catch(() => 0);

        if (status === 410 || status === 404) {
          // Subscription expired — clean it up
          await env.ALERTS_KV.delete(`alert:${alert.id}`);
        } else {
          // Mark sent for 7 days so we don't re-notify for the same flyer
          await env.ALERTS_KV.put(sentKey, '1', { expirationTtl: 604800 });
        }
        break; // one notification per alert per run is enough
      }
    }
  }
}

// ── HTTP endpoints ─────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { ...CORS, 'Content-Type': 'application/json' },
});

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const { pathname, searchParams } = new URL(req.url);

    // POST /api/subscribe — save an alert
    if (pathname === '/api/subscribe' && req.method === 'POST') {
      const { subscription, zip, keyword } = await req.json();
      if (!subscription?.endpoint || !zip || !keyword?.trim())
        return json({ error: 'Missing fields' }, 400);

      const id = crypto.randomUUID();
      await env.ALERTS_KV.put(`alert:${id}`, JSON.stringify({
        subscription, zip,
        keyword: keyword.toLowerCase().trim(),
        created_at: new Date().toISOString(),
      }));

      // Index by hashed endpoint so we can look up a user's alerts
      const hash = await sha256(subscription.endpoint);
      const existing = await env.ALERTS_KV.get(`ep:${hash}`);
      const ids = existing ? JSON.parse(existing) : [];
      ids.push(id);
      await env.ALERTS_KV.put(`ep:${hash}`, JSON.stringify(ids));

      return json({ success: true, id });
    }

    // DELETE /api/unsubscribe — remove an alert
    if (pathname === '/api/unsubscribe' && req.method === 'DELETE') {
      const { endpoint, id } = await req.json();
      await env.ALERTS_KV.delete(`alert:${id}`);
      const hash = await sha256(endpoint);
      const existing = await env.ALERTS_KV.get(`ep:${hash}`);
      if (existing) {
        const ids = JSON.parse(existing).filter(i => i !== id);
        ids.length
          ? await env.ALERTS_KV.put(`ep:${hash}`, JSON.stringify(ids))
          : await env.ALERTS_KV.delete(`ep:${hash}`);
      }
      return json({ success: true });
    }

    // GET /api/alerts?endpoint=... — list a user's active alerts
    if (pathname === '/api/alerts' && req.method === 'GET') {
      const endpoint = searchParams.get('endpoint');
      if (!endpoint) return json({ alerts: [] });
      const hash = await sha256(endpoint);
      const existing = await env.ALERTS_KV.get(`ep:${hash}`);
      if (!existing) return json({ alerts: [] });
      const ids = JSON.parse(existing);
      const alerts = (await Promise.all(ids.map(async id => {
        const d = await env.ALERTS_KV.get(`alert:${id}`);
        if (!d) return null;
        const { keyword, zip } = JSON.parse(d);
        return { id, keyword, zip };
      }))).filter(Boolean);
      return json({ alerts });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAlerts(env));
  },
};
