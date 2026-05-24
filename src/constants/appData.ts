import type {Activity, SavedRun} from '../types/app';

export const ACTIVITY_PROFILES: Record<Activity, string> = {
  Running: 'foot',
  Walking: 'foot',
  Cycling: 'bike',
};

export const PRESET_SHAPES = [
  {key: 'star', label: '별', hint: '랜드마크형'},
  {key: 'heart', label: '하트', hint: '공유 인기'},
  {key: 'circle', label: '원', hint: '초보 추천'},
  {key: 'dog', label: '강아지', hint: '챌린지'},
  {key: 'cat', label: '고양이', hint: '챌린지'},
] as const;

export const COMMUNITY_RUNS: SavedRun[] = [
  {id: 'c1', shape: '별', distance: '5.2 km', pace: "5'40\"", matchPct: 94, shared: true},
  {id: 'c2', shape: '하트', distance: '3.8 km', pace: "6'10\"", matchPct: 91, shared: true},
  {id: 'c3', shape: '고양이', distance: '7.1 km', pace: "5'55\"", matchPct: 88, shared: true},
];

export const INITIAL_RUNS: SavedRun[] = [
  {id: 'r1', shape: '번개', distance: '4.9 km', pace: "5'48\"", matchPct: 92, shared: false},
  {id: 'r2', shape: '하트', distance: '3.2 km', pace: "6'02\"", matchPct: 96, shared: true},
];

export const ROUTE_IMAGES = {
  seoulForest:
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80',
  hangang:
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=700&q=80',
  cityPark:
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=80',
  lake:
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=700&q=80',
};
