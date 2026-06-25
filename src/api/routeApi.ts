import {API_BASE_URL} from '../config';
import type {Coordinate} from '../types/app';

interface ApiResponse<T> {
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown network error';
    throw new Error(`서버 연결 실패: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${body || 'API 요청 실패'}`);
  }

  return response.json();
}

export function generateRoute(request: GenerateRouteRequest) {
  return requestJson<ApiResponse<GenerateRouteData>>('/api/v1/routes/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getRouteStatus(taskId: string) {
  return requestJson<ApiResponse<RouteStatusData>>(`/api/v1/routes/status/${taskId}`);
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
