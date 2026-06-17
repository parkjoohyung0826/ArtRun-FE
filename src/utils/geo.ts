import type {Coordinate} from '../types/app';

export function parseDistanceKm(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 5;
}

export function parsePaceMinutes(value: string) {
  const match = value.match(/(\d+)'(\d+)/);
  if (!match) return 5.5;

  return Number(match[1]) + Number(match[2]) / 60;
}

export function distanceBetweenCoords(a: Coordinate, b: Coordinate) {
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthKm * Math.asin(Math.sqrt(h));
}
