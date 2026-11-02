// Screenshot a URL (website or local dev server) into a PNG, with optional crop.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { findChrome } from '../deps/locate.mjs';
import { UserError } from './browser.mjs';

export async function capture({ url, out, width = 1440, height = 900, crop, waitMs = 1500 }) {
  const executablePath = findChrome();
  if (!executablePath) throw new UserError('Chrome was not found.', 'run video_doctor with install=true');
  if (!/^(https?|file):\/\//.test(url)) url = /^[\w.-]+(:\d+)?(\/|$)/.test(url) ? `http://${url}` : url;
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(e => { throw new UserError(`could not open ${url}: ${e.message.split('\n')[0]}`, 'check the URL and that the dev server is running'); });
    await page.waitForTimeout(Number(waitMs));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    let clip;
    if (crop) {
      const [x, y, w, h] = String(crop).split(/[ ,x]+/).map(Number);
      if ([x, y, w, h].some(n => !Number.isFinite(n))) throw new UserError('crop must be "x,y,w,h" in pixels', 'e.g. 920,40,520,520');
      clip = { x, y, width: w, height: h };
    }
    await page.screenshot({ path: out, clip, type: 'png' });
    return { out, width: clip ? clip.width : Number(width), height: clip ? clip.height : Number(height) };
  } finally {
    await browser.close();
  }
}
