/**
 * 将 Overpass 返回的 OSM golf_course 转为 data/courses-cn-osm.json（CatalogCourse[]）。
 *
 * 规则：
 * 1) 过滤仅练习场：名称中含「练习场」等关键词，或英文 driving / practice range。
 * 2) 与「名场」去重：data/courses.json 中带逐洞记分卡（≥9 洞）的条目 + data/courses-cn.json
 *    全部作为优先锚点；OSM 若与锚点在名称上匹配（归一化 / 子串 / 公共片段），或与锚点坐标
 *    ≤400m 且名称有弱重叠，则丢弃（保留本地/记分卡数据）。
 *
 * 前置：
 *   curl.exe -sS -X POST "https://overpass-api.de/api/interpreter" --data-binary "@scripts/overpass-cn-golf.op" -o scripts/_osm-cn-golf.json
 *   node scripts/build-cn-osm-catalog.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inPath = join(root, 'scripts', '_osm-cn-golf.json');
const outPath = join(root, 'data', 'courses-cn-osm.json');
const pathCoursesJson = join(root, 'data', 'courses.json');
const pathCoursesCn = join(root, 'data', 'courses-cn.json');

if (!existsSync(inPath)) {
  console.error('Missing', inPath, '— run Overpass curl first (see script header).');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(inPath, 'utf8'));
const elements = Array.isArray(raw.elements) ? raw.elements : [];

const coursesJsonRoot = JSON.parse(readFileSync(pathCoursesJson, 'utf8'));
const coursesCnRoot = JSON.parse(readFileSync(pathCoursesCn, 'utf8'));
const coursesJsonList = Array.isArray(coursesJsonRoot.courses) ? coursesJsonRoot.courses : [];
const coursesCnList = Array.isArray(coursesCnRoot.courses) ? coursesCnRoot.courses : [];

/** 名称归一：去空白、常见标点、统一小写（拉丁部分） */
function normName(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000\u00a0]+/g, '')
    .replace(/[（）()\[\]【】—\-_.·,，.。:：/]/g, '');
}

/** 去掉高频通称后再比「核心名」，减少误伤 */
function normCore(s) {
  return normName(s).replace(
    /(高尔夫球场|高尔夫俱乐部|高尔夫球会|高尔夫乡村俱乐部|乡村俱乐部|国际高尔夫|有限公司|the|club|golfclub|golf)/gi,
    '',
  );
}

