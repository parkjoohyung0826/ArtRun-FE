import React from 'react';
import {ScrollView, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {Heart, MapPin, Sparkles} from 'lucide-react-native';
import {COMMUNITY_RUNS, PRESET_SHAPES} from '../constants/appData';
import {styles} from '../styles/appStyles';

type PresetShape = (typeof PRESET_SHAPES)[number];

export function HomeScreen({
  shapePrompt,
  distance,
  pendingQuickGenerate,
  onChangeShapePrompt,
  onSelectPresetShape,
  onSelectDistance,
  onQuickGenerate,
  onOpenCommunity,
}: {
  shapePrompt: string;
  distance: number;
  pendingQuickGenerate: boolean;
  onChangeShapePrompt: (text: string) => void;
  onSelectPresetShape: (shape: PresetShape) => void;
  onSelectDistance: (distance: number) => void;
  onQuickGenerate: () => void;
  onOpenCommunity: () => void;
}) {
  return (
    <ScrollView
      style={styles.homeScroll}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.homeHero}>
        <View style={styles.heroShadePanel} />
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroKicker}>빠른 루트 생성</Text>
            <Text style={styles.heroTitle}>
              {shapePrompt || '원하는 모양'} · {distance.toFixed(1)} km
            </Text>
            <Text style={styles.heroReason}>
              모양과 거리만 고르면 실제 Route API로 러닝 코스를 생성합니다.
            </Text>
          </View>
        </View>

        <View style={styles.heroSummaryRow}>
          <View style={styles.heroSummaryItem}>
            <Text style={styles.heroSummaryLabel}>SHAPE</Text>
            <Text style={styles.heroSummaryValue}>{shapePrompt || '입력 전'}</Text>
          </View>
          <View style={styles.heroSummaryDivider} />
          <View style={styles.heroSummaryItem}>
            <Text style={styles.heroSummaryLabel}>DISTANCE</Text>
            <Text style={styles.heroSummaryValue}>{distance.toFixed(1)} km</Text>
          </View>
          <View style={styles.heroSummaryDivider} />
          <View style={styles.heroSummaryItem}>
            <Text style={styles.heroSummaryLabel}>MODE</Text>
            <Text style={styles.heroSummaryValue}>AI 생성</Text>
          </View>
        </View>

        <View style={styles.heroRouteCard}>
          <View style={styles.heroRouteInfo}>
            <View style={styles.quickPromptBox}>
              <TextInput
                value={shapePrompt}
                onChangeText={onChangeShapePrompt}
                placeholder="원하는 모양 입력"
                placeholderTextColor="#64748b"
                style={styles.quickPromptInput}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickWheelContent}>
              {PRESET_SHAPES.map(item => {
                const active = shapePrompt === item.label;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.quickWheelItem, active && styles.quickWheelItemActive]}
                    onPress={() => onSelectPresetShape(item)}
                    activeOpacity={0.78}>
                    <Text style={[styles.quickWheelText, active && styles.quickWheelTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.heroStatRow}>
              {[3, 5, 8].map(km => {
                const active = distance === km;
                return (
                  <TouchableOpacity
                    key={km}
                    style={[styles.quickDistance, active && styles.quickDistanceActive]}
                    onPress={() => onSelectDistance(km)}
                    activeOpacity={0.78}>
                    <Text
                      style={[styles.quickDistanceText, active && styles.quickDistanceTextActive]}>
                      {km} km
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.heroRouteHint}>
              세부 설정은 러닝 준비 화면에서 페이스, 활동 타입, 경로 옵션까지 조정할 수 있습니다.
            </Text>
          </View>
        </View>

        <View style={styles.heroBottomRow}>
          <View>
            <Text style={styles.heroRouteName}>현재 조건으로 바로 생성</Text>
            <Text style={styles.heroRouteMeta}>
              {pendingQuickGenerate ? '지도를 준비하고 있습니다' : '지도 준비 후 자동으로 경로를 생성합니다'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.heroButton, pendingQuickGenerate && styles.buttonDisabled]}
            onPress={onQuickGenerate}
            disabled={pendingQuickGenerate}>
            <Sparkles size={16} color="#fff" strokeWidth={2.5} />
            <Text style={styles.heroButtonText}>
              {pendingQuickGenerate ? '생성 중' : '바로 생성'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeaderInline}>
        <Text style={styles.homeSectionTitle}>커뮤니티 인기</Text>
        <TouchableOpacity onPress={onOpenCommunity}>
          <Text style={styles.homeSectionLink}>전체보기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.popularRouteScroller}>
        {COMMUNITY_RUNS.map((run, index) => (
          <TouchableOpacity
            key={run.id}
            style={styles.popularRouteCard}
            onPress={onOpenCommunity}
            activeOpacity={0.82}>
            <View style={styles.popularRouteBody}>
              <View style={styles.popularLocationPill}>
                <MapPin size={13} color="#5ECBFA" strokeWidth={2.4} />
                <Text style={styles.popularLocationPillText}>
                  {index === 0 ? '서울숲' : index === 1 ? '한강' : '석촌호수'}
                </Text>
              </View>
              <Text style={styles.popularTitle}>{run.shape} 루트</Text>
              <Text style={styles.popularLocation}>
                {index === 0 ? '서울숲 · 성수' : index === 1 ? '여의도 한강공원' : '잠실 · 석촌호수'}
              </Text>
              <Text style={styles.popularSub}>
                {run.distance} · 일치율 {run.matchPct}%
              </Text>
              <View style={styles.popularUserRow}>
                <View style={styles.popularAvatar}>
                  <Text style={styles.popularAvatarText}>
                    {index === 0 ? 'J' : index === 1 ? 'M' : 'S'}
                  </Text>
                </View>
                <Text style={styles.popularUser}>
                  {index === 0 ? 'Jin Runner' : index === 1 ? 'Mina' : 'Sean'} · 좋아요{' '}
                  {index === 0 ? '2.4k' : index === 1 ? '1.8k' : '1.3k'}
                </Text>
                <Heart size={13} color="#5ECBFA" fill="#5ECBFA" strokeWidth={2.4} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScrollView>
  );
}
