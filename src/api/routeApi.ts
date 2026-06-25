import {API_BASE_URL} from '../config';
import type {Coordinate} from '../types/app';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface GenerateRouteRequest {
  requestText: string;
  shapeType: string;
  activityType: string;
  targetDistanceKm: number;
  startPoint: Coordinate;
  preferences: {
    avoidMainRoad: boolean;
    preferPark: boolean;
  };
}

export interface GenerateRouteData {
  taskId: string;
  message: string;
}

export interface CandidateRoute {
  routeId: string;
  distance: number;
  similarityScore: number;
  pedestrianRoadRatio: number;
  polyline: Coordinate[];
}

export interface RouteStatusData {
  status: string;
  errorMessage?: string;
  candidateRoutes?: CandidateRoute[];
}

export interface RouteDetailData {
  routeId: string;
  distanceMeters: number;
  similarityScore: number;
  pedestrianRoadRatio: number;
  polyline: Coordinate[];
  checkpoints: Coordinate[];
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
    throw new Error(body?.message || `HTTP ${response.status}: ${bodyText || 'API 요청 실패'}`);
  }

  return body;
}

export function generateRoute(request: GenerateRouteRequest, accessToken?: string) {
  return requestJson<ApiResponse<GenerateRouteData>>('/api/v1/routes/generate', accessToken, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getRouteStatus(taskId: string, accessToken?: string) {
  return requestJson<ApiResponse<RouteStatusData>>(
    `/api/v1/routes/status/${taskId}`,
    accessToken,
  );
}

export function getRoute(routeId: string, accessToken?: string) {
  return requestJson<ApiResponse<RouteDetailData>>(
    `/api/v1/routes/${routeId}`,
    accessToken,
  );
}

export function regenerateRoute(routeId: string, accessToken?: string) {
  return requestJson<ApiResponse<GenerateRouteData>>(
    `/api/v1/routes/${routeId}/regenerate`,
    accessToken,
    {
      method: 'POST',
    },
  );
}
