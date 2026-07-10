#!/usr/bin/env python3
"""Verify that GitHub Pages serves this checkout and boots it in a real browser."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright


ROOT_FILES = ("index.html", "discovery.css", "discovery.js", "peers.txt", "robots.txt")
REQUIRED_BROWSER_ASSETS = {
    "assets/discovery.css",
    "assets/discovery.js",
    "assets/live-artifacts.mjs",
    "assets/live-signatures.mjs",
    "assets/noble-ed25519.js",
    "assets/p2p-libp2p.js",
    "peers.txt",
}


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def deployed_assets(root: Path) -> list[Path]:
    paths = [root / name for name in ROOT_FILES]
    paths.extend(sorted(path for path in (root / "assets").rglob("*") if path.is_file()))
    missing = [str(path.relative_to(root)) for path in paths if not path.is_file()]
    if missing:
        raise AssertionError("missing checkout asset(s): " + ", ".join(missing))
    return paths


def asset_url(base_url: str, relative: str, commit: str, attempt: int) -> str:
    target = base_url if relative == "<root>" else urljoin(base_url, quote(relative, safe="/"))
    return target + "?" + urlencode({"deploy": commit, "attempt": attempt})


def fetch_bytes(url: str, timeout: float) -> bytes:
    request = Request(
        url,
        headers={
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": "personaos-pages-smoke/1",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise AssertionError(f"HTTP {response.status}")
        return response.read()


def wait_for_exact_assets(
    base_url: str,
    root: Path,
    commit: str,
    timeout: float,
) -> dict[str, str]:
    expected = {
        str(path.relative_to(root)).replace(os.sep, "/"): path.read_bytes()
        for path in deployed_assets(root)
    }
    # Pages may cache `/` and `/index.html` under different CDN keys. The browser
    # opens `/`, so prove that alias is the same checkout too.
    expected["<root>"] = expected["index.html"]
    deadline = time.monotonic() + timeout
    attempt = 0
    last_failures: list[str] = []
    while time.monotonic() < deadline:
        attempt += 1
        failures = []
        for relative, wanted in expected.items():
            try:
                actual = fetch_bytes(asset_url(base_url, relative, commit, attempt), timeout=20)
            except (AssertionError, HTTPError, TimeoutError, URLError) as error:
                failures.append(f"{relative}: {error}")
                continue
            if actual != wanted:
                failures.append(
                    f"{relative}: sha256 {sha256(actual)} != checkout {sha256(wanted)}"
                )
        if not failures:
            return {relative: sha256(value) for relative, value in expected.items()}
        last_failures = failures
        time.sleep(min(5, max(deadline - time.monotonic(), 0)))
    raise AssertionError(
        "Pages did not converge to the deployed checkout before timeout:\n"
        + "\n".join(last_failures)
    )


def browser_smoke(
    base_url: str,
    commit: str,
    screenshot: Path,
    expected_hashes: dict[str, str],
) -> dict:
    query = urlencode(
        {
            "no_local_discovery": "1",
            "no_global_discovery": "1",
            "deployment_smoke": commit,
        }
    )
    url = base_url + ("&" if "?" in base_url else "?") + query
    origin = urlsplit(base_url)
    page_errors: list[str] = []
    failed_requests: list[dict] = []
    response_status: dict[str, int] = {}
    response_hashes: dict[str, str] = {}
    response_body_errors: list[str] = []
    external_executable: list[str] = []

    with sync_playwright() as playwright:
        launch: dict = {"headless": True}
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if executable:
            launch["executable_path"] = executable
        browser = playwright.chromium.launch(**launch)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            service_workers="block",
        )
        page = context.new_page()
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "requestfailed",
            lambda request: failed_requests.append(
                {"url": request.url, "error": request.failure or "request failed"}
            ),
        )

        def record_response(response) -> None:
            parsed = urlsplit(response.url)
            if parsed.scheme == origin.scheme and parsed.netloc == origin.netloc:
                root_path = origin.path.rstrip("/") + "/"
                if parsed.path.startswith(root_path):
                    relative = parsed.path[len(root_path):]
                    response_status[relative] = response.status
                    if relative in REQUIRED_BROWSER_ASSETS and response.status == 200:
                        try:
                            response_hashes[relative] = sha256(response.body())
                        except Exception as error:  # noqa: BLE001 - report browser/CDP body failures
                            response_body_errors.append(f"{relative}: {error}")

        def record_request(request) -> None:
            parsed = urlsplit(request.url)
            if request.resource_type not in {"script", "worker"}:
                return
            if parsed.scheme in {"http", "https"} and parsed.netloc != origin.netloc:
                external_executable.append(request.url)

        page.on("response", record_response)
        page.on("request", record_request)
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        page.locator(".brandmark").wait_for(timeout=20_000)
        page.wait_for_function(
            """() => document.querySelector('#status')?.textContent !== 'booting discovery…'""",
            timeout=30_000,
        )
        page.wait_for_function(
            """() => !document.querySelector('#p2p')?.textContent.includes('starting libp2p')""",
            timeout=30_000,
        )
        metrics = page.evaluate(
            """() => ({
              title: document.title,
              status: document.querySelector('#status')?.textContent || '',
              p2p: document.querySelector('#p2p')?.textContent || '',
              background: getComputedStyle(document.body).backgroundColor,
              canvas: (() => { const c=document.querySelector('#vital');
                return c ? {width:c.width,height:c.height} : null; })(),
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              staleOperatorCopy: document.body.innerText.toLowerCase().includes('local node needs no token'),
            })"""
        )
        screenshot.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(screenshot), full_page=True)
        context.close()
        browser.close()

    missing = sorted(
        path for path in REQUIRED_BROWSER_ASSETS if response_status.get(path) != 200
    )
    failed_core = [
        item for item in failed_requests
        if any(urlsplit(item["url"]).path.endswith("/" + path) for path in REQUIRED_BROWSER_ASSETS)
    ]
    if missing:
        raise AssertionError("browser did not load core hosted asset(s): " + ", ".join(missing))
    if failed_core:
        raise AssertionError("core hosted request failure(s): " + json.dumps(failed_core))
    stale = sorted(
        path for path in REQUIRED_BROWSER_ASSETS
        if response_hashes.get(path) != expected_hashes.get(path)
    )
    if response_body_errors or stale:
        raise AssertionError(
            "browser did not execute exact deployed asset bytes: "
            + "; ".join(response_body_errors + stale)
        )
    if page_errors:
        raise AssertionError("hosted page error(s): " + "; ".join(page_errors))
    if external_executable:
        raise AssertionError(
            "hosted page loaded external executable code: " + ", ".join(external_executable)
        )
    if metrics["title"] != "PersonaOS · Living Network":
        raise AssertionError(f"unexpected title: {metrics['title']!r}")
    if not metrics["p2p"].startswith("P2P · libp2p "):
        raise AssertionError(f"hosted libp2p module did not initialize: {metrics['p2p']!r}")
    if metrics["background"] in {"rgba(0, 0, 0, 0)", "transparent"}:
        raise AssertionError("hosted stylesheet did not apply")
    if not metrics["canvas"] or metrics["canvas"]["width"] <= 0 or metrics["canvas"]["height"] <= 0:
        raise AssertionError("hosted vital-sign canvas did not initialize")
    if metrics["scrollWidth"] > metrics["clientWidth"] + 1:
        raise AssertionError("hosted desktop shell overflows horizontally")
    if metrics["staleOperatorCopy"]:
        raise AssertionError("stale local-node authority copy remains in the hosted shell")
    return {
        "url": url,
        "metrics": metrics,
        "loaded_core_assets": sorted(REQUIRED_BROWSER_ASSETS),
        "loaded_core_hashes": response_hashes,
        "page_errors": page_errors,
        "external_executable": external_executable,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--expected-root", default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--commit", required=True)
    parser.add_argument("--asset-timeout", type=float, default=180)
    parser.add_argument("--screenshot", required=True)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/") + "/"
    parsed = urlsplit(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise SystemExit("--base-url must be an absolute HTTP(S) URL")
    root = Path(args.expected_root).resolve()
    hashes = wait_for_exact_assets(base_url, root, args.commit, args.asset_timeout)
    browser = browser_smoke(
        base_url,
        args.commit,
        Path(args.screenshot).resolve(),
        hashes,
    )
    print(json.dumps({
        "commit": args.commit,
        "base_url": base_url,
        "exact_asset_count": len(hashes),
        "asset_hashes": hashes,
        "browser": browser,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
