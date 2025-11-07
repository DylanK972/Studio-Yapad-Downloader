async function downloadInsta() {
  const input = document.getElementById("insta");
  const url = input.value.trim();
  const result = document.getElementById("insta-result");
  result.innerHTML = "";

  if (!url) {
    result.innerHTML = `<p style="color:#d33;">⚠️ Colle un lien Instagram.</p>`;
    return;
  }

  result.innerHTML = `<p>🔎 Recherche des médias…</p>`;

  try {
    const res = await fetch(`/api/instagram?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (!data.ok) {
      result.innerHTML = `<p style="color:#d33;">${data.error || "Erreur inconnue."}</p>`;
      return;
    }

    result.innerHTML = "";
    data.medias.forEach((m) => {
      const isVideo = m.includes(".mp4");
      const media =
        isVideo
          ? `<video controls width="100%" src="${m}"></video>`
          : `<img src="${m}" style="width:100%;border-radius:10px;" />`;
      result.innerHTML += `
        <div class="media">
          ${media}
          <div><a class="dl" href="${m}" download target="_blank">⬇️ Télécharger</a></div>
        </div>`;
    });
  } catch (e) {
    result.innerHTML = `<p style="color:#d33;">Erreur de connexion: ${e.message}</p>`;
  }
}
