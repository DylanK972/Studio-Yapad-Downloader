// script.js - frontend code to call /api/instagram and render results
async function download(kind) {
  const input = document.getElementById(kind === "insta" ? "insta" : "tiktok");
  const resultEl = document.getElementById(kind === "insta" ? "insta-result" : "tiktok-result");
  const url = (input && input.value || "").trim();
  resultEl.innerHTML = "";
  if (!url) {
    resultEl.innerHTML = '<div style="color:orange">Colle un lien valide.</div>';
    return;
  }

  resultEl.innerHTML = '<div style="color:#666">Recherche des médias…</div>';
  try {
    const endpoint = kind === "insta" ? "/api/instagram" : "/api/tiktok";
    const resp = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
    const j = await resp.json();
    if (!j.ok) {
      resultEl.innerHTML = `<div style="color:orange">⚠️ ${j.error || "Aucun média trouvé."}</div>`;
      return;
    }

    // build UI list
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "12px";

    j.medias.forEach((m, idx) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";

      // preview (small)
      const preview = document.createElement("img");
      preview.src = m;
      preview.style.width = "72px";
      preview.style.height = "72px";
      preview.style.objectFit = "cover";
      preview.style.borderRadius = "10px";
      preview.onerror = () => { preview.src = ""; preview.style.display = "none"; };

      const textWrap = document.createElement("div");
      textWrap.style.flex = "1";

      const urlText = document.createElement("div");
      urlText.style.fontSize = "12px";
      urlText.style.wordBreak = "break-all";
      urlText.textContent = m;

      const btns = document.createElement("div");
      btns.style.display = "flex";
      btns.style.gap = "8px";
      btns.style.marginTop = "6px";

      const downloadBtn = document.createElement("a");
      downloadBtn.className = "download-btn";
      downloadBtn.textContent = "⬇️ Télécharger";
      // use proxy endpoint to deliver file: /proxy?url=...&name=post_x.jpg
      const guessExt = (m.split("?")[0].match(/\.(mp4|jpg|jpeg|png|webp|gif)$/i) || ["","jpg"])[1] || "bin";
      const filename = `${kind}_post_${idx + 1}.${guessExt}`;
      downloadBtn.href = `/proxy?url=${encodeURIComponent(m)}&name=${encodeURIComponent(filename)}`;
      downloadBtn.setAttribute("target","_blank");
      downloadBtn.style.padding = "8px 12px";
      downloadBtn.style.background = "linear-gradient(90deg,#8b5cf6,#6a0dad)";
      downloadBtn.style.color = "white";
      downloadBtn.style.borderRadius = "10px";
      downloadBtn.style.textDecoration = "none";
      downloadBtn.style.fontWeight = "600";

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copier lien";
      copyBtn.style.padding = "8px 12px";
      copyBtn.style.borderRadius = "10px";
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText(m);
        copyBtn.textContent = "Copié ✓";
        setTimeout(()=> copyBtn.textContent = "Copier lien", 1500);
      };

      btns.appendChild(downloadBtn);
      btns.appendChild(copyBtn);

      textWrap.appendChild(urlText);
      textWrap.appendChild(btns);

      row.appendChild(preview);
      row.appendChild(textWrap);
      wrap.appendChild(row);
    });

    resultEl.innerHTML = "";
    resultEl.appendChild(wrap);

  } catch (e) {
    resultEl.innerHTML = `<div style="color:crimson">Erreur réseau : ${e.message || e}</div>`;
  }
}
