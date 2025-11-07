// Studio Yapad Downloader — version finale Render-compatible
async function download(platform) {
  const input = document.getElementById(platform);
  const url = input.value.trim();
  const result = document.getElementById(`${platform}-result`);
  result.innerHTML = "";

  if (!url) {
    result.innerHTML = `<p style="color:#d33;">⚠️ Merci d’entrer un lien valide.</p>`;
    return;
  }

  try {
    // 🌍 Appel à ton backend Render
    const backendURL = `/api/${platform}?url=${encodeURIComponent(url)}`;
    const res = await fetch(backendURL);
    const data = await res.json();

    if (!data.ok) {
      result.innerHTML = `<p style="color:#d33;">${data.error || "Erreur inconnue."}</p>`;
      return;
    }

    // ✅ Affiche les médias trouvés
    data.medias.forEach((media) => {
      const ext = media.includes(".mp4") ? "vidéo" : "photo";
      const el =
        ext === "vidéo"
          ? `<video controls width="100%" src="${media}"></video>`
          : `<img src="${media}" alt="média" style="width:100%;border-radius:10px;">`;

      result.innerHTML += `
        <div style="margin-top:15px;">
          ${el}
          <a href="${media}" download target="_blank" style="
            display:inline-block;
            margin-top:10px;
            background:linear-gradient(90deg,#8b5cf6,#6a0dad);
            color:white;
            padding:10px 20px;
            border-radius:8px;
            text-decoration:none;
            font-weight:600;
          ">⬇️ Télécharger</a>
        </div>`;
    });
  } catch (err) {
    console.error(err);
    result.innerHTML = `<p style="color:#d33;">Erreur de connexion au serveur.</p>`;
  }
}
