/* ================= StrungSlider: instrument carousel =================
   Each instrument module (js/instruments/*.js) registers itself into
   window.StrungInstruments with { id, label, render(uid), mount(root, uid) }.
   render() returns the instrument's markup as an HTML string (rendered into
   the DOM once, up front, for every slide); mount() is only called for the
   ACTIVE slide -- it attaches listeners and starts rAF loops, and returns a
   teardown function that the slider calls the moment you swipe away, so
   only one instrument's engine is ever running at a time.
*/
(function () {
  "use strict";

  window.StrungInstruments = window.StrungInstruments || [];

  // Splits an element's text into one <span class="sg-char"> per letter,
  // with an --i custom property marking its position, so each can animate
  // in on its own staggered delay. Letters of the same word are grouped
  // inside a single inline-block .sg-word wrapper -- without that, every
  // letter is its own independent inline-block box and the browser is free
  // to wrap the line between ANY two of them (not just at real spaces),
  // which is what caused "letting" to split as "l" / "etting" across two
  // lines. The word wrapper makes each word one atomic box, so a line can
  // only break at the actual (plain, non-inline-block) space between words.
  // Done once, up front, alongside the rest of the slide's static markup;
  // the actual letter-by-letter reveal is pure CSS keyed off
  // .sg-slide--active, so it replays every time the slide is switched back
  // to without any JS retrigger.
  function splitChars(el) {
    if (!el) return;
    var text = el.textContent;
    var words = text.split(" ");
    var frag = document.createDocumentFragment();
    var i = 0;
    words.forEach(function (word, wIdx) {
      if (wIdx > 0) {
        var space = document.createElement("span");
        space.className = "sg-char sg-char--space";
        space.textContent = " ";
        frag.appendChild(space);
      }
      var wordSpan = document.createElement("span");
      wordSpan.className = "sg-word";
      for (var c = 0; c < word.length; c++) {
        var span = document.createElement("span");
        span.className = "sg-char";
        span.style.setProperty("--i", i);
        span.textContent = word[c];
        wordSpan.appendChild(span);
        i++;
      }
      frag.appendChild(wordSpan);
    });
    el.textContent = "";
    el.appendChild(frag);
  }
  function splitHeadlineChars(slide) {
    splitChars(slide.querySelector(".sg-headline"));
    splitChars(slide.querySelector(".sg-watermark"));
  }

  function initSlider() {
    var instruments = window.StrungInstruments;
    if (!instruments.length) return;

    var track = document.getElementById("slider-track");
    var tabsEl = document.getElementById("slider-tabs");
    var prevBtn = document.getElementById("slider-prev");
    var nextBtn = document.getElementById("slider-next");

    var slides = [];
    var teardowns = [];
    var current = 0;

    instruments.forEach(function (inst, idx) {
      var uid = "sg" + idx + "_";
      var slide = document.createElement("div");
      slide.className = "sg-slide";
      slide.innerHTML = inst.render(uid);
      splitHeadlineChars(slide);
      track.appendChild(slide);
      slides.push(slide);
      teardowns.push(null);

      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "sg-tab";
      tab.textContent = inst.label;
      tab.addEventListener("click", function () {
        goTo(idx);
      });
      tabsEl.appendChild(tab);
    });

    var tabButtons = tabsEl.querySelectorAll(".sg-tab");

    // mount() returns { teardown, api } -- api is a small set of normalized
    // playback methods (see each instrument's "preset playback api" comment)
    // that the music player uses to run a preset song. A bare function
    // return is also accepted for safety, treated as just the teardown.
    //
    // Called synchronously from goTo(), not deferred through
    // requestAnimationFrame: rAF only fires once a tab is actually visible
    // and being composited, so a deferred mount would silently never
    // happen if this ever ran in a backgrounded/prerendered tab -- the new
    // instrument's listeners just wouldn't attach, and the music player
    // would stay stuck on whatever was active before. Mounting is cheap
    // (attaching listeners, building chord chips) and doesn't need a
    // layout pass first, so there's nothing to gain from deferring it.
    function mountActive() {
      var inst = instruments[current];
      var slide = slides[current];
      if (teardowns[current]) return; // already mounted
      var result = inst.mount(slide, "sg" + current + "_");
      var teardownFn = null,
        api = null;
      if (typeof result === "function") teardownFn = result;
      else if (result) {
        teardownFn = result.teardown;
        api = result.api || null;
      }
      teardowns[current] = teardownFn || function () {};
      if (window.StrungMusicPlayer) window.StrungMusicPlayer.setActive(inst.id, api);
    }

    function unmountAt(idx) {
      if (teardowns[idx]) {
        if (window.StrungMusicPlayer) window.StrungMusicPlayer.setActive(null, null);
        try {
          teardowns[idx]();
        } catch (_e) {}
        teardowns[idx] = null;
      }
    }

    function render() {
      track.style.transform = "translateX(" + -current * 100 + "%)";
      slides.forEach(function (s, i) {
        s.classList.toggle("sg-slide--active", i === current);
        s.setAttribute("aria-hidden", i === current ? "false" : "true");
      });
      tabButtons.forEach(function (t, i) {
        t.classList.toggle("sg-tab--active", i === current);
      });
      prevBtn.disabled = false;
      nextBtn.disabled = false;
    }

    var PARALLAX_PX = 150;
    function goTo(idx) {
      idx = Math.max(0, Math.min(instruments.length - 1, idx));
      if (idx === current) return;
      // the track is one continuous flex row of all 5 slides -- sliding it
      // from the current position to a NON-adjacent one means the visible
      // window physically sweeps across whatever sits in between on the
      // way there (e.g. Guitar -> Violin visibly passes Bass, since Bass
      // sits right between them). That's invisible at a snappy speed but
      // very obvious at the slower, more deliberate one this carousel now
      // uses. Arrows and swipes only ever move one step, so they're always
      // adjacent and get the full sliding motion; a tab click can jump
      // anywhere, so a non-adjacent jump instead snaps the track straight
      // there with no animated sweep -- the incoming slide still fades,
      // scales, and drifts into place via its own per-layer parallax, so it
      // still reads as a transition, just without passing through anyone
      // else's stage on the way.
      var isAdjacent = Math.abs(idx - current) === 1;
      var direction = idx > current ? 1 : -1;
      unmountAt(current);
      // seed the incoming slide's content a little further along the
      // direction it's arriving from, then force a reflow so the browser
      // commits to that offset -- only then do we flip it to .sg-slide--active
      // (transform: translateX(0)), so the transition actually animates the
      // content drifting the last little bit into place instead of just
      // snapping there with the rest of the slide.
      var incoming = slides[idx];
      incoming.style.setProperty("--sg-px", direction * PARALLAX_PX + "px");
      void incoming.offsetWidth;
      current = idx;
      if (isAdjacent) {
        render();
      } else {
        track.style.transition = "none";
        render();
        void track.offsetWidth; // commit the instant jump before re-enabling the transition
        track.style.transition = "";
      }
      mountActive();
    }

    prevBtn.addEventListener("click", function () {
      window.StrungAudio.wake();
      goTo(current - 1);
    });
    nextBtn.addEventListener("click", function () {
      window.StrungAudio.wake();
      goTo(current + 1);
    });

    window.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        window.StrungAudio.wake();
        goTo(current - 1);
      } else if (e.key === "ArrowRight") {
        window.StrungAudio.wake();
        goTo(current + 1);
      }
    });

    // swipe: only when the gesture doesn't start on an instrument's own
    // interactive surface (strings, keys, bars, chips...) -- those are all
    // tagged with .sg-no-swipe by each instrument module.
    var viewport = document.getElementById("slider-viewport");
    var dragging = false,
      dragStartX = 0,
      dragDX = 0,
      dragId = null,
      dragStartT = 0;
    // a viewport that hasn't been laid out yet reports clientWidth 0 (true
    // very briefly during setup, and can linger on a backgrounded/inactive
    // tab) -- a 0 width would make the swipe threshold below also 0, so any
    // stray sub-pixel of pointer noise would look like it "exceeded" the
    // threshold and force a navigation. Below this width, swipes are inert.
    var MIN_VIEWPORT_FOR_SWIPE = 100;

    function isNoSwipeTarget(target) {
      return !!(target && target.closest && target.closest(".sg-no-swipe"));
    }

    viewport.addEventListener("pointerdown", function (evt) {
      if (isNoSwipeTarget(evt.target)) return;
      if (viewport.clientWidth < MIN_VIEWPORT_FOR_SWIPE) return;
      dragging = true;
      dragId = evt.pointerId;
      dragStartX = evt.clientX;
      dragDX = 0;
      dragStartT = performance.now();
      track.style.transition = "none";
      try {
        viewport.setPointerCapture(evt.pointerId);
      } catch (_e) {}
    });

    viewport.addEventListener("pointermove", function (evt) {
      if (!dragging || evt.pointerId !== dragId) return;
      dragDX = evt.clientX - dragStartX;
      var pct = (dragDX / viewport.clientWidth) * 100;
      track.style.transform = "translateX(" + (-current * 100 + pct) + "%)";
    });

    function endDrag(evt) {
      if (!dragging || (evt && evt.pointerId !== dragId)) return;
      dragging = false;
      track.style.transition = "";
      var elapsed = performance.now() - dragStartT;
      var w = viewport.clientWidth;
      // require both a real distance AND a non-instantaneous gesture --
      // a genuine swipe always takes some measurable time; anything faster
      // is noise, not an intentional drag.
      var threshold = w * 0.16;
      var validGesture = w >= MIN_VIEWPORT_FOR_SWIPE && elapsed >= 30 && threshold > 0;
      if (validGesture && dragDX > threshold) goTo(current - 1);
      else if (validGesture && dragDX < -threshold) goTo(current + 1);
      else render();
    }
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    viewport.addEventListener("pointerleave", function (evt) {
      if (dragging) endDrag(evt);
    });

    render();
    mountActive();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSlider);
  } else {
    initSlider();
  }
})();
