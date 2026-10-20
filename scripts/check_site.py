"""Offline, dependency-free smoke checks for Arthur Fay's GitHub Pages portfolio."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {
    "index.html", "404.html", "styles.css", "script.js",
    "favicon.svg", "robots.txt", "sitemap.xml", ".nojekyll",
}

class PortfolioParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.anchors: list[str] = []
        self.assets: list[tuple[str, str]] = []
        self.links: list[str] = []
        self.errors: list[str] = []
        self.lang_ok = False
        self.title_seen = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag == "html":
            self.lang_ok = attr.get("lang") == "en"
        if tag == "title":
            self.title_seen = True
        element_id = attr.get("id")
        if element_id:
            if element_id in self.ids:
                self.errors.append(f"Duplicate id: {element_id}")
            self.ids.add(element_id)
        if tag == "a":
            href = attr.get("href", "") or ""
            self.links.append(href)
            if href.startswith("#"):
                self.anchors.append(href[1:])
            if href.startswith("https://"):
                if urlsplit(href).netloc != "github.com":
                    self.errors.append(f"Unexpected outbound link: {href}")
            elif href and not href.startswith(("#", "/")):
                self.errors.append(f"Unexpected anchor format: {href}")
            if attr.get("target") == "_blank":
                rel = (attr.get("rel") or "").split()
                if "noopener" not in rel or "noreferrer" not in rel:
                    self.errors.append(f"Missing safe rel for: {href}")
        if tag in ("script", "img", "iframe", "source"):
            value = attr.get("src", "") or ""
            if tag == "script":
                self.assets.append((tag, value))
            else:
                self.errors.append(f"No inline/remote media allowed: {tag}")
        if tag == "link":
            self.assets.append((tag, attr.get("href", "") or ""))

def main() -> None:
    missing = sorted(path for path in REQUIRED if not (ROOT / path).is_file())
    assert not missing, f"Missing site assets: {missing}"
    assert (ROOT / ".nojekyll").stat().st_size == 0, ".nojekyll should be empty"
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "script.js").read_text(encoding="utf-8")
    parser = PortfolioParser()
    parser.feed(index)
    assert parser.lang_ok, "Set the document's language to English"
    assert parser.title_seen, "Missing document title"
    for anchor in parser.anchors:
        assert anchor in parser.ids, f"Broken internal link: #{anchor}"
    assert not parser.errors, "\n".join(parser.errors)
    assert {"main", "work", "about", "approach", "contact", "atlas-detail"} <= parser.ids
    assert ("script", "/script.js") in parser.assets
    assert ("link", "/styles.css") in parser.assets
    assert ("link", "/favicon.svg") in parser.assets
    for tag, path in parser.assets:
        if tag == "link" and path.startswith("https://arthur-fay.github.io/"):
            continue
        assert path.startswith("/"), f"External runtime asset forbidden: {tag} {path}"
        assert (ROOT / path.lstrip("/")).exists(), f"Missing referenced asset: {path}"
    assert "Content-Security-Policy" in index, "Missing CSP"
    assert "https://github.com/arthur-fay/demand-forecasting-model" in index
    assert "https://github.com/arthur-fay/customer-revenue-analytics" in index
    for phrase in ("forecasting gains are not established", "failed calibration", "hypothetical"):
        assert phrase.casefold() in index.casefold(), f"Research limitation omitted: {phrase}"
    assert "No NYC-derived charts or datasets are hosted on this portfolio." in index
    assert "@import" not in css.casefold(), "Do not load remote styles"
    assert "url(http" not in css.casefold(), "Do not reference remote CSS assets"
    for token in ("fetch(", "XMLHttpRequest", "sendBeacon(", "gtag(", "analytics.js"):
        assert token not in js, f"Unexpected network/tracking code: {token}"
    assert "https://arthur-fay.github.io/" in (ROOT / "sitemap.xml").read_text()
    assert "https://arthur-fay.github.io/sitemap.xml" in (ROOT / "robots.txt").read_text()
    assert 'href="/"' in (ROOT / "404.html").read_text()
    print(f"Portfolio static verification passed ({len(parser.links)} links, {len(parser.ids)} IDs).")

if __name__ == "__main__":
    main()
