/* ---------------------------------------------------------------------------
   alphaosk.com
   ---------------------------------------------------------------------------
   Two small things, neither of which the page depends on to be readable:
     1. the theme toggle
     2. the release version, read from the GitHub API so it is never stale
   Everything degrades: with JavaScript off you get the dark theme and buttons
   that say "Latest release".

   The interactive prediction demo lives in scripts/demo.js, with its dictionary
   in the generated scripts/demo-data.js, because it is an order of magnitude
   bigger than everything here and most visitors never reach it.
--------------------------------------------------------------------------- */

(function () {
  "use strict";

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

  /* ---------- Footer year ---------- */

  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ---------- Boot ---------- */

  initTheme();
  initVersion();
  initYear();
})();
