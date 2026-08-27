/* ================= StrungStage: shared scale + ambient backdrop =================
   Every instrument's .sg-stage is the same fixed 1280x832 composition, so
   the fit-to-container scaling only needs to happen once, here, instead of
   once per instrument. Also owns the single ambient dust-mote canvas that
   plays behind every slide, and exposes isGateActive() so an instrument's
   own render loop (e.g. guitar's string physics) can pause itself while the
   "rotate your phone" screen is covering everything anyway.
*/
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gateActive = false;

  function isGateActive() {
    return gateActive;
  }

  function fitStages(w, h) {
    var s = Math.min(w / 1280, h / 832);
    document.documentElement.style.setProperty("--sg-scale", s);
  }

  var canvas, ctx, DPR;
  var motes = [];

  function resizeCanvas(w, h) {
    // the motes are small, soft, low-contrast dots -- retina sharpness is
    // wasted on them, and a full-viewport canvas cleared/redrawn every
    // frame at 2x device pixels is a real, avoidable cost on high-DPI
    // screens. Capping at 1x quarters the pixel count on a typical 2x
    // display with no visible difference.
    DPR = 1;
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }

  function drawMotes(t) {
    if (gateActive) {
      requestAnimationFrame(drawMotes);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < motes.length; i++) {
      var mt = motes[i];
      mt.y -= mt.speed;
      mt.x += mt.drift;
      if (mt.y < -0.05) mt.y = 1.05;
      if (mt.x < -0.05) mt.x = 1.05;
      if (mt.x > 1.05) mt.x = -0.05;
      var flicker = 0.7 + 0.3 * Math.sin(t * 0.001 + mt.phase);
      ctx.beginPath();
      ctx.fillStyle = "rgba(141,102,58," + (mt.baseAlpha * flicker).toFixed(3) + ")";
      ctx.arc(mt.x * canvas.width, mt.y * canvas.height, mt.r * DPR, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(drawMotes);
  }

  function init() {
    canvas = document.getElementById("sg-motes");
    ctx = canvas.getContext("2d");

    if (!reduceMotion) {
      for (var m = 0; m < 42; m++) {
        motes.push({
          x: Math.random(),
          y: Math.random(),
          r: 0.6 + Math.random() * 1.6,
          speed: 0.00005 + Math.random() * 0.00012,
          drift: (Math.random() - 0.5) * 0.00005,
          phase: Math.random() * Math.PI * 2,
          baseAlpha: 0.05 + Math.random() * 0.12,
        });
      }
    }

    var gateQuery = window.matchMedia("(max-width: 900px) and (orientation: portrait)");
    function syncGate() {
      gateActive = gateQuery.matches;
    }
    syncGate();
    if (gateQuery.addEventListener) gateQuery.addEventListener("change", syncGate);
    else if (gateQuery.addListener) gateQuery.addListener(syncGate);

    var ro = new ResizeObserver(function (entries) {
      var cr = entries[0].contentRect;
      var w = Math.max(1, cr.width),
        h = Math.max(1, cr.height);
      fitStages(w, h);
      resizeCanvas(w, h);
      syncGate();
    });
    ro.observe(document.documentElement);

    var r0 = document.documentElement.getBoundingClientRect();
    fitStages(Math.max(1, r0.width), Math.max(1, r0.height));
    resizeCanvas(Math.max(1, r0.width), Math.max(1, r0.height));

    requestAnimationFrame(drawMotes);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.StrungStage = { isGateActive: isGateActive };
})();
