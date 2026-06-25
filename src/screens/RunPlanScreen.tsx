import React from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type PanResponderInstance,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {LocateFixed} from 'lucide-react-native';
import {RouteReadyCard, ToggleRow} from '../components/AppChrome';
import {ShapePresetIcon} from '../components/ShapePresetIcon';
import {ACTIVITY_PROFILES, PRESET_SHAPES} from '../constants/appData';
import {styles} from '../styles/appStyles';
import {BLUE, GREEN} from '../styles/theme';
import type {Activity, Preferences, RouteStats} from '../types/app';

export function RunPlanScreen({
  sheetPanResponder,
  activity,
  preferences,
  shapePrompt,
  selectedShape,
  distance,
  targetPace,
  startCoord,
  routeStats,
  isGenerating,
  mapReady,
  routeStatusMessage,
  sheetScrollBottomInset,
  onGoHome,
  onChangeShapePrompt,
  onSelectShape,
  onChangeDistance,
  onChangeTargetPace,
  onChangeActivity,
  onChangePreferences,
  onGetLocation,
  onRegenerate,
  onGenerate,
  onStartRun,
}: {
  sheetPanResponder: PanResponderInstance;
  activity: Activity;
  preferences: Preferences;
  shapePrompt: string;
  selectedShape: string;
  distance: number;
  targetPace: number;
  startCoord: {lat: number; lng: number};
  routeStats: RouteStats | null;
  isGenerating: boolean;
  mapReady: boolean;
  routeStatusMessage: string;
  sheetScrollBottomInset: number;
  onGoHome: () => void;
  onChangeShapePrompt: (text: string) => void;
  onSelectShape: (shape: (typeof PRESET_SHAPES)[number]) => void;
  onChangeDistance: (distance: number) => void;
  onChangeTargetPace: (pace: number) => void;
  onChangeActivity: (activity: Activity) => void;
  onChangePreferences: (updater: (prev: Preferences) => Preferences) => void;
  onGetLocation: () => void;
  onRegenerate: () => void;
  onGenerate: () => void;
  onStartRun: () => void;
}) {
  return (
    <View style={styles.navigationSheetHost}>
      <View style={styles.runBottomSheet}>
        <View style={styles.sheetDragHandleArea} {...sheetPanResponder.panHandlers}>
          <View style={styles.sheetDragHandle} />
        </View>

        <ScrollView
          style={styles.sheetScrollBody}
          contentContainerStyle={[
            styles.sheetScrollContent,
            {paddingBottom: sheetScrollBottomInset},
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.sectionHeader}>
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sectionTitle}>AI 루트 생성</Text>
              <TouchableOpacity style={styles.sheetHeaderButton} onPress={onGoHome}>
                <Text style={styles.sheetHeaderButtonText}>홈</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionMeta}>모양, 거리, 페이스를 한 번에 설정</Text>
          </View>

          <View style={styles.runSetupCard}>
          <View style={styles.runSetupHeader}>
            <View>
              <Text style={styles.runSetupKicker}>현재 설정</Text>
              <Text style={styles.runSetupTitle}>
                {shapePrompt || '원하는 모양'} · {distance.toFixed(1)} km
              </Text>
            </View>
            <View style={styles.runSetupBadge}>
              <Text style={styles.runSetupBadgeText}>{activity}</Text>
            </View>
          </View>
          <View style={styles.runSetupGrid}>
            <View style={styles.runSetupMetric}>
              <Text style={styles.runSetupMetricLabel}>목표 페이스</Text>
              <Text style={styles.runSetupMetricValue}>
                {Math.floor(targetPace)}'
                {Math.round((targetPace % 1) * 60).toString().padStart(2, '0')}"
              </Text>
            </View>
            <View style={styles.runSetupMetric}>
              <Text style={styles.runSetupMetricLabel}>음성 안내</Text>
              <Text style={styles.runSetupMetricValue}>{preferences.voiceCoach ? 'ON' : 'OFF'}</Text>
            </View>
            <View style={styles.runSetupMetric}>
              <Text style={styles.runSetupMetricLabel}>EDM 조절</Text>
              <Text style={styles.runSetupMetricValue}>
                {preferences.adaptiveMusic ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.inputBlock}>
          <Text style={styles.inputLabel}>원하는 모양</Text>
          <TextInput
            value={shapePrompt}
            onChangeText={onChangeShapePrompt}
            placeholder="예: 별, 번개, 토끼, ART RUN"
            placeholderTextColor="#9ca3af"
            style={styles.textInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {PRESET_SHAPES.map(item => {
            const active = item.key === selectedShape && shapePrompt === item.label;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.shapeChip, active && styles.shapeChipActive]}
                onPress={() => onSelectShape(item)}
                activeOpacity={0.78}>
                <View style={[styles.shapeIconBox, active && styles.shapeIconBoxActive]}>
                  <ShapePresetIcon name={item.icon} active={active} />
                </View>
                <View style={styles.shapeChipCopy}>
                  <Text style={[styles.shapeChipText, active && styles.shapeChipTextActive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.shapeChipHint, active && styles.shapeChipTextActive]}>
                    {item.hint}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.gridTwo}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>목표 거리</Text>
            <Text style={styles.metricValue}>{distance.toFixed(1)} km</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>목표 페이스</Text>
            <Text style={styles.metricValue}>
              {Math.floor(targetPace)}'
              {Math.round((targetPace % 1) * 60).toString().padStart(2, '0')}"
            </Text>
          </View>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={20}
          step={0.5}
          value={distance}
          onValueChange={onChangeDistance}
          minimumTrackTintColor={GREEN}
          maximumTrackTintColor="#d1d5db"
          thumbTintColor={GREEN}
        />
        <Slider
          style={styles.slider}
          minimumValue={4}
          maximumValue={8}
          step={0.05}
          value={targetPace}
          onValueChange={onChangeTargetPace}
          minimumTrackTintColor={BLUE}
          maximumTrackTintColor="#d1d5db"
          thumbTintColor={BLUE}
        />

        <View style={styles.segmented}>
          {(Object.keys(ACTIVITY_PROFILES) as Activity[]).map(item => (
            <TouchableOpacity
              key={item}
              style={[styles.segment, activity === item && styles.segmentActive]}
              onPress={() => onChangeActivity(item)}
              activeOpacity={0.75}>
              <Text style={[styles.segmentText, activity === item && styles.segmentTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.optionList}>
          <ToggleRow
            label="대로 회피"
            value={preferences.avoidMainRoad}
            onValueChange={value => onChangePreferences(prev => ({...prev, avoidMainRoad: value}))}
          />
          <ToggleRow
            label="공원길 선호"
            value={preferences.preferPark}
            onValueChange={value => onChangePreferences(prev => ({...prev, preferPark: value}))}
          />
          <ToggleRow
            label="AI EDM 페이스 조절"
            value={preferences.adaptiveMusic}
            onValueChange={value => onChangePreferences(prev => ({...prev, adaptiveMusic: value}))}
          />
          <ToggleRow
            label="실시간 음성 안내"
            value={preferences.voiceCoach}
            onValueChange={value => onChangePreferences(prev => ({...prev, voiceCoach: value}))}
          />
        </View>

        <TouchableOpacity style={styles.locationButton} onPress={onGetLocation}>
          <View style={styles.locationIconBox}>
            <LocateFixed size={22} color="#38bdf8" strokeWidth={2.5} />
          </View>
          <View style={styles.locationTextBox}>
            <Text style={styles.locationTitle}>출발 지점</Text>
            <Text style={styles.locationSub}>
              {startCoord.lat.toFixed(4)}, {startCoord.lng.toFixed(4)}
            </Text>
          </View>
        </TouchableOpacity>

        {(isGenerating || routeStats) && (
          <View style={styles.routeStatusBox}>
            <Text style={styles.routeStatusTitle}>
              {isGenerating ? 'Route API 처리 중' : 'Route API 연결 완료'}
            </Text>
            <Text style={styles.routeStatusText}>{routeStatusMessage}</Text>
          </View>
        )}

        {routeStats && <RouteReadyCard stats={routeStats} />}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, (!routeStats || isGenerating) && styles.buttonDisabled]}
            onPress={onRegenerate}
            disabled={!routeStats || isGenerating}
            activeOpacity={0.84}>
            <Text style={styles.secondaryButtonText}>재생성</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, (!mapReady || isGenerating) && styles.buttonDisabled]}
            onPress={routeStats ? onStartRun : onGenerate}
            disabled={!mapReady || isGenerating}
            activeOpacity={0.86}>
            <Text style={styles.primaryButtonText}>
              {isGenerating ? '생성 중' : routeStats ? '러닝 시작' : '경로 생성'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </View>
    </View>
  );
}
