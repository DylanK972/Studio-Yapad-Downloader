// server.js — Studio Yapad Downloader v9.0 Fallback Edition
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
app.use(express.static(path.join(__dirname)));

// Utils
const pushUnique = (arr, val) => {
  if (val && !arr.includes(val)) arr.push(val);
};

async function tryFetch(url, headers = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return await r.text();
}

// === /api/instagram ===
app.get("/api/instagram", async (req, res) => {
  const postUrl = req.query.url;
  if (!postUrl) return res.status(400).json({ ok: false, error: "Missing URL" });

  const medias = [];
  let html = "";

  try {
    // 1️⃣ Try direct fetch
    html = await tryFetch(postUrl, {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });

    const urlRegex = /(https?:\/\/[^"' ]+\.(?:mp4|jpg|jpeg|png|webp)[^"' ]*)/gi;
    let match;
    while ((match = urlRegex.exec(html))) {
      const link = match[1];
      if (link && !link.includes("rsrc.php")) pushUnique(medias, link);
    }

    if (medias.length > 0)
      return res.json({ ok: true, source: "direct", count: medias.length, medias });
  } catch (e) {
    console.log("Direct parse failed → fallback…");
  }

  try {
    // 2️⃣ Try ddinstagram API
    const ddUrl = `https://www.ddinstagram.com/api?url=${encodeURIComponent(postUrl)}`;
    const json = await fetch(ddUrl).then((r) => r.json());
    if (json?.media && json.media.length > 0) {
      json.media.forEach((m) => pushUnique(medias, m.url));
      if (medias.length > 0)
        return res.json({ ok: true, source: "ddinstagram", count: medias.length, medias });
    }
  } catch (e) {
    console.log("DDInstagram failed");
  }

  try {
    // 3️⃣ Try Snapinsta (scraping minimal)
    html = await tryFetch("https://snapinsta.app/action.php", {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });
    const urls = [...html.matchAll(/https?:\/\/[^"']+\.(?:jpg|mp4|jpeg)/gi)].map((m) => m[0]);
    urls.forEach((u) => pushUnique(medias, u));
    if (medias.length > 0)
      return res.json({ ok: true, source: "snapinsta", count: medias.length, medias });
  } catch (e) {
    console.log("Snapinsta failed");
  }

  try {
    // 4️⃣ Try saveig.app
    const saveigUrl = `https://saveig.app/api/ajaxSearch?url=${encodeURIComponent(postUrl)}`;
    const html2 = await tryFetch(saveigUrl);
    const urls = [...html2.matchAll(/https?:\/\/[^"']+\.(?:jpg|mp4|jpeg)/gi)].map((m) => m[0]);
    urls.forEach((u) => pushUnique(medias, u));
    if (medias.length > 0)
      return res.json({ ok: true, source: "saveig", count: medias.length, medias });
  } catch (e) {
    console.log("SaveIG failed");
  }

  return res.json({
    ok: false,
    count: 0,
    medias: [],
    message: "Aucun média détecté (toutes les sources ont échoué).",
  });
});

// === /proxy ===
app.get("/proxy", async (req, res) => {
  const { url, name } = req.query;
  if (!url) return res.status(400).send("Missing URL");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "*/*",
        Referer: "https://www.instagram.com/",
      },
    });
    if (!response.ok)
      return res.status(502).send("Erreur de récupération du média (" + response.status + ")");

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const ext =
      contentType.includes("mp4") ? "mp4" :
      contentType.includes("jpeg") ? "jpg" :
      contentType.includes("png") ? "png" :
      contentType.includes("webp") ? "webp" :
      "bin";
    const filename = (name || "media") + "." + ext;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(buffer);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Erreur proxy : " + err.message);
  }
});

// === Health ===
app.get("/_health", (req, res) => res.send("ok"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Studio Yapad Downloader v9.0 en ligne sur le port ${PORT}`)
);
