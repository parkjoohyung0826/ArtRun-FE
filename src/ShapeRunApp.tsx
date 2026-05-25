import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  PanResponder,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Geolocation from '@react-native-community/geolocation';
import {
  Bookmark,
  Cat,
  Check,
  ChevronLeft,
  Circle,
  Dog,
  Heart,
  LocateFixed,
  MapPinned,
  MapPin,
  Navigation,
  Play,
  PlayCircle,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react-native';
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

type ShapeIconKey = (typeof PRESET_SHAPES)[number]['icon'];

const SHAPE_ICONS: Record<ShapeIconKey, React.ComponentType<any>> = {
  star: Star,
  heart: Heart,
  circle: Circle,
  dog: Dog,
  cat: Cat,
};

const COMMUNITY_FILTERS = ['전체', '인기', '저장', '근처'] as const;
type CommunityFilter = (typeof COMMUNITY_FILTERS)[number];

function ShapePresetIcon({name, active}: {name: ShapeIconKey; active: boolean}) {
  const Icon = SHAPE_ICONS[name];

  return (
    <Icon
      size={24}
      color={active ? '#2563eb' : '#38bdf8'}
      strokeWidth={active ? 2.8 : 2.3}
    />
  );
}

function parseDistanceKm(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 5;
}

function parsePaceMinutes(value: string) {
  const match = value.match(/(\d+)'(\d+)/);
  if (!match) return 5.5;

  return Number(match[1]) + Number(match[2]) / 60;
}

function distanceBetweenCoords(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number},
) {
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthKm * Math.asin(Math.sqrt(h));
}

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
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [communityQuery, setCommunityQuery] = useState('');
  const [communityFilter, setCommunityFilter] = useState<CommunityFilter>('전체');
  const [communityActions, setCommunityActions] = useState<
    Record<string, {liked: boolean; saved: boolean}>
  >({});

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

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -24) {
            setSheetExpanded(true);
          }
          if (gesture.dy > 24) {
            setSheetExpanded(false);
          }
        },
      }),
    [],
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

  const toggleCommunityAction = useCallback((id: string, key: 'liked' | 'saved') => {
    setCommunityActions(prev => {
      const current = prev[id] || {liked: false, saved: false};
      return {
        ...prev,
        [id]: {
          ...current,
          [key]: !current[key],
        },
      };
    });
  }, []);

  const prepareCommunityRoute = useCallback(
    (run: SavedRun, syncStartLocation: boolean) => {
      const routeStart = run.startCoord || startCoord;
      const nextDistance = parseDistanceKm(run.distance);
      const nextShape = inferPresetFromPrompt(run.shape);

      if (syncStartLocation) {
        setStartCoord(routeStart);
        postToMap({type: 'SET_LOCATION', lat: routeStart.lat, lng: routeStart.lng});
      }

      setSelectedShape(nextShape);
      setShapePrompt(run.shape);
      setDistance(nextDistance);
      setTargetPace(parsePaceMinutes(run.pace));
      setRouteStats(null);
      setRoutePhase('idle');
      setRunProgress(0);
      setVoiceCue(`${run.location || '커뮤니티'} ${run.shape} 루트를 불러옵니다.`);
      setPendingQuickGenerate(true);
      setActiveTab('run');
    },
    [postToMap, startCoord],
  );

  const handleUseCommunityRoute = useCallback(
    (run: SavedRun) => {
      const routeStart = run.startCoord || startCoord;
      const distanceFromStart = distanceBetweenCoords(startCoord, routeStart);

      if (distanceFromStart > 1.2) {
        Alert.alert(
          '출발 위치 확인 필요',
          `현재 위치가 이 루트 시작점에서 약 ${distanceFromStart.toFixed(1)}km 떨어져 있습니다. 시작점을 루트 위치로 맞춘 뒤 준비할까요?`,
          [
            {text: '취소', style: 'cancel'},
            {text: '위치 맞추기', onPress: () => prepareCommunityRoute(run, true)},
          ],
        );
        return;
      }

      prepareCommunityRoute(run, true);
    },
    [prepareCommunityRoute, startCoord],
  );

  const renderPlan = () => (
    <ScrollView
      style={[styles.panelScroll, styles.navigationPanelScroll]}
      contentContainerStyle={[styles.panelContent, styles.navigationPanelContent]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={styles.runBottomSheet}>
        <View style={styles.sheetDragHandleArea} {...sheetPanResponder.panHandlers}>
          <View style={styles.sheetDragHandle} />
        </View>
        <View style={styles.sectionHeader}>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sectionTitle}>AI 루트 생성</Text>
            <TouchableOpacity style={styles.sheetHeaderButton} onPress={() => setActiveTab('home')}>
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
      </View>
    </ScrollView>
  );

  const renderHome = () => (
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
          <View style={styles.quickCreateIcon}>
            <RouteIcon size={25} color="#38bdf8" strokeWidth={2.5} />
          </View>
        </View>
        <View style={styles.quickPromptBox}>
          <TextInput
            value={shapePrompt}
            onChangeText={text => {
              setShapePrompt(text);
              setRouteStats(null);
              setRoutePhase('idle');
            }}
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
                onPress={() => {
                  setSelectedShape(item.key);
                  setShapePrompt(item.label);
                }}
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
      style={[styles.panelScroll, styles.navigationPanelScroll]}
      contentContainerStyle={[styles.panelContent, styles.navigationPanelContent]}
      showsVerticalScrollIndicator={false}>
      {routePhase === 'complete' ? (
        <View style={styles.finishPanel}>
          <View style={styles.sheetDragHandleArea} {...sheetPanResponder.panHandlers}>
            <View style={styles.sheetDragHandle} />
          </View>
          <View style={styles.finishIcon}>
            <Check size={30} color="#fff" strokeWidth={3} />
          </View>
          <Text style={styles.finishKicker}>완주 완료</Text>
          <Text style={styles.finishTitle}>{shapePrompt} 러닝을 완주했습니다</Text>
          <Text style={styles.finishSub}>기록이 저장되었고, 마이페이지에서 공유할 수 있습니다.</Text>

          <View style={styles.finishStats}>
            <View style={styles.finishStat}>
              <Text style={styles.finishStatLabel}>거리</Text>
              <Text style={styles.finishStatValue}>{distance.toFixed(1)} km</Text>
            </View>
            <View style={styles.finishStat}>
              <Text style={styles.finishStatLabel}>일치율</Text>
              <Text style={styles.finishStatValue}>{routeStats?.matchPct || 92}%</Text>
            </View>
            <View style={styles.finishStat}>
              <Text style={styles.finishStatLabel}>평균 BPM</Text>
              <Text style={styles.finishStatValue}>{currentBpm}</Text>
            </View>
          </View>

          <View style={styles.finishActions}>
            <TouchableOpacity style={styles.secondaryButtonFlex} onPress={() => setActiveTab('home')}>
              <Text style={styles.secondaryButtonText}>홈으로</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleNewRun}>
              <Text style={styles.primaryButtonText}>새 루트 만들기</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.guidancePanel}>
          <View style={styles.sheetDragHandleArea} {...sheetPanResponder.panHandlers}>
            <View style={styles.sheetDragHandle} />
          </View>
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
              <Text style={styles.guidanceInstructionSub}>목표 페이스로 직진 후 좌측 라인에 진입하세요</Text>
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
                {Math.floor(currentPace)}'{Math.round((currentPace % 1) * 60).toString().padStart(2, '0')}"
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
        </View>
      )}
    </ScrollView>
  );

  const renderCommunity = () => {
    const runs = [...COMMUNITY_RUNS, ...savedRuns.filter(run => run.shared)];
    const routeImages = [ROUTE_IMAGES.seoulForest, ROUTE_IMAGES.hangang, ROUTE_IMAGES.lake, ROUTE_IMAGES.cityPark];
    const detailRun = selectedCommunityId
      ? runs.find(run => run.id === selectedCommunityId)
      : null;
    const detailIndex = detailRun ? Math.max(0, runs.findIndex(run => run.id === detailRun.id)) : 0;
    const normalizedQuery = communityQuery.trim().toLowerCase();
    const filteredRuns = runs.filter(run => {
      const actions = communityActions[run.id] || {
        liked: false,
        saved: Boolean(run.saved),
      };
      const routeStart = run.startCoord || startCoord;
      const startDistance = distanceBetweenCoords(startCoord, routeStart);
      const searchText = [
        run.shape,
        run.location,
        run.author,
        run.description,
        ...(run.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery);
      const matchesFilter =
        communityFilter === '전체' ||
        (communityFilter === '인기' && (run.likes || 0) >= 1000) ||
        (communityFilter === '저장' && actions.saved) ||
        (communityFilter === '근처' && startDistance <= 1.2);

      return matchesQuery && matchesFilter;
    });

    if (detailRun) {
      const actions = communityActions[detailRun.id] || {
        liked: false,
        saved: Boolean(detailRun.saved),
      };
      const routeStart = detailRun.startCoord || startCoord;
      const startDistance = distanceBetweenCoords(startCoord, routeStart);
      const isNearStart = startDistance <= 1.2;
      const likes = (detailRun.likes || 320) + (actions.liked ? 1 : 0);
      const imageUri = routeImages[detailIndex % routeImages.length];

      return (
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={styles.panelContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.communityDetailHeader}>
            <TouchableOpacity
              style={styles.communityBackButton}
              onPress={() => setSelectedCommunityId(null)}
              activeOpacity={0.78}>
              <ChevronLeft size={22} color="#f8fafc" strokeWidth={2.8} />
            </TouchableOpacity>
            <View style={styles.communityDetailHeaderText}>
              <Text style={styles.communityDetailKicker}>ROUTE DETAIL</Text>
              <Text style={styles.communityDetailTitle}>{detailRun.shape} 루트</Text>
            </View>
          </View>

          <View style={styles.communityDetailMapCard}>
            <Image source={{uri: imageUri}} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.previewScrim} />
            <View style={styles.communityDetailMapTop}>
              <View style={styles.communityLocationPill}>
                <MapPin size={13} color="#fff" strokeWidth={2.5} />
                <Text style={styles.communityLocationPillText}>
                  {detailRun.location || '내 공유 루트'}
                </Text>
              </View>
              <View
                style={[
                  styles.communityStartBadge,
                  isNearStart && styles.communityStartBadgeOk,
                ]}>
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
            <View style={styles.communityDetailMapBottom}>
              <Text style={styles.communityDetailMapTitle}>전체 루트 지도</Text>
              <Text style={styles.communityDetailMapSub}>
                시작점 기준으로 루트를 불러와 러닝 탭에서 실제 경로를 생성합니다.
              </Text>
            </View>
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
                  {detailRun.author || '내 기록'} · 좋아요 {likes >= 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}
                </Text>
              </View>
              <View style={styles.communityAuthorBadge}>
                <Text style={styles.communityAuthorInitial}>
                  {(detailRun.author || '나').slice(0, 1)}
                </Text>
              </View>
            </View>
            <Text style={styles.communityDetailText}>
              {detailRun.description || '내가 완주한 러닝 아트 루트입니다. 같은 조건으로 다시 생성해서 달릴 수 있습니다.'}
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
              onPress={() => toggleCommunityAction(detailRun.id, 'liked')}
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
              style={styles.communityDetailIconAction}
              onPress={() => toggleCommunityAction(detailRun.id, 'saved')}
              activeOpacity={0.75}>
              <Bookmark
                size={19}
                color={actions.saved ? '#38bdf8' : '#94a3b8'}
                fill={actions.saved ? '#38bdf8' : 'transparent'}
                strokeWidth={2.4}
              />
              <Text style={styles.communityDetailIconActionText}>저장</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.communityDetailRunAction}
              onPress={() => handleUseCommunityRoute(detailRun)}
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
              onChangeText={setCommunityQuery}
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
                  onPress={() => setCommunityFilter(filter)}
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

        {filteredRuns.map((run, index) => {
          const actions = communityActions[run.id] || {
            liked: false,
            saved: Boolean(run.saved),
          };
          const likes = (run.likes || 320) + (actions.liked ? 1 : 0);
          const routeStart = run.startCoord || startCoord;
          const startDistance = distanceBetweenCoords(startCoord, routeStart);
          const isNearStart = startDistance <= 1.2;
          const imageUri = routeImages[index % routeImages.length];

          return (
            <TouchableOpacity
              key={run.id}
              style={styles.communityRouteCard}
              onPress={() => setSelectedCommunityId(run.id)}
              activeOpacity={0.86}>
              <View style={styles.communityRouteImageBox}>
                <Image source={{uri: imageUri}} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewScrim} />
                <View style={styles.communityImageTopRow}>
                  <View style={styles.communityLocationPill}>
                    <MapPin size={13} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.communityLocationPillText}>
                      {run.location || '내 공유 루트'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.communityStartBadge,
                      isNearStart && styles.communityStartBadgeOk,
                    ]}>
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
                  {run.author || '내 기록'} · 좋아요 {likes >= 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}
                </Text>

                <View style={styles.communityActionRow}>
                  <TouchableOpacity
                    style={styles.communityIconButton}
                    onPress={() => toggleCommunityAction(run.id, 'liked')}
                    activeOpacity={0.75}>
                    <Heart
                      size={18}
                      color={actions.liked ? '#38bdf8' : '#94a3b8'}
                      fill={actions.liked ? '#38bdf8' : 'transparent'}
                      strokeWidth={2.4}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.communityIconButton}
                    onPress={() => toggleCommunityAction(run.id, 'saved')}
                    activeOpacity={0.75}>
                    <Bookmark
                      size={18}
                      color={actions.saved ? '#38bdf8' : '#94a3b8'}
                      fill={actions.saved ? '#38bdf8' : 'transparent'}
                      strokeWidth={2.4}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.communityRunButton}
                    onPress={() => handleUseCommunityRoute(run)}
                    activeOpacity={0.84}>
                    <PlayCircle size={17} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.communityRunButtonText}>이 루트로 뛰기</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        {filteredRuns.length === 0 && (
          <View style={styles.communityEmptyBox}>
            <Text style={styles.communityEmptyTitle}>조건에 맞는 루트가 없습니다</Text>
            <Text style={styles.communityEmptyText}>검색어나 필터를 바꿔 다시 찾아보세요.</Text>
          </View>
        )}
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

  const isNavigationMode = activeTab === 'run';

  return (
    <View style={[styles.root, {paddingTop: isNavigationMode ? 0 : insets.top}]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={isNavigationMode ? 'transparent' : '#151c2b'}
        translucent={isNavigationMode}
      />
      {!isNavigationMode && (
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
      )}

      {activeTab === 'run' && (
        <View
          style={[
            styles.mapShell,
            activeTab === 'run' && styles.navigationMapShell,
          ]}>
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
          {routePhase === 'running' ? (
            <>
              <View style={styles.navigationBanner}>
                <View style={styles.navigationBannerIcon}>
                  <MapPinned size={17} color="#2f80ff" strokeWidth={2.7} />
                </View>
                <View style={styles.navigationBannerTextBox}>
                  <Text style={styles.navigationBannerTitle}>320m 앞 포인트 통과</Text>
                  <Text style={styles.navigationBannerSub}>별 모양 상단 라인을 따라가세요</Text>
                </View>
              </View>
              <View style={styles.navigationPacePill}>
                <Text style={styles.navigationPaceText}>{currentBpm} BPM</Text>
              </View>
            </>
          ) : (
            <View style={styles.mapOverlay}>
              <Text style={styles.mapTitle}>
                {routeStats ? `${routeStats.shapeLabel} 루트` : '출발지를 정하고 루트를 생성하세요'}
              </Text>
              <Text style={styles.mapSub}>
                {routeStats ? `${routeStats.distKm} km · 일치율 ${routeStats.matchPct}%` : '지도 탭으로 출발지 변경'}
              </Text>
            </View>
          )}
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

      <View
        style={[
          styles.contentShell,
          activeTab === 'run' && styles.navigationContentShell,
          activeTab === 'run' && sheetExpanded && styles.navigationContentShellExpanded,
        ]}>
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
        <FooterItem label="홈" icon="home" active={activeTab === 'home'} onPress={() => setActiveTab('home')} />
        <FooterItem label="러닝" icon="run" active={activeTab === 'run'} onPress={() => setActiveTab('run')} />
        <FooterItem label="공유" icon="community" active={activeTab === 'community'} onPress={() => setActiveTab('community')} />
        <FooterItem label="마이" icon="profile" active={activeTab === 'profile'} onPress={() => setActiveTab('profile')} />
      </View>
    </View>
  );
}
