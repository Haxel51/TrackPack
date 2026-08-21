/**
 * routingEta.ts
 * Free, zero-API-key routing & geocoding powered by:
 * - OSRM (Open Source Routing Machine) for Nigerian road routing & ETAs
 * - OpenStreetMap Nominatim for search & reverse geocoding
 * - Self-learning ETA calculation from historical trip logs
 */

const API_BASE = '/api';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distance_km: number;
  duration_minutes: number;
  duration_formatted: string;
}

export interface NominatimSearchResult {
  display_name: string;
  latitude: number;
  longitude: number;
  address?: Record<string, string>;
}

export interface SelfLearningEtaResult {
  estimated_minutes: number;
  display_text: string;
  is_learned: boolean;
  sample_size: number;
  min_minutes?: number;
  max_minutes?: number;
  source: 'osrm' | 'self_learned_average' | 'self_learned_range';
}

const NIGERIAN_OFFLINE_LANDMARKS = [
  { name: "Apapa Port Complex, Lagos", display_name: "Apapa Port Complex, Wharf Road, Apapa, Lagos, Nigeria", latitude: 6.4474, longitude: 3.3644 },
  { name: "Tin Can Island Port, Lagos", display_name: "Tin Can Island Port, Apapa-Oshodi Expressway, Lagos, Nigeria", latitude: 6.4385, longitude: 3.3421 },
  { name: "Ikeja Industrial Estate, Lagos", display_name: "Ikeja Industrial Estate, Oba Akran Avenue, Ikeja, Lagos, Nigeria", latitude: 6.6018, longitude: 3.3515 },
  { name: "Lekki Free Trade Zone, Lagos", display_name: "Lekki Free Trade Zone, Ibeju-Lekki, Lagos, Nigeria", latitude: 6.4253, longitude: 3.9458 },
  { name: "Alaba International Market, Lagos", display_name: "Alaba International Market, Ojo, Lagos, Nigeria", latitude: 6.4619, longitude: 3.1932 },
  { name: "Dangote Cement Factory, Ibese, Ogun", display_name: "Dangote Cement Plant, Ibese, Yewa North, Ogun State, Nigeria", latitude: 7.0058, longitude: 3.0456 },
  { name: "Sagamu Interchange Logistics Hub, Ogun", display_name: "Sagamu Interchange Hub, Lagos-Ibadan Expressway, Sagamu, Ogun State, Nigeria", latitude: 6.8402, longitude: 3.6496 },
  { name: "Ota Industrial Zone, Ogun", display_name: "Ota Industrial Layout, Idiroko Road, Ota, Ogun State, Nigeria", latitude: 6.6906, longitude: 3.2361 },
  { name: "Ibeto Industrial Complex, Nnewi, Anambra", display_name: "Ibeto Industrial Complex, Otolo, Nnewi, Anambra State, Nigeria", latitude: 6.0198, longitude: 6.9174 },
  { name: "Onitsha Main Market & River Port, Anambra", display_name: "Onitsha Main Market, Marine Road, Onitsha, Anambra State, Nigeria", latitude: 6.1518, longitude: 6.7758 },
  { name: "Dangote Cement Plant, Obajana, Kogi", display_name: "Dangote Cement Plant, Obajana, Lokoja LGA, Kogi State, Nigeria", latitude: 7.9189, longitude: 6.4262 },
  { name: "Port Harcourt Wharf & Trans-Amadi, Rivers", display_name: "Trans-Amadi Industrial Layout, Port Harcourt, Rivers State, Nigeria", latitude: 4.8156, longitude: 7.0498 },
  { name: "Onne Oil & Gas Free Zone, Rivers", display_name: "Federal Lighter Terminal, Onne Port, Eleme, Rivers State, Nigeria", latitude: 4.7145, longitude: 7.1567 },
  { name: "BUA Cement Plant, Okpella, Edo", display_name: "BUA Cement Plant, Okpella, Etsako East, Edo State, Nigeria", latitude: 7.2589, longitude: 6.3478 },
  { name: "Benin City Commercial Center, Edo", display_name: "Ring Road Commercial Hub, Benin City, Edo State, Nigeria", latitude: 6.3350, longitude: 5.6037 },
  { name: "Dawanau Grain Market, Kano", display_name: "Dawanau International Market, Dawakin Tofa, Kano State, Nigeria", latitude: 12.0682, longitude: 8.4412 },
  { name: "Bompai Industrial Area, Kano", display_name: "Bompai Industrial Estate, Nasarawa, Kano State, Nigeria", latitude: 12.0234, longitude: 8.5492 },
  { name: "Idu Industrial Layout, Abuja FCT", display_name: "Idu Industrial Area, Phase 1, Abuja FCT, Nigeria", latitude: 9.0345, longitude: 7.3321 },
  { name: "Oluyole Industrial Estate, Ibadan, Oyo", display_name: "Oluyole Industrial Estate, Ring Road, Ibadan, Oyo State, Nigeria", latitude: 7.3524, longitude: 3.8643 },
  { name: "Ariaria International Market, Aba, Abia", display_name: "Ariaria International Market, Faulks Road, Aba, Abia State, Nigeria", latitude: 5.1278, longitude: 7.3389 },
  { name: "Emene Industrial Area, Enugu", display_name: "Emene Industrial Layout, Airport Road, Enugu, Enugu State, Nigeria", latitude: 6.4712, longitude: 7.5583 },
  { name: "Warri Refinery & Petrochemicals, Delta", display_name: "Warri Port & Refinery Area, Ekpan, Warri, Delta State, Nigeria", latitude: 5.5442, longitude: 5.7289 },
  { name: "Kakuri Industrial Area, Kaduna", display_name: "Kakuri Industrial Estate, Kaduna South, Kaduna State, Nigeria", latitude: 10.4578, longitude: 7.4201 },
  { name: "Calabar Export Processing Zone, Cross River", display_name: "Calabar Free Trade Zone, Port Road, Calabar, Cross River State, Nigeria", latitude: 4.9757, longitude: 8.3182 }
];

