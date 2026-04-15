const $ = (id) => document.getElementById(id);
const preview = $("preview");
const status = $("status");

const setStatus = (msg) => {
  status.textContent = msg;
  if (msg) setTimeout(() => (status.textContent = ""), 1500);
};

const downscale = (dataUrl, maxDim = 1024) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

const load = () => {
  chrome.storage.local.get({ imageUrl: null, enabled: true }, (cfg) => {
    $("enabled").checked = cfg.enabled;
    if (cfg.imageUrl) preview.style.backgroundImage = `url("${cfg.imageUrl}")`;
  });
};

$("enabled").addEventListener("change", (e) => {
  chrome.storage.local.set({ enabled: e.target.checked }, () =>
    setStatus("Saved")
  );
});

$("file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const resized = await downscale(reader.result);
      chrome.storage.local.set({ imageUrl: resized }, () => {
        preview.style.backgroundImage = `url("${resized}")`;
        setStatus("Saved");
      });
    } catch (err) {
      setStatus("Failed to load image");
    }
  };
  reader.readAsDataURL(file);
});

$("clear").addEventListener("click", () => {
  chrome.storage.local.set({ imageUrl: null }, () => {
    preview.style.backgroundImage = "";
    setStatus("Removed");
  });
});

load();
