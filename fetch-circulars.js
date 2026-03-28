#!/usr/bin/env node
/**
 * fetch-circulars.js
 * Fetches weekly circular data directly from the Flipp API (no browser needed).
 * Usage: node fetch-circulars.js [zip]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ZIP      = process.argv[2] || '11435';
const OUT_DIR  = path.join(__dirname, 'data');
const OUT_FILE = path.join(OUT_DIR, 'circulars.json');
const ADDR_CACHE_FILE = path.join(OUT_DIR, 'address-cache.json');

// ── Grocery store filter ───────────────────────────────────────────────────
const GROCERY_TERMS = [
  'food', 'market', 'grocery', 'supermarket', 'fresh', 'stop & shop',
  'shoprite', 'shop rite', 'key food', 'c-town', 'ctown', 'associated',
  'fairway', 'western beef', 'food bazaar', 'whole foods', 'target',
  'walmart', 'king kullen', 'trade fair', 'bravo', 'ideal', 'met food',
  'compare', 'pathmark', 'waldbaums', 'fine fare', 'c town', 'aldi', 'lidl',
  'h mart', 'hmart', 'wegman', 'costco', "sam's club", "bj's", 'trader joe',
  'seasons kosher', 'decicco', 'supremo', 'mitsuwa', 'stew leonard', 'gristedes',
  'morton williams', 'pioneer', 'price rite', 'price chopper', 'hannaford', 'publix',
  'kroger', 'safeway', 'albertson', 'vons', 'ralphs', 'meijer', 'winco', 'sprouts',
  'piggly wiggly', 'winn-dixie', 'bi-lo', 'food lion', 'giant', 'acme',
  'restaurant depot', 'jetro',
];
const NOT_GROCERY = [
  'dollar', 'pet', 'office', 'sporting', "victoria", 'jcpenney', 'showcase', 'bath & body',
  'gamestop', 'belk', "dick's", 'cvs', 'best buy', 'health mart', 'home depot', "lowe's",
  'nordstrom', 'ulta', 'marshall', 'kohl', 'harbor freight', 'five below', 'tj maxx',
  'ikea', 'cabela', 'michael', 'hobby lobby', 'ace hardware', 'old navy', 'walgreen',
  "boscov", 'tractor supply', 'ocean state', "ollie's", 'family dollar',
];

function isGrocery(name = '') {
  const n = name.toLowerCase();
  if (NOT_GROCERY.some(t => n.includes(t))) return false;
  return GROCERY_TERMS.some(t => n.includes(t));
}

// ── Price parser ───────────────────────────────────────────────────────────
function parsePrice(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const m = val.replace(/[^\d.]/g, '');
    return m ? parseFloat(m) : null;
  }
  return null;
}

// ── HTTPS GET (returns parsed JSON or null) ────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

// ── Concurrency-limited parallel runner ────────────────────────────────────
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── Address cache ─────────────────────────────────────────────────────────
// Keyed by "locality::storeName" → [{ lat, lon, addr, county, dist }]
// Persists across runs so Nominatim lookups only happen once per store+locality.
function loadAddressCache() {
  try { return JSON.parse(fs.readFileSync(ADDR_CACHE_FILE, 'utf8')); } catch { return {}; }
}
function saveAddressCache(cache) {
  fs.writeFileSync(ADDR_CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ── Address lookup via Nominatim ─────────────────────────────────────────
const RADIUS_MILES = 10;

function haversineMi(lat1, lon1, lat2, lon2) {
  const R = 3958.8, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeZip(zip) {
  try {
    const data = await get(`https://nominatim.openstreetmap.org/search?q=${zip}&format=json&limit=1&countrycodes=us&addressdetails=1`);
    if (data?.[0]) {
      const addr = data[0].address || {};
      const locality = addr.county || addr.city || addr.town || addr.suburb || '';
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), locality };
    }
  } catch {}
  return null;
}

// Parse a Nominatim result into a location object
function parseNominatimResult(r, center) {
  const addr = r.address || {};
  const county = addr.county || addr.city || addr.town || addr.suburb || '';
  const num = addr.house_number || '';
  const street = addr.road || '';
  const neighborhood = addr.suburb || '';
  const shortAddr = [num, street, neighborhood].filter(Boolean).join(' ');
  return {
    name: (addr.shop || addr.name || '').toLowerCase(),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    addr: shortAddr || null,
    county,
    dist: haversineMi(center.lat, center.lon, parseFloat(r.lat), parseFloat(r.lon)),
  };
}

// Bulk fetch: get all supermarkets in the locality with a single query
async function bulkFetchStores(center) {
  const localityShort = (center.locality || '').replace(' County', '');
  if (!localityShort) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent('supermarket in ' + localityShort)}&format=json&limit=50&countrycodes=us&addressdetails=1`;
  try {
    const results = await get(url);
    if (!results?.length) return [];
    return results.map(r => parseNominatimResult(r, center))
      .filter(r => r.county === center.locality && r.dist <= RADIUS_MILES);
  } catch { return []; }
}

// Search Nominatim for a specific store name (fallback for bulk misses)
async function searchStoreLocation(storeName, center) {
  const localityShort = (center.locality || '').replace(' County', '');
  const query = localityShort ? `${storeName}, ${localityShort}` : storeName;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&countrycodes=us&addressdetails=1`;
  try {
    const results = await get(url);
    if (!results?.length) return [];
    return results.map(r => parseNominatimResult(r, center))
      .filter(r => !center.locality || r.county === center.locality)
      .filter(r => r.dist <= RADIUS_MILES);
  } catch { return []; }
}

// Match a Flipp store name against bulk Nominatim results using fuzzy name matching
function matchBulkResults(flippName, bulkResults) {
  const fn = flippName.toLowerCase();
  // Try exact substring match first, then first-word match
  const words = fn.split(/\s+/).filter(w => w.length > 2);
  const keyWord = words.find(w => !['the','and','inc','llc','supermarket','supermarkets','food','foods','market','markets','grocery','store'].includes(w)) || words[0] || '';
  return bulkResults.filter(r => {
    if (!r.name) return false;
    // Exact name match
    if (r.name.includes(fn) || fn.includes(r.name)) return true;
    // Key word match (e.g. "bravo" in "Bravo Supermarket")
    if (keyWord && r.name.includes(keyWord)) return true;
    return false;
  });
}

// Look up addresses: cache → bulk query → individual fallback for misses
async function lookupAllAddresses(storeNames, center) {
  const cache = loadAddressCache();
  const results = {};
  const uncached = [];

  // 1. Check cache first
  for (const name of storeNames) {
    const key = `${center.locality}::${name}`;
    if (cache[key]) {
      results[name] = cache[key].map(loc => ({
        ...loc,
        dist: haversineMi(center.lat, center.lon, loc.lat, loc.lon),
      })).filter(r => r.dist <= RADIUS_MILES);
    } else {
      uncached.push(name);
    }
  }

  const cached = storeNames.length - uncached.length;
  if (cached) console.log(`   ${cached} stores loaded from cache`);
  if (!uncached.length) return results;

  // 2. Bulk query: one request gets ~50 supermarkets in the locality
  const localityShort = (center.locality || '').replace(' County', '');
  console.log(`   Searching for stores in ${localityShort || 'area'}...`);
  const bulkResults = await bulkFetchStores(center);

  for (const name of uncached) {
    const matches = matchBulkResults(name, bulkResults);
    if (matches.length) {
      results[name] = matches;
      cache[`${center.locality}::${name}`] = matches.map(({ lat, lon, addr, county }) => ({ lat, lon, addr, county }));
    } else {
      // No local location found — cache empty so we don't retry
      cache[`${center.locality}::${name}`] = [];
      results[name] = [];
    }
  }

  saveAddressCache(cache);
  return results;
}

// ── Map raw Flipp item → clean item ───────────────────────────────────────
function mapItem(raw) {
  const name         = (raw.name || raw.short_name || '').trim();
  const brand        = (raw.brand || '').trim();
  const currentPrice = parsePrice(raw.price ?? raw.current_price ?? raw.sale_price);
  const discount     = typeof raw.discount === 'number' ? raw.discount : null;

  let regularPrice = null;
  if (currentPrice && discount && discount > 0 && discount < 100) {
    regularPrice = Math.round((currentPrice / (1 - discount / 100)) * 100) / 100;
  } else {
    regularPrice = parsePrice(raw.regular_price ?? raw.original_price ?? null);
  }

  return {
    id:            raw.id ?? null,
    name,
    brand:         brand || null,
    current_price: currentPrice,
    regular_price: regularPrice,
    discount_pct:  discount,
    sale_story:    raw.sale_story || raw.cut_price_text || (discount ? `${discount}% off` : null),
    image_url:     raw.cutout_image_url || raw.image_url || raw.thumb_url || null,
    category:      raw.category || raw.item_type || null,
    is_featured:   !!(raw.is_featured || raw.featured || raw.display_type === 0),
    valid_from:    raw.valid_from || null,
    valid_to:      raw.valid_to   || null,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const t0 = Date.now();

  // Step 1: Fetch flyer list and geocode zip in parallel
  console.log(`🔍 Finding grocery stores near ${ZIP}...`);
  let flyerData, center;
  try {
    [flyerData, center] = await Promise.all([
      get(`https://backflipp.wishabi.com/flipp/flyers?locale=en-us&postal_code=${ZIP}`),
      geocodeZip(ZIP),
    ]);
  } catch (err) {
    console.error(`❌ Failed to reach Flipp: ${err.message}`);
    process.exit(1);
  }

  const allFlyers = flyerData?.flyers || (Array.isArray(flyerData) ? flyerData : []);
  if (!allFlyers.length) {
    console.error(`❌ No flyers returned for zip ${ZIP}`);
    process.exit(1);
  }

  const groceryFlyers = allFlyers.filter(f =>
    isGrocery(f.merchant_name || f.merchant || f.name || '')
  );
  console.log(`🛒 Found ${groceryFlyers.length} grocery stores`);

  // Step 2: Look up addresses + fetch deals in parallel
  const uniqueNames = [...new Set(groceryFlyers.map(f => f.merchant_name || f.merchant || f.name || 'Unknown'))];

  console.log(`📍 Looking up store locations...`);
  const addressPromise = center
    ? lookupAllAddresses(uniqueNames, center)
    : Promise.resolve({});

  console.log(`📦 Loading deals...`);
  let done = 0;
  const itemsByFlyer = {};

  const [addressMap] = await Promise.all([
    addressPromise,
    mapConcurrent(groceryFlyers, 8, async (flyer) => {
      const flyerId   = String(flyer.id || flyer.flyer_id || '');
      if (!flyerId) { done++; return; }
      try {
        const data = await get(`https://backflipp.wishabi.com/flipp/flyers/${flyerId}?locale=en-us`);
        const items = data?.flyer_items || data?.items || [];
        itemsByFlyer[flyerId] = items;
        done++;
        console.log(`   ${done}/${groceryFlyers.length} stores loaded`);
      } catch {
        done++;
        itemsByFlyer[flyerId] = [];
      }
    }),
  ]);

  // Step 4: Filter to stores that have a location in the same borough/town
  const nearbyFlyers = [];
  for (const flyer of groceryFlyers) {
    const name = flyer.merchant_name || flyer.merchant || flyer.name || 'Unknown';
    const locations = addressMap[name] || [];
    if (locations.length > 0) {
      locations.sort((a, b) => a.dist - b.dist);
      nearbyFlyers.push({ flyer, location: locations[0] });
    } else {
      nearbyFlyers.push({ flyer, location: null });
    }
  }

  const localityName = center?.locality || 'nearby';

  // Step 5: Build clean output (items already fetched)
  const stores = nearbyFlyers
    .filter(({ flyer }) => flyer.id || flyer.flyer_id)
    .map(({ flyer, location }) => {
      const flyerId  = String(flyer.id || flyer.flyer_id);
      const rawItems = itemsByFlyer[flyerId] || [];
      const items    = rawItems.map(mapItem).filter(i => i.name && i.current_price !== null);

      items.sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        const discA = a.regular_price ? (a.regular_price - a.current_price) / a.regular_price : 0;
        const discB = b.regular_price ? (b.regular_price - b.current_price) / b.regular_price : 0;
        return discB - discA;
      });

      return {
        flyer_id:      flyerId,
        name:          flyer.merchant || flyer.merchant_name || flyer.name || 'Unknown',
        merchant:      flyer.merchant || flyer.merchant_name || null,
        logo_url:      flyer.merchant_logo || flyer.logo_url || null,
        thumbnail_url: flyer.mobile_thumbnail_url || flyer.thumbnail_url || flyer.thumb_url || null,
        valid_from:    flyer.valid_from || null,
        valid_to:      flyer.valid_to   || null,
        address:       location?.addr || null,
        lat:           location?.lat  || null,
        lng:           location?.lon  || null,
        distance_mi:   location?.dist ? Math.round(location.dist * 10) / 10 : null,
        item_count:    items.length,
        items,
      };
    });

  // Write output
  const output = { zip: ZIP, scraped_at: new Date().toISOString(), store_count: stores.length, stores };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

  const totalItems = stores.reduce((sum, s) => sum + s.item_count, 0);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Found ${totalItems} deals across ${stores.length} stores in ${localityName} (${elapsed}s)`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
