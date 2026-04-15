(() => {
  const DEFAULT_IMAGE_URL = chrome.runtime.getURL("default.svg");

  const STATE = {
    imageUrl: null,
    enabled: true,
    mode: "custom",
    focusX: 50,
    focusY: 50,
    fit: "cover",
  };

  const PARTICIPANT_SELECTOR =
    '[data-cid="calling-participant-stream"][data-stream-type="Video"]';
  const MYSELF_SELECTOR = '[data-tid="myself-video"]';

  const tileImages = new WeakMap();
  const tilePromises = new WeakMap();
  let modeVersion = 0;

  const loadConfig = () =>
    new Promise((resolve) => {
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
          STATE.imageUrl = cfg.imageUrl;
          STATE.enabled = cfg.enabled;
          STATE.mode = cfg.mode;
          STATE.focusX = cfg.focusX;
          STATE.focusY = cfg.focusY;
          STATE.fit = cfg.fit;
          resolve();
        }
      );
    });

  const fetchCat = async () => {
    const res = await fetch(
      `https://cataas.com/cat?width=400&height=400&t=${Date.now()}-${Math.random()}`
    );
    if (!res.ok) throw new Error("cat fetch failed");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  };

  const fetchDog = async () => {
    const res = await fetch("https://dog.ceo/api/breeds/image/random");
    if (!res.ok) throw new Error("dog api failed");
    const data = await res.json();
    const imgRes = await fetch(data.message);
    if (!imgRes.ok) throw new Error("dog image failed");
    const blob = await imgRes.blob();
    return URL.createObjectURL(blob);
  };

  const getImageForTile = (tile) => {
    const cached = tileImages.get(tile);
    if (cached && cached.version === modeVersion) return Promise.resolve(cached.url);

    if (STATE.mode === "custom") {
      const url = STATE.imageUrl || DEFAULT_IMAGE_URL;
      tileImages.set(tile, { version: modeVersion, url });
      return Promise.resolve(url);
    }

    const pending = tilePromises.get(tile);
    if (pending && pending.version === modeVersion) return pending.promise;

    const requestVersion = modeVersion;
    const promise = (async () => {
      try {
        const url = STATE.mode === "cats" ? await fetchCat() : await fetchDog();
        if (requestVersion === modeVersion) {
          tileImages.set(tile, { version: modeVersion, url });
          return url;
        }
        URL.revokeObjectURL(url);
      } catch {
        /* keep default */
      }
      return DEFAULT_IMAGE_URL;
    })();
    tilePromises.set(tile, { version: modeVersion, promise });
    return promise;
  };

  const findTiles = (root) => {
    const set = new Set();
    root.querySelectorAll(PARTICIPANT_SELECTOR).forEach((n) => set.add(n));
    root.querySelectorAll(MYSELF_SELECTOR).forEach((n) => set.add(n));
    return set;
  };

  const applyOverlay = async (tile) => {
    if (!STATE.enabled) {
      removeOverlay(tile);
      return;
    }

    tile.classList.add("tts-host", "tts-hide-avatar");

    let overlay = tile.querySelector(":scope > .tts-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "tts-overlay";
      const blur = document.createElement("div");
      blur.className = "tts-blur";
      const main = document.createElement("div");
      main.className = "tts-main";
      overlay.appendChild(blur);
      overlay.appendChild(main);
      tile.appendChild(overlay);
    }

    const requestVersion = modeVersion;
    const url = await getImageForTile(tile);
    if (requestVersion !== modeVersion) return;
    if (!overlay.isConnected) return;

    const blur = overlay.querySelector(":scope > .tts-blur");
    const main = overlay.querySelector(":scope > .tts-main");
    const bg = `url("${url}")`;
    if (blur) blur.style.backgroundImage = bg;
    if (main) main.style.backgroundImage = bg;
    overlay.style.setProperty("--tts-bg-size", STATE.fit);
    overlay.style.setProperty(
      "--tts-bg-position",
      STATE.mode === "custom"
        ? `${STATE.focusX}% ${STATE.focusY}%`
        : "center"
    );
  };

  const removeOverlay = (tile) => {
    const overlay = tile.querySelector(":scope > .tts-overlay");
    if (overlay) overlay.remove();
    tile.classList.remove("tts-hide-avatar");
  };

  const sweep = () => {
    const tiles = findTiles(document);
    tiles.forEach(applyOverlay);
  };

  let rafPending = false;
  const scheduleSweep = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      sweep();
    });
  };

  const observer = new MutationObserver(scheduleSweep);

  const start = async () => {
    await loadConfig();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-tid", "data-cid", "data-stream-type", "class"],
    });
    setInterval(sweep, 1500);
    sweep();
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.imageUrl) STATE.imageUrl = changes.imageUrl.newValue;
    if (changes.enabled) STATE.enabled = changes.enabled.newValue;
    if (changes.mode) {
      STATE.mode = changes.mode.newValue;
      modeVersion++;
    } else if (changes.imageUrl && STATE.mode === "custom") {
      modeVersion++;
    }
    if (changes.focusX) STATE.focusX = changes.focusX.newValue;
    if (changes.focusY) STATE.focusY = changes.focusY.newValue;
    if (changes.fit) STATE.fit = changes.fit.newValue;

    if (!STATE.enabled) {
      document.querySelectorAll(".tts-overlay").forEach((n) => n.remove());
      document
        .querySelectorAll(".tts-hide-avatar")
        .forEach((n) => n.classList.remove("tts-hide-avatar"));
    } else {
      sweep();
    }
  });

  start();
})();
