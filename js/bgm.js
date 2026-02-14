// js/bgm.js
(function () {
  const DEFAULT_TRACK = "./arcade.mp3";
  const KEY_TRACK = "bgmTrack";
  const KEY_TIME  = "bgmTime";
  const KEY_PLAY  = "bgmPlaying";

  // Create (or reuse) a single <audio id="bgm"> on the page
  let bgm = document.getElementById("bgm");
  if (!bgm) {
    bgm = document.createElement("audio");
    bgm.id = "bgm";
    bgm.loop = true;
    bgm.preload = "auto";
    document.body.appendChild(bgm);
  }

  bgm.volume = 0.5;

  function getTrack() {
    return localStorage.getItem(KEY_TRACK) || DEFAULT_TRACK;
  }

  function setTrack(src, { resetTime = false, loop = true } = {}) {
    const current = bgm.getAttribute("src") || "";
    if (current !== src) {
      bgm.loop = !!loop;
      bgm.src = src;
      bgm.load();
    }
    localStorage.setItem(KEY_TRACK, src);

    if (resetTime) {
      localStorage.setItem(KEY_TIME, "0");
      try { bgm.currentTime = 0; } catch(e) {}
    }
  }

  function restoreTime() {
    const t = Number(localStorage.getItem(KEY_TIME) || "0");
    if (Number.isFinite(t) && t > 0 && t < 36000) {
      try { bgm.currentTime = t; } catch(e) {}
    }
  }

  async function play() {
    localStorage.setItem(KEY_PLAY, "true");
    try {
      await bgm.play();
    } catch (e) {
      // iOS/Safari may block autoplay until user gesture
    }
  }

  function pause() {
    localStorage.setItem(KEY_PLAY, "false");
    try { bgm.pause(); } catch(e) {}
  }

  // Save time periodically so next page resumes
  setInterval(() => {
    if (!bgm.paused) {
      localStorage.setItem(KEY_TIME, String(bgm.currentTime || 0));
    }
  }, 500);

  // Init on page load
  setTrack(getTrack(), { resetTime: false, loop: true });
  restoreTime();

  // If user previously had music on, try resume on pageshow (bfcache)
  window.addEventListener("pageshow", () => {
    setTrack(getTrack(), { resetTime: false, loop: bgm.loop });
    restoreTime();
    if (localStorage.getItem(KEY_PLAY) === "true") play();
  });

  // First user gesture on each page => guaranteed start
  document.addEventListener("pointerdown", function firstTap() {
    if (localStorage.getItem(KEY_PLAY) === "true") play();
    document.removeEventListener("pointerdown", firstTap);
  }, { once: true });

  // Expose a tiny API for special scenes (final rooftop)
  window.BGM = { play, pause, setTrack };
})();
