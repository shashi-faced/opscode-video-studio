// How hard a render may push this computer.
//
// A render runs several headless Chrome workers (each drawing on the GPU) plus one x264 encoder
// per worker, and x264 starts about 1.5 threads per CPU core by default. On a laptop that is the
// full CPU and GPU power at once. On a machine with a worn battery or a weak charger the power
// draw can then exceed what the power supply delivers and the computer switches off with no
// warning. So renders are gentle by default: few workers, a fixed number of encoder threads each,
// one worker on battery, and a lower CPU priority so the desktop stays responsive.
//
// OPSCODE_VIDEO_LOAD=full brings back the old behaviour (all cores); =low uses one worker and two
// encoder threads everywhere.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const POWER_DIR = '/sys/class/power_supply';

const cores = () => Math.max(1, (typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length) || 1);

const read = (f) => { try { return fs.readFileSync(f, 'utf8').trim(); } catch { return null; } };

/**
 * Power supply state on Linux (null fields elsewhere or when unknown).
 * onBattery: no charger connected; health: battery full capacity / design capacity (0..1).
 */
export function powerState(dir = POWER_DIR) {
  const state = { onBattery: null, percent: null, health: null };
  let names;
  try { names = fs.readdirSync(dir); } catch { return state; }
  let sawMains = false, mainsOnline = false;
  for (const n of names) {
    const d = path.join(dir, n);
    const type = read(path.join(d, 'type'));
    if (type === 'Mains' || type === 'USB') {
      const online = read(path.join(d, 'online'));
      if (online != null) { sawMains = true; if (online === '1') mainsOnline = true; }
    } else if (type === 'Battery' && read(path.join(d, 'scope')) !== 'Device') {
      const pct = Number(read(path.join(d, 'capacity')));
      if (Number.isFinite(pct) && state.percent == null) state.percent = pct;
      const full = Number(read(path.join(d, 'energy_full')) ?? read(path.join(d, 'charge_full')));
      const design = Number(read(path.join(d, 'energy_full_design')) ?? read(path.join(d, 'charge_full_design')));
      if (full > 0 && design > 0 && state.health == null) state.health = +(full / design).toFixed(2);
      const status = read(path.join(d, 'status'));
      if (!sawMains && status === 'Discharging') state.onBattery = true;
    }
  }
  if (sawMains) state.onBattery = !mainsOnline;
  return state;
}

/**
 * Workers and encoder threads for one render.
 * requested: workers asked for by the caller (capped unless OPSCODE_VIDEO_LOAD=full).
 * wanted: what the render would like with no limits (e.g. 4 GPU workers).
 */
export function renderBudget({ requested, wanted = 1, env = process.env, power = powerState(), ncpu = cores() } = {}) {
  const mode = String(env.OPSCODE_VIDEO_LOAD || 'gentle').toLowerCase();
  const notes = [];
  if (mode === 'full') {
    const workers = Math.max(1, Math.round(requested || wanted));
    return { workers, threads: 0, mode, notes };
  }
  // Up to 8 CPU threads (most laptops): one worker. Bigger machines: two.
  let maxWorkers = mode === 'low' ? 1 : Math.max(1, Math.min(2, Math.floor(ncpu / 8)));
  if (power.onBattery) { maxWorkers = 1; notes.push('running on battery: one render worker; plug in the charger for faster renders'); }
  if (power.health != null && power.health < 0.5) {
    notes.push(`the battery holds only ${Math.round(power.health * 100)}% of its original charge; heavy renders on this computer can switch it off, so this render is kept light`);
  }
  const workers = Math.max(1, Math.min(maxWorkers, Math.round(requested || wanted)));
  // x264 needs only 2 threads to keep up with frame capture; more just heats the CPU.
  const threads = mode === 'low' || power.onBattery ? 2 : Math.max(2, Math.floor(ncpu / 4 / workers));
  if (requested && requested > workers) notes.push(`asked for ${requested} workers, used ${workers} to spare the computer (OPSCODE_VIDEO_LOAD=full uses all)`);
  return { workers, threads, mode, notes };
}

/** ffmpeg arguments that cap encoder threads (none in full mode). */
export const threadArgs = (threads) => (threads > 0 ? ['-threads', String(threads)] : []);

/** Insert thread caps before the output file of an ffmpeg command that has none. */
export function withThreadCap(args, threads = renderBudget().threads) {
  // The last argument must be an output file, not the value of -i (probe-only commands).
  if (!(threads > 0) || args.includes('-threads') || args.length < 2 || args[args.length - 2] === '-i') return args;
  return [...args.slice(0, -1), ...threadArgs(threads), args[args.length - 1]];
}

