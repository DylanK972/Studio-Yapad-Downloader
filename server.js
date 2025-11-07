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

async function getInstagramMedia(url) {
  const proxy = `https://r.jina.ai/http://${url.replace("https://", "")}`; // contournement Render
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  };

  const res = await fetch(proxy, { headers });
  const html = await res.text();

  const dom = new JSDOM(html);
  const metaTags = dom.window.document.querySelectorAll("meta[property]");
  const medias = [];

  metaTags.forEach((m) => {
    const prop = m.getAttribute("property");
    const content = m.getAttribute("content");
    if (!content) return;

    if (prop === "og:image") medias.push(content);
    if (prop === "og:video") medias.push(content);
  });

  return medias;
}

app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie" });

  try {
    const medias = await getInstagramMedia(url);
    if (!medias.length)
      return res.json({ ok: false, error: "Aucun média trouvé." });

    res.json({ ok: true, medias });
  } catch (err) {
    res.json({ ok: false, error: "Erreur serveur : " + err.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Downloader opérationnel sur port ${PORT}`)
);
