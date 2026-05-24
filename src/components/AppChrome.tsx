import React from 'react';
import {Switch, Text, TouchableOpacity, View} from 'react-native';
import {styles} from '../styles/appStyles';
import {GREEN} from '../styles/theme';
import type {RouteStats, SavedRun} from '../types/app';

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
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.footerItem, active && styles.footerItemActive]}
      onPress={onPress}
      activeOpacity={0.75}>
      <Text style={[styles.footerIcon, active && styles.footerActive]}>{icon}</Text>
      <Text style={[styles.footerLabel, active && styles.footerActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
