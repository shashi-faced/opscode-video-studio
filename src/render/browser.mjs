// Launch headless Chrome on a compiled build and expose seek/screenshot helpers.
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from '../deps/locate.mjs';

export class UserError extends Error {
  constructor(message, fix) { super(message); this.fix = fix; }
}

export async function openBuild(htmlFile, stage) {
  const executablePath = findChrome();
  if (!executablePath) throw new UserError('Chrome or Chromium was not found.', 'run video_doctor with install=true (or: opscode-video doctor --install)');
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-gpu', '--font-render-hinting=none', '--allow-file-access-from-files'],
  });
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
    async close() { await browser.close(); },
  };
}
