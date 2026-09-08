/* ---------------------------------------------------------------------------
   alphaosk.com
   ---------------------------------------------------------------------------
   Two small things, neither of which the page depends on to be readable:
     1. the theme toggle
     2. the release, read from the GitHub API so the version is never stale
        and each download button points at the file it names rather than at a
        page listing every file
   Everything degrades: with JavaScript off you get the dark theme and buttons
   that say "Latest release" and open the releases page, which is where those
   files are.

   The interactive prediction demo lives in scripts/demo.js, with its dictionary
   in the generated scripts/demo-data.js, because it is an order of magnitude
   bigger than everything here and most visitors never reach it. Those two are
   not in the markup: initDemo below fetches them when the panel gets close to
   the viewport.
--------------------------------------------------------------------------- */

(function () {
  "use strict";

  // The cache-busting query this file was itself requested with, so the two
  // scripts it goes on to fetch stay on the same version as the rest of the
  // page and there is one string to change rather than three. Read here rather
  // than inside initDemo because document.currentScript is only meaningful
  // while the script is executing.
  var VERSION = (document.currentScript && document.currentScript.src.replace(/^[^?]*/, "")) || "";

  /* ---------- Theme ---------- */

  function initTheme() {
    var toggle = document.getElementById("themeToggle");
    var meta = document.getElementById("themeColor");
    if (!toggle) return;

    // The colour behind the browser chrome has to track the theme, or a light
    // page sits under a black status bar on mobile.
    var CHROME = { dark: "#0e0e10", light: "#f7f7f9" };

    // Only a click persists. This used to write on every call including the
    // one below, which runs at load with whatever the head script derived from
    // prefers-color-scheme, so the first visit silently recorded a choice the
    // visitor had not made: someone whose machine switches to dark in the
    // evening, or who turns dark mode on next week, kept getting the light
    // site for ever, with a toggle they had never touched as the only way out.
    function apply(theme, persist) {
      document.documentElement.setAttribute("data-theme", theme);
      toggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
      if (meta) meta.setAttribute("content", CHROME[theme]);
      if (!persist) return;
      try {
        localStorage.setItem("alphaosk-theme", theme);
      } catch (e) {
        /* private mode: the choice just does not persist */
      }
    }

    apply(document.documentElement.getAttribute("data-theme") || "dark", false);

    toggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      apply(current === "dark" ? "light" : "dark", true);
    });

    // And until they do touch it, follow the machine. A visitor on a schedule
    // that flips at sunset should not have to reload to be taken with it.
    var scheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)");
    if (scheme && scheme.addEventListener) {
      scheme.addEventListener("change", function (e) {
        var chosen = null;
        try {
          chosen = localStorage.getItem("alphaosk-theme");
        } catch (err) {
          /* unreadable storage means no stored choice to honour */
        }
        if (!chosen) apply(e.matches ? "light" : "dark", false);
      });
    }
  }

  /* ---------- Release version and direct downloads ---------- */

  /* One request answers two questions. Every download button ships pointing at
     the releases page, which is the href that is always right and always costs
     the visitor a second page and a hunt through the assets for the one file
     they wanted. The release JSON names those assets, so once it lands each
     button is pointed straight at its own file and the click downloads.

     data-download carries the extension of the file a button is for rather
     than its name, because the version number is part of every asset name and
     so no name is stable enough to hard-code.

     Both halves fail the same way: the markup is left exactly as it was
     served, which is a working page either way. */

  function initRelease() {
    var labels = document.querySelectorAll("[data-version-label]");
    var buttons = document.querySelectorAll("[data-download]");
    if (!labels.length && !buttons.length) return;

    // Keep what the markup already said. The version is prepended to it rather
    // than replacing it, so a failed fetch leaves buttons that still read
    // correctly instead of ones that read "undefined".
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
        var assets = (release && release.assets) || [];

        Array.prototype.forEach.call(labels, function (el) {
          el.textContent = version + " · " + el.dataset.baseText;
        });

        Array.prototype.forEach.call(buttons, function (el) {
          var auto = el.dataset.download === "auto";
          var wanted = auto ? platformExtension() : el.dataset.download;
          var asset = findAsset(assets, wanted);
          // Nothing published that this button can offer this visitor. Most of
          // them are right to keep the href they were served with, which is the
          // releases page for the platform cards and the Download section for
          // the "Download" buttons: both say what does exist, which is the only
          // honest answer when the file does not.
          if (!asset) {
            applyFallback(el);
            return;
          }

          el.href = asset.browser_download_url;

          // Once the button is the file rather than a page about the file, the
          // size is the thing worth knowing before the click, and for the
          // "Download" buttons so is which platform they just resolved to.
          var parts = [version];
          if (auto) parts.push(PLATFORM_NAMES[wanted]);
          var label = el.querySelector("[data-version-label]");
          if (label) {
            parts.push(asset.size ? megabytes(asset.size) : label.dataset.baseText);
            label.textContent = parts.join(" · ");
          } else if (auto) {
            // The header button is the word "Download" and nothing else. It now
            // fetches a named file for a named platform, so the accessible name
            // has to say so: it no longer just moves down the page.
            el.setAttribute("aria-label", "Download Alpha-OSK " + version + " for " +
              PLATFORM_NAMES[wanted] + (asset.size ? ", " + megabytes(asset.size) : ""));
          }

          if (auto) armScrollOnDownload(el);
        });
      })
      .catch(function () {
        /* Rate limited, offline, or blocked. The markup as served stands. */
      });
  }

  var PLATFORM_NAMES = { exe: "Windows", AppImage: "Linux" };

  /* The visitor's platform as the extension of the file they want, or null for
     a visitor this page has no file for. Null is a result, not a failure: it
     leaves the button pointing at the Download section, which is where a
     platform the project does not ship for is explained.

     Android and ChromeOS are ruled out first because both say Linux in a user
     agent string and neither runs a desktop AppImage. macOS falls through to
     null on purpose: the build is not released, and the Download section says
     so. */

  function platformExtension() {
    var data = navigator.userAgentData;
    var platform = (data && data.platform) || "";
    var ua = navigator.userAgent || "";
    var both = platform + " " + ua;

    if (/Android|CrOS|Chrome OS/i.test(both)) return null;
    if (/Win/i.test(both)) return "exe";
    if (/Linux|X11/i.test(both)) return "AppImage";
    return null;
  }

  /* A cross-origin file served as an attachment downloads without the page
     navigating, so a button that used to scroll now looks like it does nothing
     at all: the one complaint this whole change exists to answer. Moving to the
     Download section is the acknowledgement, and it is the section worth
     landing on anyway, because the note about Windows holding the installer at
     first run is in it.

     The hash rather than scrollIntoView because :target is what carries the
     offset that keeps the heading out from under the sticky header. */

  function armScrollOnDownload(el) {
    el.addEventListener("click", function () {
      if (window.location.hash === "#download") return;
      window.location.hash = "download";
    });
  }

  /* The exception to that. The Linux AppImage is built by build/linux/build.py
     in the app repo and has never been attached to a release, so "Download
     AppImage" pointed at a releases page with no AppImage on it: the one
     fallback that leads nowhere. A button carrying data-download-fallback says
     what to do instead, and says it only on the evidence of the release itself,
     so the first release that carries the file turns this back into a download
     with no edit here.

     Nothing is stated in this function: every string it uses is an attribute in
     the markup, next to the copy it replaces. */

  function applyFallback(el) {
    if (!el.dataset.downloadFallback) return;

    el.href = el.dataset.downloadFallback;

    var label = el.querySelector("[data-download-label]");
    if (label && el.dataset.downloadFallbackLabel) {
      label.textContent = el.dataset.downloadFallbackLabel;
    }
    // Overwrites the version the pass above put here, which named a release
    // that does not contain this file.
    var sub = el.querySelector("[data-version-label]");
    if (sub && el.dataset.downloadFallbackSub) {
      sub.textContent = el.dataset.downloadFallbackSub;
    }
  }

  function findAsset(assets, extension) {
    if (!extension) return null;
    var wanted = ("." + extension).toLowerCase();
    for (var i = 0; i < assets.length; i++) {
      var name = (assets[i].name || "").toLowerCase();
      if (name.slice(-wanted.length) === wanted && assets[i].browser_download_url) return assets[i];
    }
    return null;
  }

  // Binary megabytes to one decimal, which is the figure the visitor's own
  // browser is about to show them in its downloads list.
  function megabytes(bytes) {
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  /* ---------- Published usage figures ---------- */

  /* The two numbers in the hero. They are the application's own opt-in
     counters, summed across installs and appended to a dated CSV once a day,
     which is what makes them quotable at all: anyone can open the file and
     check the row. Nothing here measures the visitor.

     The markup already carries the last known row, so this is a correction
     rather than a fill, and every failure path below is a silent return that
     leaves those static figures standing. */

  function initUsage() {
    var savedEl = document.querySelector("[data-usage-saved]");
    var pctEl = document.querySelector("[data-usage-pct]");
    var asOfEl = document.querySelector("[data-usage-asof]");
    if (!savedEl || !pctEl) return;

    fetch("https://raw.githubusercontent.com/owenpkent/alpha-osk/telemetry-data/docs/research/data/telemetry-aggregate.csv")
      .then(function (response) {
        if (!response.ok) throw new Error("usage lookup failed: " + response.status);
        return response.text();
      })
      .then(function (csv) {
        var rows = csv.trim().split(/\r?\n/);
        // Header plus at least one row. The workflow only ever appends, so the
        // last line is the newest.
        if (rows.length < 2) return;

        var cells = rows[rows.length - 1].split(",").map(function (cell) {
          return cell.trim().replace(/^"|"$/g, "");
        });

        // date,users,keystrokes,words,predictions,keystrokes_saved,minutes,...
        var pressed = Number(cells[2]);
        var saved = Number(cells[5]);
        var total = pressed + saved;

        // A day nobody has reported yet is a row of zeros, and dividing by it
        // would put "NaN%" in the headline. The static copy is better.
        if (!isFinite(pressed) || !isFinite(saved) || total <= 0) return;

        savedEl.textContent = saved.toLocaleString();
        // Matches the application's own Effort Saved tile: the share of the
        // keystrokes the words would have cost that were never pressed.
        pctEl.textContent = Math.round((saved / total) * 100) + "%";

        if (asOfEl && /^\d{4}-\d{2}-\d{2}$/.test(cells[0])) {
          var parts = cells[0].split("-");
          // Built in UTC and read back in UTC. Left to the local timezone, a
          // visitor behind it renders the row as the previous day.
          var when = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
          asOfEl.textContent = "as of " + when.toLocaleDateString(undefined, {
            day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
          });
        }
      })
      .catch(function () {
        /* Offline, blocked, or the data branch moved. The static figures stand. */
      });
  }

  /* ---------- Navigation ---------- */

  /* Below 860px the header links collapse behind a menu button. Everything
     here is about the ways a disclosure panel gets left open by mistake: it
     covers the top of the page while it is, and on a phone that is most of
     what you can see. */

  function initNav() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("primaryNav");
    if (!toggle || !nav) return;

    // The same 860px the stylesheet folds the links at. The two have to agree:
    // above it the panel's CSS stops applying and the links return to the
    // header row on their own.
    var narrow = window.matchMedia("(max-width: 860px)");

    function isOpen() {
      return toggle.getAttribute("aria-expanded") === "true";
    }

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) nav.setAttribute("data-open", "");
      else nav.removeAttribute("data-open");
    }

    toggle.addEventListener("click", function () {
      setOpen(!isOpen());
    });

    // Every link in the panel is either an anchor on this page or a link off
    // it. In the first case the panel would be left sitting over the heading
    // it just scrolled to.
    nav.addEventListener("click", function (e) {
      var el = e.target;
      while (el && el !== nav) {
        if (el.tagName === "A") {
          setOpen(false);
          return;
        }
        el = el.parentNode;
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!isOpen()) return;
      if (e.key !== "Escape" && e.key !== "Esc" && e.keyCode !== 27) return;
      setOpen(false);
      // Escape moves focus back to what opened the panel, or it is left on an
      // element that is no longer displayed and the next Tab starts from the
      // top of the document.
      toggle.focus();
    });

    // A tap anywhere else is the other way people close one of these.
    // pointerdown rather than click, because iOS does not bubble a tap on an
    // element that is not itself clickable up to the document, and the whole
    // point of this listener is the taps that land on nothing in particular.
    // The panel and the button are excluded: the toggle has its own handler,
    // and a link in the panel is handled above.
    document.addEventListener("PointerEvent" in window ? "pointerdown" : "click", function (e) {
      if (!isOpen()) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    });

    // Turning a phone to landscape can cross the breakpoint with the panel
    // open. Above it the links are back in the header, so leaving the state
    // set would strand aria-expanded="true" on a button nobody can see and
    // leave data-open on a nav that is no longer a panel.
    function syncToWidth() {
      if (!narrow.matches) setOpen(false);
    }

    if (narrow.addEventListener) narrow.addEventListener("change", syncToWidth);
    else if (narrow.addListener) narrow.addListener(syncToWidth);
    syncToWidth();
  }

  /* ---------- Prediction demo ---------- */

  /* scripts/demo-data.js and scripts/demo.js are 108 KB between them, all of
     it for one panel about two thirds of the way down the page. Loading them
     with the document made them the largest thing this site downloaded, on a
     connection where that costs the most and for a panel most visitors never
     scroll to.

     They are fetched a screen ahead of the panel instead, so by the time it is
     on screen it is already live. The panel says what it is waiting for until
     then: the stylesheet shows .kbdemo__fallback until demo.js sets
     data-demo-ready, which is the same state as scripts being switched off. */

  function initDemo() {
    var panel = document.getElementById("kbdemo");
    if (!panel) return;

    // The panel ships about 84px tall and builds out to about 415px, and it
    // sits above five of the page's six anchors. Anything that jumped to one of
    // them from higher up the page landed correctly and was then pushed a third
    // of a screen out of place, because the jump scrolls the panel into view,
    // which is what starts the load that grows it. Reserving the built height
    // now, while the visitor is still at the top of the page, means the build
    // moves nothing. It is set here rather than in the stylesheet so that a
    // visitor with no scripts, whose panel is never going to grow, still gets a
    // panel the size of the message actually in it.
    panel.setAttribute("data-demo-reserved", "");

    var loaded = false;

    function load() {
      if (loaded) return;
      loaded = true;

      // async = false on a script the document did not contain is what keeps
      // the pair in order. Without it demo.js can arrive first and find no
      // window.ALPHA_OSK_DEMO_DATA, which it reports as a broken demo.
      ["/scripts/demo-data.js", "/scripts/demo.js"].forEach(function (src) {
        var el = document.createElement("script");
        el.src = src + VERSION;
        el.async = false;
        document.body.appendChild(el);
      });
    }

    // No IntersectionObserver means an older browser, and guessing at scroll
    // positions to save it a download is a worse trade than the download.
    if (!("IntersectionObserver" in window)) {
      load();
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        io.disconnect();
        load();
        return;
      }
    }, { rootMargin: "600px 0px" });

    io.observe(panel);
  }

  /* ---------- Hero aura ---------- */

  /* The two drifting colour fields behind the hero are pure CSS and need no
     help to run. This only stops them once the hero has scrolled away, because
     a compositor that keeps waking up for something nobody can see is a
     battery cost with no picture attached, and a fair number of the people
     this site is for are reading it on a tablet propped somewhere all day.

     Nothing here is the accessibility control for the animation. That is
     prefers-reduced-motion, which the stylesheet honours whether or not any of
     this runs. */

  function initAura() {
    var hero = document.querySelector(".hero");
    if (!hero || !("IntersectionObserver" in window)) return;

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) hero.removeAttribute("data-aura-paused");
        else hero.setAttribute("data-aura-paused", "");
      }
    });

    io.observe(hero);
  }

  /* ---------- Footer year ---------- */

  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ---------- Boot ---------- */

  initTheme();
  initNav();
  initAura();
  initDemo();
  initRelease();
  initUsage();
  initYear();
})();
