// server.js — Studio Yapad Downloader v8.5
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

// === Serve frontend files ===
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, "public")));

// === Utils ===
const pushUnique = (arr, val) => {
  if (val && !arr.includes(val)) arr.push(val);
};

// === /api/instagram ===
app.get("/api/instagram", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ ok: false, error: "Missing URL" });

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!r.ok) {
      return res.status(500).json({ ok: false, error: "Fetch failed: " + r.status });
    }

    const html = await r.text();
    const medias = [];

    // 1️⃣ og:video / og:image
    const ogMeta = [...html.matchAll(/<meta[^>]+property="og:(video|image)"[^>]+content="([^"]+)"/gi)];
    ogMeta.forEach((m) => pushUnique(medias, m[2]));

    // 2️⃣ JSON dans <script type="application/ld+json">
    const ldBlocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    ldBlocks.forEach((b) => {
      try {
        const j = JSON.parse(b[1]);
        if (j.image) {
          if (typeof j.image === "string") pushUnique(medias, j.image);
          else if (Array.isArray(j.image)) j.image.forEach((i) => pushUnique(medias, i));
        }
        if (j.video && j.video.contentUrl) pushUnique(medias, j.video.contentUrl);
      } catch (e) {}
    });

    // 3️⃣ Chercher les "display_url" / "video_url" / "thumbnail_src"
    const urlRegex =
      /"display_url"\s*:\s*"([^"]+)"|"video_url"\s*:\s*"([^"]+)"|"thumbnail_src"\s*:\s*"([^"]+)"/gi;
    let match;
    while ((match = urlRegex.exec(html))) {
      const link = match[1] || match[2] || match[3];
      if (link) pushUnique(medias, link.replace(/\\u0026/g, "&").replace(/\\\//g, "/"));
    }

    // 4️⃣ Fallback : tous les .mp4 / .jpg / .webp du HTML
    const fallbackRegex = /(https?:\/\/[^"' ]+\.(?:mp4|jpg|jpeg|png|webp)[^"' ]*)/gi;
    let f;
    while ((f = fallbackRegex.exec(html))) pushUnique(medias, f[1]);

    // Nettoyage final
    const clean = medias
      .map((u) => u.replace(/\\u0026/g, "&").replace(/\\\//g, "/"))
      .filter((u) => !u.includes("rsrc.php") && u.startsWith("http"));

    if (clean.length === 0) {
      return res.json({ ok: false, count: 0, medias: [], message: "Aucun média détecté." });
    }

    return res.json({ ok: true, count: clean.length, medias: clean });
  } catch (err) {
    console.error("Erreur Instagram:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// === /proxy ===
app.get("/proxy", async (req, res) => {
  const { url, name } = req.query;
  if (!url) return res.status(400).send("Missing URL");
  if (url.includes("rsrc.php") || !url.startsWith("http")) {
    return res.status(400).send("Lien invalide ou non téléchargeable.");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "*/*",
        Referer: "https://www.instagram.com/",
      },
    });

    if (!response.ok) {
      return res.status(502).send("Erreur de récupération du média (" + response.status + ")");
    }

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

// === Start server ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Studio Yapad Downloader en ligne sur le port ${PORT}`));
