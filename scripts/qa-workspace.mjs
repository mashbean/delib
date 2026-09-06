// Local browser acceptance. Upstream actions use explicit fixtures; no public activities are created.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const moduleName=process.env.DELIB_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(moduleName.startsWith('/')?pathToFileURL(moduleName).href:moduleName);
const browser=await chromium.launch({headless:true,channel:'chrome'});
const base=process.argv[2]||'http://localhost:8790';
const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
let tttcInput,replyInput;const ids={form:'formtestaa',tttc:'tttctestaa',reply:'replytesta'};
await page.route('**/api/integrations/pocket-*',async route=>{
 const tool=route.request().url().split('pocket-')[1],body=route.request().postDataJSON();assert.equal(body.confirmed,true);
 if(tool==='tttc')tttcInput=body;if(tool==='reply')replyInput=body;
 const origin=tool==='form'?'https://form.mashbean.net':tool==='tttc'?'https://ttt-city.mashbean.net':'https://reply.mashbean.net';
 await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({[tool==='form'?'formId':tool==='tttc'?'reportId':'loopId']:ids[tool],status:'queued',manageUrl:`${origin}/${tool==='form'?'h':'r'}/${ids[tool]}#admin=${'a'.repeat(32)}`})});
});
await page.route('**/api/workspace/read',async route=>{
 const body=route.request().postDataJSON();let result;
 if(body.tool==='form'){assert.equal(body.token,'a'.repeat(32));result={csv:'id,interview,comment\ns1,,Keep an accessible drop-off bay\ns2,,Leave delivery access open'};}
 else {const source=(body.tool==='tttc'?tttcInput:replyInput).csv.split('\n')[1].split(',')[0].replaceAll('"','');result={result:body.tool==='tttc'?{progress:{status:'ready'},tree:{topics:[{name:'Access',subtopics:[{name:'Drop-off',claims:[{id:'c1',text:'Keep the accessible bay',quotes:[{commentId:source,text:'Keep an accessible drop-off bay'}]}]}]}]}}:{progress:{status:'ready'},receipt:{questions:[{qid:'q1',sourceId:source}],loopbacks:[{qid:'q1',reply:'Draft: test the accessible bay with caregivers.'}]}}};}
 await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
});
try{
 await page.goto(`${base}/?lang=en`);await page.locator('#role-entries a').first().waitFor();assert.equal(await page.locator('#role-entries a').count(),3);
 await page.locator('#story [data-choice="0"]').click();assert.match(await page.locator('#story .story-outcome').innerText(),/Round two/);assert.equal(await page.locator('#demo-rounds [data-round="1"]').getAttribute('aria-pressed'),'true');
 await page.screenshot({path:'/private/tmp/delib-third-home.png',fullPage:false});
 await page.goto(`${base}/workspace?lang=en`);await page.locator('#new-project').waitFor();
 await page.locator('[name=title]').fill('Fictional acceptance: School street');await page.locator('[name=audience]').fill('Caregivers and residents');await page.locator('[name=goal]').fill('How can we preserve accessible drop-off?');await page.locator('[name=deadline]').fill('2026-12-01');await page.locator('#new-project button').click();
 await page.locator('#create-form [name=purpose]').fill('Fictional test. Use responses to plan a pilot. Retain until review. Contact the test facilitator.');await page.locator('#create-form button').click();
 await page.locator('#confirm-send [name=consent]').check();await page.locator('#confirm-send button').click();await page.locator('[data-action=read-form]').click();await page.locator('.work-record').first().waitFor();assert.equal(await page.locator('.work-record').count(),2);
 await page.locator('[data-step="1"]').click();await page.locator('[data-action=create-tttc]').click();await page.locator('#confirm-send [name=consent]').check();await page.locator('#confirm-send button').click();await page.locator('[data-action=read-tttc]').click();
 await page.locator('.work-record').first().click();await page.locator('.record-detail details summary').click();await page.locator('#review-record [name=reviewer]').fill('Fictional facilitator');await page.locator('#review-record button').click();
 await page.locator('[data-step="2"]').click();await page.locator('#create-reply [name=speaker]').fill('Fictional facilitator');await page.locator('#create-reply button').click();assert.match(await page.locator('.send-data').innerText(),/Keep the accessible bay/);await page.locator('#confirm-send [name=consent]').check();await page.locator('#confirm-send button').click();await page.locator('[data-action=read-reply]').click();await page.locator('.work-record').first().waitFor();
 await page.locator('[data-tab=voices]').click();await page.locator('.work-record').first().click();await page.locator('.voice-trail article').nth(2).waitFor();assert.equal(await page.locator('.voice-trail article').count(),3);
 await page.screenshot({path:'/private/tmp/delib-third-workspace.png',fullPage:false});
 await page.reload();await page.locator('.project-heading h2').waitFor();assert.match(await page.locator('.project-heading h2').innerText(),/Fictional acceptance/);assert.equal(await page.locator('[data-tab=voices]').getAttribute('aria-selected'),'true');
 await page.locator('[data-tab=route]').click();await page.locator('[data-step="3"]').click();await page.locator('#next-round [name=reason]').fill('Include caregivers in testing');await page.locator('#next-round [name=owner]').fill('Fictional access team');await page.locator('#next-round button').click();await page.waitForFunction(()=>document.querySelectorAll('#choose-round option').length===2);assert.equal(await page.locator('#choose-round option').count(),2);
 await page.locator('[data-tab=changes]').click();assert.match(await page.locator('.compare-panel').innerText(),/Round 1/);
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=export]').click();const download=await downloadPromise;await download.saveAs('/private/tmp/delib-third-test-backup.json');
 const data=JSON.parse(await(await import('node:fs/promises')).readFile('/private/tmp/delib-third-test-backup.json','utf8'));assert.equal(data.rounds.length,2);assert(!JSON.stringify(data).includes('a'.repeat(32)));
 await page.setViewportSize({width:390,height:844});await page.locator('[data-tab=route]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/private/tmp/delib-third-mobile.png',fullPage:false});
 await page.goto(`${base}/?lang=zh#demo`);await page.locator('#mobile-step-summary').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('#pipeline').isVisible(),false);await page.locator('#full-pipeline').click();assert.equal(await page.locator('#pipeline').isVisible(),true);assert.equal(await page.locator('#full-catalog article').count(),38);
 assert.deepEqual(errors,[]);console.log('PASS: bilingual entry/story, complete fixture-backed Form → TTTC → Reply loop, provenance, review, local resume, next round, private backup, mobile layout and 38-tool inventory. No real upstream activities created.');
}catch(error){console.error('Browser errors:',errors,'Notice:',await page.locator('#work-notice').textContent().catch(()=>''));await page.screenshot({path:'/private/tmp/delib-third-failure.png',fullPage:true});throw error;}finally{await browser.close();}
