# alphaosk.com

The marketing site for [Alpha-OSK](https://github.com/owenpkent/alpha-osk), an on-screen
keyboard for Windows and Linux with on-device word prediction.

One page, no build step, no dependencies. Open `index.html` in a browser and what you see is
what deploys.

## Layout

```
index.html            The whole site. Everything is on one page.
404.html              Not-found page, styled from the same stylesheet.
styles/alphaosk.css   All styling. Palette tokens at the top.
scripts/alphaosk.js   Theme toggle, mobile menu, release-version lookup,
                      and the on-demand loader for the two files below.
scripts/demo.js       The live prediction demo's engine and keyboard.
scripts/demo-data.js  GENERATED. The demo's dictionary. Do not edit by hand.
images/               Logo, favicons, OG card, and the app screenshots.
netlify.toml          Publish config, security headers, cache rules, redirects.
site.webmanifest      Icons and colours for browsers that ask for them.
robots.txt            Allows everything, points at the sitemap.
sitemap.xml           One URL. Update `lastmod` when the copy changes materially.
tools/                Generators for the demo data and the images. Publicly served.
.gitattributes        Line-ending normalisation. See Conventions.
.git-blame-ignore-revs  Formatting-only commits for blame to skip.
```

## Breakpoints

The stylesheet is one file and mobile-first only in the sense that nothing in it
assumes a wide screen. Five widths change the layout, and they are all in
`styles/alphaosk.css` beside the component they affect rather than collected at
the bottom:

| Width     | What changes |
| --------- | ------------ |
| `860px`   | The header links fold into a menu panel behind the button in the header. Matched by `narrow` in `initNav`; change one and change the other. The footer's about block also takes a row of its own here, and its three link columns divide the row below it. |
| `600px`   | The header gives up its own Download button, which moves to the top of the menu panel, so that the brand and the two controls still fit at 320px. |
| `560px`   | Section padding tightens, the hero's two calls to action stack to a single width, and the demo panel breaks out of the page gutter to buy its keys back to about 26px. |
| `400px`   | The brand and its logo shrink a step. |
| `23.5em`  | The footer drops from three link columns to two. The only query here in `em`, and the reason is in the comment above it: it is asking whether the words still fit rather than how wide the device is. |

The footer is two nested grids, the same shape atdev.com uses: `.footer-grid`
decides whether the about block sits beside the links or above them, and
`.footer-links` inside it decides how many columns the links use. Keep them
separate. What was here before was one flat four-track row whose template mixed
`repeat(auto-fit, ...)` with a leading `minmax(0, 1.4fr)`, and those two fight:
auto-fit counts tracks by measuring the whole row, the `fr` track's minimum is
0, so the fitted tracks take what they want and the `fr` track lives on the
remainder. At 600px that remainder was 24 CSS px of about-paragraph, one word
per line, in a band of widths covering small tablets and any large phone held
sideways. Replacing auto-fit with `repeat(3, ...)` in a flat grid also works,
but it makes the two decisions share a template again and the next person has
to rediscover why the numbers are what they are.

`@media (hover: hover)` guards every `:hover` rule in the file. A touchscreen has
no hover, so the browser fakes one and leaves the last thing tapped looking
hovered until something else is tapped: buttons stayed lifted, cards stayed
raised, and keys in the demo panel stayed lit. If you add a `:hover` rule, put it
in one of those blocks and give touch the equivalent `:active`.

The narrowest viewport the site claims to support is 320px. `tools/` has no
harness for this; the check is a browser at that width with no horizontal
scrollbar on the page.

## Section rhythm

`main` alternates `.section` and `.section--alt` all the way down, and
`.section--alt` carries both a background and a top and bottom border, so two
of them in a row read as one long band with a seam through it. Inserting a
section therefore flips the parity of every section after it.

Add and remove sections **in pairs** where you can: two changes leave the tail
of the page untouched and only the sections between them have to flip. Merging
the prediction demo into `#how` and the screenshots into `#features` was a pair
for exactly this reason, so the footer's join never moved. If you change an odd
number, walk the rest of the page and flip each one, and check the join at the
footer, which expects to follow a plain `.section`.

That join is not a style preference. `.site-footer` and `.section--alt` both
paint `--bg-alt` and both draw a 1px border, so an alt section landing on the
footer merges the two into one tall band with a doubled seam through it.

**`#community` and `#faq` are both plain, and that is deliberate.** Removing
the closing CTA band left an odd number of sections, and with eight of them
after the hero there is no arrangement that both alternates strictly and ends
plain: one repeat has to go somewhere. It is parked here because `.faq` carries
its own border and `--surface` background, so the FAQ still reads as a distinct
card against the plain section behind it. Two plain sections in a row cost
nothing; two `--alt` ones would show a seam. If you add a section, prefer
restoring the alternation over preserving this pair.

## The hero aura

Two soft colour fields drift behind the hero, on `.hero::before` and
`.hero::after`. They are the only animation on the site that runs on its own,
so they carry three rules rather than one:

- **Only `transform` animates.** A drifting `background-position`, an animated
  `filter`, or anything that changes geometry would repaint a viewport-sized
  area sixty times a second. Measured over three seconds of animation with the
  DevTools performance metrics: zero layouts, and 0.1ms of style recalculation
  in total. That is the whole budget a decoration gets.
- **`prefers-reduced-motion` sets `animation: none`, not a fast-forward.** The
  blanket rule in the Motion block stops an animation by running it to its end
  in a millisecond, which would park the two fields on their `to` keyframe: an
  arrangement picked for the far end of a drift, not for standing still. The
  aura overrides that with `none`, so it sits where the CSS put it, and the
  gradients still paint. Someone who has asked for less motion gets the same
  decoration, still.
- **The alphas in `--aura-1` and `--aura-2` are set by measurement.** The
  fields sit under the hero's muted text, and the file already warned that the
  single static bloom they replaced lifted the effective background enough to
  drag `--ink-faint` under AA. Both were swept across 25 combinations of the
  two animation phases, in both themes, at 1280px and 390px, sampling the
  composited pixels behind each block of hero text rather than the token
  colour: the worst frame anywhere is `.hero__lede` at 6.11:1 against a 4.5
  requirement. Raise either alpha and that has to be re-measured, because axe
  will not do it for you: it returns "incomplete" rather than a verdict
  whenever the background it would sample is a gradient.

`initAura` in `scripts/alphaosk.js` pauses the pair once the hero scrolls out
of view, which is a battery question rather than a correctness one. Nothing
depends on it: with scripts off the animation simply runs.

## Local preview

There is no build. Any static server works; a plain `file://` open works too, apart from the
absolute `/styles/...` paths, so prefer a server:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Netlify headers are not applied by a local server, so a Content-Security-Policy mistake will not
show up until it is deployed. Check the browser console on the deploy preview after changing
`netlify.toml` or adding any external resource.

## Where the content comes from

The copy is derived from the app's own `README.md` and `docs/PRIVACY.md`. When a claim on this
site and a claim in that repo disagree, **the repo is right and this site is stale**. The claims
most likely to go stale, in rough order:

- the platform table in the Download section (macOS is listed as not yet released)
- the privacy prose, in particular the FAQ's note that the telemetry endpoint is not deployed
- the "2,250+ tests" figure in the stat strip
- the screenshots in `#features`, whenever the UI they show changes

`#features` is screenshots and nothing else, on purpose: a shipped feature does not
automatically earn a paragraph there. Before adding one, check whether a screenshot already
shows it and whether the FAQ is the better home, because the section grew to ten prose cards
beside seven captioned screenshots once already and half of it was saying things twice.

The version number is **not** in this repo. `scripts/alphaosk.js` reads the latest tag from the
GitHub releases API at page load, so a release never requires a site edit. If that request fails
the buttons fall back to the static text in the markup, which is why none of them say a version
number on their own.

## Screenshots

Copied from `alpha-osk/assets/screenshots/`, which are generated by that repo's
`scripts/capture_screenshots.py` against a sandboxed config directory and a demo vocabulary.
Nothing in them is anybody's real typing. To refresh them, regenerate there and copy across:

```bash
cp ../alpha-osk/assets/screenshots/*.png images/screenshots/
```

The favicons and the Open Graph card are generated from the app's own logo by
`tools/gen_assets.py`, so the site's icon and the app's icon cannot drift apart.

## The live demo

The keyboard at the foot of the `#how` section is real: `scripts/demo.js` runs a
prediction pass on every keypress, over the application's own wordlist, in the
visitor's browser. Nothing typed into it is sent anywhere and nothing is
persisted, so there is no privacy claim on the rest of the page that it
undermines.

It keeps its own `#prediction` anchor even though it no longer has a section to
itself, because that anchor is linked to from outside the site. The same goes
for `#pointer` on the right-click section, which nothing on the page links to
any more.

**Neither of the demo's two files is in `index.html`, on purpose.** They are 108
KB between them, all of it for one panel two thirds of the way down the page, and
in the markup they were the largest thing a phone downloaded whether or not the
visitor ever scrolled that far. `initDemo` in `scripts/alphaosk.js` fetches them
when the panel comes within a screen of the viewport, in order and with the same
`?v=` query `alphaosk.js` was itself requested with. Adding script tags back to
the markup would load both twice, and `demo.js` runs a full keyboard build on
each pass. If the panel ever shows its fallback paragraph and nothing else, check
that loader before anything in `demo.js`.

**It is a reimplementation, not the Python engine compiled to the web,** and the
page says so in as many words. Pyodide or a WASM build would be tens of
megabytes on a page whose entire current weight is under one, for a demo most
visitors interact with for ten seconds.

What is genuinely shared is the data and the constants:

- `scripts/demo-data.js` is generated by `tools/gen_demo_data.py` straight from
  the app repo's `data/google-10000-english-usa-no-swears.txt` and
  `data/common_bigrams.txt`, filtered through the app's own
  `language.ENGLISH` profile. The fragment filter is not reimplemented; the
  profile's vowel, semivowel and short-word sets are imported and used, so
  changing them in the app reaches the demo the next time the generator runs.
- The scoring constants taken from the engine name the Python attribute they
  came from, so the two can be diffed: `KEY_SIGMA`, `FREQ_WEIGHT`, `LOG_OMIT`,
  `LOG_EXTRA`, `LOG_TRANSPOSE`, `FREQUENCY_MAY_BUY`, `MIN_FUZZY_PREFIX` and
  `POS`. The header comment in `demo.js` carries the mapping.
- The rest are this file's own and have no counterpart in the engine, so tuning
  the engine should not be expected to move them: `FIRST_KEY_ANCHOR`,
  `NEIGHBOUR_RADIUS2`, `BIGRAM_TOP`, `BIGRAM_STEP`, `PRUNE_FLOOR`,
  `MAX_EXTRA_KEYS`, `MAX_PILLS`. They are pruning and presentation choices for
  a panel on a marketing page. `FIRST_KEY_ANCHOR` is the interesting one and is
  documented at length where it is declared: it exists because the real engine
  has the user's own vocabulary and live sentence context to rank with, and
  this page has neither.

Regenerate the dictionary after the app's wordlist changes:

```bash
python tools/gen_demo_data.py            # assumes ../alpha-osk
python tools/gen_demo_data.py path/to/alpha-osk
```

Measured behaviour, worth re-checking if you touch the scoring: typing `hwllo`
(W instead of the adjacent E) puts `hello` first; `keybpa` puts `keyboard`
first; `accesd` puts `access` first; `prwdic` puts `prediction` second. A
*missed* click is weaker than a slipped one (`thn` does not surface `then`),
which matches the shipped engine's own measured profile, where a dropped click
recovers far less often than a neighbour slip. Cost is 0.5 to 1.6 ms per
keystroke including the pill rebuild.

## Deployment

Netlify, publishing the repo root on every push to `main`. There is no build step:
`netlify.toml` sets `publish = "."` and no build command, so a push *is* the deploy.

Publishing the repo root means everything in it is fetchable. Verified against the live site:
`/tools/gen_demo_data.py` and `/LICENSE` return 200, `/README.md` returns 404 through the
redirect in `netlify.toml`, and dotfiles like `/.gitattributes` are refused by Netlify. Nothing
in here is secret, so that is fine as it stands, but anything added to the repo that should not
be public needs its own redirect in the same commit that adds it.

**How it is wired now.** The Netlify project is `whimsical-clafoutis-433ae0`, connected to
`github.com/owenpkent/alpha-osk-website` with auto-publishing on, serving `alphaosk.com` as the
primary domain and redirecting `www.alphaosk.com` to it, both on Netlify DNS.

That project does **not** live under the ATDev team, which is worth writing down because it is
invisible from the CLI signed in that way: `netlify sites:list` will not list the project and
`netlify api getDnsZones` will not list the zone. Finding nothing there is not evidence that the
site is unconfigured, and creating a second project because it looked missing only produces a
duplicate serving the same content on a second hostname.

Rebuilding it from nothing, in order:

1. Netlify, **Add new site, Import an existing project**, and pick this repository. Leave the
   build command empty and set the publish directory to `.`; `netlify.toml` already declares
   both, so the UI should prefill them.
2. **Domain management, Add a custom domain**, `alphaosk.com`, and point the domain's DNS at
   Netlify as it instructs.
3. Set `alphaosk.com` as the **Primary domain** with *Redirect automatically to primary domain*
   turned on. The `www` redirect in `netlify.toml` is a second layer under that, not a
   replacement for it: the Netlify setting is what covers hosts the redirect rule does not name.
4. Open the first deploy preview with the browser console showing and confirm nothing is blocked.

That last step is not optional. `netlify.toml` ships an **enforced** Content-Security-Policy
rather than a report-only one, and a local server applies none of Netlify's headers, so a CSP
mistake cannot show up until the site is deployed. The three things the policy has to keep
allowing are the Google Fonts stylesheet and its font files, the inline no-flash theme script in
the `<head>`, and `https://api.github.com` for the release-version lookup. Adding any external
resource means adding its origin in the same commit as the tag that pulls it in.

### When the site looks like it is not deploying

Establish what is being served before touching anything:

```bash
curl.exe -sSI https://alphaosk.com | rg -i '^server'
```

`curl.exe`, not `curl`: PowerShell aliases `curl` to `Invoke-WebRequest`, which does not take
any of these flags and fails with "a parameter cannot be found that matches parameter name
'sSI'". Windows ships the real binary, and the `.exe` is what reaches it.

`Server: Netlify` means the deploy is fine and the question is which version, not whether. Check
the published commit in the Netlify UI, and remember the deploys list can lag a minute behind a
merge.

`Server: Squarespace` means the request never reached Netlify at all. The domain is registered
through Squarespace, and any resolver still holding the pre-delegation records keeps sending
traffic to their parking page long after the nameservers have changed. This is a local
resolution problem, it does not reproduce for anyone else, and nothing about the deploy will fix
it. Compare the authoritative answer with your own:

```bash
nslookup alphaosk.com dns1.p09.nsone.net   # authoritative: expect 52.52.192.191
nslookup alphaosk.com                      # yours: if these differ, that is the whole answer
```

The apex is a `NETLIFY` record pointing at the project's `.netlify.app` host, the same shape the
other sites on this account use. Windows caches separately from the router, so
`Clear-DnsClientCache` clears only half of it, and a `Get-DnsClientCache` entry that reappears
with a still-counting-down TTL is coming from upstream. Either wait it out, point the machine at
`1.1.1.1`, or restart the router. To confirm the live site meanwhile, bypass DNS entirely:

```bash
curl.exe -sSI --resolve alphaosk.com:443:52.52.192.191 https://alphaosk.com
```

## Repository visibility

Private at the moment. Nothing here is secret, so making it public is reasonable and is a single
command:

```bash
gh repo edit owenpkent/alpha-osk-website --visibility public --accept-visibility-change-consequences
```

It starts private only because that is the reversible direction: a repository can always be
published later, whereas un-publishing one that has already been cloned or indexed does not
really undo anything.

## Conventions

Same as the main repo: conventional commits, no em dashes anywhere, and comments that explain
the non-obvious *why* rather than restating the markup.

Line endings are normalised to LF in the repository by `.gitattributes` (`* text=auto`). This is
not cosmetic. `core.autocrlf` is unset, so before that file existed git converted nothing and
whatever an editor happened to write was what got committed, which once turned a thirty-line
change into 279 deletions and 279 insertions and moved blame for an entire file onto a single
commit. The commit that did the normalising is listed in `.git-blame-ignore-revs`; GitHub reads
that file automatically, and locally it needs enabling once:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```
