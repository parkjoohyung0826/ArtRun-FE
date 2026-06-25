import {API_BASE_URL} from '../config';
import type {Coordinate} from '../types/app';
import type {ApiResponse} from './authApi';

export interface SessionResponse {
  sessionId: string;
  routeId: string;
  status: string;
  startAllowed?: boolean;
  startDistanceMeters?: number;
  message?: string;
  startedAt?: string;
}

export interface SessionDetailResponse {
  sessionId: string;
  routeId: string;
  status: string;
  startedAt?: string;
  pausedAt?: string;
  lastTrackedAt?: string;
  finishedAt?: string;
  completionRate?: number;
  distanceTraveledMeters?: number;
  distanceRemainingMeters?: number;
}

export interface CurrentPointRequest extends Coordinate {
  accuracyMeters?: number;
  timestamp?: number;
}

export interface StartSessionRequest {
  routeId: string;
  currentPoint: CurrentPointRequest;
  targetPaceSecPerKm?: number;
  voiceGuideEnabled?: boolean;
  edmControlEnabled?: boolean;
}

export interface TrackLocationRequest extends Coordinate {
  timestamp?: number;
  currentSpeed?: number;
  accuracyMeters?: number;
  heading?: number;
  altitude?: number;
}

export interface TrackLocationResponse {
  sessionId?: string;
  routeId?: string;
  status?: string;
  onRoute: boolean;
  completionRate: number;
  distanceTraveledMeters?: number;
  distanceRemainingMeters?: number;
  offRouteDistanceMeters?: number;
  nearestRoutePointIndex?: number;
  warningMessage?: string;
  voiceCue?: {message?: string; type?: string};
  paceFeedback?: {
    currentPaceSecPerKm?: number;
    targetPaceSecPerKm?: number;
    message?: string;
  };
  edmControl?: {
    currentBpm?: number;
    targetBpm?: number;
    intensity?: string;
    message?: string;
  };
  currentInstruction?: {message?: string; distanceMeters?: number};
  nextInstruction?: {message?: string; distanceMeters?: number};
  passedCheckpoint?: {name?: string; message?: string};
}

export interface ResumeSessionRequest {
  currentPoint: CurrentPointRequest;
}

export interface FinishSessionRequest {
  currentPoint?: CurrentPointRequest;
  totalTimeSeconds?: number;
  gpsPoints?: Array<Coordinate & {timestamp?: number}>;
}

export interface CancelSessionRequest {
  reason?: string;
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

export function startSession(
  accessToken: string | undefined,
  routeId: string,
  request: Omit<StartSessionRequest, 'routeId'>,
) {
  return requestJson<ApiResponse<SessionResponse>>('/api/v1/session/start', accessToken, {
    method: 'POST',
    body: JSON.stringify({routeId, ...request}),
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
  return requestJson<ApiResponse<{sessionId: string; status: string; pausedAt?: string}>>(
    `/api/v1/session/${sessionId}/pause`,
    accessToken,
    {method: 'POST'},
  );
}

export function resumeSession(
  accessToken: string | undefined,
  sessionId: string,
  request: ResumeSessionRequest,
) {
  return requestJson<ApiResponse<{
    sessionId: string;
    status: string;
    resumedAt?: string;
    onRoute?: boolean;
    offRouteDistanceMeters?: number;
  }>>(`/api/v1/session/${sessionId}/resume`, accessToken, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function finishSession(
  accessToken: string | undefined,
  sessionId: string,
  request: FinishSessionRequest = {},
) {
  return requestJson<ApiResponse<SessionResponse & {
    completionRate?: number;
    recordSaveRequired?: boolean;
  }>>(
    `/api/v1/session/${sessionId}/finish`,
    accessToken,
    {method: 'POST', body: JSON.stringify(request)},
  );
}

export function cancelSession(
  accessToken: string | undefined,
  sessionId: string,
  request: CancelSessionRequest = {reason: 'USER_CANCELLED'},
) {
  return requestJson<ApiResponse<{sessionId: string; status: string; canceledAt?: string}>>(
    `/api/v1/session/${sessionId}/cancel`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
  );
}
