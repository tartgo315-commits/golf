/**
 * 从 GolfPass 抓取球场记分卡并合并到 data/courses.json（与现有条目同结构的 scorecard）。
 *
 * 用法: npm run scrape:golfpass
 * 依赖: cheerio、Node 18+ 自带 fetch 或 node-fetch@2
 *
 * 若遇 HTTP 403（CloudFront 拦截机房/脚本流量）：
 * - 在本机浏览器打开任一 pending 的 golfPassUrl，登录或完成人机验证后，
 *   从 DevTools 复制请求头里的 `Cookie`，再执行：
 *     set GOLFPASS_COOKIE=...  （PowerShell: $env:GOLFPASS_COOKIE='...'）
 *     npm run scrape:golfpass
 * - 仍失败时请隔段时间重试，或改为在浏览器里手动复制记分卡后粘贴进 JSON（合规前提下）。
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const fetchFn = globalThis.fetch || require('node-fetch');

const ROOT = path.join(__dirname, '..');
const COURSES_JSON = path.join(ROOT, 'data', 'courses.json');

/** 反爬时常用较新 Windows Chrome UA */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const SLEEP_MS = 5000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadJson() {
  const raw = fs.readFileSync(COURSES_JSON, 'utf8');
  return JSON.parse(raw);
}

