import {NAVER_MAP_NCP_KEY_ID} from '../config';
import type {Coordinate} from '../types/app';

const STATIC_MAP_BASE_URL = 'https://naveropenapi.apigw.ntruss.com/map-static/v2/raster';

function routeCenter(points: Coordinate[]) {
  if (!points.length) return null;

  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    {lat: 0, lng: 0},
  );

  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
}

function routeZoom(points: Coordinate[]) {
  if (points.length < 2) return 14;

  const lats = points.map(point => point.lat);
  const lngs = points.map(point => point.lng);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lngSpan = Math.max(...lngs) - Math.min(...lngs);
  const span = Math.max(latSpan, lngSpan);

  if (span > 0.08) return 11;
  if (span > 0.04) return 12;
  if (span > 0.02) return 13;
  if (span > 0.01) return 14;
  return 15;
}

export function createNaverStaticRouteMapUrl(points: Coordinate[]) {
  const center = routeCenter(points);
  if (!center) return null;

  const sampledPoints = points.length > 24
    ? points.filter((_, index) => index % Math.ceil(points.length / 24) === 0)
    : points;
  const path = sampledPoints
    .map(point => `${point.lng.toFixed(6)} ${point.lat.toFixed(6)}`)
    .join('|');
  const params = new URLSearchParams({
    w: '640',
    h: '420',
    center: `${center.lng.toFixed(6)},${center.lat.toFixed(6)}`,
    level: String(routeZoom(points)),
    format: 'png',
    scale: '2',
    'X-NCP-APIGW-API-KEY-ID': NAVER_MAP_NCP_KEY_ID,
    path: `weight:8|color:0xef4444ff|${path}`,
    markers: `type:d|size:mid|pos:${points[0].lng.toFixed(6)} ${points[0].lat.toFixed(6)}|color:orange`,
  });

  return `${STATIC_MAP_BASE_URL}?${params.toString()}`;
}
