#!/usr/bin/env node
/**
 * fetch-circulars.js
 * Scrapes weekly circular data for all grocery stores near a zip code via Flipp.
 * Captures items directly from the circular — no predefined catalog needed.
 *
 * Usage:
 *   node fetch-circulars.js [zip]
 *   node fetch-circulars.js 11435
 *
 * Output:
 *   data/circulars.json   — structured store + item data for the frontend
 *   data/circulars-raw.json — raw API responses for debugging
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const https = require('https');

const ZIP      = process.argv[2] || '11435';
const OUT_DIR  = path.join(__dirname, 'data');
const OUT_FILE = path.join(OUT_DIR, 'circulars.json');
const RAW_FILE = path.join(OUT_DIR, 'circulars-raw.json');

// ── Grocery store filter ───────────────────────────────────────────────────
// Only keep stores whose merchant name contains one of these terms
const GROCERY_TERMS = [
  'food', 'market', 'grocery', 'supermarket', 'fresh', 'stop & shop',
  'shoprite', 'shop rite', 'key food', 'c-town', 'ctown', 'associated',
  'fairway', 'western beef', 'food bazaar', 'whole foods', 'target',
  'walmart', 'king kullen', 'trade fair', 'bravo', 'ideal', 'met food',
  'compare', 'pathmark', 'waldbaums', 'fine fare', 'c town',
];

function isGrocery(name = '') {
  const n = name.toLowerCase();
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

// ── HTTPS helper ───────────────────────────────────────────────────────────
function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        ...headers,
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ _raw: data.slice(0, 1000) }); }
      });
    }).on('error', reject);
  });
}

// ── Map raw Flipp item → clean item ───────────────────────────────────────
// Flipp backflipp API fields:
//   name, brand, price (string), discount (% off integer),
//   cutout_image_url, valid_from, valid_to, display_type
function mapItem(raw) {
  const name         = (raw.name || raw.short_name || '').trim();
  const brand        = (raw.brand || '').trim();
  const currentPrice = parsePrice(raw.price ?? raw.current_price ?? raw.sale_price);
  const discount     = typeof raw.discount === 'number' ? raw.discount : null;

  // Infer regular price from discount %: price = regular * (1 - discount/100)
  let regularPrice = null;
  if (currentPrice && discount && discount > 0 && discount < 100) {
    regularPrice = Math.round((currentPrice / (1 - discount / 100)) * 100) / 100;
  } else {
    regularPrice = parsePrice(raw.regular_price ?? raw.original_price ?? null);
  }

  const image = raw.cutout_image_url || raw.image_url || raw.thumb_url || null;

  return {
    id:            raw.id ?? null,
    name,
    brand:         brand || null,
    current_price: currentPrice,
    regular_price: regularPrice,
    discount_pct:  discount,
    sale_story:    raw.sale_story || raw.cut_price_text || (discount ? `${discount}% off` : null),
    image_url:     image,
    category:      raw.category || raw.item_type || null,
    is_featured:   !!(raw.is_featured || raw.featured || raw.display_type === 0),
    valid_from:    raw.valid_from || null,
    valid_to:      raw.valid_to   || null,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📰  Flipp Circular Scraper`);
  console.log(`    ZIP: ${ZIP}`);
  console.log(`    Output: ${OUT_FILE}\n`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });

  // ── Intercept all JSON from Flipp/Wishabi ────────────────────────────────
  const raw = {
    flyers:        [],           // from /flyers listing endpoints
    itemsByFlyer:  {},           // flyerId → items[]
    allResponses:  [],           // every captured JSON response (for debugging)
  };

  context.on('response', async (res) => {
    const url = res.url();
    // Log all JSON responses to help diagnose what API Flipp uses
    const isFlipp = url.includes('wishabi') || url.includes('flipp.com') ||
                    url.includes('flippenterprise') || url.includes('dam.flipp');
    if (!isFlipp) return;

    let json;
    try {
      const ct = res.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      json = await res.json();
    } catch { return; }

    // Save everything for debugging
    raw.allResponses.push({ url: url.slice(0, 200), data: json });

    // ── Flyer list ─────────────────────────────────────────────────────────
    // Shape 1: { flyers: [...] }
    if (Array.isArray(json?.flyers)) {
      raw.flyers.push(...json.flyers);
      console.log(`  ✓ Flyer list: ${json.flyers.length} entries  [${url.slice(0, 80)}]`);
    }
    // Shape 2: plain array of flyer objects
    if (Array.isArray(json) && json.length && (json[0]?.merchant || json[0]?.merchant_name)) {
      raw.flyers.push(...json);
      console.log(`  ✓ Flyer array: ${json.length} entries`);
    }

    // ── Flyer items ────────────────────────────────────────────────────────
    // Shape 1: { flyer_items: [...] } or { items: [...] }
    const itemList = json?.flyer_items || json?.items;
    if (Array.isArray(itemList) && itemList.length > 0) {
      // Try to get flyer ID from URL
      const m = url.match(/flyers?\/(\d+)/);
      const flyerId = m ? m[1] : `unknown_${Date.now()}`;
      if (!raw.itemsByFlyer[flyerId]) raw.itemsByFlyer[flyerId] = [];
      raw.itemsByFlyer[flyerId].push(...itemList);
      console.log(`  ✓ Items for flyer ${flyerId}: ${itemList.length} items`);
    }
  });

  const page = await context.newPage();

  // ── Step 1: Visit Flipp and set postal code ──────────────────────────────
  console.log('Step 1: Loading Flipp...');
  await page.goto('https://flipp.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Dismiss cookie/privacy consent modal
  const consentSelectors = [
    'button:has-text("Accept All")',
    'button:has-text("Accept all")',
    'button:has-text("Accept")',
    'button:has-text("I Accept")',
    'button:has-text("Agree")',
    '[id*="consent"] button',
    '[class*="consent"] button',
    '[id*="cookie"] button',
    '[class*="cookie"] button',
    '#onetrust-accept-btn-handler',
  ];
  for (const sel of consentSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        console.log(`  Dismissing consent modal (${sel})`);
        await btn.click();
        await page.waitForTimeout(1000);
        break;
      }
    } catch {}
  }

  // Enter zip code and submit
  console.log(`  Entering zip code ${ZIP}...`);
  const zipInput = await page.$('input[placeholder*="postal"], input[placeholder*="zip"], input[placeholder*="Postal"], input[name="postal_code"]');
  if (zipInput) {
    await zipInput.fill(ZIP);
    await page.waitForTimeout(500);

    // Click the submit/start button next to the input
    const submitBtn = await page.$('button:has-text("Start Saving"), button:has-text("Go"), button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      console.log('  Clicking submit...');
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
  } else {
    // Try direct URL with postal code
    console.log('  No zip input found, trying direct URL...');
    await page.goto(`https://flipp.com/flyers?postal_code=${ZIP}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  }

  // Wait for flyer listings to load
  console.log('  Waiting for flyers to load...');
  await page.waitForTimeout(5000);

  // ── Step 2: Scroll to trigger lazy-loaded content ────────────────────────
  console.log('\nStep 2: Scrolling to load more flyers...');
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(2000);

  console.log(`\nCaptured ${raw.flyers.length} total flyers from API`);

  // ── Step 3: If no API flyers captured, try scraping DOM ──────────────────
  if (raw.flyers.length === 0) {
    console.log('\nStep 3: No API data captured — trying DOM scrape...');
    await page.screenshot({ path: path.join(OUT_DIR, 'debug-flipp.png') });

    const domFlyers = await page.evaluate(() => {
      const results = [];
      // Try common Flipp DOM selectors
      const cards = document.querySelectorAll('[data-flyer-id], .flyer-card, .flyer-listing-item, [class*="flyer"]');
      cards.forEach(card => {
        const name = card.querySelector('[class*="merchant"], [class*="store"], h2, h3')?.textContent?.trim();
        const id   = card.dataset?.flyerId || card.getAttribute('data-id');
        const img  = card.querySelector('img')?.src;
        if (name || id) results.push({ name, id, img });
      });
      return results;
    });

    if (domFlyers.length) {
      console.log(`  Found ${domFlyers.length} flyers in DOM`);
      raw.flyers.push(...domFlyers.map(f => ({ merchant_name: f.name, id: f.id, thumb_url: f.img })));
    } else {
      console.log('  ⚠ No flyers found in DOM either. Saving debug screenshot.');
    }
  }

  // ── Step 4: For each grocery flyer, load items if not already captured ───
  const groceryFlyers = raw.flyers.filter(f =>
    isGrocery(f.merchant_name || f.merchant || f.name || '')
  );

  console.log(`\nStep 4: ${groceryFlyers.length} grocery store flyers found`);
  groceryFlyers.forEach(f => console.log(`  • ${f.merchant_name || f.merchant || f.name}`));

  for (const flyer of groceryFlyers) {
    const flyerId = String(flyer.id || flyer.flyer_id || '');
    if (!flyerId) continue;
    if (raw.itemsByFlyer[flyerId]?.length > 0) {
      console.log(`\n  ✓ ${flyer.merchant_name || flyer.merchant} — already have ${raw.itemsByFlyer[flyerId].length} items`);
      continue;
    }

    const storeName = flyer.merchant_name || flyer.merchant || flyer.name;
    console.log(`\n  Loading items for ${storeName} (id: ${flyerId})...`);

    // Try direct API endpoint first
    try {
      const apiUrl = `https://backflipp.wishabi.com/flipp/flyers/${flyerId}?locale=en-us`;
      const data = await get(apiUrl);
      const items = data?.flyer_items || data?.items || (Array.isArray(data) ? data : null);
      if (items?.length) {
        raw.itemsByFlyer[flyerId] = items;
        console.log(`    ✓ Got ${items.length} items via API`);
        continue;
      }
    } catch {}

    // Fall back: navigate to the flyer page
    try {
      const flyerUrl = `https://flipp.com/flyers/${flyerId}`;
      await page.goto(flyerUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      if (raw.itemsByFlyer[flyerId]?.length) {
        console.log(`    ✓ Got ${raw.itemsByFlyer[flyerId].length} items via page navigation`);
      } else {
        console.log(`    ⚠ No items captured for ${storeName}`);
      }
    } catch (e) {
      console.log(`    ✗ Failed: ${e.message}`);
    }
  }

  await browser.close();

  // ── Step 5: Build clean output ────────────────────────────────────────────
  console.log('\nStep 5: Building output...\n');

  const stores = groceryFlyers
    .filter(f => f.id || f.flyer_id)
    .map(flyer => {
      const flyerId  = String(flyer.id || flyer.flyer_id);
      const rawItems = raw.itemsByFlyer[flyerId] || [];
      const items    = rawItems
        .map(mapItem)
        .filter(i => i.name && i.current_price !== null);

      // Sort: featured first, then by % discount
      items.sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        const discA = a.regular_price ? (a.regular_price - a.current_price) / a.regular_price : 0;
        const discB = b.regular_price ? (b.regular_price - b.current_price) / b.regular_price : 0;
        return discB - discA;
      });

      const store = {
        flyer_id:      flyerId,
        name:          flyer.merchant || flyer.merchant_name || flyer.name || 'Unknown',
        merchant:      flyer.merchant || flyer.merchant_name || null,
        logo_url:      flyer.merchant_logo || flyer.logo_url || null,
        thumbnail_url: flyer.mobile_thumbnail_url || flyer.thumbnail_url || flyer.thumb_url || null,
        valid_from:    flyer.valid_from || null,
        valid_to:      flyer.valid_to   || null,
        item_count:    items.length,
        items,
      };

      console.log(`  ${store.name.padEnd(30)} ${items.length} items`);
      return store;
    });

  // ── Write outputs ─────────────────────────────────────────────────────────
  const output = {
    zip:        ZIP,
    scraped_at: new Date().toISOString(),
    store_count: stores.length,
    stores,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  fs.writeFileSync(RAW_FILE, JSON.stringify({ responses: raw.allResponses.slice(0, 50) }, null, 2));

  console.log(`\n✅  Saved ${stores.length} stores → ${OUT_FILE}`);
  console.log(`    Raw API log   → ${RAW_FILE}`);
  console.log('\nNext step: run  node server.js  to serve the data\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
