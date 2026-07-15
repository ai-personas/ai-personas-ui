#!/usr/bin/env python3
"""Playwright regression for live workspaces, secure downloads, and mobile layout."""

from __future__ import annotations

import argparse
import json
import os
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from live_ui_fixture import (
    ENV,
    ENV_SAME_TITLE,
    Handler,
    PROVIDER_DISCOVER_ONLY,
    PROVIDER_EXPIRED_READ,
    PROVIDER_P2P_ONLY,
    PROVIDER_SCOPED_READ,
    PROVIDER_SSE_LEGACY,
    PERSONA,
    PERSONA_INCOMPLETE,
    PERSONA_PENDING_SECOND,
    PERSONA_PEER,
    PRIVATE_THINKING_FRAME_PROBE,
    PUBLIC_PERSONA_MESSAGE,
    RUN,
    STATE,
    ThreadingHTTPServer,
    UNSIGNED_TELEMETRY_GHOST,
    p2p_discover_only_resolution,
    p2p_provider_resolution,
    public_persona_messages,
    provider_record_count,
    scale_persona_label,
    telemetry,
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
    require(badge.text_content() == 'WORKSPACE SNAPSHOT · SIGNATURE CHECKED',
            'live workspace snapshot did not distinguish signature checking from lifecycle')
    lifecycle = page.locator('.bundle-lifecycle-unknown')
    lifecycle.wait_for(timeout=15_000)
    require(lifecycle.text_content() == 'unknown',
            'unvalidated run JSON promoted an AnswerPackage/ArtifactBundle lifecycle')
    run_text = page.locator('#detailbody').inner_text()
    require('Run status and artifact-index JSON are not browser-validated bundle lifecycle evidence.'
            in run_text, 'run drawer did not explain its fail-closed bundle lifecycle')
    for forbidden in ('Signed AnswerPackage', 'forged-answer-accepted',
                      'forged-bundle-shipped', 'forged-index-accepted',
                      'truthy-but-not-browser-verified'):
        require(forbidden not in run_text,
                f'unvalidated bundle lifecycle claim reached the run drawer: {forbidden}')
    live_file = page.locator('[data-act="live-file"][data-path="design/plan.md"]')
    live_file.wait_for(timeout=15_000)
    live_file.click()
    page.locator('#detailbody [data-act="secure-download"]').wait_for(timeout=15_000)
    page.locator('#fv-body').wait_for(timeout=15_000)
    require(page.locator('.live-view-meta .transport-badge').text_content()
            == 'SNAPSHOT SIGNATURE CHECKED · BYTES CHECKED',
            'live file viewer lost its distinct snapshot-signature and byte-integrity label')


def run(args: argparse.Namespace) -> dict:
    STATE.reset()
    server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    base = f'http://127.0.0.1:{port}'
    node = f'{base}/node'
    url = f'{base}/?resolver={base}&no_local_discovery=1&ipfs_routing={node}/ipfs/'
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
            def empty_default_locator(route) -> None:
                body = ({
                    'schema': 'personaos-global-discovery-bootstrap/1',
                    'libp2p_multiaddrs': [],
                    'relay_multiaddrs': [],
                } if '/v1/bootstrap' in route.request.url else {
                    'schema': 'personaos-node-announcement-page/1',
                    'nodes': [],
                    'total': 0,
                    'next_cursor': '',
                })
                route.fulfill(
                    status=200,
                    content_type='application/json',
                    body=json.dumps(body),
                )

            context.route('https://node1.personas.ai/**', empty_default_locator)
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
                'at': time.monotonic(),
            }))
            page.on('download', lambda download: downloads.append(download.suggested_filename))
            page.add_init_script(f"""
              sessionStorage.setItem('personaos_operator', JSON.stringify({{{json.dumps(node)}:'fixture-token'}}));
              localStorage.setItem('personaos_operator', JSON.stringify({{{json.dumps(node)}:'legacy-token'}}));
            """)
            page.goto(url, wait_until='domcontentloaded')
            expected_records = provider_record_count()
            page.wait_for_function("""(expected) => document.querySelector('#log')?.textContent
              .includes(`${expected}/${expected} record(s) provider + record + policy verified`)""",
                                   arg=expected_records, timeout=15_000)
            page.wait_for_function("""(expected) => document.querySelector('#status')?.textContent
              .includes(`${expected} verified records`)""", arg=expected_records, timeout=30_000)
            require(not any('/discovery/public/records/' in item['url'] for item in requests),
                    'HTTP admission refetched moving record_url instead of verifying the '
                    'hash-bound envelope document')
            project_card = page.locator(
                '.mcard[data-mrec]', has_text='Open host topology'
            )
            project_card.wait_for(state='attached', timeout=15_000)
            page.locator('#missions').evaluate('(element) => { element.open = true; }')
            project_card.wait_for(state='visible', timeout=5_000)
            project_card.click()
            page.locator('#detailwrap.open .kind.k-project').wait_for(timeout=15_000)
            project_html = page.locator('#detailbody').inner_html()
            require('Hosted environments' in project_html and '2' in project_html,
                    'project/3 multi-environment topology was not rendered')
            require('PRIMARY' in project_html and 'Members (2)' in project_html,
                    'project/3 primary host or dict member projection was lost')
            page.locator('#detailclose').click()
            # The live run card intentionally coalesces with the most recent project
            # label. Retarget the already-wired signed-record card to exercise the
            # second verified project without reaching into module-scoped functions.
            project_card.evaluate("""(element) => {
              element.dataset.mrec = `${encodeURIComponent('kernel:fixture')}::${
                encodeURIComponent('provider-project-legacy')}`;
              element.click();
            }""")
            page.locator('#detailwrap.open .kind.k-project').wait_for(timeout=15_000)
            page.locator('#detail-title', has_text='Legacy singular topology').wait_for(
                timeout=15_000
            )
            legacy_project_html = page.locator('#detailbody').inner_html()
            require('Legacy singular project-host topology was refused'
                    in legacy_project_html,
                    'legacy singular project host unexpectedly regained authority')
            require('invalid / unavailable' in legacy_project_html,
                    'legacy project topology was presented as structurally valid')
            require('must-not-render-as-authority' not in legacy_project_html,
                    'legacy environment_id leaked into project topology rendering')
            page.locator('#detailclose').click()
            page.locator('#missions').evaluate('(element) => { element.open = false; }')
            signed_live_task = page.locator(
                '.mcard[data-mrec]', has_text='prepare the site approval package'
            )
            signed_live_task.wait_for(state='attached', timeout=15_000)
            signed_live_task_text = signed_live_task.text_content() or ''
            require('AWAITING PEER SYNTHESIS' in signed_live_task_text,
                    'signed public live task did not preserve its exact arbitrary state')
            require('PUBLISHED' not in signed_live_task_text,
                    'strict signed live task state did not override published evidence')
            require('signed live task' in signed_live_task_text,
                    'signed public live task lacks explicit signed-source context')
            published_task = page.locator(
                '.mcard[data-mrec]', has_text='design 4 bedroom house'
            )
            published_task.wait_for(state='attached', timeout=15_000)
            published_task_text = published_task.text_content() or ''
            require('COMPLETE' in published_task_text,
                    'signed terminal task capability did not override publication state')
            require('PUBLISHED' not in published_task_text,
                    'terminal task capability was reduced to generic publication state')
            require('run-canary-house' in published_task_text
                    and 'signed task record' in published_task_text,
                    'terminal task evidence lost its bounded signed run/record context')
            require('signed terminal task' in published_task_text,
                    'terminal task badge lost its signed-source context')
            page.wait_for_function(
                """() => document.querySelector('#p2p')?.textContent.startsWith('Network · ')""",
                timeout=15_000,
            )
            require('libp2p ' in (page.locator('#p2p').get_attribute('title') or ''),
                    'network transport detail was not preserved outside the visible footer copy')
            require('String multiaddr must start with' not in (page.locator('#log').text_content() or ''),
                    'HTTP federation URL escaped into the libp2p bootstrap list')
            page.wait_for_function("""() => document.querySelectorAll('#sysGraph .cl-direct').length === 5""",
                                   timeout=15_000)
            page.evaluate("""() => {
              const target=document.querySelector('#graphWindow');
              window.__topologyTruthStartedAt=Date.now();
              window.__topologyTruthSamples=[target?.textContent || ''];
              window.__topologyTruthObserver=new MutationObserver(() => {
                window.__topologyTruthSamples.push(target?.textContent || '');
              });
              if(target) window.__topologyTruthObserver.observe(target, {
                childList:true,subtree:true,characterData:true
              });
            }""")
            page.wait_for_function("""() => [...document.querySelectorAll('.pc-activity')]
              .some((node) => node.textContent.includes('observed communication route'))""", timeout=15_000)
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
            require(page.locator('footer').evaluate(
                '(element) => element.getBoundingClientRect().height') <= 36,
                    'desktop discovery status consumes a permanent content band')
            visible_status = page.locator('#status').inner_text()
            require(all(term not in visible_status for term in ('.well-known', 'Kademlia', 'mDNS', 're-polls')),
                    'transport implementation copy remains permanently visible in the footer')
            require(page.locator('.stage').evaluate(
                "(element) => getComputedStyle(element).overflowY") == 'visible',
                    'desktop content is still trapped inside a nested stage scrollbar')
            require(page.locator('body').evaluate(
                "(element) => getComputedStyle(element).overflowY") == 'auto',
                    'desktop page did not receive the primary content scrollbar')
            require(page.locator('.command-shell .globalbar').evaluate(
                "(element) => getComputedStyle(element).overflowX") == 'hidden',
                    'compact node navigator still exposes a horizontal scrollbar')
            page.locator('#headerToolsToggle').click()
            require(page.locator('.vgroup-tools').evaluate(
                '(element) => getComputedStyle(element).display') != 'none',
                    'command dock did not reveal search and network controls')
            require(page.locator('#appHeader').evaluate('(element) => element.offsetHeight') > compact_header_height,
                    'expanded command dock did not expose its control surface')
            page.locator('#headerToolsToggle').click()
            require(page.locator('#sysGraph .cl-direct').count() == 5,
                    'shared environment scope created an inferred persona chord')
            recipients_row = page.locator('.pcard[title="open Ivo Reed"]').locator(
                '.pc-activity-row', has_text='Mara Chen')
            require(recipients_row.count() >= 1,
                    'recipients-only persona endpoint was omitted from the live feed')
            require('observed communication route' in recipients_row.first.text_content(),
                    'signed broadcast route was overstated as message content')
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
            require(page.locator('.env-card .env-card-stats > span').count() >= 4,
                    'environment card omitted people, active, signal, or output facts')
            require(page.locator('.env-card .env-card-footer').count() >= 1,
                    'environment card omitted ownership context')
            require(page.locator('.env-card .pcard').count() == 0,
                    'persona cards remain nested inside environment cards')
            require(page.locator('.persona-deck > .pcard').count() == 5,
                    'persona-first deck did not render the live roster once')
            persona_cards = page.locator('.persona-deck > .pcard')
            page.wait_for_function(
                "() => document.querySelector('#st-personas .v')?.textContent === '5'",
                timeout=15_000,
            )
            require(page.locator(
                f'.pcard[data-pcard="{UNSIGNED_TELEMETRY_GHOST}"]'
            ).count() == 0,
                    'unsigned telemetry-only ghost created a persona card')
            require(page.locator(
                f'.pcard[data-pcard="{PERSONA_INCOMPLETE}"]'
            ).count() == 1 and page.locator(
                f'.pcard[data-pcard="{PERSONA_PENDING_SECOND}"]'
            ).count() == 1,
                    'verified simultaneous pending persona shells were not rendered')
            require(page.locator('#st-personas .v').text_content() == '5',
                    'unsigned telemetry-only ghost inflated the persona vital count')
            require(max(persona_cards.evaluate_all(
                '(cards) => cards.map((card) => card.getBoundingClientRect().width)')) <= 412,
                    'desktop persona card expanded beyond its collectible-card width')
            require(max(page.locator('.environment-grid > .env-card').evaluate_all(
                '(cards) => cards.map((card) => card.getBoundingClientRect().width)')) <= 502,
                    'desktop environment card expanded beyond its location-card width')
            require(all(count <= 2 for count in persona_cards.evaluate_all(
                "(cards) => cards.map((card) => [...card.querySelectorAll('.pc-message')].filter((row) => getComputedStyle(row).display !== 'none').length)")),
                    'persona card face exposes more than two activity rows by default')
            for signed_name in ('Orin Vale', 'Mara Chen', 'Ivo Reed'):
                require(page.locator('.pcard .pc-name', has_text=signed_name).count() == 1,
                        f'signed persona label was not rendered exactly once: {signed_name}')
            require(page.locator('.pcard .pc-name-proof', has_text='signed display name').count() == 3,
                    'persona cards did not make the signed display-name source prominent')
            require(page.locator('.pcard .pc-name-proof', has_text='signed lifecycle · name pending').count() == 2,
                    'pending identities were not labelled as lifecycle-verified materialization')
            require(page.locator('.pcard[data-identity-state="materializing"]').count() == 2,
                    'two simultaneous materializing identities collapsed into one persona')
            require(page.locator('.pcard .pc-message-stream').count() == 5,
                    'each persona card did not receive its own live message stream')
            require(page.locator('.pcard[title="open Orin Vale"] .pc-message[data-message-kind="MODEL_CALL"]').count() >= 1,
                    'current model request did not stream into the owning persona card')
            require('Unsigned ' not in ' '.join(persona_cards.all_text_contents()),
                    'unsigned telemetry alias overrode a signed persona label')
            empty_env = page.locator('.env-card', has_text='House Planning Commons')
            require(empty_env.count() == 1,
                    'verified environment without roster or artifacts was hidden')
            require('awaiting members' in empty_env.text_content(),
                    'empty environment card omitted its neutral membership state')
            require(empty_env.locator('.env-network.empty').count() == 1
                    and empty_env.locator('.env-persona-node').count() == 0,
                    'empty signed environment fabricated a social graph')
            same_title_envs = page.locator(
                '.env-card', has_text='Four Bedroom Design Studio'
            )
            require(same_title_envs.count() == 2,
                    'two signed environments with the same title were collapsed')
            observed_same_title_ids = set(same_title_envs.evaluate_all(
                '(cards) => cards.map((card) => card.dataset.envsid)'
            ))
            require(observed_same_title_ids == {
                ENV.removeprefix('env:'), ENV_SAME_TITLE.removeprefix('env:'),
            }, 'same-title environments lost their exact signed identities')
            routing_pressure = page.locator(
                '.routing-pressure', has_text='Unresolved multi-environment drawing'
            )
            require(routing_pressure.count() == 1,
                    'ambiguous artifact did not remain visible as routing pressure')
            require(page.locator(
                '.env-card', has_text='Unresolved multi-environment drawing'
            ).count() == 0,
                    'ambiguous artifact was attached to a guessed environment')
            active_env = same_title_envs.filter(
                has=page.locator('.env-persona-node')
            ).first
            require(active_env.locator('.env-network').count() == 1,
                    'active environment card omitted its compact social graph')
            require(active_env.locator('.env-persona-node').count() == 5,
                    'environment graph omitted verified-roster persona nodes')
            require(active_env.locator('.env-persona-node .pc-avatar').count() == 5,
                    'environment graph did not reuse verified raster avatar mounts')
            require(active_env.locator('.env-comm-edge').count() == 5,
                    'environment graph inferred an edge or omitted an exact actor-recipient channel')
            require(active_env.locator('.env-comm-feed li').count() >= 2,
                    'environment communication summaries did not stream inside the card')
            edge_titles = active_env.locator('.env-comm-edge title').all_text_contents()
            require(any('Orin Vale to Mara Chen' in title for title in edge_titles)
                    and any('Mara Chen to Ivo Reed' in title for title in edge_titles),
                    'environment graph lost exact signed persona names or observed direction')
            orin = page.locator('.pcard[title="open Orin Vale"]')
            require(orin.locator('.pc-env-chip').count() >= 1,
                    'persona card did not name its current environment')
            require(page.locator('.pcard .pc-avatar').count() == persona_cards.count(),
                    'not every actual persona received exactly one avatar')
            orin_avatar = orin.locator('.pc-avatar')
            page.wait_for_function("""() => [...document.querySelectorAll('.pcard')]
              .find((card) => card.textContent.includes('Orin Vale'))
              ?.querySelector('.pc-avatar')?.dataset.avatarState === 'ready'""", timeout=15_000)
            require(orin_avatar.get_attribute('data-avatar-state') == 'ready',
                    'persona-signed raster bytes did not pass the browser verifier')
            require(orin_avatar.locator('img').count() == 1,
                    'verified raster avatar was not rendered')
            require((orin_avatar.locator('img').get_attribute('src') or '').startswith('blob:'),
                    'avatar rendered a provider URL instead of a temporary blob URL')
            page.wait_for_function("""() => [...document.querySelectorAll('.env-persona-node')]
              .find((node) => node.textContent.includes('Orin Vale'))
              ?.querySelector('.pc-avatar')?.dataset.avatarState === 'ready'""", timeout=15_000)
            env_orin_avatar = active_env.locator('.env-persona-node', has_text='Orin Vale').locator('.pc-avatar')
            require(env_orin_avatar.locator('img[src^="blob:"]').count() == 1,
                    'environment graph bypassed verified raster avatar hydration')
            page.wait_for_function("""() => [...document.querySelectorAll('.persona-deck > .pcard')]
              .filter((card) => card.dataset.identityState === 'named')
              .every((card) => card.querySelector('.pc-avatar')?.dataset.avatarState === 'ready')""",
                                   timeout=15_000)
            require(page.locator(
                '.persona-deck > .pcard .pc-avatar[data-avatar-state="ready"] img[src^="blob:"]'
            ).count() == 3,
                    'every complete signed persona identity did not hydrate its raster avatar')
            require(page.locator(
                '.pcard[data-identity-state="materializing"] .pc-avatar[data-avatar-state="absent"]'
            ).count() == 2,
                    'pending persona portraits were not shown as honest materialization state')
            require(page.locator(
                '.pcard[data-identity-state="named"] .pc-avatar-placeholder').count() == 0,
                    'complete signed persona identities rendered portrait placeholders')
            require(page.locator(
                '.pcard[data-identity-state="materializing"] .pc-avatar-placeholder',
                has_text='portrait pending').count() == 2,
                    'pending avatar generation state was not visible on both persona cards')
            require(page.locator('.pcard .pc-avatar svg').count() == 0,
                    'persona avatar rendering retained generated SVG art')
            require(page.locator('.pcard [data-avatar-source]').count() == 0,
                    'persona avatar rendering retained a synthetic source marker')
            require(page.locator('.pcard .pc-avatar img[src^="http"]').count() == 0,
                    'persona avatar exposed a provider body URL to the DOM')
            require(all((text or '').startswith('role not declared ·')
                        for text in page.locator('.pcard .pc-idline').all_text_contents()),
                    'names, capabilities, or unsigned telemetry fabricated a persona role')
            require(page.locator(
                '.pcard.role-lead,.pcard.role-verifier,.pcard.role-integrator,'
                '.pcard.role-specialist,.pcard.role-member').count() == 0,
                    'legacy inferred coordination-role classes remain on persona cards')
            require('persona-authored characteristic' in page.locator('.cg-legend').inner_text(),
                    'constellation legend did not explain open persona-authored characteristics')
            require(not any(label in page.locator('.cg-legend').inner_text().lower()
                            for label in ('lead', 'verifier', 'integrator', 'specialist', 'member')),
                    'constellation legend reintroduced a host-defined role catalog')
            legacy_role_selectors = page.evaluate("""() => [...document.styleSheets].flatMap((sheet) => {
              try { return [...sheet.cssRules].map((rule) => rule.selectorText || ''); }
              catch (_) { return []; }
            }).filter((selector) => /role-(lead|verifier|integrator|specialist|member)/.test(selector))""")
            require(not legacy_role_selectors,
                    'stylesheet reintroduced host-defined persona-role selectors')
            initial_log_text = page.locator('#log').text_content()
            require('Signed provider authority accepted · public read granted' in initial_log_text,
                    'valid public-read policy was not evaluated truthfully')
            require(initial_log_text.count('discover-only; read links withheld') >= 3,
                    'discover-only, expired, or wrong-scope grants retained read links')
            require('Historical document accepted · public read granted' in initial_log_text,
                    'registered historical document signature was not accepted')
            advanced_inventory = context.request.get(
                base + '/node/advance-provider-inventory'
            ).json()
            require(advanced_inventory.get('inventory_generation') == 2,
                    'fixture did not advance the durable signed provider inventory')
            page.wait_for_function(
                """(expected) => document.querySelector('#status')?.textContent
                  .includes(`${expected} verified records`)""",
                arg=expected_records - 1,
                timeout=20_000,
            )
            require(page.locator('.persona-deck > .pcard').count() == 5
                    and page.locator('.pcard[data-identity-state="materializing"]').count() == 2,
                    'v3 omission reconciliation collapsed or regressed the five-persona roster')
            require(page.locator('.mcard', has_text='Signed provider authority accepted').count() == 0,
                    'record omitted by a newer complete inventory remained visible')
            page.wait_for_function(
                """() => Date.now() - (window.__topologyTruthStartedAt || Date.now()) >= 16_000""",
                timeout=18_000,
            )
            topology_samples = page.evaluate("""() => {
              window.__topologyTruthObserver?.disconnect();
              return window.__topologyTruthSamples || [];
            }""")
            require(not any(sample.strip() == '0 of 0 personas' for sample in topology_samples),
                    'non-authoritative locator refresh erased a focused persona topology: '
                    + repr(topology_samples))
            orin.click()
            page.locator('#detailwrap.open .kind.k-persona').wait_for(timeout=15_000)
            trust = page.locator('#detailbody .trust-details')
            trust.wait_for(state='attached', timeout=15_000)
            require(trust.get_attribute('open') is None,
                    'signature and access diagnostics are expanded by default')
            require('Published identity label' not in page.locator('#detailbody').inner_text(),
                    'raw published persona label remains in the primary inspector')
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
            require(page.locator('.pcard.dimmed').count() == 4,
                    'following one persona did not scope the other federated cards')
            followed.locator('.pc-follow').click()
            if screenshots:
                page.screenshot(path=str(screenshots / 'desktop-network-messages.png'), full_page=True)
                environment_capture_error = None
                for _ in range(3):
                    try:
                        page.locator('.environment-section').screenshot(
                            path=str(screenshots / 'desktop-environment-cards.png'))
                        environment_capture_error = None
                        break
                    except PlaywrightError as error:
                        environment_capture_error = error
                        page.wait_for_timeout(250)
                if environment_capture_error is not None:
                    raise environment_capture_error
            provider_refused = page.locator('#log li:has(.bad)').filter(has_text='provider:')
            require(provider_refused.count() == 0,
                    'atomic signed v3 inventory unexpectedly degraded into partial admission')
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
            require(failed_badge.text_content()
                    == 'SNAPSHOT SIGNATURE CHECKED · BYTES CHECK FAILED/REFUSED',
                    'failed body integrity check was not labelled as failed and refused')
            require('SHA-256 mismatch' in page.locator('#detailbody').inner_text(),
                    'initial body hash mismatch was not surfaced')
            if screenshots:
                page.screenshot(path=str(screenshots / 'desktop-live-body-refused.png'),
                                full_page=True)
            page.unroute('**/live-artifacts/body/**')
            page.locator('#detailback').click()
            page.evaluate("""() => {
              window.__fixtureRealFetch = window.fetch.bind(window);
              window.fetch = (input, init) => String(input).includes('/live-artifacts/body/')
                ? Promise.reject(new TypeError('fixture body unavailable'))
                : window.__fixtureRealFetch(input, init);
            }""")
            page.locator('[data-act="live-file"][data-path="design/plan.md"]').click()
            unavailable_badge = page.locator('.live-view-meta .transport-badge.failed')
            unavailable_badge.wait_for(timeout=10_000)
            require(unavailable_badge.text_content()
                    == 'SNAPSHOT SIGNATURE CHECKED · BYTES NOT CHECKED',
                    'unavailable bytes were mislabelled as a completed integrity check')
            page.evaluate("""() => {
              window.fetch = window.__fixtureRealFetch;
              delete window.__fixtureRealFetch;
            }""")
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
            avatar_requests = [item for item in requests
                               if '/assets/persona-avatars/sha256/' in item['url']]
            require(len(avatar_requests) == 3,
                    'each complete persona identity did not verify its raster body exactly once')
            require(all(not item['authorization'] for item in avatar_requests),
                    'public avatar fetch leaked the operator bearer token')
            require(all(not item['referer'] for item in avatar_requests),
                    'public avatar fetch leaked a referrer')

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

            # Extensionless and misleading filenames are dispatched only from
            # the bounded header of already hash-checked bytes.
            page.locator('#detailback').click()
            page.locator(
                '[data-act="live-file"][data-path="attachments/verified-portrait"]'
            ).click()
            sniffed_image = page.locator('#fv-body img')
            sniffed_image.wait_for(timeout=10_000)
            require(sniffed_image.evaluate('(img) => img.naturalWidth > 0'),
                    'extensionless hash-verified PNG did not render as an image')
            require('PNG image' in page.locator('#detailbody').inner_text()
                    and page.locator('.artifact-format-inferred').count() == 1,
                    'extensionless PNG was not labelled as verified-byte inference')

            page.locator('#detailback').click()
            page.locator(
                '[data-act="live-file"][data-path="documents/mislabeled-plan.png"]'
            ).click()
            contradiction = page.locator('.artifact-format-contradiction')
            contradiction.wait_for(timeout=10_000)
            require('detected PDF document format' in contradiction.inner_text(),
                    'mislabeled PDF did not expose its advertised/detected contradiction')
            page.locator('#fv-body .fv-pdf').wait_for(timeout=10_000)

            page.locator('#detailback').click()
            page.locator(
                '[data-act="live-file"][data-path="models/extensionless-step"]'
            ).click()
            page.locator('.artifact-format-inferred').wait_for(timeout=10_000)
            require('STEP CAD model' in page.locator('#detailbody').inner_text(),
                    'extensionless STEP bytes did not select the local CAD inspector')
            page.locator('#fv-body .fv-cardhd', has_text='STEP verified-byte inspection').wait_for(
                timeout=10_000
            )

            page.locator('#detailback').click()
            page.locator('[data-act="live-file"][data-path="design/plan.md"]').click()
            page.locator('.live-diff').wait_for(timeout=10_000)
            after_hash = page.locator('.exact-hash').last.text_content()
            require(before_hash != after_hash, 'open live file did not refresh to the next hash')
            origin_entity_requests = [item for item in requests
                                      if urlsplit(item['url']).netloc == urlsplit(base).netloc
                                      and urlsplit(item['url']).path
                                      == '/telemetry/live/entities.json']
            require(not origin_entity_requests,
                    'static portal origin was polled as an implicit live-telemetry node')
            origin_bootstrap_times = [item['at'] for item in requests
                                      if urlsplit(item['url']).netloc == urlsplit(base).netloc
                                      and urlsplit(item['url']).path
                                      == '/.well-known/personaos-discovery.json']
            bootstrap_gaps = [right - left for left, right in zip(
                origin_bootstrap_times, origin_bootstrap_times[1:]
            )]
            require(not bootstrap_gaps or min(bootstrap_gaps) >= 10,
                    'P2P initialization re-fetched the static portal origin after discovery')
            if screenshots:
                page.screenshot(path=str(screenshots / 'desktop-live-security.png'), full_page=True)
            unexpected_desktop_errors = [
                item for item in errors
                if "document is sandboxed and lacks the 'allow-same-origin' flag" not in item
            ]
            require(not unexpected_desktop_errors,
                    'desktop console errors: ' + '; '.join(unexpected_desktop_errors))
            context.close()

            # Public persona messages are intentionally fetchable without operator
            # authority. Private personas answer the same bounded probe with 404;
            # that refusal must remain quiet, while public output reaches both the
            # persona card's message feed and cognition drawer. A public response
            # can never make a thinking_frame render, even if it violates the node
            # contract and includes one as this fixture deliberately does.
            STATE.reset()
            anonymous_context = browser.new_context(viewport={'width': 1440, 'height': 900})
            anonymous_context.route(
                'https://node1.personas.ai/**', empty_default_locator
            )
            anonymous = anonymous_context.new_page()
            anonymous_console_errors: list[str] = []
            anonymous_page_errors: list[str] = []
            anonymous_thinking_requests: list[dict] = []
            anonymous_thinking_responses: list[dict] = []
            anonymous_failed_responses: list[dict] = []
            anonymous.on(
                'console',
                lambda msg: anonymous_console_errors.append(f'console {msg.type}: {msg.text}')
                if msg.type in {'warning', 'error'} else None,
            )
            anonymous.on('pageerror', lambda error: anonymous_page_errors.append(str(error)))
            anonymous.on('request', lambda request: anonymous_thinking_requests.append({
                'url': request.url,
                'authorization': request.headers.get('authorization', ''),
            }) if '/thinking' in request.url else None)
            anonymous.on('response', lambda response: anonymous_thinking_responses.append({
                'url': response.url,
                'status': response.status,
            }) if '/thinking' in response.url else None)
            anonymous.on('response', lambda response: anonymous_failed_responses.append({
                'url': response.url,
                'status': response.status,
            }) if response.status >= 400 else None)
            anonymous.goto(url, wait_until='domcontentloaded')
            public_card = anonymous.locator('.pcard[title="open Orin Vale"]')
            public_card.wait_for(state='visible', timeout=15_000)
            public_message = public_card.locator(
                '.pc-message[data-message-kind="PERSONA_COMMUNICATION_AUTHORED"]',
                has_text=PUBLIC_PERSONA_MESSAGE,
            )
            public_message.wait_for(timeout=15_000)
            require('broadcast message' in public_message.inner_text(),
                    'public persona message lost its authored-broadcast feed verb')
            private_deadline = time.time() + 10
            while time.time() < private_deadline:
                if any(
                    item['status'] == 404
                    and f'/personas/{PERSONA_PEER}/thinking' in item['url']
                    for item in anonymous_thinking_responses
                ):
                    break
                anonymous.wait_for_timeout(100)
            else:
                raise AssertionError('anonymous private-persona cognition probe did not receive 404')
            require(anonymous_thinking_requests,
                    'anonymous browser never attempted the public persona-message endpoint')
            require(all(not item['authorization'] for item in anonymous_thinking_requests),
                    'anonymous persona-message probe sent an Authorization header')
            require(any(
                f'/personas/{PERSONA}/thinking' in item['url']
                for item in anonymous_thinking_requests
            ), 'public persona-message endpoint was not probed')
            public_card.click()
            anonymous.locator(
                '#thinksec .llmout', has_text=PUBLIC_PERSONA_MESSAGE
            ).wait_for(timeout=10_000)
            require(anonymous.locator('#thinksec details.frame').count() == 0,
                    'anonymous persona drawer exposed a thinking_frame surface')
            require(PRIVATE_THINKING_FRAME_PROBE not in anonymous.locator('body').inner_text(),
                    'public thinking_frame bytes entered the rendered page')
            require('404' not in anonymous.locator('#thinksec').inner_text(),
                    'private cognition 404 leaked into the persona surface')
            require('404' not in anonymous.locator('#log').inner_text()
                    and 'not_found' not in anonymous.locator('body').inner_text(),
                    'private cognition refusal leaked into visible UI state')
            unexpected_console = [
                item for item in anonymous_console_errors
                if 'Failed to load resource' not in item or '404 (Not Found)' not in item
            ]
            unexpected_responses = [
                item for item in anonymous_failed_responses
                if item['status'] != 404 or '/thinking' not in item['url']
            ]
            require(not anonymous_page_errors and not unexpected_console
                    and not unexpected_responses,
                    'anonymous public-message application errors: '
                    + '; '.join(anonymous_page_errors + unexpected_console
                                + [str(item) for item in unexpected_responses]))
            anonymous_context.close()

            # A fresh aggregate whose nested public routes remain individually
            # valid must still be rejected when any outer signed byte changes.
            # Entity feeds and SSE are withheld so no alternate signed source
            # can accidentally satisfy this assertion.
            STATE.reset()
            forged_context = browser.new_context(viewport={'width': 1280, 'height': 800})
            forged_context.route('https://node1.personas.ai/**', empty_default_locator)
            forged_context.route('**/node/events', lambda route: route.fulfill(
                status=200, content_type='text/event-stream', body=''
            ))
            forged_context.route('**/node/telemetry/**', lambda route: route.fulfill(
                status=204, body=''
            ))
            forged_frame = telemetry()
            forged_frame['activity'] = [{
                'kind': 'FORGED_OUTER_ACTIVITY', 'actor_kind': 'persona',
                'actor_id': PERSONA, 'environment_id': 'env:fixture',
                'at': forged_frame['generated_at'],
            }]
            forged_context.route('**/node/telemetry.json', lambda route: route.fulfill(
                status=200, json=forged_frame
            ))
            forged = forged_context.new_page()
            forged.goto(url, wait_until='domcontentloaded')
            forged.locator('.persona-deck > .pcard').first.wait_for(timeout=20_000)
            forged.wait_for_function("""() => document.querySelector('#log')?.textContent
              .includes('refused invalid public telemetry signature')""", timeout=15_000)
            forged.wait_for_timeout(750)
            require('FORGED_OUTER_ACTIVITY' not in forged.locator('body').inner_text(),
                    'fresh telemetry with a forged outer signature entered the page')
            require(forged.locator('.env-comm-edge').count() == 0,
                    'individually signed nested routes bypassed their forged aggregate wrapper')
            forged_context.close()

            # The anonymous persona-message endpoint is whole-document signed,
            # current-inventory bound, exact-field closed, and subject bound.
            # Exercise all three rejection boundaries before admitting a valid
            # persona-authored broadcast on the next poll.
            STATE.reset()
            message_context = browser.new_context(viewport={'width': 1280, 'height': 800})
            message_context.route('https://node1.personas.ai/**', empty_default_locator)
            message_context.route('**/node/events', lambda route: route.fulfill(
                status=200, content_type='text/event-stream', body=''
            ))
            message_probe_count = {'value': 0}
            message_sentinels = [
                'TAMPERED_PUBLIC_MESSAGE',
                'WRONG_PERSONA_PUBLIC_MESSAGE',
                'ADDRESSED_PUBLIC_MESSAGE',
            ]
            valid_probe_message = 'VALID_PUBLIC_MESSAGE_AFTER_PROBES'

            def persona_message_probe(route) -> None:
                message_probe_count['value'] += 1
                probe = message_probe_count['value']
                if probe == 1:
                    document = public_persona_messages(text='signed text before mutation')
                    document['recent_outputs'][0]['text'] = message_sentinels[0]
                elif probe == 2:
                    document = public_persona_messages(
                        persona_id=PERSONA_PEER, name='Mara Chen',
                        author_persona_id=PERSONA_PEER, text=message_sentinels[1],
                    )
                elif probe == 3:
                    document = public_persona_messages(
                        text=message_sentinels[2],
                        output_extra={'recipient_persona_ids': [PERSONA_PEER]},
                    )
                else:
                    document = public_persona_messages(text=valid_probe_message)
                route.fulfill(status=200, json=document)

            message_context.route(
                f'**/personas/{PERSONA}/thinking', persona_message_probe
            )
            message_page = message_context.new_page()
            message_page.goto(url, wait_until='domcontentloaded')
            message_page.locator('.pcard[title="open Orin Vale"]').wait_for(timeout=20_000)
            for expected_count, sentinel in enumerate(message_sentinels, start=1):
                deadline = time.time() + 12
                while message_probe_count['value'] < expected_count and time.time() < deadline:
                    message_page.wait_for_timeout(100)
                require(message_probe_count['value'] >= expected_count,
                        f'persona-message rejection probe {expected_count} was not requested')
                message_page.wait_for_timeout(300)
                require(sentinel not in message_page.locator('body').inner_text(),
                        f'rejected public persona message entered the UI: {sentinel}')
            message_page.locator(
                '.pcard[title="open Orin Vale"] .pc-message', has_text=valid_probe_message
            ).wait_for(timeout=12_000)
            message_context.close()

            # A valid HTTP response with metadata changed after signing must not
            # enter the live state. The following untampered poll may then advance it.
            STATE.reset()
            tamper_context = browser.new_context(viewport={'width': 1440, 'height': 900})
            tamper_context.route('https://node1.personas.ai/**', empty_default_locator)
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
                    == 'WORKSPACE SNAPSHOT · SIGNATURE CHECKED',
                    'snapshot-signature trust label was lost after tamper recovery')
            if screenshots:
                tamper.screenshot(path=str(screenshots / 'desktop-live-signature-tamper.png'),
                                  full_page=True)
            require(not tamper_errors, 'tamper browser console errors: ' + '; '.join(tamper_errors))
            tamper_context.close()

            # Current master-key rotation must refresh the registry and must not
            # let the previous entry overwrite the current key with the same id.
            STATE.reset()
            rotation_context = browser.new_context(viewport={'width': 1440, 'height': 900})
            rotation_context.route('https://node1.personas.ai/**', empty_default_locator)
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

            # A standalone P2P ProviderRecord can prove a document but cannot
            # promote it without membership in the current complete v3 inventory.
            STATE.reset()
            p2p_context = browser.new_context(viewport={'width': 1280, 'height': 800})
            p2p_context.route('https://node1.personas.ai/**', empty_default_locator)
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
                status=204, body=''))
            p2p_page.route('**/assets/p2p-libp2p.js*', lambda route: route.fulfill(
                status=200, body=stub, content_type='application/javascript'))
            p2p_page.goto(url, wait_until='domcontentloaded')
            p2p_page.wait_for_function("""() => document.querySelector('#log')?.textContent
              .includes('libp2p gossip: provider lookup unresolved; nothing displayed')""",
                timeout=15_000)
            p2p_log = p2p_page.locator('#log').text_content()
            require('untrusted lookup hint only; awaiting current-master ProviderRecord' in p2p_log,
                    'raw gossip was not labelled as an untrusted lookup hint')
            require('P2P handle resolved by current' in p2p_log
                    and 'public read granted' in p2p_log,
                    'P2P provider/document verification did not run before inventory gating')
            require('P2P discover-only projection · discover-only; read links withheld' in p2p_log,
                    'zero-grant P2P document did not retain discover-only policy projection')
            require(p2p_page.locator('.mcard', has_text='P2P handle resolved by current').count() == 0,
                    'standalone P2P ProviderRecord bypassed complete-inventory membership')
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
            scale_context.route('https://node1.personas.ai/**', empty_default_locator)
            scale_context.request.get(base + '/node/scale?count=2000')
            scale = scale_context.new_page()
            scale_errors: list[str] = []
            scale_provider_bytes: dict[str, int] = {}
            scale_requests: list[str] = []
            scale.on('console', lambda msg: scale_errors.append(f'console {msg.type}: {msg.text}')
                     if msg.type in {'warning', 'error'} else None)
            scale.on('pageerror', lambda error: scale_errors.append(f'pageerror: {error}'))
            scale.on('request', lambda request: scale_requests.append(request.url))
            def capture_scale_provider_size(response) -> None:
                if response.url.endswith('/node/providers.json'):
                    raw = response.headers.get('content-length', '')
                    if raw.isdigit():
                        scale_provider_bytes['bytes'] = int(raw)
            scale.on('response', capture_scale_provider_size)
            scale.add_init_script(f"""
              sessionStorage.setItem('personaos_operator', JSON.stringify({{{json.dumps(node)}:'fixture-token'}}));
            """)
            scale.goto(url, wait_until='domcontentloaded')
            scale.locator('.pcard').first.wait_for(timeout=60_000)
            scale.wait_for_function("""() => document.querySelector('#graphWindow')?.textContent.includes('2K')""",
                                    timeout=15_000)
            require(scale.locator('.pcard').count() == 12,
                    'large stage did not retain its 12-card initial window')
            require(scale.locator(
                f'.pcard[data-pcard="{UNSIGNED_TELEMETRY_GHOST}"]'
            ).count() == 0,
                    'unsigned scale telemetry created a persona card')
            require(scale.locator('#st-personas .v').text_content() == '2K',
                    'unsigned scale telemetry inflated the verified persona count')
            measured_provider_bytes = scale_provider_bytes.get('bytes', 0)
            provider_byte_limit = 64 * 1024 + provider_record_count() * 4 * 1024
            require(measured_provider_bytes > 4 * 1024 * 1024,
                    'scale provider fixture did not exercise the provider-specific byte path')
            require(measured_provider_bytes < provider_byte_limit,
                    'scale provider fixture exceeded its bounded per-envelope byte budget')
            scale_graph_personas = scale.locator('#sysGraph [data-gp]').count()
            require(scale_graph_personas <= 36,
                    'large graph exceeded its exact-persona cap')
            require(scale.locator('[data-kernel-core]').count() <= 6,
                    'large graph exceeded its kernel cap')
            require(scale.locator('#log > li').count() <= 24,
                    'large signed provider population escaped the discovery-log ring')
            require(scale.locator('body *').count() < 1_500,
                    'large population materialized an unbounded DOM')
            if screenshots:
                scale.screenshot(path=str(screenshots / 'desktop-scale-window.png'), full_page=True)
            scale.locator('[data-more-personas]').click()
            scale.wait_for_function("""() => document.querySelectorAll('.pcard').length === 24""",
                                    timeout=10_000)
            scale.locator('#headerToolsToggle').click()
            scale.locator('#q').fill('scale-persona-01999')
            deep_signed_name = scale_persona_label(1999)
            deep_card = scale.locator('.pcard[data-pcard="scale-persona-01999"]')
            deep_card.wait_for(state='visible', timeout=10_000)
            deep_card_text = deep_card.text_content()
            require(deep_signed_name in deep_card_text
                    and 'signed display name' in deep_card_text,
                    'deep search lost its signed persona identity')
            require(not any('/v1/nodes?' in request
                            and 'q=scale-persona-01999' in request
                            for request in scale_requests),
                    'loaded deep search redundantly queried the global resolver')
            scale.wait_for_function("""() => document.querySelector(
              '.pcard[data-pcard="scale-persona-01999"] .pc-avatar'
            )?.dataset.avatarState === 'ready'""", timeout=15_000)
            require(scale.locator('.pcard').count() <= 24,
                    'search escaped the progressive persona window')
            scale_metrics = {
                'source_personas': 2000,
                'initial_cards': 12,
                'expanded_cards': 24,
                'graph_personas': scale_graph_personas,
                'provider_index_bytes': measured_provider_bytes,
                'provider_index_limit': provider_byte_limit,
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
            mobile_context.route('https://node1.personas.ai/**', empty_default_locator)
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
                  rail:componentHeight('.workspace-rail'),footer:componentHeight('footer'),
                  stageTop:document.querySelector('.stage-wrap')?.getBoundingClientRect().top ?? 999
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
            require(metrics['components']['footer'] <= 100,
                    'mobile discovery diagnostics consume excessive vertical space')
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
            sse_context.route('https://node1.personas.ai/**', empty_default_locator)
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
                status=204, body=''))
            sse.goto(url, wait_until='domcontentloaded')
            sse.wait_for_function("""(expected) => document.querySelector('#log')?.textContent
              .includes(`discovery snapshot: ${expected} current ProviderRecord(s) verified; 0 refused`)""",
                arg=provider_record_count(), timeout=15_000)
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
                    'signature-checked terminal event retained an active model call')
            terminal_text = sse.locator('#detailbody').text_content().lower()
            require('model call active' not in terminal_text,
                    'signature-checked final workspace retained model-call-active state')
            require('independent plan review is still open' not in terminal_text,
                    'signature-checked terminal event retained a stale completion block')
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
                    == 'SNAPSHOT SIGNATURE CHECKED · BYTES CHECKED',
                    'final workspace file bytes did not pass the separate integrity check')
            require(sse.locator('#fv-body').text_content().strip(),
                    'hash-checked final workspace renderer is blank')
            if screenshots:
                sse.screenshot(path=str(screenshots / 'desktop-sse-final-file.png'), full_page=True)
            unexpected_sse_errors = [
                item for item in sse_errors
                if 'Failed to load resource' not in item or '404 (Not Found)' not in item
            ]
            unexpected_sse_responses = [
                item for item in sse_failed_responses
                if not item.startswith('404 ') or '/thinking' not in item
            ]
            require(not unexpected_sse_errors and not unexpected_sse_responses,
                    'SSE application errors: ' + '; '.join(
                        unexpected_sse_errors + unexpected_sse_responses
                    ))
            sse_context.close()

            # Historical MODEL_SELECTED rows are not current work. With no active
            # run/call and a latest terminal MODEL_CALL_FAILED, the mission,
            # persona card, and inspector must all expose the failure truthfully.
            STATE.reset()
            STATE.fail_model()
            failure_context = browser.new_context(viewport={'width': 1440, 'height': 900})
            failure_context.route('https://node1.personas.ai/**', empty_default_locator)
            failure_context.route('**/node/events', lambda route: route.fulfill(
                status=200, content_type='text/event-stream', body=''
            ))
            failure = failure_context.new_page()
            failure_errors: list[str] = []
            failure.on('console', lambda msg: failure_errors.append(
                f'console {msg.type}: {msg.text}'
            ) if msg.type in {'warning', 'error'} else None)
            failure.on('pageerror', lambda error: failure_errors.append(f'pageerror: {error}'))
            failure.goto(url, wait_until='domcontentloaded')
            failure.wait_for_function("""(expected) => document.querySelector('#status')?.textContent
              .includes(`${expected} verified records`)""",
                                      arg=provider_record_count(), timeout=30_000)
            failed_persona = failure.locator('.pcard[title="open Orin Vale"]')
            failed_persona.locator('.pc-failed').wait_for(timeout=15_000)
            require(failed_persona.locator('.pc-run').count() == 0,
                    'terminal model failure retained a running persona badge')
            require('Model call failed' in failed_persona.locator('.pc-current').inner_text(),
                    'persona card hid the terminal model-call failure')
            require(failure.locator('#st-active .v').text_content() == '0',
                    'terminal model failure inflated the running counter')
            failure.wait_for_function("""() => [...document.querySelectorAll('.mcard')]
              .some((card) => card.textContent.includes('design 4 bedroom house')
                && card.textContent.includes('FAILED'))""", timeout=15_000)
            failed_mission = failure.locator(
                '.mcard[data-mrec]:has(.ms-failed)', has_text='design 4 bedroom house'
            ).first
            failed_mission.wait_for(state='attached', timeout=15_000)
            failed_mission_text = failed_mission.text_content() or ''
            require('unsigned live telemetry · model call failed' in failed_mission_text,
                    'mission failure omitted its unsigned live-telemetry source: '
                    + repr(failed_mission_text))
            require(failure.locator('#missionEyebrow').text_content()
                    == 'EXECUTION NEEDS ATTENTION',
                    'idle failed mission retained the NOW WORKING ON headline')
            failed_persona.click()
            failure.locator('#detailwrap.open .kind.k-persona').wait_for(timeout=15_000)
            failure.locator('#livesec .model-failure').wait_for(timeout=15_000)
            live_text = failure.locator('#livesec').inner_text()
            live_text_lower = live_text.lower()
            require('terminal execution status' in live_text_lower
                    and 'model call failed' in live_text_lower,
                    'persona inspector did not surface terminal failure diagnostics')
            require('model returned malformed structured output' not in live_text_lower,
                    'public failure projection exposed the operator-tier model reason')
            require('model selection history' in live_text_lower
                    and 'doing now' not in live_text_lower,
                    'historical model selection was still labelled as current work')
            unexpected_failure_errors = [
                item for item in failure_errors
                if 'Failed to load resource' not in item or '404 (Not Found)' not in item
            ]
            require(not unexpected_failure_errors,
                    'terminal-state application errors: ' + '; '.join(unexpected_failure_errors))
            failure_context.close()
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
                'p2p_standalone_inventory_gated': True,
                'sse_legacy_provider_refused': True,
                'key_rotation_refreshed': True,
                'body_requests': len(body_requests),
                'event_requests': len(event_requests),
                'anonymous_public_messages': True,
                'anonymous_thinking_requests': len(anonymous_thinking_requests),
                'private_thinking_404_quiet': True,
                'public_thinking_frame_refused': True,
                'public_aggregate_outer_forgery_refused': True,
                'public_message_tamper_subject_and_addressing_refused': True,
                'hash_changed': before_hash != after_hash,
                'image_rerendered': True,
                'generic_binary_inspected': True,
                'verified_byte_format_dispatch': ['png', 'pdf', 'step'],
                'stale_poll_refused': True,
                'run_ended_stopped_polling': True,
                'run_ended_cleared_runtime': True,
                'run_ended_file_verified': True,
                'terminal_model_failure_truthful': True,
                'scale': scale_metrics,
                'mobile': {**metrics, 'drawer': drawer, 'file_drawer': file_drawer},
                'console_errors': (unexpected_desktop_errors + tamper_errors + rotation_errors + p2p_errors
                                   + mobile_errors + unexpected_sse_errors),
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
