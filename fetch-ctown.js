#!/usr/bin/env node
/**
 * fetch-ctown.js — Scrape C-Town prices from their Flipp Enterprise weekly circular
 * Fetches the SFML payload, parses item labels, fuzzy-matches to our product catalog,
 * then writes prices into index.html.
 */

const { chromium } = require('playwright');
const https = require('https');
const fs = require('fs');

const INDEX_FILE = 'index.html';

// ── Products (same list as fetch-prices.js) ────────────────────────────────

const PRODUCTS = [
  { id:'c1',  name:'Cheerios',                     brand:'General Mills'    },
  { id:'c2',  name:'Honey Nut Cheerios',            brand:'General Mills'    },
  { id:'c3',  name:'Frosted Flakes',                brand:"Kellogg's"        },
  { id:'c4',  name:'Cinnamon Toast Crunch',         brand:'General Mills'    },
  { id:'c5',  name:'Lucky Charms',                  brand:'General Mills'    },
  { id:'c6',  name:'Special K',                     brand:"Kellogg's"        },
  { id:'c7',  name:'Rice Krispies',                 brand:"Kellogg's"        },
  { id:'c8',  name:'Quaker Old Fashioned Oats',     brand:'Quaker'           },
  { id:'c9',  name:"Cap'n Crunch",                  brand:'Quaker'           },
  { id:'c10', name:'Raisin Bran',                   brand:"Kellogg's"        },
  { id:'br1', name:"Nature's Own Butterbread",      brand:"Nature's Own"     },
  { id:'br2', name:'Wonder Classic White',          brand:'Wonder'           },
  { id:'br3', name:"Dave's Killer Bread",           brand:"Dave's Killer"    },
  { id:'br4', name:'Thomas English Muffins',        brand:'Thomas'           },
  { id:'br5', name:'Sara Lee Classic White',        brand:'Sara Lee'         },
  { id:'pa1', name:'Barilla Spaghetti',             brand:'Barilla'          },
  { id:'pa2', name:'Barilla Penne',                 brand:'Barilla'          },
  { id:'pa3', name:'Prego Tomato Sauce',            brand:'Prego'            },
  { id:'pa4', name:"Rao's Homemade Marinara",       brand:"Rao's"            },
  { id:'pa5', name:'Kraft Mac & Cheese',            brand:'Kraft'            },
  { id:'pa6', name:'Ragú Old World Marinara',       brand:'Ragú'             },
  { id:'ca1', name:"Campbell's Chicken Noodle",     brand:"Campbell's"       },
  { id:'ca2', name:"Campbell's Tomato Soup",        brand:"Campbell's"       },
  { id:'ca3', name:'StarKist Tuna Chunk Light',     brand:'StarKist'         },
  { id:'ca4', name:'Goya Black Beans',              brand:'Goya'             },
  { id:'ca5', name:"Bush's Best Baked Beans",       brand:"Bush's"           },
  { id:'ca6', name:"Hunt's Diced Tomatoes",         brand:"Hunt's"           },
  { id:'ca7', name:'Del Monte Sweet Corn',          brand:'Del Monte'        },
  { id:'ca8', name:'Progresso Chicken Noodle',      brand:'Progresso'        },
  { id:'co1', name:'Heinz Ketchup',                 brand:'Heinz'            },
  { id:'co2', name:"Hellmann's Real Mayo",          brand:"Hellmann's"       },
  { id:'co3', name:"French's Yellow Mustard",       brand:"French's"         },
  { id:'co4', name:'Hidden Valley Ranch',           brand:'Hidden Valley'    },
  { id:'co5', name:"Frank's RedHot Sauce",          brand:"Frank's"          },
  { id:'co6', name:'Skippy Peanut Butter',          brand:'Skippy'           },
  { id:'co7', name:'Jif Peanut Butter',             brand:'Jif'              },
  { id:'co8', name:"Smucker's Strawberry Jam",      brand:"Smucker's"        },
  { id:'co9', name:'Sriracha Hot Sauce',            brand:'Huy Fong'         },
  { id:'co10',name:'Tabasco Hot Sauce',             brand:'Tabasco'          },
  { id:'ic1', name:"Ben & Jerry's Cherry Garcia",   brand:"Ben & Jerry's"    },
  { id:'ic2', name:'Häagen-Dazs Vanilla',           brand:'Häagen-Dazs'      },
  { id:'ic3', name:'Talenti Sea Salt Caramel',      brand:'Talenti'          },
  { id:'ic4', name:'Breyers Natural Vanilla',       brand:'Breyers'          },
  { id:'ic5', name:"Edy's Grand Vanilla",           brand:"Edy's"            },
  { id:'ic6', name:'Halo Top Vanilla Bean',         brand:'Halo Top'         },
  { id:'ic7', name:'Turkey Hill Vanilla',           brand:'Turkey Hill'      },
  { id:'ch1', name:"Lay's Classic",                 brand:"Lay's"            },
  { id:'ch2', name:'Doritos Nacho Cheese',          brand:'Doritos'          },
  { id:'ch3', name:'Pringles Original',             brand:'Pringles'         },
  { id:'ch4', name:'Ritz Crackers',                 brand:'Ritz'             },
  { id:'ch5', name:'Cheez-It Original',             brand:'Cheez-It'         },
  { id:'ch6', name:'Wheat Thins',                   brand:'Nabisco'          },
  { id:'ch7', name:'Goldfish Cheddar',              brand:'Pepperidge Farm'  },
  { id:'ch8', name:'Triscuit Original',             brand:'Nabisco'          },
  { id:'cf1', name:'Folgers Classic Roast',         brand:'Folgers'          },
  { id:'cf2', name:'Maxwell House Original',        brand:'Maxwell House'    },
  { id:'cf3', name:'Dunkin Donuts Original Blend',  brand:'Dunkin'           },
  { id:'cf4', name:'Starbucks Pike Place',          brand:'Starbucks'        },
  { id:'cf5', name:'Café Bustelo Espresso',         brand:'Café Bustelo'     },
  { id:'cf6', name:'Eight O Clock Original',        brand:'Eight O Clock'    },
  { id:'ju1', name:'Tropicana Pure Premium OJ',     brand:'Tropicana'        },
  { id:'ju2', name:'Simply Orange',                 brand:'Simply Orange'    },
  { id:'ju3', name:'Minute Maid Pulp Free OJ',      brand:'Minute Maid'      },
  { id:'ju4', name:"Welch's Grape Juice",           brand:"Welch's"          },
  { id:'ju5', name:'Ocean Spray Cranberry Juice',   brand:'Ocean Spray'      },
  { id:'ju6', name:'Apple & Eve Apple Juice',       brand:'Apple & Eve'      },
  { id:'so1', name:'Coca-Cola',                     brand:'Coca-Cola'        },
  { id:'so2', name:'Pepsi',                         brand:'Pepsi'            },
  { id:'so3', name:'Sprite',                        brand:'Sprite'           },
  { id:'so4', name:'Dr Pepper',                     brand:'Dr Pepper'        },
  { id:'so5', name:'Poland Spring Water',           brand:'Poland Spring'    },
  { id:'so6', name:'Dasani Water',                  brand:'Dasani'           },
  { id:'so7', name:'Gatorade Fruit Punch',          brand:'Gatorade'         },
  { id:'so8', name:'LaCroix Sparkling Water',       brand:'LaCroix'          },
  { id:'da1', name:'Kraft American Singles',        brand:'Kraft'            },
  { id:'da2', name:'Philadelphia Cream Cheese',     brand:'Philadelphia'     },
  { id:'da3', name:'Sargento Shredded Mozzarella',  brand:'Sargento'         },
  { id:'da4', name:'Tillamook Cheddar',             brand:'Tillamook'        },
  { id:'da5', name:'BelGioioso Parmesan',           brand:'BelGioioso'       },
  { id:'mi1', name:'Horizon Organic 2% Milk',       brand:'Horizon Organic'  },
  { id:'mi2', name:'Fairlife Whole Milk',           brand:'Fairlife'         },
  { id:'mi3', name:'Silk Almond Milk',              brand:'Silk'             },
  { id:'mi4', name:'Oatly Oat Milk',                brand:'Oatly'            },
  { id:'mi5', name:'Lactaid Whole Milk',            brand:'Lactaid'          },
  { id:'me1', name:'Oscar Mayer Bologna',           brand:'Oscar Mayer'      },
  { id:'me2', name:'Ball Park Franks',              brand:'Ball Park'        },
  { id:'me3', name:'Hillshire Farm Smoked Sausage', brand:'Hillshire Farm'   },
  { id:'me4', name:'Tyson Chicken Breast',          brand:'Tyson'            },
  { id:'me5', name:'Perdue Whole Chicken',          brand:'Perdue'           },
  { id:'pr1', name:'Bananas',                       brand:''                 },
  { id:'pr2', name:'Avocados',                      brand:''                 },
  { id:'pr3', name:'Strawberries',                  brand:''                 },
  { id:'pr4', name:'Baby Spinach',                  brand:''                 },
  { id:'pr5', name:'Roma Tomatoes',                 brand:''                 },
  { id:'sn1', name:'Oreo Cookies',                  brand:'Nabisco'          },
  { id:'sn2', name:'Chips Ahoy!',                   brand:'Nabisco'          },
  { id:'sn3', name:'Pepperidge Farm Milano',        brand:'Pepperidge Farm'  },
  { id:'sn4', name:'Kind Bar Almond',               brand:'Kind'             },
  { id:'sn5', name:'Clif Bar Chocolate Chip',       brand:'Clif Bar'         },
  { id:'sn6', name:'PopCorners White Cheddar',      brand:'PopCorners'       },
  { id:'sn7', name:"Smartfood White Cheddar",       brand:'Smartfood'        },
  { id:'fr1', name:'DiGiorno Rising Crust Pizza',   brand:'DiGiorno'         },
  { id:'fr2', name:"Stouffer's Lasagna",            brand:"Stouffer's"       },
  { id:'fr3', name:"Amy's Mac & Cheese",            brand:"Amy's"            },
  { id:'fr4', name:'Eggo Waffles',                  brand:'Eggo'             },
  { id:'fr5', name:'Birds Eye Vegetables',          brand:'Birds Eye'        },
  { id:'fr6', name:'Green Giant Vegetables',        brand:'Green Giant'      },
  { id:'bk1', name:'Entenmann\'s Chocolate Cake',   brand:"Entenmann's"      },
  { id:'bk2', name:'Thomas Bagels',                 brand:'Thomas'           },
  { id:'bk3', name:'Arnold 12 Grain Bread',         brand:'Arnold'           },
  { id:'bk4', name:'Pepperidge Farm Swirl Bread',   brand:'Pepperidge Farm'  },
  { id:'bk5', name:'King Arthur All-Purpose Flour', brand:'King Arthur'      },
  { id:'bk6', name:'Pillsbury All-Purpose Flour',   brand:'Pillsbury'        },
  { id:'bk7', name:'Domino Sugar',                  brand:'Domino'           },
  { id:'bk8', name:'Gold Medal All-Purpose Flour',  brand:'Gold Medal'       },
  { id:'bk9', name:'Fleischmann\'s Yeast',          brand:"Fleischmann's"    },
  { id:'bk10',name:'Ghirardelli Chocolate Chips',   brand:'Ghirardelli'      },
  { id:'bk11',name:'Nestle Toll House Morsels',     brand:'Nestle'           },
  { id:'bk12',name:'Crisco Vegetable Oil',          brand:'Crisco'           },
  { id:'bk13',name:'Wesson Vegetable Oil',          brand:'Wesson'           },
  { id:'bk14',name:'Arm & Hammer Baking Soda',      brand:'Arm & Hammer'     },
  { id:'bk15',name:'Clabber Girl Baking Powder',    brand:'Clabber Girl'     },
  { id:'bf1', name:'Quaker Instant Oatmeal',        brand:'Quaker'           },
  { id:'bf2', name:'Eggo Buttermilk Waffles',       brand:'Eggo'             },
  { id:'bf3', name:'Pillsbury Pancake Mix',         brand:'Pillsbury'        },
  { id:'bf4', name:"Aunt Jemima Syrup",             brand:"Pearl Milling"    },
  { id:'bf5', name:'Jimmy Dean Sausage',            brand:'Jimmy Dean'       },
  { id:'bf6', name:'Bob Evans Sausage',             brand:'Bob Evans'        },
  { id:'pc1', name:'Dove Body Wash',                brand:'Dove'             },
  { id:'pc2', name:'Head & Shoulders Shampoo',      brand:'Head & Shoulders' },
  { id:'pc3', name:'Colgate Toothpaste',            brand:'Colgate'          },
  { id:'pc4', name:'Crest 3D White',                brand:'Crest'            },
  { id:'pc5', name:'Secret Invisible Solid',        brand:'Secret'           },
  { id:'pc6', name:'Gillette Fusion Razor',         brand:'Gillette'         },
  { id:'hh1', name:'Tide Liquid Detergent',         brand:'Tide'             },
  { id:'hh2', name:'Dawn Dish Soap',                brand:'Dawn'             },
  { id:'hh3', name:'Bounty Paper Towels',           brand:'Bounty'           },
  { id:'hh4', name:'Charmin Ultra Soft',            brand:'Charmin'          },
  { id:'hh5', name:'Lysol Disinfectant Spray',      brand:'Lysol'            },
  { id:'hh6', name:'Swiffer Sweeper Refills',       brand:'Swiffer'          },
  { id:'hh7', name:'Ziploc Bags',                   brand:'Ziploc'           },
  { id:'hh8', name:'Hefty Trash Bags',              brand:'Hefty'            },
  { id:'ba1', name:'Pampers Swaddlers',             brand:'Pampers'          },
  { id:'ba2', name:'Huggies Little Snugglers',      brand:'Huggies'          },
  { id:'ba3', name:'Enfamil Formula',               brand:'Enfamil'          },
  { id:'vi1', name:'One A Day Women\'s',            brand:'One A Day'        },
  { id:'vi2', name:'Centrum Adults',                brand:'Centrum'          },
  { id:'vi3', name:'Nature Made Vitamin D3',        brand:'Nature Made'      },
  { id:'vi4', name:"Nature's Bounty Vitamin C",     brand:"Nature's Bounty"  },
  { id:'pe1', name:'Purina Friskies Cat Food',      brand:'Purina'           },
  { id:'pe2', name:'Fancy Feast Cat Food',          brand:'Fancy Feast'      },
  { id:'pe3', name:"Purina Dog Chow",               brand:'Purina'           },
  { id:'pe4', name:'Milk-Bone Dog Biscuits',        brand:'Milk-Bone'        },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function apiGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data.slice(0, 500) }); } });
    }).on('error', reject);
  });
}

