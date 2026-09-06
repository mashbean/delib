// Appearance acceptance is read-only; embedded upstream tools are replaced with a placeholder.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
const moduleName=process.env.DELIB_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(moduleName.startsWith('/')?pathToFileURL(moduleName).href:moduleName);
const browser=await chromium.launch({headless:true,channel:'chrome'});
const base=process.argv[2]||'http://localhost:8790';
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light',reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://polis.mashbean.net/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Embedded tool placeholder</title><p>Read-only shell appearance check</p>'}));
const theme=()=>page.locator('html').getAttribute('data-theme');
const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflows horizontally');
try {
  await page.goto(`${base}/?lang=zh`);await page.locator('#pipeline svg').waitFor();
  assert.equal(await theme(),'light');
  assert.equal(await page.locator('#demo h2').first().innerText(),'模擬案例');
  assert.match(await page.locator('.demo-case-title').innerText(),/校門口/);
  const sizes=await page.evaluate(()=>['#demo h2','.demo-case-title'].map(s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize)));
  assert(sizes[0]>sizes[1]);
  for(const area of ['#step-detail','#demo-step']){
    assert.equal(await page.locator(`${area} .handoff-input`).count(),1);
    assert.equal(await page.locator(`${area} .handoff-output`).count(),1);
  }
  assert.equal(await page.locator('#pipeline svg>rect').getAttribute('fill'),'#ffffff');
  await page.screenshot({path:'/private/tmp/delib-four-light-home.png'});
  await page.locator('#step-detail').screenshot({path:'/private/tmp/delib-four-light-handoff.png'});
  await page.locator('#demo').screenshot({path:'/private/tmp/delib-four-light-demo.png'});
  await page.locator('[data-theme-toggle]').click();assert.equal(await theme(),'dark');
  assert.equal(await page.locator('#pipeline svg>rect').getAttribute('fill'),'#0b1119');
  await page.reload();assert.equal(await theme(),'dark');
  await page.locator('#language').click();assert.equal(await page.locator('[data-theme-toggle]').getAttribute('aria-label'),'Switch to light mode');
  await page.locator('#pipeline-view [data-view=people]').click();
  assert(!(await page.locator('#pipeline').innerHTML()).includes('undefined'));
  await page.locator('[data-theme-toggle]').click();assert.equal(await theme(),'light');
  assert.equal(await page.locator('#pipeline .person-name').first().getAttribute('fill'),'#1c2c30');
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-graphic').click();
  await (await downloadPromise).saveAs('/private/tmp/delib-four-people.svg');
  const svg=await readFile('/private/tmp/delib-four-people.svg','utf8');assert(svg.includes('xmlns=')&&svg.includes('#1c2c30')&&!svg.includes('undefined'));
  // A selected source survives an appearance change.
  await page.locator('#pipeline-view [data-view=data]').click();await page.locator('[data-artifact]').first().click();
  const selected=await page.locator('.pipe-node.selected').getAttribute('data-artifact');
  await page.locator('[data-theme-toggle]').click();assert.equal(await page.locator('.pipe-node.selected').getAttribute('data-artifact'),selected);
  await page.locator('#demo').screenshot({path:'/private/tmp/delib-four-dark-demo.png'});
  await page.locator('#step-detail').screenshot({path:'/private/tmp/delib-four-dark-handoff.png'});
  // Keyboard switching and persistence across the shared working surfaces.
  for(const path of ['/workspace?lang=en','/voice?lang=en','/handoff?lang=en','/polis?lang=en']) {
    await page.goto(base+path);await page.locator('[data-theme-toggle]').waitFor();
    assert.equal(await theme(),'dark');await noOverflow();
    await page.locator('[data-theme-toggle]').focus();await page.keyboard.press('Enter');assert.equal(await theme(),'light');
    await page.reload();assert.equal(await theme(),'light');
    await page.setViewportSize({width:390,height:844});await noOverflow();
    await page.screenshot({path:`/private/tmp/delib-four-${path.split('?')[0].slice(1)}.png`});
    await page.locator('[data-theme-toggle]').click();assert.equal(await theme(),'dark');
    await page.setViewportSize({width:1440,height:1000});
  }
  await page.goto(`${base}/?lang=zh#demo`);await page.locator('#pipeline svg').waitFor();
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:844});await noOverflow();
    await page.locator('[data-theme-toggle]').click();await noOverflow();
    const boxes=await page.locator('#step-detail .handoff-port').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
    assert(boxes[1].top>boxes[0].bottom,'mobile output follows input vertically');
  }
  await page.setViewportSize({width:390,height:844});
  if(await theme()==='dark')await page.locator('[data-theme-toggle]').click();
  await page.locator('#demo').screenshot({path:'/private/tmp/delib-four-mobile-demo.png'});
  // System changes affect only an unset preference; explicit choices remain stable.
  await page.evaluate(()=>localStorage.removeItem('delib:theme'));await page.reload();assert.equal(await theme(),'light');
  await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.locator('[data-theme-toggle]').click();await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});assert.equal(await theme(),'light');
  // Storage restrictions do not prevent the theme control from working.
  const restricted=await context.newPage();await restricted.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value(){throw new Error('Storage unavailable');}});Object.defineProperty(Storage.prototype,'setItem',{value(){throw new Error('Storage unavailable');}});});
  await restricted.goto(`${base}/voice?lang=en`);await restricted.locator('[data-theme-toggle]').click();assert.equal(await restricted.locator('html').getAttribute('data-theme'),'dark');await restricted.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: heading hierarchy; IN → OUT desktop/mobile; light/dark system default, persistent choice, keyboard, language and storage fallback; themed data/people SVG export; 5 shared surfaces; 320/390 px home layout. No upstream activities created.');
} catch(error) { console.error('Page errors:',errors,'Demo:',await page.locator('#demo-error').textContent().catch(()=>''));throw error;} finally {await browser.close();}
