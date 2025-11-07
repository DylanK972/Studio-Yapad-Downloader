// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (index.html, style.css, script.js)
// place index.html, style.css, script.js at project root or in a /public folder.
// Here we serve the repository root and a "public" fallback.
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, "public")));

// Utility: unique push
const pushUnique = (arr, v) => {
  if (!v) return;
  if (!arr.includes(v)) arr.push(v);
};

// === /api/instagram ===
// Try several heuristics to extract media URLs from Instagram page HTML
app.get("/api/instagram", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    // fetch page with a common UA to avoid lightweight bot blocks
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!r.ok) {
      return res.status(500).json({ error: `Instagram fetch failed: ${r.status}` });
    }
    const text = await r.text();

    const medias = [];

    // 1) og:video / og:image meta tags
    {
      const ogVideoRegex = /<meta[^>]*property=["']og:video["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
      const ogImageRegex = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
      let m;
      while ((m = ogVideoRegex.exec(text)) !== null) pushUnique(medias, m[1]);
      while ((m = ogImageRegex.exec(text)) !== null) pushUnique(medias, m[1]);
    }

    // 2) look for JSON embedded (window._sharedData or application/ld+json)
    // a) application/ld+json
    {
      const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let m;
      while ((m = ldRegex.exec(text)) !== null) {
        try {
          const j = JSON.parse(m[1]);
          // images
          if (j && j.image) {
            if (typeof j.image === "string") pushUnique(medias, j.image);
            if (Array.isArray(j.image)) j.image.forEach((u) => pushUnique(medias, u));
          }
          // potential video url
          if (j && j.video && j.video.contentUrl) pushUnique(medias, j.video.contentUrl);
          if (j && j.contentUrl) pushUnique(medias, j.contentUrl);
        } catch (e) {
          // ignore parse errors
        }
      }
    }

    // b) window._sharedData or legacy JSON
    {
      const sharedRegex = /window\._sharedData\s*=\s*({[\s\S]*?});/;
      const match = text.match(sharedRegex);
      if (match && match[1]) {
        try {
          const data = JSON.parse(match[1]);
          // navigate common shapes to find display_url / video_url / resources
          const ig = JSON.stringify(data);
          // match urls inside JSON quickly
          const urlRegex = /"(https?:\/\/[^"]+\.(?:mp4|jpg|jpeg|png|webp)[^"]*)"/gi;
          let mm;
          while ((mm = urlRegex.exec(ig)) !== null) {
            pushUnique(medias, mm[1]);
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // 3) common "display_url", "video_url", "thumbnail_src" patterns
    {
      const patterns = [
        /"display_url"\s*:\s*"([^"]+)"/gi,
        /"video_url"\s*:\s*"([^"]+)"/gi,
        /"thumbnail_src"\s*:\s*"([^"]+)"/gi,
        /"display_src"\s*:\s*"([^"]+)"/gi,
        /"url"\s*:\s*"([^"]+\.mp4[^"]*)"/gi,
      ];
      for (const p of patterns) {
        let mm;
        while ((mm = p.exec(text)) !== null) pushUnique(medias, mm[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/"));
      }
    }

    // 4) fallback: any direct .mp4/.jpg/.webp in HTML
    {
      const anyRegex = /(https?:\/\/[^"' ]+\.(?:mp4|jpg|jpeg|png|webp)[^"' ]*)/gi;
      let mm;
      while ((mm = anyRegex.exec(text)) !== null) pushUnique(medias, mm[1]);
    }

    // Normalize (some urls come escaped)
    const normalized = medias
      .map((u) => (u ? u.replace(/\\u0026/g, "&").replace(/\\\//g, "/") : u))
      .filter(Boolean);

    if (normalized.length === 0) {
      return res.json({ ok: false, count: 0, medias: [], message: "Aucun média trouvé dans la page." });
    }

    return res.json({ ok: true, count: normalized.length, medias: normalized });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// === /proxy ===
// Streams the remote URL through our domain, sets Content-Disposition for download
app.get("/proxy", async (req, res) => {
  const { url, name } = req.query;
  if (!url) return res.status(400).send("Missing URL");

  try {
    const remote = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "*/*",
      },
    });

    if (!remote.ok) {
      return res.status(502).send(`Remote fetch failed: ${remote.status}`);
    }

    // content-type and extension detection
    const ct = remote.headers.get("content-type") || "application/octet-stream";
    let ext = "bin";
    if (ct.includes("mp4")) ext = "mp4";
    else if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
    else if (ct.includes("png")) ext = "png";
    else if (ct.includes("webp")) ext = "webp";

    const filename = (name ? name.replace(/[^a-zA-Z0-9_\-\.]/g, "_") : "media") + "." + ext;

    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // stream
    const body = remote.body;
    if (body && typeof body.pipe === "function") {
      body.pipe(res);
    } else {
      // Node's WHATWG stream
      const reader = body.getReader();
      const stream = new ReadableStream({
        async pull(controller) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        },
      });
      const nodeStream = stream.pipeTo; // fallback - but most env provide .pipe
      // fallback simple: buffer everything (rare)
      const buf = Buffer.from(await remote.arrayBuffer());
      res.end(buf);
    }
  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
});

// health
app.get("/_health", (req, res) => res.send("ok"));

// start
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend Studio Yapad actif sur port ${PORT}`));
