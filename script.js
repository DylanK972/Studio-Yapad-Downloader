// script.js (front)
document.addEventListener("DOMContentLoaded", () => {
  // adapt selectors to your HTML
  const instaInput = document.querySelector("#insta") || document.querySelector("#instaInput") || document.querySelector("input[placeholder*='instagram']");
  const tiktokInput = document.querySelector("#tiktok");
  const instaBtn = document.querySelector("button[onclick*='insta']") || document.querySelector("#instaBtn");
  const tiktokBtn = document.querySelector("button[onclick*='tiktok']") || document.querySelector("#tiktokBtn");

  // create a results area if none exists
  let resultsArea = document.querySelector("#insta-result");
  if (!resultsArea) {
    resultsArea = document.createElement("div");
    resultsArea.id = "insta-result";
    if (instaBtn && instaBtn.parentNode) instaBtn.parentNode.appendChild(resultsArea);
  }

  const setMessage = (msg, danger = false) => {
    resultsArea.innerHTML = `<p style="color:${danger ? "crimson" : "#333"}">${msg}</p>`;
  };

  const fetchInstagram = async (url) => {
    try {
      setMessage("Recherche des médias…");
      const res = await fetch(`/api/instagram?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!json.ok || !json.medias || json.count === 0) {
        const message = json.message || json.error || "Aucun média trouvé ou format inattendu.";
        setMessage("⚠️ " + message, true);
        return;
      }

      // show results
      resultsArea.innerHTML = "";
      json.medias.forEach((m, i) => {
        const wrap = document.createElement("div");
        wrap.className = "media-row";
        wrap.style = "margin:10px 0; display:flex; gap:12px; align-items:center;";

        // thumb (if image)
        const thumb = document.createElement("img");
        thumb.src = m;
        thumb.style = "width:120px; height:auto; object-fit:cover; border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,0.08)";
        // if url is video (mp4) try to use video element
        if (m.match(/\.mp4|video/)) {
          const v = document.createElement("video");
          v.src = m;
          v.muted = true;
          v.controls = false;
          v.style = "width:120px; border-radius:8px; background:#000";
          v.onmouseover = () => v.play();
          v.onmouseout = () => v.pause();
          wrap.appendChild(v);
        } else {
          wrap.appendChild(thumb);
        }

        // info and actions
        const info = document.createElement("div");
        info.style = "flex:1";

        const urlP = document.createElement("div");
        urlP.textContent = m;
        urlP.style = "font-size:12px; color:#555; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:420px";

        // direct proxy download button
        const proxyUrl = `/proxy?url=${encodeURIComponent(m)}&name=post_${i + 1}`;
        const dl = document.createElement("a");
        dl.href = proxyUrl;
        dl.target = "_blank";
        dl.rel = "noopener";
        dl.textContent = "⬇️ Télécharger";
        dl.style =
          "display:inline-block; margin-top:8px; padding:10px 14px; background:linear-gradient(90deg,#8b5cf6,#6a0dad); color:white; border-radius:10px; text-decoration:none; font-weight:600";

        // copy link button
        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copier lien";
        copyBtn.style = "margin-left:10px; padding:8px 10px; border-radius:8px";
        copyBtn.onclick = () => {
          navigator.clipboard?.writeText(m).then(() => alert("Lien copié"));
        };

        info.appendChild(urlP);
        info.appendChild(dl);
        info.appendChild(copyBtn);

        wrap.appendChild(info);
        resultsArea.appendChild(wrap);
      });
    } catch (err) {
      setMessage("⚠️ Erreur : " + err.message, true);
    }
  };

  // hook buttons (if available)
  if (instaBtn && instaInput) {
    instaBtn.addEventListener("click", () => {
      const url = instaInput.value.trim();
      if (!url) return setMessage("Colle un lien Instagram !");
      fetchInstagram(url);
    });
  } else if (instaInput) {
    // allow Enter
    instaInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        fetchInstagram(instaInput.value.trim());
      }
    });
  }
});
