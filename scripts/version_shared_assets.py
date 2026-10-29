"""Give shared CSS/JS content-derived URLs so updated HTML bypasses old caches.

Run after editing styles.css, script.js or the pathfinding stylesheet. The offline checker rejects stale
versions, including the references in lab pages and the custom 404 page.
"""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]
PAGES = ("index.html", "404.html", "lab/pathfinding/index.html",
         "lab/security-events/index.html", "lab/ecommerce/index.html")


def main() -> None:
    versions = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()[:12]
                for name in ("styles.css", "script.js", "lab/pathfinding/lab.css")}
    for page in PAGES:
        file = ROOT / page
        html = file.read_text(encoding="utf-8")
        for name, version in versions.items():
            pattern = rf'((?:href|src)="/){re.escape(name)}(?:\?v=[a-f0-9]{{12}})?(")'
            html, count = re.subn(pattern, lambda match: f'{match[1]}{name}?v={version}{match[2]}', html)
            if name == "lab/pathfinding/lab.css":
                expected = 1 if page == "lab/pathfinding/index.html" else 0
            else:
                expected = 0 if page == "404.html" and name == "script.js" else 1
            assert count == expected, f"{page}: expected {expected} reference(s) to {name}, found {count}"
        file.write_text(html, encoding="utf-8")
    print("Shared asset versions: " + ", ".join(f"{name}={value}" for name, value in versions.items()))


if __name__ == "__main__":
    main()
