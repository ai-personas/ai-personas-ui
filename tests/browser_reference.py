#!/usr/bin/env python3
"""Exercise the real checked-in fixture over HTTP; not Rust or pixel-parity tests."""
from __future__ import annotations

import argparse
import contextlib
import functools
import http.server
import json
from pathlib import Path
import subprocess
import threading
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


@contextlib.contextmanager
def server():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{httpd.server_port}/design/'
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', help='Optional Chromium executable')
    parser.add_argument('--output', type=Path, default=ROOT / '.qa/reference-screens')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ['node', '-e', "process.stdout.write(JSON.stringify(require('./design/reference-screens.js').screens))"],
        cwd=ROOT, text=True, check=True, capture_output=True,
    )
    screens = json.loads(result.stdout)
    checks, failures, errors, blocked = [], [], [], []

    def check(name, fn):
        try:
            fn()
            checks.append({'check': name, 'passed': True})
        except Exception as error:
            failures.append(name)
            checks.append({'check': name, 'passed': False, 'error': str(error)})
            print(f'FAIL: {name}: {error}', flush=True)

    def require(value, message):
        if not value:
            raise AssertionError(message)

    with server() as base, sync_playwright() as pw:
        launch = {'headless': True}
        if args.chromium:
            launch['executable_path'] = args.chromium
        browser = pw.chromium.launch(**launch)
        context = browser.new_context(reduced_motion='reduce')
        origin = urlsplit(base).netloc

        def guard(route):
            if urlsplit(route.request.url).netloc != origin:
                blocked.append(route.request.url)
                route.abort()
            else:
                route.continue_()

        context.route('**/*', guard)
        page = context.new_page()
        page.set_default_timeout(10000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('response', lambda response: errors.append(f'{response.status}: {response.url}')
                if response.status >= 400 and response.request.resource_type in {'document', 'script', 'stylesheet'} else None)

        def no_overflow():
            require(page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),
                    'The outer document has horizontal overflow')

        for screen in screens:
            def visit(s=screen):
                page.set_viewport_size({'width': s['width'], 'height': s['height']})
                query = '?preview=request' if s.get('preview') == 'request' else ''
                page.goto(base + 'index.html' + query + s['route'], wait_until='networkidle')
                page.locator('#main').wait_for()
                no_overflow()
                if s.get('preview') == 'request':
                    page.locator('#dialog[open]').wait_for()
                    require(page.locator('#answer').evaluate('(e) => e === document.activeElement'), 'Answer field did not receive focus')
                    for _ in range(12):
                        page.keyboard.press('Tab')
                        require(page.evaluate("document.getElementById('dialog').contains(document.activeElement)"), 'Modal focus escaped')
                    page.locator('#answer').focus()
                page.screenshot(path=str(args.output / f"{s['id']}.png"), full_page=s['fullPage'])
                if s.get('preview') == 'request':
                    page.keyboard.press('Escape')
                    page.locator('#dialog[open]').wait_for(state='hidden')
                previous = page.url
                page.locator('.skip-link').focus()
                page.keyboard.press('Enter')
                require(page.url == previous, 'Skip link changed the application route')
                require(page.locator('#main').evaluate('(e) => e === document.activeElement'), 'Skip link did not focus main')
            check(f"HTTP reference: {screen['id']}", visit)

        def response_semantics():
            page.set_viewport_size({'width': 390, 'height': 740})
            page.goto(base + 'index.html?preview=request#/work', wait_until='networkidle')
            answer = 'Not known yet. <script>window.__injected = true</script>'
            page.locator('#answer').fill(answer)
            page.get_by_role('button', name='Record response', exact=True).click()
            page.locator('#dialog[open]').wait_for(state='hidden')
            # The compact mobile list hides desktop helper text. Inspect the
            # visible badge, then the retained answer and disposition in detail.
            row = page.locator('[aria-labelledby="work-title-home"]')
            expect(row.locator('.badge')).to_have_text('Awaiting assessment')
            row.get_by_role('link', name='Four-bedroom home', exact=True).click()
            expect(page.locator('.response-panel')).to_be_visible()
            expect(page.locator('.answer-copy')).to_have_text(answer)
            expect(page.locator('.response-panel')).to_contain_text('The request is not resolved.')
            expect(page.locator('.status-strip')).to_contain_text('Not assessed')
            require(page.evaluate('window.__injected !== true'), 'Literal answer executed as script')
            page.locator('.back-link').click()
            expect(page.locator('h1')).to_have_text('Work')
            page.reload(wait_until='networkidle')
            page.locator('#dialog[open]').wait_for()
            require(page.locator('#answer').input_value() == '', 'Fixture state persisted across reload')
            page.goto(base + 'index.html?preview=reset#/work', wait_until='networkidle')
            require(page.locator('#dialog[open]').count() == 0, 'Unapproved query dispatched an action')
        check('Request URL: answer is unresolved, literal, local-only and allowlisted', response_semantics)

        for width in (1440, 390, 266):
            def reviewer(w=width):
                page.set_viewport_size({'width': w, 'height': 900})
                page.goto(base + 'references.html#work-desktop', wait_until='networkidle')
                for s in screens:
                    link = page.locator(f'[data-screen="{s["id"]}"]')
                    link.click()
                    # A hash change is asynchronous. An old frame's Ready text
                    # must not satisfy readiness for the newly selected screen.
                    expect(link).to_have_attribute('aria-current', 'page')
                    expect(page.locator('#screen-title')).to_have_text(s['title'])
                    query = '?preview=request' if s.get('preview') == 'request' else ''
                    expect(page.locator('iframe')).to_have_attribute('src', 'index.html' + query + s['route'])
                    expect(page.locator('#stage')).to_have_attribute('aria-busy', 'false')
                    expect(page.locator('#load-status')).to_have_text('Preview ready · illustrative only')
                    require(page.locator('iframe').count() == 1 and len(page.frames) == 2, 'Old fixture frame was retained')
                    iframe = page.frame_locator('iframe')
                    iframe.locator('#main').wait_for()
                    if s.get('preview') == 'request':
                        iframe.locator('#dialog[open]').wait_for()
                    no_overflow()
                before = page.url
                page.locator('.skip-link').focus()
                page.keyboard.press('Enter')
                require(page.url == before, 'Reviewer skip link changed selection')
                require(page.locator('#review').evaluate('(e) => e === document.activeElement'), 'Reviewer focus missing')
                page.goto(base + 'references.html#%E0%A4%A', wait_until='networkidle')
                expect(page.locator('#screen-title')).to_have_text(screens[0]['title'])
                expect(page.locator('#stage')).to_have_attribute('aria-busy', 'false')
                no_overflow()
                page.screenshot(path=str(args.output / f'reviewer-{w}.png'), full_page=True)
            check(f'Isolated screen reviewer at {width}px', reviewer)
        check('No browser errors or missing page assets', lambda: require(not errors, '; '.join(errors)))
        check('No external requests', lambda: require(not blocked, '; '.join(blocked)))
        browser.close()

    report = {
        'scope': 'HTTP-served design fixture and screen reviewer; no Rust, provider, engineering or pixel-parity proof.',
        'checks': checks, 'passed': len(checks) - len(failures), 'failed': len(failures),
        'screenshots': sorted(p.name for p in args.output.glob('*.png')),
    }
    (args.output / 'checks.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'passed': report['passed'], 'failed': report['failed'], 'output': str(args.output)}))
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())
