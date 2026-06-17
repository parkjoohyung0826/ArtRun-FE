import React from 'react';
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type PanResponderInstance,
} from 'react-native';
import {Check, Download, Map, Navigation, Play} from 'lucide-react-native';
import {styles} from '../styles/appStyles';
import type {RoutePhase, RouteStats} from '../types/app';

export function RunModeScreen({
  sheetPanResponder,
  routePhase,
  shapePrompt,
  distance,
  routeStats,
  currentBpm,
  runProgress,
  progressDistance,
  currentPace,
  voiceCue,
  sheetScrollBottomInset,
  averagePaceLabel,
  elapsedTimeLabel,
  shareMapImageUrl,
  shareCardSaved,
  onSaveShareCard,
  onGoHome,
  onNewRun,
}: {
  sheetPanResponder: PanResponderInstance;
  routePhase: RoutePhase;
  shapePrompt: string;
  distance: number;
  routeStats: RouteStats | null;
  currentBpm: number;
  runProgress: number;
  progressDistance: string;
  currentPace: number;
  voiceCue: string;
  sheetScrollBottomInset: number;
  averagePaceLabel: string;
  elapsedTimeLabel: string;
  shareMapImageUrl: string | null;
  shareCardSaved: boolean;
  onSaveShareCard: () => void;
  onGoHome: () => void;
  onNewRun: () => void;
}) {
  const scrollContentStyle = [
    styles.sheetScrollContent,
    {paddingBottom: sheetScrollBottomInset},
  ];

  return (
    <View style={styles.navigationSheetHost}>
      {routePhase === 'complete' ? (
        <View style={styles.finishPanel}>
          <View style={styles.sheetDragHandleArea} {...sheetPanResponder.panHandlers}>
            <View style={styles.sheetDragHandle} />
          </View>

          <ScrollView
            style={styles.sheetScrollBody}
            contentContainerStyle={scrollContentStyle}
            showsVerticalScrollIndicator={false}>
            <View style={styles.finishIcon}>
              <Check size={30} color="#fff" strokeWidth={3} />
            </View>
            <Text style={styles.finishKicker}>완주 완료</Text>
            <Text style={styles.finishTitle}>{shapePrompt} 러닝을 완주했습니다</Text>
            <Text style={styles.finishSub}>
              기록이 저장되었고, 마이페이지에서 공유할 수 있습니다.
            </Text>

            <View style={styles.finishStats}>
              <View style={styles.finishStat}>
                <Text style={styles.finishStatLabel}>거리</Text>
                <Text style={styles.finishStatValue}>{distance.toFixed(1)} km</Text>
              </View>
              <View style={styles.finishStat}>
                <Text style={styles.finishStatLabel}>평균 페이스</Text>
                <Text style={styles.finishStatValue}>{averagePaceLabel}</Text>
              </View>
              <View style={styles.finishStat}>
                <Text style={styles.finishStatLabel}>소요 시간</Text>
                <Text style={styles.finishStatValue}>{elapsedTimeLabel}</Text>
              </View>
            </View>

            <View style={styles.shareCardSection}>
              <View style={styles.shareCardHeader}>
                <View>
                  <Text style={styles.shareCardKicker}>SNS 공유 카드</Text>
                  <Text style={styles.shareCardTitle}>완주 기록을 이미지로 저장</Text>
                </View>
                <Map size={20} color="#5ECBFA" strokeWidth={2.4} />
              </View>

              <View style={styles.sharePreviewCard}>
                <View style={styles.sharePreviewTop}>
                  <View>
                    <Text style={styles.sharePreviewBrand}>ArtRun</Text>
                    <Text style={styles.sharePreviewName}>{shapePrompt} Route</Text>
                  </View>
                  <View style={styles.sharePreviewBadge}>
                    <Text style={styles.sharePreviewBadgeText}>FINISH</Text>
                  </View>
                </View>

                <View style={styles.shareRoutePreview}>
                  {shareMapImageUrl ? (
                    <Image
                      source={{uri: shareMapImageUrl}}
                      style={styles.shareRouteMapImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.shareRouteMapFallback}>
                      <Map size={24} color="#5ECBFA" strokeWidth={2.4} />
                      <Text style={styles.shareRouteMapFallbackText}>
                        생성된 루트 지도를 불러오는 중입니다
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.shareMetricRow}>
                  <View style={styles.shareMetric}>
                    <Text style={styles.shareMetricLabel}>DIST</Text>
                    <Text style={styles.shareMetricValue}>{distance.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.shareMetric}>
                    <Text style={styles.shareMetricLabel}>PACE</Text>
                    <Text style={styles.shareMetricValue}>{averagePaceLabel}</Text>
                  </View>
                  <View style={styles.shareMetric}>
                    <Text style={styles.shareMetricLabel}>TIME</Text>
                    <Text style={styles.shareMetricValue}>{elapsedTimeLabel}</Text>
                  </View>
                </View>

                <Text style={styles.sharePreviewFooter}>
                  일치율 {routeStats?.matchPct || 92}% · 평균 {currentBpm} BPM
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.shareSaveButton,
                  shareCardSaved && styles.shareSaveButtonDone,
                ]}
                onPress={onSaveShareCard}
                activeOpacity={0.84}>
                {shareCardSaved ? (
                  <Check size={18} color="#fff" strokeWidth={2.8} />
                ) : (
                  <Download size={18} color="#fff" strokeWidth={2.6} />
                )}
                <Text style={styles.shareSaveButtonText}>
                  {shareCardSaved ? '저장 완료' : '이미지 카드 저장'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.finishActions}>
              <TouchableOpacity style={styles.secondaryButtonFlex} onPress={onGoHome}>
                <Text style={styles.secondaryButtonText}>홈으로</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={onNewRun}>
                <Text style={styles.primaryButtonText}>새 루트 만들기</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.guidancePanel}>
          <View style={styles.sheetDragHandleArea} {...sheetPanResponder.panHandlers}>
            <View style={styles.sheetDragHandle} />
          </View>

          <ScrollView
            style={styles.sheetScrollBody}
            contentContainerStyle={scrollContentStyle}
            showsVerticalScrollIndicator={false}>
            <View style={styles.guidanceHeader}>
              <View>
                <Text style={styles.guidanceKicker}>안내 중</Text>
                <Text style={styles.guidanceTitle}>다음 포인트까지 320m</Text>
              </View>
              <View style={styles.guidanceBadge}>
                <Text style={styles.guidanceBadgeText}>{Math.round(runProgress * 100)}%</Text>
              </View>
            </View>

            <View style={styles.guidanceInstruction}>
              <View style={styles.guidanceInstructionIcon}>
                <Navigation size={22} color="#fff" strokeWidth={2.7} />
              </View>
              <View style={styles.guidanceInstructionTextBox}>
                <Text style={styles.guidanceInstructionTitle}>{shapePrompt} 라인 유지</Text>
                <Text style={styles.guidanceInstructionSub}>
                  목표 페이스로 직진 후 좌측 라인에 진입하세요
                </Text>
              </View>
            </View>

            <View style={styles.guidanceStats}>
              <View style={styles.guidanceStat}>
                <Text style={styles.guidanceStatLabel}>이동</Text>
                <Text style={styles.guidanceStatValue}>{progressDistance} km</Text>
              </View>
              <View style={styles.guidanceStat}>
                <Text style={styles.guidanceStatLabel}>페이스</Text>
                <Text style={styles.guidanceStatValue}>
                  {Math.floor(currentPace)}'
                  {Math.round((currentPace % 1) * 60).toString().padStart(2, '0')}"
                </Text>
              </View>
              <View style={styles.guidanceStat}>
                <Text style={styles.guidanceStatLabel}>BPM</Text>
                <Text style={styles.guidanceStatValue}>{currentBpm}</Text>
              </View>
            </View>

            <View style={styles.guidanceVoice}>
              <View style={styles.guidanceVoiceIcon}>
                <Play size={14} color="#fff" fill="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.guidanceVoiceText}>{voiceCue}</Text>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}
