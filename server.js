/**
 * Studio Yapad Downloader v10.0 - Ultimate Free Version
 * Full-resilient Instagram & TikTok media extractor
 * Dylan K972 / Nov 2025
 */

import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// === Rate limiting to avoid bans ===
app.use(rateLimit({ windowMs: 30 * 1000, max: 25 }));
app.use(express.json());
app.use(express.static(__dirname));

// === Helpers ===
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms));

async function safeFetch(url, opt = {}) {
  try {
    const r = await Promise.race([fetch(url, { ...opt, headers: HEADERS }), timeout(15000)]);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    console.log("❌ fetch fail:", url, e.message);
    return null;
  }
}

function decode(u) {
  return u?.replace(/\\u0026/g, "&").replace(/\\/g, "");
}

// === Parsers ===
function parseInsta(html) {
  if (!html) return [];

  // Modern JSON: window.__additionalDataLoaded
  let m = html.match(/window\.__additionalDataLoaded\([^,]+,({.+})\);/s);
  if (m) {
    try {
      const data = JSON.parse(m[1]);
      const media = data?.graphql?.shortcode_media;
      if (media) {
        if (media.edge_sidecar_to_children?.edges)
          return media.edge_sidecar_to_children.edges.map((e) =>
            e.node.is_video ? e.node.video_url : e.node.display_url
          );
        if (media.is_video && media.video_url) return [media.video_url];
        if (media.display_url) return [media.display_url];
      }
    } catch {}
  }

  // Legacy _sharedData
  m = html.match(/window\._sharedData\s*=\s*({.+});<\/script>/s);
  if (m) {
    try {
      const data = JSON.parse(m[1]);
      const post = data.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
      if (post) {
        if (post.edge_sidecar_to_children?.edges)
          return post.edge_sidecar_to_children.edges.map((e) =>
            e.node.is_video ? e.node.video_url : e.node.display_url
          );
        if (post.is_video && post.video_url) return [post.video_url];
        if (post.display_url) return [post.display_url];
      }
    } catch {}
  }

  // Meta tags fallback
  const og = html.match(/property="og:video" content="([^"]+)"/) || html.match(/property="og:image" content="([^"]+)"/);
  if (og) return [decode(og[1])];

  // Final fallback: any .mp4/.jpg/.png in page
  const generic = [...html.matchAll(/https?:\/\/[^"'<> ]+\.(?:mp4|jpg|jpeg|png)/gi)].map((m) => decode(m[0]));
  return generic.slice(0, 5);
}

function parseTikTok(html) {
  if (!html) return [];
  const play = html.match(/"playAddr":"([^"]+)"/);
  if (play) return [decode(play[1])];
  const dl = html.match(/"downloadAddr":"([^"]+)"/);
  if (dl) return [decode(dl[1])];
  const meta = html.match(/"contentUrl":"([^"]+)"/);
  if (meta) return [decode(meta[1])];
  const generic = html.match(/https?:\/\/[^"'<> ]+\.mp4/);
  if (generic) return [decode(generic[0])];
  return [];
}

// === Instagram Extractor ===
async function extractInstagram(url) {
  const providers = [
    url, // direct
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://snapinsta.app/api.php?url=${encodeURIComponent(url)}`,
    `https://www.sssinstagram.com/#${encodeURIComponent(url)}`,
  ];

  for (const p of providers) {
    const html = await safeFetch(p);
    const out = parseInsta(html);
    if (out && out.length) return out;
  }
  return [];
}

// === TikTok Extractor ===
async function extractTikTok(url) {
  const html = await safeFetch(url);
  return parseTikTok(html);
}

// === Routes ===
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const result = await extractInstagram(url);
  if (!result.length)
    return res.status(404).json({ error: "⚠️ Aucun média détecté (toutes les sources ont échoué)." });

  res.json({ ok: true, count: result.length, medias: result });
});

app.get("/api/tiktok", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const result = await extractTikTok(url);
  if (!result.length)
    return res.status(404).json({ error: "⚠️ Aucun média détecté (toutes les sources ont échoué)." });

  res.json({ ok: true, medias: result });
});

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`✅ Studio Yapad Downloader v10 running on port ${PORT}`));
