async function download(platform) {
  const input = document.getElementById(platform);
  const result = document.getElementById(`${platform}-result`);
  const url = input.value.trim();
  if (!url) return (result.innerHTML = "❌ Entre un lien valide.");

  result.innerHTML = "⏳ Recherche du média...";
  try {
    const res = await fetch(
      `${window.location.origin}/?url=${encodeURIComponent(url)}`
    );
    const data = await res.json();

    if (data.error) {
      result.innerHTML = `⚠️ ${data.error}`;
      return;
    }

    result.innerHTML = data.media
      .map(
        (m) =>
          `<a href="${m}" download target="_blank">📥 Télécharger le média</a>`
      )
      .join("<br>");
  } catch (e) {
    result.innerHTML = `❌ Erreur : ${e.message}`;
  }
}