let lowered = false;
/** Lower this process's CPU priority once (Chrome and ffmpeg started later inherit it). */
export function lowerPriority(env = process.env) {
  if (lowered || String(env.OPSCODE_VIDEO_LOAD || '').toLowerCase() === 'full') return;
  lowered = true;
  try { if (os.getPriority(0) < 10) os.setPriority(0, 10); } catch { /* not allowed here; harmless */ }
}

// ---- Temperature pacing -------------------------------------------------------------------------
// Fewer workers alone do not keep a laptop with weak cooling safe: one Chrome worker and an encoder
// heat an i7 laptop from 54 to 98 °C in ten seconds. Its firmware switches the computer off when a
// board sensor passes its critical point, with nothing in the logs. So frame capture pauses while
// any CPU or board sensor is close to its limit and continues when it has cooled down.

const THERMAL_DIR = '/sys/class/thermal';
const ZONE_TYPES = /^(x86_pkg_temp|TCPU|SEN\d+|acpitz|cpu[-_]?thermal|soc[-_]?thermal)$/i;

/**
 * How far the hottest sensor is above its pause point, in °C (negative: below), or null when
 * no sensor can be read. Pause points: CPU package at OPSCODE_VIDEO_TEMP_LIMIT (default 82 °C),
 * other sensors 15 °C below their critical trip point (board sensors warm up slowly and keep
 * rising for a few seconds after the CPU has calmed down).
 */
export function thermalState(dir = THERMAL_DIR, env = process.env) {
  let names;
  try { names = fs.readdirSync(dir).filter(n => n.startsWith('thermal_zone')); } catch { return null; }
  const pkgLimit = Number(env.OPSCODE_VIDEO_TEMP_LIMIT) || 82;
  let worst = null;
  for (const n of names) {
    const d = path.join(dir, n);
    const type = read(path.join(d, 'type')) || '';
    if (!ZONE_TYPES.test(type)) continue;
    const temp = Number(read(path.join(d, 'temp'))) / 1000;
    if (!(temp > 5 && temp < 150)) continue;
    let limit = /x86_pkg_temp|cpu|soc/i.test(type) && !/TCPU/.test(type) ? pkgLimit : null;
    if (limit == null) {
      for (let i = 0; i < 12; i++) {
        if (read(path.join(d, `trip_point_${i}_type`)) !== 'critical') continue;
        const crit = Number(read(path.join(d, `trip_point_${i}_temp`))) / 1000;
        if (crit > 40) limit = Math.min(crit - 15, type === 'TCPU' ? pkgLimit + 5 : Infinity);
      }
    }
    if (limit == null) continue;
    const over = +(temp - limit).toFixed(1);
    if (!worst || over > worst.over) worst = { over, sensor: type, temp: +temp.toFixed(1), limit };
  }
  return worst;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * A pacer for one render: call `await pace()` between frames. It reads the sensors at most once
 * a second and, when one is at its pause point, rests at least minRestMs and until every sensor
 * is 8 °C below its pause point (at most maxWaitMs per pause). pausedSeconds/pauses tell how long the render rested.
 */
export function thermalPacer({ env = process.env, read: readState = () => thermalState(THERMAL_DIR, env), maxWaitMs = 90000, minRestMs = 3000, stepMs = 1000, onPause = () => {} } = {}) {
  const off = String(env.OPSCODE_VIDEO_LOAD || '').toLowerCase() === 'full' || env.OPSCODE_VIDEO_TEMP_LIMIT === '0';
  let last = 0, waiting = null;
  const stats = { pausedSeconds: 0, pauses: 0, peak: null };
  const pace = async () => {
    if (off) return;
    if (waiting) return waiting; // other workers wait for the same cool-down
    const now = Date.now();
    if (now - last < stepMs) return;
    last = now;
    let st = readState();
    if (st && (!stats.peak || st.temp > stats.peak.temp)) stats.peak = { sensor: st.sensor, temp: st.temp };
    if (!st || st.over < 0) return;
    stats.pauses++;
    onPause(st);
    waiting = (async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < maxWaitMs) {
        await sleep(stepMs);
        st = readState();
        if ((!st || st.over <= -8) && Date.now() - t0 >= minRestMs) break;
      }
      stats.pausedSeconds += Math.round((Date.now() - t0) / 1000);
      last = Date.now();
      waiting = null;
    })();
    return waiting;
  };
  return { pace, stats };
}
