import React from 'react';
import {Image, ScrollView, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {Route as RouteIcon} from 'lucide-react-native';
import {COMMUNITY_RUNS, PRESET_SHAPES, ROUTE_IMAGES} from '../constants/appData';
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
  onOpenRun,
  onOpenCommunity,
}: {
  shapePrompt: string;
  distance: number;
  pendingQuickGenerate: boolean;
  onChangeShapePrompt: (text: string) => void;
  onSelectPresetShape: (shape: PresetShape) => void;
  onSelectDistance: (distance: number) => void;
  onQuickGenerate: () => void;
  onOpenRun: () => void;
  onOpenCommunity: () => void;
}) {
  return (
    <ScrollView
      style={styles.homeScroll}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.homeHero}>
        <View style={styles.heroShadePanel} />
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroKicker}>오늘의 추천 루트</Text>
            <Text style={styles.heroTitle}>서울숲 스타 루트</Text>
            <Text style={styles.heroReason}>5km 가볍게 뛰기 좋은 공원길 중심 코스</Text>
          </View>
        </View>

        <View style={styles.heroRouteCard}>
          <View style={styles.heroMapPreview}>
            <Image
              source={{uri: ROUTE_IMAGES.seoulForest}}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <View style={styles.previewScrim} />
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>추천</Text>
            </View>
          </View>
          <View style={styles.heroRouteInfo}>
            <View style={styles.heroStatRow}>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatLabel}>거리</Text>
                <Text style={styles.heroStatValue}>5.0 km</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatLabel}>예상</Text>
                <Text style={styles.heroStatValue}>28분</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatLabel}>음악</Text>
                <Text style={styles.heroStatValue}>156 BPM</Text>
              </View>
            </View>
            <Text style={styles.heroRouteHint}>공원길 위주 · 신호 적음 · 별 모양 완주 가능</Text>
          </View>
        </View>

        <View style={styles.heroBottomRow}>
          <View>
            <Text style={styles.heroRouteName}>추천 루트를 바로 설정해볼까요?</Text>
            <Text style={styles.heroRouteMeta}>러닝 탭에서 거리와 페이스를 조정할 수 있어요</Text>
          </View>
          <TouchableOpacity style={styles.heroButton} onPress={onOpenRun}>
            <Text style={styles.heroButtonText}>러닝 준비</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.quickCreateCard}>
        <View style={styles.quickCreateHeader}>
          <View>
            <Text style={styles.quickCreateKicker}>빠른 루트 생성</Text>
            <Text style={styles.quickCreateTitle}>조건만 고르고 바로 만들기</Text>
          </View>
          <View style={styles.quickCreateIcon}>
            <RouteIcon size={25} color="#38bdf8" strokeWidth={2.5} />
          </View>
        </View>
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
        <View style={styles.quickDistanceRow}>
          {[3, 5, 8].map(km => {
            const active = distance === km;
            return (
              <TouchableOpacity
                key={km}
                style={[styles.quickDistance, active && styles.quickDistanceActive]}
                onPress={() => onSelectDistance(km)}
                activeOpacity={0.78}>
                <Text style={[styles.quickDistanceText, active && styles.quickDistanceTextActive]}>
                  {km} km
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.quickGenerateButton, pendingQuickGenerate && styles.buttonDisabled]}
            onPress={onQuickGenerate}
            disabled={pendingQuickGenerate}
            activeOpacity={0.86}>
            <Text style={styles.quickGenerateText}>바로 생성</Text>
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
            <View style={styles.popularMapPreview}>
              <Image
                source={{
                  uri:
                    index === 0
                      ? ROUTE_IMAGES.seoulForest
                      : index === 1
                        ? ROUTE_IMAGES.hangang
                        : ROUTE_IMAGES.lake,
                }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <View style={styles.previewScrim} />
              <View style={styles.popularImageLabel}>
                <Text style={styles.popularImageLabelText}>
                  {index === 0 ? '서울숲' : index === 1 ? '한강' : '석촌호수'}
                </Text>
              </View>
            </View>
            <View style={styles.popularRouteBody}>
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
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScrollView>
  );
}
