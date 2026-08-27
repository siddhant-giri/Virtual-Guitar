/* ================= StrungMusicPlayer: preset song playback =================
   A small dropdown + play/pause widget in the top-right corner. slider.js
   calls setActive(instId, api) every time the active instrument (re)mounts,
   with the normalized api that instrument's mount() returned (see each
   instrument file's "preset playback api" comment). This module owns all
   the scheduling and the custom dropdown -- instruments don't know presets
   exist at all.

   The dropdown is a plain button + list, not a <select>: a native <select>'s
   open popup is drawn by the OS/browser chrome and can't be restyled, so
   getting it to look like the rest of the site means building it by hand.
*/
(function () {
  "use strict";

  function initPlayer() {
    var wrap = document.getElementById("sg-music-player");
    var dropdown = document.getElementById("sg-music-dropdown");
    var dropdownBtn = document.getElementById("sg-music-dropdown-btn");
    var dropdownLabel = document.getElementById("sg-music-dropdown-label");
    var dropdownList = document.getElementById("sg-music-dropdown-list");
    var playBtn = document.getElementById("sg-music-play");
    if (!wrap || !dropdown || !dropdownBtn || !dropdownList || !playBtn) return;

    var currentApi = null;
    var currentInstId = null;
    var currentPresets = [];
    var currentIndex = 0;
    var pendingTimers = null; // array of timeout ids for the running preset, or null
    var isPlaying = false;

    function isOpen() {
      return dropdown.classList.contains("sg-music-dropdown--open");
    }
    function closeDropdown() {
      dropdown.classList.remove("sg-music-dropdown--open");
      dropdownBtn.setAttribute("aria-expanded", "false");
    }
    function openDropdown() {
      if (dropdownBtn.disabled) return;
      dropdown.classList.add("sg-music-dropdown--open");
      dropdownBtn.setAttribute("aria-expanded", "true");
    }

    dropdownBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (isOpen()) closeDropdown();
      else openDropdown();
    });
    document.addEventListener("click", function (e) {
      if (isOpen() && !dropdown.contains(e.target)) closeDropdown();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) closeDropdown();
    });

    function renderOptions() {
      dropdownList.innerHTML = "";
      currentPresets.forEach(function (preset, idx) {
        var li = document.createElement("li");
        li.className = "sg-music-option" + (idx === currentIndex ? " sg-music-option--active" : "");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", idx === currentIndex ? "true" : "false");
        var check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        check.setAttribute("class", "sg-music-option-check");
        check.setAttribute("viewBox", "0 0 12 10");
        check.setAttribute("fill", "none");
        check.innerHTML = '<path d="M1 5l3.2 3.2L11 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
        var label = document.createElement("span");
        label.className = "sg-music-option-label";
        label.textContent = preset.name;
        li.appendChild(check);
        li.appendChild(label);
        li.addEventListener("click", function () {
          selectIndex(idx);
          closeDropdown();
        });
        dropdownList.appendChild(li);
      });
    }

    function setPlayingUI(playing) {
      isPlaying = playing;
      playBtn.classList.toggle("is-playing", playing);
      playBtn.setAttribute("aria-label", playing ? "Pause preset song" : "Play preset song");
    }

    function stopPlayback() {
      if (pendingTimers) {
        pendingTimers.forEach(function (id) {
          clearTimeout(id);
        });
        pendingTimers = null;
      }
      if (currentApi && currentApi.silence) {
        try {
          currentApi.silence();
        } catch (_e) {}
      }
      setPlayingUI(false);
    }

    function playPreset() {
      if (!currentApi || !currentPresets.length) return;
      var preset = currentPresets[currentIndex];
      if (!preset || !preset.notes.length) return;
      if (window.StrungAudio) window.StrungAudio.wake();

      var timers = preset.notes.map(function (note) {
        return setTimeout(function () {
          var fn = currentApi[note.action];
          if (fn) fn.apply(currentApi, note.args);
        }, note.t);
      });
      var lastT = preset.notes[preset.notes.length - 1].t;
      timers.push(
        setTimeout(function () {
          pendingTimers = null;
          setPlayingUI(false);
        }, lastT + 900)
      );
      pendingTimers = timers;
      setPlayingUI(true);
    }

    function selectIndex(idx) {
      if (idx === currentIndex) return;
      var wasPlaying = isPlaying;
      stopPlayback();
      currentIndex = idx;
      dropdownLabel.textContent = currentPresets[idx] ? currentPresets[idx].name : "—";
      renderOptions();
      if (wasPlaying) playPreset();
    }

    playBtn.addEventListener("click", function () {
      if (window.StrungAudio) window.StrungAudio.wake();
      if (isPlaying) stopPlayback();
      else playPreset();
    });

    function setActive(instId, api) {
      stopPlayback(); // switching instruments always stops whatever was playing
      closeDropdown();
      currentInstId = instId;
      currentApi = api;
      currentPresets = (instId && window.StrungPresets && window.StrungPresets[instId]) || [];
      currentIndex = 0;
      if (currentPresets.length) {
        dropdownLabel.textContent = currentPresets[0].name;
        dropdownBtn.disabled = false;
        playBtn.disabled = false;
        wrap.classList.remove("sg-music-player--empty");
      } else {
        dropdownLabel.textContent = "—";
        dropdownBtn.disabled = true;
        playBtn.disabled = true;
        wrap.classList.add("sg-music-player--empty");
      }
      renderOptions();
    }

    window.StrungMusicPlayer = { setActive: setActive };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayer);
  } else {
    initPlayer();
  }
})();
