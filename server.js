import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { URLSearchParams } from "url";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

/**
 * Fallback scraping via jina.ai proxy (quand provider tiers échoue)
 */
async function fallbackScrape(url) {
  try {
    const proxy = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
    const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };
    const r = await fetch(proxy, { headers });
    const html = await r.text();
    const dom = new JSDOM(html);
    const meta = dom.window.document.querySelectorAll("meta[property]");
    const medias = [];
    meta.forEach((m) => {
      const p = m.getAttribute("property");
      const c = m.getAttribute("content");
      if (!c) return;
      if (p === "og:video" || p === "og:image") medias.push(c);
    });
    return medias;
  } catch (e) {
    return [];
  }
}

/**
 * Proxy vers SnapInsta (exemple basé sur ton log: POST https://snapinsta.to/api/ajaxSearch)
 * On essaie d'envoyer un form-url-encoded avec le champ url.
 * Si l'endpoint renvoie JSON avec media, on stream; sinon fallback.
 */
async function proxyToSnapInsta(targetUrl) {
  const endpoint = "https://snapinsta.to/api/ajaxSearch";

  // Construis le body x-www-form-urlencoded. Si SnapInsta demande d'autres champs, il faudra les ajouter.
  const params = new URLSearchParams();
  params.append("url", targetUrl);
  // parfois ils attendent aussi lang / type — on met des valeurs probables
  params.append("lang", "fr");
  params.append("action", "process"); // hypothèse : aucun impact si ignoré
  // si la requête réelle contient d'autres champs, il faudra les ajouter

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://snapinsta.to",
    "Referer": "https://snapinsta.to/fr/instagram-photo-downloader",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "*/*",
  };

  try {
    const r = await fetch(endpoint, { method: "POST", headers, body: params.toString() });
    const ctype = (r.headers.get("content-type") || "").toLowerCase();

    // Si JSON
    if (ctype.includes("application/json")) {
      const j = await r.json();
      // adapter selon le format de SnapInsta : on essaie plusieurs clés
      const mediaUrl = j?.data?.url || j?.media || j?.result || j?.url || j?.download || j?.src;
      if (mediaUrl) {
        // On retourne une liste uniforme
        return Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl];
      }
      // parfois ils renvoient { success: true, html: "<a href='...'>..."}
      if (j?.html) {
        // parse html pour trouver src
        const dom = new JSDOM(j.html);
        const video = dom.window.document.querySelector("video");
        if (video?.src) return [video.src];
        const img = dom.window.document.querySelector("img");
        if (img?.src) return [img.src];
      }
      // sinon, try to parse JSON keys
      const maybe = Object.values(j).flat?.() || [];
      for (const v of maybe) {
        if (typeof v === "string" && (v.includes("cdninstagram") || v.endsWith(".mp4") || v.endsWith(".jpg") || v.endsWith(".jpeg") || v.endsWith(".png"))) {
          return [v];
        }
      }
      return [];
    }

    // Si HTML renvoyé (parfois endpoint renvoie HTML)
    if (ctype.includes("text/html")) {
      const text = await r.text();
      const dom = new JSDOM(text);
      const metas = dom.window.document.querySelectorAll("meta[property]");
      const medias = [];
      metas.forEach((m) => {
        const p = m.getAttribute("property");
        const c = m.getAttribute("content");
        if (!c) return;
        if (p === "og:video" || p === "og:image") medias.push(c);
      });
      return medias;
    }

    // Si le endpoint renvoie directement un stream/file
    if (ctype.startsWith("video/") || ctype.startsWith("image/")) {
      // On transmetra directement au client (handler plus bas)
      return { streamResponse: r };
    }

    // autre cas : on peut retourner vide => fallback
    return [];
  } catch (e) {
    console.error("proxyToSnapInsta error:", e.message);
    return [];
  }
}

/**
 * Route publique utilisée par le front:
 * /api/proxy-download?provider=snapinsta&url=...
 *
 * - Essaie provider (snapinsta)
 * - Si on obtient une liste d'URLs media -> renvoie JSON { ok:true, medias: [...] }
 * - Si endpoint renvoie un stream file (video/image) -> pipe direct vers le client
 * - Sinon -> fallbackScrape (jina.ai)
 */
app.get("/api/proxy-download", async (req, res) => {
  const provider = req.query.provider;
  const targetUrl = req.query.url;
  if (!provider || !targetUrl) return res.status(400).json({ ok: false, error: "provider et url requis" });

  try {
    if (provider === "snapinsta") {
      const result = await proxyToSnapInsta(targetUrl);

      // si proxyToSnapInsta a retourné un Response (stream)
      if (result && result.streamResponse && result.streamResponse.body) {
        const streamResp = result.streamResponse;
        res.setHeader("Content-Type", streamResp.headers.get("content-type") || "application/octet-stream");
        // copie headers additionnels si besoin
        if (streamResp.headers.get("content-length")) res.setHeader("Content-Length", streamResp.headers.get("content-length"));
        streamResp.body.pipe(res);
        return;
      }

      if (Array.isArray(result) && result.length > 0) {
        return res.json({ ok: true, medias: result });
      }

      // fallback
      const fallback = await fallbackScrape(targetUrl);
      if (fallback && fallback.length) return res.json({ ok: true, medias: fallback });

      return res.json({ ok: false, error: "Aucun média trouvé via SnapInsta ni fallback." });
    }

    // Si provider non supporté -> on peut ajouter d'autres mappings plus tard
    return res.status(400).json({ ok: false, error: "Provider non supporté" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Erreur serveur : " + e.message });
  }
});

// root
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Downloader opérationnel sur port ${PORT}`));
