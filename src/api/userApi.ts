import {API_BASE_URL} from '../config';
import type {Coordinate} from '../types/app';
import type {ApiResponse, UserResponse} from './authApi';

export interface UpdateUserRequest {
  nickname?: string;
  profileImageUrl?: string;
}

export interface MyPageSummaryResponse {
  user: UserResponse;
  totalRuns: number;
  totalDistanceKm: number;
  totalTimeSeconds: number;
  averagePaceMinPerKm: number;
}

export interface RecordDetailResponse {
  recordId: string;
  routeId?: string;
  plannedPolyline?: Coordinate[];
  actualPolyline?: Coordinate[];
  totalDistanceMeters: number;
  totalTimeSeconds: number;
  averageSpeed: number;
  imageUrl?: string;
  createdAt?: string;
}

export interface CommunityRouteResponse {
  communityRouteId: string;
  title: string;
  description?: string;
  author?: UserResponse;
  routeId?: string;
  polyline?: Coordinate[];
  distanceMeters: number;
  totalTimeSeconds: number;
  imageUrl?: string;
  likeCount: number;
  liked: boolean;
  createdAt?: string;
}

export interface PageResponse<T> {
  totalElements: number;
  totalPages: number;
  size: number;
  content: T[];
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
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
  return requestJson<ApiResponse<UserResponse>>('/api/v1/users/me', accessToken, {
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
  return requestJson<ApiResponse<PageResponse<RecordDetailResponse>>>(
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
  return requestJson<ApiResponse<PageResponse<CommunityRouteResponse>>>(
    `/api/v1/users/me/shared-routes?${pageQuery(params)}`,
    accessToken,
  );
}

export function getLikedRoutes(accessToken: string | undefined, params?: PageParams) {
  return requestJson<ApiResponse<PageResponse<CommunityRouteResponse>>>(
    `/api/v1/users/me/liked-routes?${pageQuery(params)}`,
    accessToken,
  );
}