/**
 * Format minutes into readable English (e.g., "2 hrs 15 mins" or "45 mins")
 */
export function formatDurationMinutes(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  const hrs = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hrs > 0) {
    return `${hrs} hr${hrs > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min${mins > 1 ? 's' : ''}` : ''}`;
  }
  return `${mins} min${mins > 1 ? 's' : ''}`;
}

/**
 * Calculate driving distance and duration using backend OSRM proxy with road fallback
 */
export async function calculateRouteWithOSRM(
  origin: Coordinates,
  destination: Coordinates
): Promise<RouteResult | null> {
  if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) {
    return null;
  }

  try {
    const url = `${API_BASE}/fleet/route/osrm?origin_lat=${origin.latitude}&origin_lng=${origin.longitude}&dest_lat=${destination.latitude}&dest_lng=${destination.longitude}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.success && typeof data.distance_km === 'number') {
        return {
          distance_km: data.distance_km,
          duration_minutes: data.duration_minutes,
          duration_formatted: data.duration_formatted || formatDurationMinutes(data.duration_minutes)
        };
      }
    }
  } catch (err) {
    // Silently fall back to Haversine
  }

  // Client-side fallback calculation
  try {
    const R = 6371;
    const dLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;
    const dLon = ((destination.longitude - origin.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((origin.latitude * Math.PI) / 180) *
        Math.cos((destination.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLineKm = R * c;
    const distance_km = Math.round(straightLineKm * 1.25 * 10) / 10;
    const duration_minutes = Math.max(15, Math.round((distance_km / 55) * 60));

    return {
      distance_km,
      duration_minutes,
      duration_formatted: formatDurationMinutes(duration_minutes)
    };
  } catch (err) {
    return null;
  }
}

/**
 * Search locations in Nigeria using backend Nominatim proxy + local Nigerian landmark dictionary
 */
export async function searchLocationNominatim(query: string): Promise<NominatimSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const cleanQuery = query.trim();

  try {
    const url = `${API_BASE}/fleet/geocode/search?q=${encodeURIComponent(cleanQuery)}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.results) && data.results.length > 0) {
        return data.results;
      }
    }
  } catch (err) {
    // Graceful offline fallback
  }

  // Client-side offline search fallback
  const qLower = cleanQuery.toLowerCase();
  const matched = NIGERIAN_OFFLINE_LANDMARKS.filter(loc =>
    loc.name.toLowerCase().includes(qLower) ||
    loc.display_name.toLowerCase().includes(qLower)
  );

  return matched.map(loc => ({
    display_name: loc.display_name,
    latitude: loc.latitude,
    longitude: loc.longitude
  }));
}

/**
 * Reverse geocode GPS coordinates into a human-readable Nigerian place name
 */
export async function reverseGeocodeNominatim(coords: Coordinates): Promise<string> {
  if (!coords?.latitude || !coords?.longitude) return 'Pinned Location';

  try {
    const url = `${API_BASE}/fleet/geocode/reverse?lat=${coords.latitude}&lon=${coords.longitude}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.place_name) {
        return data.place_name;
      }
    }
  } catch (err) {
    // Graceful offline fallback
  }

  // Find closest offline landmark
  let closestHub: typeof NIGERIAN_OFFLINE_LANDMARKS[0] | null = null;
  let minDistance = Infinity;

  for (const loc of NIGERIAN_OFFLINE_LANDMARKS) {
    const dLat = (loc.latitude - coords.latitude) * 111;
    const dLon = (loc.longitude - coords.longitude) * 111 * Math.cos((coords.latitude * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < minDistance) {
      minDistance = dist;
      closestHub = loc;
    }
  }

  if (closestHub && minDistance < 25) {
    return `Near ${closestHub.name} (~${minDistance.toFixed(1)} km)`;
  }

  return `GPS (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
}

/**
 * Self-learning ETA calculation:
 * - <5 trips: returns baseline OSRM estimate
 * - 5-9 trips: returns average of real historical trips
 * - 10+ trips: returns realistic time range (e.g., "Expected in 1hr 45min — 2hrs 10min")
 */
export function computeSelfLearningETA(
  osrmDurationMinutes: number,
  historicalTripDurations: number[] // array of completed durations in minutes on the same route
): SelfLearningEtaResult {
  const validDurations = historicalTripDurations.filter(d => typeof d === 'number' && d > 10 && d < 1440);
  const sampleSize = validDurations.length;

  if (sampleSize < 5) {
    return {
      estimated_minutes: osrmDurationMinutes,
      display_text: `Expected in ~${formatDurationMinutes(osrmDurationMinutes)} (OSRM estimate)`,
      is_learned: false,
      sample_size: sampleSize,
      source: 'osrm'
    };
  }

  // Calculate mean
  const sum = validDurations.reduce((acc, curr) => acc + curr, 0);
  const averageMinutes = Math.round(sum / sampleSize);

  if (sampleSize < 10) {
    return {
      estimated_minutes: averageMinutes,
      display_text: `Expected in ~${formatDurationMinutes(averageMinutes)} (Learned from ${sampleSize} trips 🧠)`,
      is_learned: true,
      sample_size: sampleSize,
      source: 'self_learned_average'
    };
  }

  // 10+ trips: compute variance / range (10th percentile to 90th percentile)
  const sorted = [...validDurations].sort((a, b) => a - b);
  const minIndex = Math.floor(sampleSize * 0.15);
  const maxIndex = Math.min(sampleSize - 1, Math.ceil(sampleSize * 0.85));
  const minMinutes = sorted[minIndex] || Math.round(averageMinutes * 0.85);
  const maxMinutes = sorted[maxIndex] || Math.round(averageMinutes * 1.15);

  return {
    estimated_minutes: averageMinutes,
    min_minutes: minMinutes,
    max_minutes: maxMinutes,
    display_text: `Expected in ${formatDurationMinutes(minMinutes)} — ${formatDurationMinutes(maxMinutes)} (Real road history: ${sampleSize} trips 🧠⚡)`,
    is_learned: true,
    sample_size: sampleSize,
    source: 'self_learned_range'
  };
}