function saveJson(data) {
  fs.writeFileSync(COURSES_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function slugFromNameEn(nameEn) {
  return String(nameEn || '')
    .toLowerCase()
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/** 去掉旧 error，写入 lastError，保留 pending 项其它字段 */
function pendingWithLastError(item, message) {
  const { error: _e, lastError: _l, ...rest } = item;
  return { ...rest, lastError: message };
}

function rowCellTexts($, $tr) {
  return $tr
    .find('th,td')
    .toArray()
    .map((el) => $(el).text().trim().replace(/\s+/g, ' '));
}

function findScorecardTable($) {
  let best = null;
  $('table').each((_, table) => {
    const $t = $(table);
    let hasPar = false;
    let hasHcp = false;
    $t.find('tr').each((__, tr) => {
      const texts = rowCellTexts($, $(tr));
      const first = (texts[0] || '').trim();
      if (/^par$/i.test(first)) hasPar = true;
      const rowJoin = texts.join(' ').toLowerCase();
      if (rowJoin.includes('handicap') && !/^par$/i.test(first)) hasHcp = true;
      if (/^handicap$/i.test(first) || /^hcp$/i.test(first) || /^hdcp$/i.test(first)) hasHcp = true;
    });
    if (hasPar && hasHcp) {
      best = $t;
      return false;
    }
  });
  return best;
}

function extractParRow($, $table) {
  const rows = $table.find('tr').toArray();
  for (const tr of rows) {
    const texts = rowCellTexts($, $(tr));
    const first = (texts[0] || '').trim();
    if (!/^par$/i.test(first)) continue;
    const nums = [];
    for (let j = 1; j < texts.length && nums.length < 18; j++) {
      const t = texts[j].replace(/,/g, '');
      if (/^(out|in|total)$/i.test(t)) break;
      const n = parseInt(t, 10);
      if (Number.isFinite(n) && n >= 3 && n <= 6) nums.push(n);
    }
    if (nums.length === 18) return nums;
  }
  return null;
}

function extractHandicapRow($, $table) {
  const rows = $table.find('tr').toArray();
  for (const tr of rows) {
    const texts = rowCellTexts($, $(tr));
    const first = (texts[0] || '').trim();
    if (!/^handicap$/i.test(first) && !/^hcp$/i.test(first) && !/^hdcp$/i.test(first)) continue;
    const nums = [];
    for (let j = 1; j < texts.length && nums.length < 18; j++) {
      const t = texts[j].replace(/,/g, '');
      if (/^(out|in|total)$/i.test(t)) break;
      const n = parseInt(t, 10);
      if (Number.isFinite(n)) nums.push(n);
    }
    if (nums.length === 18) return nums;
  }
  return null;
}

const TEE_PRIORITY = [
  { re: /^black/i, label: 'Black' },
  { re: /^gold/i, label: 'Gold' },
  { re: /^blue/i, label: 'Blue' },
  { re: /^white/i, label: 'White' },
  { re: /^red/i, label: 'Red' },
];

function extractYardageRow($, $table) {
  const candidates = [];
  $table.find('tr').each((_, tr) => {
    const $tr = $(tr);
    const texts = rowCellTexts($, $tr);
    const first = texts[0] || '';
    const ft = first.trim();
    if (/^par$/i.test(ft)) return;
    if (/^handicap$/i.test(ft) || /^hcp$/i.test(ft) || /^hdcp$/i.test(ft)) return;
    if (/handicap/i.test(first) && !/\d/.test(first)) return;

    const nums = [];
    for (let j = 1; j < texts.length && nums.length < 18; j++) {
      const t = texts[j].replace(/,/g, '');
      if (/^(out|in|total)$/i.test(t)) break;
      const n = parseInt(t, 10);
      if (Number.isFinite(n) && n >= 100 && n <= 700) nums.push(n);
    }
    if (nums.length !== 18) return;

    let priority = 99;
    let label = 'Other';
    for (let p = 0; p < TEE_PRIORITY.length; p++) {
      if (TEE_PRIORITY[p].re.test(first)) {
        priority = p;
        label = TEE_PRIORITY[p].label;
        break;
      }
    }
    candidates.push({ priority, label, first, nums });
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.priority - b.priority);
  const best = candidates[0];
  return { yards: best.nums, teeLabel: best.label, teeRowLabel: best.first.trim() };
}

function extractAbout(html) {
  const text = html.replace(/\s+/g, ' ');
  let rating = null;
  let slope = null;
  const mR = text.match(/Rating\s+(\d+\.\d+)/i);
  if (mR) rating = parseFloat(mR[1]);
  const mS = text.match(/Slope\s+(\d+)/i);
  if (mS) slope = parseInt(mS[1], 10);

  let designer = null;
  const mD = text.match(/Designer[s]?\s*[:\s]+([^.\n(<]+?)(?:\.|\s+Year|\s+Par|\s+Built|<)/i);
  if (mD) {
    designer = mD[1].trim().split(',')[0].trim();
  }

  let yearBuilt = null;
  const mY = text.match(/Year\s+Built\s+(\d{4})/i) || text.match(/\bBuilt\s+(\d{4})\b/i);
  if (mY) yearBuilt = parseInt(mY[1], 10);

  let totalPar = null;
  const mP = text.match(/\bPar\s+(\d{2})\b/);
  if (mP) totalPar = parseInt(mP[1], 10);

  let totalYards = null;
  const mYd = text.match(/(\d{4,5})\s*[Yy]ards?/);
  if (mYd) totalYards = parseInt(mYd[1], 10);

  return { rating, slope, designer, yearBuilt, totalPar, totalYards };
}

function extractLatLng(html) {
  const patterns = [
    /markers=[^&|]*\|(-?\d+\.?\d*),(-?\d+\.?\d*)/i,
    /[|&]markers=[^|]*\|(-?\d+\.?\d*),(-?\d+\.?\d*)/i,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      ) {
        return { lat, lng };
      }
    }
  }
  return { lat: null, lng: null };
}

async function fetchHtml(url) {
  const cookie = typeof process !== 'undefined' ? process.env.GOLFPASS_COOKIE : '';
  /** @type {Record<string, string>} */
  const headers = {
    'User-Agent': UA,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
    Referer: 'https://www.golfpass.com/travel-advisor/',
    'Upgrade-Insecure-Requests': '1',
  };
  if (cookie && String(cookie).trim()) {
    headers.Cookie = String(cookie).trim();
  }

  const res = await fetchFn(url, {
    headers,
    redirect: 'follow',
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(`[fetch] ${url} → HTTP ${res.status}`);
    if (body && body.length) {
      console.warn(`[fetch] 响应体前 500 字符:\n${body.substring(0, 500)}`);
    }
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

/**
 * 与 `data/courses.json` 中已有条目一致（LibraryCourse），供 App 记分卡模板使用。
 */
function buildLibraryCourseRecord(pendingItem, par, yards, handicap, about, latLng, teeMeta) {
  const nameEn = pendingItem.nameEn || pendingItem.name || 'unknown-course';
  const id = pendingItem.id || slugFromNameEn(nameEn);
  const nameCn = pendingItem.nameCn || pendingItem.nameZh || '';
  const totalParCalc = par.reduce((a, b) => a + b, 0);
  const totalYardsCalc = yards.reduce((a, b) => a + b, 0);
  const totalPar = about.totalPar != null && Number.isFinite(about.totalPar) ? about.totalPar : totalParCalc;
  const totalYards =
    about.totalYards != null && Number.isFinite(about.totalYards) ? about.totalYards : totalYardsCalc;
  const rating =
    about.rating != null && Number.isFinite(about.rating) && about.rating > 0 ? about.rating : undefined;
  const slope =
    about.slope != null && Number.isFinite(about.slope) && about.slope > 0 ? about.slope : undefined;

  const teeNote =
    teeMeta && teeMeta.teeLabel && teeMeta.teeLabel !== 'Black'
      ? `码数取自 ${teeMeta.teeLabel} tee（${teeMeta.teeRowLabel || ''}）`
      : '';

  const scorecard = par.map((p, i) => ({
    hole: i + 1,
    par: p,
    yards: yards[i],
    hcp: handicap[i],
  }));

  /** @type {Record<string, unknown>} */
  const row = {
    id,
    nameCn,
    nameEn,
    country: 'CN',
    province: typeof pendingItem.province === 'string' ? pendingItem.province : '',
    totalPar,
    totalYards,
    source: 'GolfPass',
    sourceUrl: pendingItem.golfPassUrl,
    scorecard,
  };

  if (latLng.lat != null && latLng.lng != null) {
    row.location = { lat: latLng.lat, lng: latLng.lng };
  }
  if (typeof pendingItem.architect === 'string' && pendingItem.architect.trim()) {
    row.architect = pendingItem.architect.trim();
  }
  if (about.designer && !row.architect) {
    row.architect = about.designer;
  }
  if (about.yearBuilt != null && Number.isFinite(about.yearBuilt)) {
    row.yearBuilt = about.yearBuilt;
  }
  if (rating != null) row.rating = rating;
  if (slope != null) row.slope = slope;
  const notesParts = [];
  if (teeNote) notesParts.push(teeNote);
  if (notesParts.length) row.notes = notesParts.join('；');

  return row;
}

async function processOne(item, existingIds) {
  const url = item.golfPassUrl;
  if (!url) throw new Error('缺少 golfPassUrl');

  const nameEn = item.nameEn || item.name || url;
  const id = item.id || slugFromNameEn(nameEn);
  if (existingIds.has(id)) {
    throw new Error(`已存在 courses.id=${id}，跳过重复抓取`);
  }

  let html;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    e.fetchedHtml = null;
    throw e;
  }

  const $ = cheerio.load(html);

  const $table = findScorecardTable($);
  if (!$table || !$table.length) {
    const err = new Error('未找到 scorecard 表格');
    err.debugHtml = html;
    throw err;
  }

  const par = extractParRow($, $table);
  if (!par || par.length !== 18) {
    const err = new Error('无法解析 Par（需 18 洞）');
    err.debugHtml = html;
    throw err;
  }

  const sumPar = par.reduce((a, b) => a + b, 0);
  /** 少数球场总 Par 为 70/74 等，过窄会误杀合法页 */
  if (sumPar < 68 || sumPar > 76) {
    const err = new Error(`Par 总和 ${sumPar} 不在合理范围（68–76）`);
    err.debugHtml = html;
    throw err;
  }

  const handicap = extractHandicapRow($, $table);
  if (!handicap || handicap.length !== 18) {
    const err = new Error('无法解析 Handicap（需 18 个 SI）');
    err.debugHtml = html;
    throw err;
  }

  const yardResult = extractYardageRow($, $table);
  if (!yardResult || !yardResult.yards || yardResult.yards.length !== 18) {
    const err = new Error('无法解析码数（已尝试 Black→Gold→Blue→White→Red）');
    err.debugHtml = html;
    throw err;
  }

  const about = extractAbout($.html());
  const latLng = extractLatLng(html);

  return buildLibraryCourseRecord(
    { ...item, nameEn, id },
    par,
    yardResult.yards,
    handicap,
    about,
    latLng,
    { teeLabel: yardResult.teeLabel, teeRowLabel: yardResult.teeRowLabel },
  );
}

async function main() {
  if (!fs.existsSync(COURSES_JSON)) {
    console.error('缺少文件:', COURSES_JSON);
    console.error('请放入 data/courses.json 或告知后再继续。');
    process.exit(1);
  }

  if (!fetchFn) {
    console.error('请安装 Node 18+ 或: npm install node-fetch@2');
    process.exit(1);
  }

  const data = loadJson();
  if (!Array.isArray(data.courses)) data.courses = [];
  if (!Array.isArray(data.pending)) data.pending = [];

  const existingIds = new Set(data.courses.map((c) => c.id).filter(Boolean));
  const initialPending = data.pending.length;
  const initialCourses = data.courses.length;

  const newCourses = [];
  const stillPending = [];
  const successRows = [];
  const failRows = [];

  for (let i = 0; i < data.pending.length; i++) {
    const item = data.pending[i];
    const label = item.nameEn || item.name || item.golfPassUrl || `#${i}`;

    if (!item.golfPassUrl) {
      const msg = '缺少 golfPassUrl';
      stillPending.push(pendingWithLastError(item, msg));
      failRows.push({ label, reason: msg });
      console.warn(`❌ ${label} - ${msg}`);
      continue;
    }

    try {
      const record = await processOne(item, existingIds);
      newCourses.push(record);
      existingIds.add(record.id);
      const ySum = Array.isArray(record.scorecard)
        ? record.scorecard.reduce((a, h) => a + (Number(h.yards) || 0), 0)
        : 0;
      const note = typeof record.notes === 'string' ? record.notes : '';
      const line = `${record.nameEn} - ${record.totalPar}, ${ySum} yards, 18 holes`;
      successRows.push({
        name: record.nameEn,
        totalPar: record.totalPar,
        totalYards: ySum,
        holes: 18,
        note: note.trim(),
      });
      console.log(`✅ ${line}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e && e.debugHtml && typeof e.debugHtml === 'string') {
        console.warn('--- HTML 片段 (前 2000 字符，便于核对结构) ---');
        console.warn(e.debugHtml.substring(0, 2000));
        console.warn('--- 结束 ---');
      }
      console.warn(`[非致命] ${label}: ${msg}`);
      stillPending.push(pendingWithLastError(item, msg));
      failRows.push({ label, reason: msg });
      console.log(`❌ ${label} - 解析失败（${msg}）`);
    }

    if (i < data.pending.length - 1) await sleep(SLEEP_MS);
  }

  data.courses = [...data.courses, ...newCourses];
  data.pending = stillPending;
  saveJson(data);

  const nCourses = data.courses.length;
  const nPending = data.pending.length;
  const okCount = successRows.length;
  const failCount = failRows.length;

  console.log('');
  console.log('========================================');
  console.log('📊 抓取结果');
  console.log('========================================');
  console.log(`✅ 成功: ${okCount} 个`);
  successRows.forEach((r) => {
    console.log(
      `   - ${r.name} (${r.totalPar} / ${r.totalYards} 码 / ${r.holes} 洞)${r.note ? ' ' + r.note : ''}`,
    );
  });
  console.log('');
  console.log(`❌ 失败: ${failCount} 个`);
  failRows.forEach((r) => {
    console.log(`   - ${r.label} → ${r.reason}`);
  });
  console.log('');
  console.log('📁 data/courses.json 最终状态:');
  console.log(`   - courses: ${nCourses} 条`);
  console.log(`   - pending: ${nPending} 条`);
  console.log('========================================');
  console.log('');
  console.log(`（本轮处理前 pending ${initialPending} 条，courses ${initialCourses} 条）`);
}

main().catch((e) => {
  console.error('[致命]', e);
  process.exit(1);
});
