// script.js - Studio Yapad Downloader (fallback version)
async function downloadInstagram() {
  const input = document.querySelector("input");
  const url = input.value.trim();
  const result = document.getElementById("result");
  result.innerHTML = "";
  if (!url) return (result.innerHTML = "⚠️ Veuillez coller un lien Instagram.");

  const showError = (msg) => {
    result.innerHTML = `<p style="color:#d33;">⚠️ ${msg}</p>`;
  };

  try {
    // 1️⃣ Tente via ton backend Render
    const backendUrl = `/api/instagram?url=${encodeURIComponent(url)}`;
    const r = await fetch(backendUrl);
    const data = await r.json();

    if (data.ok && data.medias?.length) {
      displayMedia(data.medias);
      return;
    }

    // 2️⃣ Si backend bloqué, tente depuis le navigateur
    console.warn("Serveur bloqué côté Render, fallback client lancé...");
    const fallback = await fetch(
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`
    );
    const text = await fallback.text();

    // Si Instagram renvoie encore du HTML
    if (text.trim().startsWith("<")) {
      return showError("⚠️ Instagram bloque aussi depuis le navigateur.");
    }

    const json = JSON.parse(text);
    if (json.thumbnail_url) {
      displayMedia([json.thumbnail_url]);
    } else {
      showError("⚠️ Aucun média trouvé (format inattendu).");
    }
  } catch (e) {
    console.error(e);
    showError("⚠️ Erreur : " + e.message);
  }
}

function displayMedia(medias) {
  const result = document.getElementById("result");
  result.innerHTML = "";

  medias.forEach((url) => {
    const div = document.createElement("div");
    div.className = "media-block";
    div.innerHTML = `
      <img src="${url}" alt="media" class="thumb">
      <div class="buttons">
        <a href="${url}" target="_blank" class="dl-btn">⬇️ Télécharger</a>
        <button onclick="navigator.clipboard.writeText('${url}')" class="copy-btn">Copier lien</button>
      </div>
    `;
    result.appendChild(div);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector("button");
  btn.addEventListener("click", downloadInstagram);
});
