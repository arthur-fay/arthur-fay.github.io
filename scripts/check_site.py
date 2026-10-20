"""Offline, dependency-free smoke checks for Arthur Fay's GitHub Pages portfolio.

Checks every published page (the portfolio, the Interactive Robotics &
Pathfinding Lab and the Security Event Detection & Investigation Lab):
document basics, internal anchors, outbound-link policy, self-hosted assets,
content-security-policy hygiene (no inline styles or scripts), required
disclosures, and the absence of network/tracking code in the JavaScript.
Run with: python3 scripts/check_site.py
"""
from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://arthur-fay.github.io"
LAB_DIR = "lab/pathfinding"
SEC_DIR = "lab/security-events"
REQUIRED = {
    "index.html", "404.html", "styles.css", "script.js",
    "favicon.svg", "robots.txt", "sitemap.xml", ".nojekyll", "package.json",
    f"{LAB_DIR}/index.html", f"{LAB_DIR}/lab.css", f"{LAB_DIR}/app.js",
    f"{LAB_DIR}/pathfinding.js", f"{LAB_DIR}/README.md",
    f"{SEC_DIR}/index.html", f"{SEC_DIR}/lab.css", f"{SEC_DIR}/app.js",
    f"{SEC_DIR}/detection.js", f"{SEC_DIR}/README.md",
}
FORBIDDEN_JS = (
    "fetch(", "XMLHttpRequest", "sendBeacon(", "gtag(", "analytics.js",
    "WebSocket(", "eval(", "new Function(", "document.write(", "innerHTML",
)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.anchors: list[str] = []
        self.assets: list[tuple[str, str]] = []
        self.module_scripts: list[str] = []
        self.links: list[str] = []
        self.internal_pages: list[str] = []
        self.errors: list[str] = []
        self.lang_ok = False
        self.title_seen = False
        self.csp = ""
        self.canonical = ""
        self.roles: set[str] = set()
        self.live_regions = 0
        self.projects = 0
        self.filters: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag == "html":
            self.lang_ok = attr.get("lang") == "en"
        if tag == "title":
            self.title_seen = True
        if tag == "meta" and attr.get("http-equiv") == "Content-Security-Policy":
            self.csp = attr.get("content") or ""
        if attr.get("style") is not None:
            self.errors.append(f"Inline style attribute on <{tag}> would be blocked by the CSP")
        for name in attr:
            if name.startswith("on"):
                self.errors.append(f"Inline event handler {name} on <{tag}> would be blocked by the CSP")
        if attr.get("role"):
            self.roles.add(attr["role"])
        if attr.get("aria-live"):
            self.live_regions += 1
        element_id = attr.get("id")
        if element_id:
            if element_id in self.ids:
                self.errors.append(f"Duplicate id: {element_id}")
            self.ids.add(element_id)
        if tag == "article" and "project" in (attr.get("class") or "").split():
            self.projects += 1
        if tag == "button" and attr.get("data-filter"):
            self.filters.append(attr["data-filter"])
        if tag == "style":
            self.errors.append("Inline <style> element would be blocked by the CSP")
        if tag == "a":
            href = attr.get("href", "") or ""
            self.links.append(href)
            if href.strip().casefold().startswith("javascript:"):
                self.errors.append(f"javascript: link is not allowed: {href}")
            if href.startswith("#"):
                self.anchors.append(href[1:])
            elif href.startswith("https://"):
                if urlsplit(href).netloc != "github.com":
                    self.errors.append(f"Unexpected outbound link: {href}")
            elif href.startswith("/"):
                self.internal_pages.append(href)
            else:
                self.errors.append(f"Unexpected anchor format: {href}")
            if attr.get("target") == "_blank":
                rel = (attr.get("rel") or "").split()
                if "noopener" not in rel or "noreferrer" not in rel:
                    self.errors.append(f"Missing safe rel for: {href}")
        if tag in ("script", "img", "iframe", "source", "object", "embed"):
            value = attr.get("src", "") or ""
            if tag == "script":
                if not value:
                    self.errors.append("Inline <script> would be blocked by the CSP")
                self.assets.append((tag, value))
                if attr.get("type") == "module":
                    self.module_scripts.append(value)
            else:
                self.errors.append(f"No inline/remote media allowed: {tag}")
        if tag == "link":
            self.assets.append((tag, attr.get("href", "") or ""))
            if attr.get("rel") == "canonical":
                self.canonical = attr.get("href") or ""


