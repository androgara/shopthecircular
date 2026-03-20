#!/usr/bin/env node
/**
 * fetch-prices.js — Automated price scraper for NYC Best Store Finder
 *
 * Uses Playwright (headless Chromium) to visit store sites and collect prices.
 * Runs silently in the background — your computer stays fully usable.
 *
 * Setup (one-time):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Run:
 *   node fetch-prices.js
 *
 * Resume after interruption:
 *   node fetch-prices.js          ← picks up from .price-progress.json
 *
 * Force re-scrape a specific store:
 *   node fetch-prices.js --store fb
 */

const { chromium } = require('playwright');
const fs = require('fs');

const PROGRESS_FILE = '.price-progress.json';
const INDEX_FILE    = 'index.html';
const DELAY_MS      = 2500;   // pause between requests (be polite, avoid blocks)
const NAV_TIMEOUT   = 30000;  // ms to wait for page load
const PRICE_TIMEOUT = 12000;  // ms to wait for price element to appear

// ── Products ──────────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id:'c1',  name:'Cheerios',                     brand:'General Mills',    size:'8.9 oz'    },
  { id:'c2',  name:'Honey Nut Cheerios',            brand:'General Mills',    size:'10.8 oz'   },
  { id:'c3',  name:'Frosted Flakes',                brand:"Kellogg's",        size:'13.5 oz'   },
  { id:'c4',  name:'Cinnamon Toast Crunch',         brand:'General Mills',    size:'12 oz'     },
  { id:'c5',  name:'Lucky Charms',                  brand:'General Mills',    size:'11.5 oz'   },
  { id:'c6',  name:'Special K',                     brand:"Kellogg's",        size:'12 oz'     },
  { id:'c7',  name:'Rice Krispies',                 brand:"Kellogg's",        size:'12 oz'     },
  { id:'c8',  name:'Quaker Old Fashioned Oats',     brand:'Quaker',           size:'42 oz'     },
  { id:'c9',  name:"Cap'n Crunch",                  brand:'Quaker',           size:'14 oz'     },
  { id:'c10', name:'Raisin Bran',                   brand:"Kellogg's",        size:'16.6 oz'   },
  { id:'br1', name:"Nature's Own Butterbread",      brand:"Nature's Own",     size:'20 oz'     },
  { id:'br2', name:'Wonder Classic White',          brand:'Wonder',           size:'20 oz'     },
  { id:'br3', name:"Dave's Killer Bread",           brand:"Dave's Killer",    size:'27 oz'     },
  { id:'br4', name:'Thomas English Muffins',        brand:'Thomas',           size:'6 ct'      },
  { id:'br5', name:'Sara Lee Classic White',        brand:'Sara Lee',         size:'20 oz'     },
  { id:'pa1', name:'Barilla Spaghetti',             brand:'Barilla',          size:'16 oz'     },
  { id:'pa2', name:'Barilla Penne',                 brand:'Barilla',          size:'16 oz'     },
  { id:'pa3', name:'Prego Tomato Sauce',            brand:'Prego',            size:'24 oz'     },
  { id:'pa4', name:"Rao's Homemade Marinara",       brand:"Rao's",            size:'24 oz'     },
  { id:'pa5', name:'Kraft Mac & Cheese',            brand:'Kraft',            size:'7.25 oz'   },
  { id:'pa6', name:'Ragú Old World Marinara',       brand:'Ragú',             size:'24 oz'     },
  { id:'ca1', name:"Campbell's Chicken Noodle",     brand:"Campbell's",       size:'10.75 oz'  },
  { id:'ca2', name:"Campbell's Tomato Soup",        brand:"Campbell's",       size:'10.75 oz'  },
  { id:'ca3', name:'StarKist Tuna Chunk Light',     brand:'StarKist',         size:'5 oz'      },
  { id:'ca4', name:'Goya Black Beans',              brand:'Goya',             size:'15.5 oz'   },
  { id:'ca5', name:"Bush's Best Baked Beans",       brand:"Bush's",           size:'28 oz'     },
  { id:'ca6', name:"Hunt's Diced Tomatoes",         brand:"Hunt's",           size:'14.5 oz'   },
  { id:'ca7', name:'Del Monte Sweet Corn',          brand:'Del Monte',        size:'15.25 oz'  },
  { id:'ca8', name:'Progresso Chicken Noodle',      brand:'Progresso',        size:'19 oz'     },
  { id:'co1', name:'Heinz Ketchup',                 brand:'Heinz',            size:'20 oz'     },
  { id:'co2', name:"Hellmann's Real Mayo",          brand:"Hellmann's",       size:'30 oz'     },
  { id:'co3', name:"French's Yellow Mustard",       brand:"French's",         size:'20 oz'     },
  { id:'co4', name:'Hidden Valley Ranch',           brand:'Hidden Valley',    size:'16 oz'     },
  { id:'co5', name:"Frank's RedHot Sauce",          brand:"Frank's",          size:'12 oz'     },
  { id:'co6', name:'Skippy Peanut Butter',          brand:'Skippy',           size:'16.3 oz'   },
  { id:'co7', name:'Jif Peanut Butter',             brand:'Jif',              size:'16 oz'     },
  { id:'co8', name:"Smucker's Strawberry Jam",      brand:"Smucker's",        size:'18 oz'     },
  { id:'co9', name:'Sriracha Hot Sauce',            brand:'Huy Fong',         size:'17 oz'     },
  { id:'co10',name:'Tabasco Hot Sauce',             brand:'Tabasco',          size:'5 oz'      },
  { id:'ic1', name:"Ben & Jerry's Cherry Garcia",   brand:"Ben & Jerry's",    size:'1 pint'    },
  { id:'ic2', name:'Häagen-Dazs Vanilla',           brand:'Häagen-Dazs',      size:'1 pint'    },
  { id:'ic3', name:'Talenti Sea Salt Caramel',      brand:'Talenti',          size:'1 pint'    },
  { id:'ic4', name:'Breyers Natural Vanilla',       brand:'Breyers',          size:'48 oz'     },
  { id:'ic5', name:"Edy's Grand Vanilla",           brand:"Edy's",            size:'48 oz'     },
  { id:'ic6', name:'Halo Top Vanilla Bean',         brand:'Halo Top',         size:'1 pint'    },
  { id:'ic7', name:'Turkey Hill Vanilla',           brand:'Turkey Hill',      size:'48 oz'     },
  { id:'ch1', name:"Lay's Classic",                 brand:"Lay's",            size:'8 oz'      },
  { id:'ch2', name:'Doritos Nacho Cheese',          brand:'Doritos',          size:'9.25 oz'   },
  { id:'ch3', name:'Pringles Original',             brand:'Pringles',         size:'5.2 oz'    },
  { id:'ch4', name:'Cheetos Crunchy',               brand:'Cheetos',          size:'8.5 oz'    },
  { id:'ch5', name:'Tostitos Scoops',               brand:'Tostitos',         size:'10 oz'     },
  { id:'ch6', name:'Doritos Cool Ranch',            brand:'Doritos',          size:'9.25 oz'   },
  { id:'ch7', name:'Fritos Original',               brand:'Fritos',           size:'9.25 oz'   },
  { id:'ch8', name:"Lay's BBQ",                     brand:"Lay's",            size:'7.75 oz'   },
  { id:'ch9', name:'Ruffles Cheddar Sour Cream',    brand:'Ruffles',          size:'8 oz'      },
  { id:'ch10',name:'Smartfood White Cheddar',       brand:'Smartfood',        size:'6.75 oz'   },
  { id:'cf1', name:'Folgers Classic Roast',         brand:'Folgers',          size:'30.5 oz'   },
  { id:'cf2', name:'Maxwell House Original',        brand:'Maxwell House',    size:'30.6 oz'   },
  { id:'cf3', name:"Dunkin' Original Blend",        brand:"Dunkin'",          size:'12 oz'     },
  { id:'cf4', name:'Starbucks Pike Place',          brand:'Starbucks',        size:'12 oz'     },
  { id:'cf5', name:'Stok Cold Brew',                brand:'Stok',             size:'48 oz'     },
  { id:'ju1', name:'Tropicana Pure Premium OJ',     brand:'Tropicana',        size:'52 oz'     },
  { id:'ju2', name:'Simply Orange',                 brand:'Simply Orange',    size:'52 oz'     },
  { id:'ju3', name:"Mott's Apple Juice",            brand:"Mott's",           size:'64 oz'     },
  { id:'ju4', name:"Welch's Grape Juice",           brand:"Welch's",          size:'64 oz'     },
  { id:'ju5', name:'Minute Maid OJ',                brand:'Minute Maid',      size:'59 oz'     },
  { id:'ju6', name:'Ocean Spray Cranberry',         brand:'Ocean Spray',      size:'64 oz'     },
  { id:'sw1', name:'Coca-Cola 12-Pack',             brand:'Coca-Cola',        size:'12x12 oz'  },
  { id:'sw2', name:'Pepsi 12-Pack',                 brand:'Pepsi',            size:'12x12 oz'  },
  { id:'sw3', name:'Dr Pepper 12-Pack',             brand:'Dr Pepper',        size:'12x12 oz'  },
  { id:'sw4', name:'Diet Coke 12-Pack',             brand:'Diet Coke',        size:'12x12 oz'  },
  { id:'sw5', name:'LaCroix Sparkling 12pk',        brand:'LaCroix',          size:'12x12 oz'  },
  { id:'sw6', name:'Red Bull 4-Pack',               brand:'Red Bull',         size:'4x8.4 oz'  },
  { id:'sw7', name:'Gatorade Fruit Punch 12pk',     brand:'Gatorade',         size:'12x12 oz'  },
  { id:'sw8', name:'Monster Energy',                brand:'Monster',          size:'16 oz'     },
  { id:'da1', name:'Chobani Greek Yogurt',          brand:'Chobani',          size:'32 oz'     },
  { id:'da2', name:'Fage Total 2%',                 brand:'Fage',             size:'35.3 oz'   },
  { id:'da3', name:'Yoplait Strawberry',            brand:'Yoplait',          size:'6 oz'      },
  { id:'da4', name:'Kraft Singles American',        brand:'Kraft',            size:'16 slices' },
  { id:'da5', name:'Sargento Shredded Cheddar',     brand:'Sargento',         size:'8 oz'      },
  { id:'da6', name:'Silk Oat Milk',                 brand:'Silk',             size:'64 oz'     },
  { id:'da7', name:"Land O' Lakes Butter",          brand:"Land O' Lakes",    size:'1 lb'      },
  { id:'da8', name:'Philadelphia Cream Cheese',     brand:'Philadelphia',     size:'8 oz'      },
  { id:'da9', name:"Eggland's Best Eggs",           brand:"Eggland's Best",   size:'12 ct'     },
  { id:'da10',name:'Oatly Oat Milk',                brand:'Oatly',            size:'64 oz'     },
  { id:'me1', name:'Oscar Mayer Classic Bacon',     brand:'Oscar Mayer',      size:'16 oz'     },
  { id:'me2', name:'Jimmy Dean Bacon',              brand:'Jimmy Dean',       size:'16 oz'     },
  { id:'me3', name:'Ball Park Beef Franks',         brand:'Ball Park',        size:'15 oz'     },
  { id:'me4', name:'Hebrew National Hot Dogs',      brand:'Hebrew National',  size:'12 oz'     },
  { id:'me5', name:'Hillshire Farm Smoked Sausage', brand:'Hillshire Farm',   size:'12 oz'     },
  { id:'sn1', name:'Oreo Cookies',                  brand:'Nabisco',          size:'14.3 oz'   },
  { id:'sn2', name:'Chips Ahoy!',                   brand:'Nabisco',          size:'13 oz'     },
  { id:'sn3', name:'Ritz Crackers',                 brand:'Nabisco',          size:'13.7 oz'   },
  { id:'sn4', name:'Goldfish Cheddar',              brand:'Pepperidge Farm',  size:'6.6 oz'    },
  { id:'sn5', name:"Snyder's Pretzels",             brand:"Snyder's",         size:'16 oz'     },
  { id:'sn6', name:'SkinnyPop Popcorn',             brand:'SkinnyPop',        size:'4.4 oz'    },
  { id:'sn7', name:'Kind Bar 6-pack',               brand:'Kind',             size:'6 bars'    },
  { id:'sn8', name:'Sabra Classic Hummus',          brand:'Sabra',            size:'17 oz'     },
  { id:'sn9', name:'Nature Valley Granola Bars',    brand:'Nature Valley',    size:'8.9 oz'    },
  { id:'sn10',name:'Pop-Tarts Strawberry',          brand:"Kellogg's",        size:'8 ct'      },
  { id:'sn11',name:'Planters Mixed Nuts',           brand:'Planters',         size:'15.25 oz'  },
  { id:'sn12',name:'Wheat Thins',                   brand:'Nabisco',          size:'9.1 oz'    },
  { id:'fr1', name:'DiGiorno Rising Crust Pizza',   brand:'DiGiorno',         size:'28.2 oz'   },
  { id:'fr2', name:'Red Baron Classic Pizza',       brand:'Red Baron',        size:'20.6 oz'   },
  { id:'fr3', name:'Eggo Homestyle Waffles',        brand:'Eggo',             size:'12.3 oz'   },
  { id:'fr4', name:"Stouffer's Mac & Cheese",       brand:"Stouffer's",       size:'12 oz'     },
  { id:'fr5', name:'Ore-Ida Tater Tots',            brand:'Ore-Ida',          size:'28 oz'     },
  { id:'fr6', name:"Totino's Party Pizza",          brand:"Totino's",         size:'10.7 oz'   },
  { id:'fr7', name:'Birds Eye Broccoli',            brand:'Birds Eye',        size:'12 oz'     },
  { id:'fr8', name:'Lean Cuisine Steamers',         brand:'Lean Cuisine',     size:'10 oz'     },
  { id:'bk1', name:'Nutella',                       brand:'Nutella',          size:'13 oz'     },
  { id:'bk2', name:'Pillsbury Pancake Mix',         brand:'Pillsbury',        size:'32 oz'     },
  { id:'bk3', name:'Quaker Instant Oatmeal',        brand:'Quaker',           size:'12 pkts'   },
  { id:'bk4', name:'Log Cabin Syrup',               brand:'Log Cabin',        size:'24 oz'     },
  { id:'bk5', name:'Jimmy Dean Breakfast Sandwiches',brand:'Jimmy Dean',      size:'4 ct'      },
  { id:'pc1', name:'Head & Shoulders',              brand:'Head & Shoulders', size:'23.7 oz'   },
  { id:'pc2', name:'Dove Beauty Bar 4pk',           brand:'Dove',             size:'4 pk'      },
  { id:'pc3', name:'Colgate Total Toothpaste',      brand:'Colgate',          size:'4.8 oz'    },
  { id:'pc4', name:'Listerine Cool Mint',           brand:'Listerine',        size:'33.8 oz'   },
  { id:'hw1', name:'Tide Original Liquid',          brand:'Tide',             size:'92 oz'     },
  { id:'hw2', name:'Tide Pods Original 42ct',       brand:'Tide',             size:'42 ct'     },
  { id:'hw3', name:'Bounty Paper Towels 6pk',       brand:'Bounty',           size:'6 rolls'   },
  { id:'hw4', name:'Charmin Ultra Soft 12pk',       brand:'Charmin',          size:'12 rolls'  },
  { id:'hw5', name:'Lysol Disinfectant Spray',      brand:'Lysol',            size:'12.5 oz'   },
  { id:'hw6', name:'Dawn Ultra Original',           brand:'Dawn',             size:'19.4 oz'   },
  { id:'hw7', name:'Glad ForceFlex Trash Bags',     brand:'Glad',             size:'20 ct'     },
  { id:'ba1', name:'Pampers Swaddlers',             brand:'Pampers',          size:'27-32 ct'  },
  { id:'ba2', name:'Huggies Little Movers',         brand:'Huggies',          size:'25-32 ct'  },
  { id:'ba3', name:'Gerber Baby Purees',            brand:'Gerber',           size:'10 ct'     },
  { id:'pe1', name:'Purina Fancy Feast 12ct',       brand:'Purina',           size:'12x3oz'    },
  { id:'pe2', name:'Pedigree Dry Dog Food',         brand:'Pedigree',         size:'3.5 lb'    },
  { id:'pe3', name:'Milk-Bone Dog Biscuits',        brand:'Milk-Bone',        size:'24 oz'     },
  { id:'vi1', name:'Centrum Adults Multivitamin',   brand:'Centrum',          size:'130 ct'    },
  { id:'vi2', name:'Emergen-C Vitamin C 30ct',      brand:'Emergen-C',        size:'30 ct'     },
  { id:'vi3', name:'Tylenol Extra Strength',        brand:'Tylenol',          size:'100 ct'    },
  { id:'vi4', name:'Advil Ibuprofen 100ct',         brand:'Advil',            size:'100 ct'    },
  { id:'bg1', name:'Gold Medal All-Purpose Flour',  brand:'Gold Medal',       size:'5 lb'      },
  { id:'bg2', name:'Domino Granulated Sugar',       brand:'Domino',           size:'4 lb'      },
  { id:'bg3', name:'Duncan Hines Yellow Cake Mix',  brand:'Duncan Hines',     size:'15.25 oz'  },
  { id:'bg4', name:'Pillsbury Brownie Mix',         brand:'Pillsbury',        size:'18.4 oz'   },
  // Rice & Grains
  { id:'ri1', name:"Ben's Original White Rice",     brand:"Ben's Original",   size:'2 lb'      },
  { id:'ri2', name:'Minute Instant White Rice',     brand:'Minute',           size:'28 oz'     },
  { id:'ri3', name:'Goya Long Grain Rice',          brand:'Goya',             size:'5 lb'      },
  { id:'ri4', name:'Mahatma Jasmine Rice',          brand:'Mahatma',          size:'2 lb'      },
  { id:'ri5', name:'Lundberg Organic Brown Rice',   brand:'Lundberg',         size:'2 lb'      },
  { id:'ri6', name:'Near East Rice Pilaf',          brand:'Near East',        size:'6.9 oz'    },
  { id:'ri7', name:'Goya Yellow Rice Mix',          brand:'Goya',             size:'8 oz'      },
  // Milk
  { id:'ml1', name:'Horizon Organic 2% Milk',       brand:'Horizon',          size:'1/2 gal'   },
  { id:'ml2', name:'Lactaid Whole Milk',            brand:'Lactaid',          size:'1/2 gal'   },
  { id:'ml3', name:'Organic Valley Whole Milk',     brand:'Organic Valley',   size:'1/2 gal'   },
  { id:'ml4', name:'Hood Whole Milk',               brand:'Hood',             size:'1 gal'     },
  { id:'ml5', name:'Fairlife Whole Milk',           brand:'Fairlife',         size:'52 oz'     },
  // Dairy additions
  { id:'da11',name:'Daisy Sour Cream',              brand:'Daisy',            size:'16 oz'     },
  { id:'da12',name:"Breakstone's Cottage Cheese",   brand:"Breakstone's",     size:'16 oz'     },
  { id:'da13',name:'Cabot Cheddar Block',           brand:'Cabot',            size:'8 oz'      },
  // Meat additions
  { id:'me6', name:'Tyson Boneless Skinless Chicken Breasts', brand:'Tyson',  size:'3 lb'      },
  { id:'me7', name:'Perdue Chicken Breasts',        brand:'Perdue',           size:'3 lb'      },
  { id:'me8', name:'Jennie-O Ground Turkey',        brand:'Jennie-O',         size:'1 lb'      },
  { id:'me9', name:'Sabrett Hot Dogs',              brand:'Sabrett',          size:'12 oz'     },
  // Produce
  { id:'pr1', name:'Dole Classic Iceberg Salad',    brand:'Dole',             size:'12 oz'     },
  { id:'pr2', name:'Earthbound Farm Baby Spinach',  brand:'Earthbound Farm',  size:'5 oz'      },
  { id:'pr3', name:'Dole Baby Carrots',             brand:'Dole',             size:'16 oz'     },
  { id:'pr4', name:'Taylor Farms Chopped Salad Kit',brand:'Taylor Farms',     size:'11.15 oz'  },
  { id:'pr5', name:'Green Giant Broccoli Florets',  brand:'Green Giant',      size:'12 oz'     },
  { id:'pr6', name:'Del Monte Fresh Cut Green Beans',brand:'Del Monte',       size:'14.5 oz'   },
  // Frozen additions
  { id:'fr9', name:'Tyson Chicken Nuggets',         brand:'Tyson',            size:'32 oz'     },
  { id:'fr10',name:'Green Giant Steamers Broccoli', brand:'Green Giant',      size:'12 oz'     },
  { id:'fr11',name:'Birds Eye Steamfresh Mixed Vegetables', brand:'Birds Eye', size:'10.8 oz'  },
  { id:'fr12',name:"Stouffer's Lasagna",            brand:"Stouffer's",       size:'19 oz'     },
  { id:'fr13',name:"Amy's Black Bean Burrito",      brand:"Amy's",            size:'6 oz'      },
  // Canned goods additions
  { id:'ca9', name:'Goya Chickpeas',                brand:'Goya',             size:'15.5 oz'   },
  { id:'ca10',name:'Goya Kidney Beans',             brand:'Goya',             size:'15.5 oz'   },
  { id:'ca11',name:'Swanson Chicken Broth',         brand:'Swanson',          size:'32 oz'     },
  { id:'ca12',name:'Rotel Diced Tomatoes & Chilies',brand:'Rotel',            size:'10 oz'     },
  // Condiments/pantry additions
  { id:'co11',name:'Goya Olive Oil',                brand:'Goya',             size:'17 oz'     },
  { id:'co12',name:'Goya Sofrito',                  brand:'Goya',             size:'12 oz'     },
  { id:'co13',name:'Crisco Vegetable Oil',          brand:'Crisco',           size:'48 oz'     },
  { id:'co14',name:'Mazola Corn Oil',               brand:'Mazola',           size:'40 oz'     },
  // Coffee additions
  { id:'cf6', name:'Café Bustelo Espresso Ground',  brand:'Café Bustelo',     size:'10 oz'     },
  { id:'cf7', name:'Café Bustelo Instant Espresso', brand:'Café Bustelo',     size:'7.05 oz'   },
  // Snack additions
  { id:'sn13',name:'Clif Bar Chocolate Chip',       brand:'Clif Bar',         size:'2.4 oz'    },
  { id:'sn14',name:'Quaker Chewy Granola Bars',     brand:'Quaker',           size:'8 ct'      },
  { id:'sn15',name:"Welch's Fruit Snacks",          brand:"Welch's",          size:'22 ct'     },
  // Household additions
  { id:'hw8', name:'Febreze Air Freshener',         brand:'Febreze',          size:'8.8 oz'    },
  { id:'hw9', name:'Ziploc Storage Bags Gallon',    brand:'Ziploc',           size:'19 ct'     },
  { id:'hw10',name:'Reynolds Wrap Aluminum Foil',   brand:'Reynolds',         size:'75 sq ft'  },
  // Soda & Water additions
  { id:'sw9', name:'Sprite 12-Pack',                brand:'Sprite',           size:'12x12 oz'  },
  { id:'sw10',name:'7UP 12-Pack',                   brand:'7UP',              size:'12x12 oz'  },
  { id:'sw11',name:'Snapple Lemon Tea',             brand:'Snapple',          size:'6x16 oz'   },
  { id:'sw12',name:'Arizona Green Tea',             brand:'Arizona',          size:'6x16 oz'   },
  { id:'sw13',name:'Poland Spring Water Gallon',    brand:'Poland Spring',    size:'1 gal'     },
  { id:'sw14',name:'Poland Spring 24-Pack',         brand:'Poland Spring',    size:'24x16.9 oz'},
  // Bread additions
  { id:'br6', name:'Arnold Country White',          brand:'Arnold',           size:'24 oz'     },
  { id:'br7', name:'Pepperidge Farm Sandwich White',brand:'Pepperidge Farm',  size:'22 oz'     },
  // Pasta additions
  { id:'pa7', name:'Ronzoni Spaghetti',             brand:'Ronzoni',          size:'16 oz'     },
  { id:'pa8', name:'Ronzoni Penne',                 brand:'Ronzoni',          size:'16 oz'     },
  { id:'pa9', name:'De Cecco Spaghetti',            brand:'De Cecco',         size:'16 oz'     },
  // Bakery
  { id:'bk1e',name:"Entenmann's Chocolate Donuts",  brand:"Entenmann's",      size:'16 oz'     },
  { id:'bk2e',name:"Entenmann's Rich Frosted Donuts",brand:"Entenmann's",     size:'16 oz'     },
  { id:'bk3e',name:"Entenmann's Crumb Coffee Cake", brand:"Entenmann's",      size:'19 oz'     },
  { id:'bk4e',name:"Drake's Devil Dogs",            brand:"Drake's",          size:'10 ct'     },
  { id:'bk5e',name:"Drake's Ring Dings",            brand:"Drake's",          size:'12 ct'     },
  // Dairy additions
  { id:'da14',name:'Sargento String Cheese',        brand:'Sargento',         size:'12 ct'     },
  { id:'da15',name:'Hood Heavy Whipping Cream',     brand:'Hood',             size:'1 pint'    },
  { id:'da16',name:'Coffee-Mate Original Creamer',  brand:'Coffee-Mate',      size:'35.3 oz'   },
  { id:'da17',name:'Reddi Whip Original',           brand:'Reddi Whip',       size:'6.5 oz'    },
  // Frozen additions
  { id:'fr14',name:"Gorton's Fish Sticks",          brand:"Gorton's",         size:'19 oz'     },
  { id:'fr15',name:'Hot Pockets Ham & Cheese',      brand:'Hot Pockets',      size:'2 ct'      },
  { id:'fr16',name:'Bagel Bites Cheese & Pepperoni',brand:'Bagel Bites',      size:'9 ct'      },
  { id:'fr17',name:'Ling Ling Potstickers',         brand:'Ling Ling',        size:'16 oz'     },
  { id:'fr18',name:"Marie Callender's Chicken Pot Pie", brand:"Marie Callender's", size:'15 oz'},
  // Condiments / NYC pantry staples
  { id:'co15',name:'Goya Sazon with Coriander',     brand:'Goya',             size:'3.52 oz'   },
  { id:'co16',name:'Goya Adobo All Purpose',        brand:'Goya',             size:'8 oz'      },
  { id:'co17',name:'La Choy Soy Sauce',             brand:'La Choy',          size:'10 oz'     },
  { id:'co18',name:'Wish-Bone Italian Dressing',    brand:'Wish-Bone',        size:'16 oz'     },
  // Personal care additions
  { id:'pc5', name:'Pantene Pro-V Shampoo',         brand:'Pantene',          size:'27.7 oz'   },
  { id:'pc6', name:'TRESemmé Moisture Rich Shampoo',brand:'TRESemmé',         size:'28 oz'     },
  { id:'pc7', name:'Dove Body Wash',                brand:'Dove',             size:'22 oz'     },
  { id:'pc8', name:'Degree Original Deodorant',     brand:'Degree',           size:'2.7 oz'    },
  { id:'pc9', name:'Old Spice Deodorant',           brand:'Old Spice',        size:'3 oz'      },
  { id:'pc10',name:'Secret Antiperspirant',         brand:'Secret',           size:'2.6 oz'    },
  { id:'pc11',name:'Always Infinity Pads',          brand:'Always',           size:'18 ct'     },
  { id:'pc12',name:'Tampax Pearl Tampons',          brand:'Tampax',           size:'18 ct'     },
  { id:'pc13',name:'Gillette Mach3 Razors',         brand:'Gillette',         size:'4 ct'      },
  { id:'pc14',name:'Oral-B Toothbrush',             brand:'Oral-B',           size:'2 ct'      },
  // Household additions
  { id:'hw11',name:'Clorox Regular Bleach',         brand:'Clorox',           size:'43 oz'     },
  { id:'hw12',name:'Pine-Sol Original',             brand:'Pine-Sol',         size:'48 oz'     },
  { id:'hw13',name:'Cascade Complete Dishwasher Pods', brand:'Cascade',       size:'43 ct'     },
  { id:'hw14',name:'Saran Premium Wrap',            brand:'Saran',            size:'100 sq ft' },
  { id:'hw15',name:'Dixie Everyday Plates',         brand:'Dixie',            size:'44 ct'     },
  { id:'hw16',name:'Hefty Strong Trash Bags',       brand:'Hefty',            size:'30 ct'     },
  // Baby additions
  { id:'ba4', name:'Pampers Baby Wipes',            brand:'Pampers',          size:'72 ct'     },
  { id:'ba5', name:'Huggies Simply Clean Wipes',    brand:'Huggies',          size:'64 ct'     },
  { id:'ba6', name:'Similac Advance Formula',       brand:'Similac',          size:'23.2 oz'   },
  { id:'ba7', name:'Enfamil NeuroPro Formula',      brand:'Enfamil',          size:'20.7 oz'   },
];

