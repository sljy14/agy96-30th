// ./js/bgm.js
(() => {
  // ---------- CONFIG ----------
  const DEFAULT_SRC = "./arcade.mp3"; // your normal bgm
  const STORAGE_KEY = "bgm_state_v1";

  function normalizeSrc(src) {
    try {
      return new URL(src, window.location.href).href;
    } catch {
      return src || "";
    }
  }

  function clamp01(v, fallback = 0.5) {
    if (typeof v !== "number" || Number.isNaN(v)) return fallback;
    return Math.max(0, Math.min(1, v));
  }

  // ---------- Get or create the <audio> ----------
  let audio = document.getElementById("bgm");
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = "bgm";
    audio.loop = true;
    audio.preload = "auto";
    document.body.appendChild(audio);
  }
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.playsInline = true;

  audio.volume = 0.5;
  let wantedPlaying = false;

  // ---------- State helpers ----------
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveState(partial) {
    const s = { ...loadState(), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function getStateTimes(st) {
    return (st && st.times && typeof st.times === "object") ? st.times : {};
  }

  function currentTrackKey() {
    return normalizeSrc(audio.currentSrc || audio.getAttribute("src") || "");
  }

  function ensureSrc(src) {
    if (!src) src = DEFAULT_SRC;
    const current = audio.getAttribute("src") || audio.src || "";
    if (normalizeSrc(current) !== normalizeSrc(src)) {
      // Intentionally avoid audio.load(); on iOS it can cause extra resets/glitches.
      audio.src = src;
    }
  }

  function seekWhenReady(time) {
    const target = Math.max(0, Number(time) || 0);
    const applySeek = () => {
      try {
        audio.currentTime = target;
      } catch {
        // Ignore seek failures on restricted states.
      }
    };

    if (audio.readyState >= 1) {
      applySeek();
      return;
    }

    const onMeta = () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      applySeek();
    };
    audio.addEventListener("loadedmetadata", onMeta);
  }

  async function safePlay() {
    // Mark intent immediately so fast navigations still persist "should be playing"
    wantedPlaying = true;
    saveState({ playing: true });

    try {
      await audio.play();
      saveState({ playing: true, unlocked: true });
      return true;
    } catch {
      // iOS/Android may block autoplay until user gesture; keep intent and retry on next gestures/pages
      return false;
    }
  }

  function setLoop(loop) {
    audio.loop = !!loop;
  }

  async function playAndWait(ms = 120) {
    await safePlay();
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  function switchTo(src, loop = true, restart = false) {
    const shouldPlay = wantedPlaying || !audio.paused;
    ensureSrc(src);
    setLoop(loop);

    if (restart) {
      seekWhenReady(0);
    }

    saveState({ src: normalizeSrc(audio.currentSrc || src), loop, playing: shouldPlay });
    if (shouldPlay) safePlay();
  }

  // ---------- Restore on page load ----------
  const st = loadState();
  wantedPlaying = !!st.playing;
  audio.volume = clamp01(st.vol, 0.5);

  const pageSrc = audio.getAttribute("src") || audio.src;
  const targetSrc = pageSrc || st.src || DEFAULT_SRC;
  const targetKey = normalizeSrc(targetSrc);

  ensureSrc(targetSrc);
  setLoop(st.loop ?? true);

  // Resume timestamp using per-track times; fallback to legacy single timestamp.
  const times = getStateTimes(st);
  const resumeTime = typeof times[targetKey] === "number" ? times[targetKey] : st.t;
  if (typeof resumeTime === "number" && !Number.isNaN(resumeTime)) {
    seekWhenReady(resumeTime);
  }

  saveState({ src: normalizeSrc(audio.currentSrc || targetSrc), loop: audio.loop });

  // If previously playing, attempt to play (will only succeed after gesture on iOS)
  if (st.playing) safePlay();

  // Retry on pageshow (helps Safari/Android when playback is interrupted during quick navigation)
  window.addEventListener("pageshow", () => {
    const latest = loadState();
    wantedPlaying = !!latest.playing || wantedPlaying;
    if (wantedPlaying) safePlay();
  });

  // ---------- Keep time across pages ----------
  function persistTime() {
    const state = loadState();
    const timesNow = { ...getStateTimes(state) };
    const key = currentTrackKey();

    if (key) {
      timesNow[key] = audio.currentTime;
    }

    saveState({
      t: audio.currentTime, // legacy compatibility
      times: timesNow,
      src: key || normalizeSrc(audio.getAttribute("src")),
      loop: audio.loop,
      playing: wantedPlaying || !audio.paused
    });
  }

  let lastPersistAt = 0;
  audio.addEventListener("timeupdate", () => {
    const now = Date.now();
    if (now - lastPersistAt > 500) {
      lastPersistAt = now;
      persistTime();
    }
  });
  window.addEventListener("pagehide", persistTime);
  window.addEventListener("beforeunload", persistTime);
  window.addEventListener("freeze", persistTime);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persistTime();
  });

  // ---------- Provide global functions (so your existing calls work) ----------
  window.tryPlayBgm = () => safePlay();
  window.playThenNavigate = async (url, ms = 120) => {
    await playAndWait(ms);
    window.location.href = url;
  };

  // For your special pages:
  window.BGM = {
    play: () => safePlay(),
    pause: () => { wantedPlaying = false; audio.pause(); saveState({ playing: false }); },
    stop: () => {
      wantedPlaying = false;
      audio.pause();
      seekWhenReady(0);
      persistTime();
      saveState({ playing: false, t: 0 });
    },
    switchTo: (src, loop = true, restart = true) => switchTo(src, loop, restart),
    setVolume: (v) => { audio.volume = clamp01(v); saveState({ vol: audio.volume }); },
    getAudio: () => audio
  };

  // Keep trying to unlock playback on user interactions until play succeeds.
  // iOS Safari can reject the first attempt when navigation/tap timing is tight.
  let unlocked = !!st.unlocked;
  const unlock = async () => {
    if (unlocked) return;
    const ok = await safePlay();
    if (ok || !audio.paused) {
      unlocked = true;
      saveState({ unlocked: true, playing: true });
      ["pointerdown", "touchstart", "touchend", "click", "keydown"].forEach((evt) => {
        document.removeEventListener(evt, unlock, true);
      });
    }
  };

  ["pointerdown", "touchstart", "touchend", "click", "keydown"].forEach((evt) => {
    document.addEventListener(evt, unlock, { capture: true, passive: true });
  });
})();
