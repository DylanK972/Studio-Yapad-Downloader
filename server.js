import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    redirect: "follow"
  });
  return await r.text();
}

/** Proxys gratuits pour contourner CF/anti-bot */
async function throughJina(url) {
  // r.jina.ai/http/<host+path>
  const prox = "https://r.jina.ai/http/" + url.replace(/^https?:\/\//, "");
  return await fetchText(prox);
}
async function throughAllOrigins(url) {
  const prox = "https://api.allorigins.win/get?url=" + encodeURIComponent(url);
  const r = await fetch(prox, { headers: { "User-Agent": UA } });
  const j = await r.json();
  return j.contents || "";
}

/** Essaye plusieurs variantes d’URL IG (la v1 JSON interne peut encore marcher via proxy) */
function igVariants(original) {
  const clean = original.split("?")[0].replace(/\/$/, "");
  return [
    original,
    clean,
    clean + "/?__a=1&__d=dis",
    clean + "/?hl=en",
    clean + "/?hl=fr"
  ];
}

/** Extraction OG (balises meta) */
function extractOG(html) {
  const dom = new JSDOM(html);
  const metas = dom.window.document.querySelectorAll("meta[property]");
  const out = [];
  metas.forEach((m) => {
    const p = m.getAttribute("property");
    const c = m.getAttribute("content");
    if (!c) return;
    if (p === "og:video" || p === "og:image") out.push(c);
  });
  return out;
}

/** Extraction par RegEx dans le JSON embarqué d’Instagram */
function extractByRegex(html) {
  const out = new Set();

  // video_url":"https://...mp4
  const vidRe = /"video_url"\s*:\s*"([^"]+\.mp4[^"]*)"/g;
  let m;
  while ((m = vidRe.exec(html)) !== null) out.add(m[1].replace(/\\u0026/g, "&"));

  // display_url":"https://...jpg|png
  const imgRe = /"display_url"\s*:\s*"([^"]+\.(?:jpg|jpeg|png)[^"]*)"/g;
  while ((m = imgRe.exec(html)) !== null) out.add(m[1].replace(/\\u0026/g, "&"));

  // fallback: any scontent.cdninstagram.com URL
  const cdnRe = /(https:\/\/[^"'\s]+cdninstagram[^"'\s]+)/g;
  while ((m = cdnRe.exec(html)) !== null) out.add(m[1].replace(/\\u0026/g, "&"));

  return Array.from(out);
}

/** Merge & nettoie */
function normalize(list) {
  const seen = new Set();
  return list
    .filter(Boolean)
    .map((u) => u.replace(/&amp;/g, "&"))
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
}

/** Récupération résiliente de médias Instagram */
async function fetchInstagramMedias(igUrl) {
  const variants = igVariants(igUrl);

  // 1) r.jina.ai
  for (const v of variants) {
    try {
      const html = await throughJina(v);
      const og = extractOG(html);
      const rx = extractByRegex(html);
      const merged = normalize([...og, ...rx]);
      if (merged.length) return merged;
    } catch {}
  }

  // 2) AllOrigins
  for (const v of variants) {
    try {
      const html = await throughAllOrigins(v);
      const og = extractOG(html);
      const rx = extractByRegex(html);
      const merged = normalize([...og, ...rx]);
      if (merged.length) return merged;
    } catch {}
  }

  return [];
}

/** API principale */
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie." });

  try {
    const medias = await fetchInstagramMedias(url);
    if (!medias.length) {
      return res.json({
        ok: false,
        error:
          "Aucun média trouvé. (Post privé, supprimé, ou Instagram a modifié sa structure.)"
      });
    }
    // tri: vidéos d’abord
    const ordered = medias.sort((a, b) => {
      const av = a.endsWith(".mp4") || a.includes(".mp4");
      const bv = b.endsWith(".mp4") || b.includes(".mp4");
      return av === bv ? 0 : av ? -1 : 1;
    });
    return res.json({ ok: true, medias: ordered });
  } catch (e) {
    return res.json({ ok: false, error: "Erreur serveur: " + e.message });
  }
});

/** Static */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Studio Yapad Downloader prêt sur ${PORT}`));