// ── Stores to scrape ──────────────────────────────────────────────────────────
// type: 'instacart' | 'target' | 'costco' | 'bjs'
// onlyNull: true = skip products that already have a price in index.html
const SCRAPERS = [
  { id:'fb',  name:'Food Bazaar',  type:'instacart', slug:'food-bazaar'             },
  { id:'ct',  name:'C-Town',       type:'instacart', slug:'c-town-supermarkets'     },
  { id:'wb',  name:'Western Beef', type:'instacart', slug:'western-beef'            },
  { id:'asc', name:'Associated',   type:'instacart', slug:'associated-supermarkets' },
  { id:'fw',  name:'Fairway',      type:'instacart', slug:'fairway-market'          },
  { id:'tg',  name:'Target',       type:'target'                                   },
  { id:'co',  name:'Costco',       type:'costco'                                   },
  { id:'bjs', name:"BJ's",         type:'bjs'                                      },
  // Existing stores — fill in any nulls
  { id:'kf',  name:'Key Food',     type:'instacart', slug:'key-food'               },
  { id:'ss',  name:'Stop & Shop',  type:'instacart', slug:'stop-and-shop'          },
  { id:'sr',  name:'ShopRite',     type:'instacart', slug:'shoprite'               },
  { id:'wf',  name:'Whole Foods',  type:'instacart', slug:'whole-foods-market'     },
];

