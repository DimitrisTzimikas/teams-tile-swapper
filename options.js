const $ = (id) => document.getElementById(id);
const preview = $("preview");
const status = $("status");
const DEFAULT_IMAGE_URL = chrome.runtime.getURL("default.svg");

const setStatus = (msg) => {
  status.textContent = msg;
  status.classList.toggle("show", !!msg);
  if (msg)
    setTimeout(() => {
      status.classList.remove("show");
    }, 1500);
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

const fetchSample = async (mode) => {
  if (mode === "cats") {
    const res = await fetch(
      `https://cataas.com/cat?width=400&height=400&t=${Date.now()}`
    );
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  if (mode === "dogs") {
    const res = await fetch("https://dog.ceo/api/breeds/image/random");
    const data = await res.json();
    return data.message;
  }
  return null;
};

const setModeUI = (mode) => {
  $("mode-custom").checked = mode === "custom";
  $("mode-cats").checked = mode === "cats";
  $("mode-dogs").checked = mode === "dogs";
  $("custom-section").classList.toggle("hidden", mode !== "custom");
  $("clear").classList.toggle("hidden", mode !== "custom");
  $("refresh").classList.toggle("hidden", mode === "custom");
  $("focus-hint").classList.toggle("hidden", mode !== "custom");
  preview.classList.toggle("custom", mode === "custom");
};

const applyPreviewCrop = (fit, fx, fy) => {
  const mode = document.querySelector('input[name="mode"]:checked')?.value;
  const main = $("preview-main");
  main.style.backgroundSize = fit;
  main.style.backgroundPosition =
    mode === "custom" ? `${fx}% ${fy}%` : "center";
  const dot = $("focus-dot");
  dot.style.left = `${fx}%`;
  dot.style.top = `${fy}%`;
};

const setPreviewImage = (url) => {
  const bg = `url("${url}")`;
  $("preview-main").style.backgroundImage = bg;
  $("preview-blur").style.backgroundImage = bg;
};

const updatePreview = async () => {
  const mode = document.querySelector('input[name="mode"]:checked')?.value;
  if (mode === "custom") {
    const { imageUrl } = await chrome.storage.local.get({ imageUrl: null });
    setPreviewImage(imageUrl || DEFAULT_IMAGE_URL);
    return;
  }
  preview.classList.add("loading");
  try {
    const url = await fetchSample(mode);
    setPreviewImage(url);
  } catch {
    setPreviewImage(DEFAULT_IMAGE_URL);
    setStatus("Failed to load");
  } finally {
    preview.classList.remove("loading");
  }
};

const load = () => {
  chrome.storage.local.get(
    {
      imageUrl: null,
      enabled: true,
      mode: "custom",
      focusX: 50,
      focusY: 50,
      fit: "cover",
    },
    (cfg) => {
      $("enabled").checked = cfg.enabled;
      $("fit-cover").checked = cfg.fit === "cover";
      $("fit-contain").checked = cfg.fit === "contain";
      setModeUI(cfg.mode);
      applyPreviewCrop(cfg.fit, cfg.focusX, cfg.focusY);
      updatePreview();
    }
  );
};

$("enabled").addEventListener("change", (e) => {
  chrome.storage.local.set({ enabled: e.target.checked }, () =>
    setStatus("Saved")
  );
});

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener("change", async (e) => {
    const mode = e.target.value;
    chrome.storage.local.set({ mode }, async () => {
      setModeUI(mode);
      const { fit, focusX, focusY } = await chrome.storage.local.get({
        fit: "cover",
        focusX: 50,
        focusY: 50,
      });
      applyPreviewCrop(fit, focusX, focusY);
      updatePreview();
      setStatus("Saved");
    });
  });
});

$("file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  $("file-label").textContent = file.name;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const resized = await downscale(reader.result);
      chrome.storage.local.set({ imageUrl: resized }, () => {
        setPreviewImage(resized);
        setStatus("Saved");
      });
    } catch {
      setStatus("Failed to load image");
    }
  };
  reader.readAsDataURL(file);
});

$("clear").addEventListener("click", () => {
  chrome.storage.local.set({ imageUrl: null }, () => {
    setPreviewImage(DEFAULT_IMAGE_URL);
    $("file-label").textContent = "Choose image…";
    setStatus("Removed");
  });
});

$("refresh").addEventListener("click", updatePreview);

preview.addEventListener("click", (e) => {
  if (!preview.classList.contains("custom")) return;
  const rect = preview.getBoundingClientRect();
  const fx = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  const fy = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
  const fit = document.querySelector('input[name="fit"]:checked')?.value || "cover";
  applyPreviewCrop(fit, fx, fy);
  chrome.storage.local.set({ focusX: fx, focusY: fy }, () => setStatus("Saved"));
});

document.querySelectorAll('input[name="fit"]').forEach((radio) => {
  radio.addEventListener("change", async (e) => {
    const fit = e.target.value;
    const { focusX, focusY } = await chrome.storage.local.get({
      focusX: 50,
      focusY: 50,
    });
    applyPreviewCrop(fit, focusX, focusY);
    chrome.storage.local.set({ fit }, () => setStatus("Saved"));
  });
});

load();
