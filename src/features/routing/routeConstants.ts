import type {Activity} from '../../types/app';

export const ROUTE_STATUS_DONE = new Set(['COMPLETED', 'COMPLETE', 'DONE', 'SUCCESS']);
export const ROUTE_STATUS_FAILED = new Set(['FAILED', 'FAIL', 'ERROR']);

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