// ── Price extraction helpers ──────────────────────────────────────────────────

function parsePrice(raw) {
  if (!raw) return null;
  // Handle "2 for $5.00" → 2.50
  const forMatch = raw.match(/(\d+)\s+for\s+\$?([\d.]+)/i);
  if (forMatch) return parseFloat(forMatch[2]) / parseInt(forMatch[1]);
  // Strip non-numeric except dot and take first number
  const match = raw.replace(/[^\d.]/g, ' ').trim().match(/^[\d.]+/);
  if (match) return parseFloat(match[0]);
  return null;
}

// Instacart price selectors (in priority order)
const INSTACART_PRICE_SELECTORS = [
  '[data-testid="item_price"]',
  '[data-testid="item-price"]',
  '.item-price',
  '[class*="ItemPrice"]',
  '[class*="item_price"]',
  '[class*="price"]',
];

const INSTACART_TILE_SELECTORS = [
  '[data-testid="item_tile"]',
  '[data-testid="item-tile"]',
  '[class*="ItemTile"]',
  '[class*="item_tile"]',
  '[class*="item-tile"]',
  'li[class*="item"]',
];

async function scrapeInstacart(page, slug, product) {
  const query = encodeURIComponent(`${product.brand} ${product.name}`);
  const url = `https://www.instacart.com/store/${slug}/search_v3/${query}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

    // Wait for any product tile to appear
    let tileSelector = null;
    for (const sel of INSTACART_TILE_SELECTORS) {
      try {
        await page.waitForSelector(sel, { timeout: PRICE_TIMEOUT });
        tileSelector = sel;
        break;
      } catch {}
    }

    if (!tileSelector) {
      // Try reading raw page text for any dollar amount (last resort)
      const text = await page.innerText('body').catch(() => '');
      if (text.includes('sign in') || text.includes('Sign In')) return { price: null, note: 'auth required' };
      return { price: null, note: 'no tiles found' };
    }

    // Extract price from page via evaluate
    const result = await page.evaluate((priceSelectors, tileSelectors, productName, productBrand) => {
      // Find all tiles
      let tiles = [];
      for (const sel of tileSelectors) {
        tiles = Array.from(document.querySelectorAll(sel));
        if (tiles.length) break;
      }

      if (!tiles.length) return { price: null, note: 'no tiles in DOM' };

      // Score tiles by name match
      const nameLower = productName.toLowerCase();
      const brandLower = productBrand.toLowerCase();

      let bestTile = null;
      let bestScore = -1;

      for (const tile of tiles.slice(0, 8)) {
        const text = tile.innerText.toLowerCase();
        let score = 0;
        if (text.includes(nameLower)) score += 2;
        if (text.includes(brandLower)) score += 1;
        if (score > bestScore) { bestScore = score; bestTile = tile; }
      }

      if (!bestTile) bestTile = tiles[0];

      // Extract price from best tile
      for (const sel of priceSelectors) {
        const el = bestTile.querySelector(sel);
        if (el && el.innerText.trim()) return { price: el.innerText.trim(), note: 'matched' };
      }

      // Fallback: look for $ in tile text
      const priceMatch = bestTile.innerText.match(/\$[\d.]+/);
      if (priceMatch) return { price: priceMatch[0], note: 'regex fallback' };

      return { price: null, note: 'no price in tile' };
    }, INSTACART_PRICE_SELECTORS, INSTACART_TILE_SELECTORS, product.name, product.brand);

    return result;
  } catch (e) {
    return { price: null, note: `error: ${e.message.slice(0, 60)}` };
  }
}

async function scrapeTarget(page, product) {
  const query = encodeURIComponent(`${product.brand} ${product.name}`);
  const url = `https://www.target.com/s?searchTerm=${query}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForSelector('[data-test="product-price"], [class*="Price"], [class*="price"]', { timeout: PRICE_TIMEOUT });

    const result = await page.evaluate((productName, productBrand) => {
      const cards = Array.from(document.querySelectorAll('[data-test="product-card"], [class*="ProductCardWrapper"], li[class*="product"]'));
      if (!cards.length) return { price: null, note: 'no cards' };

      const nameLower = productName.toLowerCase();
      const brandLower = productBrand.toLowerCase();
      let bestCard = null, bestScore = -1;
      for (const card of cards.slice(0, 6)) {
        const text = card.innerText.toLowerCase();
        let score = (text.includes(nameLower) ? 2 : 0) + (text.includes(brandLower) ? 1 : 0);
        if (score > bestScore) { bestScore = score; bestCard = card; }
      }
      if (!bestCard) bestCard = cards[0];

      const priceEl = bestCard.querySelector('[data-test="product-price"], [class*="Price"]');
      if (priceEl) return { price: priceEl.innerText.trim(), note: 'matched' };
      const match = bestCard.innerText.match(/\$[\d.]+/);
      return match ? { price: match[0], note: 'regex' } : { price: null, note: 'no price' };
    }, product.name, product.brand);

    return result;
  } catch (e) {
    return { price: null, note: `error: ${e.message.slice(0, 60)}` };
  }
}

