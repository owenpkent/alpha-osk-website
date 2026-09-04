"""Generate favicons and an Open Graph image for the alphaosk.com site.

Sources are the app's own logo and the dark-theme screenshot in images/, so the
site's icons and the application's icon cannot drift apart.

Needs PySide6, which the alpha-osk venv already has, and nothing else:

    python tools/gen_assets.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import QRect, Qt
from PySide6.QtGui import QColor, QFont, QGuiApplication, QImage, QPainter

SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
IMAGES = SITE / "images"

# The app's Dark theme, from qml/Main.qml::themeData.
BACKGROUND = QColor("#141414")


def load(path: Path) -> QImage:
    img = QImage(str(path))
    if img.isNull():
        raise SystemExit(f"could not read {path}")
    return img


def scaled_png(src: QImage, size: int, dest: Path) -> None:
    out = src.scaled(
        size, size, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation
    )
    if not out.save(str(dest)):
        raise SystemExit(f"could not write {dest}")
    print(f"wrote {dest.name} ({size}x{size})")


def make_ico(src: QImage, dest: Path) -> None:
    """A 32px ICO. Qt writes single-resolution ICOs, which is all a favicon needs
    now that the SVG and the PNGs cover every other slot."""
    out = src.scaled(
        32, 32, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation
    )
    if not out.save(str(dest)):
        raise SystemExit(f"could not write {dest}")
    print(f"wrote {dest.name}")


def make_og(shot: QImage, logo: QImage, dest: Path) -> None:
    """1200x630 card: the real keyboard screenshot on the app's own background.

    The screenshot is inset rather than cropped to fill, because cropping a
    keyboard cuts keys in half and the point of the card is that it is
    recognisably a keyboard at thumbnail size.
    """
    card = QImage(1200, 630, QImage.Format.Format_RGB32)
    card.fill(BACKGROUND)

    painter = QPainter(card)
    painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, True)

    # Logo, top-left.
    mark = logo.scaled(
        88, 88, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation
    )
    painter.drawImage(64, 56, mark)

    # Wordmark and tagline beside it.
    font = painter.font()
    font.setPixelSize(54)
    font.setWeight(QFont.Weight.Bold)
    painter.setFont(font)
    painter.setPen(QColor("#f2f2f2"))
    painter.drawText(QRect(168, 56, 900, 56), Qt.AlignmentFlag.AlignVCenter, "Alpha-OSK")

    font.setPixelSize(28)
    font.setWeight(QFont.Weight.Medium)
    painter.setFont(font)
    painter.setPen(QColor("#9aa4b2"))
    painter.drawText(
        QRect(168, 108, 940, 40),
        Qt.AlignmentFlag.AlignVCenter,
        "The smartest keyboard you'll never touch.",
    )

    # Screenshot filling the lower two thirds, bled off the bottom edge so the
    # card reads as a window rather than a floating rectangle.
    avail_w = 1200 - 128
    shot_scaled = shot.scaledToWidth(avail_w, Qt.TransformationMode.SmoothTransformation)
    painter.drawImage(64, 200, shot_scaled)

    painter.end()

    if not card.save(str(dest)):
        raise SystemExit(f"could not write {dest}")
    print(f"wrote {dest.name} (1200x630)")


def main() -> None:
    QGuiApplication(["-platform", "offscreen"])

    logo = load(IMAGES / "logo-1024.png")
    shot = load(IMAGES / "screenshots" / "dark-theme-keyboard.png")

    scaled_png(logo, 32, IMAGES / "favicon-32.png")
    scaled_png(logo, 180, IMAGES / "apple-touch-icon.png")
    scaled_png(logo, 512, IMAGES / "icon-512.png")
    make_ico(logo, SITE / "favicon.ico")
    make_og(shot, logo, IMAGES / "og-alphaosk.png")


if __name__ == "__main__":
    main()
