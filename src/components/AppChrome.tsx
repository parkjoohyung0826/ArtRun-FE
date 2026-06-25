import React from 'react';
import {Switch, Text, TouchableOpacity, View} from 'react-native';
import {House, Map, Route, UserRound} from 'lucide-react-native';
import {styles} from '../styles/appStyles';
import {GREEN, TEXT_MUTED} from '../styles/theme';
import type {RouteStats, SavedRun} from '../types/app';

type FooterIconKey = 'home' | 'run' | 'community' | 'profile';

const FOOTER_ICONS = {
  home: House,
  run: Route,
  community: Map,
  profile: UserRound,
};

export function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{false: '#d1d5db', true: '#a7f3d0'}}
        thumbColor={value ? GREEN : '#f9fafb'}
      />
    </View>
  );
}

export function RouteReadyCard({stats}: {stats: RouteStats}) {
  const pedestrianRatio =
    typeof stats.pedestrianRoadRatio === 'number'
      ? Math.round(
          stats.pedestrianRoadRatio <= 1
            ? stats.pedestrianRoadRatio * 100
            : stats.pedestrianRoadRatio,
        )
      : null;

  return (
    <View style={styles.readyCard}>
      <View>
        <Text style={styles.readyTitle}>루트 준비 완료</Text>
        <Text style={styles.readySub}>{stats.shapeLabel} 형태로 도로를 맞췄습니다.</Text>
      </View>
      <View style={styles.readyStats}>
        <Text style={styles.readyStat}>{stats.distKm} km</Text>
        <Text style={styles.readyStat}>{stats.duration}</Text>
        <Text style={styles.readyStat}>{stats.matchPct}%</Text>
        {pedestrianRatio !== null && <Text style={styles.readyStat}>보행로 {pedestrianRatio}%</Text>}
      </View>
    </View>
  );
}

export function RunCard({
  run,
  cta,
  onPress,
}: {
  run: SavedRun;
  cta: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.runCard}>
      <View style={styles.runBadge}>
        <Text style={styles.runBadgeText}>{run.shape.slice(0, 1)}</Text>
      </View>
      <View style={styles.runCardBody}>
        <Text style={styles.runCardTitle}>{run.shape} 루트</Text>
        <Text style={styles.runCardSub}>
          {run.distance} · {run.pace} · 일치율 {run.matchPct}%
        </Text>
      </View>
      <TouchableOpacity style={styles.smallButton} onPress={onPress} disabled={!onPress}>
        <Text style={styles.smallButtonText}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function FooterItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: FooterIconKey;
  active: boolean;
  onPress: () => void;
}) {
  const Icon = FOOTER_ICONS[icon];
  const color = active ? '#38bdf8' : TEXT_MUTED;

  return (
    <TouchableOpacity
      style={[styles.footerItem, active && styles.footerItemActive]}
      onPress={onPress}
      activeOpacity={0.75}>
      <Icon size={22} color={color} strokeWidth={active ? 2.8 : 2.2} />
      <Text style={[styles.footerLabel, active && styles.footerActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
