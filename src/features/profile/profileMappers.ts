import type {CommunityRouteResponse} from '../../api/communityApi';
import type {LikedRouteResponse, RecordDetailResponse} from '../../api/userApi';
import type {Coordinate, SavedRun} from '../../types/app';

export const formatPaceFromRecord = (
  distanceKm?: number,
  totalTimeSeconds?: number,
) => {
  if (!distanceKm || !totalTimeSeconds) return '-';
  const paceSeconds = totalTimeSeconds / distanceKm;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}'${seconds}"`;
};

export const firstPoint = (points?: Coordinate[]) =>
  Array.isArray(points) && points.length > 0 ? points[0] : undefined;

const distanceKmFromRecord = (record: RecordDetailResponse) =>
  record.distanceKm ?? record.totalDistanceKm ?? 0;

const paceFromRecord = (record: RecordDetailResponse) =>
  record.averagePace || record.averagePaceText || formatPaceFromRecord(
    distanceKmFromRecord(record),
    record.totalTimeSeconds,
  );

export const recordToSavedRun = (
  record: RecordDetailResponse,
  sharedRouteIds: Set<string>,
  author: string,
): SavedRun => {
  const routeId = record.routeId || '';
  const distanceKm = distanceKmFromRecord(record);
  const routePoints = record.routePolyline || record.targetRoutePolyline || record.correctedPolyline;
  const actualPoints = record.actualGpsPoints || record.correctedPolyline;
  return {
    id: record.recordId,
    recordId: record.recordId,
    routeId,
    shape: record.routeName || record.shapeType || (routeId ? `루트 ${routeId.slice(0, 4)}` : '완주'),
    distance: `${distanceKm.toFixed(1)} km`,
    pace: paceFromRecord(record),
    matchPct: record.matchRate ?? 100,
    shared: record.shared ?? record.communityShared ?? (routeId ? sharedRouteIds.has(routeId) : false),
    author,
    location: '내 완주 루트',
    likes: 0,
    description: '서버에 저장된 완주 기록입니다.',
    tags: ['완주 기록', '서버 동기화'],
    startCoord: firstPoint(actualPoints) || firstPoint(routePoints),
    routePoints,
    imageUrl: record.imageUrl,
    createdAt: record.completedAt || record.createdAt,
  };
};

export const communityRouteToSavedRun = (route: CommunityRouteResponse): SavedRun => {
  const routePoints = route.route?.polyline;
  return {
    id: route.communityRouteId,
    communityRouteId: route.communityRouteId,
    recordId: route.recordId,
    routeId: route.routeId || route.route?.routeId,
    shape: route.title || route.shapeType || '커뮤니티 루트',
    distance: `${(route.distanceKm || 0).toFixed(1)} km`,
    pace: route.averagePaceText || formatPaceFromRecord(route.distanceKm, route.totalTimeSeconds),
    matchPct: route.matchRate ?? 100,
    shared: true,
    author: route.creator?.nickname || '커뮤니티 러너',
    location: route.locationName || '커뮤니티 루트',
    likes: route.likeCount || 0,
    liked: Boolean(route.liked),
    description: route.description,
    tags: route.liked ? ['좋아요', '커뮤니티'] : ['공유', '커뮤니티'],
    startCoord: route.route?.startPoint || firstPoint(routePoints),
    routePoints,
    imageUrl: route.imageUrl || route.thumbnailUrl,
    createdAt: route.createdAt,
  };
};

export const likedRouteToSavedRun = (route: LikedRouteResponse): SavedRun => ({
  id: route.routeId || route.title,
  routeId: route.routeId,
  shape: route.title || route.shapeType || '좋아요한 루트',
  distance: `${(route.distanceKm || 0).toFixed(1)} km`,
  pace: route.averagePace || '-',
  matchPct: 100,
  shared: true,
  liked: true,
  author: route.creatorNickname || '커뮤니티 러너',
  location: route.locationName || '커뮤니티 루트',
  likes: route.likeCount || 0,
  description: '좋아요한 커뮤니티 루트입니다.',
  tags: ['좋아요', '커뮤니티'],
  imageUrl: route.thumbnailUrl,
  createdAt: route.likedAt,
});
