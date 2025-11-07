import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import LRU from "lru-cache";
import { JSDOM } from "jsdom";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

// simple cache to avoid reloading same post many times
const cache = new LRU({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5 minutes
});

// Keep a browser instance
let browser;
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
  }
  return browser;
}

function extractOGandRegex(html) {
  const dom = new JSDOM(html);
  const metas = dom.window.document.querySelectorAll("meta[property]");
  const out = new Set();

  metas.forEach(m => {
    const p = m.getAttribute("property");
    const c = m.getAttribute("content");
    if (!c) return;
    if (p === "og:video" || p === "og:image") out.add(c);
  });

  // regex extraction from embedded JSON
  const vidRe = /"video_url"\s*:\s*"([^"]+\.mp4[^"]*)"/g;
  const imgRe = /"display_url"\s*:\s*"([^"]+\.(?:jpg|jpeg|png)[^"]*)"/g;
  const cdnRe = /(https:\/\/[^"'\s]+cdninstagram[^"'\s]+)/g;
  let m;
  while ((m = vidRe.exec(html)) !== null) out.add(m[1].replace(/\\u0026/g, "&"));
  while ((m = imgRe.exec(html)) !== null) out.add(m[1].replace(/\\u0026/g, "&"));
  while ((m = cdnRe.exec(html)) !== null) out.add(m[1].replace(/\\u0026/g, "&"));

  return Array.from(out);
}

async function fetchWithPlaywright(url) {
  const cached = cache.get(url);
  if (cached) return cached;

  const b = await getBrowser();
  const context = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  });
  const page = await context.newPage();
  // set timeout reasonable
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // wait for network settle a bit
    await page.waitForTimeout(800);
    const html = await page.content();
    await page.close();
    await context.close();
    cache.set(url, html);
    return html;
  } catch (e) {
    try { await page.close(); } catch {}
    try { await context.close(); } catch {}
    throw e;
  }
}

app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ ok: false, error: "Aucune URL fournie" });

  try {
    // normalize
    const clean = url.split("?")[0];
    // try direct page with Playwright (best)
    const html = await fetchWithPlaywright(clean);
    const medias = extractOGandRegex(html);

    if (!medias || !medias.length) {
      return res.json({ ok: false, error: "Aucun média trouvé (privé/supprimé ou structure différente)." });
    }

    // prioritize videos
    medias.sort((a, b) => ((a.includes(".mp4") || a.includes("video")) ? -1 : 1));
    return res.json({ ok: true, medias });
  } catch (e) {
    console.error("Fetch error:", e);
    return res.status(500).json({ ok: false, error: "Erreur serveur: " + (e.message || e.toString()) });
  }
});

// simple home
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
