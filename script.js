document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const input = document.querySelector("input");
  const button = document.querySelector("button");
  const msg = document.createElement("p");
  msg.style.marginTop = "10px";
  msg.style.fontWeight = "500";
  msg.style.textAlign = "center";
  form.appendChild(msg);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = input.value.trim();
    msg.textContent = "";
    msg.style.color = "#666";
    msg.textContent = "⏳ Téléchargement en cours...";

    if (!url) {
      msg.style.color = "red";
      msg.textContent = "⚠️ Merci d’entrer une URL.";
      return;
    }

    try {
      // Detect Instagram or TikTok
      const isInsta = url.includes("instagram.com");
      const isTiktok = url.includes("tiktok.com");

      if (!isInsta && !isTiktok) {
        msg.style.color = "red";
        msg.textContent = "⚠️ Lien non supporté.";
        return;
      }

      const endpoint = isInsta ? "/api/instagram" : "/api/tiktok";
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!data.ok || !data.medias || !data.medias.length) {
        msg.style.color = "red";
        msg.textContent = data.error || "⚠️ Aucun média détecté.";
        return;
      }

      msg.style.color = "#2ecc71";
      msg.textContent = `✅ ${data.count} média${data.count > 1 ? "s" : ""} trouvé${
        data.count > 1 ? "s" : ""
      }.`;

      // Clean old previews
      const old = document.querySelector(".results");
      if (old) old.remove();

      const container = document.createElement("div");
      container.className = "results";
      container.style.display = "grid";
      container.style.gridTemplateColumns = "repeat(auto-fit, minmax(200px, 1fr))";
      container.style.gap = "10px";
      container.style.marginTop = "20px";

      data.medias.forEach((m) => {
        const card = document.createElement("div");
        card.style.textAlign = "center";
        card.style.background = "#fafafa";
        card.style.padding = "10px";
        card.style.borderRadius = "10px";
        card.style.boxShadow = "0 0 5px rgba(0,0,0,0.1)";

        if (m.endsWith(".mp4")) {
          const video = document.createElement("video");
          video.src = m;
          video.controls = true;
          video.style.width = "100%";
          card.appendChild(video);
        } else {
          const img = document.createElement("img");
          img.src = m;
          img.alt = "media";
          img.style.width = "100%";
          img.style.borderRadius = "8px";
          card.appendChild(img);
        }

        const link = document.createElement("a");
        link.href = m;
        link.download = "";
        link.textContent = "⬇️ Télécharger";
        link.style.display = "block";
        link.style.marginTop = "8px";
        link.style.color = "#6c3ef2";
        link.style.textDecoration = "none";
        link.style.fontWeight = "600";
        card.appendChild(link);

        container.appendChild(card);
      });

      form.insertAdjacentElement("afterend", container);
    } catch (err) {
      console.error(err);
      msg.style.color = "red";
      msg.textContent = "❌ Erreur : " + err.message;
    }
  });
});
