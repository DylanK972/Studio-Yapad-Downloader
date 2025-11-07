// server.js (ESM-ready)
// Usage: set RAPIDAPI_KEY, ZYLA_API_KEY (optional), PORT...
import express from "express";
import cors from "cors";
import { pipeline } from "stream";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const streamPipeline = promisify(pipeline);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const ZYLA_API_KEY = process.env.ZYLA_API_KEY || "";
const PORT = process.env.PORT || 10000;

function isValidUrl(s){
  try { new URL(s); return true; } catch(e){ return false; }
}

async function tryInstagramScrape(url){
  // Try to fetch the Instagram page and parse sharedData JSON that sometimes exists in the HTML
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36" }});
    if (!res.ok) return null;
    const text = await res.text();

    // Instagram sometimes embeds JSON in window._sharedData or in <script type="application/ld+json">
    // Try to extract JSON from window._sharedData first
    let medias = [];

    // attempt: JSON inside window._sharedData = {...};
    const sharedMatch = text.match(/window\._sharedData\s*=\s*(\{.*?\});/s);
    if (sharedMatch) {
      try {
        const obj = JSON.parse(sharedMatch[1]);
        // navigate to media (varies with IG versions)
        const entry = obj?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media
                   || obj?.entry_data?.PostPage?.[0]?.graphql?.media
                   || obj;
        if (entry) {
          if (entry.display_resources) {
            medias = entry.display_resources.map(d => d.src).filter(Boolean);
          } else if (entry.edge_sidecar_to_children?.edges) {
            medias = entry.edge_sidecar_to_children.edges.map(e => e.node.display_url || e.node.video_url).filter(Boolean);
          } else if (entry.video_url) {
            medias = [entry.video_url];
          } else if (entry.display_url) {
            medias = [entry.display_url];
          }
        }
      } catch(e){}
    }

    // fallback: JSON-LD
    if (!medias.length) {
      const ldMatch = text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (ldMatch) {
        try {
          const ld = JSON.parse(ldMatch[1]);
          if (ld && ld.image) {
            if (Array.isArray(ld.image)) medias = ld.image;
            else medias = [ld.image];
          }
        } catch(e){}
      }
    }

    // fallback: search for common 'og:' meta tags
    if (!medias.length) {
      const ogMatch = text.match(/<meta property="og:video" content="([^"]+)"/)
                   || text.match(/<meta property="og:image" content="([^"]+)"/);
      if (ogMatch) medias = [ogMatch[1]];
    }

    // final filter unique and absolute
    medias = Array.from(new Set(medias || [])).filter(Boolean);
    return medias.length ? medias : null;
  } catch(e){
    return null;
  }
}

async function tryRapidApiProviders(targetUrl){
  // Use some RapidAPI endpoints (you must set RAPIDAPI_KEY)
  if (!RAPIDAPI_KEY) return null;

  const rapidEndpoints = [
    // tiktok example (kept for reference) - not for IG
    // Instagram endpoints on RapidAPI vary; below are examples you can enable if present in your RapidAPI subscription
    { host: "instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com", url: `https://instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com/?url=${encodeURIComponent(targetUrl)}` },
    { host: "instagram-api-media-downloader.p.rapidapi.com", url: `https://instagram-api-media-downloader.p.rapidapi.com/photo?url=${encodeURIComponent(targetUrl)}` },
    { host: "mediacrawlers-mediacrawlers-default.p.rapidapi.com", url: `https://mediacrawlers-mediacrawlers-default.p.rapidapi.com/instagram?url=${encodeURIComponent(targetUrl)}` },
    // add/remove endpoints you have access to...
  ];

  for (const ep of rapidEndpoints){
    try {
      const res = await fetch(ep.url, {
        headers: {
          "x-rapidapi-host": ep.host,
          "x-rapidapi-key": RAPIDAPI_KEY,
          "Accept": "application/json"
        },
        method: "GET",
      });
      if (!res.ok) continue;
      const json = await res.json();
      // Try to extract media URLs from common shapes
      let medias = [];
      // Many providers return arrays under media, result, data
      if (Array.isArray(json?.media)) medias = json.media.map(m => m.url || m.thumbnail || m.src).filter(Boolean);
      if (!medias.length && Array.isArray(json?.medias)) medias = json.medias.map(m => m.url || m.src).filter(Boolean);
      if (!medias.length && json?.data?.url) medias = [json.data.url];
      if (!medias.length && json?.data?.media) {
        if (Array.isArray(json.data.media)) medias = json.data.media.map(m => m.url || m.src).filter(Boolean);
      }
      if (!medias.length && json?.url) medias = [json.url];
      medias = Array.from(new Set(medias)).filter(Boolean);
      if (medias.length) return medias;
    } catch(e){ continue; }
  }
  return null;
}

