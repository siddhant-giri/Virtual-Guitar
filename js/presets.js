/* ================= StrungPresets: demo songs per instrument =================
   Each instrument's mount() exposes a small normalized "api" (see the
   "preset playback api" comment near the end of each instrument file) --
   trigger/bow/chord/strike/press plus silence(). A preset here is just a
   list of { t, action, args } calls into that api, scheduled by
   js/music-player.js. This file only holds note data; it doesn't touch
   audio or DOM directly. Each instrument gets an ARRAY of presets now
   (the dropdown lists all of them).

   Guitar and bass presets use consistent minor-pentatonic fret intervals
   (0, 3, 5, 7, 10 semitones) on a string, or arpeggiate the instrument's
   own chord shapes -- both sound musically correct in any key without
   needing a transcribed melody. Xylophone and keyboard play opening
   phrases of traditional/public-domain nursery tunes, picked because each
   sits comfortably within a single octave.
*/
(function () {
  "use strict";

  // string index -> fret sequence -> {t, trigger-args} for guitar/bass,
  // spaced `step` ms apart with a per-note amp list (defaults to 1.8).
  function stringRun(str, frets, step, amps) {
    return frets.map(function (fret, i) {
      return { t: i * step, action: "trigger", args: [str, fret, (amps && amps[i]) || 1.8] };
    });
  }

  var PRESETS = {
    guitar: [
      {
        name: "Little Riff",
        notes: stringRun(
          5,
          [0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0],
          260,
          [1.7, 1.7, 1.7, 1.7, 1.9, 2.1, 1.9, 1.7, 1.7, 1.7, 2.0]
        ),
      },
      {
        name: "Low Rumble",
        notes: stringRun(0, [0, 3, 5, 7, 10, 7, 5, 3, 0], 280, [2.0, 2.0, 2.0, 2.2, 2.4, 2.2, 2.0, 2.0, 2.4]),
      },
      {
        name: "Chord Roll",
        notes: (function () {
          // Open, E, G, C -- arpeggiated string by string (low to high),
          // same shapes as the guitar's own chord chips.
          var chords = [
            [0, 0, 0, 0, 0, 0],
            [0, 2, 2, 1, 0, 0],
            [3, 2, 0, 0, 0, 3],
            [null, 3, 2, 0, 1, 0],
          ];
          var notes = [];
          var t = 0;
          chords.forEach(function (frets) {
            frets.forEach(function (fret, str) {
              if (fret === null) return;
              notes.push({ t: t, action: "trigger", args: [str, fret, 1.7] });
              t += 120;
            });
            t += 200;
          });
          return notes;
        })(),
      },
      {
        name: "Skipping Steps",
        notes: (function () {
          var frets = [0, 3, 5, 7, 10];
          var notes = [];
          frets.forEach(function (fret, i) {
            notes.push({ t: i * 440, action: "trigger", args: [5, fret, 1.8] });
            notes.push({ t: i * 440 + 220, action: "trigger", args: [4, fret, 1.7] });
          });
          return notes;
        })(),
      },
    ],

    bass: [
      {
        name: "Walking Line",
        notes: [
          { t: 0, str: 3, fret: 0 },
          { t: 320, str: 3, fret: 3 },
          { t: 640, str: 3, fret: 5 },
          { t: 960, str: 3, fret: 7 },
          { t: 1280, str: 3, fret: 10 },
          { t: 1600, str: 3, fret: 7 },
          { t: 1920, str: 3, fret: 5 },
          { t: 2240, str: 3, fret: 3 },
          { t: 2560, str: 3, fret: 0 },
          { t: 2880, str: 2, fret: 0 },
          { t: 3200, str: 3, fret: 0 },
        ].map(function (n) {
          return { t: n.t, action: "trigger", args: [n.str, n.fret, 2.3] };
        }),
      },
      {
        name: "Root Bounce",
        notes: [
          { t: 0, str: 3, fret: 0 },
          { t: 300, str: 3, fret: 7 },
          { t: 600, str: 3, fret: 0 },
          { t: 900, str: 2, fret: 0 },
          { t: 1200, str: 2, fret: 7 },
          { t: 1500, str: 2, fret: 0 },
          { t: 1800, str: 3, fret: 0 },
        ].map(function (n) {
          return { t: n.t, action: "trigger", args: [n.str, n.fret, 2.3] };
        }),
      },
      {
        name: "Groove Walk",
        notes: stringRun(1, [0, 3, 5, 7, 5, 3, 0], 300, [2.2, 2.2, 2.2, 2.4, 2.2, 2.2, 2.4]),
      },
      {
        name: "Chord Roots",
        notes: [
          { t: 0, str: 3, fret: 0 },
          { t: 500, str: 3, fret: 3 },
          { t: 1000, str: 2, fret: 3 },
          { t: 1500, str: 1, fret: 0 },
          { t: 2000, str: 3, fret: 0 },
        ].map(function (n) {
          return { t: n.t, action: "trigger", args: [n.str, n.fret, 2.4] };
        }),
      },
    ],

    violin: [
      {
        name: "Open String Call",
        notes: [
          { t: 0, action: "bow", args: [0, 0.6, 480] },
          { t: 520, action: "bow", args: [1, 0.6, 480] },
          { t: 1040, action: "bow", args: [2, 0.65, 480] },
          { t: 1560, action: "bow", args: [3, 0.7, 680] },
          { t: 2280, action: "chord", args: [[0, 1, 2, 3], 0.75, 1000] },
        ],
      },
      {
        name: "Double Stop Waltz",
        notes: [
          { t: 0, action: "chord", args: [[0, 1], 0.6, 600] },
          { t: 700, action: "chord", args: [[1, 2], 0.6, 600] },
          { t: 1400, action: "chord", args: [[2, 3], 0.65, 800] },
          { t: 2300, action: "chord", args: [[0, 1, 2, 3], 0.75, 1000] },
        ],
      },
      {
        name: "Rising Call",
        notes: [
          { t: 0, action: "bow", args: [0, 0.5, 550] },
          { t: 600, action: "bow", args: [1, 0.55, 550] },
          { t: 1200, action: "bow", args: [2, 0.6, 550] },
          { t: 1800, action: "bow", args: [3, 0.65, 750] },
          { t: 2650, action: "bow", args: [2, 0.6, 500] },
          { t: 3200, action: "bow", args: [1, 0.55, 500] },
          { t: 3750, action: "bow", args: [0, 0.5, 700] },
        ],
      },
      {
        name: "Drone and Melody",
        notes: [
          { t: 0, action: "bow", args: [0, 0.4, 2200] },
          { t: 400, action: "bow", args: [1, 0.6, 500] },
          { t: 1000, action: "bow", args: [2, 0.6, 500] },
          { t: 1600, action: "bow", args: [3, 0.65, 700] },
        ],
      },
    ],

    xylophone: [
      {
        name: "Mary Had a Little Lamb",
        notes: [2, 1, 0, 1, 2, 2, 2, 1, 1, 1, 2, 4, 4].map(function (bar, i) {
          return { t: i * 360, action: "strike", args: [bar, 0.85] };
        }),
      },
      {
        name: "Hot Cross Buns",
        notes: [2, 1, 0, 2, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 1, 0].map(function (bar, i) {
          return { t: i * 320, action: "strike", args: [bar, 0.85] };
        }),
      },
      {
        name: "Ode to Joy",
        notes: [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1].map(function (bar, i) {
          return { t: i * 340, action: "strike", args: [bar, 0.85] };
        }),
      },
      {
        name: "Jingle Bells",
        notes: [2, 2, 2, 2, 2, 2, 2, 4, 0, 1, 2].map(function (bar, i) {
          return { t: i * 330, action: "strike", args: [bar, 0.88] };
        }),
      },
    ],

    keyboard: [
      {
        name: "Twinkle Twinkle",
        notes: [7, 7, 11, 11, 12, 12, 11, 10, 10, 9, 9, 8, 8, 7].map(function (idx, i) {
          return { t: i * 420, action: "press", args: ["white", idx, 0.78, 380] };
        }),
      },
      {
        name: "Row Row Row Your Boat",
        notes: [7, 7, 7, 8, 9, 9, 8, 9, 10, 11].map(function (idx, i) {
          return { t: i * 400, action: "press", args: ["white", idx, 0.78, 360] };
        }),
      },
      {
        name: "London Bridge",
        notes: [11, 12, 11, 10, 9, 10, 11, 8].map(function (idx, i) {
          return { t: i * 400, action: "press", args: ["white", idx, 0.78, 360] };
        }),
      },
      {
        name: "Frere Jacques",
        notes: [7, 8, 9, 7, 7, 8, 9, 7, 9, 10, 11, 9, 10, 11].map(function (idx, i) {
          return { t: i * 340, action: "press", args: ["white", idx, 0.78, 300] };
        }),
      },
    ],
  };

  window.StrungPresets = PRESETS;
})();
