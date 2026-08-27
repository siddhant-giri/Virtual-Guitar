/* ================= Xylophone instrument module =================
   8 struck bars, C major scale (C4-C5) left to right. Completely different
   interaction model from a string: there's no "hold and bend" here, just a
   strike -- click a bar, or glide across several for a glissando run, and
   each bar visually bounces on its own mount point instead of wobbling
   like a string. Audio is a short mallet-strike synth (sine + upper
   partial + a touch of noise), not Karplus-Strong.
*/
(function () {
  "use strict";

  var BARS = [
    { note: "C4", freq: 261.63, cx: 72.65, x0: 40.7, x1: 104.6, top: 266.97 },
    { note: "D4", freq: 293.66, cx: 155.5, x0: 123.6, x1: 187.4, top: 246.19 },
    { note: "E4", freq: 329.63, cx: 238.35, x0: 206.4, x1: 270.3, top: 223.33 },
    { note: "F4", freq: 349.23, cx: 321.2, x0: 289.3, x1: 353.1, top: 198.19 },
    { note: "G4", freq: 392.0, cx: 404.0, x0: 372.1, x1: 435.9, top: 170.53 },
    { note: "A4", freq: 440.0, cx: 486.9, x0: 455.0, x1: 518.8, top: 140.11 },
    { note: "B4", freq: 493.88, cx: 569.7, x0: 537.8, x1: 601.6, top: 106.65 },
    { note: "C5", freq: 523.25, cx: 652.55, x0: 620.6, x1: 684.5, top: 69.84 },
  ];
  var BOTTOM = 474.75;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function barPaths(uid, i, blackD, gradD, paintId) {
    return (
      '<g class="' +
      uid +
      "bar sg-xylo-bar\" data-i=\"" +
      i +
      '">' +
      '<path d="' +
      blackD +
      '" fill="black" stroke="black" stroke-width="1.35805"/>' +
      '<path d="' +
      gradD +
      '" fill="url(#' +
      uid +
      paintId +
      '"/>' +
      "</g>"
    );
  }

  function render(uid) {
    var bars =
      barPaths(
        uid,
        0,
        "M104.57 474.746C86.9443 492.372 58.3683 492.372 40.7422 474.746V266.965C58.3683 249.339 86.9443 249.339 104.57 266.965V474.746Z",
        "M102.975 469.544C86.23 486.289 59.0826 486.289 42.3379 469.544V272.152C59.0826 255.408 86.23 255.408 102.975 272.152V469.544Z",
        "paint0)"
      ) +
      barPaths(
        uid,
        1,
        "M187.41 474.747C169.784 492.373 141.208 492.373 123.582 474.747V246.187C141.208 228.561 169.784 228.561 187.41 246.187V474.747Z",
        "M185.809 469.028C169.064 485.773 141.917 485.773 125.172 469.028V251.903C141.917 235.159 169.064 235.159 185.809 251.903V469.028Z",
        "paint1)"
      ) +
      barPaths(
        uid,
        2,
        "M270.252 474.746C252.626 492.372 224.05 492.372 206.424 474.746V223.331C224.05 205.705 252.626 205.705 270.252 223.331V474.746Z",
        "M268.649 468.458C251.904 485.203 224.756 485.203 208.012 468.458V229.618C224.756 212.873 251.904 212.873 268.649 229.618V468.458Z",
        "paint2)"
      ) +
      barPaths(
        uid,
        3,
        "M353.092 474.747C335.466 492.373 306.89 492.373 289.264 474.747V198.194C306.89 180.568 335.466 180.568 353.092 198.194V474.747Z",
        "M351.49 467.833C334.746 484.578 307.598 484.578 290.854 467.833V205.105C307.598 188.361 334.746 188.361 351.49 205.105V467.833Z",
        "paint3)"
      ) +
      barPaths(
        uid,
        4,
        "M435.934 474.746C418.308 492.372 389.732 492.372 372.105 474.746V170.53C389.732 152.904 418.308 152.904 435.934 170.53V474.746Z",
        "M434.33 467.142C417.585 483.886 390.438 483.886 373.693 467.142V178.136C390.438 161.391 417.585 161.391 434.33 178.136V467.142Z",
        "paint4)"
      ) +
      barPaths(
        uid,
        5,
        "M518.774 474.746C501.147 492.372 472.571 492.372 454.945 474.746V140.109C472.571 122.483 501.147 122.483 518.774 140.109V474.746Z",
        "M517.172 466.38C500.427 483.125 473.28 483.125 456.535 466.38V148.475C473.28 131.73 500.427 131.73 517.172 148.475V466.38Z",
        "paint5)"
      ) +
      barPaths(
        uid,
        6,
        "M601.615 474.746C583.989 492.372 555.413 492.372 537.787 474.746V106.647C555.413 89.0212 583.989 89.0212 601.615 106.647V474.746Z",
        "M600.012 465.539C583.267 482.284 556.12 482.284 539.375 465.539V115.842C556.12 99.097 583.267 99.097 600.012 115.842V465.539Z",
        "paint6)"
      ) +
      barPaths(
        uid,
        7,
        "M684.455 474.745C666.829 492.371 638.253 492.371 620.627 474.745V69.8436C638.253 52.2175 666.829 52.2175 684.455 69.8436V474.745Z",
        "M682.854 464.614C666.109 481.359 638.962 481.359 622.217 464.614V79.9472C638.962 63.2025 666.109 63.2025 682.854 79.9472V464.614Z",
        "paint7)"
      );

    var dots =
      "";
    var dotPositions = [
      [71.3, 293.5],
      [70.96, 449.0],
      [151.1, 273.3],
      [154.1, 444.2],
      [237.0, 250.7],
      [235.6, 441.4],
      [318.1, 228.2],
      [320.8, 435.1],
      [402.0, 206.4],
      [403.7, 430.7],
      [485.6, 182.5],
      [486.5, 427.4],
      [569.7, 159.6],
      [568.0, 423.2],
      [653.6, 137.2],
      [652.0, 417.4],
    ];
    dotPositions.forEach(function (p, idx) {
      var pid = "dot" + idx;
      dots +=
        '<circle cx="' +
        p[0] +
        '" cy="' +
        p[1] +
        '" r="7.1" fill="black" stroke="black" stroke-width="1.35805"/>' +
        '<circle cx="' +
        p[0] +
        '" cy="' +
        p[1] +
        '" r="5.7" fill="url(#' +
        uid +
        pid +
        ')"/>';
    });

    var dotDefs = dotPositions
      .map(function (p, idx) {
        return (
          '<radialGradient id="' +
          uid +
          "dot" +
          idx +
          '" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(' +
          p[0] +
          " " +
          p[1] +
          ') scale(11.2093 11.2093)">' +
          '<stop offset="0.0944" stop-color="white"/><stop offset="0.2968" stop-color="#CFCFCF"/><stop offset="0.4333" stop-color="#B3B3B3"/><stop offset="0.5802" stop-color="#787878"/><stop offset="0.7111" stop-color="#474747"/><stop offset="0.7962" stop-color="#3E3E3E"/><stop offset="0.9369" stop-color="#252525"/><stop offset="1" stop-color="#171717"/>' +
          "</radialGradient>"
        );
      })
      .join("");

    var barGradients = [
      ["paint0", ["0.0038", "#0D3896"], ["0.15", "#2B8CBE"], ["0.3", "#0D3896"], ["0.7", "#0D3896"], ["0.8511", "#2B8CBE"], ["1", "#0D3896"]],
      ["paint1", ["0.0038", "#FD281D"], ["0.15", "#FB6759"], ["0.3", "#FD281D"], ["0.7", "#FD281D"], ["0.85", "#FB6759"], ["1", "#FD281D"]],
      ["paint2", ["0.0038", "#FE6612"], ["0.15", "#FE9929"], ["0.3", "#FD6724"], ["0.7", "#FD6724"], ["0.8511", "#FE9929"], ["1", "#FE6612"]],
      ["paint3", ["0.0038", "#8C1888"], ["0.15", "#D13397"], ["0.3", "#8C1888"], ["0.7", "#8C174C"], ["0.8511", "#D13397"], ["1", "#8C1888"]],
      ["paint4", ["0.0038", "#FFFF00"], ["0.15", "#FFFFB3"], ["0.3", "#FFFF00"], ["0.7", "#FFFF00"], ["0.8511", "#FFFFB3"], ["1", "#FFFF00"]],
      ["paint5", ["0.0038", "#33A44D"], ["0.15", "#99D594"], ["0.3053", "#33A02C"], ["0.7023", "#33A44D"], ["0.8511", "#99D594"], ["1", "#33A44D"]],
      ["paint6", ["0.0038", "#0D3896"], ["0.15", "#2B8CBE"], ["0.3", "#0D3896"], ["0.7", "#0D3896"], ["0.8511", "#2B8CBE"], ["1", "#0D3896"]],
      ["paint7", ["0.0038", "#FD281D"], ["0.15", "#FB6759"], ["0.3", "#FD281D"], ["0.7", "#FD281D"], ["0.85", "#FB6759"], ["1", "#FD281D"]],
    ];
    var barGradDefs = BARS.map(function (b, i) {
      var g = barGradients[i];
      var stops = g
        .slice(1)
        .map(function (s) {
          return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>';
        })
        .join("");
      return (
        '<linearGradient id="' +
        uid +
        g[0] +
        '" x1="0" y1="' +
        (BOTTOM + 7.3) +
        '" x2="0" y2="' +
        (b.top - 7.4) +
        '" gradientUnits="userSpaceOnUse">' +
        stops +
        "</linearGradient>"
      );
    }).join("");

    return (
      '<div class="sg-stage sg-no-swipe">' +
      '<div class="sg-watermark" aria-hidden="true">XYLOPHONE</div>' +
      '<div class="' +
      uid +
      'shadow" aria-hidden="true"></div>' +
      '<div class="' +
      uid +
      'wrap sg-no-swipe sg-parallax-instrument">' +
      '<svg id="' +
      uid +
      'svg" viewBox="0 0 751 541" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M716.249 499.083C716.231 502.071 713.773 504.515 710.785 504.515H16.3072C13.3195 504.515 10.875 502.071 10.875 499.083V243.974C10.875 240.986 13.2013 237.789 16.0437 236.87L713.93 11.1762C716.773 10.2568 719.084 11.949 719.067 14.9367L716.255 499.08L716.249 499.083Z" fill="black" stroke="black" stroke-width="1.35805"/>' +
      '<path d="M712.976 496.216C712.959 499.204 710.501 501.648 707.513 501.648H19.5943C16.6066 501.648 14.1621 499.204 14.1621 496.216V244.923C14.1621 241.935 16.4884 238.743 19.3336 237.827L710.634 15.4064C713.478 14.4911 715.79 16.1873 715.773 19.175L712.989 496.23L712.976 496.216Z" fill="#8B8B8B" stroke="black" stroke-width="1.35805"/>' +
      '<path d="M695.333 129.694C696.106 132.58 694.378 135.574 691.492 136.347L34.8414 312.294C31.9556 313.067 28.9611 311.34 28.1883 308.454L27.0163 304.08C26.2436 301.194 27.9724 298.201 30.8583 297.428L687.507 121.479C690.392 120.707 693.386 122.435 694.158 125.321L695.333 129.694Z" fill="black" stroke="black" stroke-width="1.35805"/>' +
      '<path d="M699.955 417.803C700.111 420.785 697.798 423.354 694.816 423.511L31.1887 458.29C28.2051 458.446 25.6357 456.132 25.4795 453.15L25.2418 448.628C25.0857 445.645 27.3984 443.076 30.3834 442.92L694.009 408.14C696.992 407.984 699.562 410.298 699.719 413.28L699.955 417.803Z" fill="black" stroke="black" stroke-width="1.35805"/>' +
      "<defs>" +
      barGradDefs +
      dotDefs +
      "</defs>" +
      bars +
      dots +
      '<rect id="' +
      uid +
      'hit-layer" x="10" y="52" width="710" height="452" fill="transparent"/>' +
      "</svg>" +
      "</div>" +
      '<div class="sg-copy" style="left:701px;top:600px">' +
      '<div class="sg-overline-row"><span class="sg-overline-label">Run the mallets</span><span class="sg-rule"></span></div>' +
      '<p class="sg-headline">Eight bars, one bright scale</p>' +
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
      '<span class="sg-key-item"><kbd class="sg-kbd">1</kbd>&#8211;<kbd class="sg-kbd">8</kbd> play a bar</span>' +
      "</div>" +
      "</footer>" +
      "<style>" +
      "." +
      uid +
      "shadow{position:absolute;left:20px;top:597px;width:1200px;height:220px;z-index:2;background:radial-gradient(ellipse 55% 55% at 46% 30%, rgba(20,15,10,0.36), transparent 72%);filter:blur(46px);pointer-events:none;}" +
      "." +
      uid +
      "wrap{position:absolute;left:340px;top:150px;width:600px;z-index:3;}" +
      "." +
      uid +
      "wrap svg{width:100%;height:auto;overflow:visible;display:block;}" +
      "#" +
      uid +
      'hit-layer{cursor:url("assets/cursor-stick.svg") 113 10, pointer;touch-action:none;}' +
      "." +
      uid +
      "bar{transition:transform .12s cubic-bezier(.2,.8,.3,1.4);transform-box:fill-box;transform-origin:50% 100%;}" +
      "." +
      uid +
      "bar.sg-xylo-bar--hit{transform:translateY(4px) scaleY(.97);}" +
      "</style>"
    );
  }

  function mount(root) {
    var svg = root.querySelector("svg[id$='svg']");
    var hit = root.querySelector("rect[id$='hit-layer']");
    var barEls = Array.prototype.slice.call(root.querySelectorAll(".sg-xylo-bar"));
    var kbdUp = root.querySelector("kbd[id$='kbd-up']");
    var kbdDown = root.querySelector("kbd[id$='kbd-down']");
    var Audio = window.StrungAudio;

    function svgPoint(evt) {
      var pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm || ctm.a === 0) return null;
      return pt.matrixTransform(ctm.inverse());
    }

    function barAt(x) {
      for (var i = 0; i < BARS.length; i++) {
        if (x >= BARS[i].x0 && x <= BARS[i].x1) return i;
      }
      // outside a gap between bars: snap to nearest
      var best = -1,
        bestD = 1e9;
      for (var j = 0; j < BARS.length; j++) {
        var d = Math.abs(x - BARS[j].cx);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      return bestD < 30 ? best : -1;
    }

    function strike(i, amp01) {
      var b = BARS[i];
      Audio.playStrike({
        freq: b.freq,
        amp01: clamp(amp01, 0.3, 1),
        decay: 1.3,
        pan: (i - 3.5) / 4.5,
      });
      var el = barEls[i];
      el.classList.remove("sg-xylo-bar--hit");
      void el.getBoundingClientRect();
      el.classList.add("sg-xylo-bar--hit");
      setTimeout(function () {
        el.classList.remove("sg-xylo-bar--hit");
      }, 150);
      spawnNote(i);
    }

    function spawnNote(i) {
      var b = BARS[i];
      var pt = svg.createSVGPoint();
      pt.x = b.cx;
      pt.y = b.top;
      var sp = pt.matrixTransform(svg.getScreenCTM());
      var el = document.createElement("div");
      el.className = "sg-note-float";
      el.innerHTML = b.note[0] + "<sub>" + b.note[1] + "</sub>";
      el.style.left = sp.x + "px";
      el.style.top = sp.y - 20 + "px";
      document.body.appendChild(el);
      setTimeout(function () {
        el.remove();
      }, 1200);
    }

    var lastPointer = null,
      lastBar = null,
      lastHit = {};

    function onDown(evt) {
      Audio.wake();
      try {
        hit.setPointerCapture(evt.pointerId);
      } catch (_e) {}
      var p = svgPoint(evt);
      if (!p) return;
      lastPointer = p;
      lastBar = barAt(p.x);
      lastHit = {};
      if (lastBar !== -1) strike(lastBar, 0.9);
    }
    function onMove(evt) {
      var p = svgPoint(evt);
      if (!p) return;
      if (lastPointer === null) {
        lastPointer = p;
        lastBar = barAt(p.x);
        return;
      }
      var curBar = barAt(p.x);
      var now = performance.now();
      if (curBar !== -1 && curBar !== lastBar) {
        var speed = Math.hypot(p.x - lastPointer.x, p.y - lastPointer.y);
        if (!lastHit[curBar] || now - lastHit[curBar] > 90) {
          strike(curBar, clamp(speed / 40, 0.4, 1));
          lastHit[curBar] = now;
        }
      }
      lastBar = curBar === -1 ? lastBar : curBar;
      lastPointer = p;
    }
    function onUp() {
      lastPointer = null;
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
    // a run takes ~490ms to trigger all 8 bars plus each strike's own ~1.3s
    // decay -- retriggering mid-run overlaps runs and muddies/cuts the
    // sound, so arrow keys are ignored until the current run (including its
    // tail decay) has fully finished.
    var RUN_LOCK_MS = 7 * 70 + 1300 + 100;
    var runLocked = false;
    function runScale(direction) {
      if (runLocked) return;
      runLocked = true;
      var order = direction === "D" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
      order.forEach(function (i, idx) {
        setTimeout(function () {
          strike(i, 0.85);
        }, idx * 70);
      });
      setTimeout(function () {
        runLocked = false;
      }, RUN_LOCK_MS);
    }
    function onWindowKeydown(e) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= BARS.length) {
        Audio.wake();
        strike(n - 1, 0.9);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (runLocked) return;
        Audio.wake();
        pulseKbd(kbdDown);
        runScale("D");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (runLocked) return;
        Audio.wake();
        pulseKbd(kbdUp);
        runScale("U");
      }
    }
    window.addEventListener("keydown", onWindowKeydown);

    // preset playback api -- a mallet strike decays on its own, nothing to cut off
    var api = {
      strike: function (i, amp) {
        strike(i, amp);
      },
      silence: function () {},
    };

    return {
      api: api,
      teardown: function teardown() {
        hit.removeEventListener("pointerdown", onDown);
        hit.removeEventListener("pointermove", onMove);
        hit.removeEventListener("pointerup", onUp);
        hit.removeEventListener("pointercancel", onUp);
        hit.removeEventListener("pointerleave", onUp);
        window.removeEventListener("keydown", onWindowKeydown);
      },
    };
  }

  window.StrungInstruments.push({ id: "xylophone", label: "Xylophone", render: render, mount: mount });
})();
