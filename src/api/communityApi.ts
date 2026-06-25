import {API_BASE_URL} from '../config';
import type {Coordinate} from '../types/app';
import type {ApiResponse} from './authApi';
import type {PageParams} from './userApi';

interface CreatorResponse {
  userId: string;
  nickname: string;
  profileImageUrl?: string;
}

interface RouteDetailDto {
  routeId?: string;
  routeName?: string;
  startPoint?: Coordinate;
  endPoint?: Coordinate;
  polyline?: Array<Coordinate & {order?: number}>;
}

export interface CommunityRouteResponse {
  communityRouteId: string;
  recordId?: string;
  title: string;
  description?: string;
  creator?: CreatorResponse;
  routeId?: string;
  route?: RouteDetailDto;
  shapeType?: string;
  activityType?: string;
  distanceKm: number;
  averagePaceText?: string;
  totalTimeSeconds: number;
  averageBpm?: number;
  matchRate?: number;
  locationName?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  likeCount: number;
  liked: boolean;
  createdAt?: string;
}

export interface RegisterCommunityRouteRequest {
  recordId: string;
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: string;
}

export interface PrepareRunRequest {
  currentPoint: Coordinate & {accuracyMeters?: number; timestamp?: number};
}

export interface PrepareRunResponse {
  communityRouteId: string;
  routeId: string;
  startDistanceMeters: number;
  runnable: boolean;
  message?: string;
}

export interface CommunityRouteListResponse {
  totalCount: number;
  routes: CommunityRouteResponse[];
}

async function requestJson<T>(
  path: string,
  accessToken?: string,
  init?: RequestInit,
): Promise<T> {
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

export interface CommunityRouteQuery extends PageParams {
  keyword?: string;
  filter?: 'ALL' | 'POPULAR' | 'NEARBY' | string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

function routeQuery(params: CommunityRouteQuery = {}) {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 20));
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.filter) query.set('filter', params.filter);
  if (params.lat !== undefined) query.set('lat', String(params.lat));
  if (params.lng !== undefined) query.set('lng', String(params.lng));
  if (params.radiusKm !== undefined) query.set('radiusKm', String(params.radiusKm));
  const sort = params.sort?.[0] || 'RECENT_DESC';
  query.set('sort', sort);
  return query.toString();
}

export function getCommunityRoutes(accessToken?: string, params?: CommunityRouteQuery) {
  return requestJson<ApiResponse<CommunityRouteListResponse>>(
    `/api/v1/community/routes?${routeQuery(params)}`,
    accessToken,
  );
}

export function getCommunityRoute(communityRouteId: string, accessToken?: string) {
  return requestJson<ApiResponse<CommunityRouteResponse>>(
    `/api/v1/community/routes/${communityRouteId}`,
    accessToken,
  );
}

export function registerCommunityRoute(
  accessToken: string | undefined,
  request: RegisterCommunityRouteRequest,
) {
  return requestJson<ApiResponse<CommunityRouteResponse | {
    communityRouteId: string;
    recordId?: string;
    routeId?: string;
    title?: string;
    visibility?: string;
    createdAt?: string;
  }>>('/api/v1/community/routes', accessToken, {
      method: 'POST',
      body: JSON.stringify(request),
    });
}

export function deleteCommunityRoute(accessToken: string | undefined, communityRouteId: string) {
  return requestJson<ApiResponse<null>>(
    `/api/v1/community/routes/${communityRouteId}`,
    accessToken,
    {method: 'DELETE'},
  );
}

export function likeCommunityRoute(accessToken: string | undefined, communityRouteId: string) {
  return requestJson<ApiResponse<{communityRouteId: string; liked: boolean; likeCount: number}>>(
    `/api/v1/community/routes/${communityRouteId}/like`,
    accessToken,
    {method: 'POST'},
  );
}

export function unlikeCommunityRoute(accessToken: string | undefined, communityRouteId: string) {
  return requestJson<ApiResponse<{communityRouteId: string; liked: boolean; likeCount: number}>>(
    `/api/v1/community/routes/${communityRouteId}/like`,
    accessToken,
    {method: 'DELETE'},
  );
}

export function prepareCommunityRun(
  accessToken: string | undefined,
  communityRouteId: string,
  request: PrepareRunRequest,
) {
  return requestJson<ApiResponse<PrepareRunResponse>>(
    `/api/v1/community/routes/${communityRouteId}/prepare-run`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
  );
}
