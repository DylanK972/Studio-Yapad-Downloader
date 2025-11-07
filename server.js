/**
 * server.js
 * Studio Yapad Downloader - backend
 *
 * - Serve static front (index.html, style.css, script.js)
 * - /api/instagram?url=...
 * - /api/tiktok?url=...
 *
 * Usage:
 *  - Set env vars (optional):
 *      RAPIDAPI_KEY, ZYLA_API_KEY
 *  - node server.js
 *
 * Notes:
 *  - This code uses global fetch (Node >=18). If you run older node, install node-fetch.
 *  - Some fallback endpoints may change in the wild; keep the 'PROVIDERS' list updated.
 */

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 10000;

// quick rate limiter to avoid abuse
const limiter = rateLimit({
  windowMs: 30 * 1000, // 30s
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from /public or root (adjust if your files at root)
const STATIC_DIR = path.join(__dirname);
app.use(express.static(STATIC_DIR, { extensions: ["html", "htm"] }));

// ---------- Helpers ----------
const TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function proxyFetchText(url, opts = {}) {
  // simple wrapper returning text body
  const res = await fetchWithTimeout(url, opts);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function decodeEscapedUrl(u) {
  if (!u) return u;
  // some pages escape & as \u0026 or by encoding
  let s = u.replace(/\\u0026/g, "&");
  try {
    s = decodeURIComponent(s);
  } catch (e) {
    // ignore
  }
  // strip quotes
  return s.replace(/^"+|"+$/g, "");
}

// ---------- Providers (fallback attempts) ----------
// These are query builders. Some endpoints are public, some require keys.
// Add more providers as you find them.
const PROVIDERS = [
  // SnapInsta simple public endpoints (can break anytime)
  (targetUrl) =>
    `https://snapinsta.app/api.php?url=${encodeURIComponent(targetUrl)}`,

  (targetUrl) =>
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, // generic CORS proxy

  // SSSInstagram site scrapers (may rate-limit)
  (targetUrl) =>
    `https://sssinstagram.com/#!/${encodeURIComponent(targetUrl)}`,

  // fastdl proxy (some offer direct /api endpoints) - example only
  (targetUrl) =>
    `https://fastdl.app/api/fetch?url=${encodeURIComponent(targetUrl)}`,

  // ZylaLabs (needs API key, add via env ZYLA_API_KEY)
  (targetUrl) =>
    process.env.ZYLA_API_KEY
      ? `https://zylalabs.com/api/7706/instagram+content+downloader+api/12503/download+all+content?url=${encodeURIComponent(
          targetUrl
        )}&key=${process.env.ZYLA_API_KEY}`
      : null,

  // RapidAPI TikTok example (only for tiktok endpoint), the key would be in RAPIDAPI_KEY
  // We won't call it here for instagram, but included for reference in /api/tiktok.
];

// Helper to try provider list and return first non-empty HTML/text
async function tryProviders(targetUrl) {
  for (const builder of PROVIDERS) {
    try {
      const url = builder(targetUrl);
      if (!url) continue;
      // Some providers return JSON, some return HTML: we just fetch text
      const txt = await proxyFetchText(url, {
        headers: {
          // some providers expect a referer or user-agent
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        },
      });
      if (txt && txt.length > 50) {
        return { source: url, body: txt };
      }
    } catch (err) {
      // console.debug("provider failed", err.message);
      continue;
    }
  }
  return null;
}

// ---------- Parsers ----------

function parseInstagramFromHTML(html) {
  if (!html) return null;

  // 1) Try window._sharedData pattern (old Instagram)
  let m = html.match(/window\._sharedData\s*=\s*({.+?});\s*<\/script>/s);
  if (!m) {
    // sometimes different closing
    m = html.match(/window\._sharedData\s*=\s*({.+?});\s*/s);
  }
  if (m && m[1]) {
    try {
      const data = JSON.parse(m[1]);
      // navigate to media
      // check for entry_data -> PostPage
      const post =
        data.entry_data?.PostPage?.[0] ||
        data.entry_data?.ProfilePage?.[0] ||
        data.graphql?.shortcode_media ||
        null;
      const media = post?.graphql?.shortcode_media || post || null;
      if (media) {
        // If sidecar (multiple)
        if (media.edge_sidecar_to_children?.edges) {
          const medias = media.edge_sidecar_to_children.edges.map((e) => {
            const n = e.node;
            return n.is_video ? n.video_url : n.display_url;
          });
          return { type: "multiple", items: medias };
        }
        // single
        if (media.is_video && media.video_url) return { type: "video", url: media.video_url };
        if (media.display_url) return { type: "image", url: media.display_url };
      }
    } catch (e) {
      // parse fail -> keep going
    }
  }

  // 2) Try JSON embedded in <script type="application/ld+json">
  const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ld && ld[1]) {
    try {
      const data = JSON.parse(ld[1]);
      if (data && data.image) {
        // might be array or string
        if (Array.isArray(data.image)) return { type: "image", url: data.image[0] };
        return { type: "image", url: data.image };
      }
    } catch (e) {}
  }

  // 3) Try finding "display_url" or "video_url" direct patterns
  let dd = html.match(/"display_url":"([^"]+)"/);
  if (dd && dd[1]) return { type: "image", url: decodeEscapedUrl(dd[1]) };

  let vd = html.match(/"video_url":"([^"]+)"/);
  if (vd && vd[1]) return { type: "video", url: decodeEscapedUrl(vd[1]) };

  // 4) Try edge_sidecar items (older patterns)
  const sidecarMatch = html.match(/"edge_sidecar_to_children":\s*{\s*"edges":\s*(\[[\s\S]*?\])\s*}/);
  if (sidecarMatch && sidecarMatch[1]) {
    try {
      const arr = JSON.parse(sidecarMatch[1]);
      const items = arr.map((it) =>
        it.node.is_video ? decodeEscapedUrl(it.node.video_url) : decodeEscapedUrl(it.node.display_url)
      );
      return { type: "multiple", items };
    } catch (e) {}
  }

  // 5) Generic fallback: first jpg/png/mp4 url in HTML
  const generic = html.match(/https?:\/\/[^"'<> ]+\.(?:mp4|jpg|jpeg|png)(?:\?[^"'<> ]*)?/i);
  if (generic) return { type: "generic", url: generic[0] };

  return null;
}

function parseTikTokFromHTML(html) {
  if (!html) return null;

  // 1) Try playAddr or downloadAddr in JSON
  const play = html.match(/"playAddr":"([^"]+)"/);
  if (play && play[1]) return { type: "video", url: decodeEscapedUrl(play[1]) };

  // 2) Try "downloadAddr"
  const dl = html.match(/"downloadAddr":"([^"]+)"/);
  if (dl && dl[1]) return { type: "video", url: decodeEscapedUrl(dl[1]) };

  // 3) try application/ld+json
  const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ld && ld[1]) {
    try {
      const data = JSON.parse(ld[1]);
      if (data && data.video && data.video.contentUrl) return { type: "video", url: data.video.contentUrl };
    } catch (e) {}
  }

  // 4) generic mp4 match
  const generic = html.match(/https?:\/\/[^"'<> ]+\.mp4(?:\?[^"'<> ]*)?/i);
  if (generic) return { type: "video", url: generic[0] };

  return null;
}

// ---------- API routes ----------

app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url param required" });

  try {
    // 1) Try providers / proxies
    let result = null;
    try {
      const provRes = await tryProviders(url);
      if (provRes && provRes.body) {
        const parsed = parseInstagramFromHTML(provRes.body);
        if (parsed) {
          return res.json({ ok: true, source: provRes.source, parsed });
        }
      }
    } catch (e) {
      // ignore and go fallback
    }

    // 2) Fallback: fetch the Instagram page directly
    // Some hosts block requests without browser headers
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    let pageText;
    try {
      pageText = await proxyFetchText(url, { headers });
    } catch (err) {
      // If direct fetch fails, return provider error
      return res.status(502).json({ error: "Failed to fetch page", details: err.message });
    }

    const parsed = parseInstagramFromHTML(pageText);
    if (!parsed) {
      return res.status(400).json({ error: "Aucun média trouvé ou format inattendu." });
    }
    return res.json({ ok: true, source: "direct", parsed });
  } catch (err) {
    console.error("API Instagram error:", err);
    res.status(500).json({ error: "Internal error", details: err.message });
  }
});

app.get("/api/tiktok", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url param required" });

  try {
    // Try providers / direct fetch
    // 1) Direct fetch page
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    let pageText;
    try {
      pageText = await proxyFetchText(url, { headers });
    } catch (err) {
      // fallback to providers (if any)
      try {
        const provRes = await tryProviders(url);
        if (provRes && provRes.body) pageText = provRes.body;
      } catch (e) {}
    }

    if (!pageText) return res.status(502).json({ error: "Failed to fetch TikTok page" });

    const parsed = parseTikTokFromHTML(pageText);
    if (!parsed) return res.status(400).json({ error: "Aucun média détecté sur cette URL." });

    // If url is playAddr with watermark token etc. we attempt to clean/resolve
    return res.json({ ok: true, source: "direct", parsed });
  } catch (err) {
    console.error("API TikTok error:", err);
    res.status(500).json({ error: "Internal error", details: err.message });
  }
});

// test route
app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// fallback to index for SPA
app.get("/", (req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

// 404 fallback to index (let frontend route)
app.use((req, res) => {
  res.status(404).sendFile(path.join(STATIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Backend Studio Yapad actif sur port ${PORT}`);
  console.log(`✅ Open: http://localhost:${PORT} (or your host)`);
});
