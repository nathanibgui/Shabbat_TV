// Hebcal API service - Shabbat times, Zmanim, and Jewish calendar

export interface ShabbatTimes {
  candleLighting: string | null;
  havdalah: string | null;
  parasha: string | null;
  date: string | null;
}

export interface ZmanimData {
  alotHaShachar: string;
  misheyakir: string;
  sunrise: string;
  sofZmanShmaMGA: string;
  sofZmanShmaGRA: string;
  sofZmanTfillaMGA: string;
  sofZmanTfillaGRA: string;
  chatzot: string;
  minchaGedola: string;
  minchaKetana: string;
  plagHaMincha: string;
  sunset: string;
  tzeit: string;
}

export interface YomTovInfo {
  name: string;
  nameHe: string;
  date: string;
  category: string;
}

export async function fetchShabbatTimes(geonameid: number = 2988507): Promise<ShabbatTimes> {
  try {
    const url = `https://www.hebcal.com/shabbat?cfg=json&geonameid=${geonameid}&M=on`;
    const response = await fetch(url);
    const data = await response.json();

    const result: ShabbatTimes = {
      candleLighting: null,
      havdalah: null,
      parasha: null,
      date: null,
    };

    for (const item of data.items || []) {
      const cat = item.category || '';
      if (cat === 'candles') {
        result.candleLighting = item.date || '';
        result.date = result.candleLighting?.substring(0, 10) || null;
      } else if (cat === 'havdalah') {
        result.havdalah = item.date || '';
      } else if (cat === 'parashat') {
        result.parasha = item.title || '';
      }
    }

    return result;
  } catch (error) {
    console.error('Failed to fetch Shabbat times:', error);
    return { candleLighting: null, havdalah: null, parasha: null, date: null };
  }
}

export async function fetchZmanim(
  latitude: number,
  longitude: number,
  date?: string
): Promise<ZmanimData | null> {
  try {
    const d = date || new Date().toISOString().substring(0, 10);
    const url = `https://www.hebcal.com/zmanim?cfg=json&latitude=${latitude}&longitude=${longitude}&date=${d}`;
    const response = await fetch(url);
    const data = await response.json();
    const times = data.times || {};

    return {
      alotHaShachar: times.alotHaShachar || '',
      misheyakir: times.misheyakir || '',
      sunrise: times.sunrise || '',
      sofZmanShmaMGA: times.sofZmanShmaMGA || '',
      sofZmanShmaGRA: times.sofZmanShmaGRA || '',
      sofZmanTfillaMGA: times.sofZmanTfillaMGA || '',
      sofZmanTfillaGRA: times.sofZmanTfillaGRA || '',
      chatzot: times.chatzot || '',
      minchaGedola: times.minchaGedola || '',
      minchaKetana: times.minchaKetana || '',
      plagHaMincha: times.plagHaMincha || '',
      sunset: times.sunset || '',
      tzeit: times.tzeit42min || times.tzeit || '',
    };
  } catch (error) {
    console.error('Failed to fetch zmanim:', error);
    return null;
  }
}

export async function fetchUpcomingHolidays(geonameid: number = 2988507): Promise<YomTovInfo[]> {
  try {
    const year = new Date().getFullYear();
    const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${year}&month=x&geonameid=${geonameid}&maj=on&min=on&mod=on&nx=on&mf=on&ss=on`;
    const response = await fetch(url);
    const data = await response.json();

    const now = new Date();
    const holidays: YomTovInfo[] = [];

    for (const item of data.items || []) {
      const itemDate = new Date(item.date);
      if (itemDate >= now) {
        holidays.push({
          name: item.title || '',
          nameHe: item.hebrew || '',
          date: item.date || '',
          category: item.category || '',
        });
      }
    }

    return holidays.slice(0, 20);
  } catch (error) {
    console.error('Failed to fetch holidays:', error);
    return [];
  }
}

export function isShabbatNow(times: ShabbatTimes): boolean {
  if (!times.candleLighting) return false;
  try {
    const candle = new Date(times.candleLighting);
    const havdalah = times.havdalah ? new Date(times.havdalah) : new Date(candle.getTime() + 25 * 60 * 60 * 1000);
    const now = new Date();
    return now >= candle && now <= havdalah;
  } catch {
    return false;
  }
}

export function getCountdownToShabbat(times: ShabbatTimes): string | null {
  if (!times.candleLighting) return null;
  const now = new Date();
  const candle = new Date(times.candleLighting);
  const diff = candle.getTime() - now.getTime();
  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

// City search via Hebcal autocomplete
export interface CityResult {
  id: number; // geonameid
  name: string;
  country: string;
  admin1?: string; // state/region
  latitude: number;
  longitude: number;
  timezone: string;
}

export async function searchCities(query: string): Promise<CityResult[]> {
  if (!query || query.length < 2) return [];
  try {
    const url = `https://www.hebcal.com/complete?q=${encodeURIComponent(query)}&limit=8`;
    const response = await fetch(url);
    const data = await response.json();

    return (data || [])
      .filter((item: any) => item.id && item.geo === 'geoname')
      .map((item: any) => ({
        id: parseInt(item.id, 10),
        name: item.value || item.asciiname || '',
        country: item.country || '',
        admin1: item.admin1 || '',
        latitude: parseFloat(item.latitude) || 0,
        longitude: parseFloat(item.longitude) || 0,
        timezone: item.timezone || 'UTC',
      }));
  } catch (error) {
    console.error('Failed to search cities:', error);
    return [];
  }
}

export function formatTime(isoDate: string | null): string {
  if (!isoDate) return '--:--';
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}
