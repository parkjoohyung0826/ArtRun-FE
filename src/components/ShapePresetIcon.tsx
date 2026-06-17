import React from 'react';
import {Cat, Circle, Dog, Heart, Star} from 'lucide-react-native';
import {PRESET_SHAPES} from '../constants/appData';

type ShapeIconKey = (typeof PRESET_SHAPES)[number]['icon'];

const SHAPE_ICONS: Record<ShapeIconKey, React.ComponentType<any>> = {
  star: Star,
  heart: Heart,
  circle: Circle,
  dog: Dog,
  cat: Cat,
};

export function ShapePresetIcon({name, active}: {name: ShapeIconKey; active: boolean}) {
  const Icon = SHAPE_ICONS[name];

  return (
    <Icon
      size={24}
      color={active ? '#2563eb' : '#38bdf8'}
      strokeWidth={active ? 2.8 : 2.3}
    />
  );
}
