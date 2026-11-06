// Launch headless Chrome on a compiled build and expose seek/screenshot helpers.
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from '../deps/locate.mjs';

export class UserError extends Error {
  constructor(message, fix) { super(message); this.fix = fix; }
}

const BASE_ARGS = ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none', '--allow-file-access-from-files'];
// Drawing frames on the graphics card (Vulkan) instead of the CPU: about 35% faster film renders
// on an Intel laptop, because the CPU is then free for encoding.
const GPU_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=vulkan', '--enable-features=Vulkan'];
const extraArgs = () => String(process.env.OPSCODE_VIDEO_CHROME_ARGS || '').split(' ').filter(Boolean);

/** gpu: true uses the graphics card when Chrome can; false (default) draws on the CPU as before. */
export async function launchBrowser({ gpu = false } = {}) {
  const executablePath = findChrome();
  if (!executablePath) throw new UserError('Chrome or Chromium was not found.', 'run video_doctor with install=true (or: opscode-video doctor --install)');
  return chromium.launch({
    executablePath,
    headless: true,
    args: [...BASE_ARGS, ...(gpu ? GPU_ARGS : ['--disable-gpu']), ...extraArgs()],
  });
}

let gpuProbe = null;
/**
 * True when headless Chrome draws on a real graphics card here (checked once per process).
 * OPSCODE_VIDEO_GPU=0 turns it off, =1 forces it on.
 */
export function gpuWorks() {
  if (process.env.OPSCODE_VIDEO_GPU === '0') return Promise.resolve(false);
  if (process.env.OPSCODE_VIDEO_GPU === '1') return Promise.resolve(true);
  if (!gpuProbe) {
    gpuProbe = (async () => {
      let b;
      try {
        b = await launchBrowser({ gpu: true });
        const p = await b.newPage();
        const r = await p.evaluate(() => {
          const gl = document.createElement('canvas').getContext('webgl');
          const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
          return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : '';
        });
        return !!r && !/swiftshader|llvmpipe|software/i.test(r);
      } catch { return false; }
      finally { await b?.close().catch(() => {}); }
    })();
  }
  return gpuProbe;
}

/** shared: an already running browser (film workers reuse one per worker); close() then only closes the page. */
export async function openBuild(htmlFile, stage, { shared } = {}) {
  const browser = shared || await launchBrowser();
  const page = await browser.newPage({ viewport: { width: stage.width, height: stage.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(htmlFile).href + '?render=1');
  await page.waitForFunction(() => window.__video && window.__video.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__video.ready);
  if (errors.length) throw new UserError(`The video page failed to load: ${errors[0]}`, 'this is an engine bug; report it with the storyboard');
  const cdp = await page.context().newCDPSession(page);

  return {
    page,
    errors,
    async seek(ms) { await page.evaluate(t => window.__video.seek(t), ms); },
    async frame(format = 'jpeg', quality = 92) {
      const { data } = await cdp.send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? quality : undefined, captureBeyondViewport: false, optimizeForSpeed: true });
      return Buffer.from(data, 'base64');
    },
    async inspect() { return page.evaluate(() => window.__video.inspect()); },
    async close() { if (shared) await page.close(); else await browser.close(); },
  };
}
