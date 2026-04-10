/**
 * 附近球场 API（Vercel / Node Serverless）
 *
 * 数据源优先级（写在服务端，便于运维理解）：
 * - 坐标在中国大陆范围 → 高德（需 AMAP_API_KEY）→ 失败或无结果 → OpenStreetMap
 * - 坐标在范围外 → Google Places（需 GOOGLE_PLACES_API_KEY）→ 失败或无结果 → OpenStreetMap
 * - 未配置对应 Key 时跳过该源，最终由 OSM 兜底，全球可用、不报错
 *
 * 调试参数 force（可选）：
 * - force=amap / google / osm 强制指定数据源；osm 仅走 OSM、不再请求高德/Google
 * - 不传 force 时按坐标自动判断中国境内外
 */

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/** 中国大陆经纬度范围（粗略矩形，用于选高德/Google，非精确国界） */
function isInChina(lat, lng) {
  return lat >= 18 && lat <= 53 && lng >= 73 && lng <= 135;
}

function calcDist(lat1, lng1, lat2, lng2) {
  if (!Number.isFinite(lat2) || !Number.isFinite(lng2)) return 999;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

/** 高德周边 POI：keywords 搜高尔夫球场；无 Key 或失败返回 [] */
async function fetchAmap(lat, lng) {
  const key = process.env.AMAP_API_KEY;
  if (!key) return [];
  try {
    const url = `https://restapi.amap.com/v3/place/around?key=${encodeURIComponent(key)}&location=${lng},${lat}&keywords=${encodeURIComponent('高尔夫球场')}&radius=10000&offset=15&output=json`;
    const r = await fetch(url);
    const d = await r.json();
    if (String(d.status) !== '1' || !Array.isArray(d.pois)) return [];
    return d.pois
      .map((p) => {
        if (!p.location || typeof p.location !== 'string') return null;
        const parts = p.location.split(',').map(Number);
        const pLng = parts[0];
        const pLat = parts[1];
        return {
          name: p.name || '未命名球场',
          address: p.address || '',
          distance: calcDist(lat, lng, pLat, pLng),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance);
  } catch {
    return [];
  }
}

/** Google Places Nearby：无 Key 或失败返回 [] */
async function fetchGoogle(lat, lng) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=10000&type=golf_course&language=zh-CN&key=${encodeURIComponent(key)}`;
    const r = await fetch(url);
    const d = await r.json();
    if (d.status !== 'OK' && d.status !== 'ZERO_RESULTS') return [];
    return (d.results || [])
      .map((p) => {
        const loc = p.geometry?.location;
        if (!loc) return null;
        return {
          name: p.name || '未命名球场',
          address: p.vicinity || '',
          distance: calcDist(lat, lng, loc.lat, loc.lng),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 15);
  } catch {
    return [];
  }
}

/** OSM Overpass 兜底，无需 Key */
async function fetchOSM(lat, lng) {
  try {
    const query = `[out:json][timeout:15];(node["leisure"="golf_course"](around:10000,${lat},${lng});way["leisure"="golf_course"](around:10000,${lat},${lng});relation["leisure"="golf_course"](around:10000,${lat},${lng}););out center tags;`;
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    const d = await r.json();
    return (d.elements || [])
      .map((el) => {
        const eLat = el.lat ?? el.center?.lat;
        const eLng = el.lon ?? el.center?.lon;
        return {
          name: el.tags?.name || el.tags?.['name:en'] || el.tags?.['name:zh'] || '未命名球场',
          address: el.tags?.['addr:full'] || el.tags?.['addr:city'] || el.tags?.['addr:street'] || '',
          distance: calcDist(lat, lng, eLat, eLng),
        };
      })
      .filter((x) => Number.isFinite(x.distance) && x.distance <= 11.5)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 15);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ courses: [] });
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ courses: [] });
  }

  const rawForce = req.query.force;
  const force =
    typeof rawForce === 'string' ? rawForce.trim().toLowerCase() : '';
  const forced = force === 'amap' || force === 'google' || force === 'osm' ? force : '';

  const isCN = isInChina(lat, lng);
  const AMAP_KEY = process.env.AMAP_API_KEY;
  const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
  const hasAmapKey = !!AMAP_KEY;
  const hasGoogleKey = !!GOOGLE_KEY;

  let source = 'none';
  let courses = [];

  if (forced === 'amap' || (!forced && isCN && hasAmapKey)) {
    source = 'amap';
    courses = await fetchAmap(lat, lng);
  } else if (
    forced === 'google' ||
    (forced !== 'amap' && forced !== 'osm' && !isCN && hasGoogleKey)
  ) {
    source = 'google';
    courses = await fetchGoogle(lat, lng);
  }

  if (forced === 'osm' || courses.length === 0) {
    if (forced === 'osm') {
      source = 'osm';
    } else if (source === 'amap' || source === 'google') {
      source = `${source}_failed_fallback_osm`;
    } else {
      source = 'osm';
    }
    courses = await fetchOSM(lat, lng);
  }

  return res.status(200).json({
    courses,
    _debug: {
      isCN,
      hasAmapKey,
      hasGoogleKey,
      force: forced || null,
      source,
    },
  });
}
