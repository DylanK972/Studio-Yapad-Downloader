import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// Corrige __dirname pour modules ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ Proxy vers le script du gars (hébergé sur Render ou ton dossier)
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    // Appelle le script intégré localement (index.js du gars)
    const apiUrl = `http://localhost:3000/igdl?url=${encodeURIComponent(url)}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.url) {
      return res.status(404).json({ error: "Aucun média trouvé" });
    }

    res.json({ download: data.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur interne API Milan" });
  }
});

// ✅ Exemple proxy TikTok (ssstik.io pour plus tard)
app.get("/api/tiktok", (req, res) => {
  res.json({ message: "TikTok en préparation 😎" });
});

app.listen(PORT, () => {
  console.log(`✅ Studio Yapad Downloader en ligne sur port ${PORT}`);
});
