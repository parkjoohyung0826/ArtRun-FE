import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  MapPinned,
} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import {MAP_HTML} from './mapHtml';
import {SHAPES} from './shapes';
import {NAVER_MAP_WEB_BASE_URL} from './config';
import {FooterItem} from './components/AppChrome';
import {
  ACTIVITY_PROFILES,
  COMMUNITY_RUNS,
  INITIAL_RUNS,
} from './constants/appData';
import {styles} from './styles/appStyles';
import {GREEN} from './styles/theme';
import {AuthScreen} from './screens/AuthScreen';
import {CommunityScreen} from './screens/CommunityScreen';
import {HomeScreen} from './screens/HomeScreen';
import {ProfileScreen} from './screens/ProfileScreen';
import {RunModeScreen} from './screens/RunModeScreen';
import {RunPlanScreen} from './screens/RunPlanScreen';
import type {
  Activity,
  AuthMode,
  CommunityFilter,
  Preferences,
  RoutePhase,
  RouteStats,
  SavedRun,
  TabKey,
} from './types/app';
import {distanceBetweenCoords, parseDistanceKm, parsePaceMinutes} from './utils/geo';
import {createNaverStaticRouteMapUrl} from './utils/naverStaticMap';
import {formatDuration, inferPresetFromPrompt, shapeNameFromKey} from './utils/routeFormat';

const SHEET_EXPANDED_OFFSET = 0;
const SHEET_COLLAPSED_VISIBLE_HEIGHT = 188;
const FOOTER_BASE_HEIGHT = 66;
type SheetSnap = 'expanded' | 'middle' | 'collapsed';

