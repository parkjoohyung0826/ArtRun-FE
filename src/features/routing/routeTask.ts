import {getRoute, getRouteStatus} from '../../api/routeApi';
import type {RouteStats} from '../../types/app';
import {shapeNameFromKey} from '../../utils/routeFormat';
import {ROUTE_STATUS_DONE, ROUTE_STATUS_FAILED, ROUTE_STATUS_LABELS} from './routeConstants';
import {routeStatsFromCandidate, routeStatsFromDetail} from './routeMappers';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms));
const ROUTE_TASK_MAX_ATTEMPTS = 120;
const ROUTE_TASK_INITIAL_DELAY_MS = 700;
const ROUTE_TASK_POLL_INTERVAL_MS = 1500;

interface WaitForRouteTaskParams {
  accessToken?: string;
  fallbackDistanceKm: number;
  selectedShape: string;
  shapePrompt: string;
  taskId: string;
  onStatus?: (message: string) => void;
}

export async function waitForRouteTask({
  accessToken,
  fallbackDistanceKm,
  selectedShape,
  shapePrompt,
  taskId,
  onStatus,
}: WaitForRouteTaskParams): Promise<RouteStats> {
  for (let attempt = 0; attempt < ROUTE_TASK_MAX_ATTEMPTS; attempt += 1) {
    await sleep(
      attempt === 0 ? ROUTE_TASK_INITIAL_DELAY_MS : ROUTE_TASK_POLL_INTERVAL_MS,
    );
    const statusResponse = await getRouteStatus(taskId, accessToken);
    const status = statusResponse.data.status?.toUpperCase?.() || '';
    const statusMessage =
      statusResponse.message || ROUTE_STATUS_LABELS[status] || `경로 생성 중입니다. 상태: ${status || 'PROCESSING'}`;

    if (ROUTE_STATUS_FAILED.has(status)) {
      throw new Error(statusResponse.data.errorMessage || '경로 생성에 실패했습니다.');
    }

    if (ROUTE_STATUS_DONE.has(status)) {
      const candidate = statusResponse.data.candidateRoutes?.[0];
      if (!candidate?.routeId) {
        throw new Error('생성된 후보 경로가 없습니다.');
      }

      const shapeLabel = shapeNameFromKey(selectedShape, shapePrompt);
      let nextStats = routeStatsFromCandidate(candidate, shapeLabel, fallbackDistanceKm);

      try {
        const detailResponse = await getRoute(candidate.routeId, accessToken);
        nextStats = routeStatsFromDetail(detailResponse.data, shapeLabel);
      } catch (error) {
        const message = error instanceof Error ? error.message : '루트 상세 조회 실패';
        onStatus?.(`상세 조회는 실패했지만 후보 경로로 표시합니다. ${message}`);
      }

      if (!nextStats.routePoints.length) {
        throw new Error('표시할 경로 좌표가 없습니다.');
      }

      return nextStats;
    }

    onStatus?.(statusMessage);
  }

  throw new Error('경로 생성 시간이 초과되었습니다.');
}
