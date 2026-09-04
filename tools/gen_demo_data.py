"""Build the in-browser demo's dictionary from the application's own data files.

The demo on alphaosk.com is a reimplementation of the prediction approach in
JavaScript, not the Python engine itself, so the one thing that must not drift
is the *data*: the same wordlist, the same fragment filter, the same
rank-derived frequencies and the same curated bigrams the shipped keyboard
starts from. Generating it here rather than hand-maintaining a word list is what
keeps that true.

The fragment filter is not reimplemented either. `language.ENGLISH` is loaded
straight out of the app repo and its own vowel, semivowel and short-word sets
decide what survives, so a change there reaches the demo the next time this runs.

    python tools/gen_demo_data.py [path-to-alpha-osk-repo]

Writes scripts/demo-data.js. Defaults to ../alpha-osk.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent

# How many words reach the browser. Every entry costs download size on a page
# most visitors scroll past, so this is a real trade rather than a maximum.
# 5,000 was tried first and was too tight: "prediction" fell outside it, which
# is close to the first word somebody types into a demo on this particular
# site. 8,000 covers the vocabulary a visitor will reach for and still gzips to
# around 30 KB, less than a tenth of one screenshot on the same page.
MAX_WORDS = 8000


def load_english_profile(app_repo: Path):
    """Import the app's language profile without importing the whole package.

    `src.prediction.__init__` pulls in the predictors, which pull in numpy and
    friends. Loading the one module by path keeps this script dependency-free.
    """
    module_path = app_repo / "src" / "prediction" / "language.py"
    if not module_path.is_file():
        raise SystemExit(f"cannot find {module_path}; pass the alpha-osk repo path as argv[1]")
    spec = importlib.util.spec_from_file_location("_alpha_osk_language", module_path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"cannot load {module_path}")
    module = importlib.util.module_from_spec(spec)
    # @dataclass resolves its own annotations through sys.modules, so the module
    # has to be registered before it executes or the decorator fails.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.ENGLISH


def is_plausible(word: str, profile) -> bool:
    """The app's `NgramPredictor._is_plausible_word`, driven by the same sets.

    Length <= 2 must be on the allow-list. Longer words need at least one vowel
    and at least one non-vowel, which rejects both consonant clusters ("xqz")
    and vowel mashing ("aaaa"). A semivowel ('y' in English) counts on both
    sides, so "cry" and "eye" both survive.
    """
    n = len(word)
    if n == 0:
        return False
    if n <= 2:
        return profile.is_short_word(word)
    has_vowel = False
    has_consonant = False
    for c in word:
        if c in profile.vowels:
            has_vowel = True
        elif c in profile.semivowels:
            has_vowel = True
            has_consonant = True
        else:
            has_consonant = True
    return has_vowel and has_consonant


def main() -> None:
    app_repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else (SITE.parent / "alpha-osk")
    profile = load_english_profile(app_repo)

    freq_list = app_repo / "data" / "google-10000-english-usa-no-swears.txt"
    bigram_file = app_repo / "data" / "common_bigrams.txt"
    for f in (freq_list, bigram_file):
        if not f.is_file():
            raise SystemExit(f"missing {f}")

    # Rank order is frequency order, and the app derives a count from position
    # rather than storing one, so the ordered list is the whole model. Keeping
    # that property means the demo needs no frequency column at all.
    words: list[str] = []
    dropped = 0
    for line in freq_list.read_text(encoding="utf-8").splitlines():
        word = line.strip().lower()
        if not word or not word.isalpha():
            continue
        if not is_plausible(word, profile):
            dropped += 1
            continue
        words.append(word)
        if len(words) >= MAX_WORDS:
            break

    index = {w: i for i, w in enumerate(words)}

    # Curated next-word pairs. Only pairs whose halves both survived the cut are
    # useful, since the demo can never offer a word it does not hold.
    bigrams: dict[str, list[str]] = {}
    pairs = 0
    for line in bigram_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) != 2:
            continue
        prev, nxt = parts[0].lower(), parts[1].lower()
        if prev not in index or nxt not in index:
            continue
        bucket = bigrams.setdefault(prev, [])
        if nxt not in bucket:
            bucket.append(nxt)
            pairs += 1

    # Each bucket stays in the file's own order, which is curated by frequency,
    # so the demo can take the head of the list without re-ranking.
    payload = {"words": words, "bigrams": bigrams}

    out = SITE / "scripts" / "demo-data.js"
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
    header = (
        "/* GENERATED FILE, DO NOT EDIT BY HAND.\n"
        "   Built by tools/gen_demo_data.py from the alpha-osk repo's own\n"
        "   data/google-10000-english-usa-no-swears.txt and data/common_bigrams.txt,\n"
        "   filtered through the same language profile the shipped keyboard uses.\n"
        "   Regenerate rather than editing: python tools/gen_demo_data.py\n\n"
        "   words[] is in frequency rank order, most common first. The demo derives\n"
        "   a count from the index exactly as the application derives one from rank,\n"
        "   so there is no frequency column to keep in step. */\n"
    )
    out.write_text(header + "window.ALPHA_OSK_DEMO_DATA=" + body + ";\n", encoding="utf-8")

    size_kb = out.stat().st_size / 1024
    print(f"kept   {len(words)} words (dropped {dropped} fragments before the cut)")
    print(f"kept   {pairs} bigram pairs across {len(bigrams)} prefixes")
    print(f"wrote  {out.relative_to(SITE)}  {size_kb:.0f} KB")


if __name__ == "__main__":
    main()
