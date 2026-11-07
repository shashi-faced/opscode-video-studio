import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import {chromium} from '/home/moglix/Office/opscode-video-studio/node_modules/playwright-core/index.mjs';
const ROOT=path.dirname(new URL(import.meta.url).pathname);
const types={'.html':'text/html','.js':'text/javascript'};
const srv=http.createServer((q,s)=>{const p=path.join(ROOT,decodeURIComponent(new URL(q.url,'http://x').pathname));fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);return s.end();}s.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});s.end(d);});}).listen(0);
const port=srv.address().port;
const exe=process.env.HOME+'/.cache/puppeteer/chrome-headless-shell/linux-131.0.6778.204/chrome-headless-shell-linux64/chrome-headless-shell';
const backends={gpu:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--disable-vulkan-surface','--enable-gpu-rasterization'],
 swiftshader:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};
const variants=JSON.parse(process.argv[2]); const only=process.argv[3]?process.argv[3].split(','):Object.keys(backends);
const med=a=>{a=[...a].sort((x,y)=>x-y);return +a[Math.floor(a.length/2)].toFixed(1);};
for(const be of only){
 const browser=await chromium.launch({executablePath:exe,args:backends[be]});
 for(const v of variants){
  const ctx=await browser.newContext({viewport:{width:v.w,height:v.h},deviceScaleFactor:1});const page=await ctx.newPage();
  const qs=new URLSearchParams(v).toString();await page.goto(`http://127.0.0.1:${port}/index.html?${qs}`);await page.waitForFunction('window.__ready===true');
  const cdp=await ctx.newCDPSession(page);const info=await page.evaluate('__info()');
  const fin=[],sub=[],cap=[],capFast=[],tot=[];const NF=be==='gpu'?40:15;
  for(let i=0;i<NF+5;i++){const t0=performance.now();const r=await page.evaluate(`__seek(${i*1000/30})`);
   const t1=performance.now();await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:90});const t2=performance.now();
   await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:90,optimizeForSpeed:true});const t3=performance.now();
   if(i>=5){fin.push(r.finish);sub.push(r.submit);cap.push(t2-t1);capFast.push(t3-t2);tot.push(t2-t0);}}
  const dURL=[];for(let i=0;i<5;i++)dURL.push((await page.evaluate('__toDataURL()')).ms);
  const rp=[];for(let i=0;i<5;i++)rp.push(await page.evaluate('__readFull()'));
  console.log(JSON.stringify({be,...v,renderer:info.slice(0,60),render_finish_ms:med(fin),submit_ms:med(sub),captureScreenshot_jpeg_ms:med(cap),capture_optimizeForSpeed_ms:med(capFast),seek_plus_capture_ms:med(tot),toDataURL_jpeg_ms:med(dURL),readPixels_full_ms:med(rp)}));
  await ctx.close();}
 await browser.close();}
srv.close();