async function scrapeCostco(page, product) {
  const query = encodeURIComponent(`${product.brand} ${product.name}`);
  const url = `https://www.costco.com/CatalogSearch?keyword=${query}&pageSize=12`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForSelector('.product-tile-set, .product-list, [class*="product"]', { timeout: PRICE_TIMEOUT });

    const result = await page.evaluate((productName, productBrand) => {
      const tiles = Array.from(document.querySelectorAll('.product-tile, [class*="product-tile"], [class*="ProductTile"]'));
      if (!tiles.length) return { price: null, note: 'no tiles' };

      const nameLower = productName.toLowerCase();
      const brandLower = productBrand.toLowerCase();
      let best = tiles[0], bestScore = -1;
      for (const t of tiles.slice(0, 6)) {
        const text = t.innerText.toLowerCase();
        let s = (text.includes(nameLower) ? 2 : 0) + (text.includes(brandLower) ? 1 : 0);
        if (s > bestScore) { bestScore = s; best = t; }
      }

      const priceEl = best.querySelector('.price, [class*="Price"], [automation-id*="price"]');
      if (priceEl) return { price: priceEl.innerText.trim(), note: 'matched' };
      const match = best.innerText.match(/\$[\d.]+/);
      return match ? { price: match[0], note: 'regex' } : { price: null, note: 'no price' };
    }, product.name, product.brand);

    return result;
  } catch (e) {
    return { price: null, note: `error: ${e.message.slice(0, 60)}` };
  }
}

