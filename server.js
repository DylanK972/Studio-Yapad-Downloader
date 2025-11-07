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

/** 🔄 Proxy SaveIG (pas de Cloudflare) */
async function proxyToSaveIG(instaUrl) {
  const endpoint = "https://saveig.app/api/ajaxSearch";

  const body = new URLSearchParams();
  body.append("q", instaUrl);
  body.append("t", "media");
  body.append("lang", "fr");

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://saveig.app",
    "Referer": "https://saveig.app/fr",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  };

  try {
    const r = await fetch(endpoint, { method: "POST", headers, body });
    const contentType = r.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const j = await r.json();
      // leur JSON contient souvent des liens dans j.data ou j.links
      const html = j.data || j.html;
      if (html) {
        const dom = new JSDOM(html);
        const links = Array.from(dom.window.document.querySelectorAll("a"))
          .map((a) => a.href)
          .filter((x) => x.includes("cdninstagram"));
        return links;
      }
    }

    return [];
  } catch (e) {
    console.error("SaveIG error:", e.message);
    return [];
  }
}

/** 🧩 Fallback scraping direct si tout échoue */
async function fallbackScrape(url) {
  try {
    const proxy = `https://r.jina.ai/http://${url.replace("https://", "")}`;
    const res = await fetch(proxy, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    const html = await res.text();
    const dom = new JSDOM(html);
    const metas = dom.window.document.querySelectorAll("meta[property]");
    const medias = [];
    metas.forEach((m) => {
      const p = m.getAttribute("property");
      const c = m.getAttribute("content");
      if (p === "og:image" || p === "og:video") medias.push(c);
    });
    return medias;
  } catch {
    return [];
  }
}

/** 🪄 Route principale */
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie" });

  try {
    const result = await proxyToSaveIG(url);
    if (result.length) return res.json({ ok: true, medias: result });

    const fallback = await fallbackScrape(url);
    if (fallback.length) return res.json({ ok: true, medias: fallback });

    return res.json({ ok: false, error: "Aucun média trouvé." });
  } catch (e) {
    return res.json({ ok: false, error: "Erreur serveur : " + e.message });
  }
});

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Downloader opérationnel sur port ${PORT}`)
);
