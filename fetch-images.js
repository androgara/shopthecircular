/**
 * NYC Best Store Finder — Image Fetcher
 * ─────────────────────────────────────
 * Run this once with: node fetch-images.js
 *
 * It will:
 *   1. Call UPCitemdb free API for every product (no signup or key needed)
 *   2. Collect real product image URLs
 *   3. Write a fully self-contained nyc_best_store_finder.html with images baked in
 *
 * Requirements: Node.js 18+ (uses built-in fetch)
 * Check your version: node -v
 * Download Node if needed: https://nodejs.org
 */

const fs = require('fs');
const path = require('path');

// ── All products with UPC codes ───────────────────────────────────────────────
const PRODUCTS = [
  { id:'c1',  upc:'016000275287', name:'Cheerios' },
  { id:'c2',  upc:'016000275591', name:'Honey Nut Cheerios' },
  { id:'c3',  upc:'038000596315', name:'Frosted Flakes' },
  { id:'c4',  upc:'016000487031', name:'Cinnamon Toast Crunch' },
  { id:'c5',  upc:'016000275409', name:'Lucky Charms' },
  { id:'c6',  upc:'038000596117', name:'Special K' },
  { id:'c7',  upc:'038000391408', name:'Rice Krispies' },
  { id:'c8',  upc:'030000010389', name:'Quaker Old Fashioned Oats' },
  { id:'c9',  upc:'030000068014', name:"Cap'n Crunch" },
  { id:'c10', upc:'038000596711', name:'Raisin Bran' },
  { id:'br1', upc:'085592101605', name:"Nature's Own Butterbread" },
  { id:'br2', upc:'082592931038', name:'Wonder Classic White' },
  { id:'br3', upc:'013764000529', name:"Dave's Killer Bread" },
  { id:'br4', upc:'072030011059', name:'Thomas English Muffins' },
  { id:'br5', upc:'072945801482', name:'Sara Lee Classic White' },
  { id:'pa1', upc:'076808000285', name:'Barilla Spaghetti' },
  { id:'pa2', upc:'076808009943', name:'Barilla Penne' },
  { id:'pa3', upc:'051000082886', name:'Prego Tomato Sauce' },
  { id:'pa4', upc:'747479100061', name:"Rao's Homemade Marinara" },
  { id:'pa5', upc:'021000012367', name:'Kraft Mac & Cheese' },
  { id:'pa6', upc:'036200002780', name:"Ragú Old World Marinara" },
  { id:'ca1', upc:'051000012562', name:"Campbell's Chicken Noodle" },
  { id:'ca2', upc:'051000012494', name:"Campbell's Tomato Soup" },
  { id:'ca3', upc:'080000001015', name:'StarKist Tuna Chunk Light' },
  { id:'ca4', upc:'041331031104', name:'Goya Black Beans' },
  { id:'ca5', upc:'039400016588', name:"Bush's Best Baked Beans" },
  { id:'ca6', upc:'027000387740', name:"Hunt's Diced Tomatoes" },
  { id:'ca7', upc:'024000163268', name:'Del Monte Sweet Corn' },
  { id:'ca8', upc:'041196030173', name:'Progresso Chicken Noodle' },
  { id:'co1', upc:'013000006040', name:'Heinz Ketchup' },
  { id:'co2', upc:'048001213743', name:"Hellmann's Real Mayo" },
  { id:'co3', upc:'041500001562', name:"French's Yellow Mustard" },
  { id:'co4', upc:'071100006120', name:'Hidden Valley Ranch' },
  { id:'co5', upc:'047600008025', name:"Frank's RedHot Sauce" },
  { id:'co6', upc:'037600103800', name:'Skippy Peanut Butter' },
  { id:'co7', upc:'051500756836', name:'Jif Peanut Butter' },
  { id:'co8', upc:'051500017807', name:"Smucker's Strawberry Jam" },
  { id:'co9', upc:'024463061029', name:'Sriracha Hot Sauce' },
  { id:'co10',upc:'011210000612', name:'Tabasco Hot Sauce' },
  { id:'ic1', upc:'076840100255', name:"Ben & Jerry's Cherry Garcia" },
  { id:'ic2', upc:'074570891123', name:'Häagen-Dazs Vanilla' },
  { id:'ic3', upc:'037808820673', name:'Talenti Sea Salt Caramel' },
  { id:'ic4', upc:'077567265753', name:'Breyers Natural Vanilla' },
  { id:'ic5', upc:'041548226360', name:"Edy's Grand Vanilla" },
  { id:'ic6', upc:'857476005002', name:'Halo Top Vanilla Bean' },
  { id:'ic7', upc:'035200264271', name:'Turkey Hill Vanilla' },
  { id:'ch1', upc:'028400315035', name:"Lay's Classic" },
  { id:'ch2', upc:'028400090322', name:'Doritos Nacho Cheese' },
  { id:'ch3', upc:'038000845260', name:'Pringles Original' },
  { id:'ch4', upc:'028400394000', name:'Cheetos Crunchy' },
  { id:'ch5', upc:'028400097673', name:'Tostitos Scoops' },
  { id:'ch6', upc:'028400090315', name:'Doritos Cool Ranch' },
  { id:'ch7', upc:'028400090247', name:'Fritos Original' },
  { id:'ch8', upc:'028400315073', name:"Lay's BBQ" },
  { id:'ch9', upc:'028400396721', name:'Ruffles Cheddar Sour Cream' },
  { id:'ch10',upc:'028400113687', name:'Smartfood White Cheddar' },
  { id:'cf1', upc:'025500005406', name:'Folgers Classic Roast' },
  { id:'cf2', upc:'043000036204', name:'Maxwell House Original' },
  { id:'cf3', upc:'075460001082', name:"Dunkin' Original Blend" },
  { id:'cf4', upc:'762111511832', name:'Starbucks Pike Place' },
  { id:'cf5', upc:'070253295101', name:'Stok Cold Brew' },
  { id:'ju1', upc:'048500205419', name:'Tropicana Pure Premium OJ' },
  { id:'ju2', upc:'025000051951', name:'Simply Orange' },
  { id:'ju3', upc:'014800002802', name:"Mott's Apple Juice" },
  { id:'ju4', upc:'041800001651', name:"Welch's Grape Juice" },
  { id:'ju5', upc:'025000001840', name:'Minute Maid OJ' },
  { id:'ju6', upc:'031200014847', name:'Ocean Spray Cranberry' },
  { id:'sw1', upc:'049000042566', name:'Coca-Cola 12-Pack' },
  { id:'sw2', upc:'012000001086', name:'Pepsi 12-Pack' },
  { id:'sw3', upc:'078000001424', name:'Dr Pepper 12-Pack' },
  { id:'sw4', upc:'049000028928', name:'Diet Coke 12-Pack' },
  { id:'sw5', upc:'096749369015', name:'LaCroix Sparkling 12pk' },
  { id:'sw6', upc:'611269993712', name:'Red Bull 4-Pack' },
  { id:'sw7', upc:'052000337602', name:'Gatorade Fruit Punch 12pk' },
  { id:'sw8', upc:'070847010013', name:'Monster Energy' },
  { id:'da1', upc:'818290011004', name:'Chobani Greek Yogurt' },
  { id:'da2', upc:'089743501232', name:'Fage Total 2%' },
  { id:'da3', upc:'070470004008', name:'Yoplait Strawberry' },
  { id:'da4', upc:'021000637485', name:'Kraft Singles American' },
  { id:'da5', upc:'046100000083', name:'Sargento Shredded Cheddar' },
  { id:'da6', upc:'025293003996', name:'Silk Oat Milk' },
  { id:'da7', upc:'011153000048', name:"Land O' Lakes Butter" },
  { id:'da8', upc:'021000016600', name:'Philadelphia Cream Cheese' },
  { id:'da9', upc:'071105500010', name:"Eggland's Best Eggs" },
  { id:'da10',upc:'890186001007', name:'Oatly Oat Milk' },
  { id:'me1', upc:'044700007617', name:'Oscar Mayer Classic Bacon' },
  { id:'me2', upc:'077900318712', name:'Jimmy Dean Bacon' },
  { id:'me3', upc:'044700030166', name:'Ball Park Beef Franks' },
  { id:'me4', upc:'017300176085', name:'Hebrew National Hot Dogs' },
  { id:'me5', upc:'044700011034', name:'Hillshire Farm Smoked Sausage' },
  { id:'sn1', upc:'044000030315', name:'Oreo Cookies' },
  { id:'sn2', upc:'044000030339', name:'Chips Ahoy!' },
  { id:'sn3', upc:'044000032210', name:'Ritz Crackers' },
  { id:'sn4', upc:'014100085867', name:'Goldfish Cheddar' },
  { id:'sn5', upc:'077975040577', name:"Snyder's Pretzels" },
  { id:'sn6', upc:'816925020008', name:'SkinnyPop Popcorn' },
  { id:'sn7', upc:'602652000555', name:'Kind Bar 6-pack' },
  { id:'sn8', upc:'040822011107', name:'Sabra Classic Hummus' },
  { id:'sn9', upc:'016000275775', name:'Nature Valley Granola Bars' },
  { id:'sn10',upc:'038000168437', name:'Pop-Tarts Strawberry' },
  { id:'sn11',upc:'029000017603', name:'Planters Mixed Nuts' },
  { id:'sn12',upc:'044000032227', name:'Wheat Thins' },
  { id:'fr1', upc:'071921007867', name:'DiGiorno Rising Crust Pizza' },
  { id:'fr2', upc:'041900062361', name:'Red Baron Classic Pizza' },
  { id:'fr3', upc:'038000596094', name:'Eggo Homestyle Waffles' },
  { id:'fr4', upc:'013800138163', name:"Stouffer's Mac & Cheese" },
  { id:'fr5', upc:'013300000614', name:'Ore-Ida Tater Tots' },
  { id:'fr6', upc:'042800127419', name:"Totino's Party Pizza" },
  { id:'fr7', upc:'014800011155', name:'Birds Eye Broccoli' },
  { id:'fr8', upc:'013800145017', name:'Lean Cuisine Steamers' },
  { id:'bk1', upc:'009800895228', name:'Nutella' },
  { id:'bk2', upc:'018000432027', name:'Pillsbury Pancake Mix' },
  { id:'bk3', upc:'030000013687', name:'Quaker Instant Oatmeal' },
  { id:'bk4', upc:'044000041502', name:'Log Cabin Syrup' },
  { id:'bk5', upc:'077900318897', name:'Jimmy Dean Breakfast Sandwiches' },
  { id:'pc1', upc:'037000356578', name:'Head & Shoulders' },
  { id:'pc2', upc:'011111032328', name:'Dove Beauty Bar 4pk' },
  { id:'pc3', upc:'035000571037', name:'Colgate Total Toothpaste' },
  { id:'pc4', upc:'312547368309', name:'Listerine Cool Mint' },
  { id:'hw1', upc:'037000133643', name:'Tide Original Liquid' },
  { id:'hw2', upc:'037000881438', name:'Tide Pods Original 42ct' },
  { id:'hw3', upc:'037000773191', name:'Bounty Paper Towels 6pk' },
  { id:'hw4', upc:'037000862871', name:'Charmin Ultra Soft 12pk' },
  { id:'hw5', upc:'019200016512', name:'Lysol Disinfectant Spray' },
  { id:'hw6', upc:'037000804123', name:'Dawn Ultra Original' },
  { id:'hw7', upc:'012587210115', name:'Glad ForceFlex Trash Bags' },
  { id:'ba1', upc:'037000869290', name:'Pampers Swaddlers' },
  { id:'ba2', upc:'036000291659', name:'Huggies Little Movers' },
  { id:'ba3', upc:'015000077012', name:'Gerber Baby Purees' },
  { id:'pe1', upc:'017800146005', name:'Purina Fancy Feast 12ct' },
  { id:'pe2', upc:'023100113928', name:'Pedigree Dry Dog Food' },
  { id:'pe3', upc:'079100516087', name:'Milk-Bone Dog Biscuits' },
  { id:'vi1', upc:'023290890027', name:'Centrum Adults Multivitamin' },
  { id:'vi2', upc:'028053007483', name:'Emergen-C Vitamin C 30ct' },
  { id:'vi3', upc:'300450449009', name:'Tylenol Extra Strength' },
  { id:'vi4', upc:'305730175987', name:'Advil Ibuprofen 100ct' },
  { id:'bg1', upc:'016000194328', name:'Gold Medal All-Purpose Flour' },
  { id:'bg2', upc:'049200001029', name:'Domino Granulated Sugar' },
  { id:'bg3', upc:'644209421534', name:'Duncan Hines Yellow Cake Mix' },
  { id:'bg4', upc:'018000353002', name:'Pillsbury Brownie Mix' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPOONACULAR_KEY = '2fe55f43c833460189cb07ed22ae0bff';

async function fetchImage(upc, name) {
  // Search by product name — avoids bad UPC codes entirely
  const url = `https://api.spoonacular.com/food/products/search?query=${encodeURIComponent(name)}&number=1&apiKey=${SPOONACULAR_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  ✗ ${name} (HTTP ${res.status})`);
      return '';
    }
    const data = await res.json();
    const product = data.products?.[0];
    if (!product) {
      console.log(`  ~ ${name} (not found)`);
      return '';
    }
    const img = product.image
      ? (product.image.startsWith('http') ? product.image : `https://img.spoonacular.com/products/${product.image}`)
      : '';
    if (img) {
      console.log(`  ✓ ${name} → ${product.title}`);
    } else {
      console.log(`  ~ ${name} (no image)`);
    }
    return img;
  } catch (e) {
    console.log(`  ✗ ${name} (error: ${e.message})`);
    return '';
  }
}

