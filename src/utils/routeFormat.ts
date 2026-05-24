import {PRESET_SHAPES} from '../constants/appData';
import {SHAPES} from '../shapes';

export function formatDuration(seconds: number | null | undefined, distanceKm: number) {
  const totalSeconds = seconds || Math.round((distanceKm / 9.5) * 3600);
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
    : `${minutes}분`;
}

export function inferPresetFromPrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes('별') || lower.includes('star')) return 'star';
  if (lower.includes('하트') || lower.includes('heart')) return 'heart';
  if (lower.includes('원') || lower.includes('circle')) return 'circle';
  if (lower.includes('강아지') || lower.includes('dog')) return 'dog';
  if (lower.includes('고양이') || lower.includes('cat')) return 'cat';
  return 'star';
}

export function shapeNameFromKey(key: string, prompt: string) {
  if (prompt.trim()) return prompt.trim();
  const preset = PRESET_SHAPES.find(item => item.key === key);
  return preset?.label || SHAPES[key]?.label || '커스텀';
}
