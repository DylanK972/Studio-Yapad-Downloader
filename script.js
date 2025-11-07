// 🎬 Studio Yapad Downloader – Script principal

async function download(platform) {
  const input = document.getElementById(platform);
  const resultDiv = document.getElementById(`${platform}-result`);
  const url = input.value.trim();

  resultDiv.innerHTML = "";

  if (!url) {
    resultDiv.innerHTML = `<p style="color:#c00;">⚠️ Merci de coller un lien valide.</p>`;
    return;
  }

  // Détecte automatiquement la plateforme
  let endpoint = "";
  if (url.includes("tiktok.com")) endpoint = "/api/tiktok";
  else if (url.includes("instagram.com")) endpoint = "/api/instagram";
  else {
    resultDiv.innerHTML = `<p style="color:#c00;">❌ Plateforme non reconnue.</p>`;
    return;
  }

  // Spinner temporaire
  resultDiv.innerHTML = `<p>⏳ Récupération du média...</p>`;

  try {
    const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (data.error) {
      resultDiv.innerHTML = `<p style="color:#c00;">⚠️ ${data.error}</p>`;
      return;
    }

    // 🔹 Si un lien est trouvé
    if (data.media) {
      const link = data.media;
      const isVideo = link.includes(".mp4");
      const isImage = link.match(/\.(jpg|jpeg|png)/i);

      let preview = "";
      if (isVideo) {
        preview = `
          <video controls width="100%" style="border-radius:10px;margin-top:10px;">
            <source src="${link}" type="video/mp4">
            Votre navigateur ne supporte pas la vidéo.
          </video>`;
      } else if (isImage) {
        preview = `<img src="${link}" alt="aperçu" style="width:100%;border-radius:10px;margin-top:10px;">`;
      }

      resultDiv.innerHTML = `
        ${preview}
        <a href="${link}" target="_blank" download style="
          display:inline-block;
          margin-top:15px;
          padding:10px 20px;
          background:linear-gradient(90deg,#8b5cf6,#6a0dad);
          color:white;
          border-radius:10px;
          font-weight:600;
          text-decoration:none;
        ">⬇️ Télécharger</a>
      `;
    } else {
      resultDiv.innerHTML = `<p style="color:#c00;">⚠️ Aucun média détecté (toutes les sources ont échoué).</p>`;
    }
  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `<p style="color:#c00;">❌ Erreur inattendue : ${err.message}</p>`;
  }
}
