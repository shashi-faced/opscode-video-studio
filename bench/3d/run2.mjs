import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import {chromium} from '/home/moglix/Office/opscode-video-studio/node_modules/playwright-core/index.mjs';
const ROOT=path.dirname(new URL(import.meta.url).pathname);
const srv=http.createServer((q,s)=>{const p=path.join(ROOT,decodeURIComponent(new URL(q.url,'http://x').pathname));fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);return s.end();}s.writeHead(200,{'content-type':p.endsWith('.html')?'text/html':'text/javascript'});s.end(d);});}).listen(0);
const port=srv.address().port;
const exe=process.env.HOME+'/.cache/puppeteer/chrome-headless-shell/linux-131.0.6778.204/chrome-headless-shell-linux64/chrome-headless-shell';
const backends={gpu:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--disable-vulkan-surface','--enable-gpu-rasterization'],swiftshader:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};
const qs='w=1920&h=1080&shadow=2048&aa=1&outline=hull';
async function worker(browser,method,NF){const ctx=await browser.newContext({viewport:{width:1920,height:1080}});const page=await ctx.newPage();
 await page.goto(`http://127.0.0.1:${port}/index.html?${qs}`);await page.waitForFunction('window.__ready===true');const cdp=await ctx.newCDPSession(page);
 let bytes=0;
 const one=async i=>{await page.evaluate(`__seek(${i*33.3})`);
  if(method==='cdp'){const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:90,optimizeForSpeed:true});bytes+=Buffer.from(r.data,'base64').length;}
  else {const s=await page.evaluate(`document.querySelector('canvas').toDataURL('image/jpeg',0.9)`);bytes+=Buffer.from(s.slice(23),'base64').length;}};
 for(let i=0;i<3;i++)await one(i);
 const t0=performance.now();for(let i=0;i<NF;i++)await one(i+3);const dt=performance.now()-t0;await ctx.close();return {dt,bytes};}
const be=process.argv[2];const NF=be==='gpu'?60:20;
for(const sep of [false,true]) for(const method of ['cdp','toDataURL']) for(const N of [1,2,4]){
 if(sep&&N===1)continue;
 const browsers=[];for(let i=0;i<(sep?N:1);i++)browsers.push(await chromium.launch({executablePath:exe,args:backends[be]}));
 const t0=performance.now();const res=await Promise.all([...Array(N)].map((_,i)=>worker(browsers[sep?i:0],method,NF)));const wall=performance.now()-t0;
 const per=res.map(r=>r.dt/NF);
 console.log(be,method,'workers='+N,sep?'separate-browsers':'one-browser','| per-worker ms/frame',per.map(x=>x.toFixed(0)).join(','),'| aggregate fps',(N*NF/(Math.max(...res.map(r=>r.dt))/1000)).toFixed(1),'| avg jpeg KB',(res[0].bytes/NF/1024).toFixed(0));
 for(const b of browsers)await b.close();}
srv.close();
