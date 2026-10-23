"""Offline, dependency-free smoke checks for Arthur Fay's GitHub Pages portfolio.

Checks every published page (the portfolio, the Interactive Robotics &
Pathfinding Lab, the Security Event Detection & Investigation Lab and the
E-Commerce Executive Analytics Lab):
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
ECO_DIR = "lab/ecommerce"
REQUIRED = {
    "index.html", "404.html", "404.css", "styles.css", "script.js",
    "favicon.svg", "robots.txt", "sitemap.xml", ".nojekyll", "package.json",
    f"{LAB_DIR}/index.html", f"{LAB_DIR}/lab.css", f"{LAB_DIR}/app.js",
    f"{LAB_DIR}/pathfinding.js", f"{LAB_DIR}/README.md",
    f"{SEC_DIR}/index.html", f"{SEC_DIR}/lab.css", f"{SEC_DIR}/app.js",
    f"{SEC_DIR}/detection.js", f"{SEC_DIR}/README.md",
    f"{ECO_DIR}/index.html", f"{ECO_DIR}/lab.css", f"{ECO_DIR}/app.js",
    f"{ECO_DIR}/model.js", f"{ECO_DIR}/README.md",
}
# Wording the owner removed on purpose: fields the four projects do not evidence, and
# negative "no credentials" disclaimers. Keep the homepage positive and evidence-based.
FORBIDDEN_HOMEPAGE_PHRASES = (
    "artificial intelligence", "machine learning", "no employment history",
    "no degrees", "no certifications", "no awards",
)
# Personal contact details are published only by the owner's explicit decision (README, "Contact details").
# Until then no page may carry a phone number, an e-mail address or a mailto:/tel: link.
PRIVATE_CONTACT_PATTERNS = (
    re.compile(r"mailto:", re.I),
    re.compile(r"\btel:", re.I),
    re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I),
    re.compile(r"\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b"),
)
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
    for pattern in PRIVATE_CONTACT_PATTERNS:
        match = pattern.search(html)
        assert not match, f"{label}: personal contact details must not be committed without the owner's approval: {match.group(0)!r}"
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
        {"main", "work", "experience", "education", "about", "approach", "contact", "atlas-detail", "pathfinding-title", "security-title"},
        (
            "forecasting gains are not established", "failed calibration", "hypothetical",
            # The record follows the latest résumé (22 October 2026): both degrees with their dates, the bachelor's
            # in progress and never completed, both job titles, and the résumé headline as the public identity.
            "In progress · expected Jan 2027", "expected January 2027", "Capella University",
            "Completed · Aug 2024", "Borough of Manhattan Community College", "August 2024", "Independent work",
            "Backend Software Engineer I", "Data Analyst", "21st Ave Pharmacy", "Blue Sky Trading",
            "Arthur Fay — Software Engineer · The Architect Lab", "Python, TypeScript/React, FastAPI, PostgreSQL",
            "No NYC-derived charts or datasets are hosted on this portfolio.",
            "Grid-based algorithm simulation, not a validated real-world robotics navigation system",
            "https://github.com/arthur-fay/demand-forecasting-model",
            "https://github.com/arthur-fay/customer-revenue-analytics",
            "synthetic events only", "not a production SIEM",
        ),
        f"{SITE}/",
    )
    assert index.projects == 4, f"index.html: expected 4 project cards, found {index.projects}"
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    folded_index = index_html.casefold()
    for phrase in FORBIDDEN_HOMEPAGE_PHRASES:
        assert phrase not in folded_index, f"index.html: unsupported or negative wording must stay out: {phrase}"
    hero_index = re.search(r'<ul class="hero-index"[^>]*>(.*?)</ul>', folded_index, re.S)
    assert hero_index, "index.html: the hero must carry the plate index"
    for plate in ("plate-atlas", "plate-commerce", "plate-pathfinding", "plate-security"):
        assert f'href="#{plate}"' in hero_index.group(1), f"index.html: the hero's plate index must link directly to #{plate}"
    assert 'class="button button-primary" href="#work"' in folded_index, "index.html: the hero's primary call to action must lead to the projects"
    assert 'href="#experience"' in folded_index and 'href="#education"' in folded_index, "index.html: the hero must lead to the experience and education record"
    for outdated in ("Pharmacy Technician", "Backend Software Engineer · The Architect Lab", "B.S. Computer Science, completed", "Python Backend Developer"):
        assert outdated.casefold() not in folded_index, f"index.html: superseded by the latest résumé: {outdated!r}"
    # Employer descriptions carry no operational volumes or product counts, even when the résumé does.
    record = re.search(r'id="experience".*?</section>', index_html, re.S)
    assert record, "index.html: missing #experience"
    employment = record.group(0).split("record-entry-independent")[0]
    volume = re.search(r"\b\d[\d,]*\+?\s+(daily|transactions|incidents|products)", employment, re.I)
    assert not volume, f"index.html: employer descriptions must not publish operational volumes: {volume.group(0)!r}"
    for nav in re.findall(r'<nav class="(?:desktop|mobile)-nav"[^>]*>(.*?)</nav>', folded_index, re.S):
        assert 'href="#experience"' in nav, "index.html: both navigations must list the experience section"
    # Every ATLAS performance figure on the page sits next to its statistical qualification.
    for container_id in ("cut-atlas", "plate-atlas", "atlas-detail"):
        block = re.search(rf'id="{container_id}".*?</section>', index_html, re.S)
        assert block, f"index.html: missing #{container_id}"
        text = block.group(0).casefold()
        if "28%" in text or "11%" in text:
            assert "not statistically established" in text or "not established" in text, f"index.html: #{container_id} states an ATLAS improvement without its qualification"
            assert "failed calibration" in text, f"index.html: #{container_id} states an ATLAS improvement without the calibration finding"
    assert {"all", "interactive", "security"} <= set(index.filters), "index.html: project filters incomplete"
    assert f"/{LAB_DIR}/" in index.internal_pages, "index.html: Project 03 must link to the lab page"
    assert f"/{SEC_DIR}/" in index.internal_pages, "index.html: Project 04 must link to the security lab page"
    assert f"/{ECO_DIR}/" in index.internal_pages, "index.html: Project 02 must link to the analytics lab page"
    assert "open the interactive analytics lab" in folded_index, "index.html: Project 02 must carry a prominent link to the analytics lab"
    for evidence_link in (
        "demand-forecasting-model/blob/main/docs/BACKTESTING.md",
        "demand-forecasting-model/blob/main/docs/API.md",
        "demand-forecasting-model/blob/main/docs/api/openapi.json",
        "demand-forecasting-model/blob/main/.github/workflows/ci.yml",
        "customer-revenue-analytics/blob/main/README.md#data-model",
        "arthur-fay.github.io/blob/main/lab/pathfinding/pathfinding.js",
        "arthur-fay.github.io/blob/main/lab/security-events/detection.js",
        "arthur-fay.github.io/blob/main/lab/pathfinding/README.md",
        "arthur-fay.github.io/blob/main/lab/security-events/README.md",
        "arthur-fay.github.io/blob/main/lab/ecommerce/model.js",
        "arthur-fay.github.io/blob/main/lab/ecommerce/README.md",
    ):
        assert evidence_link in index_html, f"index.html: missing verified project evidence link {evidence_link}"

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

    analytics = check_page(
        f"{ECO_DIR}/index.html",
        {"main", "dashboard", "simulator", "model", "methodology", "engineering", "category-chart", "top-ten-chart",
         "status-chart", "outcome-chart", "scenario-chart", "scenario-outcomes", "volume-range", "volume-value",
         "basket-range", "basket-value", "delivery-range", "delivery-value", "ontime-range", "ontime-value",
         "reset-scenario", "sim-status", "out-revenue", "out-revenue-change", "out-orders", "out-aov", "out-delivery",
         "out-ontime", "out-ontime-all", "model-diagram", "model-lines", "table-detail", "table-detail-body", "wiring-table"},
        (
            "rounded summaries of the public project README",
            "not a row-level dataset",
            "no transaction, monthly value or customer record is reconstructed",
            "hypothetical projection",
            "never a reported result",
            "not a forecast",
            "COUNTROWS(fact_orders)",
            "https://github.com/arthur-fay/customer-revenue-analytics",
            "KPI_Measures",
        ),
        f"{SITE}/{ECO_DIR}/",
    )
    assert f"/{ECO_DIR}/app.js" in analytics.module_scripts, "analytics lab page must load app.js as an ES module"
    assert ("link", f"/{ECO_DIR}/lab.css") in analytics.assets, "analytics lab page must load its stylesheet"
    assert "status" in analytics.roles and analytics.live_regions >= 1, "analytics lab page needs a live status region"
    eco_html = (ROOT / ECO_DIR / "index.html").read_text(encoding="utf-8")
    assert "<form" not in eco_html.casefold(), "the analytics lab must not submit forms"
    assert eco_html.count('data-metric="') == 6, "the analytics lab must present exactly six published KPI tiles"
    for display in ("99K", "R$15.84M", "96K", "R$159.33", "97.02%", "91.88%"):
        assert f'">{display}<small>' in eco_html, f"analytics lab: published KPI {display} missing from its tile"

    for stylesheet in ("styles.css", "404.css", f"{LAB_DIR}/lab.css", f"{SEC_DIR}/lab.css", f"{ECO_DIR}/lab.css"):
        check_css(stylesheet)
    for script in ("script.js", f"{LAB_DIR}/app.js", f"{LAB_DIR}/pathfinding.js", f"{SEC_DIR}/app.js", f"{SEC_DIR}/detection.js", f"{ECO_DIR}/app.js", f"{ECO_DIR}/model.js"):
        check_javascript(script)
    app = (ROOT / LAB_DIR / "app.js").read_text(encoding="utf-8")
    assert "from './pathfinding.js'" in app, "app.js must import the pure algorithm module"
    pure = (ROOT / LAB_DIR / "pathfinding.js").read_text(encoding="utf-8")
    assert "document." not in pure and "window." not in pure, "pathfinding.js must stay free of DOM access"
    sec_app = (ROOT / SEC_DIR / "app.js").read_text(encoding="utf-8")
    assert "from './detection.js'" in sec_app, "security app.js must import the pure engine module"
    sec_pure = (ROOT / SEC_DIR / "detection.js").read_text(encoding="utf-8")
    for token in ("localStorage", "sessionStorage", "indexedDB", "navigator.sendBeacon", "import("):
        assert token not in sec_app and token not in sec_pure, f"the security lab must not persist or transmit event data: {token}"
    assert "document." not in sec_pure and "window." not in sec_pure, "detection.js must stay free of DOM access"
    assert "203.0.113." in sec_pure and "198.51.100." in sec_pure and "192.0.2." in sec_pure, "the engine must generate only RFC 5737 documentation addresses"
    eco_app = (ROOT / ECO_DIR / "app.js").read_text(encoding="utf-8")
    assert "from './model.js'" in eco_app, "analytics app.js must import the pure engine module"
    eco_pure = (ROOT / ECO_DIR / "model.js").read_text(encoding="utf-8")
    assert "document." not in eco_pure and "window." not in eco_pure, "model.js must stay free of DOM access"
    for token in ("localStorage", "sessionStorage", "indexedDB", "navigator.sendBeacon", "import("):
        assert token not in eco_app and token not in eco_pure, f"the analytics lab must not persist or transmit anything: {token}"
    for figure in ("15_840_000", "159.33", "97.02", "91.88", "1_440_000", "1_310_000"):
        assert figure in eco_pure, f"model.js must carry the published figure {figure}"

    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert package.get("type") == "module", "package.json must declare ES modules for the Node tests"
    assert not package.get("dependencies") and not package.get("devDependencies"), "the site must stay dependency-free"

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert f"<loc>{SITE}/</loc>" in sitemap and f"<loc>{SITE}/{LAB_DIR}/</loc>" in sitemap and f"<loc>{SITE}/{SEC_DIR}/</loc>" in sitemap and f"<loc>{SITE}/{ECO_DIR}/</loc>" in sitemap, "sitemap must list all four pages"
    assert f"{SITE}/sitemap.xml" in (ROOT / "robots.txt").read_text(encoding="utf-8")
    # The 404 page is served directly by GitHub Pages, so audit it separately:
    # no canonical is appropriate for an error response and no JS is required.
    not_found_html = (ROOT / "404.html").read_text(encoding="utf-8")
    not_found = PageParser()
    not_found.feed(not_found_html)
    assert not_found.lang_ok and not_found.title_seen, "404.html: missing page metadata"
    assert "default-src 'none'" in not_found.csp and "'unsafe-inline'" not in not_found.csp, "404.html: CSP missing or weakened"
    assert not not_found.errors, "404.html: " + "; ".join(not_found.errors)
    assert "/" in not_found.internal_pages, "404.html: missing return link"
    assert ("link", "/styles.css") in not_found.assets and ("link", "/404.css") in not_found.assets, "404.html: missing local stylesheet"
    assert "noindex" in not_found_html.casefold(), "404.html: error page should not be indexed"
    for tag, path in not_found.assets:
        assert path.startswith("/") and (ROOT / path.lstrip("/")).is_file(), f"404.html: missing local asset {tag} {path}"
    print(
        "Portfolio static verification passed "
        f"(index: {len(index.links)} links, {len(index.ids)} IDs; pathfinding lab: {len(lab.links)} links, {len(lab.ids)} IDs; "
        f"security lab: {len(security.links)} links, {len(security.ids)} IDs; analytics lab: {len(analytics.links)} links, {len(analytics.ids)} IDs)."
    )


if __name__ == "__main__":
    main()