def check_page(relative_path: str, required_ids: set[str], phrases: tuple[str, ...], canonical: str) -> PageParser:
    html = (ROOT / relative_path).read_text(encoding="utf-8")
    parser = PageParser()
    parser.feed(html)
    label = relative_path
    assert parser.lang_ok, f"{label}: set the document's language to English"
    assert parser.title_seen, f"{label}: missing document title"
    assert "default-src 'none'" in parser.csp and "'unsafe-inline'" not in parser.csp, f"{label}: missing or weakened CSP"
    assert parser.canonical == canonical, f"{label}: canonical URL should be {canonical}, found {parser.canonical!r}"
    for anchor in parser.anchors:
        assert anchor in parser.ids, f"{label}: broken internal link: #{anchor}"
    assert not parser.errors, f"{label}:\n" + "\n".join(parser.errors)
    missing_ids = required_ids - parser.ids
    assert not missing_ids, f"{label}: missing ids {sorted(missing_ids)}"
    assert ("script", "/script.js") in parser.assets, f"{label}: shared header script missing"
    assert ("link", "/styles.css") in parser.assets, f"{label}: shared stylesheet missing"
    assert ("link", "/favicon.svg") in parser.assets, f"{label}: favicon missing"
    for tag, path in parser.assets:
        if tag == "link" and path.startswith(f"{SITE}/"):
            continue
        assert path.startswith("/"), f"{label}: external runtime asset forbidden: {tag} {path}"
        assert (ROOT / path.lstrip("/")).is_file(), f"{label}: missing referenced asset: {path}"
    for page in parser.internal_pages:
        target = page.split("#", 1)[0]
        if target == "/":
            continue
        candidate = ROOT / target.lstrip("/")
        if target.endswith("/"):
            candidate = candidate / "index.html"
        assert candidate.is_file(), f"{label}: internal page link does not resolve: {page}"
    folded = html.casefold()
    for phrase in phrases:
        assert phrase.casefold() in folded, f"{label}: required statement omitted: {phrase}"
    return parser


def check_javascript(relative_path: str) -> str:
    js = (ROOT / relative_path).read_text(encoding="utf-8")
    for token in FORBIDDEN_JS:
        assert token not in js, f"{relative_path}: unexpected network/tracking/unsafe code: {token}"
    for match in re.finditer(r"""from\s+['"](\.{1,2}/[^'"]+)['"]""", js):
        imported = (ROOT / relative_path).parent / match.group(1)
        assert imported.is_file(), f"{relative_path}: import target missing: {match.group(1)}"
    return js


def check_css(relative_path: str) -> None:
    css = (ROOT / relative_path).read_text(encoding="utf-8").casefold()
    assert "@import" not in css, f"{relative_path}: do not load remote styles"
    assert "url(http" not in css, f"{relative_path}: do not reference remote CSS assets"
    assert "@font-face" not in css, f"{relative_path}: no web fonts are allowed"


