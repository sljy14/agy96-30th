// ./js/bgm.js
(() => {
  // ---------- CONFIG ----------
  const DEFAULT_SRC = "./arcade.mp3"; // your normal bgm
  const STORAGE_KEY = "bgm_state_v1";

  // ---------- Get or create the <audio> ----------
  let audio = document.getElementById("bgm");
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = "bgm";
    audio.loop = true;
    audio.preload = "auto";
    document.body.appendChild(audio);
  }

  audio.volume = 0.5;

  // ---------- State helpers ----------
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveState(partial) {
    const s = { ...loadState(), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function ensureSrc(src) {
    if (!src) src = DEFAULT_SRC;
    if (audio.getAttribute("src") !== src) {
      audio.src = src;
      audio.load();
    }
  }

  async function safePlay() {
    try {
      await audio.play();
      saveState({ playing: true });
    } catch (e) {
      // iOS blocks autoplay until user gesture; ignore quietly
    }
  }

  function setLoop(loop) {
    audio.loop = !!loop;
  }

  function switchTo(src, loop = true, restart = false) {
    const wasPlaying = !audio.paused;
    ensureSrc(src);
    setLoop(loop);
    if (restart) audio.currentTime = 0;
    saveState({ src, loop, playing: wasPlaying });
    if (wasPlaying) safePlay();
  }

  // ---------- Restore on page load ----------
  const st = loadState();
  ensureSrc(st.src || DEFAULT_SRC);
  setLoop(st.loop ?? true);

  // Try resume time if same src
  if (typeof st.t === "number" && !Number.isNaN(st.t)) {
    audio.currentTime = Math.max(0, st.t);
  }

  // If previously playing, attempt to play (will only succeed after gesture on iOS)
  if (st.playing) safePlay();

  // ---------- Keep time across pages ----------
  function persistTime() {
    saveState({ t: audio.currentTime, src: audio.getAttribute("src"), loop: audio.loop, playing: !audio.paused });
  }
  window.addEventListener("pagehide", persistTime);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persistTime();
  });

  // ---------- Provide global functions (so your existing calls work) ----------
  window.tryPlayBgm = () => safePlay();

  // For your special pages:
  window.BGM = {
    play: () => safePlay(),
    pause: () => { audio.pause(); saveState({ playing: false }); },
    stop: () => { audio.pause(); audio.currentTime = 0; saveState({ playing: false, t: 0 }); },
    switchTo: (src, loop = true, restart = true) => switchTo(src, loop, restart),
    setVolume: (v) => { audio.volume = Math.max(0, Math.min(1, v)); saveState({ vol: audio.volume }); },
    getAudio: () => audio
  };

  // Start playing on first user interaction (iOS autoplay rule)
  document.addEventListener("pointerdown", function firstTap() {
    safePlay();
    document.removeEventListener("pointerdown", firstTap);
  }, { once: true });
})();
