/* ---------------------------------------------------------------------------
   alphaosk.com
   ---------------------------------------------------------------------------
   Three small things, none of which the page depends on to be readable:
     1. the theme toggle
     2. the release version, read from the GitHub API so it is never stale
     3. the prediction demo animation
   Everything degrades: with JavaScript off you get the dark theme, buttons that
   say "Latest release", and a demo panel showing its own finished state.
--------------------------------------------------------------------------- */

(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Theme ---------- */

  function initTheme() {
    var toggle = document.getElementById("themeToggle");
    var meta = document.getElementById("themeColor");
    if (!toggle) return;

    // The colour behind the browser chrome has to track the theme, or a light
    // page sits under a black status bar on mobile.
    var CHROME = { dark: "#0e0e10", light: "#f7f7f9" };

    function apply(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      toggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
      if (meta) meta.setAttribute("content", CHROME[theme]);
      try {
        localStorage.setItem("alphaosk-theme", theme);
      } catch (e) {
        /* private mode: the choice just does not persist */
      }
    }

    apply(document.documentElement.getAttribute("data-theme") || "dark");

    toggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      apply(current === "dark" ? "light" : "dark");
    });
  }

  /* ---------- Release version ---------- */

  function initVersion() {
    var labels = document.querySelectorAll("[data-version-label]");
    if (!labels.length) return;

    // Keep what the markup already said. The version is prepended to it rather
    // than replacing it, so a failed fetch leaves three buttons that still read
    // correctly instead of three that read "undefined".
    Array.prototype.forEach.call(labels, function (el) {
      el.dataset.baseText = el.textContent.trim();
    });

    fetch("https://api.github.com/repos/owenpkent/alpha-osk-releases/releases/latest", {
      headers: { Accept: "application/vnd.github+json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("release lookup failed: " + response.status);
        return response.json();
      })
      .then(function (release) {
        var tag = (release && release.tag_name) || "";
        // Tags are published as vX.Y.Z; show them the same way.
        if (!/^v?\d+\.\d+\.\d+/.test(tag)) return;
        var version = tag.charAt(0) === "v" ? tag : "v" + tag;

        Array.prototype.forEach.call(labels, function (el) {
          el.textContent = version + " · " + el.dataset.baseText;
        });
      })
      .catch(function () {
        /* Rate limited, offline, or blocked. The static labels stand. */
      });
  }

  /* ---------- Prediction demo ---------- */

  /*
    The scripted story, and it is the one the prose beside it tells: the user is
    typing "report", their second click lands on W instead of the E next to it,
    and the engine completes the word anyway.

    Pills are what the real engine would plausibly return for each prefix. They
    are illustrative, not generated: this is a marketing panel, not a simulator,
    and pretending otherwise would be the dishonest version.
  */
  var TOP_ROW = "qwertyuiop".split("");

  var SCRIPT = [
    { text: "r", key: "r", pills: ["right", "really", "run"] },
    { text: "rw", key: "w", pills: ["report", "review", "right"], slip: true },
    { text: "rwp", key: "p", pills: ["report", "reply", "repeat"] },
    { text: "rwpo", key: "o", pills: ["report", "reporter", "reports"] }
  ];

  var FINAL_TEXT = "report ";
  var FINAL_PILLS = ["on", "to", "for"];

  function initDemo() {
    var textEl = document.getElementById("demoText");
    var pillsEl = document.getElementById("demoPills");
    var keysEl = document.getElementById("demoKeys");
    if (!textEl || !pillsEl || !keysEl) return;

    // Build the key row once.
    var keyNodes = {};
    TOP_ROW.forEach(function (letter) {
      var key = document.createElement("div");
      key.className = "demo__key";
      key.textContent = letter.toUpperCase();
      keysEl.appendChild(key);
      keyNodes[letter] = key;
    });

    function renderPills(words, takenIndex) {
      pillsEl.textContent = "";
      words.forEach(function (word, i) {
        var pill = document.createElement("div");
        pill.className = "demo__pill";
        pill.textContent = word;
        if (i === takenIndex) pill.dataset.taken = "true";
        pillsEl.appendChild(pill);
      });
    }

    function litKey(letter) {
      Object.keys(keyNodes).forEach(function (k) {
        if (letter && k === letter) {
          keyNodes[k].dataset.lit = "true";
        } else {
          delete keyNodes[k].dataset.lit;
        }
      });
    }

    function showFinished() {
      textEl.textContent = FINAL_TEXT;
      renderPills(FINAL_PILLS, -1);
      litKey(null);
    }

    // No animation for anyone who has asked not to have one. The panel still
    // shows the outcome, which is the part that carries the argument.
    if (reduceMotion) {
      showFinished();
      return;
    }

    var timers = [];
    var running = false;

    function at(ms, fn) {
      timers.push(window.setTimeout(fn, ms));
    }

    function stop() {
      timers.forEach(window.clearTimeout);
      timers = [];
      running = false;
    }

    function run() {
      if (running) return;
      running = true;

      var t = 0;
      textEl.textContent = "";
      renderPills([], -1);
      litKey(null);

      SCRIPT.forEach(function (frame) {
        t += 560;
        at(t, function () {
          textEl.textContent = frame.text;
          litKey(frame.key);
          renderPills(frame.pills, -1);
        });
        at(t + 240, function () {
          litKey(null);
        });
      });

      // A beat, then the first pill is taken and the word is completed.
      t += 900;
      at(t, function () {
        renderPills(SCRIPT[SCRIPT.length - 1].pills, 0);
      });

      t += 620;
      at(t, function () {
        showFinished();
      });

      // Hold the result, then loop.
      t += 3200;
      at(t, function () {
        running = false;
        run();
      });
    }

    showFinished();

    // Only animate while the panel is actually on screen. A loop running in a
    // background tab or three screens down the page is wasted battery.
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              run();
            } else {
              stop();
              showFinished();
            }
          });
        },
        { threshold: 0.35 }
      );
      observer.observe(pillsEl.closest(".demo__stage") || pillsEl);
    } else {
      run();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stop();
        showFinished();
      }
    });
  }

  /* ---------- Footer year ---------- */

  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ---------- Boot ---------- */

  initTheme();
  initVersion();
  initYear();
  initDemo();
})();
