const RAPID_API_KEY = "0b50a91b3bmsh3470b98d87091fdp16dd70jsna0750ececa79";

async function downloadInstagram() {
  const url = document.getElementById("instaUrl").value.trim();
  const result = document.getElementById("instaResult");
  const progress = document.getElementById("instaProgress");
  if (!url) return result.innerHTML = "⚠️ Entre un lien valide Instagram.";

  result.innerHTML = "";
  progress.classList.remove("hidden");
  updateProgress(progress, 30);

  try {
    const apiUrl = `https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/convert?url=${encodeURIComponent(url)}`;
    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-key": RAPID_API_KEY,
        "x-rapidapi-host": "instagram-downloader-download-instagram-videos-stories.p.rapidapi.com"
      }
    };

    const res = await fetch(apiUrl, options);
    updateProgress(progress, 70);
    const data = await res.json();
    updateProgress(progress, 100);
    setTimeout(() => progress.classList.add("hidden"), 400);

    const mediaUrl = data?.url || data?.media || data?.download_url;
    if (!mediaUrl) return result.innerHTML = "❌ Aucun média trouvé.";

    const isVideo = mediaUrl.includes(".mp4");
    result.innerHTML = isVideo
      ? `<video controls src="${mediaUrl}"></video><a href="${mediaUrl}" class="download-btn" download>Télécharger la vidéo</a>`
      : `<img src="${mediaUrl}" alt="Image"><a href="${mediaUrl}" class="download-btn" download>Télécharger l’image</a>`;
  } catch (e) {
    progress.classList.add("hidden");
    result.innerHTML = "⚠️ Erreur lors de la récupération du média.";
    console.error(e);
  }
}

async function downloadTikTok() {
  const url = document.getElementById("tiktokUrl").value.trim();
  const result = document.getElementById("tiktokResult");
  const progress = document.getElementById("tiktokProgress");
  if (!url) return result.innerHTML = "⚠️ Entre un lien valide TikTok.";

  result.innerHTML = "";
  progress.classList.remove("hidden");
  updateProgress(progress, 30);

  try {
    const apiUrl = `https://tiktok-download-video-no-watermark.p.rapidapi.com/tiktok/info?url=${encodeURIComponent(url)}`;
    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-key": RAPID_API_KEY,
        "x-rapidapi-host": "tiktok-download-video-no-watermark.p.rapidapi.com"
      }
    };

    const res = await fetch(apiUrl, options);
    updateProgress(progress, 70);
    const data = await res.json();
    updateProgress(progress, 100);
    setTimeout(() => progress.classList.add("hidden"), 400);

    const videoUrl = data?.data?.play || data?.data?.hdplay || data?.data?.wmplay;
    if (!videoUrl) return result.innerHTML = "❌ Impossible de récupérer la vidéo.";

    result.innerHTML = `
      <video controls src="${videoUrl}"></video>
      <a href="${videoUrl}" class="download-btn" download>Télécharger la vidéo HD</a>
    `;
  } catch (e) {
    progress.classList.add("hidden");
    result.innerHTML = "⚠️ Erreur lors de la récupération de la vidéo.";
    console.error(e);
  }
}

// barre de progression animée
function updateProgress(progressBar, value) {
  const bar = progressBar.querySelector("span");
  bar.style.width = value + "%";
}
    