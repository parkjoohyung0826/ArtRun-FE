import {API_BASE_URL} from '../config';
import type {Coordinate} from '../types/app';
import type {ApiResponse, UserResponse} from './authApi';

export interface UpdateUserRequest {
  nickname?: string;
  profileImageUrl?: string;
}

export interface MyPageSummaryResponse {
  userId: string;
  nickname: string;
  profileImageUrl?: string;
  totalRunCount: number;
  totalDistanceKm: number;
  sharedRouteCount: number;
  likedRouteCount: number;
}

export interface RecordDetailResponse {
  recordId: string;
  routeId?: string;
  routeName?: string;
  shapeType?: string;
  distanceKm?: number;
  totalDistanceKm?: number;
  totalTimeSeconds?: number;
  averagePace?: string;
  averagePaceText?: string;
  averagePaceSecPerKm?: number;
  averageBpm?: number;
  averageSpeed?: number;
  matchRate?: number;
  shared?: boolean;
  communityShared?: boolean;
  routePolyline?: Coordinate[];
  targetRoutePolyline?: Coordinate[];
  actualGpsPoints?: Coordinate[];
  correctedPolyline?: Coordinate[];
  imageUrl?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface RecordSummaryResponse {
  recordId: string;
  routeId?: string;
  routeName?: string;
  shapeType?: string;
  distanceKm?: number;
  averagePace?: string;
  totalTimeSeconds?: number;
  matchRate?: number;
  imageUrl?: string;
  shared?: boolean;
  completedAt?: string;
}

export interface SharedRouteResponse {
  communityRouteId?: string;
  recordId?: string;
  routeId?: string;
  title: string;
  description?: string;
  distanceKm?: number;
  imageUrl?: string;
  likeCount?: number;
  createdAt?: string;
}

export interface LikedRouteResponse {
  routeId?: string;
  title: string;
  shapeType?: string;
  distanceKm?: number;
  averagePace?: string;
  locationName?: string;
  creatorNickname?: string;
  thumbnailUrl?: string;
  likeCount?: number;
  likedAt?: string;
}

export interface RecordListResponse {
  totalCount: number;
  records: RecordSummaryResponse[];
}

export interface SharedRouteListResponse {
  totalCount: number;
  routes: SharedRouteResponse[];
}

export interface LikedRouteListResponse {
  totalCount: number;
  routes: LikedRouteResponse[];
}

export interface PageParams {
  page?: number;
  size?: number;
  sort?: string[];
}

async function requestJson<T>(path: string, accessToken?: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown network error';
    throw new Error(`서버 연결 실패: ${message}`);
  }

  const bodyText = await response.text().catch(() => '');
  const body = bodyText
    ? (() => {
        try {
          return JSON.parse(bodyText);
        } catch {
          return null;
        }
      })()
    : null;

  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || `HTTP ${response.status}: API 요청 실패`);
  }

  return body;
}

function pageQuery(params: PageParams = {}) {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 20));
  params.sort?.forEach(sort => query.append('sort', sort));
  return query.toString();
}

export function getMe(accessToken?: string) {
  return requestJson<ApiResponse<UserResponse>>('/api/v1/users/me', accessToken);
}

export function updateMe(accessToken: string | undefined, request: UpdateUserRequest) {
  return requestJson<ApiResponse<UserResponse | {
    userId: string;
    nickname: string;
    profileImageUrl?: string;
    updatedAt?: string;
  }>>('/api/v1/users/me', accessToken, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export function getSummary(accessToken?: string) {
  return requestJson<ApiResponse<MyPageSummaryResponse>>(
    '/api/v1/users/me/summary',
    accessToken,
  );
}

export function getMyRecords(accessToken: string | undefined, params?: PageParams) {
  return requestJson<ApiResponse<RecordListResponse>>(
    `/api/v1/users/me/records?${pageQuery(params)}`,
    accessToken,
  );
}

export function getMyRecord(accessToken: string | undefined, recordId: string) {
  return requestJson<ApiResponse<RecordDetailResponse>>(
    `/api/v1/users/me/records/${recordId}`,
    accessToken,
  );
}

export function deleteMyRecord(accessToken: string | undefined, recordId: string) {
  return requestJson<ApiResponse<null>>(`/api/v1/users/me/records/${recordId}`, accessToken, {
    method: 'DELETE',
  });
}

export function getMySharedRoutes(accessToken: string | undefined, params?: PageParams) {
  return requestJson<ApiResponse<SharedRouteListResponse>>(
    `/api/v1/users/me/shared-routes?${pageQuery(params)}`,
    accessToken,
  );
}

export function getLikedRoutes(accessToken: string | undefined, params?: PageParams) {
  return requestJson<ApiResponse<LikedRouteListResponse>>(
    `/api/v1/users/me/liked-routes?${pageQuery(params)}`,
    accessToken,
  );
}
