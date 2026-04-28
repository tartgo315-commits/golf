import courseData from './course-data.json';

export type CourseSearchResult = {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  region: string;
  city: string;
  lat: number | null;
  lng: number | null;
  par: number;
  holes: number;
};

const courses = courseData as CourseSearchResult[];

/** 搜索球场（支持中英文名、城市、省份） */
export function searchCourses(query: string, limit = 8): CourseSearchResult[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results: Array<{ course: CourseSearchResult; score: number }> = [];

  for (const c of courses) {
    const name = c.name.toLowerCase();
    const nameEn = c.nameEn.toLowerCase();
    const city = c.city.toLowerCase();
    const region = c.region.toLowerCase();

    let score = 0;
    if (name === q || nameEn === q) score = 100;
    else if (name.startsWith(q) || nameEn.startsWith(q)) score = 80;
    else if (name.includes(q) || nameEn.includes(q)) score = 60;
    else if (city.includes(q) || region.includes(q)) score = 30;

    if (score > 0) results.push({ course: c, score });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.course);
}

/** 按经纬度找附近球场 */
export function nearbyCoursesLocal(
  lat: number,
  lng: number,
  radiusKm = 30,
  limit = 5,
): CourseSearchResult[] {
  return courses
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({ c, dist: haversine(lat, lng, c.lat!, c.lng!) }))
    .filter((x) => x.dist <= radiusKm)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map((x) => x.c);
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
