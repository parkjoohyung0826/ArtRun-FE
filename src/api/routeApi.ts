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

export interface StartSessionData {
  sessionId: string;
  routeId: string;
  status: string;
  message: string;
}

export interface TrackLocationRequest extends Coordinate {
  timestamp: number;
  currentSpeed: number;
}

export interface TrackLocationData {
  onRoute: boolean;
  distanceRemaining: number;
  completionRate: number;
  warningMessage?: string;
}

export interface SaveRecordRequest {
  sessionId: string;
  routeId: string;
  gpsPoints: Array<Coordinate & {timestamp: number}>;
  totalTimeSeconds: number;
}

export interface SaveRecordData {
  recordId: string;
  totalDistanceMeters: number;
  totalTimeSeconds: number;
  averageSpeed: number;
  imageUrl: string;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  accessToken?: string,
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
  return requestJson<ApiResponse<GenerateRouteData>>('/api/v1/routes/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  }, accessToken);
}

export function getRouteStatus(taskId: string, accessToken?: string) {
  return requestJson<ApiResponse<RouteStatusData>>(
    `/api/v1/routes/status/${taskId}`,
    undefined,
    accessToken,
  );
}

export function getRoute(routeId: string, accessToken?: string) {
  return requestJson<ApiResponse<RouteDetailData>>(
    `/api/v1/routes/${routeId}`,
    undefined,
    accessToken,
  );
}

export function regenerateRoute(routeId: string, accessToken?: string) {
  return requestJson<ApiResponse<GenerateRouteData>>(`/api/v1/routes/${routeId}/regenerate`, {
    method: 'POST',
  }, accessToken);
}

export function startSession(routeId: string) {
  return requestJson<ApiResponse<StartSessionData>>('/api/v1/session/start', {
    method: 'POST',
    body: JSON.stringify({routeId}),
  });
}

export function trackLocation(sessionId: string, request: TrackLocationRequest) {
  return requestJson<ApiResponse<TrackLocationData>>(`/api/v1/session/${sessionId}/track`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function saveRecord(request: SaveRecordRequest) {
  return requestJson<ApiResponse<SaveRecordData>>('/api/v1/records/save', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
