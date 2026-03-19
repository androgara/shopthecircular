# NYC Best Store Finder — Setup Instructions

## What this does
Runs a one-time script that fetches real product images for all ~150 products
from UPCitemdb (free, no account needed), then bakes them into a standalone
HTML file that works in any browser with no internet dependency.

---

## Step 1 — Check you have Node.js

Open your Terminal (Mac) or Command Prompt (Windows) and run:

```
node -v
```

You should see something like `v20.11.0`. If you get "command not found",
download Node.js from https://nodejs.org (choose the LTS version) and install it.

---

## Step 2 — Run the script

In your terminal, navigate to this folder and run:

```
cd path/to/store-finder
node fetch-images.js
```

**Example on Mac:**
```
cd ~/Downloads/store-finder
node fetch-images.js
```

**Example on Windows:**
```
cd C:\Users\YourName\Downloads\store-finder
node fetch-images.js
```

---

## What happens next

The script will print progress as it fetches each product:

```
🛒 NYC Best Store Finder — Image Fetcher
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fetching images for 150 products...
This will take ~4 minutes (throttled to respect free API limits)

[  1/150] ✓ Cheerios
[  2/150] ✓ Honey Nut Cheerios
[  3/150] ✓ Frosted Flakes
...
✓ Done! Found images for 142/150 products

Building nyc_best_store_finder.html...
✓ nyc_best_store_finder.html is ready!
```

⏱ **Time:** About 4–5 minutes for the full run (the script waits 11 seconds
between each API call to stay within the free rate limit).

💾 **Resuming:** If the script is interrupted, just run it again — it saves
progress after each product and picks up where it left off.

---

## Step 3 — Open the app

Once done, open `nyc_best_store_finder.html` in any browser.
Images are baked in — no internet needed, works for any number of users.

---

## Updating prices

Prices are hardcoded in `fetch-images.js` in the `getHTMLTemplate()` function.
Edit the `p:{}` object for any product to update its store prices, then re-run
the script. Images will load from cache (instantly, no API calls needed again).

---

## Troubleshooting

**"node: command not found"** → Install Node.js from https://nodejs.org

**Script stops partway through** → Just run `node fetch-images.js` again.
Progress is saved in `.image-progress.json` and the script resumes automatically.

**Some products show emoji instead of image** → That product isn't in the
UPCitemdb database. The emoji fallback is intentional and looks fine.

**Rate limit error** → Wait a few minutes and run the script again.
