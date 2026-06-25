import React, {useRef} from 'react';
import {ScrollView, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {
  ChevronLeft,
  Heart,
  MapPin,
  PlayCircle,
  Search,
  ShieldCheck,
} from 'lucide-react-native';
import WebView, {type WebViewMessageEvent} from 'react-native-webview';
import {NAVER_MAP_WEB_BASE_URL} from '../config';
import {COMMUNITY_FILTERS} from '../constants/appData';
import {MAP_HTML} from '../mapHtml';
import {SHAPES} from '../shapes';
import {styles} from '../styles/appStyles';
import type {CommunityFilter, Coordinate, SavedRun} from '../types/app';
import {distanceBetweenCoords, parseDistanceKm} from '../utils/geo';
import {inferPresetFromPrompt} from '../utils/routeFormat';

export function CommunityScreen({
  communityRuns,
  communityActions,
  communityError,
  isCommunityLoading,
  selectedCommunityId,
  communityQuery,
  communityFilter,
  startCoord,
  onSelectCommunityId,
  onChangeQuery,
  onChangeFilter,
  onToggleAction,
  onUseRoute,
}: {
  communityRuns: SavedRun[];
  communityActions: Record<string, {liked: boolean}>;
  communityError: string | null;
  isCommunityLoading: boolean;
  selectedCommunityId: string | null;
  communityQuery: string;
  communityFilter: CommunityFilter;
  startCoord: Coordinate;
  onSelectCommunityId: (id: string | null) => void;
  onChangeQuery: (query: string) => void;
  onChangeFilter: (filter: CommunityFilter) => void;
  onToggleAction: (id: string) => void;
  onUseRoute: (run: SavedRun) => void;
}) {
  const detailMapRef = useRef<WebView>(null);
  const runs = communityRuns;
  const detailRun = selectedCommunityId
    ? runs.find(run => run.id === selectedCommunityId)
    : null;
  const normalizedQuery = communityQuery.trim().toLowerCase();
  const filteredRuns = runs.filter(run => {
    const routeStart = run.startCoord || startCoord;
    const startDistance = distanceBetweenCoords(startCoord, routeStart);
    const searchText = [run.shape, run.location, run.author, run.description, ...(run.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery);
    const matchesFilter =
      communityFilter === '전체' ||
      (communityFilter === '인기' && (run.likes || 0) >= 1000) ||
      (communityFilter === '근처' && startDistance <= 1.2);

    return matchesQuery && matchesFilter;
  });

  if (detailRun) {
    const actions = {liked: communityActions[detailRun.id]?.liked ?? detailRun.liked ?? false};
    const routeStart = detailRun.startCoord || startCoord;
    const startDistance = distanceBetweenCoords(startCoord, routeStart);
    const isNearStart = startDistance <= 1.2;
    const likes = (detailRun.likes || 320) + (actions.liked ? 1 : 0);
    const detailRoutePoints = detailRun.routePoints || [];
    const drawDetailRoute = () => {
      if (!detailRoutePoints.length) {
        const shapeKey = inferPresetFromPrompt(detailRun.shape);
        detailMapRef.current?.postMessage(
          JSON.stringify({
            type: 'GENERATE',
            shapePts: SHAPES[shapeKey]?.points || SHAPES.circle.points,
            targetKm: parseDistanceKm(detailRun.distance),
            startLat: routeStart.lat,
            startLng: routeStart.lng,
          }),
        );
        return;
      }

      detailMapRef.current?.postMessage(
        JSON.stringify({
          type: 'DRAW_ROUTE',
          points: detailRoutePoints,
          startLat: routeStart.lat,
          startLng: routeStart.lng,
        }),
      );
    };
    const handleDetailMapMessage = (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'READY') {
          detailMapRef.current?.postMessage(
            JSON.stringify({type: 'SET_LOCATION', lat: routeStart.lat, lng: routeStart.lng}),
          );
          drawDetailRoute();
        }
      } catch {}
    };

    return (
      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.communityDetailHeader}>
          <TouchableOpacity
            style={styles.communityBackButton}
            onPress={() => onSelectCommunityId(null)}
            activeOpacity={0.78}>
            <ChevronLeft size={22} color="#f8fafc" strokeWidth={2.8} />
          </TouchableOpacity>
          <View style={styles.communityDetailHeaderText}>
            <Text style={styles.communityDetailKicker}>ROUTE DETAIL</Text>
            <Text style={styles.communityDetailTitle}>{detailRun.shape} 루트</Text>
          </View>
        </View>

        <View style={styles.communityDetailInfoCard}>
          <View style={styles.communityInfoMetaRow}>
            <View style={styles.communityLocationPill}>
              <MapPin size={13} color="#5ECBFA" strokeWidth={2.5} />
              <Text style={styles.communityLocationPillText}>
                {detailRun.location || '내 공유 루트'}
              </Text>
            </View>
            <View style={[styles.communityStartBadge, isNearStart && styles.communityStartBadgeOk]}>
              <ShieldCheck
                size={13}
                color={isNearStart ? '#bbf7d0' : '#bfdbfe'}
                strokeWidth={2.6}
              />
              <Text
                style={[
                  styles.communityStartBadgeText,
                  isNearStart && styles.communityStartBadgeTextOk,
                ]}>
                {isNearStart ? '현재 위치에서 시작 가능' : `시작점 ${startDistance.toFixed(1)}km`}
              </Text>
            </View>
          </View>
          <Text style={styles.communityDetailMapTitle}>공유 루트 실행 준비</Text>
          <Text style={styles.communityDetailMapSub}>
            아래 지도에서 공유된 러닝 루트를 먼저 확인하고 바로 실행할 수 있습니다.
          </Text>
        </View>

        <View style={styles.communityDetailRouteMapCard}>
          <WebView
            key={detailRun.id}
            ref={detailMapRef}
            source={{html: MAP_HTML, baseUrl: NAVER_MAP_WEB_BASE_URL}}
            style={styles.communityDetailRouteMapWebView}
            onMessage={handleDetailMapMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            mixedContentMode="compatibility"
            allowsInlineMediaPlayback
          />
        </View>

        <View style={styles.communityDetailSummary}>
          <View style={styles.communityDetailMetric}>
            <Text style={styles.communityDetailMetricLabel}>거리</Text>
            <Text style={styles.communityDetailMetricValue}>{detailRun.distance}</Text>
          </View>
          <View style={styles.communityDetailMetric}>
            <Text style={styles.communityDetailMetricLabel}>페이스</Text>
            <Text style={styles.communityDetailMetricValue}>{detailRun.pace}</Text>
          </View>
          <View style={styles.communityDetailMetric}>
            <Text style={styles.communityDetailMetricLabel}>일치율</Text>
            <Text style={styles.communityDetailMetricValue}>{detailRun.matchPct}%</Text>
          </View>
        </View>

        <View style={styles.communityDetailSection}>
          <View style={styles.communityRouteTitleRow}>
            <View style={styles.communityRouteTitleBox}>
              <Text style={styles.communityDetailSectionTitle}>루트 설명</Text>
              <Text style={styles.communityAuthorText}>
                {detailRun.author || '내 기록'} · 좋아요{' '}
                {likes >= 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}
              </Text>
            </View>
            <View style={styles.communityAuthorBadge}>
              <Text style={styles.communityAuthorInitial}>
                {(detailRun.author || '나').slice(0, 1)}
              </Text>
            </View>
          </View>
          <Text style={styles.communityDetailText}>
            {detailRun.description ||
              '내가 완주한 러닝 아트 루트입니다. 같은 조건으로 다시 생성해서 달릴 수 있습니다.'}
          </Text>
          <View style={styles.communityTags}>
            {(detailRun.tags || ['내 기록', '공유됨']).map(tag => (
              <View key={tag} style={styles.communityTag}>
                <Text style={styles.communityTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.communityDetailActions}>
          <TouchableOpacity
            style={styles.communityDetailIconAction}
            onPress={() => onToggleAction(detailRun.id)}
            activeOpacity={0.75}>
            <Heart
              size={19}
              color={actions.liked ? '#38bdf8' : '#94a3b8'}
              fill={actions.liked ? '#38bdf8' : 'transparent'}
              strokeWidth={2.4}
            />
            <Text style={styles.communityDetailIconActionText}>좋아요</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.communityDetailRunAction}
            onPress={() => onUseRoute(detailRun)}
            activeOpacity={0.84}>
            <PlayCircle size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.communityRunButtonText}>이 루트로 뛰기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={styles.panelContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.communitySearchCard}>
        <View style={styles.communitySearchBox}>
          <Search size={18} color="#94a3b8" strokeWidth={2.5} />
          <TextInput
            value={communityQuery}
            onChangeText={onChangeQuery}
            placeholder="모양, 지역, 작성자 검색"
            placeholderTextColor="#64748b"
            style={styles.communitySearchInput}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.communityFilterRow}>
          {COMMUNITY_FILTERS.map(filter => {
            const active = communityFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.communityFilterChip, active && styles.communityFilterChipActive]}
                onPress={() => onChangeFilter(filter)}
                activeOpacity={0.78}>
                <Text
                  style={[
                    styles.communityFilterText,
                    active && styles.communityFilterTextActive,
                  ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {filteredRuns.map(run => {
        const actions = {liked: communityActions[run.id]?.liked ?? run.liked ?? false};
        const likes = (run.likes || 320) + (actions.liked ? 1 : 0);
        const routeStart = run.startCoord || startCoord;
        const startDistance = distanceBetweenCoords(startCoord, routeStart);
        const isNearStart = startDistance <= 1.2;

        return (
          <TouchableOpacity
            key={run.id}
            style={styles.communityRouteCard}
            onPress={() => onSelectCommunityId(run.id)}
            activeOpacity={0.86}>
            <View style={styles.communityInfoMetaRow}>
              <View style={styles.communityLocationPill}>
                <MapPin size={13} color="#5ECBFA" strokeWidth={2.5} />
                <Text style={styles.communityLocationPillText}>
                  {run.location || '내 공유 루트'}
                </Text>
              </View>
              <View style={[styles.communityStartBadge, isNearStart && styles.communityStartBadgeOk]}>
                <ShieldCheck
                  size={13}
                  color={isNearStart ? '#bbf7d0' : '#bfdbfe'}
                  strokeWidth={2.6}
                />
                <Text
                  style={[
                    styles.communityStartBadgeText,
                    isNearStart && styles.communityStartBadgeTextOk,
                  ]}>
                  {isNearStart ? '시작 가능' : `${startDistance.toFixed(1)}km`}
                </Text>
              </View>
            </View>

            <View style={styles.communityRouteBody}>
              <View style={styles.communityRouteTitleRow}>
                <View style={styles.communityRouteTitleBox}>
                  <Text style={styles.communityRouteTitle}>{run.shape} 루트</Text>
                  <Text style={styles.communityRouteMeta}>
                    {run.distance} · {run.pace} · 일치율 {run.matchPct}%
                  </Text>
                </View>
                <View style={styles.communityAuthorBadge}>
                  <Text style={styles.communityAuthorInitial}>
                    {(run.author || '나').slice(0, 1)}
                  </Text>
                </View>
              </View>

              <Text style={styles.communityAuthorText}>
                {run.author || '내 기록'} · 좋아요{' '}
                {likes >= 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}
              </Text>

              <View style={styles.communityActionRow}>
                <TouchableOpacity
                  style={styles.communityIconButton}
                  onPress={() => onToggleAction(run.id)}
                  activeOpacity={0.75}>
                  <Heart
                    size={18}
                    color={actions.liked ? '#38bdf8' : '#94a3b8'}
                    fill={actions.liked ? '#38bdf8' : 'transparent'}
                    strokeWidth={2.4}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.communityRunButton}
                  onPress={() => onUseRoute(run)}
                  activeOpacity={0.84}>
                  <PlayCircle size={17} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.communityRunButtonText}>이 루트로 뛰기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
      {(isCommunityLoading || communityError) && (
        <View style={styles.communityStatusBox}>
          <Text style={styles.communityStatusTitle}>
            {isCommunityLoading ? '커뮤니티 루트를 불러오는 중입니다' : '서버 목록을 불러오지 못했습니다'}
          </Text>
          {communityError && <Text style={styles.communityStatusText}>{communityError}</Text>}
        </View>
      )}
      {filteredRuns.length === 0 && (
        <View style={styles.communityEmptyBox}>
          <Text style={styles.communityEmptyTitle}>조건에 맞는 루트가 없습니다</Text>
          <Text style={styles.communityEmptyText}>검색어나 필터를 바꿔 다시 찾아보세요.</Text>
        </View>
      )}
    </ScrollView>
  );
}