// Parse price from label string like:
//   "$3.99"  →  3.99
//   "2 FOR $5"  →  2.50
//   "3 for $4"  →  1.33
//   "$1.29 LB."  →  null  (per-lb, skip)
function parseCircularPrice(priceStr) {
  // Skip per-lb prices
  if (/lb\./i.test(priceStr)) return null;

  // N for $X
  const multiMatch = priceStr.match(/(\d+)\s+(?:for|FOR)\s+\$([\d.]+)/i);
  if (multiMatch) {
    return Math.round(parseFloat(multiMatch[2]) / parseInt(multiMatch[1]) * 100) / 100;
  }

  // $X.XX
  const singleMatch = priceStr.match(/\$([\d.]+)/);
  if (singleMatch) return parseFloat(singleMatch[1]);

  return null;
}

// Normalize string for matching: lowercase, remove special chars, collapse spaces
function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[''´`']/g, '')   // apostrophes
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Score how well a product matches a circular label
// Returns 0 if no match, higher = better
function matchScore(product, circularLabel) {
  const labelNorm = normalize(circularLabel);
  const brandNorm = normalize(product.brand);
  const nameNorm  = normalize(product.name);

  // Very common words that shouldn't count as meaningful matches
  const stopWords = new Set([
    'and', 'the', 'of', 'in', 'a', 'an', 'for', 'with', 'or',
    'old', 'original', 'classic', 'natural', 'fresh', 'pure',
    'organic', 'whole', 'best', 'new', 'real', 'great', 'good',
    'instant', 'regular', 'extra', 'ultra', 'light', 'free',
    'sauce', 'juice', 'water', 'milk', 'butter', 'cream', 'oil',
    'chips', 'bars', 'crackers', 'cookies', 'bread', 'cheese',
    'drink', 'drinks', 'mix', 'powder', 'spray',
  ]);

  const labelWords = new Set(labelNorm.split(' ').filter(w => w.length > 2 && !stopWords.has(w)));
  const brandWords = brandNorm.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
  const nameWords  = nameNorm.split(' ').filter(w => w.length > 2 && !stopWords.has(w));

  // Key words = name words first (most important), then brand words
  const keyWords = [...new Set([...nameWords, ...brandWords])];
  if (keyWords.length === 0) return 0;

  let hits = 0;
  for (const word of keyWords) {
    // EXACT word match only — no prefix/suffix tricks
    if (labelWords.has(word)) hits++;
  }

  // For brand-only matches (e.g., brand word hit but no name word), require brand to be distinctive
  // Require ALL brand words to hit AND at least one name word to hit
  const brandHits = brandWords.filter(w => !stopWords.has(w) && labelWords.has(w)).length;
  const nameHits  = nameWords.filter(w => !stopWords.has(w) && labelWords.has(w)).length;

  const reqBrand = brandWords.filter(w => !stopWords.has(w)).length;
  const reqName  = nameWords.filter(w => !stopWords.has(w)).length;

  // Require all brand words to match if brand is non-empty
  if (reqBrand > 0 && brandHits < reqBrand) return 0;

  // Require at least one name word (if any meaningful name words exist)
  if (reqName > 0 && nameHits === 0) return 0;

  // Final score: proportion of key words matched
  return hits / keyWords.length;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('🏪 C-Town Price Scraper\n');

  // Step 1: Get a fresh access token via Playwright
  console.log('Getting fresh access token from C-Town website...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let token = null;
  context.on('response', async (res) => {
    const url = res.url();
    if (url.includes('flyerkit/merchant/ctown')) {
      const m = url.match(/access_token=([^&]+)/);
      if (m) token = m[1];
    }
  });

  await page.goto('https://www.ctownsupermarkets.com/weekly-ad?ViewTempCircular=true&StoreID=S41_486', {
    waitUntil: 'networkidle', timeout: 30000
  }).catch(() => {});
  await browser.close();

  if (!token) { console.error('❌ Could not get access token'); process.exit(1); }
  console.log('✓ Got token\n');

  // Step 2: Find Bronx store
  const BASE = 'https://dam.flippenterprise.net/flyerkit';
  const stores = await apiGet(`${BASE}/stores/ctown?languages[]=en&locale=en&access_token=${token}&postal_code=10451`);
  const store = stores.find(s => s.flyer_count > 0) || stores[0];
  console.log(`Using store: ${store.name}, ${store.address} (code: ${store.merchant_store_code})\n`);

  // Step 3: Get this week's publication
  const pubs = await apiGet(`${BASE}/publications/ctown?locale=en&access_token=${token}&store_code=${store.merchant_store_code}&available_only=true`);
  if (!Array.isArray(pubs) || pubs.length === 0) {
    console.error('❌ No publications found'); process.exit(1);
  }
  const pub = pubs[0];
  console.log(`Publication: "${pub.name}" valid ${pub.valid_from.slice(0,10)} to ${pub.valid_to.slice(0,10)}\n`);

  // Step 4: Fetch SFML payload
  console.log('Fetching circular data...');
  const xml = await httpsGet(pub.sfml_url);

  // Step 5: Parse all items from SFML
  const areaMatches = [...xml.matchAll(/<area[^>]+label="([^"]+)"[^>]*>/g)];
  const circularItems = [];
  for (const m of areaMatches) {
    const label = m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // Split on ", ," to get name and price parts
    const parts = label.split(', ,');
    if (parts.length < 2) continue;
    const name  = parts[0].trim();
    const priceRaw = parts[parts.length - 1].trim();
    const price = parseCircularPrice(priceRaw);
    if (price !== null) {
      circularItems.push({ name, priceRaw, price });
    }
  }
  console.log(`Parsed ${circularItems.length} items with prices from circular\n`);

  // Step 6: Match products to circular items using explicit label fragments.
  // Product IDs are verified against the current index.html catalog.
  // Each entry maps a product ID → circular label substring (case-insensitive).
  const MANUAL_MATCHES = {
    // Cereal
    'c3':   'KELLOGG\'S FROSTED FLAKES',             // $3.99
    'c4':   'CINNAMON TOAST CRUNCH',                 // $4.99
    'c8':   'QUAKER OATS',                           // $5.99 — Quaker Old Fashioned Oats
    // Chips & Crackers
    'ch2':  'DORITOS TORTILLA CHIPS',                // 2/$8 → $4.00
    'ch3':  'PRINGLES POTATO CRISPS',                // $7.99
    // Canned Goods
    'ca4':  'GOYA BEANS 15.5 Oz. Cans',             // 3/$4 → $1.33
    'ca11': 'SWANSON BROTH',                         // $2.99
    // Condiments
    'co6':  'SKIPPY CREAMY PEANUT BUTTER',           // $4.99
    'co16': 'GOYA ADOBO',                            // 2/$6 → $3.00
    'co17': 'LA CHOY SOY SAUCE',                     // $2.49
    // Ice Cream
    'ic2':  'HAAGEN-DAZS ICE CREAM 28',             // $5.99 — 28oz container
    'ic7':  'TURKEY HILL ICE CREAM',                 // 2/$7 → $3.50
    // Coffee
    'cf2':  'MAXWELL HOUSE COFFEE',                  // $5.99
    'cf4':  'STARBUCKS GROUND COFFEE',               // $12.99 — Pike Place
    'cf6':  'CAFE BUSTELO',                          // $7.99 — Espresso Ground
    // Juice
    'ju2':  'SIMPLY ORANGE JUICE',                   // $3.99
    // Beverages
    'sw12': 'ARIZONA TEAS',                          // $2.99 — Arizona Green Tea
    'sw13': 'POLAND SPRING WATER',                   // 2/$11 → $5.50 — gallon
    // Dairy
    'da5':  'SARGENTO SHREDDED CHEESES',             // 2/$6 → $3.00
    // Snacks
    'sn10': 'POP-TARTS',                             // $4.49 — Kellogg's Pop-Tarts
    'sn14': 'QUAKER CHEWY GRANOLA BARS',             // $4.29
    // Frozen
    'fr3':  'EGGO WAFFLES',                          // $5.99 — Homestyle Waffles
    'fr10': 'GREEN GIANT SIMPLY STEAM VEGETABLES',   // 3/$3 → $1.00
    // Baking
    'bg2':  'DOMINO BAKER\'S SUGAR',                 // $4.99 — Granulated Sugar
    // Personal Care
    'pc3':  'COLGATE CAVITY PROTECTION',             // 2/$5 → $2.50
    // Household
    'hw3':  'BOUNTY DOUBLES TOWELS',                 // $5.99
    'hw5':  'LYSOL DISINFECTANT SPRAY',              // $8.99
  };

  const matched = {};
  const matchLog = [];

  for (const [productId, fragment] of Object.entries(MANUAL_MATCHES)) {
    const item = circularItems.find(i => i.name.toUpperCase().includes(fragment.toUpperCase()));
    if (item) {
      matched[productId] = item.price;
      const product = PRODUCTS.find(p => p.id === productId);
      const label = product ? `${product.brand} ${product.name}` : productId;
      matchLog.push({ id: productId, product: label, circular: item.name, priceRaw: item.priceRaw, price: item.price });
    } else {
      console.log(`  ⚠ No circular item found for fragment: "${fragment}"`);
    }
  }

  // Print match log
  console.log(`\nMatched ${matchLog.length} of ${PRODUCTS.length} products:\n`);
  for (const m of matchLog) {
    console.log(`  ✓ [${m.id}] ${m.product}`);
    console.log(`       → "${m.circular}" → ${m.priceRaw} → $${m.price.toFixed(2)}\n`);
  }

  // Step 7: Write prices into index.html
  let html = fs.readFileSync(INDEX_FILE, 'utf8');
  let updated = 0;

  for (const [productId, price] of Object.entries(matched)) {
    const re = new RegExp(`(id:'${productId}'[^\\n]*ct:)null`, 'g');
    const before = html;
    html = html.replace(re, `$1${price.toFixed(2)}`);
    if (html !== before) updated++;
  }

  fs.writeFileSync(INDEX_FILE, html);
  console.log(`\n✅ Updated ${updated} C-Town prices in ${INDEX_FILE}`);
  console.log('Commit and push index.html to publish.');
})();
