export type Point = [number, number]; // [x, y], normalized 0–1, y increases downward

export interface ShapeConfig {
  label: string;
  emoji: string;
  points: Point[];
}

function normalize(pts: Point[]): Point[] {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  return pts.map(([x, y]) => [(x - minX) / span, (y - minY) / span]);
}

function generateHeart(): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 20; i++) {
    const t = (2 * Math.PI * i) / 20;
    const s = Math.sin(t);
    pts.push([
      16 * s * s * s,
      -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
    ]);
  }
  return normalize(pts);
}

function generateStar(): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.42;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return normalize(pts);
}

function generateCircle(): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (2 * Math.PI * i) / 16;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  return normalize(pts);
}

export const SHAPES: Record<string, ShapeConfig> = {
  heart: {
    label: 'Heart',
    emoji: '♥',
    points: generateHeart(),
  },
  star: {
    label: 'Star',
    emoji: '★',
    points: generateStar(),
  },
  dog: {
    label: 'Dog',
    emoji: '🐶',
    // Dog face silhouette: two rectangular ears on top, snout pointing right
    points: [
      [0.14, 0.88], // bottom-left
      [0.14, 0.05], // top-left
      [0.36, 0.05], // left ear top-right
      [0.36, 0.20], // left ear bottom-right
      [0.46, 0.20], // between ears left
      [0.46, 0.10], // between ears top
      [0.68, 0.10], // right ear top-left
      [0.68, 0.20], // right ear bottom-left
      [0.78, 0.20], // top-right of head
      [0.78, 0.38], // right side upper
      [0.96, 0.50], // snout tip (pointing right)
      [0.78, 0.62], // right side lower
      [0.78, 0.88], // bottom-right
    ],
  },
  cat: {
    label: 'Cat',
    emoji: '🐱',
    // Cat face: pointed triangle ears, round head
    points: [
      [0.12, 0.90], // bottom-left
      [0.12, 0.42], // left side
      [0.06, 0.08], // left ear tip
      [0.34, 0.34], // left ear base-right
      [0.50, 0.24], // top-center dip
      [0.66, 0.34], // right ear base-left
      [0.94, 0.08], // right ear tip
      [0.88, 0.42], // right side
      [0.88, 0.90], // bottom-right
    ],
  },
  circle: {
    label: 'Circle',
    emoji: '◯',
    points: generateCircle(),
  },
};
