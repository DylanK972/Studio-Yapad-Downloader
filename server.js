// server.js (ESM)
// Deployable with package.json { "type":"module" }
import express from "express";
import cors from "cors";
import { URL } from "url";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

// util to fetch with a browser UA (helps Instagram)
async function fetchWithUA(url, opts = {}) {
  const headers = Object.assign(
    { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    opts.headers || {}
  );
  return fetch(url, Object.assign({}, opts, { headers }));
}

// safe URL validation: only http(s)
function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (e) {
    return false;
  }
}

// try Instagram oembed
async function tryOembed(url) {
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
    const r = await fetchWithUA(oembedUrl, { method: "GET" });
    if (!r.ok) return null;
    const j = await r.json();
    const medias = [];
    if (j.thumbnail_url) medias.push(j.thumbnail_url);
    if (j.thumbnail_url_with_play_button) medias.push(j.thumbnail_url_with_play_button);
    if (j.html) {
      // sometimes html contains data-src
      const m = j.html.match(/src="([^"]+)"/);
      if (m) medias.push(m[1]);
    }
    return medias.length ? [...new Set(medias)] : null;
  } catch (e) {
    return null;
  }
}

// parse og meta tags and JSON-LD and window._sharedData
async function tryParseHtmlForMedia(url) {
  try {
    const res = await fetchWithUA(url);
    if (!res.ok) return null;
    const html = await res.text();

    const found = new Set();

    // 1) og:video or og:video:secure_url
    const ogVideo = html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i);
    const ogVideo2 = html.match(/<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)["']/i);
    if (ogVideo) found.add(ogVideo[1]);
    if (ogVideo2) found.add(ogVideo2[1]);

    // 2) og:image
    const ogImageRegex = /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/ig;
    let m;
    while ((m = ogImageRegex.exec(html))) found.add(m[1]);

    // 3) JSON-LD structured data
    const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig;
    while ((m = ldRegex.exec(html))) {
      try {
        const obj = JSON.parse(m[1]);
        // object can be array or single
        const arr = Array.isArray(obj) ? obj : [obj];
        for (const item of arr) {
          if (item && item.video) {
            if (typeof item.video === "string") found.add(item.video);
            else if (item.video.contentUrl) found.add(item.video.contentUrl);
            else if (item.video.url) found.add(item.video.url);
          }
          if (item && item.image) {
            if (typeof item.image === "string") found.add(item.image);
            else if (Array.isArray(item.image)) item.image.forEach(i => i && found.add(i));
            else if (item.image.url) found.add(item.image.url);
          }
        }
      } catch (e) { /* ignore JSON parse errors */ }
    }

    // 4) try parse window._sharedData = {...}
    const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({[\s\S]*?});<\/script>/);
    if (sharedDataMatch) {
      try {
        const shared = JSON.parse(sharedDataMatch[1]);
        // navigate common paths to find display resources
        const media = shared?.entry_data;
        // try common nested heuristics:
        const nodes = [];
        function pushIf(v) {
          if (!v) return;
          if (Array.isArray(v)) v.forEach(pushIf);
          else nodes.push(v);
        }
        pushIf(shared?.entry_data);
        // deep search for 'display_url' or 'display_resources' or 'video_url'
        const jsonStr = JSON.stringify(shared);
        const displayUrlRegex = /"display_url"\s*:\s*"([^"]+)"/g;
        let mm;
        while ((mm = displayUrlRegex.exec(jsonStr))) found.add(mm[1].replace(/\\u0026/g, "&"));
        const videoUrlRegex = /"video_url"\s*:\s*"([^"]+)"/g;
        while ((mm = videoUrlRegex.exec(jsonStr))) found.add(mm[1].replace(/\\u0026/g, "&"));
      } catch (e) {
        // ignore
      }
    }

    // 5) fallback: find all img or source tags with urls
    const srcRegex = /(?:<source[^>]+src=|<img[^>]+src=)["']([^"']+)["']/ig;
    while ((m = srcRegex.exec(html))) {
      const u = m[1];
      if (u && (u.startsWith("http") || u.startsWith("//"))) {
        const final = u.startsWith("//") ? "https:" + u : u;
        found.add(final);
      }
    }

    const arr = [...found].filter(Boolean).map(s => s.replace(/\\u0026/g, "&"));
    return arr.length ? arr : null;
  } catch (e) {
    return null;
  }
}

// Extra fallback: try "textise dot iitty" style proxies (not guaranteed).
// For now we won't call third-party paid endpoints automatically (you provided many).
// Instead allow use of environment configured external API below.
async function tryExternalApiFallback(url) {
  // If you add an env var like INSTADOWN_API=https://example.com/?url=...
  // it will be used as a fallback.
  const fallback = process.env.INSTADOWN_API;
  if (!fallback) return null;
  try {
    const apiUrl = fallback.replace(/\{url\}/g, encodeURIComponent(url));
    const r = await fetchWithUA(apiUrl, { method: "GET" });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    if (j && (j.media || j.medias || j.url || j.data)) {
      // normalize
      const list = [];
      if (j.media && Array.isArray(j.media)) list.push(...j.media);
      if (j.medias && Array.isArray(j.medias)) list.push(...j.medias);
      if (j.url) list.push(j.url);
      if (j.data && Array.isArray(j.data)) list.push(...j.data.map(d => d.url || d.video || d.image).filter(Boolean));
      return list.length ? [...new Set(list)] : null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Main aggregated handler
app.get("/api/instagram", async (req, res) => {
  const url = req.query.url;
  if (!url || !isHttpUrl(url)) {
    return res.status(400).json({ ok: false, error: "URL invalide" });
  }

  try {
    // try methods in order
    const results = [];

    // 1) oEmbed
    const o = await tryOembed(url);
    if (o && o.length) results.push(...o);

    // 2) HTML parsing (og tags, ld+json, _sharedData)
    if (results.length < 1) {
      const p = await tryParseHtmlForMedia(url);
      if (p && p.length) results.push(...p);
    }

    // 3) external API fallback (if configured through ENV)
    if (results.length < 1) {
      const ext = await tryExternalApiFallback(url);
      if (ext && ext.length) results.push(...ext);
    }

    // return unique, filter out suspicious short urls, data: etc
    const unique = [...new Set(results)].filter(s => typeof s === "string" && isHttpUrl(s));
    if (unique.length === 0) {
      return res.json({ ok: false, error: "Aucun média détecté (toutes les méthodes ont échoué)." });
    }
    return res.json({ ok: true, count: unique.length, medias: unique });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// Proxy endpoint for download / streaming
// /proxy?url=ENCODED_URL&name=filename.jpg
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  const name = req.query.name || "file";
  if (!url || !isHttpUrl(url)) return res.status(400).send("Invalid url");
  try {
    const remote = await fetchWithUA(url, { method: "GET" });
    if (!remote.ok) {
      return res.status(502).send("Upstream error: " + remote.statusText);
    }

    // set content-type and content-disposition if we can
    const ct = remote.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", ct);
    // try to set filename based on query param
    const safeName = encodeURIComponent(name);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    // stream body to client
    const body = remote.body;
    if (!body) return res.status(500).send("No body");
    // node fetch Response.body is a readable stream; pipe it
    body.pipe(res);
  } catch (e) {
    return res.status(500).send("Erreur proxy: " + String(e));
  }
});

// small static health
app.get("/", (req, res) => {
  res.send("Backend Studio Yapad actif (API: /api/instagram ?url=...)");
});

import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sert tes fichiers du front à la racine
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`✅ Backend Studio Yapad actif sur port ${PORT}`);
});

