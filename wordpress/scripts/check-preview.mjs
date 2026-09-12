// Compare the static reference and a real, local WordPress installation in Chrome.
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = '/tmp/bk-wordpress-preview/check';
await mkdir(output, {recursive:true});
const tab = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', {method:'PUT'})).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open',resolve,{once:true}));
let seq=0;
const pending=new Map(), runtimeErrors=[], failedResponses=[];
ws.onmessage=event=>{
  const message=JSON.parse(event.data);
  if(message.id){
    const pair=pending.get(message.id); pending.delete(message.id);
    message.error?pair.reject(message.error):pair.resolve(message.result);
  }
  if(message.method==='Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails);
  if(message.method==='Network.responseReceived' && message.params.response.status>=400)
    failedResponses.push({url:message.params.response.url,status:message.params.response.status});
};
const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq; pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params}));
});
const evaluate=async expression=>{
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setCacheDisabled',{cacheDisabled:true});
// External payment and media providers are never contacted during this test.
// Keep the dated static snapshot for the pixel comparison. The automatic
// project updates are covered separately by check-bus-project.mjs.
await send('Network.setBlockedURLs',{urls:['*raisenow.io/*','*youtube*','*google*','*paypal*','*betterplace.org/*','*s.w.org/*','*/bus-project.js*']});
await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__opened=[];
  window.open=(...args)=>{window.__opened.push(args);return null;};
  try{localStorage.removeItem('bk-consent-v1');}catch(e){}
`});

async function navigate(url,width){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  const navigation=await send('Page.navigate',{url});
  assert.equal(navigation.errorText,undefined,`Navigation failed: ${url}`);
  let ready=false;
  for(let i=0;i<100;i++){
    if(await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === "complete" && !!document.querySelector("main")`)){ready=true;break;}
    await delay(100);
  }
  assert.ok(ready,`Page did not load: ${url}`);
  await evaluate(`(async()=>{
    await document.fonts.ready;
    document.querySelectorAll('img').forEach(image=>image.loading='eager');
    await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));
    const style=document.createElement('style');
    style.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}';
    document.head.append(style);
    for(let y=0;y<document.documentElement.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,45));}
    window.scrollTo(0,0);
    await new Promise(r=>setTimeout(r,180));
  })()`);
  for(let i=0;i<50;i++){
    if(await evaluate(`(()=>{const p=document.querySelector('.appeal .pct');return !p||p.textContent.trim()===p.dataset.target+' %';})()`))break;
    await delay(100);
  }
  await delay(100);
}

async function snapshot(label){
  const data=await evaluate(`(()=>{
    const elements=[...document.querySelectorAll('header,main,section,article,footer,h1,h2,h3,main img,.wrap')];
    return {
      title:document.title,
      text:document.body.innerText,
      width:document.documentElement.clientWidth,
      height:document.documentElement.scrollHeight,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth,
      brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),
      layout:elements.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id,class:e.className,x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontFamily,fontSize:s.fontSize,color:s.color,background:s.backgroundColor,display:s.display};}),
      links:[...document.querySelectorAll('a[href]')].map(a=>({href:a.href,target:a.target,rel:a.rel})),
      assets:[...document.querySelectorAll('img[src],link[rel="stylesheet"]')].map(e=>e.src||e.href)
    };
  })()`);
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:data.width,height:data.height,scale:1}});
  await writeFile(`${output}/${label}.png`,Buffer.from(screenshot.data,'base64'));
  return data;
}

