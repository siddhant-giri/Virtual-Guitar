// One-off generator: embeds the real violin.svg markup into js/instruments/violin.js.
// Run with `node scripts/build-violin.js` from the project root. Not part of the
// runtime -- this just avoids hand-transcribing ~350 lines of path data.
const fs = require("fs");
const path = require("path");

const svgPath = "C:\\Users\\Siddhant\\Downloads\\violin.svg";
const raw = fs.readFileSync(svgPath, "utf8");

const openEnd = raw.indexOf(">", raw.indexOf("<svg")) + 1;
const closeStart = raw.lastIndexOf("</svg>");
let inner = raw.slice(openEnd, closeStart);

// collapse to one line, escape for a single-quoted JS string literal
inner = inner
  .replace(/\r\n/g, "\n")
  .split("\n")
  .map((l) => l.trim())
  .join("")
  .replace(/\\/g, "\\\\")
  .replace(/'/g, "\\'");

const template = `/* ================= Violin instrument module =================
   4 strings (G3 D4 A4 E5), BOWED rather than plucked. The artwork below is
   the actual reference violin.svg (body, f-holes, chinrest, fine tuners,
   pegbox, scroll, tuning pegs, strings) embedded verbatim -- gradient/mask/
   filter ids are left exactly as exported since this markup is only ever
   mounted once (one violin slide), so there's no collision risk.

   Interactive geometry (the 4 playable bands) is read directly off the
   artwork's own string paths rather than guessed: each string in the SVG
   is drawn as a 3-point polyline from tailpiece, through the bridge
   (~x=224, where all four sit closest together), fanning out to the
   pegbox (~x=730-777). X0/X1 below are the bridge->nut span (the part of
   the string actually stopped against the fingerboard), and each string's
   y0/y1 are its bridge-side / nut-side y read off that same path data.
*/
(function () {
  "use strict";

  var X0 = 224,
    X1 = 707; // bridge -> nut, read off the artwork's own string paths

  var STRINGS = [
    { note: "G3", freq: 196.0, y0: 229.5, y1: 233.5, w: 2.6 },
    { note: "D4", freq: 293.66, y0: 246.9, y1: 238.3, w: 2.0 },
    { note: "A4", freq: 440.0, y0: 269.6, y1: 246.0, w: 1.5 },
    { note: "E5", freq: 659.25, y0: 287.6, y1: 251.6, w: 1.0 },
  ];

  // no fretting model here (violin.js only ever bows the strings' own open
  // pitch), so "chords" are what a violin can actually do without fingering:
  // open-string double/triple stops. "Single" (the default) keeps the
  // original one-string-at-a-time picking; the rest sound every listed
  // string together for as long as the bow is drawn.
  var CHORDS = [
    { name: "Single", strings: null },
    { name: "G+D", strings: [0, 1] },
    { name: "D+A", strings: [1, 2] },
    { name: "A+E", strings: [2, 3] },
    { name: "Full", strings: [0, 1, 2, 3] },
  ];

  // lives outside mount() so the choice survives switching away from the
  // Violin tab and back, matching the same fix on the guitar/bass modules.
  var currentChord = 0;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function yAt(i, u) {
    var s = STRINGS[i];
    return lerp(s.y0, s.y1, u);
  }
  function uFromX(x) {
    return clamp((x - X0) / (X1 - X0), 0.02, 0.98);
  }
  function bandAt(y, u) {
    for (var i = 0; i < STRINGS.length; i++) {
      var lo = i === 0 ? -1e9 : (yAt(i - 1, u) + yAt(i, u)) / 2;
      var hi = i === STRINGS.length - 1 ? 1e9 : (yAt(i, u) + yAt(i + 1, u)) / 2;
      if (y >= lo && y < hi) return i;
    }
    return -1;
  }

  var VIOLIN_ART = '__VIOLIN_ART__';

  function render(uid) {
    return (
      '<div class="sg-stage sg-no-swipe">' +
      '<div class="sg-watermark" aria-hidden="true">VIOLIN</div>' +
      '<div class="' +
      uid +
      'shadow" aria-hidden="true"></div>' +
      '<div class="' +
      uid +
      'wrap sg-no-swipe sg-parallax-instrument">' +
      '<svg id="' +
      uid +
      'svg" viewBox="0 0 853 505" xmlns="http://www.w3.org/2000/svg">' +
      VIOLIN_ART +
      '<g id="' +
      uid +
      'live-strings"></g>' +
      '<rect id="' +
      uid +
      'hit-layer" x="172" y="205" width="645" height="105" fill="transparent"/>' +
      "</svg>" +
      "</div>" +
      '<div class="sg-copy" style="left:701px;top:565px">' +
      '<div class="sg-overline-row"><span class="sg-overline-label">Draw the bow</span><span class="sg-rule"></span></div>' +
      '<p class="sg-headline">Hold a string and let the note breathe</p>' +
      "</div>" +
      "</div>" +
      '<footer class="sg-footer sg-footer--stacked sg-no-swipe">' +
      '<div class="sg-chip-row" id="' +
      uid +
      'chord-row"></div>' +
      '<div class="sg-key-hint">' +
      '<span class="sg-key-item"><kbd class="sg-kbd" id="' +
      uid +
      'kbd-up">&#8593;</kbd> bow up</span>' +
      '<span class="sg-key-item"><kbd class="sg-kbd" id="' +
      uid +
      'kbd-down">&#8595;</kbd> bow down</span>' +
      "</div>" +
      "</footer>" +
      "<style>" +
      "." +
      uid +
      "shadow{position:absolute;left:-30px;top:660px;width:1340px;height:220px;z-index:2;background:radial-gradient(ellipse 52% 55% at 42% 35%, rgba(45,20,8,0.4), transparent 72%);filter:blur(52px);pointer-events:none;}" +
      "." +
      uid +
      "wrap{position:absolute;left:150px;top:140px;width:980px;z-index:3;}" +
      "." +
      uid +
      "wrap svg{width:100%;height:auto;overflow:visible;display:block;}" +
      "#" +
      uid +
      'hit-layer{cursor:url("assets/cursor-bow.svg") 3 4, crosshair;touch-action:none;}' +
      "</style>"
    );
  }

  function mount(root) {
    var svg = root.querySelector("svg[id$='svg']");
    var liveG = root.querySelector("g[id$='live-strings']");
    var hit = root.querySelector("rect[id$='hit-layer']");
    var chordRow = root.querySelector("div[id$='chord-row']");
    var kbdUp = root.querySelector("kbd[id$='kbd-up']");
    var kbdDown = root.querySelector("kbd[id$='kbd-down']");
    var Audio = window.StrungAudio;
    var Stage = window.StrungStage;

    liveG.innerHTML = "";
    var stringEls = STRINGS.map(function (s) {
      var glow = document.createElementNS(svg.namespaceURI, "path");
      glow.setAttribute("class", "sg-live-string");
      glow.setAttribute("stroke", "#fff4de");
      glow.setAttribute("stroke-width", s.w + 1.4);
      glow.setAttribute("opacity", "0");
      liveG.appendChild(glow);
      var main = document.createElementNS(svg.namespaceURI, "path");
      main.setAttribute("class", "sg-live-string");
      main.setAttribute("stroke", "#e9e1cf");
      main.setAttribute("stroke-width", s.w);
      liveG.appendChild(main);
      return { glow: glow, main: main };
    });

    // per-string bow state: amp eases toward a target (0 = resting straight,
    // >0 while actively bowed), so the string "sings" continuously rather
    // than decaying like a pluck.
    var bow = STRINGS.map(function () {
      return { amp: 0, target: 0, phase: 0, handle: null };
    });
    var activeIndex = null;
    var activeChord = null; // array of string indices when a double/triple-stop preset is bowing

    // the actual note-on for one string, no exclusivity -- shared by both
    // single-string bowing and chord (double-stop) mode.
    function startBowRaw(i, amp01) {
      var s = STRINGS[i];
      if (!bow[i].handle) {
        bow[i].handle = Audio.playSustain({
          freq: s.freq,
          amp01: amp01,
          gain: 0.3,
          attack: 0.09,
          voices: [
            { type: "sawtooth", detune: 0, gain: 0.7 },
            { type: "sawtooth", detune: 6, gain: 0.35 },
            { type: "sine", detune: -1200, gain: 0.25 },
          ],
          vibrato: { rate: 5.2, cents: 9 },
          pan: (i - 1.5) / 2.5,
        });
      } else {
        bow[i].handle.setAmp(amp01);
      }
      bow[i].target = clamp(2.0 + amp01 * 2.4, 1.6, 5);
    }

    // single-string mode: starting a new string cuts off whichever one was
    // playing, since a real bow can only sit on one string at a time.
    function startBow(i, amp01) {
      if (activeIndex !== null && activeIndex !== i) stopBow(activeIndex, 0.12);
      activeIndex = i;
      startBowRaw(i, amp01);
    }

    // chord mode: every string in the preset sounds together for as long
    // as the bow is drawn.
    function startChord(indices, amp01) {
      activeChord = indices.slice();
      indices.forEach(function (i) {
        startBowRaw(i, amp01);
      });
    }
    function updateChord(amp01) {
      if (!activeChord) return;
      activeChord.forEach(function (i) {
        updateBow(i, amp01);
      });
    }
    function stopChord(release) {
      if (!activeChord) return;
      activeChord.forEach(function (i) {
        stopBow(i, release);
      });
      activeChord = null;
    }

    function updateBow(i, amp01) {
      if (bow[i].handle) bow[i].handle.setAmp(amp01);
      bow[i].target = clamp(2.0 + amp01 * 2.4, 1.6, 5);
    }

    function stopBow(i, release) {
      bow[i].target = 0;
      if (bow[i].handle) {
        bow[i].handle.stop(release != null ? release : 0.3);
        bow[i].handle = null;
      }
      if (activeIndex === i) activeIndex = null;
    }

    // true once a string's bow envelope has decayed to silence AND that
    // rest frame has actually been drawn -- lets tick() skip a string
    // entirely while it's just sitting there instead of recomputing and
    // re-writing an unchanged 21-point path 60 times a second forever.
    // The envelope is an exponential decay toward 0, so it never hits
    // exactly zero -- settled just means close enough to be inaudible and
    // visually flat.
    var stringSettled = STRINGS.map(function () {
      return true;
    });

    var raf1 = requestAnimationFrame(tick);
    var lastT = performance.now();
    function tick(now) {
      if (Stage.isGateActive()) {
        raf1 = requestAnimationFrame(tick);
        return;
      }
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      var N = 20;
      for (var i = 0; i < STRINGS.length; i++) {
        var b = bow[i];
        if (b.target === 0 && b.amp < 0.001 && stringSettled[i]) continue;
        b.amp += (b.target - b.amp) * Math.min(1, dt * 8);
        b.phase += dt * (11 + i * 1.3);
        stringSettled[i] = b.target === 0 && b.amp < 0.001;
        var wob = b.amp > 0.02 ? Math.sin(b.phase * Math.PI * 2) * b.amp : 0;
        var pts = [];
        for (var k = 0; k <= N; k++) {
          var u = k / N;
          var x = lerp(X0, X1, u);
          var y = yAt(i, u) + wob * Math.sin(Math.PI * u);
          pts.push(x.toFixed(2) + "," + y.toFixed(2));
        }
        var d = "M" + pts.join(" L");
        stringEls[i].main.setAttribute("d", d);
        stringEls[i].glow.setAttribute("d", d);
        stringEls[i].glow.setAttribute("opacity", b.amp > 0.05 ? clamp(b.amp / 5, 0, 0.5).toFixed(2) : "0");
      }
      raf1 = requestAnimationFrame(tick);
    }

    function svgPoint(evt) {
      var pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm || ctm.a === 0) return null;
      return pt.matrixTransform(ctm.inverse());
    }

    var lastPointer = null;
    var lastHoverBand = -1;

    // graze a string without ever pressing down: a quick, light bow-blip
    // that lets go on its own shortly after -- matches the "hover to play"
    // feel every other instrument in the slider has, layered on top of
    // (not instead of) press-and-hold for a real sustained note.
    function hoverBow(i, amp01) {
      startBowRaw(i, amp01);
      spawnNote(i);
      setTimeout(function () {
        if (activeIndex === i) return;
        if (activeChord && activeChord.indexOf(i) !== -1) return;
        stopBow(i, 0.3);
      }, 240);
    }

    // a fast bow crossing several strings, or a chord, can spawn several
    // labels within milliseconds -- without a cap, spawning outpaces each
    // label's 1200ms lifetime and piles up into a growing stack of
    // simultaneously-animating DOM nodes. Past this cap, a note still
    // sounds, it just doesn't also spawn a label -- purely cosmetic, so
    // nothing is lost by skipping it under heavy play.
    var MAX_LIVE_NOTES = 6;
    var liveNoteCount = 0;
    function spawnNote(i) {
      if (liveNoteCount >= MAX_LIVE_NOTES) return;
      liveNoteCount++;
      var s = STRINGS[i];
      var pt = svg.createSVGPoint();
      pt.x = X1 - 8;
      pt.y = s.y1;
      var sp = pt.matrixTransform(svg.getScreenCTM());
      var el = document.createElement("div");
      el.className = "sg-note-float";
      el.innerHTML = s.note[0] + "<sub>" + s.note[1] + "</sub>";
      el.style.left = sp.x + "px";
      el.style.top = sp.y - 24 + "px";
      document.body.appendChild(el);
      setTimeout(function () {
        el.remove();
        liveNoteCount--;
      }, 1200);
    }

    function onDown(evt) {
      Audio.wake();
      try {
        hit.setPointerCapture(evt.pointerId);
      } catch (_e) {}
      var p = svgPoint(evt);
      if (!p) return;
      lastPointer = p;
      lastHoverBand = -1;
      var preset = CHORDS[currentChord].strings;
      if (preset) {
        startChord(preset, 0.6);
        preset.forEach(spawnNote);
        return;
      }
      var u = uFromX(p.x);
      var i = bandAt(p.y, u);
      if (i !== -1) {
        startBow(i, 0.6);
        spawnNote(i);
      }
    }
    function onMove(evt) {
      Audio.wake();
      var p = svgPoint(evt);
      if (!p) {
        lastPointer = p;
        return;
      }

      // actively bowing a chord preset (pressed and dragging)
      if (activeChord) {
        if (!lastPointer) {
          lastPointer = p;
          return;
        }
        var speedC = Math.hypot(p.x - lastPointer.x, p.y - lastPointer.y);
        updateChord(clamp(0.45 + speedC / 22, 0.35, 1));
        lastPointer = p;
        return;
      }

      // actively bowing a single string (pressed and held/dragging)
      if (activeIndex !== null) {
        if (!lastPointer) {
          lastPointer = p;
          return;
        }
        var speed = Math.hypot(p.x - lastPointer.x, p.y - lastPointer.y);
        var u = uFromX(p.x);
        var i = bandAt(p.y, u);
        if (i !== -1 && i !== activeIndex) {
          startBow(i, clamp(speed / 22, 0.35, 1));
          spawnNote(i);
        } else if (i === activeIndex) {
          updateBow(i, clamp(0.45 + speed / 22, 0.35, 1));
        }
        lastPointer = p;
        return;
      }

      // nothing pressed -- pure hover. Crossing into a new string's band
      // grazes it with a brief bow-blip (see hoverBow above).
      if (evt.buttons !== 0) {
        lastPointer = p;
        return;
      }
      if (!lastPointer) {
        lastPointer = p;
        lastHoverBand = -1;
        return;
      }
      var uh = uFromX(p.x);
      var bandH = bandAt(p.y, uh);
      if (bandH !== -1 && bandH !== lastHoverBand) {
        var speedH = Math.hypot(p.x - lastPointer.x, p.y - lastPointer.y);
        hoverBow(bandH, clamp(0.4 + speedH / 22, 0.35, 0.85));
        lastHoverBand = bandH;
      } else if (bandH === -1) {
        lastHoverBand = -1;
      }
      lastPointer = p;
    }
    function onUp() {
      if (activeChord) stopChord(0.32);
      if (activeIndex !== null) stopBow(activeIndex, 0.28);
      lastPointer = null;
      lastHoverBand = -1;
    }

    hit.addEventListener("pointerdown", onDown);
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerup", onUp);
    hit.addEventListener("pointercancel", onUp);
    hit.addEventListener("pointerleave", onUp);

    function pulseKbd(el) {
      if (!el) return;
      el.classList.remove("sg-kbd--pressed");
      void el.offsetWidth;
      el.classList.add("sg-kbd--pressed");
      setTimeout(function () {
        el.classList.remove("sg-kbd--pressed");
      }, 160);
    }

    // a full stroke takes ~950ms to sweep all 4 strings plus each note's own
    // release tail -- retriggering mid-sweep overlaps bow strokes and cuts
    // the sound, so arrow keys are ignored until the current sweep (including
    // its release) has fully finished.
    var RUN_LOCK_MS = 3 * 230 + 260 + 220 + 100;
    var runLocked = false;
    function autoBow(direction) {
      if (runLocked) return;
      runLocked = true;
      var order = direction === "D" ? [0, 1, 2, 3] : [3, 2, 1, 0];
      var i = 0;
      function step() {
        if (i >= order.length) return;
        var idx = order[i];
        startBow(idx, 0.75);
        spawnNote(idx);
        setTimeout(function () {
          stopBow(idx, 0.22);
        }, 260);
        i++;
        setTimeout(step, 230);
      }
      step();
      setTimeout(function () {
        runLocked = false;
      }, RUN_LOCK_MS);
    }
    function onWindowKeydown(e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (runLocked) return;
        Audio.wake();
        pulseKbd(kbdDown);
        autoBow("D");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (runLocked) return;
        Audio.wake();
        pulseKbd(kbdUp);
        autoBow("U");
      }
    }
    window.addEventListener("keydown", onWindowKeydown);

    chordRow.innerHTML = "";
    CHORDS.forEach(function (c, idx) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sg-chip" + (idx === currentChord ? " sg-chip--active" : "");
      b.textContent = c.name;
      b.addEventListener("click", function () {
        Audio.wake();
        if (activeChord) stopChord(0.1);
        if (activeIndex !== null) stopBow(activeIndex, 0.1);
        currentChord = idx;
        chordRow.querySelectorAll(".sg-chip").forEach(function (el) {
          el.classList.remove("sg-chip--active");
        });
        b.classList.add("sg-chip--active");
      });
      chordRow.appendChild(b);
    });

    function silenceAll(release) {
      bow.forEach(function (b, i) {
        if (b.handle) stopBow(i, release != null ? release : 0.05);
      });
    }

    // preset playback api: uses startBowRaw directly rather than
    // startBow/startChord, so a running preset never touches activeIndex
    // or activeChord -- those belong to the user's own gesture, and a
    // preset note ending shouldn't be able to cut off (or get cut off by)
    // something the user is actually bowing by hand.
    var api = {
      bow: function (i, amp, durMs) {
        startBowRaw(i, amp);
        setTimeout(function () {
          stopBow(i, 0.3);
        }, durMs);
      },
      chord: function (indices, amp, durMs) {
        indices.forEach(function (i) {
          startBowRaw(i, amp);
        });
        setTimeout(function () {
          indices.forEach(function (i) {
            stopBow(i, 0.35);
          });
        }, durMs);
      },
      silence: function () {
        silenceAll(0.05);
      },
    };

    return {
      api: api,
      teardown: function teardown() {
        cancelAnimationFrame(raf1);
        hit.removeEventListener("pointerdown", onDown);
        hit.removeEventListener("pointermove", onMove);
        hit.removeEventListener("pointerup", onUp);
        hit.removeEventListener("pointercancel", onUp);
        hit.removeEventListener("pointerleave", onUp);
        window.removeEventListener("keydown", onWindowKeydown);
        silenceAll(0.05);
      },
    };
  }

  window.StrungInstruments.push({ id: "violin", label: "Violin", render: render, mount: mount });
})();
`;

const out = template.replace("__VIOLIN_ART__", () => inner);
const outPath = path.join(__dirname, "..", "js", "instruments", "violin.js");
fs.writeFileSync(outPath, out, "utf8");
console.log("wrote", outPath, "art length", inner.length);
