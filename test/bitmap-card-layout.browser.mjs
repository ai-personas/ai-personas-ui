// Browser-only layout regression, separate from identity/signature admission.
// UI_BROWSER_MODULE may name an installed playwright-core module, and
// UI_BROWSER_EXECUTABLE may name its Chromium executable. No network is used.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = process.env.UI_LAYOUT_ROOT || fileURLToPath(new URL('../', import.meta.url));
const assets = process.env.UI_PRESENTATION_ASSETS || path.join(root, 'assets');
const {renderer} = await import(pathToFileURL(path.join(root, 'test/helpers/discovery-presentation.mjs')));
const {chromium} = await import(process.env.UI_BROWSER_MODULE || 'playwright');
const css = await fs.readFile(path.join(assets, 'discovery.css'), 'utf8');
const browser = await chromium.launch({headless:true,
  ...(process.env.UI_BROWSER_EXECUTABLE ? {executablePath:process.env.UI_BROWSER_EXECUTABLE} : {}),
  args:['--no-sandbox']});
const report = {completed:false, scope:'Offline card CSS and renderer; generated test bitmaps claim no persona authorship.',
  observations:[], errors:[], failures:[]};
try {
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/*', route => route.abort());
  for (const viewport of [{width:1440,height:1000}, {width:390,height:844}]) {
    await page.setViewportSize(viewport);
    let cardHeight;
    for (const [width,height] of [[256,256],[160,320],[320,160]]) {
      const url = await page.evaluate(({width,height}) => {
        const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
        const ctx=canvas.getContext('2d'); ctx.fillStyle='#263f47'; ctx.fillRect(0,0,width,height);
        for (const [x,y,color] of [[0,0,'#f00'],[width-8,0,'#0f0'],[0,height-8,'#00f'],[width-8,height-8,'#ff0']]) {
          ctx.fillStyle=color; ctx.fillRect(x,y,8,8);
        }
        return canvas.toDataURL('image/png');
      }, {width,height});
      const img=`<img src="${url}" alt="Generated layout-test bitmap">`;
      const ui=renderer(null,{_personaAvatarHTML:()=>`<span class="pc-avatar" data-avatar-state="ready">${img}</span>`});
      await page.setContent(`<style>${css}</style><main style="width:min(450px,calc(100vw - 40px));margin:20px">`
        +ui.card('alice','node',{})
        +`<article class="env-card pk"><figure class="pk-art env environment-image">${img}</figure></article></main>`);
      await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
      const state=await page.evaluate(()=>{
        const box=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
        return {card:box(document.querySelector('.pcard')), overflow:document.documentElement.scrollWidth>innerWidth,
          images:[...document.querySelectorAll('img')].map(image=>({
            frame:box(image.closest('.pk-art')), image:box(image), fit:getComputedStyle(image).objectFit,
            naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight}))};
      });
      if (cardHeight===undefined) cardHeight=state.card.height;
      const label=`${viewport.width}px / ${width}×${height}`;
      if (state.overflow || Math.abs(cardHeight-state.card.height)>0.1) report.failures.push(label+': overview size changed');
      for (const image of state.images) {
        if (image.naturalWidth!==width || image.naturalHeight!==height) report.failures.push(label+': fixture did not decode');
        if (image.fit!=='contain' || image.image.height<1 || image.image.width<1
            || image.image.height>image.frame.height+0.1 || image.image.width>image.frame.width+0.1
            || Math.abs(image.frame.height-80)>0.1) report.failures.push(label+': bitmap is cropped or frame expanded');
      }
      report.observations.push({viewport,bitmap:{width,height},...state});
    }
  }
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.failures,[]);
  report.completed=true;
} finally {
  await browser.close();
  if (process.env.UI_LAYOUT_REPORT) await fs.writeFile(process.env.UI_LAYOUT_REPORT,
    JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
}
console.log(JSON.stringify({completed:report.completed,cases:report.observations.length,
  image_checks:report.observations.reduce((count,row)=>count+row.images.length,0)}));
