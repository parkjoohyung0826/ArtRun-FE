export type TabKey = 'home' | 'run' | 'community' | 'profile';
export type Activity = 'Running' | 'Walking' | 'Cycling';
export type RoutePhase = 'idle' | 'ready' | 'running' | 'complete';
export type AuthMode = 'login' | 'signup';
export type CommunityFilter = '전체' | '인기' | '저장' | '근처';

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Preferences {
  avoidMainRoad: boolean;
  preferPark: boolean;
  adaptiveMusic: boolean;
  voiceCoach: boolean;
}

export interface RouteStats {
  distKm: string;
  duration: string;
  matchPct: number;
  shapeLabel: string;
  routePoints: Coordinate[];
}

export interface SavedRun {
  id: string;
  shape: string;
  distance: string;
  pace: string;
  matchPct: number;
  shared: boolean;
  author?: string;
  location?: string;
  likes?: number;
  saved?: boolean;
  description?: string;
  tags?: string[];
  startCoord?: Coordinate;
}
