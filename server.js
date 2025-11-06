import express from "express";
import cors from "cors";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 10000;

// Fix pour __dirname avec ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// 🔹 Sert les fichiers du frontend (index.html, style.css, script.js)
app.use(express.static(__dirname));

// Route principale -> envoie index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ Exemple route TikTok API-free via sssTik (juste pour tester)
app.get("/api/tiktok", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL TikTok manquante" });

  try {
    const apiURL = `https://ssstik.io/abc?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiURL);
    const html = await response.text();
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: "Erreur TikTok fetch", details: err.message });
  }
});

// ✅ Exemple route Instagram API-free via Snapinsta
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL Instagram manquante" });

  try {
    const response = await fetch("https://snapinsta.app/action.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `url=${encodeURIComponent(url)}`,
    });
    const html = await response.text();
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: "Erreur Instagram fetch", details: err.message });
  }
});

// Lancement serveur
app.listen(PORT, () => {
  console.log(`✅ Backend Studio Yapad actif sur port ${PORT}`);
});
