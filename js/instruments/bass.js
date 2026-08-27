/* ================= Bass instrument module =================
   4 strings (E1 A1 D2 G2), plucked like the guitar but with a longer,
   warmer decay. Same tuning as a guitar's bottom four strings, so each
   chord below is that same chord's real fretting with the top two guitar
   strings dropped -- not a full chord shape (a bass still mostly plays
   roots/walking lines), but real notes from the actual voicing rather
   than an arbitrary pattern. Order is reversed from guitar's low-to-high
   array since STRINGS here goes G (top/thinnest) to E (bottom/thickest).
   String endpoints below are read directly off the provided bass.svg path
   data (the four thin #555555 strokes running the length of the neck),
   not guessed -- nut end (~x=47) is where all four sit close together;
   bridge end fans out to x=664/698/727/761 same as the artwork.
*/
(function () {
  "use strict";

  var X0 = 47,
    X1 = 712;

  var STRINGS = [
    { note: "G2", freq: 98.0, y0: 95.3, y1: 109.16, w: 2.6, wound: false },
    { note: "D2", freq: 73.42, y0: 108.0, y1: 118.13, w: 3.1, wound: true },
    { note: "A1", freq: 55.0, y0: 121.41, y1: 126.05, w: 3.6, wound: true },
    { note: "E1", freq: 41.2, y0: 134.57, y1: 135.45, w: 4.1, wound: true },
  ];

  // [G, D, A, E] -- the same 8 shapes as the guitar chip row, sliced to
  // just the bottom 4 strings of that voicing.
  var CHORDS = [
    { name: "Open", frets: [0, 0, 0, 0] },
    { name: "E", frets: [1, 2, 2, 0] },
    { name: "A", frets: [2, 2, 0, null] },
    { name: "D", frets: [2, 0, null, null] },
    { name: "G", frets: [0, 0, 2, 3] },
    { name: "C", frets: [0, 2, 3, null] },
    { name: "F", frets: [2, 3, 3, 1] },
    { name: "B", frets: [4, 4, 2, null] },
  ];

  // lives outside mount() so the chosen chord survives switching away from
  // the Bass tab and back, matching the same fix on the guitar module.
  var currentChord = 0;

  // single-letter chord names (E, A, D, G, C, F, B) double as keyboard
  // shortcuts -- built once from CHORDS rather than hardcoded so it can't
  // drift out of sync with the chip row.
  var CHORD_KEYS = {};
  CHORDS.forEach(function (c, idx) {
    if (c.name.length === 1) CHORD_KEYS[c.name] = idx;
  });

  var STRING_TONE = [
    { decay: 0.998, damping: 0.32 },
    { decay: 0.9982, damping: 0.38 },
    { decay: 0.9984, damping: 0.42 },
    { decay: 0.9986, damping: 0.46 },
  ];

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
    return clamp((x - X0) / (X1 - X0), 0.03, 0.97);
  }
  function fretFreq(i, fret) {
    return STRINGS[i].freq * Math.pow(2, fret / 12);
  }

  function render(uid) {
    return (
      '<div class="sg-stage sg-no-swipe">' +
      '<div class="sg-watermark" aria-hidden="true">BASS</div>' +
      '<div class="' +
      uid +
      'shadow" aria-hidden="true"></div>' +
      '<div class="' +
      uid +
      'wrap sg-no-swipe sg-parallax-instrument">' +
      '<svg id="' +
      uid +
      'svg" viewBox="0 0 801 234" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<g clip-path="url(#' +
      uid +
      'clip)">' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M289.72 95.4367C285.429 89.7539 286.108 84.0712 289.11 78.3885C301.743 69.7286 319.741 72.463 334.831 68.0376C353.408 62.5897 352.538 47.5561 344.89 39.1152C325.173 17.3545 297.293 26.6253 273.26 26.3289C242.73 28.6452 221.612 51.6469 189.74 34.8531C167.965 23.3801 144.477 7.36528 120.75 2.42996C81.0665 -4.04164 43.5626 15.4404 23.3115 48.8561C8.80484 81.1587 3.29616 116.96 1.36496 159.061C-0.531282 200.397 14.7481 224.326 42.8205 230.298C58.0647 233.541 73.9466 232.53 96.4668 220.557C109.971 213.377 120.8 202.818 137.312 198.028C145.836 195.556 147.451 190.322 176.327 202.291C206.096 214.629 231.516 216.603 256.797 214.468C270.05 213.349 282.475 205.31 287.887 191.331C289.626 186.842 285.95 181.234 281.791 180.371C267.749 177.459 254.414 175.082 247.042 163.323C242.705 154.054 245.502 146.821 252.528 140.795L289.716 95.4342L289.72 95.4367Z" fill="#060C08" stroke="black" stroke-width="2.4125"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M52.8829 85.6719C55.8077 86.082 59.7145 84.039 59.589 92.0651V133.773C59.9347 138.903 58.3077 141.779 52.121 141.232H31.2414C23.8483 141.575 26.6012 136.233 25.9204 132.027V95.1095C25.7654 87.8227 28.0796 86.0839 31.1545 86.0549L52.8829 85.6719Z" fill="#7D827F" stroke="black" stroke-width="2.4125"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M114.464 148.093C106.265 158.413 91.2383 170.434 75.7527 181.275C64.9588 187.934 55.8829 195.327 50.7582 204.413C47.2014 214.079 52.0032 217.484 58.0738 219.939C70.1972 220.543 80.0429 214.323 90.6894 210.501C104.623 201.308 118.921 193.21 133.668 186.451C147.344 150.927 124.595 154.511 114.464 148.093Z" fill="#7F7F7F" stroke="black" stroke-width="2.4125"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M270.214 193.757C264.509 183.502 235.462 186.778 229.674 168.49C226.773 159.325 228.472 147.899 234.855 141.091C246.642 120.897 280.818 101.428 270.213 80.5078C264.28 68.8014 236.106 88.2668 220.528 84.7699C198.206 79.7584 177.844 62.3288 156.519 61.3284C143.285 60.7078 130.486 66.3269 128.171 87.2057C126.344 103.676 126.696 113.071 114.15 145.962L139.448 185.538C150.015 183.708 160.582 187.986 171.149 190.714C190.149 199.389 209.15 204.361 228.148 206.544C246.058 206.381 275.728 203.667 270.214 193.757Z" fill="white" stroke="#FCFCFC" stroke-width="0.4825"/>' +
      '<path d="M103.48 141.688V87.4984C103.48 86.4896 100.069 85.6719 95.8602 85.6719H95.8599C91.6513 85.6719 88.2397 86.4896 88.2397 87.4984V141.688C88.2397 142.696 91.6513 143.514 95.8599 143.514H95.8602C100.069 143.514 103.48 142.696 103.48 141.688Z" fill="#08110E" stroke="black" stroke-width="0.4825" stroke-linecap="round"/>' +
      '<path d="M163.227 141.688V87.4984C163.227 86.4896 159.815 85.6719 155.606 85.6719H155.606C151.397 85.6719 147.986 86.4896 147.986 87.4984V141.688C147.986 142.696 151.397 143.514 155.606 143.514H155.606C159.815 143.514 163.227 142.696 163.227 141.688Z" fill="#08110E" stroke="black" stroke-width="0.4825" stroke-linecap="round"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M675.163 84.7313L673.616 83.7608C673.616 83.7608 669.052 72.1629 674.202 69.1453C679.353 66.1277 691.893 67.4715 694.22 71.6902C696.547 75.9089 683.511 86.02 683.511 86.02L680.774 86.5817L678.707 92.6864L672.36 91.8794L675.163 84.7313Z" fill="#999999" stroke="black" stroke-width="2.63927"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M708.38 93.242L706.833 92.2716C706.833 92.2716 702.268 80.6737 707.419 77.6561C712.57 74.6385 725.11 75.9822 727.437 80.2009C729.764 84.4197 716.728 94.5307 716.728 94.5307L713.991 95.0925L711.924 101.197L705.577 100.39L708.38 93.242Z" fill="#999999" stroke="black" stroke-width="2.63927"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M742.515 101.175L740.968 100.204C740.968 100.204 736.403 88.6063 741.554 85.5887C746.705 82.5711 759.244 83.9148 761.571 88.1336C763.899 92.3523 750.863 102.463 750.863 102.463L748.126 103.025L746.059 109.13L739.712 108.323L742.515 101.175Z" fill="#999999" stroke="black" stroke-width="2.63927"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M772.375 109.179L770.975 108.007C770.975 108.007 768.034 95.8963 773.548 93.607C779.062 91.3178 791.302 94.3537 793.032 98.8495C794.763 103.345 780.47 111.59 780.47 111.59L777.682 111.775L774.803 117.541L768.625 115.879L772.375 109.179Z" fill="#999999" stroke="black" stroke-width="2.63927"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M642.405 110.336C647.968 102.291 650.432 88.9376 661.303 88.7216C694.37 88.0645 775.304 115.513 775.304 115.513C789.597 116.637 803.237 123.544 800.299 141.997C796.29 167.168 777.43 164.38 763.415 159.959C757.022 157.942 751.296 153.539 749.394 145.346C739.538 146.115 730.009 146.697 719.827 149.304C701.941 153.882 676.544 159.046 676.544 159.046C668.586 148.023 659.491 138.343 642.71 137.735L642.405 110.336Z" fill="#BFBFBF" stroke="black" stroke-width="2.4125"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M637.891 108.383L234.125 95.1104L234.339 139.268L637.091 139.838L637.914 108.384L637.891 108.383Z" fill="#BFBFBF" stroke="black" stroke-width="2.0265"/>' +
      '<path d="M664.18 108.167L640.566 112.526L46.4322 95.2988" stroke="#555555" stroke-width="1.05667"/>' +
      '<path d="M697.711 117.908L638.65 120.311L47.6063 108.003" stroke="#555555" stroke-width="1.05909"/>' +
      '<path d="M727.209 126.153L639.233 127.63L49.3481 121.408" stroke="#555555" stroke-width="1.05909"/>' +
      '<path d="M761.029 135.508L638.654 133.762L47.5861 134.574" stroke="#555555" stroke-width="1.05909"/>' +
      '<path d="M664.275 114.556C663.379 114.563 662.49 114.401 661.66 114.077C660.829 113.753 660.074 113.274 659.436 112.669C658.798 112.063 658.291 111.343 657.944 110.548C657.597 109.754 657.417 108.901 657.413 108.04C657.41 107.178 657.583 106.324 657.924 105.527C658.265 104.73 658.766 104.006 659.398 103.395C660.031 102.785 660.783 102.301 661.611 101.971C662.438 101.641 663.326 101.471 664.222 101.472C665.118 101.465 666.007 101.627 666.837 101.951C667.668 102.275 668.424 102.754 669.061 103.359C669.699 103.965 670.206 104.685 670.553 105.48C670.9 106.274 671.08 107.127 671.084 107.988C671.087 108.85 670.914 109.704 670.573 110.501C670.233 111.298 669.732 112.022 669.099 112.633C668.466 113.243 667.714 113.727 666.887 114.057C666.059 114.387 665.171 114.557 664.275 114.556Z" fill="#B3B3B3"/>' +
      '<path d="M697.203 123.38C696.307 123.388 695.418 123.225 694.588 122.901C693.757 122.577 693.001 122.099 692.364 121.493C691.726 120.888 691.219 120.167 690.872 119.373C690.525 118.578 690.344 117.726 690.341 116.864C690.337 116.002 690.511 115.148 690.852 114.351C691.192 113.554 691.693 112.83 692.326 112.22C692.959 111.609 693.711 111.125 694.538 110.795C695.366 110.465 696.253 110.296 697.15 110.296C698.046 110.289 698.935 110.452 699.765 110.776C700.596 111.099 701.351 111.578 701.989 112.183C702.626 112.789 703.133 113.51 703.481 114.304C703.828 115.098 704.008 115.951 704.012 116.813C704.015 117.674 703.842 118.528 703.501 119.325C703.16 120.122 702.659 120.847 702.027 121.457C701.394 122.067 700.642 122.551 699.814 122.881C698.986 123.211 698.099 123.381 697.203 123.38Z" fill="#B3B3B3"/>' +
      '<path d="M730.42 131.602C729.524 131.609 728.635 131.447 727.804 131.123C726.974 130.799 726.218 130.32 725.58 129.715C724.943 129.109 724.436 128.389 724.089 127.594C723.742 126.8 723.561 125.947 723.558 125.086C723.554 124.224 723.728 123.37 724.068 122.573C724.409 121.776 724.91 121.052 725.543 120.441C726.175 119.831 726.927 119.347 727.755 119.017C728.583 118.687 729.47 118.517 730.366 118.518C731.263 118.51 732.151 118.673 732.982 118.997C733.812 119.321 734.568 119.8 735.206 120.405C735.843 121.011 736.35 121.731 736.697 122.526C737.044 123.32 737.225 124.173 737.228 125.034C737.232 125.896 737.058 126.75 736.718 127.547C736.377 128.344 735.876 129.068 735.243 129.679C734.611 130.289 733.859 130.773 733.031 131.103C732.203 131.433 731.316 131.603 730.42 131.602Z" fill="#B3B3B3"/>' +
      '<path d="M764.263 138.907C763.367 138.914 762.478 138.751 761.648 138.427C760.818 138.103 760.062 137.625 759.424 137.02C758.787 136.414 758.28 135.693 757.933 134.899C757.585 134.105 757.405 133.252 757.401 132.39C757.398 131.529 757.571 130.675 757.912 129.878C758.253 129.081 758.754 128.356 759.387 127.746C760.019 127.136 760.771 126.652 761.599 126.322C762.427 125.991 763.314 125.822 764.21 125.823C765.106 125.815 765.995 125.978 766.826 126.302C767.656 126.626 768.412 127.104 769.049 127.71C769.687 128.315 770.194 129.036 770.541 129.83C770.888 130.625 771.069 131.477 771.072 132.339C771.076 133.201 770.902 134.055 770.562 134.852C770.221 135.649 769.72 136.373 769.087 136.983C768.454 137.594 767.703 138.078 766.875 138.408C766.047 138.738 765.16 138.907 764.263 138.907Z" fill="#B3B3B3"/>' +
      '<path d="M50.0902 136.365L47.1659 90.817C47.1012 89.8102 46.4228 89.0342 45.6507 89.0837C44.8785 89.1331 44.305 89.9893 44.3697 90.996L47.294 136.545C47.3586 137.551 48.0369 138.327 48.809 138.278C49.5812 138.228 50.1548 137.372 50.0902 136.365Z" fill="#9FA69E" stroke="black" stroke-width="0.4825" stroke-linecap="round"/>' +
      '<g id="' +
      uid +
      'live-strings"></g>' +
      '<rect id="' +
      uid +
      'hit-layer" x="40" y="88" width="640" height="52" fill="transparent"/>' +
      "</g>" +
      "<defs><clipPath id=\"" +
      uid +
      'clip"><rect width="233.1" height="800.89" fill="white" transform="matrix(0 1 -1 0 800.891 0)"/></clipPath></defs>' +
      "</svg>" +
      "</div>" +
      '<div class="sg-copy" style="top:560px">' +
      '<div class="sg-overline-row"><span class="sg-overline-label">Walk the bassline</span><span class="sg-rule"></span></div>' +
      '<p class="sg-headline">Four strings holding the whole room down</p>' +
      "</div>" +
      "</div>" +
      '<footer class="sg-footer sg-footer--stacked sg-no-swipe">' +
      '<div class="sg-chip-row" id="' +
      uid +
      'chord-row"></div>' +
      '<div class="sg-key-hint">' +
      '<span class="sg-key-item"><kbd class="sg-kbd" id="' +
      uid +
      'kbd-up">&#8593;</kbd> strum up</span>' +
      '<span class="sg-key-item"><kbd class="sg-kbd" id="' +
      uid +
      'kbd-down">&#8595;</kbd> strum down</span>' +
      "</div>" +
      "</footer>" +
      "<style>" +
      "." +
      uid +
      "shadow{position:absolute;left:20px;top:345px;width:1240px;height:260px;z-index:2;background:radial-gradient(ellipse 55% 55% at 46% 40%, rgba(20,15,10,0.42), transparent 72%);filter:blur(48px);pointer-events:none;}" +
      "." +
      uid +
      "wrap{position:absolute;left:60px;top:255px;width:1160px;z-index:3;}" +
      "." +
      uid +
      "wrap svg{width:100%;height:auto;overflow:visible;display:block;}" +
      "#" +
      uid +
      'hit-layer{cursor:url("assets/cursor-pick.svg") 20 48, pointer;touch-action:none;}' +
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

    function chordFret(i) {
      return CHORDS[currentChord].frets[i];
    }

    liveG.innerHTML = "";
    var stringEls = STRINGS.map(function (s) {
      var glow = document.createElementNS(svg.namespaceURI, "path");
      glow.setAttribute("class", "sg-live-string");
      glow.setAttribute("stroke", "#3a3f3d");
      glow.setAttribute("stroke-width", s.w + 1.4);
      glow.setAttribute("opacity", "0");
      liveG.appendChild(glow);
      var main = document.createElementNS(svg.namespaceURI, "path");
      main.setAttribute("class", "sg-live-string");
      main.setAttribute("stroke", s.wound ? "#c9cdc9" : "#e7eae7");
      main.setAttribute("stroke-width", s.w);
      liveG.appendChild(main);
      return { glow: glow, main: main };
    });

    var VFREQ = [7.5, 8.4, 9.4, 10.6];
    var VDAMP = [0.85, 1.0, 1.15, 1.3];
    var MAXAMP = 5.0;
    var activeStrings = {};
    var heldIndex = null,
      heldOffset = 0,
      heldU = 0.5;
    var lastPointer = null,
      lastCross = {},
      lastBand = null;

    function triggerString(i, amp, dir, freq) {
      amp = clamp(Math.abs(amp), 0.8, MAXAMP);
      activeStrings[i] = { t0: performance.now(), amp: amp, dir: dir || 1 };
      var s = STRINGS[i],
        tone = STRING_TONE[i];
      freq = freq || s.freq;
      Audio.playPluck({
        key: "bass_" + i + "_" + Math.round(freq * 10),
        freq: freq,
        decay: tone.decay,
        damping: tone.damping,
        amp01: amp / MAXAMP,
        pan: (i - 1.5) / 2.2,
        gain: 0.7,
        seconds: 3.2,
      });
      spawnNote(i);
    }

    function spawnNote(i) {
      var s = STRINGS[i];
      var pt = svg.createSVGPoint();
      pt.x = X0 + 20;
      pt.y = s.y0;
      var sp = pt.matrixTransform(svg.getScreenCTM());
      var el = document.createElement("div");
      el.className = "sg-note-float";
      el.innerHTML = s.note[0] + "<sub>" + s.note[1] + "</sub>";
      el.style.left = sp.x + "px";
      el.style.top = sp.y - 26 + "px";
      document.body.appendChild(el);
      setTimeout(function () {
        el.remove();
      }, 1200);
    }

    var raf1 = requestAnimationFrame(renderStrings);
    function renderStrings() {
      if (Stage.isGateActive()) {
        raf1 = requestAnimationFrame(renderStrings);
        return;
      }
      var now = performance.now(),
        N = 24;
      for (var i = 0; i < STRINGS.length; i++) {
        var st = activeStrings[i];
        var pts = [],
          ringing = false,
          env = 0,
          t = 0;
        if (st) {
          t = (now - st.t0) / 1000;
          env = st.amp * Math.exp(-VDAMP[i] * t);
          if (env > 0.03) ringing = true;
          else delete activeStrings[i];
        }
        for (var k = 0; k <= N; k++) {
          var u = k / N;
          var x = lerp(X0, X1, u),
            y = yAt(i, u),
            dy = 0;
          if (ringing) {
            var shape = Math.sin(Math.PI * u);
            var harmonic = 0.25 * Math.sin(2 * Math.PI * u) * Math.exp(-t * 2.0);
            dy = st.dir * env * (shape + harmonic) * Math.cos(2 * Math.PI * VFREQ[i] * t);
          } else if (heldIndex === i) {
            var peak = u <= heldU ? u / heldU : (1 - u) / (1 - heldU);
            dy = heldOffset * peak;
          }
          pts.push(x.toFixed(2) + "," + (y + dy).toFixed(2));
        }
        var d = "M" + pts.join(" L");
        stringEls[i].main.setAttribute("d", d);
        stringEls[i].glow.setAttribute("d", d);
        stringEls[i].glow.setAttribute("opacity", ringing ? clamp(env / MAXAMP, 0, 0.42).toFixed(2) : "0");
      }
      raf1 = requestAnimationFrame(renderStrings);
    }

    function svgPoint(evt) {
      var pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm || ctm.a === 0) return null;
      return pt.matrixTransform(ctm.inverse());
    }
    function nearestString(x, y) {
      var u = uFromX(x),
        best = -1,
        bestD = 1e9;
      for (var i = 0; i < STRINGS.length; i++) {
        var d = Math.abs(yAt(i, u) - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return { i: best, d: bestD, u: u };
    }
    function bandAt(y, u) {
      for (var i = 0; i < STRINGS.length; i++) {
        var lo = i === 0 ? -1e9 : (yAt(i - 1, u) + yAt(i, u)) / 2;
        var hi = i === STRINGS.length - 1 ? 1e9 : (yAt(i, u) + yAt(i + 1, u)) / 2;
        if (y >= lo && y < hi) return i;
      }
      return -1;
    }

    function onDown(evt) {
      Audio.wake();
      try {
        hit.setPointerCapture(evt.pointerId);
      } catch (_e) {}
      var p = svgPoint(evt);
      if (!p) return;
      var near = nearestString(p.x, p.y);
      lastPointer = p;
      lastCross = {};
      lastBand = bandAt(p.y, near.u);
      if (near.d < 2.2 && !activeStrings[near.i] && chordFret(near.i) !== null) {
        heldIndex = near.i;
        heldU = clamp(near.u, 0.12, 0.88);
        heldOffset = clamp(p.y - yAt(near.i, heldU), -6, 6);
      } else {
        heldIndex = null;
        heldOffset = 0;
      }
    }
    function onMove(evt) {
      Audio.wake();
      var p = svgPoint(evt);
      if (!p) return;
      if (lastPointer === null) {
        lastPointer = p;
        var u0 = uFromX(p.x);
        var band0 = bandAt(p.y, u0);
        lastBand = band0;
        if (band0 !== -1 && band0 !== heldIndex) {
          var fret0 = chordFret(band0);
          if (fret0 !== null) triggerString(band0, 1.8, 1, fretFreq(band0, fret0));
        }
        return;
      }
      if (heldIndex !== null) {
        heldU = clamp(uFromX(p.x), 0.12, 0.88);
        heldOffset = clamp(p.y - yAt(heldIndex, heldU), -6, 6);
      }
      var u = uFromX(p.x);
      var curBand = bandAt(p.y, u);
      var speed = Math.hypot(p.x - lastPointer.x, p.y - lastPointer.y);
      var amp = clamp(speed * 1.3, 1.4, MAXAMP);
      var now = performance.now();
      if (curBand !== -1 && lastBand !== null && lastBand !== -1 && curBand !== lastBand) {
        var dir = curBand > lastBand ? 1 : -1;
        for (var b = lastBand + dir; ; b += dir) {
          if (b === heldIndex) {
            if (b === curBand) break;
            else continue;
          }
          var fret = chordFret(b);
          if (fret !== null && (!lastCross[b] || now - lastCross[b] > 130)) {
            triggerString(b, amp, dir, fretFreq(b, fret));
            lastCross[b] = now;
          }
          if (b === curBand) break;
        }
      }
      lastBand = curBand === -1 ? lastBand : curBand;
      lastPointer = p;
    }
    function onUp() {
      if (heldIndex !== null) {
        var i = heldIndex;
        var freq = fretFreq(i, chordFret(i));
        if (Math.abs(heldOffset) > 0.6) triggerString(i, Math.abs(heldOffset) * 1.1, heldOffset > 0 ? -1 : 1, freq);
        else triggerString(i, 2.0, Math.random() < 0.5 ? 1 : -1, freq);
      }
      heldIndex = null;
      heldOffset = 0;
    }
    function onLeave(evt) {
      if (evt.buttons === 0) onUp();
      lastPointer = null;
      lastBand = null;
    }

    hit.addEventListener("pointerdown", onDown);
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerup", onUp);
    hit.addEventListener("pointercancel", onUp);
    hit.addEventListener("pointerleave", onLeave);

    function pulseKbd(el) {
      if (!el) return;
      el.classList.remove("sg-kbd--pressed");
      void el.offsetWidth;
      el.classList.add("sg-kbd--pressed");
      setTimeout(function () {
        el.classList.remove("sg-kbd--pressed");
      }, 160);
    }
    function sweepStrum(direction, velocity) {
      var order = direction === "D" ? [0, 1, 2, 3] : [3, 2, 1, 0];
      order.forEach(function (i, idx) {
        var fret = chordFret(i);
        if (fret === null) return;
        setTimeout(function () {
          var amp = velocity * (0.85 + Math.random() * 0.3);
          triggerString(i, amp, direction === "D" ? 1 : -1, fretFreq(i, fret));
        }, idx * 22);
      });
    }
    function onWindowKeydown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // don't hijack browser shortcuts (e.g. Ctrl+F)
      var letter = e.key.length === 1 ? e.key.toUpperCase() : "";
      if (CHORD_KEYS.hasOwnProperty(letter)) {
        e.preventDefault();
        selectChord(CHORD_KEYS[letter]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        Audio.wake();
        pulseKbd(kbdDown);
        sweepStrum("D", 3.0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        Audio.wake();
        pulseKbd(kbdUp);
        sweepStrum("U", 3.0);
      }
    }
    window.addEventListener("keydown", onWindowKeydown);

    function selectChord(idx) {
      Audio.wake();
      currentChord = idx;
      chordRow.querySelectorAll(".sg-chip").forEach(function (el, i) {
        el.classList.toggle("sg-chip--active", i === idx);
      });
    }

    chordRow.innerHTML = "";
    CHORDS.forEach(function (c, idx) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sg-chip" + (idx === currentChord ? " sg-chip--active" : "");
      b.textContent = c.name;
      b.addEventListener("click", function () {
        selectChord(idx);
      });
      chordRow.appendChild(b);
    });

    var warmed = false;
    function warm() {
      if (warmed) return;
      warmed = true;
      Audio.ensureAudio();
      STRINGS.forEach(function (s, i) {
        var tone = STRING_TONE[i];
        Audio.warmPluck("bass_" + i + "_" + Math.round(s.freq * 10), s.freq, tone.decay, tone.damping, 3.2);
      });
    }
    var idleHandle = window.requestIdleCallback
      ? { id: window.requestIdleCallback(warm, { timeout: 1500 }), kind: "idle" }
      : { id: setTimeout(warm, 300), kind: "timeout" };

    // preset playback api -- see guitar.js's api for why silence() is a no-op
    var api = {
      trigger: function (i, fret, amp) {
        triggerString(i, amp, 1, fretFreq(i, fret));
      },
      silence: function () {},
    };

    return {
      api: api,
      teardown: function teardown() {
        cancelAnimationFrame(raf1);
        hit.removeEventListener("pointerdown", onDown);
        hit.removeEventListener("pointermove", onMove);
        hit.removeEventListener("pointerup", onUp);
        hit.removeEventListener("pointercancel", onUp);
        hit.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("keydown", onWindowKeydown);
        if (idleHandle.kind === "idle" && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle.id);
        else clearTimeout(idleHandle.id);
      },
    };
  }

  window.StrungInstruments.push({ id: "bass", label: "Bass", render: render, mount: mount });
})();
