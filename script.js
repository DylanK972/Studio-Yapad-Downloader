async function proxyDownload(provider) {
  const input = document.getElementById("insta");
  const url = input.value.trim();
  const result = document.getElementById(`${provider}-result`);
  result.innerHTML = "";

  if (!url) {
    result.innerHTML = `<p style="color:#d33;">⚠️ Colle une URL Instagram valide.</p>`;
    return;
  }

  result.innerHTML = `<p>🔎 Recherche du média...</p>`;

  try {
    const endpoint = `/api/proxy-download?provider=${encodeURIComponent(provider)}&url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint);
    // si le endpoint stream le fichier, il renverra autre chose ; ici on attend JSON fallback
    const contentType = res.headers.get("content-type") || "";

    // si le serveur a directement streamé un média (content-type video/image), ouvrir dans un onglet
    if (contentType.startsWith("video/") || contentType.startsWith("image/")) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const isVideo = contentType.startsWith("video/");
      result.innerHTML = `
        ${isVideo ? `<video controls width="100%" src="${blobUrl}"></video>` : `<img src="${blobUrl}" alt="media" style="width:100%;border-radius:10px;">`}
        <a href="${blobUrl}" download style="display:inline-block;margin-top:10px;background:linear-gradient(90deg,#8b5cf6,#6a0dad);color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">⬇️ Télécharger</a>
      `;
      return;
    }

    // sinon, on s'attend à du JSON décrivant le média
    const data = await res.json();

    if (!data.ok) {
      result.innerHTML = `<p style="color:#d33;">Erreur: ${data.error || "inconnue"}</p>`;
      return;
    }

    // Si data.mediaUrl (string) ou data.medias (array)
    const medias = data.medias || (data.mediaUrl ? [data.mediaUrl] : []);
    if (!medias.length) {
      result.innerHTML = `<p style="color:#d33;">Aucun média trouvé.</p>`;
      return;
    }

    result.innerHTML = "";
    medias.forEach((m) => {
      const isVideo = m.endsWith(".mp4") || m.includes("video");
      const preview = isVideo ? `<video controls width="100%" src="${m}"></video>` : `<img src="${m}" alt="media" style="width:100%;border-radius:10px;">`;
      result.innerHTML += `
        <div style="margin-top:15px;">
          ${preview}
          <a href="${m}" target="_blank" download style="display:inline-block;margin-top:10px;background:linear-gradient(90deg,#8b5cf6,#6a0dad);color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">⬇️ Télécharger</a>
        </div>
      `;
    });
  } catch (e) {
    console.error(e);
    result.innerHTML = `<p style="color:#d33;">Erreur de connexion au serveur : ${e.message}</p>`;
  }
}
