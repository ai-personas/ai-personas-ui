"""Browser checks for the authored design fixture, not the Preact app or Rust runtime.

Install Python Playwright and its Chromium, or pass --chromium /path/to/chromium.
The harness injects the exact checked-in HTML/CSS/JS into an empty document. It
therefore tests rendering and interactions, NOT HTTP serving or file-origin policy.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
PARSER = argparse.ArgumentParser()
PARSER.add_argument('--chromium')
PARSER.add_argument('--screenshots', type=Path)
ARGS, REST = PARSER.parse_known_args()


def document() -> str:
    base = ROOT / 'design'
    html = (base / 'index.html').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>' + (base / 'styles.css').read_text(encoding='utf-8') + '</style>')
    for name in ('state.js', 'app.js', 'navigation.js'):
        html = html.replace(f'<script src="{name}" defer></script>', '')
    scripts = ''.join('<script>' + (base / name).read_text(encoding='utf-8') + '</script>' for name in ('state.js', 'app.js', 'navigation.js'))
    return html.replace('</body>', scripts + '</body>')


class DesignBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        kwargs = {'headless': True}
        if ARGS.chromium:
            kwargs['executable_path'] = ARGS.chromium
        cls.browser = cls.pw.chromium.launch(**kwargs)
        cls.version = cls.browser.version
        cls.html = document()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1045}, device_scale_factor=1)
        self.page = self.context.new_page()
        self.page.set_default_timeout(5000)
        self.errors, self.requests = [], []
        self.page.on('pageerror', lambda err: self.errors.append(str(err)))
        self.page.on('request', lambda req: self.requests.append(req.url))
        self.page.set_content(self.html)

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [], 'Unexpected browser exceptions')
            self.assertEqual(self.requests, [], 'The inline fixture must not issue network requests')
        finally:
            self.context.close()

    def route(self, path: str, title: str):
        self.page.evaluate('(path) => { location.hash = path; }', '/' + path)
        expect(self.page.locator('h1')).to_have_text(title)

    def shot(self, name: str):
        if ARGS.screenshots:
            ARGS.screenshots.mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=str(ARGS.screenshots / name), full_page=True)

    def test_01_reference_layouts_and_no_page_overflow(self):
        routes = [('work', 'Work'), ('personas', 'Personas'), ('work/home', 'Four-bedroom home'), ('workspace/house/3', 'Breeze House'), ('environments', 'Environments'), ('learning', 'Learning'), ('settings', 'Settings'), ('tools', 'Tools')]
        for width in (266, 320, 390, 700, 768, 1024, 1440):
            self.page.set_viewport_size({'width': width, 'height': 1100 if width < 701 else 1045})
            for path, title in routes:
                with self.subTest(width=width, route=path):
                    self.route(path, title)
                    self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
                    if width in (390, 1440) and path in ('work', 'personas', 'work/home', 'workspace/house/3'):
                        self.shot(path.replace('/', '-') + f'-{width}.png')

    def test_02_filters_search_and_caret(self):
        self.page.get_by_role('button', name='Needs you 1').click()
        expect(self.page.locator('.work-row')).to_have_count(1)
        self.page.get_by_role('button', name='All work 2').click()
        search = self.page.get_by_role('searchbox', name='Search work...')
        search.fill('Willow')
        expect(self.page.locator('.work-row')).to_have_count(1)
        search.press('Home')
        search.press_sequentially('x')
        expect(search).to_have_value('xWillow')
        self.assertEqual(search.evaluate('(el) => el.selectionStart'), 1)
        expect(self.page.get_by_text('No matching work', exact=True)).to_be_visible()
        search.fill('')
        expect(self.page.locator('.work-row')).to_have_count(2)

    def test_03_dialog_keyboard_escape_and_focus_return(self):
        self.page.set_viewport_size({'width': 390, 'height': 1100})
        answer = self.page.get_by_role('button', name='Answer request')
        answer.click()
        expect(self.page.get_by_label('Your answer', exact=True)).to_be_focused()
        self.shot('request-390.png')
        for _ in range(16):
            self.page.keyboard.press('Tab')
            self.assertTrue(self.page.evaluate('document.querySelector("dialog").contains(document.activeElement)'))
        self.page.keyboard.press('Escape')
        expect(self.page.locator('dialog')).not_to_be_visible()
        expect(self.page.locator('dialog')).to_be_empty()
        expect(answer).to_be_focused()
        self.assertFalse(self.page.evaluate('document.body.classList.contains("modal-open")'))

    def test_04_answer_is_recorded_not_resolved_and_plain_text_is_safe(self):
        self.page.get_by_role('button', name='Answer request').click()
        text = 'Not known yet. <img src=x onerror="window.fixtureXss=true">'
        self.page.get_by_label('Your answer', exact=True).fill(text)
        self.page.get_by_role('button', name='Record response').click()
        expect(self.page.locator('.request-banner')).to_have_count(0)
        self.route('work/home', 'Four-bedroom home')
        expect(self.page.get_by_text('Answered · assessment pending', exact=True)).to_be_visible()
        expect(self.page.locator('.answer-copy')).to_have_text(text)
        expect(self.page.locator('#main img')).to_have_count(0)
        self.assertIsNone(self.page.evaluate('window.fixtureXss'))
        expect(self.page.get_by_text('The request is not resolved.', exact=False)).to_be_visible()
        expect(self.page.locator('.status-strip')).to_contain_text('Not assessed')

    def test_05_new_work_stays_unowned_and_does_not_invent_a_persona_author(self):
        self.page.get_by_role('button', name='New work', exact=True).click()
        self.page.get_by_label('Title', exact=True).fill('A' * 80)
        self.page.get_by_label('Your need', exact=True).fill('Preserve my original need.')
        self.page.get_by_role('button', name='Record draft').click()
        expect(self.page.locator('.work-row')).to_have_count(3)
        row = self.page.locator('.work-row').last
        expect(row).to_contain_text('Awaiting acceptance')
        expect(row).to_contain_text('0 personas')
        self.page.set_viewport_size({'width': 320, 'height': 700})
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 320)
        row.get_by_role('link', name='A' * 80, exact=True).click()
        expect(self.page.locator('.author-line')).to_contain_text('You · Local draft')

    def test_06_persona_creation_is_unauthored_and_in_memory_only(self):
        self.route('personas', 'Personas')
        self.page.get_by_role('button', name='New persona').click()
        self.page.get_by_label('Name', exact=True).fill('Local Draft')
        self.page.get_by_role('button', name='Create local draft').click()
        card = self.page.locator('.persona-card').last
        expect(card).to_contain_text('Unauthored')
        expect(card).to_contain_text('0 retained note')
        self.page.evaluate('location.hash = "/work"')
        self.page.set_content(self.html)
        self.route('personas', 'Personas')
        expect(self.page.locator('.persona-card')).to_have_count(3)

    def test_07_pause_does_not_change_assessment(self):
        self.route('work/home', 'Four-bedroom home')
        self.page.get_by_role('button', name='Pause decisions').click()
        expect(self.page.locator('.status-strip')).to_contain_text('Paused')
        expect(self.page.locator('.status-strip')).to_contain_text('Not assessed')
        self.page.get_by_role('button', name='Resume preview').click()
        expect(self.page.locator('.status-strip')).to_contain_text('Needs you')
        expect(self.page.get_by_role('button', name='Answer request')).to_be_visible()

    def test_08_six_tabs_and_keyboard_navigation(self):
        self.route('work/home', 'Four-bedroom home')
        expect(self.page.get_by_role('tab')).to_have_count(6)
        self.page.get_by_role('tab', name='Overview', exact=True).focus()
        self.page.keyboard.press('ArrowRight')
        expect(self.page.get_by_role('tab', name='Perspectives', exact=True)).to_be_focused()
        expect(self.page.get_by_role('tab', name='Perspectives', exact=True)).to_have_attribute('aria-selected', 'true')
        self.page.keyboard.press('End')
        expect(self.page.get_by_role('tab', name='Decisions & learning', exact=True)).to_be_focused()
        self.page.get_by_role('tab', name='Artifacts & evidence', exact=True).click()
        expect(self.page.get_by_role('tabpanel')).to_contain_text('No native files')

    def test_09_replay_preserves_staleness_and_no_birth_restraint(self):
        self.route('workspace/house/3', 'Breeze House')
        expect(self.page.get_by_text('47 / 120 calls', exact=True)).to_be_visible()
        expect(self.page.get_by_text('Stale', exact=True)).to_be_visible()
        self.page.get_by_role('link', name='2 · New evidence').click()
        expect(self.page.get_by_text('31 / 120 calls', exact=True)).to_be_visible()
        self.page.get_by_role('tab', name='People & births').click()
        expect(self.page.get_by_role('tabpanel')).to_contain_text('Membership and commitment acceptance are pending')
        self.page.get_by_label('Need', exact=True).select_option('dataset')
        expect(self.page.locator('h1')).to_have_text('Clearer Records')
        self.page.get_by_role('link', name='3 · Team response').click()
        expect(self.page.get_by_text('1 continuing persona', exact=True)).to_be_visible()
        self.page.get_by_label('Need', exact=True).select_option('story')
        expect(self.page.locator('h1')).to_have_text('The Orchard Letter')

    def test_10_scoped_approval_preview_cannot_grant_authority(self):
        self.route('work/home', 'Four-bedroom home')
        self.page.get_by_role('button', name='Preview a scoped approval').click()
        expect(self.page.get_by_role('dialog')).to_contain_text('Not granted')
        expect(self.page.get_by_role('dialog').get_by_role('button', name='Approve', exact=True)).to_have_count(0)
        self.page.get_by_role('button', name='Close preview', exact=True).click()
        expect(self.page.get_by_role('button', name='Preview a scoped approval')).to_be_focused()

    def test_11_short_viewport_and_repeated_dialog_cleanup(self):
        self.page.set_viewport_size({'width': 266, 'height': 568})
        for _ in range(5):
            self.page.get_by_role('button', name='Answer request').click()
            self.assertLessEqual(self.page.locator('dialog').bounding_box()['height'], 532)
            self.page.get_by_role('button', name='Cancel', exact=True).click()
            expect(self.page.locator('dialog')).not_to_be_visible()
            expect(self.page.locator('dialog')).to_be_empty()
            self.assertFalse(self.page.evaluate('document.body.classList.contains("modal-open")'))

    def test_12_unknown_route_and_reset_are_explicit(self):
        self.route('missing', 'Page not found')
        self.route('settings', 'Settings')
        self.page.get_by_role('button', name='Reset local changes').click()
        expect(self.page.get_by_role('dialog')).to_contain_text('no effect on a node, account or repository')
        self.page.get_by_role('button', name='Reset preview', exact=True).click()
        self.route('work', 'Work')
        expect(self.page.locator('.work-row')).to_have_count(2)

    def test_13_skip_link_preserves_the_current_route(self):
        for route, title in [('work', 'Work'), ('personas', 'Personas'), ('workspace/house/3', 'Breeze House')]:
            self.route(route, title)
            previous = self.page.url
            self.page.locator('.skip-link').focus()
            self.page.keyboard.press('Enter')
            self.assertEqual(self.page.url, previous)
            expect(self.page.locator('#main')).to_be_focused()
            expect(self.page.locator('h1')).to_have_text(title)


if __name__ == '__main__':
    runner = unittest.main(argv=['browser_design.py', *REST], exit=False, verbosity=2)
    result = runner.result
    report = {'status': 'passed' if result.wasSuccessful() else 'failed', 'tests': result.testsRun,
              'failures': len(result.failures), 'errors': len(result.errors), 'chromium': getattr(DesignBrowser, 'version', None),
              'widths_checked': [266, 320, 390, 700, 768, 1024, 1440],
              'method': 'Exact fixture HTML/CSS/JS injected into an empty document; no navigation/network transport tested.',
              'scope': 'Authored design fixture only. Not Preact integration, Rust mechanics, live personas, engineering validation or proof of leak freedom.'}
    (ROOT / '.qa').mkdir(exist_ok=True)
    (ROOT / '.qa/design-browser-checks.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    raise SystemExit(0 if result.wasSuccessful() else 1)
