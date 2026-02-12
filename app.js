// Shared state + helpers
const APP = {
  key: "bday_pixel_v1",
  state() {
    const raw = localStorage.getItem(APP.key);
    if (!raw) return {
      cleared: { chinatown:false, macritchie:false, waterloo:false, stadium:false },
      promptIndex: 0,
      reflections: { q21Text:"", q30Text:"", q21Audio:"", q30Audio:"" }
    };
    try { return JSON.parse(raw); } catch { return APP.state(); }
  },
  save(s) { localStorage.setItem(APP.key, JSON.stringify(s)); },
  reset() { localStorage.removeItem(APP.key); },
  allCleared(s) {
    const c = s.cleared;
    return c.chinatown && c.macritchie && c.waterloo && c.stadium;
  },
  // prompt list for map hub
  prompts: [
    { text:"Click the place with the most 🥢 mala energy 🌶", answer:"chinatown" },
    { text:"Click the place with the most 🌲 greenery (your legs will regret it)", answer:"macritchie" },
    { text:"Click the place where she becomes a 🩰 ballerina (grace mode)", answer:"waterloo" },
    { text:"Click the place with the most 🏟 stamina and hurdles", answer:"stadium" },
  ],
  // simple pixel jump animation helper (used on map)
  jumpTween(t) {
    // t 0..1 -> y offset
    // nice little arc
    return -Math.sin(t * Math.PI) * 18;
  }
};

// Canvas resize helper
function fitCanvas(canvas, ctx){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}


