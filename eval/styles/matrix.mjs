// Plan 18 M8: every art style × 3 formats, Hindi and English, 9:16 and 16:9, with voice.
// Each case: validate → layout check (contact sheet, issues) → render (time, size). Results go to
// <out>/results.json, one folder per case, and one sheet per style. Re-running skips finished cases.
//
//   node eval/styles/matrix.mjs <out dir> [--styles a,b] [--voice skip] [--limit n] [--elevenlabs]
//
// Uses the free built-in voices unless --elevenlabs is given (a saved ElevenLabs key would be billed).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ART_STYLES, styleBase } from '../../src/art/styles.mjs';
import { validate } from '../../src/schema/validate.mjs';
import { prepare } from '../../src/pipeline.mjs';
import { runCheck } from '../../src/qa/check.mjs';
import { render } from '../../src/render/render.mjs';
import { findFfmpeg } from '../../src/deps/locate.mjs';

const args = process.argv.slice(2);
const OUT = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : null;
if (!OUT) { console.error('usage: node eval/styles/matrix.mjs <out dir> [--styles a,b] [--voice skip] [--limit n]'); process.exit(2); }
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const onlyStyles = flag('styles')?.split(',');
const VOICE = flag('voice') || 'auto';
const LIMIT = +flag('limit') || Infinity;
if (!args.includes('--elevenlabs')) process.env.OPSCODE_IGNORE_SAVED_VOICE_KEY = '1';

const FORMATS = ['countdown', 'facts', 'myth', 'quiz', 'poll', 'chat', 'post', 'beforeafter', 'data', 'documentary', 'news'];

