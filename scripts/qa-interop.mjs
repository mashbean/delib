// Isolated local browser; only synthetic files. Never target production for file tests.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {readFile,mkdir} from 'node:fs/promises';
import {interopDemo} from '../public/interop-demo.js';
const base=process.argv[2]||'http://127.0.0.1:8797';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local QA only');
const mod=process.env.DELIB_PLAYWRIGHT_MODULE||'playwright';const {chromium}=await import(mod.startsWith('/')?pathToFileURL(mod).href:mod);
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method()+' '+r.url());});
const fixture=await interopDemo('en'),file=(name,text)=>({name,mimeType:'application/json',buffer:Buffer.from(text)});
try{
 await page.goto(`${base}/workspace.html?lang=en`);await page.locator('#project-file').setInputFiles(file('private-backup.json',JSON.stringify(fixture.project)));await page.locator('#choose-project').waitFor();
 await page.goto(`${base}/interop.html?lang=en`);await page.locator('#native-file').setInputFiles(file('statements.json',fixture.nativeText));await page.locator('#companion-file').setInputFiles(file('private-companion.json',fixture.companionText));await page.locator('#inspect-files button[type=submit], #inspect-files button.btn').click();await page.locator('.inspection-summary').waitFor();assert.match(await page.locator('#interop-status').innerText(),/Files match/);
 await page.locator('#load-local').click();await page.locator('#compare-project').selectOption({index:1});await page.getByText('This is an issue copy:',{exact:false}).waitFor();assert.match(await page.locator('.comparison-counts').innerText(),/Newer local revision/);
 await page.locator('[data-record]').filter({hasText:'Keep accessible drop-off'}).click();assert.match(await page.locator('#inspection-detail').innerText(),/Survey accessible routes first/);assert.match(await page.locator('#inspection-detail').innerText(),/Source outside this batch/);
 const wait=page.waitForEvent('download');await page.locator('#download-report').click();const downloaded=await wait;const report=JSON.parse(await readFile(await downloaded.path(),'utf8'));assert.equal(report.localComparison.projectCopy,true);assert.equal(report.externalAcceptance,false);assert.deepEqual(report.localComparison.counts,{same:1,older:1});assert.ok(!JSON.stringify(report).includes(fixture.project.title));
 // Replacing a file clears the old success view before a failed check.
 await page.locator('#native-file').setInputFiles(file('changed.json',fixture.nativeText+' '));assert.equal(await page.locator('.inspection-summary').count(),0);await page.locator('#inspect-files button.btn').click();await page.getByText('Check failed.',{exact:false}).waitFor();assert.equal(await page.locator('#download-report').count(),0);
 await page.locator('#inspect-demo').click();await page.locator('.inspection-summary').waitFor();await page.locator('#interop-language').click();await page.getByText('目前比對模擬的後續版本',{exact:false}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.locator('[data-theme-toggle]').click();await page.locator('.inspection-summary').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mkdir('.wrangler/qa-interop',{recursive:true});await page.screenshot({path:'.wrangler/qa-interop/mobile.png'});
 await page.locator('#clear-files').click();assert.equal(await page.locator('.inspection-summary').count(),0);assert.match(await page.locator('#interop-status').innerText(),/已清除/);
 await page.reload();assert.equal(await page.locator('.inspection-summary').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS: real file inputs, restored-copy comparison, revision/source inspection, downloaded report, mismatched-file invalidation, bilingual mobile dark mode, clear/reload, no writes or page errors');
}finally{await browser.close();}
