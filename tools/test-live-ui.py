#!/usr/bin/env python3
"""Playwright regression for live workspaces, secure downloads, and mobile layout."""

from __future__ import annotations

import argparse
import json
import os
import threading
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from live_ui_fixture import Handler, STATE, ThreadingHTTPServer


class QuietHandler(Handler):
    def log_message(self, fmt: str, *args) -> None:
        return


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def open_live_plan(page) -> None:
    mission = page.locator('.mcard[data-mrun="run-fixture-live"]')
    mission.wait_for(timeout=15_000)
    mission.click()
    badge = page.locator('.live-artifacts .transport-badge')
    badge.wait_for(timeout=15_000)
    require(badge.text_content() == 'KERNEL-SIGNED · VERIFIED',
            'live workspace snapshot was not labelled kernel-signed and verified')
    live_file = page.locator('[data-act="live-file"][data-path="design/plan.md"]')
    live_file.wait_for(timeout=15_000)
    live_file.click()
    page.locator('#detailbody [data-act="secure-download"]').wait_for(timeout=15_000)
    page.locator('#fv-body').wait_for(timeout=15_000)
    require(page.locator('.live-view-meta .transport-badge').text_content()
            == 'KERNEL-SIGNED METADATA · BYTES CHECKED',
            'live file viewer lost its signed metadata and byte-integrity label')


