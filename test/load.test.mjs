import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderBudget, powerState, withThreadCap, threadArgs } from '../src/render/load.mjs';

const ac = { onBattery: false, percent: 100, health: 0.9 };

test('gentle default: one worker with 2 encoder threads on an 8-thread laptop, two on 16 threads', () => {
  const b = renderBudget({ wanted: 6, env: {}, power: ac, ncpu: 8 });
  assert.equal(b.workers, 1);
  assert.equal(b.threads, 2);
  assert.deepEqual(renderBudget({ wanted: 6, env: {}, power: ac, ncpu: 16 }), { workers: 2, threads: 2, mode: 'gentle', notes: [] });
  assert.deepEqual(b.notes, []);
});

test('a request for more workers is capped and explained', () => {
  const b = renderBudget({ requested: 6, wanted: 4, env: {}, power: ac, ncpu: 16 });
  assert.equal(b.workers, 2);
  assert.match(b.notes.join(' '), /asked for 6 workers, used 2/);
});

test('on battery: one worker, two threads', () => {
  const b = renderBudget({ wanted: 4, env: {}, power: { onBattery: true, percent: 50, health: 0.9 }, ncpu: 8 });
  assert.equal(b.workers, 1);
  assert.equal(b.threads, 2);
  assert.match(b.notes.join(' '), /battery/);
});

test('a worn battery is reported', () => {
  const b = renderBudget({ wanted: 1, env: {}, power: { onBattery: false, percent: 100, health: 0.27 }, ncpu: 8 });
  assert.match(b.notes.join(' '), /27%/);
});

test('small machines keep one worker', () => {
  assert.equal(renderBudget({ wanted: 4, env: {}, power: ac, ncpu: 4 }).workers, 1);
  assert.equal(renderBudget({ wanted: 4, env: {}, power: ac, ncpu: 4 }).threads, 2);
});

test('OPSCODE_VIDEO_LOAD=full keeps the old unlimited behaviour', () => {
  const b = renderBudget({ requested: 6, wanted: 4, env: { OPSCODE_VIDEO_LOAD: 'full' }, power: { onBattery: true }, ncpu: 8 });
  assert.equal(b.workers, 6);
  assert.equal(b.threads, 0);
  assert.deepEqual(threadArgs(b.threads), []);
});

test('OPSCODE_VIDEO_LOAD=low uses one worker', () => {
  const b = renderBudget({ wanted: 4, env: { OPSCODE_VIDEO_LOAD: 'low' }, power: ac, ncpu: 16 });
  assert.equal(b.workers, 1);
  assert.equal(b.threads, 2);
});

test('withThreadCap puts -threads before the output file only', () => {
  assert.deepEqual(withThreadCap(['-y', '-i', 'a.mp4', 'b.mp4'], 3), ['-y', '-i', 'a.mp4', '-threads', '3', 'b.mp4']);
  assert.deepEqual(withThreadCap(['-hide_banner', '-i', 'a.mp4'], 3), ['-hide_banner', '-i', 'a.mp4']);
  assert.deepEqual(withThreadCap(['-i', 'a', '-threads', '1', 'b'], 3), ['-i', 'a', '-threads', '1', 'b']);
  assert.deepEqual(withThreadCap(['-i', 'a', 'b'], 0), ['-i', 'a', 'b']);
});

test('powerState reads charger, battery level and battery health from sysfs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psy-'));
  const put = (dev, files) => { fs.mkdirSync(path.join(dir, dev)); for (const [k, v] of Object.entries(files)) fs.writeFileSync(path.join(dir, dev, k), `${v}\n`); };
  put('AC', { type: 'Mains', online: 0 });
  put('BAT0', { type: 'Battery', capacity: 80, status: 'Discharging', energy_full: 11950000, energy_full_design: 45000000 });
  put('hidpp_battery_0', { type: 'Battery', scope: 'Device', capacity: 10 });
  assert.deepEqual(powerState(dir), { onBattery: true, percent: 80, health: 0.27 });
  fs.writeFileSync(path.join(dir, 'AC', 'online'), '1\n');
  assert.equal(powerState(dir).onBattery, false);
  assert.deepEqual(powerState(path.join(dir, 'missing')), { onBattery: null, percent: null, health: null });
});

import { thermalState, thermalPacer } from '../src/render/load.mjs';

test('thermalState: CPU package against 82 °C, board sensors 15 °C under their critical point', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thz-'));
  const zone = (i, type, temp, crit) => {
    const d = path.join(dir, `thermal_zone${i}`); fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, 'type'), `${type}\n`); fs.writeFileSync(path.join(d, 'temp'), `${temp * 1000}\n`);
    if (crit) { fs.writeFileSync(path.join(d, 'trip_point_0_type'), 'critical\n'); fs.writeFileSync(path.join(d, 'trip_point_0_temp'), `${crit * 1000}\n`); }
  };
  zone(0, 'x86_pkg_temp', 70); zone(1, 'SEN1', 71, 80); zone(2, 'iwlwifi_1', 99); zone(3, 'INT3400 Thermal', 20);
  assert.deepEqual(thermalState(dir, {}), { over: 6, sensor: 'SEN1', temp: 71, limit: 65 });
  assert.equal(thermalState(dir, { OPSCODE_VIDEO_TEMP_LIMIT: '60' }).sensor, 'x86_pkg_temp');
  assert.equal(thermalState(path.join(dir, 'none'), {}), null);
});

test('thermalPacer waits while hot and resumes 8 °C below the pause point', async () => {
  const temps = [{ over: 2, sensor: 'x', temp: 87 }, { over: -3, sensor: 'x', temp: 82 }, { over: -9, sensor: 'x', temp: 76 }];
  let i = 0;
  const p = thermalPacer({ env: {}, read: () => temps[Math.min(i++, temps.length - 1)], stepMs: 1, minRestMs: 0 });
  await p.pace();
  assert.equal(p.stats.pauses, 1);
  assert.equal(i, 3);
  assert.equal(p.stats.peak.temp, 87);
});

test('thermalPacer never waits in full mode or with no sensors', async () => {
  let reads = 0;
  await thermalPacer({ env: { OPSCODE_VIDEO_LOAD: 'full' }, read: () => { reads++; return { over: 50 }; } }).pace();
  assert.equal(reads, 0);
  const p = thermalPacer({ env: {}, read: () => null, stepMs: 1 });
  await p.pace();
  assert.equal(p.stats.pauses, 0);
});

test('thermalPacer rests at least minRestMs even when the CPU cools at once', async () => {
  const p = thermalPacer({ env: {}, read: () => ({ over: -20, sensor: 'x', temp: 50 }), stepMs: 1, minRestMs: 30 });
  const hot = thermalPacer({ env: {}, read: (() => { let n = 0; return () => (n++ ? { over: -20, sensor: 'x', temp: 50 } : { over: 1, sensor: 'x', temp: 86 }); })(), stepMs: 1, minRestMs: 30 });
  await p.pace();
  assert.equal(p.stats.pauses, 0);
  const t0 = Date.now();
  await hot.pace();
  assert.ok(Date.now() - t0 >= 30);
});

test('thermalPacer gives up waiting after maxWaitMs', async () => {
  const p = thermalPacer({ env: {}, read: () => ({ over: 5, sensor: 'x', temp: 90 }), stepMs: 1, maxWaitMs: 20, minRestMs: 0 });
  const t0 = Date.now();
  await p.pace();
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(p.stats.pauses, 1);
});
