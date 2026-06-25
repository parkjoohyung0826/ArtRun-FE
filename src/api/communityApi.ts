import {API_BASE_URL} from '../config';
import type {Coordinate} from '../types/app';
import type {ApiResponse, UserResponse} from './authApi';
import type {PageParams, PageResponse} from './userApi';

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

export interface RegisterCommunityRouteRequest {
  recordId: string;
  title?: string;
  description?: string;
}

export interface PrepareRunRequest extends Coordinate {}

export interface PrepareRunResponse {
  routeId: string;
  distanceToStart: number;
  canRun: boolean;
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

function pageQuery(params: PageParams = {}) {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 20));
  params.sort?.forEach(sort => query.append('sort', sort));
  return query.toString();
}

export function getCommunityRoutes(accessToken?: string, params?: PageParams) {
  return requestJson<ApiResponse<PageResponse<CommunityRouteResponse>>>(
    `/api/v1/community/routes?${pageQuery(params)}`,
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
  return requestJson<ApiResponse<CommunityRouteResponse>>('/api/v1/community/routes', accessToken, {
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
  return requestJson<ApiResponse<null>>(
    `/api/v1/community/routes/${communityRouteId}/like`,
    accessToken,
    {method: 'POST'},
  );
}

export function unlikeCommunityRoute(accessToken: string | undefined, communityRouteId: string) {
  return requestJson<ApiResponse<null>>(
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
