/**
 * Geographic helpers.
 *
 * Distance is computed from coordinates rather than stored, because "how far is
 * this store" is a property of the user, not of the store. Travel time is an
 * explicit estimate from an average urban speed and is labelled as such wherever
 * it is shown.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres, rounded to 2 decimal places. */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const distance = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(distance * 100) / 100;
}

/** Average urban driving speed used to turn distance into an estimated duration. */
export const AVERAGE_URBAN_SPEED_KMH = 26;

export function estimatedTravelMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / AVERAGE_URBAN_SPEED_KMH) * 60));
}
