import express from "express";
import cors from "cors";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 10000;

// Fix pour __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Serve l’interface principale
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// =============== 🔹 FONCTION UTILITAIRE DE PROXY 🔹 ===============
async function proxyFetch(targetUrl) {
  const proxy = "https://api.allorigins.win/get?url=";
  const proxied = proxy + encodeURIComponent(targetUrl);

  const res = await fetch(proxied);
  const data = await res.json();

  return data.contents; // le HTML réel renvoyé par le site
}


// =============== 🔹 ROUTE INSTAGRAM 🔹 ===============
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    // Snapinsta est notre cible (analyse du HTML par la suite si besoin)
    const target = `https://snapinsta.app/action.php`;
    const responseHtml = await proxyFetch(`${target}?url=${encodeURIComponent(url)}`);

    if (!responseHtml || responseHtml.length < 200)
      return res.status(400).json({ error: "Aucun média trouvé ou réponse vide." });

    res.send(responseHtml);
  } catch (err) {
    console.error("Erreur Instagram:", err);
    res.status(500).json({ error: "Erreur interne (Instagram)", details: err.message });
  }
});


// =============== 🔹 ROUTE TIKTOK 🔹 ===============
app.get("/api/tiktok", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    const target = `https://ssstik.io/abc?url=${encodeURIComponent(url)}`;
    const responseHtml = await proxyFetch(target);

    if (!responseHtml || responseHtml.length < 200)
      return res.status(400).json({ error: "Aucun média trouvé ou réponse vide." });

    res.send(responseHtml);
  } catch (err) {
    console.error("Erreur TikTok:", err);
    res.status(500).json({ error: "Erreur interne (TikTok)", details: err.message });
  }
});


// =============== 🔹 LANCEMENT SERVEUR 🔹 ===============
app.listen(PORT, () => {
  console.log(`✅ Studio Yapad Downloader prêt sur le port ${PORT}`);
});
