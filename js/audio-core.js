/* ================= StrungAudio: shared audio engine =================
   One AudioContext for the whole page, reused across every instrument in
   the slider. Each instrument brings its own synthesis (plucked string,
   bowed string, mallet strike, held key) but they all share the same
   context, reverb bus, and warm-up/pooling machinery, so switching
   instruments never re-pays the "first sound" startup cost described in
   getPluckBuffer()/warmUp() below.
*/
(function (global) {
  "use strict";

  var actx = null;
  var masterGain, analyser, convolver, reverbGain, dryGain;
  var reverbReady = false;

  function ensureAudio() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = actx.createGain();
    masterGain.gain.value = 0.9;
    analyser = actx.createAnalyser();
    analyser.fftSize = 1024;
    convolver = actx.createConvolver();
    reverbGain = actx.createGain();
    reverbGain.gain.value = 0.2;
    dryGain = actx.createGain();
    dryGain.gain.value = 1.0;
    dryGain.connect(masterGain);
    convolver.connect(reverbGain);
    reverbGain.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(actx.destination);
  }

  function wake() {
    ensureAudio();
    if (actx.state === "suspended") actx.resume();
  }

  function makeReverbIR(duration, decayPow) {
    var sr = actx.sampleRate,
      len = Math.floor(sr * duration);
    var ir = actx.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var data = ir.getChannelData(ch);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decayPow);
    }
    return ir;
  }

  // ---- plucked-string synthesis (guitar, bass) ----
  function karplusStrong(freq, seconds, decay, damping) {
    var sr = actx.sampleRate;
    var N = Math.max(2, Math.round(sr / freq));
    var buf = new Float32Array(N);
    for (var i = 0; i < N; i++) buf[i] = Math.random() * 2 - 1;
    var total = Math.floor(sr * seconds);
    var out = new Float32Array(total);
    var idx = 0,
      lp = 0;
    for (var n = 0; n < total; n++) {
      var cur = buf[idx];
      var nextIdx = (idx + 1) % N;
      var avg = 0.5 * (cur + buf[nextIdx]);
      lp = avg * (1 - damping) + lp * damping;
      buf[idx] = decay * lp;
      out[n] = cur;
      idx = nextIdx;
    }
    var fadeIn = Math.min(64, total);
    for (var k = 0; k < fadeIn; k++) out[k] *= k / fadeIn;
    return out;
  }

  var PLUCK_POOL_SIZE = 3;
  var pluckCache = {};

  // key should be unique per (instrument, string, pitch), e.g. "guitar_0_824"
  function getPluckBuffer(key, freq, decay, damping, seconds) {
    var arr = pluckCache[key] || (pluckCache[key] = []);
    if (arr.length < PLUCK_POOL_SIZE) {
      var data = karplusStrong(freq, seconds || 2.6, decay, damping);
      var buf = actx.createBuffer(1, data.length, actx.sampleRate);
      buf.copyToChannel(data, 0);
      arr.push(buf);
      return buf;
    }
    return arr[(Math.random() * arr.length) | 0];
  }

  // fire-and-forget pluck: schedules a buffer source through gain(+pan) into
  // both the dry bus and the reverb send, cleans itself up on end.
  //
  // When the context is still suspended (the very first sound of the
  // session -- e.g. hovering a guitar string before ever clicking
  // anything), starting the source immediately after calling resume()
  // loses the note: resume() is asynchronous, and a source started while
  // the context is still technically suspended can get silently dropped
  // by the time processing actually begins a few milliseconds later.
  // Waiting for resume() to settle before calling start() avoids that.
  function playPluck(opts) {
    ensureAudio();
    if (!reverbReady) {
      convolver.buffer = makeReverbIR(2.6, 3.2);
      reverbReady = true;
    }
    var vel = Math.max(0.12, Math.min(1, opts.amp01));
    var buffer = getPluckBuffer(opts.key, opts.freq, opts.decay, opts.damping, opts.seconds);
    var src = actx.createBufferSource();
    src.buffer = buffer;
    var gain = actx.createGain();
    gain.gain.value = (opts.gain != null ? opts.gain : 0.55) * vel;
    var pan = actx.createStereoPanner ? actx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.max(-0.9, Math.min(0.9, opts.pan || 0));
    src.connect(gain);
    if (pan) {
      gain.connect(pan);
      pan.connect(dryGain);
      pan.connect(convolver);
    } else {
      gain.connect(dryGain);
      gain.connect(convolver);
    }
    src.onended = function () {
      try {
        src.disconnect();
        gain.disconnect();
        if (pan) pan.disconnect();
      } catch (_e) {}
    };
    if (actx.state === "suspended") {
      actx.resume().then(function () {
        try {
          src.start();
        } catch (_e) {}
      });
    } else {
      src.start();
    }
  }

  function warmPluck(key, freq, decay, damping, seconds) {
    ensureAudio();
    if (!reverbReady) {
      convolver.buffer = makeReverbIR(2.6, 3.2);
      reverbReady = true;
    }
    for (var v = 0; v < PLUCK_POOL_SIZE; v++) getPluckBuffer(key, freq, decay, damping, seconds);
  }

  // ---- sustained tone (bowed violin, held piano key) ----
  // returns a handle {stop(releaseSeconds)} the caller keeps for as long as
  // the note should ring (bow still drawn / key still held).
  function playSustain(opts) {
    ensureAudio();
    if (!reverbReady) {
      convolver.buffer = makeReverbIR(2.6, 3.2);
      reverbReady = true;
    }
    var attack = opts.attack != null ? opts.attack : 0.04;
    var peakGain = (opts.gain != null ? opts.gain : 0.32) * Math.max(0.15, Math.min(1, opts.amp01 || 0.8));

    var gain = actx.createGain();
    gain.gain.value = 0.0001;

    var pan = actx.createStereoPanner ? actx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.max(-0.9, Math.min(0.9, opts.pan || 0));

    var oscillators = [];
    var voices = opts.voices || [{ type: "sawtooth", detune: 0, gain: 1 }];
    voices.forEach(function (v) {
      var osc = actx.createOscillator();
      osc.type = v.type || "sawtooth";
      osc.frequency.value = opts.freq;
      osc.detune.value = v.detune || 0;
      var vGain = actx.createGain();
      vGain.gain.value = v.gain != null ? v.gain : 1;
      osc.connect(vGain);
      vGain.connect(gain);
      oscillators.push(osc);
    });

    var vibratoLFO = null,
      vibratoGain = null;
    if (opts.vibrato) {
      vibratoLFO = actx.createOscillator();
      vibratoLFO.frequency.value = opts.vibrato.rate || 5.5;
      vibratoGain = actx.createGain();
      vibratoGain.gain.value = opts.vibrato.cents || 6;
      vibratoLFO.connect(vibratoGain);
      oscillators.forEach(function (osc) {
        vibratoGain.connect(osc.detune);
      });
    }

    if (pan) {
      gain.connect(pan);
      pan.connect(dryGain);
      pan.connect(convolver);
    } else {
      gain.connect(dryGain);
      gain.connect(convolver);
    }

    // see playPluck() for why start() is deferred until resume() settles
    // on the very first sound of the session.
    var started = false;
    function fire() {
      if (started) return;
      started = true;
      var now = actx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), now + attack);
      oscillators.forEach(function (osc) {
        osc.start(now);
      });
      if (vibratoLFO) vibratoLFO.start(now);
    }
    if (actx.state === "suspended") {
      actx.resume().then(fire);
    } else {
      fire();
    }

    var stopped = false;
    function stop(releaseSeconds) {
      if (stopped) return;
      stopped = true;
      if (!started) {
        // released before the deferred start ever fired -- just tear down
        try {
          oscillators.forEach(function (osc) {
            osc.disconnect();
          });
          gain.disconnect();
          if (pan) pan.disconnect();
          if (vibratoLFO) vibratoLFO.disconnect();
          if (vibratoGain) vibratoGain.disconnect();
        } catch (_e) {}
        return;
      }
      var t = actx.currentTime;
      var rel = releaseSeconds != null ? releaseSeconds : 0.25;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + rel);
      oscillators.forEach(function (osc) {
        try {
          osc.stop(t + rel + 0.05);
        } catch (_e) {}
      });
      if (vibratoLFO)
        try {
          vibratoLFO.stop(t + rel + 0.05);
        } catch (_e) {}
      setTimeout(function () {
        try {
          oscillators.forEach(function (osc) {
            osc.disconnect();
          });
          gain.disconnect();
          if (pan) pan.disconnect();
          if (vibratoLFO) vibratoLFO.disconnect();
          if (vibratoGain) vibratoGain.disconnect();
        } catch (_e) {}
      }, (rel + 0.15) * 1000);
    }

    function setFreq(freq, glideSeconds) {
      var t = actx.currentTime;
      oscillators.forEach(function (osc) {
        if (glideSeconds) {
          osc.frequency.cancelScheduledValues(t);
          osc.frequency.setValueAtTime(osc.frequency.value, t);
          osc.frequency.linearRampToValueAtTime(freq, t + glideSeconds);
        } else {
          osc.frequency.value = freq;
        }
      });
    }

    function setAmp(amp01) {
      var t = actx.currentTime;
      var g = (opts.gain != null ? opts.gain : 0.32) * Math.max(0.05, Math.min(1, amp01));
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(g, t, 0.03);
    }

    return { stop: stop, setFreq: setFreq, setAmp: setAmp };
  }

  // ---- struck / mallet tone (xylophone bars, percussion) ----
  function playStrike(opts) {
    ensureAudio();
    if (!reverbReady) {
      convolver.buffer = makeReverbIR(2.6, 3.2);
      reverbReady = true;
    }
    // see playPluck() for why the whole schedule is deferred until
    // resume() settles on the very first sound of the session.
    function fire() {
      var now = actx.currentTime;
      var vel = Math.max(0.15, Math.min(1, opts.amp01 || 0.8));
      var decay = opts.decay != null ? opts.decay : 1.1;

      var gain = actx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0003, 0.6 * vel), now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      var pan = actx.createStereoPanner ? actx.createStereoPanner() : null;
      if (pan) pan.pan.value = Math.max(-0.9, Math.min(0.9, opts.pan || 0));

      var fundamental = actx.createOscillator();
      fundamental.type = "sine";
      fundamental.frequency.setValueAtTime(opts.freq * 1.003, now);
      fundamental.frequency.exponentialRampToValueAtTime(opts.freq, now + 0.05);

      var partial = actx.createOscillator();
      partial.type = "sine";
      partial.frequency.value = opts.freq * (opts.partialRatio || 3.98);
      var partialGain = actx.createGain();
      partialGain.gain.setValueAtTime(0.5 * vel, now);
      partialGain.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.35);

      var noise = actx.createBufferSource();
      var noiseBuf = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.02), actx.sampleRate);
      var nd = noiseBuf.getChannelData(0);
      for (var i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);
      noise.buffer = noiseBuf;
      var noiseGain = actx.createGain();
      noiseGain.gain.value = 0.18 * vel;

      fundamental.connect(gain);
      partial.connect(partialGain);
      partialGain.connect(gain);
      noise.connect(noiseGain);
      noiseGain.connect(gain);

      if (pan) {
        gain.connect(pan);
        pan.connect(dryGain);
        pan.connect(convolver);
      } else {
        gain.connect(dryGain);
        gain.connect(convolver);
      }

      fundamental.start(now);
      partial.start(now);
      noise.start(now);
      fundamental.stop(now + decay + 0.1);
      partial.stop(now + decay + 0.1);
      fundamental.onended = function () {
        try {
          fundamental.disconnect();
          partial.disconnect();
          partialGain.disconnect();
          noise.disconnect();
          noiseGain.disconnect();
          gain.disconnect();
          if (pan) pan.disconnect();
        } catch (_e) {}
      };
    }
    if (actx.state === "suspended") {
      actx.resume().then(fire);
    } else {
      fire();
    }
  }

  function getAnalyser() {
    ensureAudio();
    return analyser;
  }

  // Browsers only ever grant an AudioContext permission to actually run
  // from a genuine, trusted user gesture -- a click, a keydown, a
  // touchstart. A bare pointer hover (no button ever pressed) never
  // qualifies, no matter how the resume() call is scheduled on this end,
  // so a visitor whose very first touch on the page is a hover over the
  // guitar strings will not hear anything until they press something for
  // the first time. That's a hard platform rule, not something fixable
  // with better JS timing -- so instead of silently doing nothing, a small
  // one-time hint appears (only if sound is still locked a moment after
  // load) and clears itself the instant any real gesture happens anywhere
  // on the page, whether or not it's the hint being clicked.
  function setupUnlockHint() {
    var hint = document.getElementById("sg-audio-hint");
    if (!hint) return;
    var shown = false;
    var showTimer = setTimeout(function () {
      if (actx && actx.state === "running") return;
      shown = true;
      hint.classList.add("sg-audio-hint--visible");
    }, 1100);

    function onFirstGesture() {
      wake();
      clearTimeout(showTimer);
      if (shown) hint.classList.remove("sg-audio-hint--visible");
      window.removeEventListener("pointerdown", onFirstGesture, true);
      window.removeEventListener("keydown", onFirstGesture, true);
      window.removeEventListener("touchstart", onFirstGesture, true);
    }
    window.addEventListener("pointerdown", onFirstGesture, true);
    window.addEventListener("keydown", onFirstGesture, true);
    window.addEventListener("touchstart", onFirstGesture, true);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupUnlockHint);
  } else {
    setupUnlockHint();
  }

  global.StrungAudio = {
    ensureAudio: ensureAudio,
    wake: wake,
    playPluck: playPluck,
    warmPluck: warmPluck,
    playSustain: playSustain,
    playStrike: playStrike,
    getAnalyser: getAnalyser,
  };
})(window);
