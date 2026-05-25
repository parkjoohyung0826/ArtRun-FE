import type {Activity, SavedRun} from '../types/app';

export const ACTIVITY_PROFILES: Record<Activity, string> = {
  Running: 'foot',
  Walking: 'foot',
  Cycling: 'bike',
};

export const PRESET_SHAPES = [
  {key: 'star', label: '별', icon: 'star', hint: '랜드마크형'},
  {key: 'heart', label: '하트', icon: 'heart', hint: '공유 인기'},
  {key: 'circle', label: '원', icon: 'circle', hint: '초보 추천'},
  {key: 'dog', label: '강아지', icon: 'dog', hint: '챌린지'},
  {key: 'cat', label: '고양이', icon: 'cat', hint: '챌린지'},
] as const;

export const COMMUNITY_RUNS: SavedRun[] = [
  {
    id: 'c1',
    shape: '별',
    distance: '5.2 km',
    pace: "5'40\"",
    matchPct: 94,
    shared: true,
    author: 'Jin Runner',
    location: '서울숲 · 성수',
    likes: 2400,
    saved: true,
    description: '공원 외곽을 크게 돌고 중앙 산책로를 가로지르는 별 형태 루트입니다.',
    tags: ['공원길', '신호 적음', '야간 가능'],
    startCoord: {lat: 37.5446, lng: 127.0374},
  },
  {
    id: 'c2',
    shape: '하트',
    distance: '3.8 km',
    pace: "6'10\"",
    matchPct: 91,
    shared: true,
    author: 'Mina',
    location: '여의도 한강공원',
    likes: 1800,
    saved: false,
    description: '한강변 직선 구간과 공원 안쪽 회전 구간을 섞은 하트 루트입니다.',
    tags: ['초보 추천', '평지', '뷰 좋음'],
    startCoord: {lat: 37.5268, lng: 126.9342},
  },
  {
    id: 'c3',
    shape: '고양이',
    distance: '7.1 km',
    pace: "5'55\"",
    matchPct: 88,
    shared: true,
    author: 'Sean',
    location: '잠실 · 석촌호수',
    likes: 1300,
    saved: false,
    description: '호수 순환 동선 위에 귀와 꼬리 라인을 더한 챌린지형 루트입니다.',
    tags: ['챌린지', '호수뷰', '중급'],
    startCoord: {lat: 37.5112, lng: 127.0981},
  },
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
