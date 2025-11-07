// Studio Yapad Downloader – version stable Render
async function download(platform) {
  const input = document.getElementById(platform === "instagram" ? "insta" : "tiktok");
  const url = input.value.trim();
  const result = document.getElementById(`${platform}-result`);
  result.innerHTML = "";

  if (!url) {
    result.innerHTML = `<p style="color:#d33;">⚠️ Merci d’entrer un lien valide.</p>`;
    return;
  }

  try {
    const res = await fetch(`/api/${platform}?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (!data.ok) {
      result.innerHTML = `<p style="color:#d33;">${data.error || "Erreur inconnue."}</p>`;
      return;
    }

    data.medias.forEach((media) => {
      const isVideo = media.endsWith(".mp4");
      const content = isVideo
        ? `<video controls width="100%" src="${media}"></video>`
        : `<img src="${media}" alt="média" style="width:100%;border-radius:10px;">`;

      result.innerHTML += `
        <div style="margin-top:15px;">
          ${content}
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