export default function ShapeRunApp() {
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const webViewRef = useRef<WebView>(null);
  const runTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sheetOffset = useRef(new Animated.Value(520)).current;
  const sheetOffsetPosition = useRef(520);

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
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('collapsed');
  const [shareCardSaved, setShareCardSaved] = useState(false);
  const [lastCompletedRunId, setLastCompletedRunId] = useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [communityQuery, setCommunityQuery] = useState('');
  const [communityFilter, setCommunityFilter] = useState<CommunityFilter>('전체');
  const [communityActions, setCommunityActions] = useState<
    Record<string, {liked: boolean}>
  >({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authName, setAuthName] = useState('Art Runner');
  const [authEmail, setAuthEmail] = useState('runner@artrun.app');
  const [authPassword, setAuthPassword] = useState('');
  const [selectedProfileRunId, setSelectedProfileRunId] = useState<string | null>(null);
  const footerHeight = FOOTER_BASE_HEIGHT + Math.max(insets.bottom, 8);
  const runStageHeight = Math.max(0, windowHeight - footerHeight);
  const sheetHeight = Math.max(560, runStageHeight - 34);
  const sheetCollapsedOffset = Math.max(0, sheetHeight - SHEET_COLLAPSED_VISIBLE_HEIGHT);
  const sheetMiddleOffset = Math.round(sheetCollapsedOffset * 0.52);
  const sheetCurrentOffset =
    sheetSnap === 'expanded'
      ? SHEET_EXPANDED_OFFSET
      : sheetSnap === 'middle'
        ? sheetMiddleOffset
        : sheetCollapsedOffset;
  const sheetScrollBottomInset = Math.max(40, sheetCurrentOffset + 56);
  const sheetSnapPoints = useMemo(
    () => [SHEET_EXPANDED_OFFSET, sheetMiddleOffset, sheetCollapsedOffset],
    [sheetCollapsedOffset, sheetMiddleOffset],
  );
  const nearestSheetSnap = useCallback(
    (value: number) =>
      sheetSnapPoints.reduce((nearest, point) =>
        Math.abs(point - value) < Math.abs(nearest - value) ? point : nearest,
      ),
    [sheetSnapPoints],
  );

  useEffect(() => {
    return () => {
      if (runTimer.current) clearInterval(runTimer.current);
    };
  }, []);

  useEffect(() => {
    const target =
      sheetSnap === 'expanded'
        ? SHEET_EXPANDED_OFFSET
        : sheetSnap === 'middle'
          ? sheetMiddleOffset
          : sheetCollapsedOffset;
    sheetOffsetPosition.current = target;
    sheetOffset.setValue(target);
  }, [sheetCollapsedOffset, sheetMiddleOffset, sheetOffset, sheetSnap]);

  const finishRun = useCallback(() => {
    if (runTimer.current) clearInterval(runTimer.current);
    setRoutePhase('complete');
    setVoiceCue('러닝을 완료했습니다. 루트 완주 기록이 저장되었습니다.');
    const completedRunId = `r${Date.now()}`;
    setLastCompletedRunId(completedRunId);
    setSavedRuns(prev => {
      const newRun: SavedRun = {
        id: completedRunId,
        shape: shapeNameFromKey(selectedShape, shapePrompt),
        distance: `${distance.toFixed(1)} km`,
        pace: `${Math.floor(targetPace)}'${Math.round((targetPace % 1) * 60)
          .toString()
          .padStart(2, '0')}"`,
        matchPct: routeStats?.matchPct || 92,
        shared: false,
        author: authName,
        location: '내 완주 루트',
        likes: 0,
        description: `${shapeNameFromKey(selectedShape, shapePrompt)} 모양으로 완주한 ${distance.toFixed(1)}km 러닝 아트 루트입니다.`,
        tags: ['완주 인증', '내 기록', shapeNameFromKey(selectedShape, shapePrompt)],
        startCoord,
      };
      return [newRun, ...prev];
    });
  }, [authName, distance, routeStats?.matchPct, selectedShape, shapePrompt, startCoord, targetPace]);

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
  const averagePaceLabel = useMemo(
    () =>
      `${Math.floor(targetPace)}'${Math.round((targetPace % 1) * 60)
        .toString()
        .padStart(2, '0')}"`,
    [targetPace],
  );
  const elapsedTimeLabel = useMemo(
    () => formatDuration(Math.round(distance * targetPace * 60), distance),
    [distance, targetPace],
  );
  const shareMapImageUrl = useMemo(
    () => createNaverStaticRouteMapUrl(routeStats?.routePoints || []),
    [routeStats?.routePoints],
  );
  const likedCommunityRuns = useMemo(() => {
    const communityRuns = [...COMMUNITY_RUNS, ...savedRuns.filter(run => run.shared)];
    return communityRuns.filter(run => communityActions[run.id]?.liked);
  }, [communityActions, savedRuns]);

  const animateSheetTo = useCallback(
    (toValue: number) => {
      sheetOffsetPosition.current = toValue;
      setSheetSnap(
        toValue === SHEET_EXPANDED_OFFSET
          ? 'expanded'
          : toValue === sheetCollapsedOffset
            ? 'collapsed'
            : 'middle',
      );
      Animated.spring(sheetOffset, {
        toValue,
        useNativeDriver: true,
        tension: 90,
        friction: 14,
      }).start();
    },
    [sheetCollapsedOffset, sheetOffset],
  );

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          sheetOffset.stopAnimation(value => {
            sheetOffsetPosition.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const next = Math.max(
            SHEET_EXPANDED_OFFSET,
            Math.min(sheetCollapsedOffset, sheetOffsetPosition.current + gesture.dy),
          );
          sheetOffset.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const next = Math.max(
            SHEET_EXPANDED_OFFSET,
            Math.min(sheetCollapsedOffset, sheetOffsetPosition.current + gesture.dy),
          );
          const projected = Math.max(
            SHEET_EXPANDED_OFFSET,
            Math.min(sheetCollapsedOffset, next + gesture.vy * 120),
          );
          animateSheetTo(nearestSheetSnap(projected));
        },
        onPanResponderTerminate: () => {
          sheetOffset.stopAnimation(value => {
            animateSheetTo(nearestSheetSnap(value));
          });
        },
      }),
    [animateSheetTo, nearestSheetSnap, sheetCollapsedOffset, sheetOffset],
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
            routePoints: Array.isArray(msg.routePoints) ? msg.routePoints : [],
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
    setSheetSnap('expanded');
    setRunProgress(0);
    setShareCardSaved(false);
    setLastCompletedRunId(null);
    setCurrentPace(targetPace);
    setCurrentBpm(156);
    setVoiceCue(`${routeStats.shapeLabel} 러닝을 시작합니다. 첫 구간은 목표 페이스로 진입하세요.`);
  }, [routeStats, targetPace]);

  const handleNewRun = useCallback(() => {
    setRoutePhase('idle');
    setRouteStats(null);
    setRunProgress(0);
    setShareCardSaved(false);
    setLastCompletedRunId(null);
    setVoiceCue('새 러닝 루트를 생성할 준비가 되었습니다.');
  }, []);

  const handleSaveShareCard = useCallback(() => {
    setShareCardSaved(true);
    Alert.alert(
      '공유 카드 저장',
      'SNS 공유용 러닝 카드가 저장되었습니다. 실제 갤러리 저장은 네이티브 저장 권한 연동 단계에서 연결하면 됩니다.',
    );
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

  const handleRegisterCompletedRun = useCallback((id: string | null) => {
    if (!id) {
      Alert.alert('등록 불가', '완주 기록이 저장된 뒤 커뮤니티에 등록할 수 있습니다.');
      return;
    }

    const targetRun = savedRuns.find(run => run.id === id);
    if (!targetRun) {
      Alert.alert('등록 불가', '저장된 완주 기록을 찾을 수 없습니다.');
      return;
    }

    setSavedRuns(prev =>
      prev.map(run => (run.id === id ? {...run, shared: true} : run)),
    );
    Alert.alert('커뮤니티 등록 완료', `${targetRun.shape} 루트가 커뮤니티에 등록되었습니다.`);
    setActiveTab('community');
    setSelectedCommunityId(id);
  }, [savedRuns]);

  const toggleCommunityAction = useCallback((id: string) => {
    setCommunityActions(prev => {
      const current = prev[id] || {liked: false};
      return {
        ...prev,
        [id]: {
          liked: !current.liked,
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

  const handleAuthSubmit = useCallback(() => {
    setIsAuthenticated(true);
    setAuthMode('login');
    setAuthPassword('');
    setActiveTab('home');
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('로그아웃', '현재 계정에서 로그아웃할까요?', [
      {text: '취소', style: 'cancel'},
      {
        text: '로그아웃',
        onPress: () => {
          setIsAuthenticated(false);
          setAuthMode('login');
          setAuthPassword('');
          setSelectedProfileRunId(null);
        },
      },
    ]);
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      '회원탈퇴',
      '계정과 러닝 기록이 삭제되는 흐름입니다. 지금은 API 연결 전이라 화면 상태만 초기화합니다.',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: () => {
            setIsAuthenticated(false);
            setAuthMode('signup');
            setAuthPassword('');
            setSavedRuns(INITIAL_RUNS);
            setSelectedProfileRunId(null);
          },
        },
      ],
    );
  }, []);

  const renderPlan = () => (
    <RunPlanScreen
      sheetPanResponder={sheetPanResponder}
      activity={activity}
      preferences={preferences}
      shapePrompt={shapePrompt}
      selectedShape={selectedShape}
      distance={distance}
      targetPace={targetPace}
      startCoord={startCoord}
      routeStats={routeStats}
      isGenerating={isGenerating}
      mapReady={mapReady}
      sheetScrollBottomInset={sheetScrollBottomInset}
      onGoHome={() => setActiveTab('home')}
      onChangeShapePrompt={text => {
        setShapePrompt(text);
        setRouteStats(null);
        setRoutePhase('idle');
      }}
      onSelectShape={item => {
        setSelectedShape(item.key);
        setShapePrompt(item.label);
        setRouteStats(null);
        setRoutePhase('idle');
      }}
      onChangeDistance={value => {
        setDistance(value);
        setRouteStats(null);
        setRoutePhase('idle');
      }}
      onChangeTargetPace={setTargetPace}
      onChangeActivity={setActivity}
      onChangePreferences={setPreferences}
      onGetLocation={handleGetLocation}
      onRegenerate={handleRegenerate}
      onGenerate={handleGenerate}
      onStartRun={handleStartRun}
    />
  );

  const renderHome = () => (
    <HomeScreen
      shapePrompt={shapePrompt}
      distance={distance}
      pendingQuickGenerate={pendingQuickGenerate}
      onChangeShapePrompt={text => {
        setShapePrompt(text);
        setRouteStats(null);
        setRoutePhase('idle');
      }}
      onSelectPresetShape={item => {
        setSelectedShape(item.key);
        setShapePrompt(item.label);
      }}
      onSelectDistance={setDistance}
      onQuickGenerate={handleQuickGenerate}
      onOpenRun={() => setActiveTab('run')}
      onOpenCommunity={() => setActiveTab('community')}
    />
  );

  const renderRunMode = () => (
    <RunModeScreen
      sheetPanResponder={sheetPanResponder}
      routePhase={routePhase}
      shapePrompt={shapePrompt}
      distance={distance}
      routeStats={routeStats}
      currentBpm={currentBpm}
      runProgress={runProgress}
      progressDistance={progressDistance}
      currentPace={currentPace}
      voiceCue={voiceCue}
      sheetScrollBottomInset={sheetScrollBottomInset}
      averagePaceLabel={averagePaceLabel}
      elapsedTimeLabel={elapsedTimeLabel}
      shareMapImageUrl={shareMapImageUrl}
      shareCardSaved={shareCardSaved}
      completedRunId={lastCompletedRunId}
      completedRunShared={savedRuns.some(run => run.id === lastCompletedRunId && run.shared)}
      onSaveShareCard={handleSaveShareCard}
      onRegisterCommunity={handleRegisterCompletedRun}
      onGoHome={() => setActiveTab('home')}
      onNewRun={handleNewRun}
    />
  );

  const renderCommunity = () => (
    <CommunityScreen
      savedRuns={savedRuns}
      communityActions={communityActions}
      selectedCommunityId={selectedCommunityId}
      communityQuery={communityQuery}
      communityFilter={communityFilter}
      startCoord={startCoord}
      onSelectCommunityId={setSelectedCommunityId}
      onChangeQuery={setCommunityQuery}
      onChangeFilter={setCommunityFilter}
      onToggleAction={toggleCommunityAction}
      onUseRoute={handleUseCommunityRoute}
    />
  );

  const renderAuth = () => (
    <AuthScreen
      authMode={authMode}
      authName={authName}
      authEmail={authEmail}
      authPassword={authPassword}
      onChangeAuthMode={setAuthMode}
      onChangeName={setAuthName}
      onChangeEmail={setAuthEmail}
      onChangePassword={setAuthPassword}
      onSubmit={handleAuthSubmit}
    />
  );

  const renderProfile = () => (
    <ProfileScreen
      authName={authName}
      authEmail={authEmail}
      savedRuns={savedRuns}
      likedRuns={likedCommunityRuns}
      preferences={preferences}
      selectedRunId={selectedProfileRunId}
      onSelectRun={setSelectedProfileRunId}
      onToggleShare={toggleShare}
      onRegisterCommunity={handleRegisterCompletedRun}
      onChangePreferences={setPreferences}
      onLogout={handleLogout}
      onDeleteAccount={handleDeleteAccount}
    />
  );

  const isNavigationMode = activeTab === 'run';

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, {paddingTop: insets.top}]}>
        <StatusBar barStyle="light-content" backgroundColor="#151c2b" />
        <View style={styles.contentShell}>{renderAuth()}</View>
      </View>
    );
  }

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

      {activeTab === 'run' ? (
        <View style={styles.runNavigationStage}>
          <View style={[styles.mapShell, styles.navigationMapShell, styles.navigationMapFull]}>
            <WebView
              ref={webViewRef}
              source={{html: MAP_HTML, baseUrl: NAVER_MAP_WEB_BASE_URL}}
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
              </>
            ) : null}
            {(isGenerating || !mapReady) && (
              <View style={styles.loadingOverlay}>
                <View style={styles.loadingCard}>
                  <ActivityIndicator color={GREEN} size="large" />
                  <Text style={styles.loadingText}>{mapReady ? 'AI 경로 생성 중' : '지도 준비 중'}</Text>
                </View>
              </View>
            )}
          </View>

          <Animated.View
            style={[
              styles.navigationSheetLayer,
              {
                height: sheetHeight,
                transform: [{translateY: sheetOffset}],
              },
            ]}>
            {routePhase === 'running' || routePhase === 'complete'
              ? renderRunMode()
              : renderPlan()}
          </Animated.View>
        </View>
      ) : (
        <View style={styles.contentShell}>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'community' && renderCommunity()}
          {activeTab === 'profile' && renderProfile()}
        </View>
      )}

      <View style={[styles.footer, {paddingBottom: Math.max(insets.bottom, 8)}]}>
        <FooterItem label="홈" icon="home" active={activeTab === 'home'} onPress={() => setActiveTab('home')} />
        <FooterItem label="러닝" icon="run" active={activeTab === 'run'} onPress={() => setActiveTab('run')} />
        <FooterItem label="공유" icon="community" active={activeTab === 'community'} onPress={() => setActiveTab('community')} />
        <FooterItem label="마이" icon="profile" active={activeTab === 'profile'} onPress={() => setActiveTab('profile')} />
      </View>
    </View>
  );
}