async function scrapeBJs(page, product) {
  const query = encodeURIComponent(`${product.brand} ${product.name}`);
  const url = `https://www.bjs.com/search?q=${query}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForSelector('[class*="product"], [class*="item"]', { timeout: PRICE_TIMEOUT });

    const result = await page.evaluate((productName, productBrand) => {
      const tiles = Array.from(document.querySelectorAll('[class*="product-tile"], [class*="ProductTile"], [class*="item-tile"]'));
      if (!tiles.length) return { price: null, note: 'no tiles' };

      const nameLower = productName.toLowerCase();
      const brandLower = productBrand.toLowerCase();
      let best = tiles[0], bestScore = -1;
      for (const t of tiles.slice(0, 6)) {
        const text = t.innerText.toLowerCase();
        let s = (text.includes(nameLower) ? 2 : 0) + (text.includes(brandLower) ? 1 : 0);
        if (s > bestScore) { bestScore = s; best = t; }
      }

      const priceEl = best.querySelector('[class*="price"], [class*="Price"]');
      if (priceEl) return { price: priceEl.innerText.trim(), note: 'matched' };
      const match = best.innerText.match(/\$[\d.]+/);
      return match ? { price: match[0], note: 'regex' } : { price: null, note: 'no price' };
    }, product.name, product.brand);

    return result;
  } catch (e) {
    return { price: null, note: `error: ${e.message.slice(0, 60)}` };
  }
}

// ── Progress helpers ──────────────────────────────────────────────────────────

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch {}
  }
  return {};
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── index.html updater ────────────────────────────────────────────────────────

function updateIndexHtml(allPrices) {
  let html = fs.readFileSync(INDEX_FILE, 'utf8');
  let updated = 0;

  for (const [storeId, products] of Object.entries(allPrices)) {
    for (const [productId, price] of Object.entries(products)) {
      if (price === null) continue;
      // Match: <storeId>:null inside this product's price object
      // Pattern: id:'PROD_ID',...p:{...storeId:null...}
      // We target the specific product line and replace only null for this store
      const productLineRe = new RegExp(
        `(id:'${productId}'[^\\n]*${storeId}:)null`,
        'g'
      );
      const before = html;
      html = html.replace(productLineRe, `$1${price.toFixed(2)}`);
      if (html !== before) updated++;
    }
  }

  fs.writeFileSync(INDEX_FILE, html);
  console.log(`\n✅ Updated ${updated} prices in ${INDEX_FILE}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const forceStore = process.argv.includes('--store')
    ? process.argv[process.argv.indexOf('--store') + 1]
    : null;

  const progress = loadProgress();
  // allPrices[storeId][productId] = number | null
  const allPrices = progress.prices || {};

  console.log('🛒 NYC Best Store Finder — Price Scraper');
  console.log('  Running headless (no browser window). Use your computer normally.\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1280,800',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  // Mask automation flags
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  const scrapers = forceStore
    ? SCRAPERS.filter(s => s.id === forceStore)
    : SCRAPERS;

  for (const scraper of scrapers) {
    console.log(`\n── ${scraper.name} (${scraper.id}) ──────────────────`);
    if (!allPrices[scraper.id]) allPrices[scraper.id] = {};

    let found = 0, skipped = 0, missed = 0;

    for (const product of PRODUCTS) {
      // Skip if already have a price for this product+store
      if (allPrices[scraper.id][product.id] !== undefined) {
        skipped++;
        continue;
      }

      let result;
      switch (scraper.type) {
        case 'instacart': result = await scrapeInstacart(page, scraper.slug, product); break;
        case 'target':    result = await scrapeTarget(page, product);   break;
        case 'costco':    result = await scrapeCostco(page, product);   break;
        case 'bjs':       result = await scrapeBJs(page, product);      break;
        default:          result = { price: null, note: 'unknown type' };
      }

      const price = parsePrice(result.price);
      allPrices[scraper.id][product.id] = price;

      if (price !== null) {
        console.log(`  ✓ ${product.name.padEnd(35)} $${price.toFixed(2)}`);
        found++;
      } else {
        console.log(`  ~ ${product.name.padEnd(35)} (${result.note})`);
        missed++;
      }

      // Save progress after every product
      progress.prices = allPrices;
      saveProgress(progress);

      await page.waitForTimeout(DELAY_MS);
    }

    console.log(`  → ${found} found, ${missed} not found, ${skipped} already done`);
  }

  await browser.close();

  // Write all found prices into index.html
  updateIndexHtml(allPrices);

  console.log('\nDone! Commit and push index.html to publish the new prices.');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