def run(args: argparse.Namespace) -> dict:
    STATE.reset()
    server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    base = f'http://127.0.0.1:{port}'
    node = f'{base}/node'
    url = f'{base}/?peer={node}&no_local_discovery=1&ipfs_routing={node}/ipfs/'
    screenshots = Path(args.screenshot_dir).resolve() if args.screenshot_dir else None
    if screenshots:
        screenshots.mkdir(parents=True, exist_ok=True)

    result: dict = {}
    try:
        with sync_playwright() as playwright:
            launch = {'headless': True}
            executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
            if executable:
                launch['executable_path'] = executable
            browser = playwright.chromium.launch(**launch)
            context = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
            page = context.new_page()
            errors: list[str] = []
            requests: list[dict] = []
            downloads: list[str] = []
            page.on('console', lambda msg: errors.append(f'console {msg.type}: {msg.text}')
                    if msg.type in {'warning', 'error'} else None)
            page.on('pageerror', lambda error: errors.append(f'pageerror: {error}'))
            page.on('request', lambda request: requests.append({
                'url': request.url,
                'authorization': request.headers.get('authorization', ''),
                'referer': request.headers.get('referer', ''),
                'resource_type': request.resource_type,
            }))
            page.on('download', lambda download: downloads.append(download.suggested_filename))
            page.add_init_script(f"""
              sessionStorage.setItem('personaos_operator', JSON.stringify({{{json.dumps(node)}:'fixture-token'}}));
              localStorage.setItem('personaos_operator', JSON.stringify({{{json.dumps(node)}:'legacy-token'}}));
            """)
            page.goto(url, wait_until='domcontentloaded')
            open_live_plan(page)
            require(page.locator('#fv-body img').count() == 0, 'Markdown loaded an embedded or remote image')
            require(not any('example.invalid' in item['url'] for item in requests),
                    'peer-authored Markdown fetched a remote resource')
            require(page.locator('#detailclose').get_attribute('aria-label') == 'Close details',
                    'icon-only detail close button lost its accessible name')

            # A body that fails its advertised hash keeps the signed metadata but
            # must not claim that bytes were checked successfully.
            page.locator('#detailback').click()
            page.route('**/live-artifacts/body/**', lambda route: route.fulfill(
                status=200, body='tampered initial viewer body', content_type='text/plain'))
            page.locator('[data-act="live-file"][data-path="design/plan.md"]').click()
            failed_badge = page.locator('.live-view-meta .transport-badge.failed')
            failed_badge.wait_for(timeout=10_000)
            require(failed_badge.text_content() == 'KERNEL-SIGNED METADATA · BYTES NOT VERIFIED',
                    'failed body verification was labelled as bytes checked')
            require('SHA-256 mismatch' in page.locator('#detailbody').inner_text(),
                    'initial body hash mismatch was not surfaced')
            if screenshots:
                page.screenshot(path=str(screenshots / 'desktop-live-body-refused.png'),
                                full_page=True)
            page.unroute('**/live-artifacts/body/**')
            page.locator('#detailback').click()
            page.locator('[data-act="live-file"][data-path="design/plan.md"]').click()
            page.locator('.live-view-meta .transport-badge.verified').wait_for(timeout=10_000)

            button = page.locator('#detailbody [data-act="secure-download"]')
            hrefs = page.locator('#detailbody a').evaluate_all('(els) => els.map((el) => el.href)')
            require(not any('token=' in href or '/live-artifacts/body/' in href for href in hrefs),
                    'a live body or token remains in a navigable link')

            # A changed response must fail closed before any download is created.
            page.route('**/live-artifacts/body/**', lambda route: route.fulfill(
                status=200, body='<script>throw new Error("must not execute")</script>',
                content_type='text/html'))
            before_downloads = len(downloads)
            button.click()
            page.locator('.secure-download.no').wait_for(timeout=5_000)
            require('SHA-256 mismatch' in button.text_content(), 'tampered download was not rejected')
            require(len(downloads) == before_downloads, 'tampered bytes triggered a browser download')
            page.unroute('**/live-artifacts/body/**')

            with page.expect_download(timeout=15_000) as download_info:
                button.click()
            download = download_info.value
            require(download.suggested_filename == 'plan.md', 'verified download filename changed')
            require(page.url == url, 'secure download navigated the portal')

            storage = page.evaluate("""() => ({
              session: sessionStorage.getItem('personaos_operator'),
              durable: localStorage.getItem('personaos_operator')
            })""")
            require(storage['durable'] is None, 'legacy durable operator token was not deleted')
            require('fixture-token' in (storage['session'] or ''), 'session token was lost')

            body_requests = [item for item in requests if '/live-artifacts/body/' in item['url']]
            event_requests = [item for item in requests if '/node/events' in item['url']]
            require(body_requests, 'no live body request was observed')
            require(all(item['authorization'] == 'Bearer fixture-token' for item in body_requests),
                    'a live body request omitted the Authorization header')
            require(all(not item['referer'] for item in body_requests),
                    'an authenticated live body request sent a Referer')
            require(not event_requests, 'authenticated EventSource should use header-bearing polling')
            external_exec = [item['url'] for item in requests
                             if item['resource_type'] in {'script', 'worker'}
                             and item['url'].startswith(('http://', 'https://'))
                             and not item['url'].startswith(base + '/')]
            require(not external_exec, 'external executable code loaded: ' + ', '.join(external_exec))

            before_hash = page.locator('.exact-hash').last.text_content()
            page.locator('#detailback').click()
            image_file = page.locator('[data-act="live-file"][data-path="drawings/concept.svg"]')
            image_file.wait_for(timeout=10_000)
            image_file.click()
            image = page.locator('#fv-body img')
            image.wait_for(timeout=10_000)
            require(image.evaluate('(img) => img.naturalWidth > 0'), 'octet-stream SVG did not render')
            image_hash = page.locator('.exact-hash').last.text_content()
            image_src = image.get_attribute('src')
            page.evaluate("fetch('/node/advance', {cache: 'no-store'})")
            page.wait_for_function("""(previous) => {
              const hashes=[...document.querySelectorAll('.exact-hash')];
              return hashes.length && hashes[hashes.length-1].textContent !== previous;
            }""", arg=image_hash, timeout=10_000)
            image.wait_for(timeout=10_000)
            require(image.evaluate('(img) => img.naturalWidth > 0'), 'updated SVG did not rerender')
            require(image.get_attribute('src') != image_src, 'updated image retained its old blob URL')
            require(page.locator('.live-diff').count() == 0, 'binary viewer claimed a text diff')

            page.locator('#detailback').click()
            page.locator('[data-act="live-file"][data-path="design/plan.md"]').click()
            page.locator('.live-diff').wait_for(timeout=10_000)
            after_hash = page.locator('.exact-hash').last.text_content()
            require(before_hash != after_hash, 'open live file did not refresh to the next hash')
            if screenshots:
                page.screenshot(path=str(screenshots / 'desktop-live-security.png'), full_page=True)
            require(not errors, 'desktop console errors: ' + '; '.join(errors))
            context.close()

            # A valid HTTP response with metadata changed after signing must not
            # enter the live state. The following untampered poll may then advance it.
            STATE.reset()
            tamper_context = browser.new_context(viewport={'width': 1440, 'height': 900})
            tamper = tamper_context.new_page()
            tamper_errors: list[str] = []
            tamper.on('console', lambda msg: tamper_errors.append(f'console {msg.type}: {msg.text}')
                      if msg.type in {'warning', 'error'} else None)
            tamper.on('pageerror', lambda error: tamper_errors.append(f'pageerror: {error}'))
            tamper.add_init_script(f"""
              sessionStorage.setItem('personaos_operator', JSON.stringify({{{json.dumps(node)}:'fixture-token'}}));
            """)
            tamper.goto(url, wait_until='domcontentloaded')
            open_live_plan(tamper)
            signed_hash = tamper.locator('.exact-hash').last.text_content()
            tamper_context.request.get(base + '/node/advance-with-tampered-poll')
            deadline = time.time() + 8
            while time.time() < deadline:
                if tamper_context.request.get(base + '/node/tampered-poll-served').json().get('served'):
                    break
                time.sleep(0.1)
            else:
                raise AssertionError('fixture did not serve the tampered signed snapshot')
            tamper.wait_for_timeout(500)
            require(tamper.locator('.exact-hash').last.text_content() == signed_hash,
                    'snapshot changed after its signature was tampered')
            tamper.wait_for_function("""(previous) => {
              const hashes=[...document.querySelectorAll('.exact-hash')];
              return hashes.length && hashes[hashes.length-1].textContent !== previous;
            }""", arg=signed_hash, timeout=10_000)
            tamper.locator('#detailback').click()
            require(tamper.locator('.live-artifacts .transport-badge').text_content()
                    == 'KERNEL-SIGNED · VERIFIED',
                    'verified trust label was lost after tamper recovery')
            if screenshots:
                tamper.screenshot(path=str(screenshots / 'desktop-live-signature-tamper.png'),
                                  full_page=True)
            require(not tamper_errors, 'tamper browser console errors: ' + '; '.join(tamper_errors))
            tamper_context.close()

            # Current master-key rotation must refresh the registry and must not
            # let the previous entry overwrite the current key with the same id.
            STATE.reset()
            rotation_context = browser.new_context(viewport={'width': 1440, 'height': 900})
            rotation = rotation_context.new_page()
            rotation_errors: list[str] = []
            rotation.on('console', lambda msg: rotation_errors.append(f'console {msg.type}: {msg.text}')
                        if msg.type in {'warning', 'error'} else None)
            rotation.on('pageerror', lambda error: rotation_errors.append(f'pageerror: {error}'))
            rotation.add_init_script(f"""
              sessionStorage.setItem('personaos_operator', JSON.stringify({{{json.dumps(node)}:'fixture-token'}}));
            """)
            rotation.goto(url, wait_until='domcontentloaded')
            open_live_plan(rotation)
            pre_rotation_hash = rotation.locator('.exact-hash').last.text_content()
            rotation_context.request.get(base + '/node/rotate-and-advance')
            rotation.wait_for_function("""(previous) => {
              const hashes=[...document.querySelectorAll('.exact-hash')];
              return hashes.length && hashes[hashes.length-1].textContent !== previous;
            }""", arg=pre_rotation_hash, timeout=12_000)
            key_requests = rotation_context.request.get(base + '/node/key-requests').json()['requests']
            require(key_requests >= 2, 'live verification did not refresh keys after master rotation')
            if screenshots:
                rotation.screenshot(path=str(screenshots / 'desktop-live-key-rotation.png'),
                                    full_page=True)
            require(not rotation_errors,
                    'key-rotation browser console errors: ' + '; '.join(rotation_errors))
            rotation_context.close()

            STATE.reset()
            mobile_context = browser.new_context(viewport={'width': 390, 'height': 844})
            mobile = mobile_context.new_page()
            mobile_errors: list[str] = []
            mobile.on('console', lambda msg: mobile_errors.append(f'console {msg.type}: {msg.text}')
                      if msg.type in {'warning', 'error'} else None)
            mobile.on('pageerror', lambda error: mobile_errors.append(f'pageerror: {error}'))
            mobile.goto(url, wait_until='domcontentloaded')
            mobile.locator('.mcard[data-mrun="run-fixture-live"]').wait_for(timeout=15_000)
            metrics = mobile.evaluate("""() => {
              const selectors = ['.vitals','.globalbar','.missions','.constellation','.stage-wrap','footer'];
              const rects = selectors.map((selector) => {
                const el = document.querySelector(selector);
                if (!el || getComputedStyle(el).display === 'none') return null;
                const r = el.getBoundingClientRect();
                return {selector, top:r.top, bottom:r.bottom};
              }).filter(Boolean);
              const overlaps = [];
              for (let i=1; i<rects.length; i++) {
                if (rects[i-1].bottom > rects[i].top + 1) overlaps.push([rects[i-1], rects[i]]);
              }
              return {scrollWidth:document.documentElement.scrollWidth,
                clientWidth:document.documentElement.clientWidth, rects, overlaps};
            }""")
            require(metrics['scrollWidth'] <= metrics['clientWidth'] + 1, 'mobile page overflows horizontally')
            require(not metrics['overlaps'], 'mobile page bands overlap')
            mobile.locator('.mcard[data-mrun="run-fixture-live"]').click()
            mobile.locator('[data-act="live-file"][data-path="design/plan.md"]').wait_for(timeout=15_000)
            drawer = mobile.evaluate("""() => {
              const el=document.querySelector('#detailbody');
              return {scrollWidth:el.scrollWidth, clientWidth:el.clientWidth};
            }""")
            require(drawer['scrollWidth'] <= drawer['clientWidth'] + 1, 'mobile live drawer overflows')
            mobile.locator('[data-act="live-file"][data-path="design/plan.md"]').click()
            mobile.locator('.live-view-meta .transport-badge.verified').wait_for(timeout=15_000)
            file_drawer = mobile.evaluate("""() => {
              const el=document.querySelector('#detailbody');
              return {scrollWidth:el.scrollWidth, clientWidth:el.clientWidth};
            }""")
            require(file_drawer['scrollWidth'] <= file_drawer['clientWidth'] + 1,
                    'mobile signed live-file viewer overflows')
            if screenshots:
                mobile.screenshot(path=str(screenshots / 'mobile-live-run.png'), full_page=True)
            require(not mobile_errors, 'mobile console errors: ' + '; '.join(mobile_errors))
            mobile_context.close()

            # Public SSE must preserve the revision chain when an older poll returns
            # after a newer event, then stop polling when run_ended arrives.
            STATE.reset()
            sse_context = browser.new_context(viewport={'width': 1440, 'height': 900})
            sse = sse_context.new_page()
            sse_errors: list[str] = []
            sse_requests: list[str] = []
            sse_failed_responses: list[str] = []
            sse.on('console', lambda msg: sse_errors.append(f'console {msg.type}: {msg.text}')
                   if msg.type in {'warning', 'error'} else None)
            sse.on('pageerror', lambda error: sse_errors.append(f'pageerror: {error}'))
            sse.on('request', lambda request: sse_requests.append(request.url))
            sse.on('response', lambda response: sse_failed_responses.append(
                f'{response.status} {response.url}') if response.status >= 400 else None)
            sse.goto(url, wait_until='domcontentloaded')
            open_live_plan(sse)
            sse.locator('#fv-body').wait_for(timeout=10_000)
            old_hash = sse.locator('.exact-hash').last.text_content()
            require(any('/node/events' in request for request in sse_requests), 'public SSE stream did not connect')
            sse_context.request.get(base + '/node/arm-stale-poll')
            deadline = time.time() + 7
            while time.time() < deadline:
                if sse_context.request.get(base + '/node/stale-started').json().get('started'):
                    break
                time.sleep(0.1)
            else:
                raise AssertionError('fixture did not start the delayed stale poll')
            sse_context.request.get(base + '/node/advance')
            sse.wait_for_function("""(previous) => {
              const hashes=[...document.querySelectorAll('.exact-hash')];
              return hashes.length && hashes[hashes.length-1].textContent !== previous;
            }""", arg=old_hash, timeout=10_000)
            new_hash = sse.locator('.exact-hash').last.text_content()
            sse.wait_for_timeout(2_500)
            require(sse.locator('.exact-hash').last.text_content() == new_hash,
                    'delayed poll overwrote the newer SSE revision')
            sse.locator('#detailback').click()
            sse.locator('.live-artifacts').wait_for(timeout=10_000)
            sse_context.request.get(base + '/node/end')
            sse.locator('.live-artifacts.ended').wait_for(timeout=10_000)
            requests_at_end = len([item for item in sse_requests if item.endswith('/live-artifacts')])
            sse.wait_for_timeout(3_500)
            require(len([item for item in sse_requests if item.endswith('/live-artifacts')]) == requests_at_end,
                    'live polling continued after run_ended')
            if screenshots:
                sse.screenshot(path=str(screenshots / 'desktop-sse-ended.png'), full_page=True)
            require(not sse_errors, 'SSE console errors: ' + '; '.join(sse_errors)
                    + '; failed responses: ' + '; '.join(sse_failed_responses))
            sse_context.close()
            browser.close()

            result = {
                'download': download.suggested_filename,
                'tamper_refused': True,
                'metadata_tamper_refused': True,
                'key_rotation_refreshed': True,
                'body_requests': len(body_requests),
                'event_requests': len(event_requests),
                'hash_changed': before_hash != after_hash,
                'image_rerendered': True,
                'stale_poll_refused': True,
                'run_ended_stopped_polling': True,
                'mobile': {**metrics, 'drawer': drawer, 'file_drawer': file_drawer},
                'console_errors': (errors + tamper_errors + rotation_errors
                                   + mobile_errors + sse_errors),
            }
    except PlaywrightTimeoutError as error:
        raise AssertionError(f'Playwright timed out: {error}') from error
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshot-dir', help='optional output directory for validation captures')
    args = parser.parse_args()
    print(json.dumps(run(args), indent=2))


if __name__ == '__main__':
    main()
