import type {Activity} from '../../types/app';

export const ROUTE_STATUS_DONE = new Set(['COMPLETED', 'COMPLETE', 'DONE', 'SUCCESS', 'FINISHED']);
export const ROUTE_STATUS_FAILED = new Set(['FAILED', 'FAIL', 'ERROR']);

export const ROUTE_STATUS_LABELS: Record<string, string> = {
  PENDING: '경로 생성 대기 중입니다.',
  PROCESSING: 'AI가 도로망을 분석하고 있습니다.',
  RUNNING: 'AI가 도로망을 분석하고 있습니다.',
  IN_PROGRESS: '후보 경로를 계산하고 있습니다.',
  COMPLETED: '경로 생성이 완료되었습니다.',
  COMPLETE: '경로 생성이 완료되었습니다.',
  DONE: '경로 생성이 완료되었습니다.',
  SUCCESS: '경로 생성이 완료되었습니다.',
  FINISHED: '경로 생성이 완료되었습니다.',
};

export const SHAPE_API_TYPES: Record<string, string> = {
  star: 'STAR',
  heart: 'HEART',
  circle: 'CIRCLE',
  dog: 'DOG',
  cat: 'CAT',
};

export const ACTIVITY_API_TYPES: Record<Activity, string> = {
  Running: 'RUNNING',
  Walking: 'WALKING',
  Cycling: 'CYCLING',
};
