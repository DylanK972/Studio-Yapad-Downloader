async function download(type) {
  const input = document.getElementById(type);
  const result = document.getElementById(`${type}-result`);
  const url = input.value.trim();

  if (!url) {
    result.innerHTML = "⚠️ Merci d’entrer un lien valide.";
    return;
  }

  result.innerHTML = "⏳ Téléchargement en cours...";

  try {
    const endpoint = type === "insta" ? "/api/instagram" : "/api/tiktok";
    const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
    const text = await response.text(); // ✅ on récupère du texte, pas du JSON

    // Vérifie si Snapinsta/Ssstik a bien renvoyé du HTML
    if (text.includes("<html")) {
      result.innerHTML = `
        ✅ Contenu récupéré !  
        <br><small>Si le lien ne s’affiche pas automatiquement, clique ci-dessous :</small><br>
        <a href="${endpoint}?url=${encodeURIComponent(url)}" target="_blank">Voir le résultat brut</a>
      `;
    } else {
      result.innerHTML = "⚠️ Aucun média trouvé ou format inattendu.";
    }
  } catch (error) {
    console.error(error);
    result.innerHTML = `❌ Erreur : ${error.message}`;
  }
}
