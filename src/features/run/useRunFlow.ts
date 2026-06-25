import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import {Alert} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type WebView from 'react-native-webview';
import type {WebViewMessageEvent} from 'react-native-webview';
import {generateRoute, regenerateRoute} from '../../api/routeApi';
import {COMMUNITY_RUNS} from '../../constants/appData';
import {SHAPES} from '../../shapes';
import type {
  Activity,
  CommunityFilter,
  Preferences,
  RoutePhase,
  RouteStats,
  SavedRun,
  TabKey,
} from '../../types/app';
import {distanceBetweenCoords, parseDistanceKm, parsePaceMinutes} from '../../utils/geo';
import {createNaverStaticRouteMapUrl} from '../../utils/naverStaticMap';
import {formatDuration, inferPresetFromPrompt, shapeNameFromKey} from '../../utils/routeFormat';
import {ACTIVITY_API_TYPES, SHAPE_API_TYPES} from '../routing/routeConstants';
import {waitForRouteTask} from '../routing/routeTask';
import {useRunSession} from './useRunSession';

interface UseRunFlowParams {
  accessToken?: string;
  authName: string;
  savedRuns: SavedRun[];
  serverLikedRuns: SavedRun[];
  setActiveTab: (tab: TabKey) => void;
  setSavedRuns: Dispatch<SetStateAction<SavedRun[]>>;
  setSelectedCommunityId: (id: string | null) => void;
  setSheetSnap: (snap: 'expanded' | 'middle' | 'collapsed') => void;
}