// Content per format, English and Hindi. Each is the scenes after the opening title.
const C = {
  countdown: {
    en: { title: '3 habits that *waste* your morning', scenes: [
      { template: 'rank', number: 2, title: 'Checking your *phone*', text: 'Your brain wakes up stressed.', icon: 'phone', narration: 'Number two: checking your phone first. Your brain wakes up stressed.' },
      { template: 'rank', number: 1, title: '*Snoozing*', text: 'Every snooze makes you more tired.', icon: 'alarm', narration: 'And number one: snoozing. Every snooze makes you more tired.' }] },
    hi: { title: 'सुबह बर्बाद करने वाली *3 आदतें*', scenes: [
      { template: 'rank', number: 2, title: 'सबसे पहले *फ़ोन*', text: 'दिमाग़ तनाव में जागता है।', icon: 'phone', narration: 'नंबर दो: उठते ही फ़ोन देखना। दिमाग़ तनाव में जागता है।' },
      { template: 'rank', number: 1, title: 'बार-बार *स्नूज़*', text: 'हर स्नूज़ थकान बढ़ाता है।', icon: 'alarm', narration: 'और नंबर एक: बार-बार स्नूज़ करना। हर स्नूज़ थकान बढ़ाता है।' }] },
  },
  facts: {
    en: { title: 'Facts that sound *fake*', scenes: [
      { template: 'fact', number: 1, fact: 'Bananas are *berries*. Strawberries are not.', icon: 'banana', narration: 'Bananas are berries. Strawberries are not.' },
      { template: 'fact', number: 2, fact: 'An octopus has *three hearts*.', icon: 'heart', narration: 'An octopus has three hearts.' }] },
    hi: { title: 'अजीब लेकिन *सच*', scenes: [
      { template: 'fact', number: 1, fact: 'केला असल में *बेरी* है, स्ट्रॉबेरी नहीं।', icon: 'banana', narration: 'केला असल में बेरी है, स्ट्रॉबेरी नहीं।' },
      { template: 'fact', number: 2, fact: 'ऑक्टोपस के *तीन दिल* होते हैं।', icon: 'heart', narration: 'ऑक्टोपस के तीन दिल होते हैं।' }] },
  },
  myth: {
    en: { title: 'Sleep *myths*', scenes: [{ template: 'myth', kicker: 'Myth #1', myth: 'Adults need only 5 hours.', truth: 'Most adults need *7 to 9 hours*.', narration: 'Adults need only five hours of sleep. In fact, most adults need seven to nine.' }] },
    hi: { title: 'नींद के *भ्रम*', scenes: [{ template: 'myth', kicker: 'भ्रम #1', myth: 'बड़ों को बस 5 घंटे नींद चाहिए।', truth: 'ज़्यादातर लोगों को *7 से 9 घंटे* चाहिए।', narration: 'बड़ों को बस पाँच घंटे नींद चाहिए। सच यह है कि ज़्यादातर लोगों को सात से नौ घंटे चाहिए।' }] },
  },
  quiz: {
    en: { title: 'Only *1 in 10* gets this', scenes: [{ template: 'quiz', question: 'Which planet is the *hottest*?', options: ['Mercury', 'Venus', 'Mars'], answer: 2, countdown: 3, explain: 'Venus: its clouds trap heat.', narration: 'Which planet is the hottest? Mercury, Venus or Mars?' }] },
    hi: { title: 'सिर्फ़ *10 में से 1* सही बताता है', scenes: [{ template: 'quiz', question: 'सबसे *गर्म* ग्रह कौन सा है?', options: ['बुध', 'शुक्र', 'मंगल'], answer: 2, countdown: 3, explain: 'शुक्र: बादल गर्मी रोक लेते हैं।', narration: 'सबसे गर्म ग्रह कौन सा है? बुध, शुक्र या मंगल?' }] },
  },
  poll: {
    en: { title: 'Would you *rather*', scenes: [{ template: 'poll', optionA: 'Read minds', optionB: 'Be invisible', iconA: 'brain', iconB: 'eye', resultA: 41, narration: 'Would you rather read minds, or be invisible?' }] },
    hi: { title: 'आप क्या *चुनेंगे*', scenes: [{ template: 'poll', question: 'आप क्या चुनेंगे…', optionA: 'मन पढ़ना', optionB: 'ग़ायब होना', iconA: 'brain', iconB: 'eye', resultA: 58, narration: 'आप क्या चुनेंगे? मन पढ़ना, या ग़ायब हो जाना?' }] },
  },
  chat: {
    en: { title: 'The excuse that *failed*', scenes: [{ template: 'chat', contact: 'Mom', messages: [{ from: 'Mom', text: 'Where are you?' }, { from: 'me', text: 'Library, studying 📚' }, { from: 'Mom', text: 'Funny. I am at the library.' }, { from: 'me', text: '…' }], narration: 'I told Mom I was at the library. She was at the library.' }] },
    hi: { title: 'बहाना *फ़ेल*', scenes: [{ template: 'chat', contact: 'मम्मी', messages: [{ from: 'मम्मी', text: 'कहाँ हो?' }, { from: 'me', text: 'लाइब्रेरी में, पढ़ रहा हूँ 📚' }, { from: 'मम्मी', text: 'अच्छा? मैं भी लाइब्रेरी में हूँ।' }, { from: 'me', text: '…' }], narration: 'मैंने मम्मी से कहा मैं लाइब्रेरी में हूँ। मम्मी भी वहीं थीं।' }] },
  },
  post: {
    en: { title: 'The credit *thief*', scenes: [{ template: 'post', user: 'quiet_intern', community: 'Office Stories', time: '5h', title: 'My manager took credit for my idea. *So I let him present it.*', body: 'He did not know the numbers were mine too.', votes: 24800, comments: 1320, narration: 'My manager took credit for my idea. So I let him present it.' }] },
    hi: { title: 'आइडिया *चोर*', scenes: [{ template: 'post', user: 'chai_lover', community: 'दफ़्तर की बातें', time: '3घं', title: 'बॉस ने मेरा आइडिया अपना बताया। *मैंने उन्हें ही पेश करने दिया।*', body: 'उन्हें नहीं पता था कि आँकड़े भी मेरे थे।', votes: 15300, comments: 940, narration: 'बॉस ने मेरा आइडिया अपना बताया। मैंने उन्हें ही पेश करने दिया।' }] },
  },
  beforeafter: {
    en: { title: '30-day *reset*', scenes: [{ template: 'beforeafter', headline: 'One habit, *30 days*', after: { text: 'Up at 6, calm mornings', icon: 'sun', items: ['8 hours of sleep', 'Breakfast daily'] }, before: { text: 'Snoozing till 9', icon: 'alarm', items: ['Late every day', 'No breakfast'] }, narration: 'This is me after thirty days. And before? Snoozing till nine.' }] },
    hi: { title: '30 दिन का *बदलाव*', scenes: [{ template: 'beforeafter', headline: 'एक आदत, *30 दिन*', after: { label: 'अब', text: 'सुबह 6 बजे, शांत सुबह', icon: 'sun', items: ['8 घंटे नींद', 'रोज़ नाश्ता'] }, before: { label: 'पहले', text: '9 बजे तक सोना', icon: 'alarm', items: ['रोज़ देर', 'नाश्ता नहीं'] }, narration: 'तीस दिन बाद मेरी सुबह ऐसी है। और पहले? नौ बजे तक सोना।' }] },
  },
  data: {
    en: { title: '*Half* of India pays with one app', scenes: [
      { template: 'chart', kind: 'bar', headline: 'UPI share by app', data: [{ label: 'PhonePe', value: 48 }, { label: 'Google Pay', value: 37 }, { label: 'Paytm', value: 7 }, { label: 'Others', value: 8 }], suffix: '%', highlight: 'PhonePe', source: 'NPCI, 2024', narration: 'PhonePe has almost half. Google Pay is second. Paytm is far behind.' },
      { template: 'chart', kind: 'line', headline: 'ISRO budget', prefix: '₹', suffix: ' cr', data: [{ label: '2015', value: 6000 }, { label: '2019', value: 11538 }, { label: '2023', value: 12544 }], narration: 'The budget doubled in eight years.' }] },
    hi: { title: 'आधा भारत *एक ऐप* से भुगतान करता है', scenes: [
      { template: 'chart', kind: 'pie', headline: 'पैसा कहाँ जाता है', data: [{ label: 'रॉकेट', value: 42 }, { label: 'उपग्रह', value: 31 }, { label: 'विज्ञान', value: 15 }, { label: 'अन्य', value: 12 }], narration: 'सबसे बड़ा हिस्सा रॉकेट का है।' },
      { template: 'chart', kind: 'race', headline: 'कितने उपग्रह', steps: ['1990', '2000', '2010', '2020'], data: [{ label: 'अमेरिका', values: [40, 120, 300, 900] }, { label: 'रूस', values: [90, 110, 150, 200] }, { label: 'चीन', values: [5, 20, 90, 400] }, { label: 'भारत', values: [3, 10, 40, 120] }], narration: 'तीस साल, देश दर देश।' }] },
  },
  documentary: {
    en: { title: 'The *spice* route', scenes: [
      { template: 'map', kicker: 'The spice route', headline: 'From *Kochi* to *Venice*', route: ['Kochi', 'Muscat', 'Cairo', 'Venice'], highlight: ['India', 'Italy'], narration: 'Pepper left Kochi, crossed to Muscat, travelled through Cairo and reached Venice.' },
      { template: 'timeline', headline: 'India in *space*', events: [{ year: '1975', title: 'Aryabhata' }, { year: '2008', title: 'Chandrayaan-1' }, { year: '2014', title: 'Mangalyaan' }, { year: '2023', title: 'Chandrayaan-3' }], narration: 'In 1975 Aryabhata. In 2008 Chandrayaan-1. In 2014 Mangalyaan, and in 2023 Chandrayaan-3.' }] },
    hi: { title: 'मसालों का *रास्ता*', scenes: [
      { template: 'map', kicker: 'मसालों का रास्ता', headline: '*कोच्चि* से *वेनिस* तक', route: ['Kochi', 'Muscat', 'Cairo', 'Venice'], highlight: ['भारत', 'Italy'], narration: 'काली मिर्च कोच्चि से चली, मस्कट पहुँची, फिर काहिरा होते हुए वेनिस तक गई।' },
      { template: 'timeline', headline: 'अंतरिक्ष में *भारत*', events: [{ year: '1975', title: 'आर्यभट' }, { year: '2008', title: 'चंद्रयान-1' }, { year: '2014', title: 'मंगलयान' }, { year: '2023', title: 'चंद्रयान-3' }], narration: '1975 में आर्यभट। 2008 में चंद्रयान-1। 2014 में मंगलयान, और 2023 में चंद्रयान-3।' }] },
  },
  news: {
    en: { title: 'Launch *update*', scenes: [{ template: 'news', headline: 'New metro line opens *today*', subline: '12 stations, 25 minutes end to end.', place: 'Pune', date: '13 Nov', ticker: ['Trains every 7 minutes', 'Fares from ₹10', 'Parking at 4 stations'], narration: 'Breaking: the new metro line opens today, with twelve stations.' }] },
    hi: { title: 'ताज़ा *ख़बर*', scenes: [{ template: 'news', kicker: 'ताज़ा ख़बर', headline: 'नई मेट्रो लाइन *आज* से शुरू', subline: '12 स्टेशन, 25 मिनट में पूरा सफ़र।', place: 'पुणे', date: '13 नवंबर', ticker: ['हर 7 मिनट में ट्रेन', 'किराया ₹10 से', '4 स्टेशनों पर पार्किंग'], narration: 'ताज़ा ख़बर: नई मेट्रो लाइन आज से शुरू हो रही है।' }] },
  },
};

