/* ================= Guitar instrument module =================
   6 plucked strings, hover-to-strum band-crossing, 11 chords, arrow-key
   full strum. This is the original single-instrument build, ported into
   the slider's { render, mount } plugin shape and reading/writing audio
   through the shared StrungAudio engine instead of owning its own
   AudioContext.
*/
(function () {
  "use strict";

  var X0 = 50.94,
    X1 = 145.03; // bridge -> nut, in the guitar SVG's raw path-number space

  var STRINGS = [
    { note: "E2", freq: 82.41, y0: 90.34, y1: 91.56, w: 0.52, wound: true },
    { note: "A2", freq: 110.0, y0: 91.9, y1: 92.59, w: 0.45, wound: true },
    { note: "D3", freq: 146.83, y0: 93.47, y1: 93.53, w: 0.38, wound: true },
    { note: "G3", freq: 196.0, y0: 95.02, y1: 94.64, w: 0.3, wound: false },
    { note: "B3", freq: 246.94, y0: 96.6, y1: 95.67, w: 0.25, wound: false },
    { note: "E4", freq: 329.63, y0: 98.16, y1: 96.69, w: 0.21, wound: false },
  ];

  // major chords only, plus the neutral open-string state
  var CHORDS = [
    { name: "Open", frets: [0, 0, 0, 0, 0, 0] },
    { name: "E", frets: [0, 2, 2, 1, 0, 0] },
    { name: "A", frets: [null, 0, 2, 2, 2, 0] },
    { name: "D", frets: [null, null, 0, 2, 3, 2] },
    { name: "G", frets: [3, 2, 0, 0, 0, 3] },
    { name: "C", frets: [null, 3, 2, 0, 1, 0] },
    { name: "F", frets: [1, 3, 3, 2, 1, 1] },
    { name: "B", frets: [null, 2, 4, 4, 4, 2] },
  ];

  // lives outside mount() so the chosen chord survives switching away from
  // the Guitar tab and back -- mount()/teardown() run every time the slide
  // (de)activates, but the selection itself shouldn't reset to Open each time.
  var currentChord = 0;

  // single-letter chord names (E, A, D, G, C, F, B) double as keyboard
  // shortcuts -- built once from CHORDS rather than hardcoded so it can't
  // drift out of sync with the chip row.
  var CHORD_KEYS = {};
  CHORDS.forEach(function (c, idx) {
    if (c.name.length === 1) CHORD_KEYS[c.name] = idx;
  });

  var STRING_TONE = [
    { decay: 0.9975, damping: 0.34 },
    { decay: 0.9975, damping: 0.3 },
    { decay: 0.9973, damping: 0.24 },
    { decay: 0.997, damping: 0.18 },
    { decay: 0.9968, damping: 0.14 },
    { decay: 0.9965, damping: 0.1 },
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
      '<div class="sg-watermark" aria-hidden="true">GUITAR</div>' +
      '<div class="' +
      uid +
      'shadow sg-guitar-shadow" aria-hidden="true"></div>' +
      '<div class="' +
      uid +
      'shadow-core sg-guitar-shadow-core" aria-hidden="true"></div>' +
      '<div class="' +
      uid +
      'guitar-wrap sg-guitar-wrap sg-no-swipe sg-parallax-instrument">' +
      '<svg id="' +
      uid +
      'svg" viewBox="12 56 154 68" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
      "<defs>" +
      '<linearGradient id="' +
      uid +
      'g"><stop stop-color="#949494" offset="0"/><stop stop-color="#d9d9d9" offset=".39231"/><stop stop-color="#c4c4c4" offset=".75361"/><stop stop-color="#a5a5a5" offset="1"/></linearGradient>' +
      '<linearGradient id="' +
      uid +
      'h"><stop stop-color="#cdcdcd" offset="0"/><stop stop-color="#adadad" offset=".58007"/><stop stop-color="#e7e7e7" offset="1"/></linearGradient>' +
      '<linearGradient id="' +
      uid +
      'a"><stop stop-color="#606060" offset="0"/><stop stop-color="#b8b8b8" offset="1"/></linearGradient>' +
      '<clipPath id="' +
      uid +
      'br"><path d="m165.5 88.562c-3.1917 0.20926-16.799 1.0125-17.656 1.0625-1.9828 0.70668-3.125 1.2188-3.125 1.2188l-64.75-1.1562-0.03125 4.4375 0.03125 4.4688 64.75-1.1875s1.1422 0.51207 3.125 1.2188c0.85754 0.04999 14.465 0.85324 17.656 1.0625 0.25068-0.09186 0.45747-0.31705 0.5625-0.5625-0.0165-1.3776 0-5 0-5s-0.0165-3.6224 0-5c-0.10503-0.24545-0.31182-0.47064-0.5625-0.5625z" fill="#dfdfdf"/></clipPath>' +
      '<radialGradient id="' +
      uid +
      'bp" cx="72.312" cy="94.103" r="8" gradientTransform="matrix(1 0 0 .98764 0 1.1636)" gradientUnits="userSpaceOnUse"><stop stop-color="#424242" offset="0"/><stop stop-color="#424242" offset=".47329"/><stop stop-color="#2c2c2c" offset=".62398"/><stop stop-color="#373737" offset="1"/></radialGradient>' +
      '<linearGradient id="' +
      uid +
      'o" x1="149.98" x2="150.99" y1="89.469" y2="89.469" gradientUnits="userSpaceOnUse" xlink:href="#' +
      uid +
      'h"/>' +
      '<linearGradient id="' +
      uid +
      'n" x1="149.22" x2="151.74" y1="87.932" y2="87.932" gradientUnits="userSpaceOnUse" xlink:href="#' +
      uid +
      'g"/>' +
      '<linearGradient id="' +
      uid +
      'm" x1="155.36" x2="156.37" y1="89.06" y2="89.06" gradientUnits="userSpaceOnUse" xlink:href="#' +
      uid +
      'h"/>' +
      '<linearGradient id="' +
      uid +
      'l" x1="154.6" x2="157.12" y1="87.523" y2="87.523" gradientUnits="userSpaceOnUse" xlink:href="#' +
      uid +
      'g"/>' +
      '<linearGradient id="' +
      uid +
      'k" x1="160.61" x2="161.63" y1="88.928" y2="88.928" gradientTransform="translate(0 -.13281)" gradientUnits="userSpaceOnUse" xlink:href="#' +
      uid +
      'h"/>' +
      '<linearGradient id="' +
      uid +
      'j" x1="159.86" x2="162.38" y1="87.391" y2="87.391" gradientTransform="translate(0 -.13281)" gradientUnits="userSpaceOnUse" xlink:href="#' +
      uid +
      'g"/>' +
      '<linearGradient id="' +
      uid +
      'bs" x1="55.154" x2="55.154" y1="124.49" y2="65.602" gradientUnits="userSpaceOnUse"><stop stop-color="#bf9c78" offset="0"/><stop stop-color="#f1c799" offset="1"/></linearGradient>' +
      '<linearGradient id="' +
      uid +
      'bt" x1="20.366" x2="95.031" y1="94.129" y2="94.129" gradientUnits="userSpaceOnUse"><stop stop-color="#b29270" offset="0"/><stop stop-color="#b29270" stop-opacity="0" offset="1"/></linearGradient>' +
      '<linearGradient id="' +
      uid +
      'bu" x1="61.817" x2="61.817" y1="125.6" y2="64.517" gradientUnits="userSpaceOnUse"><stop stop-color="#886f55" offset="0"/><stop stop-color="#d4af85" offset="1"/></linearGradient>' +
      '<linearGradient id="' +
      uid +
      'bv" x1="158.99" x2="158.99" y1="88.399" y2="100.21" gradientUnits="userSpaceOnUse"><stop stop-color="#776965" offset="0"/><stop stop-color="#5d524f" offset="1"/></linearGradient>' +
      '<linearGradient id="' +
      uid +
      'bw" x1="113.06" x2="113.06" y1="90.278" y2="97.989" gradientTransform="matrix(1.0082 0 0 1 -1.1844 0)" gradientUnits="userSpaceOnUse"><stop stop-color="#5b6768" offset="0"/><stop stop-color="#3e4647" offset="1"/></linearGradient>' +
      '<radialGradient id="' +
      uid +
      'e" cx="150.92" cy="90.943" r=".97227" gradientUnits="userSpaceOnUse"><stop stop-color="#9d9d9d" offset="0"/><stop stop-color="#d4d4d4" offset=".86364"/><stop stop-color="#d4d4d4" offset=".92614"/><stop stop-color="#8e8e8e" offset="1"/></radialGradient>' +
      '<linearGradient id="' +
      uid +
      'bn" x1="51.354" x2="51.354" y1="82.855" y2="105.35" gradientUnits="userSpaceOnUse"><stop stop-color="#464646" offset="0"/><stop stop-color="#727272" offset=".22839"/><stop stop-color="#5c5c5c" offset=".2532"/><stop stop-color="#464646" offset=".5"/><stop stop-color="#464646" offset=".75465"/><stop stop-color="#373737" offset=".77848"/><stop stop-color="#464646" offset="1"/></linearGradient>' +
      '<linearGradient id="' +
      uid +
      'bo" x1="48.262" x2="48.925" y1="96.202" y2="96.202" gradientUnits="userSpaceOnUse"><stop stop-color="#898989" offset="0"/><stop stop-color="#c2c2c2" offset=".5942"/><stop stop-color="#a4a4a4" offset="1"/></linearGradient>' +
      '<radialGradient id="' +
      uid +
      'b" cx="150.92" cy="90.943" r=".97227" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" offset="0"/><stop stop-color="#d0d0d0" offset=".75823"/><stop stop-color="#a6a6a6" offset="1"/></radialGradient>' +
      "</defs>" +
      '<g transform="translate(-4.5946 -5.5458)">' +
      '<path transform="matrix(1.6645 0 0 1.6645 -47.895 -61.934)" d="m80.312 94.103c0 4.4183-3.5817 8-8 8s-8-3.5817-8-8 3.5817-8 8-8 8 3.5817 8 8z" fill="url(#' +
      uid +
      'bp)"/>' +
      '<path d="m149.98 88.959v1.0195h1.0138v-1.0195h-1.0138z" fill="url(#' +
      uid +
      'o)"/>' +
      '<path d="m150.5 86.854c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z" fill="url(#' +
      uid +
      'n)"/>' +
      '<path d="m155.36 88.551v1.0195h1.0138v-1.0195h-1.0138z" fill="url(#' +
      uid +
      'm)"/>' +
      '<path d="m155.88 86.445c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z" fill="url(#' +
      uid +
      'l)"/>' +
      '<path d="m160.61 88.285v1.0195h1.0138v-1.0195h-1.0138z" fill="url(#' +
      uid +
      'k)"/>' +
      '<path d="m161.14 86.18c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z" fill="url(#' +
      uid +
      'j)"/>' +
      '<g transform="matrix(1 0 0 -1 0 188.24)">' +
      '<path d="m149.98 88.959v1.0195h1.0138v-1.0195h-1.0138z" fill="url(#' +
      uid +
      'o)"/>' +
      '<path d="m150.5 86.854c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z" fill="url(#' +
      uid +
      'n)"/>' +
      '<path d="m155.36 88.551v1.0195h1.0138v-1.0195h-1.0138z" fill="url(#' +
      uid +
      'm)"/>' +
      '<path d="m155.88 86.445c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z" fill="url(#' +
      uid +
      'l)"/>' +
      '<path d="m160.61 88.285v1.0195h1.0138v-1.0195h-1.0138z" fill="url(#' +
      uid +
      'k)"/>' +
      '<path d="m161.14 86.18c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z" fill="url(#' +
      uid +
      'j)"/>' +
      "</g>" +
      '<path d="m39.906 65.656c-0.68492 0.0057-1.364 0.04124-2.0625 0.125-18.464 2.2144-17.469 28.344-17.469 28.344s-0.99567 26.13 17.469 28.344c11.175 1.3402 20.518-7.89 31.312-8.9688 6.4769-0.64672 10.408 2.7244 17.594 0 7.3755-2.7962 8.2812-12.602 8.2812-19.375 0-6.7733-0.90573-16.579-8.2812-19.375-7.1862-2.7244-11.117 0.64722-17.594 0-10.12-1.0114-18.976-9.1791-29.25-9.0938zm32.562 21.219c4.0041 0 7.25 3.2459 7.25 7.25s-3.2459 7.25-7.25 7.25-7.25-3.2459-7.25-7.25 3.2459-7.25 7.25-7.25z" fill="url(#' +
      uid +
      'bs)" stroke="url(#' +
      uid +
      'bt)" stroke-width=".394"/>' +
      '<path d="m39.906 65.469c-0.69065 0.0057-1.3868 0.04023-2.0938 0.125-4.6618 0.55907-8.0947 2.6154-10.625 5.4062s-4.1522 6.2954-5.1875 9.7188c-2.0705 6.8468-1.8125 13.406-1.8125 13.406s-0.25801 6.5594 1.8125 13.406c1.0353 3.4234 2.6572 6.9279 5.1875 9.7188s5.9632 4.8473 10.625 5.4062c5.6472 0.67724 10.818-1.316 15.906-3.5938s10.121-4.8406 15.469-5.375c3.2008-0.31961 5.7653 0.35784 8.4688 0.78125s5.5268 0.59472 9.1562-0.78125c3.7566-1.4242 5.8723-4.6312 7.0312-8.3125s1.375-7.8546 1.375-11.25-0.21602-7.5687-1.375-11.25-3.2746-6.8883-7.0312-8.3125c-3.6294-1.376-6.4528-1.2047-9.1562-0.78125s-5.2679 1.1011-8.4688 0.78125c-5.0135-0.50102-9.7649-2.7784-14.531-4.9375s-9.5604-4.1994-14.75-4.1562zm0 0.375c5.0842-0.04226 9.8335 1.9687 14.594 4.125s9.5184 4.4584 14.625 4.9688c3.276 0.32737 5.9161-0.36182 8.5938-0.78125s5.412-0.56718 8.9688 0.78125c3.6189 1.372 5.6435 4.4486 6.7812 8.0625s1.375 7.7472 1.375 11.125-0.23724 7.5111-1.375 11.125-3.1624 6.6905-6.7812 8.0625c-3.5568 1.3484-6.2911 1.2006-8.9688 0.78125s-5.3177-1.1084-8.5938-0.78125c-5.4471 0.54436-10.487 3.1342-15.562 5.4062s-10.159 4.2255-15.688 3.5625c-4.5704-0.54799-7.9301-2.5813-10.406-5.3125s-4.0699-6.1767-5.0938-9.5625c-2.0478-6.7716-1.8125-13.281-1.8125-13.281s-0.23526-6.5097 1.8125-13.281c1.0239-3.3858 2.6176-6.8313 5.0938-9.5625s5.8358-4.7644 10.406-5.3125c0.69001-0.08275 1.3521-0.11935 2.0312-0.125zm32.562 20.844c-4.1105 0-7.4375 3.327-7.4375 7.4375s3.327 7.4375 7.4375 7.4375 7.4375-3.327 7.4375-7.4375-3.327-7.4375-7.4375-7.4375zm0 0.375c3.8976 0 7.0625 3.1649 7.0625 7.0625s-3.1649 7.0625-7.0625 7.0625-7.0625-3.1649-7.0625-7.0625 3.1649-7.0625 7.0625-7.0625z" fill="url(#' +
      uid +
      'bu)"/>' +
      '<path d="m72.469 85.834c-4.5716 0-8.2821 3.7106-8.2821 8.2821s3.7106 8.2821 8.2821 8.2821c4.5716 0 8.2821-3.7105 8.2821-8.2821s-3.7106-8.2821-8.2821-8.2821zm0 0.31732c4.4014 0 7.9648 3.5635 7.9648 7.9648s-3.5635 7.9648-7.9648 7.9648c-4.4014 0-7.9648-3.5635-7.9648-7.9648s3.5635-7.9648 7.9648-7.9648z" fill="#585e5e"/>' +
      '<path d="m72.469 85.244c-4.8972 0-8.8708 3.9736-8.8708 8.8708s3.9736 8.8708 8.8708 8.8708 8.8708-3.9736 8.8708-8.8708-3.9736-8.8708-8.8708-8.8708zm0 0.13753c4.8253 0 8.7332 3.908 8.7332 8.7332 0 4.8253-3.908 8.7332-8.7332 8.7332s-8.7332-3.908-8.7332-8.7332c0-4.8253 3.908-8.7332 8.7332-8.7332z" fill="#a98b6b"/>' +
      '<path d="m72.469 84.822c-5.1301 0-9.2928 4.1626-9.2928 9.2928 0 5.1301 4.1626 9.2927 9.2928 9.2927 5.1301 0 9.2928-4.1626 9.2928-9.2927s-4.1626-9.2928-9.2928-9.2928zm0 0.14407c5.0548 0 9.1487 4.0939 9.1487 9.1487s-4.0939 9.1487-9.1487 9.1487-9.1487-4.0939-9.1487-9.1487 4.0939-9.1487 9.1487-9.1487z" fill="#a98b6b"/>' +
      '<path d="m72.469 84.957c-5.0705 0-9.1927 4.0869-9.1927 9.1574s4.1222 9.1927 9.1927 9.1927 9.1927-4.1222 9.1927-9.1927-4.1222-9.1574-9.1927-9.1574zm0 0.31699c4.8889 0 8.8404 3.9515 8.8404 8.8404s-3.9515 8.8757-8.8404 8.8757-8.8404-3.9868-8.8404-8.8757 3.9515-8.8404 8.8404-8.8404z" fill="#5c4b3a"/>' +
      '<path d="m72.469 83.953c-5.6145 0-10.16 4.5458-10.16 10.16s4.5458 10.2 10.16 10.2 10.16-4.5851 10.16-10.2-4.5458-10.16-10.16-10.16zm0 0.2746c5.4783 0 9.9249 4.4074 9.9249 9.8857s-4.4466 9.9249-9.9249 9.9249-9.9249-4.4466-9.9249-9.9249 4.4466-9.8857 9.9249-9.8857z" fill="#8e755a"/>' +
      '<path d="m165.62 88.562c-3.1917 0.20926-16.799 1.0125-17.656 1.0625-1.9828 0.70667-3.125 1.2188-3.125 1.2188l-64.75-1.1562-0.03125 4.4375 0.03125 4.4688 64.75-1.1875s1.1422 0.51207 3.125 1.2188c0.85754 0.05 14.465 0.85323 17.656 1.0625 0.25068-0.0919 0.45747-0.31705 0.5625-0.5625-0.0165-1.3776 0-5 0-5s-0.0165-3.6224 0-5c-0.10503-0.24545-0.31182-0.47064-0.5625-0.5625z" fill="#dfdfdf"/>' +
      '<path d="m165.62 88.562c-3.1917 0.20926-16.799 1.0125-17.656 1.0625-1.3696 0.48811-2.6569 1.0209-3.125 1.2188v6.5625c0.46807 0.19781 1.7554 0.73064 3.125 1.2188 0.85754 0.05 14.465 0.85323 17.656 1.0625 0.25068-0.0919 0.45747-0.31705 0.5625-0.5625-0.0165-1.3776 0-5 0-5s-0.0165-3.6224 0-5c-0.10503-0.24545-0.31182-0.47064-0.5625-0.5625z" fill="url(#' +
      uid +
      'bv)"/>' +
      '<path d="m144.84 97.406v-6.5625l-65.279-1.1562-0.03151 4.4375 0.03151 4.4688z" fill="url(#' +
      uid +
      'bw)"/>' +
      '<path transform="translate(0 .45849)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'e)"/>' +
      '<path transform="translate(5.1707 .65849)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'e)"/>' +
      '<path transform="translate(10.474 .45849)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'e)"/>' +
      '<path transform="matrix(1 0 0 -1 0 187.79)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'e)"/>' +
      '<path transform="matrix(1 0 0 -1 5.1707 187.59)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'e)"/>' +
      '<path transform="matrix(1 0 0 -1 10.474 187.79)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'e)"/>' +
      '<g fill="#c8c8c8">' +
      '<path transform="matrix(1.11 0 0 1.11 -9.6836 -10.229)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z"/>' +
      '<path transform="matrix(1.11 0 0 1.11 -5.3398 -10.229)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z"/>' +
      '<path transform="matrix(1.11 0 0 1.11 2.1446 -12.152)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z"/>' +
      '<path transform="matrix(1.2765 0 0 1.2765 -3.6696 -25.9)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z"/>' +
      '<path transform="matrix(1.11 0 0 1.11 17.926 -12.039)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z"/>' +
      '<path transform="matrix(1.2765 0 0 1.2765 10.846 -25.954)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z"/>' +
      '<path transform="matrix(1.11 0 0 1.11 17.926 -8.4687)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z"/>' +
      '<path transform="matrix(1.11 0 0 1.11 2.1446 -8.317)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z"/>' +
      "</g>" +
      '<g clip-path="url(#' +
      uid +
      'br)">' +
      '<path d="m81.938 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m83.688 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m85.531 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m87.469 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m89.5 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m91.688 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m93.969 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m96.438 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m98.969 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m101.66 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m104.59 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m107.62 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m110.88 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m114.28 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m117.91 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m121.72 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m125.81 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m130.06 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m134.62 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      '<path d="m139.44 89.688v8.875h0.34375v-8.875h-0.34375z" fill="url(#' +
      uid +
      'a)"/>' +
      "</g>" +
      '<path d="m49.719 82.906c0 3.6189-1.1875 4.2778-1.1875 6.1875v10.062c0 1.9098 1.1875 2.5686 1.1875 6.1875h3.875v-22.438h-3.875z" fill="url(#' +
      uid +
      'bn)"/>' +
      '<path transform="translate(.055562 .35028)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece"/>' +
      '<path transform="translate(.055562 1.9128)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece"/>' +
      '<path transform="translate(.055562 3.4753)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece"/>' +
      '<path transform="translate(.055562 5.0378)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece"/>' +
      '<path transform="translate(.055562 6.6003)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece"/>' +
      '<path transform="translate(.055562 8.1628)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece"/>' +
      '<rect transform="matrix(.99915 -.041298 .041298 .99915 0 0)" x="48.262" y="90.866" width=".66291" height="10.673" ry=".093913" fill="url(#' +
      uid +
      'bo)"/>' +
      '<path d="m145.64 90.514c-0.79968 0.33023-0.79828 0.32174-0.79828 0.32174v6.571s1e-3 0 0.79828 0.33542z" fill="#dfdfdf"/>' +
      '<g fill="#978b6a">' +
      '<path d="m145.03 91.469v0.1875l6.0938 0.21875v-0.21875l-6.0938-0.1875z"/>' +
      '<path d="m156.38 91.844-11.344 0.65625v0.1875l11.344-0.6875v-0.15625z"/>' +
      '<path d="m161.69 91.625-16.656 1.9062v0.15625l16.656-1.9062v-0.15625z"/>' +
      '<path d="m145.03 94.562v0.15625l16.625 1.8438 0.0312-0.15625-16.656-1.8438z"/>' +
      '<path d="m145.03 95.594v0.15625l11.312 0.59375v-0.125l-11.312-0.625z"/>' +
      '<path d="m151.03 96.344-6 0.28125v0.125l6-0.28125v-0.125z"/>' +
      "</g>" +
      '<path transform="matrix(.62234 0 0 .62234 56.998 34.804)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'b)"/>' +
      '<path transform="matrix(.62234 0 0 .62234 62.168 35.004)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'b)"/>' +
      '<path transform="matrix(.62234 0 0 .62234 67.472 34.804)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'b)"/>' +
      '<path transform="matrix(.62234 0 0 -.62234 67.472 153.45)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'b)"/>' +
      '<path transform="matrix(.62234 0 0 -.62234 56.998 153.45)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'b)"/>' +
      '<path transform="matrix(.62234 0 0 -.62234 62.168 153.25)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill="url(#' +
      uid +
      'b)"/>' +
      '<g id="' +
      uid +
      'live-strings"></g>' +
      '<rect id="' +
      uid +
      'hit-layer" x="45" y="83.5" width="103" height="17.5" fill="transparent"></rect>' +
      "</g>" +
      "</svg>" +
      "</div>" +
      '<div class="sg-copy">' +
      '<div class="sg-overline-row"><span class="sg-overline-label">Strum the guitar</span><span class="sg-rule"></span></div>' +
      '<p class="sg-headline">Every note is a string letting go of its tension</p>' +
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
      "shadow{position:absolute;left:-90px;top:465px;width:1140px;height:410px;z-index:2;background:radial-gradient(ellipse 52% 50% at 44% 38%, rgba(55,29,6,0.48), transparent 72%);filter:blur(62px);pointer-events:none;}" +
      "." +
      uid +
      "shadow-core{position:absolute;left:60px;top:432px;width:700px;height:190px;z-index:2;background:radial-gradient(ellipse 48% 50% at 45% 40%, rgba(38,19,4,0.42), transparent 68%);filter:blur(22px);pointer-events:none;}" +
      "." +
      uid +
      "guitar-wrap{position:absolute;left:104px;top:186px;width:1056px;z-index:3;}" +
      "." +
      uid +
      "guitar-wrap svg{width:100%;height:auto;overflow:visible;display:block;}" +
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
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var Audio = window.StrungAudio;
    var Stage = window.StrungStage;

    liveG.innerHTML = "";
    var stringEls = STRINGS.map(function (s) {
      var glow = document.createElementNS(svg.namespaceURI, "path");
      glow.setAttribute("class", "sg-live-string");
      glow.setAttribute("stroke", s.wound ? "#a5813f" : "#8f8468");
      glow.setAttribute("stroke-width", s.w + 0.9);
      glow.setAttribute("opacity", "0");
      liveG.appendChild(glow);
      var main = document.createElementNS(svg.namespaceURI, "path");
      main.setAttribute("class", "sg-live-string");
      main.setAttribute("stroke", s.wound ? "#8a7146" : "#9b917b");
      main.setAttribute("stroke-width", s.w);
      liveG.appendChild(main);
      return { glow: glow, main: main };
    });

    var VFREQ = [9.5, 10.5, 11.6, 12.8, 14.0, 15.4];
    var VDAMP = [1.15, 1.35, 1.6, 1.95, 2.3, 2.7];
    var MAXAMP = 4.2;
    var activeStrings = {};
    var heldIndex = null,
      heldOffset = 0,
      heldU = 0.5;
    var lastPointer = null,
      lastCross = {},
      lastBand = null;
    var GX = 4.5946,
      GY = 5.5458;

    function chordFret(i) {
      return CHORDS[currentChord].frets[i];
    }

    function triggerString(i, amp, dir, freq) {
      amp = clamp(Math.abs(amp), 0.8, MAXAMP);
      activeStrings[i] = { t0: performance.now(), amp: amp, dir: dir || 1 };
      var s = STRINGS[i],
        tone = STRING_TONE[i];
      Audio.playPluck({
        key: "guitar_" + i + "_" + Math.round((freq || s.freq) * 10),
        freq: freq || s.freq,
        decay: tone.decay,
        damping: tone.damping,
        amp01: amp / MAXAMP,
        pan: (i - 2.5) / 3.2,
      });
      spawnNote(i);
    }

    function spawnNote(i) {
      var s = STRINGS[i];
      var pt = svg.createSVGPoint();
      pt.x = X1 - 4 - GX;
      pt.y = s.y1 - GY;
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
            var harmonic = 0.28 * Math.sin(2 * Math.PI * u) * Math.exp(-t * 2.4);
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
        stringEls[i].glow.setAttribute("opacity", ringing ? clamp(env / MAXAMP, 0, 0.4).toFixed(2) : "0");
      }
      raf1 = requestAnimationFrame(renderStrings);
    }

    function svgPoint(evt) {
      var pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm || ctm.a === 0) return null;
      var p = pt.matrixTransform(ctm.inverse());
      return { x: p.x + GX, y: p.y + GY };
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
      if (near.d < 1.1 && !activeStrings[near.i]) {
        heldIndex = near.i;
        heldU = clamp(near.u, 0.12, 0.88);
        heldOffset = clamp(p.y - yAt(near.i, heldU), -4, 4);
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
          if (fret0 !== null) triggerString(band0, 1.6, 1, fretFreq(band0, fret0));
        }
        return;
      }
      if (heldIndex !== null) {
        heldU = clamp(uFromX(p.x), 0.12, 0.88);
        heldOffset = clamp(p.y - yAt(heldIndex, heldU), -4, 4);
      }
      var u = uFromX(p.x);
      var curBand = bandAt(p.y, u);
      var speed = Math.hypot(p.x - lastPointer.x, p.y - lastPointer.y);
      var amp = clamp(speed * 1.4, 1.2, MAXAMP);
      var now = performance.now();
      if (curBand !== -1 && lastBand !== null && lastBand !== -1 && curBand !== lastBand) {
        var dir = curBand > lastBand ? 1 : -1;
        for (var b = lastBand + dir; ; b += dir) {
          if (b === heldIndex) {
            if (b === curBand) break;
            else continue;
          }
          var fret = chordFret(b);
          if (fret !== null && (!lastCross[b] || now - lastCross[b] > 110)) {
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
        if (Math.abs(heldOffset) > 0.45) triggerString(i, Math.abs(heldOffset) * 1.15, heldOffset > 0 ? -1 : 1);
        else triggerString(i, 1.8, Math.random() < 0.5 ? 1 : -1);
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
      var order = direction === "D" ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
      order.forEach(function (i, idx) {
        var fret = chordFret(i);
        if (fret === null) return;
        setTimeout(function () {
          var amp = velocity * (0.85 + Math.random() * 0.3);
          triggerString(i, amp, direction === "D" ? 1 : -1, fretFreq(i, fret));
        }, idx * 15);
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
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 6) {
        Audio.wake();
        var i = 6 - n,
          fret = chordFret(i);
        triggerString(i, 2.2, Math.random() < 0.5 ? 1 : -1, fret === null ? null : fretFreq(i, fret));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        Audio.wake();
        pulseKbd(kbdDown);
        sweepStrum("D", 2.6);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        Audio.wake();
        pulseKbd(kbdUp);
        sweepStrum("U", 2.6);
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

    // warm the open strings during idle time, same as before
    var warmed = false;
    function warm() {
      if (warmed) return;
      warmed = true;
      Audio.ensureAudio();
      STRINGS.forEach(function (s, i) {
        var tone = STRING_TONE[i];
        Audio.warmPluck("guitar_" + i + "_" + Math.round(s.freq * 10), s.freq, tone.decay, tone.damping, 2.6);
      });
    }
    var idleHandle = window.requestIdleCallback
      ? { id: window.requestIdleCallback(warm, { timeout: 1500 }), kind: "idle" }
      : { id: setTimeout(warm, 300), kind: "timeout" };

    // preset playback api: a plucked string decays on its own, so there's
    // nothing for silence() to actively cut off -- pausing a preset just
    // stops scheduling further notes and lets whatever's already ringing
    // finish its natural decay.
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

  window.StrungInstruments.push({ id: "guitar", label: "Guitar", render: render, mount: mount });
})();
