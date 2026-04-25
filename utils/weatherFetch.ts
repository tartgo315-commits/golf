const WMO_LABELS: Record<number, string> = {
  0: '晴',
  1: '晴间多云',
  2: '晴间多云',
  3: '多云',
  45: '雾',
  48: '雾',
  51: '小雨',
  53: '小雨',
  55: '小雨',
  61: '中雨',
  63: '中雨',
  65: '大雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  80: '阵雨',
  81: '阵雨',
  82: '阵雨',
  95: '雷阵雨',
};

function wmoToLabel(code: number): string {
  return WMO_LABELS[code] ?? '未知';
}

export async function fetchCurrentWeather(lat: number, lng: number): Promise<string | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weathercode,windspeed_10m` +
      `&timezone=Asia%2FTokyo`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: {
        weathercode?: number;
        temperature_2m?: number;
        windspeed_10m?: number;
      };
    };
    const current = data?.current;
    if (!current) return null;
    const label = wmoToLabel(Number(current.weathercode));
    const temp = Math.round(Number(current.temperature_2m));
    const wind = Math.round(Number(current.windspeed_10m));
    return `${label} · ${temp}° · 风速${wind}km/h`;
  } catch {
    return null;
  }
}