function longestCommonSubstringLen(a, b) {
  if (!a || !b) return 0;
  let best = 0;
  const maxCheck = 40;
  const aa = a.length > maxCheck ? a.slice(0, maxCheck) : a;
  const bb = b.length > maxCheck ? b.slice(0, maxCheck) : b;
  for (let i = 0; i < aa.length; i++) {
    for (let j = 0; j < bb.length; j++) {
      let k = 0;
      while (i + k < aa.length && j + k < bb.length && aa[i + k] === bb[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

/** 两名称是否视为同一品牌/场地（中或英）；避免仅靠「高尔夫」等通称短串误判 */
function namesOverlapPair(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const short = na.length <= nb.length ? na : nb;
  const long = na.length <= nb.length ? nb : na;
  if (short.length >= 6 && long.includes(short)) return true;
  if (longestCommonSubstringLen(na, nb) >= 9) return true;
  const ca = normCore(a);
  const cb = normCore(b);
  if (ca.length >= 4 && cb.length >= 4) {
    if (ca === cb) return true;
    const cShort = ca.length <= cb.length ? ca : cb;
    const cLong = ca.length <= cb.length ? cb : ca;
    if (cShort.length >= 5 && cLong.includes(cShort)) return true;
    if (longestCommonSubstringLen(ca, cb) >= 5) return true;
  }
  return false;
}

function nameListsOverlap(listA, listB) {
  for (const a of listA) {
    if (!a) continue;
    for (const b of listB) {
      if (!b) continue;
      if (namesOverlapPair(a, b)) return true;
    }
  }
  return false;
}

/** 弱重叠：用于「坐标很近」时的二次确认，避免不同邻洞误删 */
function weakNameOverlapForProximity(listA, listB) {
  for (const a of listA) {
    if (!a) continue;
    for (const b of listB) {
      if (!b) continue;
      const ca = normCore(a);
      const cb = normCore(b);
      if (ca.length >= 4 && cb.length >= 4 && longestCommonSubstringLen(ca, cb) >= 4) return true;
    }
  }
  return false;
}

function haversineM(lat1, lng1, lat2, lng2) {
  if (
    ![lat1, lng1, lat2, lng2].every(
      (x) => typeof x === 'number' && Number.isFinite(x),
    )
  ) {
    return null;
  }
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}

/** 优先保留：courses.json 记分卡洞数；courses-cn 手填目录（含无 holeDetails 的别名） */
function loadAnchors() {
  /** @type {{ names: string[]; lat?: number; lng?: number; source: string }[]} */
  const anchors = [];

  for (const c of coursesJsonList) {
    const sc = c.scorecard;
    if (!Array.isArray(sc) || sc.length < 9) continue;
    const names = [c.nameCn, c.nameEn].filter((x) => typeof x === 'string' && x.trim());
    const loc = c.location;
    anchors.push({
      names,
      lat: typeof loc?.lat === 'number' ? loc.lat : undefined,
      lng: typeof loc?.lng === 'number' ? loc.lng : undefined,
      source: 'courses.json',
    });
  }

  for (const c of coursesCnList) {
    const names = [c.name, c.nameEn].filter((x) => typeof x === 'string' && x.trim());
    if (names.length === 0) continue;
    anchors.push({
      names,
      lat: typeof c.lat === 'number' ? c.lat : undefined,
      lng: typeof c.lng === 'number' ? c.lng : undefined,
      source: 'courses-cn.json',
    });
  }

  return anchors;
}

const anchors = loadAnchors();

function isPracticeOnlyName(name, nameEn) {
  const n = name || '';
  const en = (nameEn || '').toLowerCase();
  if (n.includes('练习场')) return true;
  if (n.includes('击球练习')) return true;
  if (n.includes('练习廊')) return true;
  if (/\bdriving\s+range\b/i.test(nameEn || '')) return true;
  if (/\bpractice\s+range\b/i.test(en)) return true;
  if (/\bpractice\s+facility\b/i.test(en)) return true;
  if (en.includes('driving range') && !en.includes('course')) return true;
  return false;
}

function osmMatchesAnchor(osmNames, lat, lng, anchor) {
  if (nameListsOverlap(osmNames, anchor.names)) return true;
  const d = haversineM(lat, lng, anchor.lat, anchor.lng);
  if (d != null && d <= 400 && weakNameOverlapForProximity(osmNames, anchor.names)) return true;
  return false;
}

function shouldDropForAnchor(osmNames, lat, lng) {
  for (const a of anchors) {
    if (osmMatchesAnchor(osmNames, lat, lng, a)) return true;
  }
  return false;
}

function centerOf(el) {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lng: el.lon };
  if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

function pickName(tags) {
  return (
    tags['name:zh'] ||
    tags['name:zh-Hans'] ||
    tags['name:zh-Hant'] ||
    tags.name ||
    tags['name:zh-TW'] ||
    ''
  ).trim();
}

function pickNameEn(tags, nameZh) {
  const en = (tags['name:en'] || tags.int_name || '').trim();
  if (en) return en;
  const n = (tags.name || '').trim();
  if (n && /^[\x20-\x7E]+$/.test(n)) return n;
  return nameZh || 'Golf course';
}

function pickPrefecture(tags) {
  return (
    tags['addr:province'] ||
    tags['is_in:province'] ||
    tags['addr:state'] ||
    tags['addr:region'] ||
    ''
  ).trim();
}

function pickCity(tags) {
  return (
    tags['addr:city'] ||
    tags['addr:district'] ||
    tags['addr:county'] ||
    tags['addr:municipality'] ||
    ''
  ).trim();
}

const today = new Date().toISOString().slice(0, 10);
const courses = [];
const seen = new Set();
const stats = {
  skippedNoName: 0,
  skippedNoCenter: 0,
  skippedPractice: 0,
  skippedAnchorDedupe: 0,
  skippedOsmSelfDedupe: 0,
};

for (const el of elements) {
  const tags = el.tags || {};
  const name = pickName(tags);
  if (!name) {
    stats.skippedNoName++;
    continue;
  }
  const c = centerOf(el);
  if (!c) {
    stats.skippedNoCenter++;
    continue;
  }
  const nameEn = pickNameEn(tags, name);
  if (isPracticeOnlyName(name, nameEn)) {
    stats.skippedPractice++;
    continue;
  }

  const osmNames = [name, nameEn].filter(Boolean);
  if (shouldDropForAnchor(osmNames, c.lat, c.lng)) {
    stats.skippedAnchorDedupe++;
    continue;
  }

  const dedupeKey = `${name.toLowerCase()}\t${c.lat.toFixed(3)}\t${c.lng.toFixed(3)}`;
  if (seen.has(dedupeKey)) {
    stats.skippedOsmSelfDedupe++;
    continue;
  }
  seen.add(dedupeKey);

  const id = `cn-osm-${el.type}-${el.id}`;
  courses.push({
    id,
    name,
    nameEn,
    country: 'CN',
    prefecture: pickPrefecture(tags) || '（未标注省份）',
    city: pickCity(tags),
    lat: Math.round(c.lat * 1e6) / 1e6,
    lng: Math.round(c.lng * 1e6) / 1e6,
    verified: false,
    updatedAt: today,
    holes: [
      {
        layout: '全场',
        holes: 18,
        courseRating: null,
        slopeRating: null,
        par: 72,
        holeDetails: [],
      },
    ],
  });
}

const out = {
  _meta: {
    description:
      '中国大陆 OSM leisure=golf_course（relation/270056 边界）；已过滤练习场并与本地名场/目录去重',
    source: 'OpenStreetMap contributors, ODbL — Overpass API; dedupe vs data/courses.json + data/courses-cn.json',
    overpassQueryFile: 'scripts/overpass-cn-golf.op',
    generatedAt: today,
    osmElements: elements.length,
    catalogCourses: courses.length,
    anchorsLoaded: anchors.length,
    filterStats: stats,
  },
  courses,
};

writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', outPath);
console.log('  catalog courses:', courses.length, '/ OSM elements:', elements.length);
console.log('  anchors:', anchors.length, 'stats:', stats);
