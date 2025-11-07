// Studio Yapad Downloader — version corrigée et stable

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("downloadBtn");
  button.addEventListener("click", handleDownload);
});

async function handleDownload() {
  const input = document.getElementById("instaURL");
  const url = input.value.trim();
  const result = document.getElementById("result");
  result.innerHTML = "";

  if (!url) {
    result.innerHTML = `<p style="color:#d33;">⚠️ Veuillez coller un lien Instagram.</p>`;
    return;
  }

  const showError = (msg) =>
    (result.innerHTML = `<p style="color:#d33;">⚠️ ${msg}</p>`);

  try {
    // 🧠 Étape 1 : appel à ton backend Render
    const backend = `/api/instagram?url=${encodeURIComponent(url)}`;
    const res = await fetch(backend);
    const data = await res.json();

    if (data.ok && data.medias?.length) {
      return renderMedias(data.medias);
    }

    console.warn("➡️ Backend bloqué — fallback client en cours...");

    // 🧠 Étape 2 : fallback direct client (navigateur)
    const fallback = await fetch(
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`
    );
    const text = await fallback.text();

    if (text.trim().startsWith("<")) {
      return showError("⚠️ Instagram bloque également côté navigateur.");
    }

    const json = JSON.parse(text);
    if (json.thumbnail_url) {
      renderMedias([json.thumbnail_url]);
    } else {
      showError("⚠️ Aucun média trouvé (format inattendu).");
    }
  } catch (err) {
    console.error("Erreur:", err);
    showError("Erreur: " + err.message);
  }
}

function renderMedias(urls) {
  const result = document.getElementById("result");
  result.innerHTML = "";

  urls.forEach((url) => {
    const container = document.createElement("div");
    container.className = "media-container";
    container.innerHTML = `
      <img src="${url}" alt="Média Instagram" class="media-preview">
      <div class="buttons">
        <a href="${url}" download class="dl-btn" target="_blank">⬇️ Télécharger</a>
        <button class="copy-btn" onclick="copyLink('${url}')">Copier lien</button>
      </div>
    `;
    result.appendChild(container);
  });
}

function copyLink(url) {
  navigator.clipboard.writeText(url);
  alert("Lien copié !");
}