async function tryZyla(targetUrl){
  // Zylalabs / Zyla API example (they have "Download All Content" endpoint)
  if (!ZYLA_API_KEY) return null;
  try {
    const apiUrl = `https://zylalabs.com/api/7706/instagram+content+downloader+api/12503/download+all+content?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(apiUrl, { headers: { "Authorization": `Bearer ${ZYLA_API_KEY}`, "Accept": "application/json" }});
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.media && Array.isArray(json.media)) {
      return json.media.map(m => m.url || m.thumbnail).filter(Boolean);
    }
    return null;
  } catch(e){ return null; }
}

async function tryThirdPartyScrapers(targetUrl){
  // Some public scrapers (snapinsta/fastdl etc) have endpoints but often require keys / are blocked.
  // We'll attempt basic calls to known public endpoints that return JSON.
  const probes = [
    `https://snapinsta.app/api?url=${encodeURIComponent(targetUrl)}`,
    `https://dbs.instagramdownloader.workers.dev/?url=${encodeURIComponent(targetUrl)}`,
    `https://saveitoffline.com/wp-json/sa/v1/ig?url=${encodeURIComponent(targetUrl)}`,
    // add more if you find working public endpoints
  ];
  for (const p of probes){
    try {
      const r = await fetch(p, { headers: { "User-Agent": "Mozilla/5.0" }});
      if (!r.ok) continue;
      const j = await r.json().catch(()=>null);
      if (!j) continue;
      // best-effort: flatten
      const found = [];
      const flatten = o => {
        if (!o) return;
        if (typeof o === "string" && o.startsWith("http")) found.push(o);
        if (Array.isArray(o)) o.forEach(flatten);
        if (typeof o === "object") Object.values(o).forEach(flatten);
      };
      flatten(j);
      const uniq = Array.from(new Set(found));
      if (uniq.length) return uniq;
    } catch(e){ continue; }
  }
  return null;
}

app.get("/api/instagram", async (req, res) => {
  const target = req.query.url;
  if (!target || !isValidUrl(target)) return res.status(400).json({ ok:false, error: "url param missing or invalid" });

  try {
    // 1) native HTML scrape (fastest, no key)
    const fromInstagram = await tryInstagramScrape(target);
    if (fromInstagram && fromInstagram.length) {
      return res.json({ ok:true, source: "instagram_html", count: fromInstagram.length, medias: fromInstagram });
    }

    // 2) RapidAPI providers (if key present)
    const fromRapid = await tryRapidApiProviders(target);
    if (fromRapid && fromRapid.length) {
      return res.json({ ok:true, source: "rapidapi", count: fromRapid.length, medias: fromRapid });
    }

    // 3) Zyla (if key)
    const fromZyla = await tryZyla(target);
    if (fromZyla && fromZyla.length) {
      return res.json({ ok:true, source: "zyla", count: fromZyla.length, medias: fromZyla });
    }

    // 4) Third-party scrapers (best-effort)
    const third = await tryThirdPartyScrapers(target);
    if (third && third.length) return res.json({ ok:true, source:"thirdparty", count: third.length, medias: third });

    // 5) Not found
    return res.json({ ok:false, error: "Aucun média détecté (toutes les sources ont échoué)." });
  } catch (err) {
    console.error("api/instagram error:", err);
    return res.json({ ok:false, error: "Erreur interne", details: String(err) });
  }
});

// Proxy route to download/stream remote resource (used by front-end "download" buttons)
// WARNING: this simply proxies the remote file. Some providers block hotlink/proxying.
app.get("/proxy", async (req, res) => {
  const target = req.query.url;
  const suggestedName = req.query.name || "file";
  if (!target || !isValidUrl(target)) return res.status(400).send("missing url");
  try {
    const remote = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" }});
    if (!remote.ok) return res.status(502).send("Bad upstream");
    // set headers
    res.setHeader("content-type", remote.headers.get("content-type") || "application/octet-stream");
    res.setHeader("content-length", remote.headers.get("content-length") || "");
    // content-disposition for download
    res.setHeader("content-disposition", `attachment; filename="${encodeURIComponent(suggestedName)}"`);
    // stream
    await streamPipeline(remote.body, res);
  } catch (e) {
    console.error("proxy error", e);
    res.status(500).send("Proxy error");
  }
});

// Serve static front-end (if you host index.html / style / script in same repo)
app.use(express.static(path.join(__dirname, "public"))); // move your index.html to public/ OR adjust

app.listen(PORT, () => {
  console.log(`Studio Yapad backend listening on ${PORT}`);
});
