import type {CandidateRoute, RouteDetailData} from '../../api/routeApi';
import type {RouteStats} from '../../types/app';
import {formatDuration} from '../../utils/routeFormat';

export const scoreToPercent = (score?: number) => {
  if (!Number.isFinite(score)) return 90;
  const value = Number(score);
  return Math.round(value <= 1 ? value * 100 : value);
};

export const routeStatsFromDetail = (
  detail: RouteDetailData,
  shapeLabel: string,
): RouteStats => {
  const routeDistanceKm = detail.distanceKm || 0;
  const checkpoints = (detail.checkpoints || [])
    .map(checkpoint => checkpoint.point || checkpoint)
    .filter(point => typeof point.lat === 'number' && typeof point.lng === 'number');
  return {
    routeId: detail.routeId,
    distKm: routeDistanceKm.toFixed(2),
    duration: formatDuration(detail.estimatedTimeSeconds || null, routeDistanceKm),
    matchPct: scoreToPercent(detail.similarityScore),
    shapeLabel,
    routePoints: detail.polyline || [],
    checkpoints,
    pedestrianRoadRatio: detail.pedestrianRoadRatio,
  };
};

export const routeStatsFromCandidate = (
  candidate: CandidateRoute,
  shapeLabel: string,
  fallbackDistanceKm: number,
): RouteStats => {
  const routeDistanceKm = candidate.distanceKm || fallbackDistanceKm;

  return {
    routeId: candidate.routeId,
    distKm: routeDistanceKm.toFixed(2),
    duration: formatDuration(candidate.estimatedTimeSeconds || null, routeDistanceKm),
    matchPct: scoreToPercent(candidate.similarityScore),
    shapeLabel,
    routePoints: candidate.polyline || [],
    pedestrianRoadRatio: candidate.pedestrianRoadRatio,
  };
};
