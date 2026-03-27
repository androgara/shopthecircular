#!/usr/bin/env node
/**
 * server.js — ShopTheCircular local dev server
 *
 * Usage:
 *   node server.js
 *   open http://localhost:3000
 */

const express  = require('express');
const { spawn } = require('child_process');
const fs       = require('fs');
const path     = require('path');

const app  = express();
const PORT = 3000;

// In-memory cache: zip → { data, timestamp }
const cache = new Map();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Track in-progress scrapes so we don't double-spawn
const scraping = new Set();

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(__dirname));

// ── GET /api/circulars?zip=XXXXX ───────────────────────────────────────────
// Returns circular data if cached/on-disk, or 202 telling client to scrape.
app.get('/api/circulars', (req, res) => {
  const zip = (req.query.zip || '').trim();
  if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Invalid zip code' });

  // 1. In-memory cache
  const cached = cache.get(zip);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  // 2. On-disk file
  const file = path.join(__dirname, 'data', 'circulars.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.zip === zip) {
      cache.set(zip, { data, ts: Date.now() });
      return res.json(data);
    }
  } catch {}

  // 3. Need to scrape
  res.status(202).json({ status: 'needs_scrape', zip });
});

// ── GET /api/scrape?zip=XXXXX ──────────────────────────────────────────────
// Server-Sent Events stream. Runs fetch-circulars.js and streams its output.
// Sends:
//   event: log    data: { message }   — progress lines
//   event: done   data: { zip }       — scrape complete, fetch /api/circulars now
//   event: error  data: { message }   — something failed
app.get('/api/scrape', (req, res) => {
  const zip = (req.query.zip || '').trim();
  if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Invalid zip code' });

  // SSE setup
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  // Don't double-scrape
  if (scraping.has(zip)) {
    send('log', { message: `Scrape for ${zip} already in progress — please wait...` });
    // Poll until done
    const poll = setInterval(() => {
      if (!scraping.has(zip)) {
        clearInterval(poll);
        send('done', { zip });
        res.end();
      }
    }, 2000);
    req.on('close', () => clearInterval(poll));
    return;
  }

  scraping.add(zip);
  send('log', { message: `🔍 Searching for grocery deals near ${zip}...` });

  const child = spawn('node', ['fetch-circulars.js', zip], {
    cwd: __dirname,
    env: { ...process.env },
  });

  child.stdout.on('data', chunk => {
    chunk.toString().split('\n').filter(l => l.trim()).forEach(line => {
      send('log', { message: line });
    });
  });

  child.stderr.on('data', chunk => {
    chunk.toString().split('\n').filter(l => l.trim()).forEach(line => {
      send('log', { message: line });
    });
  });

  child.on('close', code => {
    scraping.delete(zip);
    if (code === 0) {
      // Bust the cache so /api/circulars re-reads the file
      cache.delete(zip);
      send('done', { zip });
    } else {
      send('error', { message: `Scrape exited with code ${code}. Check the server console.` });
    }
    res.end();
  });

  req.on('close', () => {
    scraping.delete(zip);
    try { child.kill(); } catch {}
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛒  ShopTheCircular`);
  console.log(`    http://localhost:${PORT}\n`);
});