async function main() {
  console.log('\n🛒 NYC Best Store Finder — Image Fetcher');
  console.log('━'.repeat(50));
  console.log(`Fetching images for ${PRODUCTS.length} products...`);
  console.log('Source: Spoonacular (search by name — bypasses bad UPCs)\n');

  const imageMap = {}; // id -> url

  // Seed from images already baked into index.html
  const indexPath = path.join(__dirname, 'index.html');
  try {
    const existing = fs.readFileSync(indexPath, 'utf8');
    const match = existing.match(/const IMG = (\{[\s\S]*?\});/);
    if (match) Object.assign(imageMap, JSON.parse(match[1]));
    const seeded = Object.values(imageMap).filter(v => v).length;
    if (seeded) console.log(`Loaded ${seeded} existing images from index.html\n`);
  } catch(e) {}

  // Also resume from progress file if interrupted mid-run
  const progressFile = path.join(__dirname, '.image-progress.json');
  if (fs.existsSync(progressFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      Object.assign(imageMap, saved);
      console.log(`Resuming from previous run\n`);
    } catch(e) {}
  }

  const remaining = PRODUCTS.filter(p => !imageMap[p.id]);
  console.log(`Fetching ${remaining.length} remaining products...\n`);

  for (let i = 0; i < remaining.length; i++) {
    const p = remaining[i];
    process.stdout.write(`[${String(i+1).padStart(3)}/${remaining.length}] `);
    imageMap[p.id] = await fetchImage(p.upc, p.name);

    // Save progress after each fetch in case of interruption
    fs.writeFileSync(progressFile, JSON.stringify(imageMap));

    // Be polite to Open Food Facts — 1s between requests
    if (i < remaining.length - 1) await sleep(1000);
  }

  const found = Object.values(imageMap).filter(v => v).length;
  console.log(`\n✓ Done! Found images for ${found}/${PRODUCTS.length} products`);

  // Build the final HTML
  console.log('\nUpdating index.html...');
  buildHTML(imageMap);

  // Clean up progress file
  if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);

  console.log('✓ index.html updated with images!');
}

