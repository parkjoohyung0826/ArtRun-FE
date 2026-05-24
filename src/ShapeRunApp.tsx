import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Geolocation from '@react-native-community/geolocation';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import {MAP_HTML} from './mapHtml';
import {SHAPES} from './shapes';
import {FooterItem, RouteReadyCard, RunCard, ToggleRow} from './components/AppChrome';
import {
  ACTIVITY_PROFILES,
  COMMUNITY_RUNS,
  INITIAL_RUNS,
  PRESET_SHAPES,
  ROUTE_IMAGES,
} from './constants/appData';
import {styles} from './styles/appStyles';
import {BLUE, GREEN} from './styles/theme';
import type {Activity, Preferences, RoutePhase, RouteStats, SavedRun, TabKey} from './types/app';
import {formatDuration, inferPresetFromPrompt, shapeNameFromKey} from './utils/routeFormat';

export default function ShapeRunApp() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const runTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [selectedShape, setSelectedShape] = useState('star');
  const [shapePrompt, setShapePrompt] = useState('별');
  const [distance, setDistance] = useState(5);
  const [targetPace, setTargetPace] = useState(5.5);
  const [activity, setActivity] = useState<Activity>('Running');
  const [preferences, setPreferences] = useState<Preferences>({
    avoidMainRoad: true,
    preferPark: true,
    adaptiveMusic: true,
    voiceCoach: true,
  });
  const [startCoord, setStartCoord] = useState({lat: 37.5665, lng: 126.978});
  const [mapReady, setMapReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [routePhase, setRoutePhase] = useState<RoutePhase>('idle');
  const [runProgress, setRunProgress] = useState(0);
  const [currentPace, setCurrentPace] = useState(5.8);
  const [currentBpm, setCurrentBpm] = useState(156);
  const [voiceCue, setVoiceCue] = useState('경로를 생성하면 러닝 코치가 준비됩니다.');
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>(INITIAL_RUNS);
  const [pendingQuickGenerate, setPendingQuickGenerate] = useState(false);

  useEffect(() => {
    return () => {
      if (runTimer.current) clearInterval(runTimer.current);
    };
  }, []);

  const finishRun = useCallback(() => {
    if (runTimer.current) clearInterval(runTimer.current);
    setRoutePhase('complete');
    setVoiceCue('러닝을 완료했습니다. 루트 완주 기록이 저장되었습니다.');
    setSavedRuns(prev => {
      const newRun: SavedRun = {
        id: `r${Date.now()}`,
        shape: shapeNameFromKey(selectedShape, shapePrompt),
        distance: `${distance.toFixed(1)} km`,
        pace: `${Math.floor(targetPace)}'${Math.round((targetPace % 1) * 60)
          .toString()
          .padStart(2, '0')}"`,
        matchPct: routeStats?.matchPct || 92,
        shared: false,
      };
      return [newRun, ...prev];
    });
  }, [distance, routeStats?.matchPct, selectedShape, shapePrompt, targetPace]);

  useEffect(() => {
    if (routePhase !== 'running') return;

    runTimer.current = setInterval(() => {
      setRunProgress(prev => {
        const next = Math.min(1, prev + 0.035);
        const paceDrift = Math.sin(next * Math.PI * 5) * 0.35;
        const nextPace = Number((targetPace + paceDrift).toFixed(2));
        const nextBpm =
          nextPace > targetPace + 0.15
            ? 164
            : nextPace < targetPace - 0.15
              ? 148
              : 156;

        setCurrentPace(nextPace);
        setCurrentBpm(nextBpm);

        if (next >= 1) {
          finishRun();
          return 1;
        }
        if (prev < 0.5 && next >= 0.5) {
          setVoiceCue(`${shapeNameFromKey(selectedShape, shapePrompt)}의 반을 완성했습니다.`);
        } else if (nextPace > targetPace + 0.15) {
          setVoiceCue('목표보다 빠릅니다. BPM을 낮춰 호흡을 안정시킵니다.');
        } else if (nextPace < targetPace - 0.15) {
          setVoiceCue('목표보다 느립니다. BPM을 높여 리듬을 끌어올립니다.');
        } else {
          setVoiceCue('목표 페이스를 유지하고 있습니다.');
        }
        return next;
      });
    }, 1000);

    return () => {
      if (runTimer.current) clearInterval(runTimer.current);
    };
  }, [finishRun, routePhase, selectedShape, shapePrompt, targetPace]);

  const activeShapeKey = useMemo(
    () => (shapePrompt.trim() ? inferPresetFromPrompt(shapePrompt) : selectedShape),
    [selectedShape, shapePrompt],
  );

  const progressDistance = useMemo(
    () => (distance * runProgress).toFixed(2),
    [distance, runProgress],
  );

  const postToMap = useCallback((data: object) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'READY') {
          setMapReady(true);
          postToMap({type: 'SET_LOCATION', lat: startCoord.lat, lng: startCoord.lng});
        }
        if (msg.type === 'MAP_CLICK') {
          setStartCoord({lat: msg.lat, lng: msg.lng});
          setRouteStats(null);
          setRoutePhase('idle');
        }
        if (msg.type === 'ROUTING_START') {
          setIsGenerating(true);
        }
        if (msg.type === 'ROUTE_DONE') {
          const shapeLabel = shapeNameFromKey(selectedShape, shapePrompt);
          setIsGenerating(false);
          setRoutePhase('ready');
          setVoiceCue(`${shapeLabel} ${distance}km 루트가 준비되었습니다.`);
          setRouteStats({
            distKm: ((msg.distM || distance * 1000) / 1000).toFixed(2),
            duration: formatDuration(msg.durS, distance),
            matchPct: Math.round(88 + Math.random() * 8),
            shapeLabel,
          });
        }
      } catch {}
    },
    [distance, postToMap, selectedShape, shapePrompt, startCoord],
  );

  const handleGenerate = useCallback(() => {
    if (!mapReady || isGenerating) return;

    const shapeKey = activeShapeKey in SHAPES ? activeShapeKey : selectedShape;
    const shape = SHAPES[shapeKey] || SHAPES.star;
    setRouteStats(null);
    setRoutePhase('idle');
    setRunProgress(0);
    setIsGenerating(true);
    setVoiceCue('AI가 모양과 거리에 맞는 러닝 루트를 설계하고 있습니다.');

    postToMap({
      type: 'GENERATE',
      shapePts: shape.points,
      targetKm: distance,
      profile: ACTIVITY_PROFILES[activity],
      startLat: startCoord.lat,
      startLng: startCoord.lng,
    });
  }, [
    activeShapeKey,
    activity,
    distance,
    isGenerating,
    mapReady,
    postToMap,
    selectedShape,
    startCoord,
  ]);

  useEffect(() => {
    if (!pendingQuickGenerate || activeTab !== 'run' || !mapReady || isGenerating) {
      return;
    }
    setPendingQuickGenerate(false);
    handleGenerate();
  }, [activeTab, handleGenerate, isGenerating, mapReady, pendingQuickGenerate]);

  const handleQuickGenerate = useCallback(() => {
    setRouteStats(null);
    setRoutePhase('idle');
    setRunProgress(0);
    setVoiceCue('홈에서 선택한 조건으로 빠르게 루트를 생성합니다.');
    setPendingQuickGenerate(true);
    setActiveTab('run');
  }, []);

  const handleRegenerate = useCallback(() => {
    setVoiceCue('이전 조건을 유지한 채 다른 도로 조합을 찾습니다.');
    handleGenerate();
  }, [handleGenerate]);

  const handleStartRun = useCallback(() => {
    if (!routeStats) return;
    setActiveTab('run');
    setRoutePhase('running');
    setRunProgress(0);
    setCurrentPace(targetPace);
    setCurrentBpm(156);
    setVoiceCue(`${routeStats.shapeLabel} 러닝을 시작합니다. 첫 구간은 목표 페이스로 진입하세요.`);
  }, [routeStats, targetPace]);

  const handleNewRun = useCallback(() => {
    setRoutePhase('idle');
    setRouteStats(null);
    setRunProgress(0);
    setVoiceCue('새 러닝 루트를 생성할 준비가 되었습니다.');
  }, []);

  const handleGetLocation = useCallback(() => {
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude: lat, longitude: lng} = pos.coords;
        setStartCoord({lat, lng});
        postToMap({type: 'SET_LOCATION', lat, lng});
      },
      () => Alert.alert('위치 사용 불가', '지도를 탭하여 출발지를 직접 설정해 주세요.'),
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000},
    );
  }, [postToMap]);

  const toggleShare = useCallback((id: string) => {
    setSavedRuns(prev =>
      prev.map(run => (run.id === id ? {...run, shared: !run.shared} : run)),
    );
  }, []);

  const renderPlan = () => (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={styles.panelContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>AI 루트 생성</Text>
        <Text style={styles.sectionMeta}>모양, 거리, 페이스를 한 번에 설정</Text>
      </View>

      <View style={styles.runSetupCard}>
        <View style={styles.runSetupHeader}>
          <View>
            <Text style={styles.runSetupKicker}>현재 설정</Text>
            <Text style={styles.runSetupTitle}>
              {shapePrompt.trim() || '커스텀'} · {distance.toFixed(1)} km
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
              {Math.floor(targetPace)}'{Math.round((targetPace % 1) * 60).toString().padStart(2, '0')}"
            </Text>
          </View>
          <View style={styles.runSetupMetric}>
            <Text style={styles.runSetupMetricLabel}>음성 안내</Text>
            <Text style={styles.runSetupMetricValue}>{preferences.voiceCoach ? 'ON' : 'OFF'}</Text>
          </View>
          <View style={styles.runSetupMetric}>
            <Text style={styles.runSetupMetricLabel}>EDM 조절</Text>
            <Text style={styles.runSetupMetricValue}>{preferences.adaptiveMusic ? 'ON' : 'OFF'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.inputBlock}>
        <Text style={styles.inputLabel}>원하는 모양</Text>
        <TextInput
          value={shapePrompt}
          onChangeText={text => {
            setShapePrompt(text);
            setRouteStats(null);
            setRoutePhase('idle');
          }}
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
              onPress={() => {
                setSelectedShape(item.key);
                setShapePrompt(item.label);
                setRouteStats(null);
                setRoutePhase('idle');
              }}
              activeOpacity={0.78}>
              <Text style={[styles.shapeChipText, active && styles.shapeChipTextActive]}>
                {item.label}
              </Text>
              <Text style={[styles.shapeChipHint, active && styles.shapeChipTextActive]}>
                {item.hint}
              </Text>
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
            {Math.floor(targetPace)}'{Math.round((targetPace % 1) * 60).toString().padStart(2, '0')}"
          </Text>
        </View>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={20}
        step={0.5}
        value={distance}
        onValueChange={value => {
          setDistance(value);
          setRouteStats(null);
          setRoutePhase('idle');
        }}
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
        onValueChange={setTargetPace}
        minimumTrackTintColor={BLUE}
        maximumTrackTintColor="#d1d5db"
        thumbTintColor={BLUE}
      />

      <View style={styles.segmented}>
        {(['Running', 'Walking', 'Cycling'] as Activity[]).map(item => (
          <TouchableOpacity
            key={item}
            style={[styles.segment, activity === item && styles.segmentActive]}
            onPress={() => setActivity(item)}
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
          onValueChange={value => setPreferences(prev => ({...prev, avoidMainRoad: value}))}
        />
        <ToggleRow
          label="공원길 선호"
          value={preferences.preferPark}
          onValueChange={value => setPreferences(prev => ({...prev, preferPark: value}))}
        />
        <ToggleRow
          label="AI EDM 페이스 조절"
          value={preferences.adaptiveMusic}
          onValueChange={value => setPreferences(prev => ({...prev, adaptiveMusic: value}))}
        />
        <ToggleRow
          label="실시간 음성 안내"
          value={preferences.voiceCoach}
          onValueChange={value => setPreferences(prev => ({...prev, voiceCoach: value}))}
        />
      </View>

      <TouchableOpacity style={styles.locationButton} onPress={handleGetLocation}>
        <Text style={styles.locationIcon}>◎</Text>
        <View style={styles.locationTextBox}>
          <Text style={styles.locationTitle}>출발 지점</Text>
          <Text style={styles.locationSub}>
            {startCoord.lat.toFixed(4)}, {startCoord.lng.toFixed(4)}
          </Text>
        </View>
      </TouchableOpacity>

      {routeStats && <RouteReadyCard stats={routeStats} />}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, (!routeStats || isGenerating) && styles.buttonDisabled]}
          onPress={handleRegenerate}
          disabled={!routeStats || isGenerating}
          activeOpacity={0.84}>
          <Text style={styles.secondaryButtonText}>재생성</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, (!mapReady || isGenerating) && styles.buttonDisabled]}
          onPress={routeStats ? handleStartRun : handleGenerate}
          disabled={!mapReady || isGenerating}
          activeOpacity={0.86}>
          <Text style={styles.primaryButtonText}>
            {isGenerating ? '생성 중' : routeStats ? '러닝 시작' : '경로 생성'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderHome = () => (
    <ScrollView
      style={styles.homeScroll}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.homeHero}>
        <View style={styles.heroBlueBlade} />
        <View style={styles.heroShadePanel} />
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroKicker}>오늘의 추천 루트</Text>
            <Text style={styles.heroTitle}>서울숲 스타 루트</Text>
            <Text style={styles.heroReason}>컨디션 92점 기준, 5km 가볍게 뛰기 좋은 코스</Text>
          </View>
          <View style={styles.heroScore}>
            <Text style={styles.heroScoreValue}>92</Text>
            <Text style={styles.heroScoreLabel}>컨디션</Text>
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
          <TouchableOpacity style={styles.heroButton} onPress={() => setActiveTab('run')}>
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
          <Text style={styles.quickCreateIcon}>⌁</Text>
        </View>
        <View style={styles.quickCreateRow}>
          {PRESET_SHAPES.slice(0, 3).map(item => {
            const active = shapePrompt === item.label;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.quickChoice, active && styles.quickChoiceActive]}
                onPress={() => {
                  setSelectedShape(item.key);
                  setShapePrompt(item.label);
                }}
                activeOpacity={0.78}>
                <Text style={[styles.quickChoiceText, active && styles.quickChoiceTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.quickDistanceRow}>
          {[3, 5, 8].map(km => {
            const active = distance === km;
            return (
              <TouchableOpacity
                key={km}
                style={[styles.quickDistance, active && styles.quickDistanceActive]}
                onPress={() => setDistance(km)}
                activeOpacity={0.78}>
                <Text style={[styles.quickDistanceText, active && styles.quickDistanceTextActive]}>
                  {km} km
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.quickGenerateButton, pendingQuickGenerate && styles.buttonDisabled]}
            onPress={handleQuickGenerate}
            disabled={pendingQuickGenerate}
            activeOpacity={0.86}>
            <Text style={styles.quickGenerateText}>바로 생성</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeaderInline}>
        <Text style={styles.homeSectionTitle}>오늘의 추천</Text>
        <TouchableOpacity onPress={() => setActiveTab('run')}>
          <Text style={styles.homeSectionLink}>다시 추천</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recommendCard}>
        <View style={styles.recommendArt}>
          <Image
            source={{uri: ROUTE_IMAGES.hangang}}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.previewScrim} />
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>한강</Text>
          </View>
        </View>
        <View style={styles.recommendBody}>
          <Text style={styles.recommendTitle}>한강 라이트닝 루트</Text>
          <Text style={styles.recommendSub}>바람 약함 · 평지 82% · 야간 조도 좋음</Text>
          <View style={styles.recommendTags}>
            {['4.8 km', '초중급', 'EDM'].map(tag => (
              <View key={tag} style={styles.recommendTag}>
                <Text style={styles.recommendTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.sectionHeaderInline}>
        <Text style={styles.homeSectionTitle}>몸 상태</Text>
        <TouchableOpacity onPress={() => setActiveTab('profile')}>
          <Text style={styles.homeSectionLink}>관리</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.healthGrid}>
        <View style={styles.healthCard}>
          <Text style={styles.healthLabel}>체중</Text>
          <Text style={styles.healthValue}>68.4 kg</Text>
          <Text style={styles.healthDelta}>지난주 -0.6 kg</Text>
        </View>
        <View style={styles.healthCard}>
          <Text style={styles.healthLabel}>회복</Text>
          <Text style={styles.healthValue}>좋음</Text>
          <Text style={styles.healthDelta}>오늘 5 km 추천</Text>
        </View>
        <View style={styles.healthCard}>
          <Text style={styles.healthLabel}>주간 거리</Text>
          <Text style={styles.healthValue}>18.2 km</Text>
          <Text style={styles.healthDelta}>목표 62%</Text>
        </View>
      </View>

      <View style={styles.sectionHeaderInline}>
        <Text style={styles.homeSectionTitle}>커뮤니티 인기</Text>
        <TouchableOpacity onPress={() => setActiveTab('community')}>
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
            onPress={() => setActiveTab('community')}
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
              <Text style={styles.popularSub}>{run.distance} · 일치율 {run.matchPct}%</Text>
              <View style={styles.popularUserRow}>
                <View style={styles.popularAvatar}>
                  <Text style={styles.popularAvatarText}>
                    {index === 0 ? 'J' : index === 1 ? 'M' : 'S'}
                  </Text>
                </View>
                <Text style={styles.popularUser}>
                  {index === 0 ? 'Jin Runner' : index === 1 ? 'Mina' : 'Sean'} · 좋아요 {index === 0 ? '2.4k' : index === 1 ? '1.8k' : '1.3k'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScrollView>
  );

  const renderRunMode = () => (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={styles.panelContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.runHero}>
        <Text style={styles.runState}>
          {routePhase === 'running' ? 'RUNNING' : routePhase === 'complete' ? 'FINISHED' : 'READY'}
        </Text>
        <Text style={styles.runDistance}>{progressDistance} km</Text>
        <Text style={styles.runTarget}>목표 {distance.toFixed(1)} km</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${Math.max(runProgress * 100, 4)}%`}]} />
        </View>
      </View>

      <View style={styles.gridThree}>
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>현재 페이스</Text>
          <Text style={styles.liveValue}>
            {Math.floor(currentPace)}'{Math.round((currentPace % 1) * 60).toString().padStart(2, '0')}"
          </Text>
        </View>
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>EDM BPM</Text>
          <Text style={styles.liveValue}>{currentBpm}</Text>
        </View>
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>완성도</Text>
          <Text style={styles.liveValue}>{Math.round(runProgress * 100)}%</Text>
        </View>
      </View>

      <View style={styles.voiceCard}>
        <Text style={styles.voiceLabel}>음성 코치</Text>
        <Text style={styles.voiceText}>{voiceCue}</Text>
      </View>

      <View style={styles.musicCard}>
        <View>
          <Text style={styles.musicTitle}>Adaptive EDM</Text>
          <Text style={styles.musicSub}>
            {currentPace > targetPace ? '속도를 낮추는 다운비트 믹스' : '목표 페이스 유지 믹스'}
          </Text>
        </View>
        <Text style={styles.musicBpm}>{currentBpm} BPM</Text>
      </View>

      {routePhase === 'complete' && (
        <TouchableOpacity style={styles.primaryButton} onPress={handleNewRun}>
          <Text style={styles.primaryButtonText}>새 루트 만들기</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderCommunity = () => {
    const runs = [...savedRuns.filter(run => run.shared), ...COMMUNITY_RUNS];
    return (
      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.communityHero}>
          <View style={styles.communityBlade} />
          <View>
            <Text style={styles.heroKicker}>COMMUNITY</Text>
            <Text style={styles.communityTitle}>사람들이 좋아한 러닝 아트</Text>
            <Text style={styles.communityMeta}>좋아요, 완주율, 경로 일치율 기반</Text>
          </View>
          <View style={styles.communityStatsRow}>
            <View style={styles.communityStat}>
              <Text style={styles.communityStatValue}>2.4k</Text>
              <Text style={styles.communityStatLabel}>Top Like</Text>
            </View>
            <View style={styles.communityStat}>
              <Text style={styles.communityStatValue}>94%</Text>
              <Text style={styles.communityStatLabel}>Match</Text>
            </View>
          </View>
        </View>
        {runs.map(run => (
          <RunCard key={run.id} run={run} cta="저장" />
        ))}
      </ScrollView>
    );
  };

  const renderProfile = () => (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={styles.panelContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <View style={styles.profileBlade} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AR</Text>
        </View>
        <View>
          <Text style={styles.profileName}>Art Runner</Text>
          <Text style={styles.profileSub}>이번 달 42.6 km · 공유 루트 {savedRuns.filter(run => run.shared).length}개</Text>
        </View>
      </View>

      <View style={styles.gridThree}>
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>완주</Text>
          <Text style={styles.liveValue}>{savedRuns.length}</Text>
        </View>
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>평균 일치</Text>
          <Text style={styles.liveValue}>93%</Text>
        </View>
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>배지</Text>
          <Text style={styles.liveValue}>8</Text>
        </View>
      </View>

      <Text style={styles.listTitle}>내 완주 기록</Text>
      {savedRuns.map(run => (
        <RunCard
          key={run.id}
          run={run}
          cta={run.shared ? '공유됨' : '공유'}
          onPress={() => toggleShare(run.id)}
        />
      ))}
    </ScrollView>
  );

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <StatusBar barStyle="light-content" backgroundColor="#151c2b" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>ArtRun</Text>
          <Text style={styles.brandSub}>
            AI Shape Route Coach
          </Text>
        </View>
        <TouchableOpacity style={styles.headerPill} onPress={() => setActiveTab('profile')}>
          <Text style={styles.headerPillText}>MY</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'run' && (
        <View style={styles.mapShell}>
          <WebView
            ref={webViewRef}
            source={{html: MAP_HTML}}
            style={styles.webview}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            mixedContentMode="compatibility"
            allowsInlineMediaPlayback
          />
          <View style={styles.mapOverlay}>
            <Text style={styles.mapTitle}>
              {routeStats ? `${routeStats.shapeLabel} 루트` : '출발지를 정하고 루트를 생성하세요'}
            </Text>
            <Text style={styles.mapSub}>
              {routeStats ? `${routeStats.distKm} km · 일치율 ${routeStats.matchPct}%` : '지도 탭으로 출발지 변경'}
            </Text>
          </View>
          {(isGenerating || !mapReady) && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator color={GREEN} size="large" />
                <Text style={styles.loadingText}>{mapReady ? 'AI 경로 생성 중' : '지도 준비 중'}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.contentShell}>
        {activeTab === 'home' && renderHome()}
        {activeTab === 'run' && (
          routePhase === 'running' || routePhase === 'complete'
            ? renderRunMode()
            : renderPlan()
        )}
        {activeTab === 'community' && renderCommunity()}
        {activeTab === 'profile' && renderProfile()}
      </View>

      <View style={[styles.footer, {paddingBottom: Math.max(insets.bottom, 8)}]}>
        <FooterItem label="홈" icon="◆" active={activeTab === 'home'} onPress={() => setActiveTab('home')} />
        <FooterItem label="러닝" icon="▶" active={activeTab === 'run'} onPress={() => setActiveTab('run')} />
        <FooterItem label="공유" icon="◇" active={activeTab === 'community'} onPress={() => setActiveTab('community')} />
        <FooterItem label="마이" icon="●" active={activeTab === 'profile'} onPress={() => setActiveTab('profile')} />
      </View>
    </View>
  );
}
