(() => {
  const STATE = {
    imageUrl: null,
    enabled: true,
  };

  const PARTICIPANT_SELECTOR =
    '[data-cid="calling-participant-stream"][data-stream-type="Video"]';
  const MYSELF_SELECTOR = '[data-tid="myself-video"]';

  const loadConfig = () =>
    new Promise((resolve) => {
      chrome.storage.local.get({ imageUrl: null, enabled: true }, (cfg) => {
        STATE.imageUrl = cfg.imageUrl;
        STATE.enabled = cfg.enabled;
        resolve();
      });
    });

  const findTiles = (root) => {
    const set = new Set();
    root
      .querySelectorAll(PARTICIPANT_SELECTOR)
      .forEach((n) => set.add(n));
    root.querySelectorAll(MYSELF_SELECTOR).forEach((n) => set.add(n));
    return set;
  };

  const applyOverlay = (tile) => {
    if (!STATE.imageUrl || !STATE.enabled) {
      removeOverlay(tile);
      return;
    }

    tile.classList.add("tts-host", "tts-hide-avatar");

    let overlay = tile.querySelector(":scope > .tts-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "tts-overlay";
      tile.appendChild(overlay);
    }
    overlay.style.backgroundImage = `url("${STATE.imageUrl}")`;
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
    if (!STATE.enabled || !STATE.imageUrl) {
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