export function useRunFlow({
  accessToken,
  authName,
  savedRuns,
  serverLikedRuns,
  setActiveTab,
  setSavedRuns,
  setSelectedCommunityId,
  setSheetSnap,
}: UseRunFlowParams) {
  const webViewRef = useRef<WebView>(null);

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
  const [pendingQuickGenerate, setPendingQuickGenerate] = useState(false);
  const [communityQuery, setCommunityQuery] = useState('');
  const [communityFilter, setCommunityFilter] = useState<CommunityFilter>('전체');
  const [communityActions, setCommunityActions] = useState<Record<string, {liked: boolean}>>({});

  const activeShapeKey = useMemo(
    () => (shapePrompt.trim() ? inferPresetFromPrompt(shapePrompt) : selectedShape),
    [selectedShape, shapePrompt],
  );

  const postToMap = useCallback((data: object) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  }, []);

  const resetRouteDraft = useCallback(() => {
    setRouteStats(null);
    setRoutePhase('idle');
  }, []);

  const {
    currentBpm,
    currentPace,
    handleNewRun: resetRunSession,
    handleSaveShareCard,
    handleStartRun,
    lastCompletedRunId,
    resetSession,
    runProgress,
    setRunProgress,
    setVoiceCue,
    shareCardSaved,
    voiceCue,
  } = useRunSession({
    authName,
    distance,
    postToMap,
    routePhase,
    routeStats,
    selectedShape,
    setActiveTab,
    setRoutePhase,
    setSavedRuns,
    setSheetSnap,
    shapePrompt,
    startCoord,
    targetPace,
  });

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
    const localLikedRuns = communityRuns.filter(run => communityActions[run.id]?.liked);
    return [...serverLikedRuns, ...localLikedRuns];
  }, [communityActions, savedRuns, serverLikedRuns]);

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
          resetRouteDraft();
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
    [
      distance,
      postToMap,
      resetRouteDraft,
      selectedShape,
      setVoiceCue,
      shapePrompt,
      startCoord,
    ],
  );

  const applyRouteTaskResult = useCallback(
    async (taskId: string, fallbackDistanceKm: number, readyMessagePrefix = '') => {
      const nextStats = await waitForRouteTask({
        accessToken,
        fallbackDistanceKm,
        selectedShape,
        shapePrompt,
        taskId,
        onStatus: setVoiceCue,
      });

      postToMap({
        type: 'DRAW_ROUTE',
        points: nextStats.routePoints,
        startLat: startCoord.lat,
        startLng: startCoord.lng,
      });
      setRouteStats(nextStats);
      setRoutePhase('ready');
      setVoiceCue(
        `${readyMessagePrefix}${nextStats.shapeLabel} ${Number(nextStats.distKm).toFixed(1)}km 루트가 준비되었습니다.`,
      );
    },
    [accessToken, postToMap, selectedShape, setVoiceCue, shapePrompt, startCoord],
  );

  const handleGenerate = useCallback(async () => {
    if (!mapReady || isGenerating) return;

    const shapeKey = activeShapeKey in SHAPES ? activeShapeKey : selectedShape;
    resetRouteDraft();
    setRunProgress(0);
    resetSession();
    setIsGenerating(true);
    setVoiceCue('AI가 모양과 거리에 맞는 러닝 루트를 설계하고 있습니다.');

    try {
      const generateResponse = await generateRoute(
        {
          requestText: shapePrompt,
          shapeType: SHAPE_API_TYPES[shapeKey] || shapePrompt,
          activityType: ACTIVITY_API_TYPES[activity],
          targetDistanceKm: distance,
          startPoint: startCoord,
          preferences: {
            avoidMainRoad: preferences.avoidMainRoad,
            preferPark: preferences.preferPark,
          },
        },
        accessToken,
      );
      setVoiceCue(generateResponse.data.message || '경로 생성 작업이 시작되었습니다.');
      await applyRouteTaskResult(generateResponse.data.taskId, distance);
    } catch (error) {
      const message = error instanceof Error ? error.message : '경로 생성 API 호출에 실패했습니다.';
      setIsGenerating(false);
      setRoutePhase('idle');
      Alert.alert('경로 생성 실패', message);
      setVoiceCue('경로 생성에 실패했습니다. 조건을 조정해 다시 시도해 주세요.');
      return;
    }
    setIsGenerating(false);
  }, [
    accessToken,
    activeShapeKey,
    activity,
    applyRouteTaskResult,
    distance,
    isGenerating,
    mapReady,
    preferences.avoidMainRoad,
    preferences.preferPark,
    resetRouteDraft,
    resetSession,
    selectedShape,
    setRunProgress,
    setVoiceCue,
    shapePrompt,
    startCoord,
  ]);

  useEffect(() => {
    if (!pendingQuickGenerate || !mapReady || isGenerating) return;
    setPendingQuickGenerate(false);
    handleGenerate();
  }, [handleGenerate, isGenerating, mapReady, pendingQuickGenerate]);

  const handleQuickGenerate = useCallback(() => {
    resetRouteDraft();
    setRunProgress(0);
    resetSession();
    setVoiceCue('홈에서 선택한 조건으로 빠르게 루트를 생성합니다.');
    setPendingQuickGenerate(true);
    setActiveTab('run');
  }, [resetRouteDraft, resetSession, setActiveTab, setRunProgress, setVoiceCue]);

  const handleRegenerate = useCallback(async () => {
    if (!routeStats?.routeId || isGenerating) {
      handleGenerate();
      return;
    }

    setIsGenerating(true);
    setRoutePhase('idle');
    setRunProgress(0);
    resetSession();
    setVoiceCue('기존 조건을 유지한 채 다른 도로 조합을 찾습니다.');

    try {
      const response = await regenerateRoute(routeStats.routeId, accessToken);
      setVoiceCue(response.data.message || '루트 재생성 작업이 시작되었습니다.');
      await applyRouteTaskResult(
        response.data.taskId,
        Number(routeStats.distKm) || distance,
        '재생성된 ',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '루트 재생성 API 호출에 실패했습니다.';
      setRoutePhase(routeStats ? 'ready' : 'idle');
      Alert.alert('루트 재생성 실패', message);
      setVoiceCue('루트 재생성에 실패했습니다. 조건을 조정해 다시 시도해 주세요.');
      return;
    } finally {
      setIsGenerating(false);
    }
  }, [
    accessToken,
    applyRouteTaskResult,
    distance,
    handleGenerate,
    isGenerating,
    resetSession,
    routeStats,
    setRunProgress,
    setVoiceCue,
  ]);

  const handleNewRun = useCallback(() => {
    setRouteStats(null);
    resetRunSession();
  }, [resetRunSession]);

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
  }, [setSavedRuns]);

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
  }, [savedRuns, setActiveTab, setSavedRuns, setSelectedCommunityId]);

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
      resetRouteDraft();
      setRunProgress(0);
      resetSession();
      setVoiceCue(`${run.location || '커뮤니티'} ${run.shape} 루트를 불러옵니다.`);
      setPendingQuickGenerate(true);
      setActiveTab('run');
    },
    [
      postToMap,
      resetRouteDraft,
      resetSession,
      setActiveTab,
      setRunProgress,
      setVoiceCue,
      startCoord,
    ],
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

  return {
    activity,
    averagePaceLabel,
    communityActions,
    communityFilter,
    communityQuery,
    currentBpm,
    currentPace,
    distance,
    elapsedTimeLabel,
    handleGenerate,
    handleGetLocation,
    handleMessage,
    handleNewRun,
    handleQuickGenerate,
    handleRegenerate,
    handleRegisterCompletedRun,
    handleSaveShareCard,
    handleStartRun,
    handleUseCommunityRoute,
    isGenerating,
    lastCompletedRunId,
    likedCommunityRuns,
    mapReady,
    pendingQuickGenerate,
    preferences,
    progressDistance,
    routePhase,
    routeStats,
    runProgress,
    setActivity,
    setCommunityFilter,
    setCommunityQuery,
    setDistance,
    setPreferences,
    setRoutePhase,
    setRouteStats,
    setSelectedShape,
    setShapePrompt,
    setTargetPace,
    shareCardSaved,
    shareMapImageUrl,
    shapePrompt,
    selectedShape,
    startCoord,
    targetPace,
    toggleCommunityAction,
    toggleShare,
    voiceCue,
    webViewRef,
  };
}
