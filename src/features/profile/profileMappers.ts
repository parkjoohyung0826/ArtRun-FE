import type {CommunityRouteResponse, RecordDetailResponse} from '../../api/userApi';
import type {Coordinate, SavedRun} from '../../types/app';

export const formatPaceFromRecord = (
  distanceMeters?: number,
  totalTimeSeconds?: number,
) => {
  if (!distanceMeters || !totalTimeSeconds) return '-';
  const paceSeconds = totalTimeSeconds / (distanceMeters / 1000);
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}'${seconds}"`;
};

export const firstPoint = (points?: Coordinate[]) =>
  Array.isArray(points) && points.length > 0 ? points[0] : undefined;

export const recordToSavedRun = (
  record: RecordDetailResponse,
  sharedRouteIds: Set<string>,
  author: string,
): SavedRun => {
  const routeId = record.routeId || '';
  return {
    id: record.recordId,
    recordId: record.recordId,
    routeId,
    shape: routeId ? `루트 ${routeId.slice(0, 4)}` : '완주',
    distance: `${((record.totalDistanceMeters || 0) / 1000).toFixed(1)} km`,
    pace: formatPaceFromRecord(record.totalDistanceMeters, record.totalTimeSeconds),
    matchPct: 100,
    shared: routeId ? sharedRouteIds.has(routeId) : false,
    author,
    location: '내 완주 루트',
    likes: 0,
    description: '서버에 저장된 완주 기록입니다.',
    tags: ['완주 기록', '서버 동기화'],
    startCoord: firstPoint(record.actualPolyline) || firstPoint(record.plannedPolyline),
    imageUrl: record.imageUrl,
    createdAt: record.createdAt,
  };
};

export const communityRouteToSavedRun = (route: CommunityRouteResponse): SavedRun => ({
  id: route.communityRouteId,
  communityRouteId: route.communityRouteId,
  routeId: route.routeId,
  shape: route.title || '커뮤니티 루트',
  distance: `${((route.distanceMeters || 0) / 1000).toFixed(1)} km`,
  pace: formatPaceFromRecord(route.distanceMeters, route.totalTimeSeconds),
  matchPct: 100,
  shared: true,
  author: route.author?.nickname || route.author?.email || '커뮤니티 러너',
  location: '커뮤니티 루트',
  likes: route.likeCount || 0,
  description: route.description,
  tags: route.liked ? ['좋아요', '커뮤니티'] : ['공유', '커뮤니티'],
  startCoord: firstPoint(route.polyline),
  imageUrl: route.imageUrl,
  createdAt: route.createdAt,
});
