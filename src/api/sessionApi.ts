import {API_BASE_URL} from '../config';
import type {Coordinate} from '../types/app';
import type {ApiResponse} from './authApi';

export interface SessionResponse {
  sessionId: string;
  routeId: string;
  status: string;
  message?: string;
}

export interface SessionDetailResponse {
  sessionId: string;
  routeId: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface TrackLocationRequest extends Coordinate {
  timestamp: number;
  currentSpeed: number;
}

export interface TrackLocationResponse {
  onRoute: boolean;
  distanceRemaining: number;
  completionRate: number;
  warningMessage?: string;
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

export function startSession(accessToken: string | undefined, routeId: string) {
  return requestJson<ApiResponse<SessionResponse>>('/api/v1/session/start', accessToken, {
    method: 'POST',
    body: JSON.stringify({routeId}),
  });
}

export function getSession(accessToken: string | undefined, sessionId: string) {
  return requestJson<ApiResponse<SessionDetailResponse>>(
    `/api/v1/session/${sessionId}`,
    accessToken,
  );
}

export function trackLocation(
  accessToken: string | undefined,
  sessionId: string,
  request: TrackLocationRequest,
) {
  return requestJson<ApiResponse<TrackLocationResponse>>(
    `/api/v1/session/${sessionId}/track`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
  );
}

export function pauseSession(accessToken: string | undefined, sessionId: string) {
  return requestJson<ApiResponse<null>>(`/api/v1/session/${sessionId}/pause`, accessToken, {
    method: 'POST',
  });
}

export function resumeSession(accessToken: string | undefined, sessionId: string) {
  return requestJson<ApiResponse<null>>(`/api/v1/session/${sessionId}/resume`, accessToken, {
    method: 'POST',
  });
}

export function finishSession(accessToken: string | undefined, sessionId: string) {
  return requestJson<ApiResponse<SessionResponse>>(
    `/api/v1/session/${sessionId}/finish`,
    accessToken,
    {method: 'POST'},
  );
}

export function cancelSession(accessToken: string | undefined, sessionId: string) {
  return requestJson<ApiResponse<null>>(`/api/v1/session/${sessionId}/cancel`, accessToken, {
    method: 'POST',
  });
}
