import {API_BASE_URL} from '../config';

// ── Request ──────────────────────────────────────────────────────────────────

export interface GenerateRouteRequest {
  requestText: string;
  shapeType: string;      // e.g. "HEART", "STAR", "DOG", "CAT", "CIRCLE"
  activityType: string;   // "RUNNING" | "WALKING" | "CYCLING"
  targetDistanceKm: number;
  startPoint: {lat: number; lng: number};
  preferences: {avoidMainRoad: boolean; preferPark: boolean};
}

// ── Response ─────────────────────────────────────────────────────────────────

export interface GenerateRouteResponse {
  success: boolean;
  message: string;
  data: {taskId: string; message: string};
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export type RouteStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface RouteStatusData {
  status: RouteStatus;
  routeId?: string;
  routePoints?: RoutePoint[];
  totalDistanceMeters?: number;
  estimatedDurationSeconds?: number;
  shapeMatchScore?: number;
  errorMessage?: string;
}

export interface RouteStatusResponse {
  success: boolean;
  message: string;
  data: RouteStatusData;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function postGenerateRoute(
  req: GenerateRouteRequest,
): Promise<GenerateRouteResponse> {
  console.log('[Route Generate] 요청 데이터:', JSON.stringify(req, null, 2));
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/routes/generate`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(req),
    });
  } catch (networkErr: any) {
    throw new Error(`서버 연결 실패 (${API_BASE_URL})\n${networkErr.message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body || '서버 오류'}`);
  }
  return res.json();
}

export async function fetchRouteStatus(
  taskId: string,
): Promise<RouteStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/routes/status/${taskId}`);
  if (!res.ok) {
    throw new Error(`상태 조회 실패: HTTP ${res.status}`);
  }
  return res.json();
}
