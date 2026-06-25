import {API_BASE_URL} from '../config';
import type {Coordinate} from '../types/app';
import type {ApiResponse} from './authApi';
import type {RecordDetailResponse} from './userApi';

export interface SaveRecordRequest {
  sessionId: string;
  routeId?: string;
  gpsPoints: Array<Coordinate & {timestamp: number}>;
  totalTimeSeconds: number;
}

export interface RecordResponse {
  recordId: string;
  totalDistanceMeters: number;
  totalTimeSeconds: number;
  averageSpeed: number;
  imageUrl?: string;
}

export type ShareCardResponse = Record<string, string>;

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

export function saveRecord(accessToken: string | undefined, request: SaveRecordRequest) {
  return requestJson<ApiResponse<RecordResponse>>('/api/v1/records/save', accessToken, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getRecord(accessToken: string | undefined, recordId: string) {
  return requestJson<ApiResponse<RecordDetailResponse>>(
    `/api/v1/records/${recordId}`,
    accessToken,
  );
}

export function deleteRecord(accessToken: string | undefined, recordId: string) {
  return requestJson<ApiResponse<null>>(`/api/v1/records/${recordId}`, accessToken, {
    method: 'DELETE',
  });
}

export function regenerateShareCard(accessToken: string | undefined, recordId: string) {
  return requestJson<ApiResponse<ShareCardResponse>>(
    `/api/v1/records/${recordId}/share-card`,
    accessToken,
    {method: 'POST'},
  );
}