const styles = ART_STYLES.filter((s) => !onlyStyles || onlyStyles.includes(s));
const cases = [];
ART_STYLES.forEach((style, si) => {
  if (!styles.includes(style)) return;
  for (let k = 0; k < 3; k++) {
    const format = FORMATS[(si * 3 + k) % FORMATS.length];
    const lang = (si + k) % 2 ? 'hi' : 'en';
    const aspect = (si + k + (si % 3 === 0 ? 1 : 0)) % 2 ? '9:16' : '16:9';
    cases.push({ id: `${style}--${format}--${lang}--${aspect.replace(':', 'x')}`, style, format, lang, aspect });
  }
});

fs.mkdirSync(OUT, { recursive: true });
const RES = path.join(OUT, 'results.json');
const results = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, 'utf8')) : {};
const save = () => fs.writeFileSync(RES, JSON.stringify(results, null, 1));
let n = 0;
for (const c of cases) {
  if (results[c.id]?.done || n >= LIMIT) continue;
  n++;
  const dir = path.join(OUT, c.id);
  fs.mkdirSync(dir, { recursive: true });
  const content = C[c.format][c.lang];
  const sb = {
    title: `${c.style} ${c.format} ${c.lang}`, type: 'reel', format: c.aspect, art: { style: c.style },
    ...(c.lang === 'hi' ? { voice: { voice: 'hi-IN-SwaraNeural' } } : {}),
    captions: { style: c.aspect === '9:16' ? 'pop' : 'line' },
    scenes: [{ template: 'title', headline: content.title, narration: content.title.replace(/\*/g, '') + (c.lang === 'hi' ? '।' : '.') }, ...content.scenes],
  };
  const file = path.join(dir, 'storyboard.json');
  fs.writeFileSync(file, JSON.stringify(sb, null, 1));
  const r = { ...c, base: styleBase(c.style) };
  const t0 = Date.now();
  try {
    const v = validate(sb);
    r.valid = v.ok; r.warnings = v.warnings.map((w) => `${w.path}: ${w.message}`);
    if (!v.ok) throw new Error(`invalid: ${JSON.stringify(v.errors)}`);
    const p = await prepare(file, { voice: VOICE });
    const chk = await runCheck({ build: p.build, storyboard: v.storyboard, outDir: dir });
    r.check = { errors: chk.errors, warnings: chk.warnings, issues: chk.issues.map((i) => `${i.severity} s${i.scene} ${i.check} ${i.element || ''}`.trim()) };
    fs.copyFileSync(chk.contactSheet, path.join(OUT, `${c.id}.jpg`));
    const t1 = Date.now();
    const out = await render(file, { voice: VOICE });
    r.renderSec = +((Date.now() - t1) / 1000).toFixed(1);
    r.duration = +out.duration.toFixed(2);
    r.speed = +(r.renderSec / out.duration).toFixed(2); // seconds of work per second of video
    r.sizeMB = +(fs.statSync(out.file).size / 1048576).toFixed(2);
    r.voice = out.voice;
    r.file = out.file;
  } catch (e) {
    r.error = String(e?.message || e).slice(0, 400);
  }
  r.totalSec = +((Date.now() - t0) / 1000).toFixed(1);
  r.done = true;
  results[c.id] = r;
  save();
  console.log(`${c.id}: ${r.error ? 'ERROR ' + r.error : `${r.duration}s video in ${r.renderSec}s (${r.speed}×), layout ${r.check.errors}E/${r.check.warnings}W`}`);
}

// One sheet per style: its case contact sheets stacked.
const ff = findFfmpeg();
for (const style of styles) {
  const files = cases.filter((c) => c.style === style).map((c) => path.join(OUT, `${c.id}.jpg`)).filter((f) => fs.existsSync(f));
  if (!files.length) continue;
  const ins = files.flatMap((f) => ['-i', f]);
  const filt = files.map((_, k) => `[${k}:v]scale=1400:-2[v${k}]`).join(';') + ';' + files.map((_, k) => `[v${k}]`).join('') + `vstack=inputs=${files.length}[o]`;
  try { execFileSync(ff, ['-y', '-v', 'error', ...ins, '-filter_complex', files.length > 1 ? filt : '[0:v]scale=1400:-2[o]', '-map', '[o]', '-frames:v', '1', '-q:v', '5', path.join(OUT, `sheet-${style}.jpg`)]); } catch {}
}
const all = Object.values(results);
const ok = all.filter((r) => !r.error);
console.log(`\n${all.length} cases, ${all.length - ok.length} failed; layout errors in ${ok.filter((r) => r.check.errors).length}; median speed ${ok.map((r) => r.speed).sort((a, b) => a - b)[Math.floor(ok.length / 2)] ?? '-'}× real time`);
