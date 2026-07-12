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

from live_ui_fixture import (
    Handler,
    PROVIDER_DISCOVER_ONLY,
    PROVIDER_EXPIRED_READ,
    PROVIDER_P2P_ONLY,
    PROVIDER_SCOPED_READ,
    PROVIDER_SSE_LEGACY,
    RUN,
    STATE,
    ThreadingHTTPServer,
    p2p_discover_only_resolution,
    p2p_provider_resolution,
)


class QuietHandler(Handler):
    def log_message(self, fmt: str, *args) -> None:
        return


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def open_live_plan(page) -> None:
    mission = page.locator('.mcard[data-mrun="run-fixture-live"]')
    mission.wait_for(state='attached', timeout=15_000)
    page.locator('#missions').evaluate('(element) => { element.open = true; }')
    mission.wait_for(state='visible', timeout=5_000)
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
    url = f'{base}/?peer={node}&no_local_discovery=1&no_global_discovery=1&ipfs_routing={node}/ipfs/'
    screenshots = Path(args.screenshot_dir).resolve() if args.screenshot_dir else None
    if screenshots:
        screenshots.mkdir(parents=True, exist_ok=True)

    result: dict = {}
    scale_metrics: dict = {}
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
            page.wait_for_function("""() => document.querySelector('#log')?.textContent
              .includes('8/12 record(s) provider + record + policy verified')""", timeout=15_000)
            signed_live_task = page.locator(
                '.mcard[data-mrec]', has_text='prepare the site approval package'
            )
            signed_live_task.wait_for(state='attached', timeout=15_000)
            signed_live_task_text = signed_live_task.text_content() or ''
            require('AWAITING PEER SYNTHESIS' in signed_live_task_text,
                    'signed public live task did not preserve its exact arbitrary state')
            require('signed live task' in signed_live_task_text,
                    'signed public live task lacks explicit signed-source context')
            page.wait_for_function(
                """() => document.querySelector('#p2p')?.textContent.startsWith('P2P · libp2p ')""",
                timeout=15_000,
            )
            require('String multiaddr must start with' not in (page.locator('#log').text_content() or ''),
                    'HTTP federation URL escaped into the libp2p bootstrap list')
            page.wait_for_function("""() => document.querySelectorAll('#sysGraph .cl-direct').length === 2""",
                                   timeout=15_000)
            page.wait_for_function("""() => [...document.querySelectorAll('.pc-activity')]
              .some((node) => node.textContent.includes('recorded message intent'))""", timeout=15_000)
            compact_header_height = page.locator('#appHeader').evaluate('(element) => element.offsetHeight')
            require(compact_header_height <= 60,
                    f'default command dock is not compact: {compact_header_height}px')
            require(page.locator('.vgroup-tools').evaluate(
                '(element) => getComputedStyle(element).display') == 'none',
                    'advanced header controls occupy permanent space')
            require(page.locator('#missions').get_attribute('open') is None,
                    'mission history is expanded by default')
            require(page.locator('.mission-summary').evaluate(
                '(element) => element.getBoundingClientRect().height') <= 52,
                    'collapsed mission ribbon is taller than its useful content')
            require(page.locator('.mission-summary > span:nth-child(2)').evaluate(
                '(element) => element.getBoundingClientRect().width') >= 140,
                    'compact desktop mission island squeezes its useful title')
            rail = page.locator('.workspace-rail').evaluate("""(element) => {
              const shell=element.querySelector('.command-shell').getBoundingClientRect();
              const context=element.querySelector('.context-dock').getBoundingClientRect();
              return {height:element.getBoundingClientRect().height,
                shellTop:shell.top,contextTop:context.top};
            }""")
            require(rail['height'] <= 60 and abs(rail['shellTop'] - rail['contextTop']) <= 1,
                    'desktop command, mission, and topology controls still stack as permanent headers')
            require(page.locator('.stage-wrap').evaluate(
                '(element) => element.getBoundingClientRect().top') <= 90,
                    'desktop workspace begins below oversized application chrome')
            page.locator('#headerToolsToggle').click()
            require(page.locator('.vgroup-tools').evaluate(
                '(element) => getComputedStyle(element).display') != 'none',
                    'command dock did not reveal search and network controls')
            require(page.locator('#appHeader').evaluate('(element) => element.offsetHeight') > compact_header_height,
                    'expanded command dock did not expose its control surface')
            page.locator('#headerToolsToggle').click()
            require(page.locator('#sysGraph .cl-direct').count() == 2,
                    'shared environment scope created an inferred persona chord')
            recipients_row = page.locator('.pcard[title="open Ivo Reed"]').locator(
                '.pc-activity-row', has_text='Mara Chen')
            require(recipients_row.count() >= 1,
                    'recipients-only persona endpoint was omitted from the live feed')
            require('recorded message intent' in recipients_row.first.text_content(),
                    'communication intent was overstated as delivered content')
            require(page.locator('.coordfeed').count() == 0,
                    'detached global persona activity rail remains in the layout')
            require('LIVE · PERSONA ACTIVITY' not in page.locator('body').inner_text(),
                    'legacy global activity headline remains visible')
            require(page.locator('.mcard .mtask').filter(has_text='.json').count() == 0,
                    'artifact JSON filename was presented as a mission task')
            require(page.locator('.env-card .owned-outputs').count() >= 1,
                    'environment-scoped deliverable was not placed with its environment')
            require(page.locator('.env-card .env-card-avatar').count() >= 1,
                    'environment did not receive collectible card identity artwork')
            require(page.locator('.env-card .env-card-stats > span').count() >= 3,
                    'environment card omitted useful workspace facts')
            require(page.locator('.env-card .env-card-footer').count() >= 1,
                    'environment card omitted ownership context')
            require(page.locator('.env-card .pcard').count() == 0,
                    'persona cards remain nested inside environment cards')
            require(page.locator('.persona-deck > .pcard').count() == 3,
                    'persona-first deck did not render the live roster once')
            orin = page.locator('.pcard[title="open Orin Vale"]')
            require(orin.locator('.pc-env-chip').count() >= 1,
                    'persona card did not name its current environment')
            persona_cards = page.locator('.persona-deck > .pcard')
            require(page.locator('.pcard .pc-avatar').count() == persona_cards.count(),
                    'not every actual persona received exactly one avatar')
            orin_avatar = orin.locator('.pc-avatar')
            require(orin_avatar.get_attribute('data-avatar-source') == 'signed',
                    'signed PersonaCard avatar descriptor was not rendered')
            require(orin_avatar.locator('.pc-avatar-initials').text_content() == 'OV',
                    'signed avatar initials were not preserved')
            require(page.locator(
                '.pcard .pc-avatar[data-avatar-source="legacy-fallback"]').count() == 2,
                    'personas without a valid signed descriptor lack deterministic fallbacks')
            require(page.locator('.pcard .pc-avatar svg').count() == persona_cards.count(),
                    'persona avatars were not rendered as one local SVG per persona')
            require(page.locator('.pcard .pc-avatar img').count() == 0,
                    'persona avatar rendering introduced a fetchable image surface')
            orin.click()
            page.locator('#detailwrap.open .kind.k-persona').wait_for(timeout=15_000)
            inspector = page.evaluate("""() => {
              const panel=document.querySelector('.drawer').getBoundingClientRect();
              return {left:panel.left,right:panel.right,width:panel.width,
                mask:getComputedStyle(document.querySelector('#detailwrap')).backgroundImage,
                bodyOpen:document.body.classList.contains('detail-open'),
                focusInside:document.querySelector('#detailwrap').contains(document.activeElement)};
            }""")
            require(480 <= inspector['width'] <= 680 and inspector['right'] >= 1426,
                    'persona inspector is not a usable right-side panel')
            require('linear-gradient' in inspector['mask'] and inspector['bodyOpen'],
                    'persona inspector did not apply the directional workspace mask')
            require(inspector['focusInside'] and orin.get_attribute('aria-expanded') == 'true',
                    'persona inspector lost focus or source-card context')
            require(not page.locator('#detailback').is_visible(),
                    'initial entity inspector exposes a misleading back action')
            model_row = page.locator('#detailbody .row', has_text='Model').first
            require(len(model_row.inner_text()) < 120,
                    'persona inspector rendered unbounded telemetry prose as a model role')
            page.locator('#detailclose').click()
            env_source = page.locator('.env-card').first
            env_source.locator('.env-name').click()
            page.locator('#detailwrap.open .kind.k-env').wait_for(timeout=15_000)
            require(env_source.get_attribute('aria-expanded') == 'true',
                    'environment inspector did not retain its source-card context')
            page.locator('#detailwrap').click(position={'x': 24, 'y': 220})
            require(not page.locator('#detailwrap').evaluate('(element) => element.classList.contains("open")'),
                    'clicking the inspection mask did not close the environment panel')
            require(page.locator('.pcard[title="open Orin Vale"]').locator(
                '.live-owned-outputs').count() >= 1,
                    'persona-owned live worktree was not placed with its persona')
            require('live' in (page.locator('.pcard[title="open Ivo Reed"]').get_attribute('class') or ''),
                    'recipients-only persona endpoint was omitted from recent activity')
            followed = page.locator('.pcard[title="open Mara Chen"]')
            followed.locator('.pc-follow').click()
            page.locator('#headerToggle').click()
            page.wait_for_function("""() => document.querySelector('#appHeader')?.offsetHeight === 0""",
                                   timeout=5_000)
            require(page.locator('#headerToggle').get_attribute('aria-expanded') == 'false',
                    'collapsed header disclosure state is inaccurate')
            require(page.locator('.command-shell > #headerToggle').count() == 1,
                    'collapsed header control escaped the unified command island')
            page.locator('#headerToggle').click()
            page.wait_for_function("""() => document.querySelectorAll('#sysGraph .gn-followed').length === 1""",
                                   timeout=5_000)
            require(followed.locator('.pc-follow').get_attribute('aria-pressed') == 'true',
                    'kernel-qualified follow state did not select the requested persona')
            require(page.locator('.pcard.dimmed').count() == 2,
                    'following one persona did not scope the other federated cards')
            followed.locator('.pc-follow').click()
            if screenshots:
                page.screenshot(path=str(screenshots / 'desktop-network-messages.png'), full_page=True)
                page.locator('.environment-section').screenshot(
                    path=str(screenshots / 'desktop-environment-cards.png'))
            provider_refused = page.locator('#log li:has(.bad)').filter(has_text='provider:')
            require(provider_refused.count() >= 2,
                    'tampered ProviderRecord document entered browser discovery')
            log_text = page.locator('#log').text_content()
            require('Signed provider authority accepted · public read granted' in log_text,
                    'valid public-read policy was not evaluated truthfully')
            require(log_text.count('discover-only; read links withheld') >= 3,
                    'discover-only, expired, or wrong-scope grants retained read links')
            require('Historical document accepted · public read granted' in log_text,
                    'registered historical document signature was not accepted')
            for record_id in (
                    PROVIDER_DISCOVER_ONLY, PROVIDER_EXPIRED_READ, PROVIDER_SCOPED_READ):
                raw_document = context.request.get(
                    f'{node}/discovery/public/records/{record_id}.json').json()
                require(raw_document.get('projection') == 'discover',
                        f'{record_id} was not server-projected before HTTP publication')
                require('links' not in raw_document,
                        f'{record_id} anonymous HTTP response contained links')
                for forbidden in ('description', 'content_hash', 'content_locator_ref', 'interfaces'):
                    require(forbidden not in raw_document.get('record', {}),
                            f'{record_id} anonymous HTTP response contained {forbidden}')
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
            avatar_requests = [item['url'] for item in requests
                               if ('persona-avatar-fallback' in item['url'].lower()
                                   or ('/personas/' in item['url'].lower()
                                       and '/avatar.' in item['url'].lower())
                                   or (item['resource_type'] == 'image'
                                       and 'avatar' in item['url'].lower()))]
            require(not avatar_requests,
                    'persona avatar rendering fetched image bytes: ' + ', '.join(avatar_requests))

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

            # An unknown hash-bound binary is still useful: it gets a bounded,
            # non-executable byte inspector rather than an empty drawer.
            page.locator('#detailback').click()
            binary_file = page.locator(
                '[data-act="live-file"][data-path="attachments/controller.bin"]')
            binary_file.wait_for(timeout=10_000)
            binary_file.click()
            hex_view = page.locator('#fv-body .fv-hex')
            hex_view.wait_for(timeout=10_000)
            require('00000000' in hex_view.text_content(),
                    'generic binary viewer did not expose a bounded hex preview')
            require(page.locator('.live-view-meta .transport-badge.verified').count() == 1,
                    'generic binary viewer lost byte-integrity verification')

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

            # A browser with no HTTP provider-index seeds must be able to promote
            # a raw gossip handle only through current-master ProviderRecord resolution.
            STATE.reset()
            p2p_context = browser.new_context(viewport={'width': 1280, 'height': 800})
            p2p_page = p2p_context.new_page()
            p2p_errors: list[str] = []
            p2p_page.on('console', lambda msg: p2p_errors.append(f'console {msg.type}: {msg.text}')
                        if msg.type in {'warning', 'error'} else None)
            p2p_page.on('pageerror', lambda error: p2p_errors.append(f'pageerror: {error}'))
            p2p_context.add_init_script(f"""
              sessionStorage.setItem('personaos_operator', JSON.stringify({{{json.dumps(node)}:'fixture-token'}}));
            """)
            p2p_envelope, p2p_document = p2p_provider_resolution(node)
            p2p_item = {**p2p_envelope, 'document': p2p_document}
            discover_envelope, discover_document = p2p_discover_only_resolution(node)
            discover_item = {**discover_envelope, 'document': discover_document}
            require(discover_document.get('projection') == 'discover'
                    and 'links' not in discover_document,
                    'zero-grant P2P document was not projected before transport')
            for forbidden in ('description', 'content_hash', 'content_locator_ref', 'interfaces'):
                require(forbidden not in discover_document.get('record', {}),
                        f'zero-grant P2P response contained {forbidden}')
            discover_key = discover_document['record']['did']
            malicious_hint = {
                'schema': 'discoverable-record/1',
                'record_id': PROVIDER_P2P_ONLY,
                'kind': 'artifact',
                'label': 'MALICIOUS SELF-KEY LABEL MUST NEVER DISPLAY',
                'handle': 'p2p-only-handle',
                'visibility_tier': 'public',
            }
            stub = f"""
              const item={json.dumps(p2p_item, separators=(',', ':'))};
              const discoverItem={json.dumps(discover_item, separators=(',', ':'))};
              const hint={{record:{json.dumps(malicious_hint, separators=(',', ':'))},
                public_key_hex:'{'ff' * 32}',signature_hex:'{'00' * 64}',
                base:'https://attacker.invalid',kernel_id:'kernel:attacker'}};
              const discoverHint={{record:{{schema:'discoverable-record/1',
                record_id:'{discover_document['record']['record_id']}',
                did:'{discover_key}',kind:'artifact',visibility_tier:'public'}}}};
              export async function startP2P({{onRecord}}){{
                const node={{peerId:{{toString:()=> '12D3KooWBrowserFixture'}},getPeers:()=>[],
                  contentRouting:{{provide:async()=>{{}},findProviders:async function*(){{}}}}}};
                globalThis.__p2pResolvedKeys=[];
                setTimeout(()=>onRecord(hint),10);
                setTimeout(()=>onRecord(discoverHint),20);
                return {{node,announce:async()=>{{}},resolveProvider:async(key)=>{{
                  globalThis.__p2pResolvedKeys.push(key);
                  return key==='p2p-only-handle'
                    ? {{schema:'personaos-browser-provider-resolution/1',key,records:[item]}}
                    : key==='{discover_key}'
                    ? {{schema:'personaos-browser-provider-resolution/1',key,records:[discoverItem]}}
                    : {{schema:'personaos-browser-provider-resolution/1',key,records:[]}};
                }}}};
              }}
            """
            p2p_page.route('**/node/providers.json', lambda route: route.fulfill(
                status=200, json={'providers': []}))
            p2p_page.route('**/assets/p2p-libp2p.js*', lambda route: route.fulfill(
                status=200, body=stub, content_type='application/javascript'))
            p2p_page.goto(url, wait_until='domcontentloaded')
            p2p_page.wait_for_function("""() => document.querySelector('#log')?.textContent
              .includes('libp2p gossip: 1 current-master ProviderRecord(s) verified')""",
                timeout=15_000)
            p2p_log = p2p_page.locator('#log').text_content()
            require('untrusted lookup hint only; awaiting current-master ProviderRecord' in p2p_log,
                    'raw gossip was not labelled as an untrusted lookup hint')
            require('P2P handle resolved by current' in p2p_log
                    and 'public read granted' in p2p_log,
                    'P2P-only resolved record did not pass full provider/policy verification')
            require('P2P discover-only projection · discover-only; read links withheld' in p2p_log,
                    'zero-grant P2P projection did not verify as discover-only')
            require('MALICIOUS SELF-KEY LABEL' not in p2p_log,
                    'raw self-key gossip metadata entered the UI')
            resolved_keys = p2p_page.evaluate('globalThis.__p2pResolvedKeys')
            require('p2p-only-handle' in resolved_keys,
                    'gossip handle was not used as a bounded provider lookup key')
            require(not p2p_errors, 'P2P-only browser console errors: ' + '; '.join(p2p_errors))
            p2p_context.close()

            # Large-population integration: selector helpers cover a one-million
            # generator; this browser pass proves the actual graph/stage keep a
            # hard DOM window and can search beyond the initial card window.
            scale_context = browser.new_context(viewport={'width': 1600, 'height': 1000})
            scale_context.request.get(base + '/node/scale?count=2000')
            scale = scale_context.new_page()
            scale_errors: list[str] = []
            scale.on('console', lambda msg: scale_errors.append(f'console {msg.type}: {msg.text}')
                     if msg.type in {'warning', 'error'} else None)
            scale.on('pageerror', lambda error: scale_errors.append(f'pageerror: {error}'))
            scale.add_init_script(f"""
              sessionStorage.setItem('personaos_operator', JSON.stringify({{{json.dumps(node)}:'fixture-token'}}));
            """)
            scale.goto(url, wait_until='domcontentloaded')
            scale.locator('.pcard').first.wait_for(timeout=15_000)
            scale.wait_for_function("""() => document.querySelector('#graphWindow')?.textContent.includes('2K')""",
                                    timeout=15_000)
            require(scale.locator('.pcard').count() == 12,
                    'large stage did not retain its 12-card initial window')
            scale_graph_personas = scale.locator('#sysGraph [data-gp]').count()
            require(scale_graph_personas <= 36,
                    'large graph exceeded its exact-persona cap')
            require(scale.locator('[data-kernel-core]').count() <= 6,
                    'large graph exceeded its kernel cap')
            require(scale.locator('body *').count() < 1_500,
                    'large population materialized an unbounded DOM')
            if screenshots:
                scale.screenshot(path=str(screenshots / 'desktop-scale-window.png'), full_page=True)
            scale.locator('[data-more-personas]').click()
            scale.wait_for_function("""() => document.querySelectorAll('.pcard').length === 24""",
                                    timeout=10_000)
            scale.locator('#headerToolsToggle').click()
            scale.locator('#q').fill('Scale Persona 01999')
            scale.wait_for_function("""() => [...document.querySelectorAll('.pcard')]
              .some((card) => card.textContent.includes('Scale Persona 01999'))""", timeout=10_000)
            require(scale.locator('.pcard').count() <= 24,
                    'search escaped the progressive persona window')
            scale_metrics = {
                'source_personas': 2000,
                'initial_cards': 12,
                'expanded_cards': 24,
                'graph_personas': scale_graph_personas,
                'dom_nodes_after_search': scale.locator('body *').count(),
                'deep_search_found': True,
            }
            if screenshots:
                scale.screenshot(path=str(screenshots / 'desktop-scale-search.png'), full_page=True)
            require(not scale_errors, 'large-population browser errors: ' + '; '.join(scale_errors))
            scale_context.request.get(base + '/node/scale?count=0')
            scale_context.close()

            STATE.reset()
            mobile_context = browser.new_context(viewport={'width': 390, 'height': 844})
            mobile = mobile_context.new_page()
            mobile_errors: list[str] = []
            mobile.on('console', lambda msg: mobile_errors.append(f'console {msg.type}: {msg.text}')
                      if msg.type in {'warning', 'error'} else None)
            mobile.on('pageerror', lambda error: mobile_errors.append(f'pageerror: {error}'))
            mobile.goto(url, wait_until='domcontentloaded')
            mobile.locator('.mcard[data-mrun="run-fixture-live"]').wait_for(
                state='attached', timeout=15_000)
            metrics = mobile.evaluate("""() => {
              const selectors = ['.workspace-rail','.stage-wrap','footer'];
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
              const clientWidth=document.documentElement.clientWidth;
              const wide=[...document.body.querySelectorAll('*')].map((el)=>{
                const r=el.getBoundingClientRect();
                if (r.right <= clientWidth + 1 && r.left >= -1) return null;
                const name=el.id ? `#${el.id}`
                  : `${el.tagName.toLowerCase()}${[...el.classList].slice(0,3).map((c)=>`.${c}`).join('')}`;
                return {name,left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};
              }).filter(Boolean).slice(0,20);
              const componentHeight=(selector) => {
                const el=document.querySelector(selector); return el ? el.getBoundingClientRect().height : 999;
              };
              return {scrollWidth:document.documentElement.scrollWidth,
                clientWidth, rects, overlaps, wide, components:{
                  header:componentHeight('.vitals'),mission:componentHeight('.missions'),
                  rail:componentHeight('.workspace-rail'),stageTop:document.querySelector('.stage-wrap')?.getBoundingClientRect().top ?? 999
                }};
            }""")
            require(metrics['scrollWidth'] <= metrics['clientWidth'] + 1,
                    'mobile page overflows horizontally: ' + json.dumps(metrics['wide']))
            require(not metrics['overlaps'], 'mobile page bands overlap: ' + json.dumps(metrics['overlaps']))
            require(metrics['components']['header'] <= 60,
                    'mobile command dock occupies permanent expanded height')
            require(metrics['components']['mission'] <= 55,
                    f"mobile mission ribbon occupies permanent expanded height: {metrics['components']['mission']}px")
            require(metrics['components']['rail'] <= 110 and metrics['components']['stageTop'] <= 125,
                    'mobile workspace is still pushed down by stacked permanent headers')
            mobile.locator('#headerToggle').click()
            mobile.wait_for_function("""() => document.querySelector('#appHeader')?.offsetHeight === 0""",
                                     timeout=5_000)
            require(mobile.locator('#headerToggle').is_visible(),
                    'mobile full-collapse control disappeared with the hidden network navigator')
            mobile.locator('#headerToggle').click()
            mobile.locator('#missions').evaluate('(element) => { element.open = true; }')
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
            sse.route('**/node/providers.json', lambda route: route.fulfill(
                status=200, json={'providers': []}))
            sse.goto(url, wait_until='domcontentloaded')
            sse.wait_for_function("""() => document.querySelector('#log')?.textContent
              .includes('discovery snapshot: 1 current ProviderRecord(s) verified; 1 refused')""",
                timeout=15_000)
            open_live_plan(sse)
            sse.locator('#fv-body').wait_for(timeout=10_000)
            old_hash = sse.locator('.exact-hash').last.text_content()
            require(any('/node/events' in request for request in sse_requests), 'public SSE stream did not connect')
            require(not any(PROVIDER_SSE_LEGACY in request for request in sse_requests),
                    'legacy SSE record pointer bypassed ProviderRecord verification')
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
            sse.wait_for_function("""() => [...document.querySelectorAll('#detailbody .row')]
              .some((row) => row.querySelector('.l2')?.textContent === 'Status'
                && row.querySelector('.v2')?.textContent.trim().endsWith('ended'))""",
                timeout=10_000)
            require(sse.locator('#detailbody .live-call').count() == 0,
                    'verified terminal state retained an active model call')
            terminal_text = sse.locator('#detailbody').text_content().lower()
            require('model call active' not in terminal_text,
                    'verified final workspace retained model-call-active state')
            require('independent plan review is still open' not in terminal_text,
                    'verified terminal state retained a stale completion block')
            sse.wait_for_function("""() => document.querySelector('#st-active .v')?.textContent === '0'""",
                                  timeout=10_000)
            require(sse.locator(f'[data-mrun="{RUN}"] .ms-running').count() == 0,
                    'stale node status resurrected a terminal mission card')
            requests_at_end = len([item for item in sse_requests if item.endswith('/live-artifacts')])
            sse.wait_for_timeout(3_500)
            require(len([item for item in sse_requests if item.endswith('/live-artifacts')]) == requests_at_end,
                    'live polling continued after run_ended')
            require(sse.locator('#st-active .v').text_content() == '0',
                    'stale telemetry resurrected a terminal model call')
            if screenshots:
                sse.screenshot(path=str(screenshots / 'desktop-sse-ended.png'), full_page=True)
            sse.locator('[data-act="live-file"][data-path="design/plan.md"]').click()
            sse.locator('.live-view-meta .transport-badge.verified').wait_for(timeout=15_000)
            require(sse.locator('.live-view-meta .transport-badge').text_content()
                    == 'KERNEL-SIGNED METADATA · BYTES CHECKED',
                    'verified final workspace file bytes were not accepted')
            require(sse.locator('#fv-body').text_content().strip(),
                    'verified final workspace renderer is blank')
            if screenshots:
                sse.screenshot(path=str(screenshots / 'desktop-sse-final-file.png'), full_page=True)
            require(not sse_errors, 'SSE console errors: ' + '; '.join(sse_errors)
                    + '; failed responses: ' + '; '.join(sse_failed_responses))
            sse_context.close()
            browser.close()

            result = {
                'download': download.suggested_filename,
                'tamper_refused': True,
                'metadata_tamper_refused': True,
                'provider_authority_verified': True,
                'historical_provider_document_verified': True,
                'revoked_unknown_document_keys_refused': True,
                'discover_only_raw_http_minimal': True,
                'discover_only_raw_p2p_minimal': True,
                'p2p_only_provider_resolved': True,
                'sse_legacy_provider_refused': True,
                'key_rotation_refreshed': True,
                'body_requests': len(body_requests),
                'event_requests': len(event_requests),
                'hash_changed': before_hash != after_hash,
                'image_rerendered': True,
                'generic_binary_inspected': True,
                'stale_poll_refused': True,
                'run_ended_stopped_polling': True,
                'run_ended_cleared_runtime': True,
                'run_ended_file_verified': True,
                'scale': scale_metrics,
                'mobile': {**metrics, 'drawer': drawer, 'file_drawer': file_drawer},
                'console_errors': (errors + tamper_errors + rotation_errors + p2p_errors
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
