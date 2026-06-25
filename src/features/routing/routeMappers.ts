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
  const routeDistanceKm = (detail.distanceMeters || 0) / 1000;
  return {
    routeId: detail.routeId,
    distKm: routeDistanceKm.toFixed(2),
    duration: formatDuration(null, routeDistanceKm),
    matchPct: scoreToPercent(detail.similarityScore),
    shapeLabel,
    routePoints: detail.polyline || [],
    checkpoints: detail.checkpoints || [],
    pedestrianRoadRatio: detail.pedestrianRoadRatio,
  };
};

export const routeStatsFromCandidate = (
  candidate: CandidateRoute,
  shapeLabel: string,
  fallbackDistanceKm: number,
): RouteStats => {
  const candidateDistance = candidate.distance || 0;
  const routeDistanceKm = candidateDistance
    ? candidateDistance > 100
      ? candidateDistance / 1000
      : candidateDistance
    : fallbackDistanceKm;

  return {
    routeId: candidate.routeId,
    distKm: routeDistanceKm.toFixed(2),
    duration: formatDuration(null, routeDistanceKm),
    matchPct: scoreToPercent(candidate.similarityScore),
    shapeLabel,
    routePoints: candidate.polyline || [],
    pedestrianRoadRatio: candidate.pedestrianRoadRatio,
  };
};