async function interactions(page,width){
  return evaluate(`(()=>{
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    const result={};
    const banner=document.querySelector('#consent-banner');
    check(banner&&!banner.hidden,'Consent banner missing');
    banner.querySelector('[data-consent="necessary"]').click();
    check(banner.hidden,'Consent banner does not close');
    check(JSON.parse(localStorage.getItem('bk-consent-v1')).externalMedia===false,'Necessary consent not saved');
    document.querySelector('.consent-settings').click();
    check(!banner.hidden,'Consent settings do not reopen');
    banner.querySelector('[data-consent="necessary"]').click();
    result.consent=true;
    const toggle=document.querySelector('.nav-toggle');
    if(toggle&&getComputedStyle(toggle).display!=='none'){
      toggle.click();check(toggle.getAttribute('aria-expanded')==='true','Mobile menu does not open');
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      check(toggle.getAttribute('aria-expanded')==='false','Escape does not close mobile menu');
      result.mobileMenu=true;
    }
    const drawer=document.querySelector('#donation-drawer');
    if(drawer){
      const donation=drawer.querySelector('.donation-tab'),current=drawer.querySelector('.current-tab'),form=drawer.querySelector('form');
      current.click();check(!drawer.querySelector('#current-panel').hidden&&form.hidden,'Current panel does not open');
      donation.click();check(!form.hidden&&drawer.querySelector('#current-panel').hidden,'Donation panel does not return');
      for(const test of [{amount:'25',rhythm:'once',purpose:'allgemein'},{amount:'100',rhythm:'monthly',purpose:'girls-can-play'}]){
        form.querySelector('[name="amount"][value="'+test.amount+'"]').checked=true;
        form.querySelector('[name="rhythm"][value="'+test.rhythm+'"]').checked=true;
        form.querySelector('[name="purpose"]').value=test.purpose;
        form.requestSubmit();
        const opened=window.__opened.at(-1);check(!!opened,'Donation does not open a tab');
        const url=new URL(opened[0]);
        check(url.hostname==='donate.raisenow.io'&&opened[1]==='_blank'&&opened[2]==='noopener,noreferrer','Wrong donation target');
        check(url.searchParams.get('amount.default')===test.amount&&url.searchParams.get('reference.campaign_id')===test.purpose&&url.searchParams.get('reference.campaign_subid')===test.rhythm,'Donation parameters changed');
      }
      result.donation=true;result.currentPanel=true;
    }
    for(const a of document.querySelectorAll('a[href*="raisenow.io"]'))check(a.target==='_blank'&&a.rel.includes('noopener'),'RaiseNow link does not open safely in new tab');
    for(const a of document.querySelectorAll('a[href^="#"]')){
      if(a.hash)check(!!document.getElementById(decodeURIComponent(a.hash.slice(1))),'Broken anchor '+a.hash);
    }
    if(${JSON.stringify(page)}==='index'){
      check(document.querySelectorAll('iframe').length===0,'Video loaded without consent');
      document.querySelector('.enable-media').click();
      const iframe=document.querySelector('[data-youtube] iframe');
      check(iframe&&iframe.src==='https://www.youtube-nocookie.com/embed/3G_RkkzUbNY?rel=0','Video consent did not create the correct embed');
      check(JSON.parse(localStorage.getItem('bk-consent-v1')).externalMedia===true,'Media consent not saved');
      result.videoConsent=true;
    }
    return result;
  })()`);
}

const pages=['index','projekte','mitgliedschaft','sponsoren','impressum','datenschutz'];
const results=[];
try{
  for(const width of [1440,1024,768,390,320]) for(const page of pages){
    const reference=`http://localhost:8765/${page==='index'?'':page+'.html'}`;
    const wordpress=`http://localhost:8766/${page==='index'?'':page+'/'}`;
    await navigate(reference,width);const original=await snapshot(`${page}-${width}-html`);
    const originalFunctions=await interactions(page,width);
    await navigate(wordpress,width);const converted=await snapshot(`${page}-${width}-wordpress`);
    const wordpressFunctions=await interactions(page,width);
    await writeFile(`${output}/${page}-${width}-measurements.json`,JSON.stringify({original,converted},null,2));
    const differences=converted.layout.flatMap((item,i)=>JSON.stringify(item)===JSON.stringify(original.layout[i])?[]:[{original:original.layout[i],converted:item}]);
    assert.equal(differences.length,0,`Layout differs: ${page} ${width}: ${JSON.stringify(differences.slice(0,3))}`);
    assert.ok(converted.text===original.text,`Text differs: ${page} ${width}; see measurements file`);
    assert.equal(converted.title,original.title);
    assert.equal(converted.overflow,original.overflow,`New horizontal overflow: ${page} ${width}`);
    assert.deepEqual(converted.brokenImages,[]);
    assert.deepEqual(wordpressFunctions,originalFunctions);
    const entry={page,width,height:converted.height,layoutIdentical:true,existingOverflow:original.overflow,scrollWidth:converted.scrollWidth,functions:wordpressFunctions,links:converted.links,assets:converted.assets};
    results.push(entry);
    console.log(JSON.stringify({page,width,layoutIdentical:true,functions:wordpressFunctions}));
  }
  assert.deepEqual(runtimeErrors,[],'Browser JavaScript errors');
  assert.deepEqual(failedResponses,[],'Failed HTTP responses');
  await writeFile(`${output}/results.json`,JSON.stringify({results,runtimeErrors,failedResponses},null,2));
  console.log(`PASS: ${results.length} page/viewport comparisons. Screenshots: ${output}`);
}finally{ws.close();}
