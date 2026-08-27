/* ================= Keyboard instrument module =================
   Two octaves, C3-B4. The one instrument in the slider where "how long
   you hold" is the actual expressive gesture -- press and hold a key to
   sustain it for as long as you like, release to let it go, same as a
   real piano. Just gliding your pointer across the keys without pressing
   still plays a quick tap per key (matching the rest of the slider's
   "hover to play" feel), but only an actual press sustains.

   The reference SVG here is a 650-line photorealistic render; a keyboard's
   geometry is simple and exact by construction (equal white keys, black
   keys at fixed offsets), so it's computed directly rather than traced.
*/
(function () {
  "use strict";

  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11]; // semitone offsets of C D E F G A B within an octave
  var HAS_SHARP = { 0: true, 2: true, 5: true, 7: true, 9: true }; // C D F G A each have a sharp after them

  var OCTAVES = [3, 4];
  var WHITE_W = 70,
    WHITE_H = 280,
    BLACK_W = 42,
    BLACK_H = 172;
  var TOTAL_WHITE = OCTAVES.length * 7;
  var VB_W = TOTAL_WHITE * WHITE_W;
  var VB_H = WHITE_H + 20;

  function noteFreq(semitoneFromA4) {
    return 440 * Math.pow(2, semitoneFromA4 / 12);
  }
  function semitoneFromA4(octave, stepIndexInOctave) {
    // stepIndexInOctave: 0..11 chromatic index within the octave (0=C)
    return (octave - 4) * 12 + stepIndexInOctave - 9; // A is index 9 from C
  }

  var WHITE_KEYS = [];
  var BLACK_KEYS = [];
  OCTAVES.forEach(function (oct, octIdx) {
    WHITE_STEPS.forEach(function (step, i) {
      var whiteIndex = octIdx * 7 + i;
      var freq = noteFreq(semitoneFromA4(oct, step));
      WHITE_KEYS.push({
        note: NOTE_NAMES[step] + oct,
        freq: freq,
        x: whiteIndex * WHITE_W,
        w: WHITE_W,
        whiteIndex: whiteIndex,
      });
      if (HAS_SHARP[step]) {
        var freqSharp = noteFreq(semitoneFromA4(oct, step + 1));
        var cx = (whiteIndex + 1) * WHITE_W;
        BLACK_KEYS.push({
          note: NOTE_NAMES[step + 1] + oct,
          freq: freqSharp,
          x: cx - BLACK_W / 2,
          w: BLACK_W,
          cx: cx,
        });
      }
    });
  });

  var ALL_KEYS = WHITE_KEYS.map(function (k, i) {
    return { type: "white", i: i, key: k };
  }).concat(
    BLACK_KEYS.map(function (k, i) {
      return { type: "black", i: i, key: k };
    })
  );

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function render(uid) {
    var whiteRects = WHITE_KEYS.map(function (k, i) {
      return (
        '<rect class="' +
        uid +
        'key sg-key sg-key--white" data-type="white" data-i="' +
        i +
        '" x="' +
        k.x +
        '" y="0" width="' +
        k.w +
        '" height="' +
        WHITE_H +
        '" rx="4"/>'
      );
    }).join("");
    var whiteSeparators = [];
    for (var s = 1; s < TOTAL_WHITE; s++) {
      whiteSeparators.push('<line x1="' + s * WHITE_W + '" y1="0" x2="' + s * WHITE_W + '" y2="' + WHITE_H + '" stroke="#d8cdb8" stroke-width="1"/>');
    }
    var blackRects = BLACK_KEYS.map(function (k, i) {
      return (
        '<rect class="' +
        uid +
        'key sg-key sg-key--black" data-type="black" data-i="' +
        i +
        '" x="' +
        k.x +
        '" y="0" width="' +
        k.w +
        '" height="' +
        BLACK_H +
        '" rx="3"/>'
      );
    }).join("");

    return (
      '<div class="sg-stage sg-no-swipe">' +
      '<div class="sg-watermark" aria-hidden="true">KEYBOARD</div>' +
      '<div class="' +
      uid +
      'shadow" aria-hidden="true"></div>' +
      '<div class="' +
      uid +
      'wrap sg-no-swipe sg-parallax-instrument">' +
      '<svg id="' +
      uid +
      'svg" viewBox="-14 -14 ' +
      (VB_W + 28) +
      " " +
      (VB_H + 28) +
      '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="-14" y="-14" width="' +
      (VB_W + 28) +
      '" height="' +
      (VB_H + 28) +
      '" rx="14" fill="#241407"/>' +
      '<rect x="-6" y="-6" width="' +
      (VB_W + 12) +
      '" height="' +
      (VB_H + 12) +
      '" rx="8" fill="#3a2312"/>' +
      '<g transform="translate(0,4)">' +
      whiteRects +
      blackRects +
      whiteSeparators.join("") +
      "</g>" +
      "</svg>" +
      "</div>" +
      '<div class="sg-copy" style="left:701px;top:565px">' +
      '<div class="sg-overline-row"><span class="sg-overline-label">Press and hold</span><span class="sg-rule"></span></div>' +
      '<p class="sg-headline">The only one you hold as long as you mean it</p>' +
      "</div>" +
      "</div>" +
      '<footer class="sg-footer sg-no-swipe">' +
      '<div class="sg-key-hint">' +
      '<span class="sg-key-item"><kbd class="sg-kbd" id="' +
      uid +
      'kbd-up">&#8593;</kbd> run up</span>' +
      '<span class="sg-key-item"><kbd class="sg-kbd" id="' +
      uid +
      'kbd-down">&#8595;</kbd> run down</span>' +
      '<span class="sg-key-item"><kbd class="sg-kbd">1</kbd>&#8211;<kbd class="sg-kbd">9</kbd><kbd class="sg-kbd">0</kbd> play a key</span>' +
      "</div>" +
      "</footer>" +
      "<style>" +
      "." +
      uid +
      "shadow{position:absolute;left:60px;top:560px;width:1160px;height:220px;z-index:2;background:radial-gradient(ellipse 55% 55% at 46% 30%, rgba(15,10,5,0.4), transparent 72%);filter:blur(48px);pointer-events:none;}" +
      "." +
      uid +
      "wrap{position:absolute;left:120px;top:210px;width:1040px;z-index:3;}" +
      "." +
      uid +
      "wrap svg{width:100%;height:auto;overflow:visible;display:block;}" +
      "." +
      uid +
      "key{cursor:pointer;touch-action:none;transition:transform .06s ease, fill .06s ease;}" +
      ".sg-key--white{fill:#fffaf2;stroke:#c9b48f;stroke-width:1.5;transform-box:fill-box;transform-origin:50% 100%;}" +
      ".sg-key--white.sg-key--active{fill:#f2d9ae;transform:translateY(4px);}" +
      ".sg-key--black{fill:#1c120a;stroke:#000;stroke-width:1;transform-box:fill-box;transform-origin:50% 100%;}" +
      ".sg-key--black.sg-key--active{fill:#5c3d22;transform:translateY(4px);}" +
      "</style>"
    );
  }

  function mount(root) {
    var svg = root.querySelector("svg[id$='svg']");
    var kbdUp = root.querySelector("kbd[id$='kbd-up']");
    var kbdDown = root.querySelector("kbd[id$='kbd-down']");
    var Audio = window.StrungAudio;

    var whiteEls = Array.prototype.slice.call(root.querySelectorAll('rect[data-type="white"]'));
    var blackEls = Array.prototype.slice.call(root.querySelectorAll('rect[data-type="black"]'));

    function elFor(type, i) {
      return type === "white" ? whiteEls[i] : blackEls[i];
    }
    function dataFor(type, i) {
      return type === "white" ? WHITE_KEYS[i] : BLACK_KEYS[i];
    }

    var held = null; // { type, i, handle }

    function pointFromEvent(evt) {
      var pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm || ctm.a === 0) return null;
      return pt.matrixTransform(ctm.inverse());
    }

    // black keys are drawn on top and are narrower, so hit-test them first
    function keyAtPoint(p) {
      if (!p) return null;
      var localY = p.y - 4; // matches the <g transform="translate(0,4)">
      if (localY >= 0 && localY <= BLACK_H) {
        for (var i = 0; i < BLACK_KEYS.length; i++) {
          var bk = BLACK_KEYS[i];
          if (p.x >= bk.x && p.x <= bk.x + bk.w) return { type: "black", i: i };
        }
      }
      if (localY >= 0 && localY <= WHITE_H) {
        for (var j = 0; j < WHITE_KEYS.length; j++) {
          var wk = WHITE_KEYS[j];
          if (p.x >= wk.x && p.x <= wk.x + wk.w) return { type: "white", i: j };
        }
      }
      return null;
    }

    function spawnNote(type, i) {
      var k = dataFor(type, i);
      var el = elFor(type, i);
      var r = el.getBoundingClientRect();
      var noteEl = document.createElement("div");
      noteEl.className = "sg-note-float";
      var m = k.note.match(/^([A-G]#?)(\d)$/);
      noteEl.innerHTML = m ? m[1] + "<sub>" + m[2] + "</sub>" : k.note;
      noteEl.style.left = r.left + r.width / 2 + "px";
      noteEl.style.top = r.top + (type === "black" ? 40 : 200) + "px";
      document.body.appendChild(noteEl);
      setTimeout(function () {
        noteEl.remove();
      }, 1200);
    }

    function pressKey(type, i, sustained) {
      var k = dataFor(type, i);
      var el = elFor(type, i);
      el.classList.add("sg-key--active");
      spawnNote(type, i);
      var handle = Audio.playSustain({
        freq: k.freq,
        amp01: 0.75,
        gain: 0.22,
        attack: 0.012,
        voices: [
          { type: "triangle", detune: 0, gain: 0.75 },
          { type: "sine", detune: 0, gain: 0.5 },
          { type: "sine", detune: 1200, gain: 0.12 },
        ],
        pan: clamp((k.x != null ? k.x : k.cx) / VB_W - 0.5, -0.7, 0.7) * 1.2,
      });
      if (!sustained) {
        setTimeout(function () {
          handle.stop(0.35);
          el.classList.remove("sg-key--active");
        }, 170);
        return null;
      }
      return { type: type, i: i, handle: handle, el: el };
    }

    function releaseHeld() {
      if (!held) return;
      held.handle.stop(0.3);
      held.el.classList.remove("sg-key--active");
      held = null;
    }

    // preset playback: a self-contained press/release path that never
    // touches `held` -- that variable belongs to the user's own drag/hold
    // gesture, and a preset note ending shouldn't be able to release a key
    // the user is genuinely still holding down (or vice versa).
    var presetHeld = {};
    function presetPress(type, i, amp01, durMs) {
      var key = type + i;
      var existing = presetHeld[key];
      if (existing) {
        clearTimeout(existing.timer);
        existing.handle.stop(0.05);
      }
      var k = dataFor(type, i);
      var el = elFor(type, i);
      el.classList.add("sg-key--active");
      spawnNote(type, i);
      var handle = Audio.playSustain({
        freq: k.freq,
        amp01: amp01,
        gain: 0.22,
        attack: 0.012,
        voices: [
          { type: "triangle", detune: 0, gain: 0.75 },
          { type: "sine", detune: 0, gain: 0.5 },
          { type: "sine", detune: 1200, gain: 0.12 },
        ],
        pan: clamp((k.x != null ? k.x : k.cx) / VB_W - 0.5, -0.7, 0.7) * 1.2,
      });
      var timer = setTimeout(function () {
        handle.stop(0.3);
        el.classList.remove("sg-key--active");
        delete presetHeld[key];
      }, durMs);
      presetHeld[key] = { handle: handle, el: el, timer: timer };
    }
    function presetSilence() {
      Object.keys(presetHeld).forEach(function (key) {
        var p = presetHeld[key];
        clearTimeout(p.timer);
        p.handle.stop(0.05);
        p.el.classList.remove("sg-key--active");
      });
      presetHeld = {};
    }

    var lastHoverKey = null;
    var lastHoverTime = {};

    function onDown(evt) {
      Audio.wake();
      try {
        svg.setPointerCapture(evt.pointerId);
      } catch (_e) {}
      var p = pointFromEvent(evt);
      var k = keyAtPoint(p);
      if (!k) return;
      releaseHeld();
      held = pressKey(k.type, k.i, true);
      lastHoverKey = k;
    }

    function onMove(evt) {
      var p = pointFromEvent(evt);
      var k = keyAtPoint(p);
      if (evt.buttons === 1 && held) {
        if (k && (k.type !== held.type || k.i !== held.i)) {
          releaseHeld();
          held = pressKey(k.type, k.i, true);
        }
        lastHoverKey = k;
        return;
      }
      // plain hover glide: quick taps as the pointer brushes across keys
      if (!k) {
        lastHoverKey = null;
        return;
      }
      var sameAsLast = lastHoverKey && lastHoverKey.type === k.type && lastHoverKey.i === k.i;
      if (!sameAsLast) {
        var keyId = k.type + k.i;
        var now = performance.now();
        if (!lastHoverTime[keyId] || now - lastHoverTime[keyId] > 90) {
          pressKey(k.type, k.i, false);
          lastHoverTime[keyId] = now;
        }
        lastHoverKey = k;
      }
    }

    function onUp() {
      releaseHeld();
    }
    function onLeave(evt) {
      if (evt.buttons === 0) {
        lastHoverKey = null;
      } else {
        releaseHeld();
      }
    }

    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.addEventListener("pointerleave", onLeave);

    function pulseKbd(el) {
      if (!el) return;
      el.classList.remove("sg-kbd--pressed");
      void el.offsetWidth;
      el.classList.add("sg-kbd--pressed");
      setTimeout(function () {
        el.classList.remove("sg-kbd--pressed");
      }, 160);
    }
    // 14 white keys at 65ms apart, each tap ringing ~170ms plus a 350ms
    // release tail -- retriggering mid-run overlaps runs and cuts the
    // sound, so arrow keys are ignored until the current run (including its
    // last key's release) has fully finished.
    var RUN_LOCK_MS = 13 * 65 + 170 + 350 + 100;
    var runLocked = false;
    function runKeys(direction) {
      if (runLocked) return;
      runLocked = true;
      var order = ALL_KEYS.filter(function (k) {
        return k.type === "white";
      });
      if (direction === "D") order = order.slice().reverse();
      order.forEach(function (k, idx) {
        setTimeout(function () {
          pressKey(k.type, k.i, false);
        }, idx * 65);
      });
      setTimeout(function () {
        runLocked = false;
      }, RUN_LOCK_MS);
    }
    function onWindowKeydown(e) {
      var n = parseInt(e.key, 10);
      // digits only reach the first 10 white keys (1-9 then 0) -- a real
      // number row tops out at ten keys, so that's the honest range here.
      if (e.key === "0" || (n >= 1 && n <= 9)) {
        var idx = e.key === "0" ? 9 : n - 1;
        if (idx < WHITE_KEYS.length) {
          Audio.wake();
          pressKey("white", idx, false);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (runLocked) return;
        Audio.wake();
        pulseKbd(kbdDown);
        runKeys("D");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (runLocked) return;
        Audio.wake();
        pulseKbd(kbdUp);
        runKeys("U");
      }
    }
    window.addEventListener("keydown", onWindowKeydown);

    var api = {
      press: function (type, i, amp01, durMs) {
        presetPress(type, i, amp01, durMs);
      },
      silence: function () {
        presetSilence();
      },
    };

    return {
      api: api,
      teardown: function teardown() {
        releaseHeld();
        presetSilence();
        svg.removeEventListener("pointerdown", onDown);
        svg.removeEventListener("pointermove", onMove);
        svg.removeEventListener("pointerup", onUp);
        svg.removeEventListener("pointercancel", onUp);
        svg.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("keydown", onWindowKeydown);
      },
    };
  }

  window.StrungInstruments.push({ id: "keyboard", label: "Keyboard", render: render, mount: mount });
})();