function buildHTML(imageMap) {
  const indexPath = path.join(__dirname, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const imgMapJS = JSON.stringify(imageMap, null, 2);
  html = html.replace(/const IMG = \{[\s\S]*?\};/, `const IMG = ${imgMapJS};`);
  fs.writeFileSync(indexPath, html, 'utf8');
}

function getHTMLTemplate(imgMapJS) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NYC Best Store Finder</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f0f0;min-height:100vh;display:flex;justify-content:center;align-items:flex-start;padding:20px;}
.app{width:100%;max-width:1100px;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);}
.topbar{background:#1a1a2e;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.app-title{font-size:18px;font-weight:600;color:white;}
.app-sub{font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;}
.wk{background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.8);font-size:11px;padding:4px 12px;border-radius:20px;white-space:nowrap;}
.layout{display:grid;grid-template-columns:1fr 320px;min-height:680px;}
.left{display:flex;flex-direction:column;border-right:1px solid #e8e8e8;}
.searchbar{padding:10px 14px;border-bottom:1px solid #e8e8e8;background:white;display:flex;gap:10px;align-items:center;}
.searchbar input{flex:1;padding:7px 12px;font-size:13px;border:1px solid #ddd;border-radius:8px;background:#f7f7f7;color:#222;outline:none;}
.searchbar input:focus{border-color:#1a1a2e;background:white;}
.pcount{font-size:11px;color:#aaa;white-space:nowrap;flex-shrink:0;}
.cats-row{background:#f7f7f7;border-bottom:1px solid #e8e8e8;padding:8px 14px;display:flex;gap:5px;flex-wrap:wrap;}
.fb{padding:4px 11px;border-radius:20px;border:1px solid #ddd;background:white;font-size:11px;cursor:pointer;color:#666;white-space:nowrap;transition:all 0.12s;}
.fb:hover{border-color:#999;color:#333;}
.fb.on{background:#1a1a2e;color:white;border-color:#1a1a2e;}
.panel{padding:12px;overflow-y:auto;flex:1;max-height:570px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:7px;}
.pc{background:white;border:1.5px solid #e5e5e5;border-radius:10px;overflow:hidden;cursor:pointer;transition:transform 0.1s,border-color 0.15s,box-shadow 0.15s;position:relative;user-select:none;display:flex;flex-direction:column;}
.pc:hover{transform:translateY(-2px);border-color:#999;box-shadow:0 3px 10px rgba(0,0,0,0.08);}
.pc.sel{border-color:#1a1a2e;border-width:2px;background:#eef2ff;}
.img-wrap{width:100%;height:80px;background:#f8f8f8;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;}
.img-wrap img{width:100%;height:100%;object-fit:contain;padding:6px;display:block;}
.fe{font-size:30px;line-height:1;}
.pc-body{padding:6px 7px 7px;text-align:center;flex:1;}
.pn{font-size:10px;font-weight:600;color:#222;line-height:1.3;margin-bottom:1px;min-height:26px;display:flex;align-items:center;justify-content:center;}
.pb{font-size:9px;color:#888;}
.pf{font-size:9px;color:#bbb;margin-top:2px;}
.pck{position:absolute;top:5px;right:5px;width:17px;height:17px;border-radius:50%;background:#1a1a2e;color:white;font-size:10px;display:flex;align-items:center;justify-content:center;z-index:3;}
.sh{font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin:12px 0 6px;padding-left:2px;color:#888;display:flex;align-items:center;gap:6px;}
.no-d{text-align:center;padding:40px 20px;color:#999;font-size:13px;}
.right{display:flex;flex-direction:column;background:#f7f7f7;max-height:680px;overflow-y:auto;}
.rhead{padding:12px 14px 10px;border-bottom:1px solid #e8e8e8;background:white;}
.rht{font-size:14px;font-weight:600;color:#222;}
.rhs{font-size:11px;color:#888;margin-top:2px;}
.bempty{font-size:12px;color:#999;text-align:center;padding:24px 14px;line-height:1.7;}
.bitems{padding:8px 12px;border-bottom:1px solid #e8e8e8;}
.bi{display:flex;align-items:center;gap:7px;padding:4px 0;border-bottom:1px solid #f0f0f0;}
.bi:last-child{border-bottom:none;}
.bi-img{width:32px;height:32px;background:#f0f0f0;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:1px solid #e8e8e8;}
.bi-img img{width:100%;height:100%;object-fit:contain;padding:2px;}
.bin{font-size:11px;color:#222;flex:1;line-height:1.3;font-weight:500;}
.bib{font-size:9px;color:#888;}
.birm{font-size:14px;color:#ccc;cursor:pointer;padding:0 3px;line-height:1;}
.birm:hover{color:#e74c3c;}
.sres{padding:10px 12px;}
.srt{font-size:10px;font-weight:600;color:#999;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;}
.sc{background:white;border:1.5px solid #e5e5e5;border-radius:10px;padding:10px 11px;margin-bottom:7px;}
.sc.win{border-color:#16a34a;border-width:2px;}
.sct{display:flex;align-items:center;gap:6px;margin-bottom:5px;}
.scd{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.scn{font-size:12px;font-weight:600;color:#222;flex:1;}
.scto{font-size:14px;font-weight:600;}
.wb{background:#16a34a;color:white;font-size:9px;padding:2px 7px;border-radius:10px;font-weight:600;}
.bar-bg{height:4px;background:#eee;border-radius:3px;margin-bottom:4px;}
.bar-fill{height:4px;border-radius:3px;}
.scd2{font-size:10px;color:#888;display:flex;justify-content:space-between;}
.miss{font-size:10px;color:#e74c3c;margin-top:3px;line-height:1.4;}
.ibd{font-size:10px;border-top:1px solid #f0f0f0;margin-top:6px;padding-top:5px;}
.irow{display:flex;justify-content:space-between;padding:2px 0;gap:6px;}
.iname{color:#666;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.iprice{font-weight:600;color:#222;flex-shrink:0;}
.clr{margin:0 12px 12px;padding:8px;border:1px solid #ddd;border-radius:8px;background:transparent;cursor:pointer;font-size:12px;color:#888;width:calc(100% - 24px);}
.clr:hover{background:white;}
.disc{font-size:10px;color:#bbb;padding:0 12px 12px;line-height:1.5;}
@media(max-width:700px){.layout{grid-template-columns:1fr;}.right{max-height:none;border-top:1px solid #e8e8e8;}.panel{max-height:400px;}}
</style>
</head>
<body>
<div class="app">
  <div class="topbar">
    <div><div class="app-title">NYC Best Store Finder</div><div class="app-sub">Real product images · build your basket · find your cheapest single store</div></div>
    <span class="wk">Week of Mar 16, 2026</span>
  </div>
  <div class="layout">
    <div class="left">
      <div class="searchbar">
        <input id="search" type="text" placeholder="Search brand or product... (Heinz, Oreo, Tide, Cheerios...)">
        <span class="pcount" id="pcount"></span>
      </div>
      <div class="cats-row" id="cats"></div>
      <div class="panel" id="panel"></div>
    </div>
    <div class="right">
      <div class="rhead">
        <div class="rht">Basket <span id="bcount" style="font-size:12px;color:#888;font-weight:400;"></span></div>
        <div class="rhs" id="rsub">Add items to find your cheapest single store</div>
      </div>
      <div id="bitems-area"></div>
      <div id="results-area"></div>
      <button class="clr" id="clrbtn" onclick="clearB()" style="display:none">Clear basket</button>
      <div class="disc">Images via UPCitemdb. Prices from store circulars week of Mar 16, 2026. Verify in-store before shopping.</div>
    </div>
  </div>
</div>

<script>
const STORES=[
  {id:'wf',name:'Whole Foods',color:'#00674b'},
  {id:'tj',name:"Trader Joe's",color:'#c8102e'},
  {id:'aldi',name:'ALDI',color:'#00529b'},
  {id:'sr',name:'ShopRite',color:'#e31837'},
  {id:'bjs',name:"BJ's Wholesale",color:'#003087'},
  {id:'ss',name:'Stop & Shop',color:'#b00000'},
  {id:'kf',name:'Key Food',color:'#8b0000'},
];
const SM={};STORES.forEach(s=>SM[s.id]=s);
const CATS=['all','cereal','bread','pasta & sauce','canned goods','condiments','ice cream','chips','coffee','juice','soda & water','dairy','meat','snacks','frozen','breakfast','personal care','household','baby','pet','vitamins','baking'];
const CE={all:'🛒',cereal:'🥣',bread:'🍞','pasta & sauce':'🍝','canned goods':'🥫',condiments:'🧂','ice cream':'🍦',chips:'🥔',coffee:'☕',juice:'🍊','soda & water':'🥤',dairy:'🧀',meat:'🥩',snacks:'🍿',frozen:'🧊',breakfast:'🥞','personal care':'🧴',household:'🧹',baby:'👶',pet:'🐾',vitamins:'💊',baking:'🧁'};

// ── BAKED-IN IMAGE MAP (generated by fetch-images.js) ──
const IMG = ${imgMapJS};

const P=[
  {id:'c1',n:'Cheerios',b:'General Mills',e:'🥣',c:'cereal',sz:'8.9 oz',p:{wf:4.99,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:4.99}},
  {id:'c2',n:'Honey Nut Cheerios',b:'General Mills',e:'🥣',c:'cereal',sz:'10.8 oz',p:{wf:4.99,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:4.99}},
  {id:'c3',n:'Frosted Flakes',b:"Kellogg's",e:'🥣',c:'cereal',sz:'13.5 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:4.49}},
  {id:'c4',n:'Cinnamon Toast Crunch',b:'General Mills',e:'🥣',c:'cereal',sz:'12 oz',p:{wf:null,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'c5',n:'Lucky Charms',b:'General Mills',e:'🥣',c:'cereal',sz:'11.5 oz',p:{wf:null,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'c6',n:'Special K',b:"Kellogg's",e:'🥣',c:'cereal',sz:'12 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'c7',n:'Rice Krispies',b:"Kellogg's",e:'🥣',c:'cereal',sz:'12 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'c8',n:'Quaker Old Fashioned Oats',b:'Quaker',e:'🥣',c:'cereal',sz:'42 oz',p:{wf:5.99,tj:null,aldi:null,sr:5.49,bjs:null,ss:5.49,kf:null}},
  {id:'c9',n:"Cap'n Crunch",b:'Quaker',e:'🥣',c:'cereal',sz:'14 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'c10',n:'Raisin Bran',b:"Kellogg's",e:'🥣',c:'cereal',sz:'16.6 oz',p:{wf:null,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'br1',n:"Nature's Own Butterbread",b:"Nature's Own",e:'🍞',c:'bread',sz:'20 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:3.99}},
  {id:'br2',n:'Wonder Classic White',b:'Wonder',e:'🍞',c:'bread',sz:'20 oz',p:{wf:null,tj:null,aldi:null,sr:2.99,bjs:null,ss:2.99,kf:2.99}},
  {id:'br3',n:"Dave's Killer Bread",b:"Dave's Killer",e:'🍞',c:'bread',sz:'27 oz',p:{wf:5.99,tj:null,aldi:null,sr:5.49,bjs:null,ss:4.99,kf:null}},
  {id:'br4',n:'Thomas English Muffins',b:'Thomas',e:'🥐',c:'bread',sz:'6 ct',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'br5',n:'Sara Lee Classic White',b:'Sara Lee',e:'🍞',c:'bread',sz:'20 oz',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'pa1',n:'Barilla Spaghetti',b:'Barilla',e:'🍝',c:'pasta & sauce',sz:'16 oz',p:{wf:1.99,tj:null,aldi:null,sr:1.49,bjs:null,ss:1.49,kf:1.99}},
  {id:'pa2',n:'Barilla Penne',b:'Barilla',e:'🍝',c:'pasta & sauce',sz:'16 oz',p:{wf:1.99,tj:null,aldi:null,sr:1.49,bjs:null,ss:1.49,kf:1.99}},
  {id:'pa3',n:'Prego Tomato Sauce',b:'Prego',e:'🍅',c:'pasta & sauce',sz:'24 oz',p:{wf:null,tj:null,aldi:null,sr:2.99,bjs:null,ss:2.99,kf:2.99}},
  {id:'pa4',n:"Rao's Homemade Marinara",b:"Rao's",e:'🍅',c:'pasta & sauce',sz:'24 oz',p:{wf:8.99,tj:null,aldi:null,sr:7.99,bjs:null,ss:7.99,kf:null}},
  {id:'pa5',n:'Kraft Mac & Cheese',b:'Kraft',e:'🧀',c:'pasta & sauce',sz:'7.25 oz',p:{wf:null,tj:null,aldi:null,sr:1.49,bjs:null,ss:1.49,kf:1.49}},
  {id:'pa6',n:"Ragú Old World Marinara",b:'Ragú',e:'🍅',c:'pasta & sauce',sz:'24 oz',p:{wf:null,tj:null,aldi:null,sr:2.99,bjs:null,ss:2.99,kf:null}},
  {id:'ca1',n:"Campbell's Chicken Noodle",b:"Campbell's",e:'🥫',c:'canned goods',sz:'10.75 oz',p:{wf:null,tj:null,aldi:null,sr:1.99,bjs:null,ss:1.99,kf:1.99}},
  {id:'ca2',n:"Campbell's Tomato Soup",b:"Campbell's",e:'🥫',c:'canned goods',sz:'10.75 oz',p:{wf:null,tj:null,aldi:null,sr:1.99,bjs:null,ss:1.99,kf:1.99}},
  {id:'ca3',n:'StarKist Tuna Chunk Light',b:'StarKist',e:'🐟',c:'canned goods',sz:'5 oz',p:{wf:null,tj:null,aldi:null,sr:1.49,bjs:null,ss:1.49,kf:1.49}},
  {id:'ca4',n:'Goya Black Beans',b:'Goya',e:'🫘',c:'canned goods',sz:'15.5 oz',p:{wf:null,tj:null,aldi:null,sr:1.29,bjs:null,ss:1.29,kf:1.29}},
  {id:'ca5',n:"Bush's Best Baked Beans",b:"Bush's",e:'🫘',c:'canned goods',sz:'28 oz',p:{wf:null,tj:null,aldi:null,sr:2.99,bjs:null,ss:2.99,kf:null}},
  {id:'ca6',n:"Hunt's Diced Tomatoes",b:"Hunt's",e:'🍅',c:'canned goods',sz:'14.5 oz',p:{wf:null,tj:null,aldi:null,sr:1.49,bjs:null,ss:1.49,kf:1.49}},
  {id:'ca7',n:'Del Monte Sweet Corn',b:'Del Monte',e:'🌽',c:'canned goods',sz:'15.25 oz',p:{wf:null,tj:null,aldi:null,sr:1.29,bjs:null,ss:1.29,kf:null}},
  {id:'ca8',n:'Progresso Chicken Noodle',b:'Progresso',e:'🥫',c:'canned goods',sz:'19 oz',p:{wf:null,tj:null,aldi:null,sr:2.49,bjs:null,ss:2.49,kf:null}},
  {id:'co1',n:'Heinz Ketchup',b:'Heinz',e:'🍅',c:'condiments',sz:'20 oz',p:{wf:null,tj:null,aldi:null,sr:2.00,bjs:null,ss:2.00,kf:2.49}},
  {id:'co2',n:"Hellmann's Real Mayo",b:"Hellmann's",e:'🥄',c:'condiments',sz:'30 oz',p:{wf:null,tj:null,aldi:null,sr:5.99,bjs:null,ss:5.99,kf:null}},
  {id:'co3',n:"French's Yellow Mustard",b:"French's",e:'🌭',c:'condiments',sz:'20 oz',p:{wf:null,tj:null,aldi:null,sr:2.49,bjs:null,ss:2.49,kf:null}},
  {id:'co4',n:'Hidden Valley Ranch',b:'Hidden Valley',e:'🥗',c:'condiments',sz:'16 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'co5',n:"Frank's RedHot Sauce",b:"Frank's",e:'🌶️',c:'condiments',sz:'12 oz',p:{wf:3.99,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'co6',n:'Skippy Peanut Butter',b:'Skippy',e:'🥜',c:'condiments',sz:'16.3 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'co7',n:'Jif Peanut Butter',b:'Jif',e:'🥜',c:'condiments',sz:'16 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'co8',n:"Smucker's Strawberry Jam",b:"Smucker's",e:'🍓',c:'condiments',sz:'18 oz',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'co9',n:'Sriracha Hot Sauce',b:'Huy Fong',e:'🌶️',c:'condiments',sz:'17 oz',p:{wf:4.49,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'co10',n:'Tabasco Hot Sauce',b:'Tabasco',e:'🌶️',c:'condiments',sz:'5 oz',p:{wf:3.49,tj:null,aldi:null,sr:3.29,bjs:null,ss:3.29,kf:null}},
  {id:'ic1',n:"Ben & Jerry's Cherry Garcia",b:"Ben & Jerry's",e:'🍦',c:'ice cream',sz:'1 pint',p:{wf:5.99,tj:null,aldi:null,sr:5.49,bjs:null,ss:5.49,kf:5.99}},
  {id:'ic2',n:'Häagen-Dazs Vanilla',b:'Häagen-Dazs',e:'🍦',c:'ice cream',sz:'1 pint',p:{wf:5.49,tj:null,aldi:null,sr:4.99,bjs:null,ss:4.99,kf:5.49}},
  {id:'ic3',n:'Talenti Sea Salt Caramel',b:'Talenti',e:'🍨',c:'ice cream',sz:'1 pint',p:{wf:5.49,tj:null,aldi:null,sr:4.99,bjs:null,ss:4.99,kf:null}},
  {id:'ic4',n:'Breyers Natural Vanilla',b:'Breyers',e:'🍨',c:'ice cream',sz:'48 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:4.49}},
  {id:'ic5',n:"Edy's Grand Vanilla",b:"Edy's",e:'🍨',c:'ice cream',sz:'48 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.49,kf:4.99}},
  {id:'ic6',n:'Halo Top Vanilla Bean',b:'Halo Top',e:'🍦',c:'ice cream',sz:'1 pint',p:{wf:4.99,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'ic7',n:'Turkey Hill Vanilla',b:'Turkey Hill',e:'🍨',c:'ice cream',sz:'48 oz',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'ch1',n:"Lay's Classic",b:"Lay's",e:'🥔',c:'chips',sz:'8 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:3.99}},
  {id:'ch2',n:'Doritos Nacho Cheese',b:'Doritos',e:'🌮',c:'chips',sz:'9.25 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:3.99}},
  {id:'ch3',n:'Pringles Original',b:'Pringles',e:'🥔',c:'chips',sz:'5.2 oz',p:{wf:null,tj:null,aldi:null,sr:2.49,bjs:null,ss:2.49,kf:2.99}},
  {id:'ch4',n:'Cheetos Crunchy',b:'Cheetos',e:'🧡',c:'chips',sz:'8.5 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:3.99}},
  {id:'ch5',n:'Tostitos Scoops',b:'Tostitos',e:'🌮',c:'chips',sz:'10 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:3.99}},
  {id:'ch6',n:'Doritos Cool Ranch',b:'Doritos',e:'🌮',c:'chips',sz:'9.25 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'ch7',n:'Fritos Original',b:'Fritos',e:'🌽',c:'chips',sz:'9.25 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'ch8',n:"Lay's BBQ",b:"Lay's",e:'🥔',c:'chips',sz:'7.75 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'ch9',n:'Ruffles Cheddar Sour Cream',b:'Ruffles',e:'🥔',c:'chips',sz:'8 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'ch10',n:'Smartfood White Cheddar',b:'Smartfood',e:'🍿',c:'chips',sz:'6.75 oz',p:{wf:4.49,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'cf1',n:'Folgers Classic Roast',b:'Folgers',e:'☕',c:'coffee',sz:'30.5 oz',p:{wf:null,tj:null,aldi:null,sr:8.99,bjs:null,ss:8.49,kf:null}},
  {id:'cf2',n:'Maxwell House Original',b:'Maxwell House',e:'☕',c:'coffee',sz:'30.6 oz',p:{wf:null,tj:null,aldi:null,sr:7.99,bjs:null,ss:7.99,kf:null}},
  {id:'cf3',n:"Dunkin' Original Blend",b:"Dunkin'",e:'☕',c:'coffee',sz:'12 oz',p:{wf:null,tj:null,aldi:null,sr:7.99,bjs:null,ss:7.49,kf:null}},
  {id:'cf4',n:'Starbucks Pike Place',b:'Starbucks',e:'☕',c:'coffee',sz:'12 oz',p:{wf:10.99,tj:null,aldi:null,sr:9.99,bjs:null,ss:9.99,kf:null}},
  {id:'cf5',n:'Stok Cold Brew',b:'Stok',e:'🧋',c:'coffee',sz:'48 oz',p:{wf:null,tj:null,aldi:null,sr:5.99,bjs:null,ss:5.99,kf:null}},
  {id:'ju1',n:'Tropicana Pure Premium OJ',b:'Tropicana',e:'🍊',c:'juice',sz:'52 oz',p:{wf:null,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'ju2',n:'Simply Orange',b:'Simply Orange',e:'🍊',c:'juice',sz:'52 oz',p:{wf:5.49,tj:null,aldi:null,sr:4.99,bjs:null,ss:4.99,kf:null}},
  {id:'ju3',n:"Mott's Apple Juice",b:"Mott's",e:'🍎',c:'juice',sz:'64 oz',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'ju4',n:"Welch's Grape Juice",b:"Welch's",e:'🍇',c:'juice',sz:'64 oz',p:{wf:null,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'ju5',n:'Minute Maid OJ',b:'Minute Maid',e:'🍊',c:'juice',sz:'59 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'ju6',n:'Ocean Spray Cranberry',b:'Ocean Spray',e:'🍇',c:'juice',sz:'64 oz',p:{wf:null,tj:null,aldi:null,sr:null,bjs:null,ss:3.00,kf:null}},
  {id:'sw1',n:'Coca-Cola 12-Pack',b:'Coca-Cola',e:'🥤',c:'soda & water',sz:'12x12 oz',p:{wf:null,tj:null,aldi:null,sr:7.49,bjs:null,ss:6.99,kf:null}},
  {id:'sw2',n:'Pepsi 12-Pack',b:'Pepsi',e:'🥤',c:'soda & water',sz:'12x12 oz',p:{wf:null,tj:null,aldi:null,sr:7.49,bjs:null,ss:6.99,kf:6.50}},
  {id:'sw3',n:'Dr Pepper 12-Pack',b:'Dr Pepper',e:'🥤',c:'soda & water',sz:'12x12 oz',p:{wf:null,tj:null,aldi:null,sr:7.49,bjs:null,ss:6.99,kf:null}},
  {id:'sw4',n:'Diet Coke 12-Pack',b:'Diet Coke',e:'🥤',c:'soda & water',sz:'12x12 oz',p:{wf:null,tj:null,aldi:null,sr:7.49,bjs:null,ss:6.99,kf:null}},
  {id:'sw5',n:'LaCroix Sparkling 12pk',b:'LaCroix',e:'💧',c:'soda & water',sz:'12x12 oz',p:{wf:5.99,tj:null,aldi:null,sr:5.49,bjs:null,ss:5.49,kf:null}},
  {id:'sw6',n:'Red Bull 4-Pack',b:'Red Bull',e:'🐂',c:'soda & water',sz:'4x8.4 oz',p:{wf:7.99,tj:null,aldi:null,sr:6.99,bjs:null,ss:6.99,kf:null}},
  {id:'sw7',n:'Gatorade Fruit Punch 12pk',b:'Gatorade',e:'🏃',c:'soda & water',sz:'12x12 oz',p:{wf:null,tj:null,aldi:null,sr:10.99,bjs:null,ss:10.99,kf:null}},
  {id:'sw8',n:'Monster Energy',b:'Monster',e:'🟢',c:'soda & water',sz:'16 oz',p:{wf:null,tj:null,aldi:null,sr:2.49,bjs:null,ss:2.49,kf:null}},
  {id:'da1',n:'Chobani Greek Yogurt',b:'Chobani',e:'🍶',c:'dairy',sz:'32 oz',p:{wf:5.99,tj:null,aldi:null,sr:5.49,bjs:null,ss:5.49,kf:null}},
  {id:'da2',n:'Fage Total 2%',b:'Fage',e:'🍶',c:'dairy',sz:'35.3 oz',p:{wf:6.99,tj:null,aldi:null,sr:5.99,bjs:null,ss:5.99,kf:null}},
  {id:'da3',n:'Yoplait Strawberry',b:'Yoplait',e:'🍶',c:'dairy',sz:'6 oz',p:{wf:null,tj:null,aldi:null,sr:0.99,bjs:null,ss:0.99,kf:null}},
  {id:'da4',n:'Kraft Singles American',b:'Kraft',e:'🧀',c:'dairy',sz:'16 slices',p:{wf:null,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'da5',n:'Sargento Shredded Cheddar',b:'Sargento',e:'🧀',c:'dairy',sz:'8 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'da6',n:'Silk Oat Milk',b:'Silk',e:'🥛',c:'dairy',sz:'64 oz',p:{wf:4.99,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'da7',n:"Land O' Lakes Butter",b:"Land O' Lakes",e:'🧈',c:'dairy',sz:'1 lb',p:{wf:5.99,tj:null,aldi:null,sr:5.49,bjs:null,ss:5.49,kf:null}},
  {id:'da8',n:'Philadelphia Cream Cheese',b:'Philadelphia',e:'🧀',c:'dairy',sz:'8 oz',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'da9',n:"Eggland's Best Eggs",b:"Eggland's Best",e:'🥚',c:'dairy',sz:'12 ct',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'da10',n:'Oatly Oat Milk',b:'Oatly',e:'🥛',c:'dairy',sz:'64 oz',p:{wf:5.49,tj:null,aldi:null,sr:4.99,bjs:null,ss:4.99,kf:null}},
  {id:'me1',n:'Oscar Mayer Classic Bacon',b:'Oscar Mayer',e:'🥓',c:'meat',sz:'16 oz',p:{wf:null,tj:null,aldi:null,sr:5.49,bjs:null,ss:5.49,kf:null}},
  {id:'me2',n:'Jimmy Dean Bacon',b:'Jimmy Dean',e:'🥓',c:'meat',sz:'16 oz',p:{wf:null,tj:null,aldi:null,sr:null,bjs:null,ss:3.99,kf:null}},
  {id:'me3',n:'Ball Park Beef Franks',b:'Ball Park',e:'🌭',c:'meat',sz:'15 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'me4',n:'Hebrew National Hot Dogs',b:'Hebrew National',e:'🌭',c:'meat',sz:'12 oz',p:{wf:5.49,tj:null,aldi:null,sr:4.99,bjs:null,ss:4.99,kf:null}},
  {id:'me5',n:'Hillshire Farm Smoked Sausage',b:'Hillshire Farm',e:'🌭',c:'meat',sz:'12 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'sn1',n:'Oreo Cookies',b:'Nabisco',e:'🍪',c:'snacks',sz:'14.3 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'sn2',n:'Chips Ahoy!',b:'Nabisco',e:'🍪',c:'snacks',sz:'13 oz',p:{wf:null,tj:null,aldi:null,sr:null,bjs:null,ss:3.99,kf:4.00}},
  {id:'sn3',n:'Ritz Crackers',b:'Nabisco',e:'🫙',c:'snacks',sz:'13.7 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'sn4',n:'Goldfish Cheddar',b:'Pepperidge Farm',e:'🐟',c:'snacks',sz:'6.6 oz',p:{wf:null,tj:null,aldi:null,sr:2.49,bjs:null,ss:2.49,kf:null}},
  {id:'sn5',n:"Snyder's Pretzels",b:"Snyder's",e:'🥨',c:'snacks',sz:'16 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.49,kf:null}},
  {id:'sn6',n:'SkinnyPop Popcorn',b:'SkinnyPop',e:'🍿',c:'snacks',sz:'4.4 oz',p:{wf:3.99,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'sn7',n:'Kind Bar 6-pack',b:'Kind',e:'🍫',c:'snacks',sz:'6 bars',p:{wf:6.99,tj:null,aldi:null,sr:6.49,bjs:null,ss:6.49,kf:null}},
  {id:'sn8',n:'Sabra Classic Hummus',b:'Sabra',e:'🫘',c:'snacks',sz:'17 oz',p:{wf:5.99,tj:null,aldi:null,sr:4.99,bjs:null,ss:4.99,kf:null}},
  {id:'sn9',n:'Nature Valley Granola Bars',b:'Nature Valley',e:'🍫',c:'snacks',sz:'8.9 oz',p:{wf:null,tj:null,aldi:null,sr:2.50,bjs:null,ss:2.50,kf:null}},
  {id:'sn10',n:'Pop-Tarts Strawberry',b:"Kellogg's",e:'🍓',c:'snacks',sz:'8 ct',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'sn11',n:'Planters Mixed Nuts',b:'Planters',e:'🥜',c:'snacks',sz:'15.25 oz',p:{wf:null,tj:null,aldi:null,sr:6.99,bjs:null,ss:6.99,kf:null}},
  {id:'sn12',n:'Wheat Thins',b:'Nabisco',e:'🫙',c:'snacks',sz:'9.1 oz',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'fr1',n:'DiGiorno Rising Crust Pizza',b:'DiGiorno',e:'🍕',c:'frozen',sz:'28.2 oz',p:{wf:null,tj:null,aldi:null,sr:6.99,bjs:null,ss:6.99,kf:null}},
  {id:'fr2',n:'Red Baron Classic Pizza',b:'Red Baron',e:'🍕',c:'frozen',sz:'20.6 oz',p:{wf:null,tj:null,aldi:null,sr:5.49,bjs:null,ss:4.88,kf:null}},
  {id:'fr3',n:'Eggo Homestyle Waffles',b:'Eggo',e:'🧇',c:'frozen',sz:'12.3 oz',p:{wf:null,tj:null,aldi:null,sr:null,bjs:null,ss:2.50,kf:3.50}},
  {id:'fr4',n:"Stouffer's Mac & Cheese",b:"Stouffer's",e:'🧀',c:'frozen',sz:'12 oz',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'fr5',n:'Ore-Ida Tater Tots',b:'Ore-Ida',e:'🍟',c:'frozen',sz:'28 oz',p:{wf:null,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'fr6',n:"Totino's Party Pizza",b:"Totino's",e:'🍕',c:'frozen',sz:'10.7 oz',p:{wf:null,tj:null,aldi:null,sr:1.99,bjs:null,ss:1.99,kf:null}},
  {id:'fr7',n:'Birds Eye Broccoli',b:'Birds Eye',e:'🥦',c:'frozen',sz:'12 oz',p:{wf:null,tj:null,aldi:null,sr:2.49,bjs:null,ss:2.49,kf:null}},
  {id:'fr8',n:'Lean Cuisine Steamers',b:'Lean Cuisine',e:'🥘',c:'frozen',sz:'10 oz',p:{wf:null,tj:null,aldi:null,sr:2.99,bjs:null,ss:2.99,kf:null}},
  {id:'bk1',n:'Nutella',b:'Nutella',e:'🍫',c:'breakfast',sz:'13 oz',p:{wf:4.99,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'bk2',n:'Pillsbury Pancake Mix',b:'Pillsbury',e:'🥞',c:'breakfast',sz:'32 oz',p:{wf:null,tj:null,aldi:null,sr:3.99,bjs:null,ss:3.99,kf:null}},
  {id:'bk3',n:'Quaker Instant Oatmeal',b:'Quaker',e:'🥣',c:'breakfast',sz:'12 pkts',p:{wf:null,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'bk4',n:'Log Cabin Syrup',b:'Log Cabin',e:'🧇',c:'breakfast',sz:'24 oz',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'bk5',n:'Jimmy Dean Breakfast Sandwiches',b:'Jimmy Dean',e:'🥪',c:'breakfast',sz:'4 ct',p:{wf:null,tj:null,aldi:null,sr:5.99,bjs:null,ss:5.49,kf:null}},
  {id:'pc1',n:'Head & Shoulders',b:'Head & Shoulders',e:'🧴',c:'personal care',sz:'23.7 oz',p:{wf:null,tj:null,aldi:null,sr:7.99,bjs:null,ss:7.99,kf:null}},
  {id:'pc2',n:'Dove Beauty Bar 4pk',b:'Dove',e:'🧼',c:'personal care',sz:'4 pk',p:{wf:null,tj:null,aldi:null,sr:5.99,bjs:null,ss:5.99,kf:null}},
  {id:'pc3',n:'Colgate Total Toothpaste',b:'Colgate',e:'🦷',c:'personal care',sz:'4.8 oz',p:{wf:null,tj:null,aldi:null,sr:4.49,bjs:null,ss:4.49,kf:null}},
  {id:'pc4',n:'Listerine Cool Mint',b:'Listerine',e:'🦷',c:'personal care',sz:'33.8 oz',p:{wf:null,tj:null,aldi:null,sr:6.99,bjs:null,ss:6.99,kf:null}},
  {id:'hw1',n:'Tide Original Liquid',b:'Tide',e:'🧺',c:'household',sz:'92 oz',p:{wf:null,tj:null,aldi:null,sr:13.99,bjs:null,ss:13.99,kf:null}},
  {id:'hw2',n:'Tide Pods Original 42ct',b:'Tide',e:'🧺',c:'household',sz:'42 ct',p:{wf:null,tj:null,aldi:null,sr:14.99,bjs:null,ss:14.99,kf:null}},
  {id:'hw3',n:'Bounty Paper Towels 6pk',b:'Bounty',e:'🧻',c:'household',sz:'6 rolls',p:{wf:null,tj:null,aldi:null,sr:null,bjs:null,ss:6.99,kf:null}},
  {id:'hw4',n:'Charmin Ultra Soft 12pk',b:'Charmin',e:'🧻',c:'household',sz:'12 rolls',p:{wf:null,tj:null,aldi:null,sr:8.99,bjs:null,ss:8.99,kf:null}},
  {id:'hw5',n:'Lysol Disinfectant Spray',b:'Lysol',e:'🫧',c:'household',sz:'12.5 oz',p:{wf:null,tj:null,aldi:null,sr:5.99,bjs:null,ss:5.99,kf:null}},
  {id:'hw6',n:'Dawn Ultra Original',b:'Dawn',e:'🧴',c:'household',sz:'19.4 oz',p:{wf:null,tj:null,aldi:null,sr:null,bjs:null,ss:2.49,kf:null}},
  {id:'hw7',n:'Glad ForceFlex Trash Bags',b:'Glad',e:'🗑️',c:'household',sz:'20 ct',p:{wf:null,tj:null,aldi:null,sr:7.49,bjs:null,ss:7.49,kf:null}},
  {id:'ba1',n:'Pampers Swaddlers',b:'Pampers',e:'👶',c:'baby',sz:'27-32 ct',p:{wf:null,tj:null,aldi:null,sr:9.49,bjs:null,ss:7.49,kf:null}},
  {id:'ba2',n:'Huggies Little Movers',b:'Huggies',e:'👶',c:'baby',sz:'25-32 ct',p:{wf:null,tj:null,aldi:null,sr:9.49,bjs:null,ss:7.49,kf:null}},
  {id:'ba3',n:'Gerber Baby Purees',b:'Gerber',e:'🍼',c:'baby',sz:'10 ct',p:{wf:null,tj:null,aldi:null,sr:10.00,bjs:null,ss:10.00,kf:null}},
  {id:'pe1',n:'Purina Fancy Feast 12ct',b:'Purina',e:'🐱',c:'pet',sz:'12x3oz',p:{wf:null,tj:null,aldi:null,sr:8.99,bjs:null,ss:8.99,kf:null}},
  {id:'pe2',n:'Pedigree Dry Dog Food',b:'Pedigree',e:'🐶',c:'pet',sz:'3.5 lb',p:{wf:null,tj:null,aldi:null,sr:4.50,bjs:null,ss:4.50,kf:null}},
  {id:'pe3',n:'Milk-Bone Dog Biscuits',b:'Milk-Bone',e:'🦴',c:'pet',sz:'24 oz',p:{wf:null,tj:null,aldi:null,sr:4.99,bjs:null,ss:4.99,kf:null}},
  {id:'vi1',n:'Centrum Adults Multivitamin',b:'Centrum',e:'💊',c:'vitamins',sz:'130 ct',p:{wf:null,tj:null,aldi:null,sr:12.99,bjs:null,ss:12.99,kf:null}},
  {id:'vi2',n:'Emergen-C Vitamin C 30ct',b:'Emergen-C',e:'🍊',c:'vitamins',sz:'30 ct',p:{wf:9.99,tj:null,aldi:null,sr:8.99,bjs:null,ss:8.99,kf:null}},
  {id:'vi3',n:'Tylenol Extra Strength',b:'Tylenol',e:'💊',c:'vitamins',sz:'100 ct',p:{wf:null,tj:null,aldi:null,sr:12.99,bjs:null,ss:12.99,kf:null}},
  {id:'vi4',n:'Advil Ibuprofen 100ct',b:'Advil',e:'💊',c:'vitamins',sz:'100 ct',p:{wf:null,tj:null,aldi:null,sr:10.99,bjs:null,ss:10.99,kf:null}},
  {id:'bg1',n:'Gold Medal All-Purpose Flour',b:'Gold Medal',e:'🌾',c:'baking',sz:'5 lb',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'bg2',n:'Domino Granulated Sugar',b:'Domino',e:'🍬',c:'baking',sz:'4 lb',p:{wf:null,tj:null,aldi:null,sr:3.49,bjs:null,ss:3.49,kf:null}},
  {id:'bg3',n:'Duncan Hines Yellow Cake Mix',b:'Duncan Hines',e:'🎂',c:'baking',sz:'15.25 oz',p:{wf:null,tj:null,aldi:null,sr:1.99,bjs:null,ss:1.99,kf:null}},
  {id:'bg4',n:'Pillsbury Brownie Mix',b:'Pillsbury',e:'🍫',c:'baking',sz:'18.4 oz',p:{wf:null,tj:null,aldi:null,sr:2.49,bjs:null,ss:2.49,kf:null}},
];

const PM={};P.forEach(p=>PM[p.id]=p);
let aC='all';
const basket=new Set();

function minP(p){const v=STORES.map(s=>p.p[s.id]).filter(x=>x!=null);return v.length?Math.min(...v):null;}
function stCt(p){return STORES.filter(s=>p.p[s.id]!=null).length;}

function renderCats(){
  document.getElementById('cats').innerHTML=CATS.map(c=>
    \`<button class="fb\${aC===c?' on':''}" onclick="setC('\${c}')">\${CE[c]||''} \${c==='all'?'All':c.charAt(0).toUpperCase()+c.slice(1)}</button>\`
  ).join('');
}

function cardHTML(p){
  const sel=basket.has(p.id);
  const mp=minP(p),sc=stCt(p);
  const imgUrl=IMG[p.id]||'';
  const imgContent=imgUrl?\`<img src="\${imgUrl}" alt="\${p.n}" onerror="this.style.display='none'">\`:\`<span class="fe">\${p.e}</span>\`;
  return \`<div class="pc\${sel?' sel':''}" onclick="tog('\${p.id}')">
    \${sel?\`<span class="pck">✓</span>\`:''}
    <div class="img-wrap">\${imgContent}</div>
    <div class="pc-body">
      <div class="pn">\${p.n}</div>
      <div class="pb">\${p.b} · \${p.sz}</div>
      <div class="pf">\${mp!=null?'from $'+mp.toFixed(2)+' · ':''}\${sc} store\${sc!==1?'s':''}</div>
    </div>
  </div>\`;
}

function render(){
  const q=(document.getElementById('search').value||'').toLowerCase().trim();
  const filt=P.filter(p=>{
    const catOk=aC==='all'||p.c===aC;
    const qOk=!q||p.n.toLowerCase().includes(q)||p.b.toLowerCase().includes(q)||p.c.toLowerCase().includes(q);
    return catOk&&qOk;
  });
  document.getElementById('pcount').textContent=filt.length+' products';
  const panel=document.getElementById('panel');
  if(!filt.length){panel.innerHTML='<div class="no-d">No products found.</div>';return;}
  if(aC==='all'&&!q){
    const bc={};filt.forEach(p=>{if(!bc[p.c])bc[p.c]=[];bc[p.c].push(p);});
    panel.innerHTML=Object.keys(bc).map(cat=>
      \`<div class="sh"><span style="font-size:15px">\${CE[cat]||''}</span>\${cat.charAt(0).toUpperCase()+cat.slice(1)}</div>
       <div class="grid">\${bc[cat].map(cardHTML).join('')}</div>\`
    ).join('');
  } else {
    panel.innerHTML=\`<div class="grid">\${filt.map(cardHTML).join('')}</div>\`;
  }
}

function tog(id){
  if(basket.has(id))basket.delete(id);else basket.add(id);
  render();renderRight();
}

function renderRight(){
  const items=[...basket].map(id=>PM[id]);
  const n=items.length;
  document.getElementById('bcount').textContent=n?\`· \${n} item\${n!==1?'s':''}\'':'' ;
  document.getElementById('clrbtn').style.display=n?'block':'none';
  if(!n){
    document.getElementById('rsub').textContent='Add items to find your cheapest single store';
    document.getElementById('bitems-area').innerHTML='<div class="bempty">Tap any product to add it to your basket.<br>We\\'ll rank all 7 stores by your total basket cost.</div>';
    document.getElementById('results-area').innerHTML='';
    return;
  }
  document.getElementById('rsub').textContent='Stores ranked cheapest → most expensive';
  document.getElementById('bitems-area').innerHTML=\`<div class="bitems">\${items.map(p=>{
    const img=IMG[p.id]||'';
    const imgEl=img?\`<img src="\${img}" style="width:100%;height:100%;object-fit:contain;padding:2px;" onerror="this.style.display='none'">\`:\`<span style="font-size:16px">\${p.e}</span>\`;
    return \`<div class="bi">
      <div class="bi-img">\${imgEl}</div>
      <div style="flex:1;min-width:0"><div class="bin">\${p.n}</div><div class="bib">\${p.b} · \${p.sz}</div></div>
      <span class="birm" onclick="tog('\${p.id}')">✕</span>
    </div>\`;
  }).join('')}</div>\`;

  const results=STORES.map(s=>{
    let total=0,covered=0,missing=[];
    items.forEach(p=>{const pr=p.p[s.id];if(pr!=null){total+=pr;covered++;}else missing.push(p);});
    return{s,total,covered,missing,pct:covered/items.length};
  }).sort((a,b)=>b.covered!==a.covered?b.covered-a.covered:a.total-b.total);

  const winner=results[0];
  document.getElementById('results-area').innerHTML=\`<div class="sres">
    <div class="srt">Store ranking · your basket</div>
    \${results.map((r,i)=>{
      const isW=i===0&&r.covered>0;
      const sc=r.s.color;
      const diff=r.covered===winner.covered&&!isW&&r.covered>0?r.total-winner.total:null;
      return \`<div class="sc\${isW?' win':''}">
        <div class="sct">
          <span class="scd" style="background:\${sc}"></span>
          <span class="scn">\${r.s.name}</span>
          \${isW?'<span class="wb">★ Best deal</span>':''}
          <span class="scto" style="color:\${r.covered===0?'#ccc':isW?sc:'#222'}">
            \${r.covered===0?'—':'$'+r.total.toFixed(2)}</span>
        </div>
        <div class="bar-bg"><div class="bar-fill" style="width:\${(r.pct*100).toFixed(0)}%;background:\${sc}"></div></div>
        <div class="scd2">
          <span>\${r.covered}/\${items.length} items stocked</span>
          \${diff!=null?\`<span style="color:#e74c3c">+$\${diff.toFixed(2)}</span>\`:''}
        </div>
        \${r.missing.length?\`<div class="miss">Missing: \${r.missing.slice(0,4).map(p=>p.b).join(', ')}\${r.missing.length>4?' +'+(r.missing.length-4)+' more':''}</div>\`:''}
        \${r.covered>0?\`<div class="ibd">\${items.filter(p=>p.p[r.s.id]!=null).map(p=>\`
          <div class="irow"><span class="iname">\${p.e} \${p.n}</span><span class="iprice">$\${p.p[r.s.id].toFixed(2)}</span></div>\`).join('')}</div>\`:''}
      </div>\`;
    }).join('')}
  </div>\`;
}

function clearB(){basket.clear();render();renderRight();}
function setC(c){aC=c;renderCats();render();}
document.getElementById('search').addEventListener('input',render);
renderCats();render();renderRight();
</script>
</body>
</html>`;
}

main().catch(e => {
  console.error('\n✗ Error:', e.message);
  process.exit(1);
});
