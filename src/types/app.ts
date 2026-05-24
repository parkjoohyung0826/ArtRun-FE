export type TabKey = 'home' | 'run' | 'community' | 'profile';
export type Activity = 'Running' | 'Walking' | 'Cycling';
export type RoutePhase = 'idle' | 'ready' | 'running' | 'complete';

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
}

export interface SavedRun {
  id: string;
  shape: string;
  distance: string;
  pace: string;
  matchPct: number;
  shared: boolean;
}
