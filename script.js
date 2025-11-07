document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const input = document.querySelector("input");
  const button = document.querySelector("button");

  const msg = document.createElement("p");
  msg.style.marginTop = "12px";
  msg.style.textAlign = "center";
  msg.style.fontWeight = "500";
  form.appendChild(msg);

  let isLoading = false;

  async function handleDownload(e) {
    e.preventDefault();
    if (isLoading) return;
    isLoading = true;

    const url = input.value.trim();
    msg.textContent = "";
    msg.style.color = "#555";

    if (!url) {
      msg.style.color = "red";
      msg.textContent = "⚠️ Merci d’entrer une URL.";
      isLoading = false;
      return;
    }

    msg.innerHTML = "⏳ Récupération des médias...";
    button.disabled = true;
    button.style.opacity = 0.6;

    const endpoint = url.includes("tiktok.com")
      ? "/api/tiktok"
      : "/api/instagram";

    try {
      let response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error("Erreur serveur " + response.status);
      let data = await response.json();

      // Retry automatique si premier essai vide
      if ((!data.ok || !data.medias?.length) && !window._retry) {
        window._retry = true;
        console.log("🔁 Retry automatique...");
        response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
        data = await response.json();
      }

      window._retry = false;

      if (!data.ok || !data.medias || !data.medias.length) {
        msg.style.color = "red";
        msg.innerHTML = data.error || "⚠️ Aucun média trouvé.";
        button.disabled = false;
        button.style.opacity = 1;
        isLoading = false;
        return;
      }

      msg.style.color = "#27ae60";
      msg.innerHTML = `✅ ${data.count || data.medias.length} média${
        data.medias.length > 1 ? "s" : ""
      } trouvé${data.medias.length > 1 ? "s" : ""}.`;

      const old = document.querySelector(".results");
      if (old) old.remove();

      const container = document.createElement("div");
      container.className = "results";
      container.style.display = "grid";
      container.style.gridTemplateColumns = "repeat(auto-fit,minmax(220px,1fr))";
      container.style.gap = "12px";
      container.style.marginTop = "20px";

      data.medias.forEach((m) => {
        const card = document.createElement("div");
        card.style.background = "#fff";
        card.style.borderRadius = "10px";
        card.style.padding = "10px";
        card.style.boxShadow = "0 0 6px rgba(0,0,0,0.1)";
        card.style.textAlign = "center";
        card.style.transition = "transform 0.2s";
        card.onmouseenter = () => (card.style.transform = "scale(1.02)");
        card.onmouseleave = () => (card.style.transform = "scale(1)");

        if (m.includes(".mp4")) {
          const video = document.createElement("video");
          video.src = m;
          video.controls = true;
          video.style.width = "100%";
          video.style.borderRadius = "8px";
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
        link.target = "_blank";
        link.style.display = "inline-block";
        link.style.marginTop = "8px";
        link.style.color = "#6c3ef2";
        link.style.fontWeight = "600";
        link.style.textDecoration = "none";
        card.appendChild(link);

        container.appendChild(card);
      });

      form.insertAdjacentElement("afterend", container);
    } catch (err) {
      console.error("Erreur front:", err);
      msg.style.color = "red";
      msg.textContent = "❌ Erreur : " + err.message;
    }

    button.disabled = false;
    button.style.opacity = 1;
    isLoading = false;
  }

  form.addEventListener("submit", handleDownload);
});