def main() -> None:
    missing = sorted(path for path in REQUIRED if not (ROOT / path).is_file())
    assert not missing, f"Missing site assets: {missing}"
    assert (ROOT / ".nojekyll").stat().st_size == 0, ".nojekyll should be empty"

    index = check_page(
        "index.html",
        {"main", "work", "about", "approach", "contact", "atlas-detail", "pathfinding-title", "security-title"},
        (
            "forecasting gains are not established", "failed calibration", "hypothetical",
            "No NYC-derived charts or datasets are hosted on this portfolio.",
            "Grid-based algorithm simulation, not a validated real-world robotics navigation system",
            "https://github.com/arthur-fay/demand-forecasting-model",
            "https://github.com/arthur-fay/customer-revenue-analytics",
            "synthetic events only", "not a production SIEM",
        ),
        f"{SITE}/",
    )
    assert index.projects == 4, f"index.html: expected 4 project cards, found {index.projects}"
    assert {"all", "interactive", "security"} <= set(index.filters), "index.html: project filters incomplete"
    assert f"/{LAB_DIR}/" in index.internal_pages, "index.html: Project 03 must link to the lab page"
    assert f"/{SEC_DIR}/" in index.internal_pages, "index.html: Project 04 must link to the security lab page"

    lab = check_page(
        f"{LAB_DIR}/index.html",
        {"main", "lab", "grid", "lab-status", "run", "pause", "step", "stop", "clear-search", "algorithm",
         "movement", "size", "speed", "animate", "layout", "seed", "generate", "explanations", "engineering"},
        (
            "grid-based algorithm simulation",
            "not a validated real-world robotics navigation system",
            "no corner cutting",
            "admissible",
        ),
        f"{SITE}/{LAB_DIR}/",
    )
    assert f"/{LAB_DIR}/app.js" in lab.module_scripts, "lab page must load app.js as an ES module"
    assert ("link", f"/{LAB_DIR}/lab.css") in lab.assets, "lab page must load its stylesheet"
    assert {"grid", "status"} <= lab.roles or ("grid" in lab.roles and lab.live_regions >= 1), "lab page needs an ARIA grid and a live status region"

    security = check_page(
        f"{SEC_DIR}/index.html",
        {"main", "lab", "timeline", "lab-status", "play", "pause", "step", "reset", "skip", "speed", "alerts", "detail",
         "preset", "seed", "generate", "export", "r1-threshold", "r1-window", "r2-accounts", "r2-window", "r3-failures",
         "r3-window", "r3-scope", "compare", "events", "event-table", "evaluation", "comparison", "import", "import-text",
         "import-file", "methodology", "engineering"},
        (
            "synthetic events only",
            "not a production SIEM",
            "do not establish real-world detection accuracy",
            "reserved documentation IP ranges",
            "no telemetry",
            "Do not paste sensitive real-world production logs",
            "never interpreted as markup or code",
            "RFC 5737",
        ),
        f"{SITE}/{SEC_DIR}/",
    )
    assert f"/{SEC_DIR}/app.js" in security.module_scripts, "security lab page must load app.js as an ES module"
    assert ("link", f"/{SEC_DIR}/lab.css") in security.assets, "security lab page must load its stylesheet"
    assert "status" in security.roles and security.live_regions >= 2, "security lab page needs live status regions"
    assert "<form" not in (ROOT / SEC_DIR / "index.html").read_text(encoding="utf-8").casefold(), "the security lab must not submit forms"

    for stylesheet in ("styles.css", f"{LAB_DIR}/lab.css", f"{SEC_DIR}/lab.css"):
        check_css(stylesheet)
    for script in ("script.js", f"{LAB_DIR}/app.js", f"{LAB_DIR}/pathfinding.js", f"{SEC_DIR}/app.js", f"{SEC_DIR}/detection.js"):
        check_javascript(script)
    app = (ROOT / LAB_DIR / "app.js").read_text(encoding="utf-8")
    assert "from './pathfinding.js'" in app, "app.js must import the pure algorithm module"
    pure = (ROOT / LAB_DIR / "pathfinding.js").read_text(encoding="utf-8")
    assert "document." not in pure and "window." not in pure, "pathfinding.js must stay free of DOM access"
    sec_app = (ROOT / SEC_DIR / "app.js").read_text(encoding="utf-8")
    assert "from './detection.js'" in sec_app, "security app.js must import the pure engine module"
    for token in ("localStorage", "sessionStorage", "indexedDB", "navigator.sendBeacon", "import("):
        assert token not in sec_app, f"security app.js must not persist or transmit event data: {token}"
    sec_pure = (ROOT / SEC_DIR / "detection.js").read_text(encoding="utf-8")
    assert "document." not in sec_pure and "window." not in sec_pure, "detection.js must stay free of DOM access"
    assert "203.0.113." in sec_pure and "198.51.100." in sec_pure and "192.0.2." in sec_pure, "the engine must generate only RFC 5737 documentation addresses"

    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert package.get("type") == "module", "package.json must declare ES modules for the Node tests"
    assert not package.get("dependencies") and not package.get("devDependencies"), "the site must stay dependency-free"

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert f"<loc>{SITE}/</loc>" in sitemap and f"<loc>{SITE}/{LAB_DIR}/</loc>" in sitemap and f"<loc>{SITE}/{SEC_DIR}/</loc>" in sitemap, "sitemap must list all three pages"
    assert f"{SITE}/sitemap.xml" in (ROOT / "robots.txt").read_text(encoding="utf-8")
    assert 'href="/"' in (ROOT / "404.html").read_text(encoding="utf-8")
    print(
        "Portfolio static verification passed "
        f"(index: {len(index.links)} links, {len(index.ids)} IDs; pathfinding lab: {len(lab.links)} links, {len(lab.ids)} IDs; "
        f"security lab: {len(security.links)} links, {len(security.ids)} IDs)."
    )


if __name__ == "__main__":
    main()
