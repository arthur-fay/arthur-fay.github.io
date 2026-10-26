#!/usr/bin/env bash
# Independent Chrome captures: no npm install or Playwright browser download.
set -euo pipefail
: "$VISUAL_REVIEW_DIR"
OUT="$VISUAL_REVIEW_DIR"
mkdir -p "$OUT"
BROWSER="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)"
if [ -z "$BROWSER" ]; then
  echo "No preinstalled Chrome or Chromium binary available" >&2
  exit 1
fi
python3 -m http.server 8765 --bind 127.0.0.1 >/tmp/architect-lab-visual-http.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 2
capture() {
  local width="$1" height="$2" theme="$3" section="$4"
  local url="http://127.0.0.1:8765/"
  if [ "$section" = "experience" ]; then url="$url#experience"; fi
  if [ "$theme" = "dark" ]; then
    "$BROWSER" --headless --no-sandbox --disable-gpu --hide-scrollbars --disable-extensions \
      --force-dark-mode --force-device-scale-factor=1 --window-size="$width,$height" \
      --virtual-time-budget=3000 --screenshot="$OUT/$section-$width-$theme.png" "$url" >/tmp/architect-lab-chrome.log 2>&1
  else
    "$BROWSER" --headless --no-sandbox --disable-gpu --hide-scrollbars --disable-extensions \
      --force-device-scale-factor=1 --window-size="$width,$height" \
      --virtual-time-budget=3000 --screenshot="$OUT/$section-$width-$theme.png" "$url" >/tmp/architect-lab-chrome.log 2>&1
  fi
  test -s "$OUT/$section-$width-$theme.png"
  echo "Captured $section $width px $theme"
}
capture 1280 1100 dark hero
capture 1440 1100 dark hero
capture 1440 1100 light hero
capture 1920 1200 dark hero
capture 1920 1200 light hero
capture 1440 2100 dark experience
capture 1440 2100 light experience
capture 1920 2100 dark experience
capture 1920 2100 light experience
capture 375 1000 dark hero
"$BROWSER" --version >"$OUT/chrome-version.txt"
echo "All 10 Chrome baseline captures completed."
