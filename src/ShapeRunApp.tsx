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
import {
  login,
  logout,
  signup,
  withdraw,
} from './api/authApi';
import type {AuthResponse} from './api/authApi';
import {
  deleteMyRecord,
  getLikedRoutes,
  getMe,
  getMyRecord,
  getMyRecords,
  getMySharedRoutes,
  getSummary,
  updateMe,
} from './api/userApi';
import type {
  CommunityRouteResponse,
  MyPageSummaryResponse,
  RecordDetailResponse,
} from './api/userApi';
import {
  generateRoute,
  getRouteStatus,
  saveRecord,
  startSession,
  trackLocation,
} from './api/routeApi';
import {MAP_HTML} from './mapHtml';
import {SHAPES} from './shapes';
import {NAVER_MAP_WEB_BASE_URL} from './config';
import {FooterItem} from './components/AppChrome';
import {
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
  Coordinate,
  Preferences,
  ProfileSummary,
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

const ROUTE_STATUS_DONE = new Set(['COMPLETED', 'COMPLETE', 'DONE', 'SUCCESS']);
const ROUTE_STATUS_FAILED = new Set(['FAILED', 'FAIL', 'ERROR']);
const SHAPE_API_TYPES: Record<string, string> = {
  star: 'STAR',
  heart: 'HEART',
  circle: 'CIRCLE',
  dog: 'DOG',
  cat: 'CAT',
};
const ACTIVITY_API_TYPES: Record<Activity, string> = {
  Running: 'RUNNING',
  Walking: 'WALKING',
  Cycling: 'CYCLING',
};
const START_DISTANCE_LIMIT_KM = 0.2;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms));

const formatPaceFromRecord = (distanceMeters?: number, totalTimeSeconds?: number) => {
  if (!distanceMeters || !totalTimeSeconds) return '-';
  const paceSeconds = totalTimeSeconds / (distanceMeters / 1000);
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}'${seconds}"`;
};

const firstPoint = (points?: Coordinate[]) =>
  Array.isArray(points) && points.length > 0 ? points[0] : undefined;

const recordToSavedRun = (
  record: RecordDetailResponse,
  sharedRouteIds: Set<string>,
  author: string,
): SavedRun => {
  const routeId = record.routeId || '';
  return {
    id: record.recordId,
    recordId: record.recordId,
    routeId,
    shape: routeId ? `루트 ${routeId.slice(0, 4)}` : '완주',
    distance: `${((record.totalDistanceMeters || 0) / 1000).toFixed(1)} km`,
    pace: formatPaceFromRecord(record.totalDistanceMeters, record.totalTimeSeconds),
    matchPct: 100,
    shared: routeId ? sharedRouteIds.has(routeId) : false,
    author,
    location: '내 완주 루트',
    likes: 0,
    description: '서버에 저장된 완주 기록입니다.',
    tags: ['완주 기록', '서버 동기화'],
    startCoord: firstPoint(record.actualPolyline) || firstPoint(record.plannedPolyline),
    imageUrl: record.imageUrl,
    createdAt: record.createdAt,
  };
};

const communityRouteToSavedRun = (route: CommunityRouteResponse): SavedRun => ({
  id: route.communityRouteId,
  communityRouteId: route.communityRouteId,
  routeId: route.routeId,
  shape: route.title || '커뮤니티 루트',
  distance: `${((route.distanceMeters || 0) / 1000).toFixed(1)} km`,
  pace: formatPaceFromRecord(route.distanceMeters, route.totalTimeSeconds),
  matchPct: 100,
  shared: true,
  author: route.author?.nickname || route.author?.email || '커뮤니티 러너',
  location: '커뮤니티 루트',
  likes: route.likeCount || 0,
  description: route.description,
  tags: route.liked ? ['좋아요', '커뮤니티'] : ['공유', '커뮤니티'],
  startCoord: firstPoint(route.polyline),
  imageUrl: route.imageUrl,
  createdAt: route.createdAt,
});

export default function ShapeRunApp() {
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const webViewRef = useRef<WebView>(null);
  const runWatchId = useRef<number | null>(null);
  const runStartedAt = useRef<number | null>(null);
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gpsPoints, setGpsPoints] = useState<Array<Coordinate & {timestamp: number}>>([]);
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
  const [authSession, setAuthSession] = useState<AuthResponse | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  const [serverLikedRuns, setServerLikedRuns] = useState<SavedRun[]>([]);
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
      if (runWatchId.current !== null) {
        Geolocation.clearWatch(runWatchId.current);
      }
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

  const finishRun = useCallback(async () => {
    if (runWatchId.current !== null) {
      Geolocation.clearWatch(runWatchId.current);
      runWatchId.current = null;
    }
    setRoutePhase('complete');
    setVoiceCue('러닝을 완료했습니다. 루트 완주 기록이 저장되었습니다.');
    const completedRunId = `r${Date.now()}`;
    setLastCompletedRunId(completedRunId);
    const totalTimeSeconds = runStartedAt.current
      ? Math.max(1, Math.round((Date.now() - runStartedAt.current) / 1000))
      : Math.round(distance * targetPace * 60);
    let savedRecord: {recordId?: string; imageUrl?: string} = {};

    if (sessionId && routeStats?.routeId) {
      try {
        const response = await saveRecord({
          sessionId,
          routeId: routeStats.routeId,
          gpsPoints: gpsPoints.length
            ? gpsPoints
            : routeStats.routePoints.map(point => ({...point, timestamp: Date.now()})),
          totalTimeSeconds,
        });
        savedRecord = {
          recordId: response.data.recordId,
          imageUrl: response.data.imageUrl,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : '기록 저장 API 호출에 실패했습니다.';
        setVoiceCue(`완주는 완료했지만 서버 기록 저장에 실패했습니다. ${message}`);
      }
    }

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
        recordId: savedRecord.recordId,
        imageUrl: savedRecord.imageUrl,
      };
      return [newRun, ...prev];
    });
    setSessionId(null);
  }, [
    authName,
    distance,
    gpsPoints,
    routeStats,
    selectedShape,
    sessionId,
    shapePrompt,
    startCoord,
    targetPace,
  ]);

  useEffect(() => {
    if (routePhase !== 'running' || !sessionId) return;

    runWatchId.current = Geolocation.watchPosition(
      position => {
        const {latitude, longitude, speed} = position.coords;
        const currentPoint = {lat: latitude, lng: longitude};
        const timestamp = position.timestamp || Date.now();
        const gpsPoint = {...currentPoint, timestamp};
        const speedMps = typeof speed === 'number' && speed > 0 ? speed : 0;
        const pace = speedMps > 0 ? Math.max(3, Math.min(12, 1000 / speedMps / 60)) : targetPace;

        setGpsPoints(points => [...points, gpsPoint]);
        setCurrentPace(Number(pace.toFixed(2)));
        setCurrentBpm(
          pace > targetPace + 0.15
            ? 164
            : pace < targetPace - 0.15
              ? 148
              : 156,
        );
        webViewRef.current?.postMessage(
          JSON.stringify({type: 'UPDATE_RUNNER', location: currentPoint}),
        );

        trackLocation(sessionId, {
          ...currentPoint,
          timestamp,
          currentSpeed: speedMps,
        })
          .then(response => {
            const data = response.data;
            const completionRate = Number(data.completionRate || 0);
            const nextProgress = completionRate > 1 ? completionRate / 100 : completionRate;

            if (Number.isFinite(nextProgress)) {
              setRunProgress(prev => {
                const normalized = Math.min(1, Math.max(prev, nextProgress));
                if (prev < 0.5 && normalized >= 0.5) {
                  setVoiceCue(`${shapeNameFromKey(selectedShape, shapePrompt)}의 반을 완성했습니다.`);
                }
                return normalized;
              });
            }

            if (!data.onRoute && data.warningMessage) {
              setVoiceCue(data.warningMessage);
            } else if (data.warningMessage) {
              setVoiceCue(data.warningMessage);
            } else if (data.distanceRemaining > 0) {
              setVoiceCue(`남은 거리 ${Math.round(data.distanceRemaining)}m입니다.`);
            } else {
              setVoiceCue('목표 페이스를 유지하고 있습니다.');
            }

            if (nextProgress >= 1 || data.distanceRemaining <= 10) {
              finishRun();
            }
          })
          .catch(error => {
            const message = error instanceof Error ? error.message : '위치 검증 실패';
            setVoiceCue(`위치 검증에 실패했습니다. ${message}`);
          });
      },
      () => {
        setVoiceCue('GPS 위치를 가져오지 못했습니다. 위치 권한과 신호를 확인해 주세요.');
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5,
        interval: 3000,
        fastestInterval: 1500,
      },
    );

    return () => {
      if (runWatchId.current !== null) {
        Geolocation.clearWatch(runWatchId.current);
        runWatchId.current = null;
      }
    };
  }, [
    finishRun,
    routePhase,
    selectedShape,
    sessionId,
    shapePrompt,
    targetPace,
  ]);

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
    const localLikedRuns = communityRuns.filter(run => communityActions[run.id]?.liked);
    return [...serverLikedRuns, ...localLikedRuns];
  }, [communityActions, savedRuns, serverLikedRuns]);

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

  const handleGenerate = useCallback(async () => {
    if (!mapReady || isGenerating) return;

    const shapeKey = activeShapeKey in SHAPES ? activeShapeKey : selectedShape;
    setRouteStats(null);
    setRoutePhase('idle');
    setRunProgress(0);
    setIsGenerating(true);
    setSessionId(null);
    setGpsPoints([]);
    setVoiceCue('AI가 모양과 거리에 맞는 러닝 루트를 설계하고 있습니다.');

    try {
      const generateResponse = await generateRoute({
        requestText: shapePrompt,
        shapeType: SHAPE_API_TYPES[shapeKey] || shapePrompt,
        activityType: ACTIVITY_API_TYPES[activity],
        targetDistanceKm: distance,
        startPoint: startCoord,
        preferences: {
          avoidMainRoad: preferences.avoidMainRoad,
          preferPark: preferences.preferPark,
        },
      });
      const taskId = generateResponse.data.taskId;
      setVoiceCue(generateResponse.data.message || '경로 생성 작업이 시작되었습니다.');

      for (let attempt = 0; attempt < 30; attempt += 1) {
        await sleep(attempt === 0 ? 700 : 1500);
        const statusResponse = await getRouteStatus(taskId);
        const status = statusResponse.data.status?.toUpperCase?.() || '';

        if (ROUTE_STATUS_FAILED.has(status)) {
          throw new Error(statusResponse.data.errorMessage || '경로 생성에 실패했습니다.');
        }

        if (ROUTE_STATUS_DONE.has(status)) {
          const candidate = statusResponse.data.candidateRoutes?.[0];
          if (!candidate || !candidate.polyline?.length) {
            throw new Error('생성된 후보 경로가 없습니다.');
          }

          const shapeLabel = shapeNameFromKey(selectedShape, shapePrompt);
          const routeDistanceKm = candidate.distance || distance;
          postToMap({
            type: 'DRAW_ROUTE',
            points: candidate.polyline,
            startLat: startCoord.lat,
            startLng: startCoord.lng,
          });
          setRouteStats({
            routeId: candidate.routeId,
            distKm: routeDistanceKm.toFixed(2),
            duration: formatDuration(null, routeDistanceKm),
            matchPct: Math.round(
              candidate.similarityScore <= 1
                ? candidate.similarityScore * 100
                : candidate.similarityScore || 90,
            ),
            shapeLabel,
            routePoints: candidate.polyline,
          });
          setRoutePhase('ready');
          setVoiceCue(`${shapeLabel} ${routeDistanceKm.toFixed(1)}km 루트가 준비되었습니다.`);
          setIsGenerating(false);
          return;
        }

        setVoiceCue(`경로 생성 중입니다. 상태: ${status || 'PROCESSING'}`);
      }

      throw new Error('경로 생성 시간이 초과되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '경로 생성 API 호출에 실패했습니다.';
      setIsGenerating(false);
      setRoutePhase('idle');
      Alert.alert('경로 생성 실패', message);
      setVoiceCue('경로 생성에 실패했습니다. 조건을 조정해 다시 시도해 주세요.');
    }
  }, [
    activeShapeKey,
    activity,
    distance,
    isGenerating,
    mapReady,
    preferences.avoidMainRoad,
    preferences.preferPark,
    postToMap,
    selectedShape,
    shapePrompt,
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
    setSessionId(null);
    setGpsPoints([]);
    setVoiceCue('홈에서 선택한 조건으로 빠르게 루트를 생성합니다.');
    setPendingQuickGenerate(true);
    setActiveTab('run');
  }, []);

  const handleRegenerate = useCallback(() => {
    setVoiceCue('이전 조건을 유지한 채 다른 도로 조합을 찾습니다.');
    handleGenerate();
  }, [handleGenerate]);

  const handleStartRun = useCallback(async () => {
    if (!routeStats?.routeId) {
      Alert.alert('러닝 시작 불가', '서버에서 생성된 경로를 먼저 선택해야 합니다.');
      return;
    }

    try {
      const currentPosition = await new Promise<Coordinate>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          position =>
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }),
          reject,
          {enableHighAccuracy: true, timeout: 12000, maximumAge: 5000},
        );
      });
      const routeStart = routeStats.routePoints[0] || startCoord;
      const startDistanceKm = distanceBetweenCoords(currentPosition, routeStart);

      if (startDistanceKm > START_DISTANCE_LIMIT_KM) {
        Alert.alert(
          '출발지와 거리가 멉니다',
          `현재 위치가 루트 시작점에서 약 ${(startDistanceKm * 1000).toFixed(0)}m 떨어져 있습니다. 시작점 근처에서 러닝을 시작해 주세요.`,
        );
        return;
      }

      const response = await startSession(routeStats.routeId);
      setSessionId(response.data.sessionId);
      setActiveTab('run');
      setRoutePhase('running');
      setSheetSnap('expanded');
      setRunProgress(0);
      setGpsPoints([]);
      setGpsPoints([{...currentPosition, timestamp: Date.now()}]);
      setShareCardSaved(false);
      setLastCompletedRunId(null);
      setCurrentPace(targetPace);
      setCurrentBpm(156);
      runStartedAt.current = Date.now();
      postToMap({type: 'UPDATE_RUNNER', location: currentPosition});
      setVoiceCue(response.data.message || `${routeStats.shapeLabel} 러닝을 시작합니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GPS 확인 또는 세션 시작에 실패했습니다.';
      Alert.alert('러닝 시작 실패', message);
    }
  }, [postToMap, routeStats, startCoord, targetPace]);

  const handleNewRun = useCallback(() => {
    setRoutePhase('idle');
    setRouteStats(null);
    setRunProgress(0);
    setSessionId(null);
    setGpsPoints([]);
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

  const loadUserProfileData = useCallback(
    async (accessToken = authSession?.accessToken) => {
      if (!accessToken) return;

      setIsProfileLoading(true);
      setProfileError(null);
      try {
        const [meResult, summaryResult, recordsResult, sharedResult, likedResult] =
          await Promise.allSettled([
            getMe(accessToken),
            getSummary(accessToken),
            getMyRecords(accessToken, {page: 0, size: 50, sort: ['createdAt,desc']}),
            getMySharedRoutes(accessToken, {page: 0, size: 50, sort: ['createdAt,desc']}),
            getLikedRoutes(accessToken, {page: 0, size: 50, sort: ['createdAt,desc']}),
          ]);

        let nextName = authName;

        if (meResult.status === 'fulfilled') {
          nextName = meResult.value.data.nickname || meResult.value.data.email;
          setAuthName(nextName);
          setAuthEmail(meResult.value.data.email);
        }

        if (summaryResult.status === 'fulfilled') {
          const summary = summaryResult.value.data as MyPageSummaryResponse;
          setProfileSummary({
            totalRuns: summary.totalRuns,
            totalDistanceKm: summary.totalDistanceKm,
            totalTimeSeconds: summary.totalTimeSeconds,
            averagePaceMinPerKm: summary.averagePaceMinPerKm,
          });
          nextName = summary.user.nickname || summary.user.email || nextName;
          setAuthName(nextName);
          setAuthEmail(summary.user.email);
        }

        const sharedRoutes =
          sharedResult.status === 'fulfilled' ? sharedResult.value.data.content : [];
        const sharedRouteIds = new Set(
          sharedRoutes.map(route => route.routeId).filter(Boolean) as string[],
        );

        if (recordsResult.status === 'fulfilled') {
          setSavedRuns(
            recordsResult.value.data.content.map(record =>
              recordToSavedRun(record, sharedRouteIds, nextName),
            ),
          );
        }

        if (likedResult.status === 'fulfilled') {
          setServerLikedRuns(
            likedResult.value.data.content.map(route => communityRouteToSavedRun(route)),
          );
        }

        const failures = [
          meResult,
          summaryResult,
          recordsResult,
          sharedResult,
          likedResult,
        ].filter(result => result.status === 'rejected');

        if (failures.length > 0) {
          setProfileError('일부 프로필 데이터를 불러오지 못했습니다.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '프로필 조회에 실패했습니다.';
        setProfileError(message);
      } finally {
        setIsProfileLoading(false);
      }
    },
    [authName, authSession?.accessToken],
  );

  const applyAuthSession = useCallback((session: AuthResponse) => {
    setAuthSession(session);
    setIsAuthenticated(true);
    setAuthName(session.user.nickname || session.user.email);
    setAuthEmail(session.user.email);
    setAuthMode('login');
    setAuthPassword('');
    setActiveTab('home');
    loadUserProfileData(session.accessToken);
  }, [loadUserProfileData]);

  const handleAuthSubmit = useCallback(async () => {
    const email = authEmail.trim();
    const password = authPassword;
    const nickname = authName.trim();

    if (!email || !password || (authMode === 'signup' && !nickname)) {
      Alert.alert('입력 확인', '이메일, 비밀번호, 닉네임을 입력해 주세요.');
      return;
    }

    if (authMode === 'signup' && password.length < 8) {
      Alert.alert('입력 확인', '비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const response =
        authMode === 'signup'
          ? await signup({email, password, nickname})
          : await login({email, password});
      applyAuthSession(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : '인증 요청에 실패했습니다.';
      Alert.alert(authMode === 'signup' ? '회원가입 실패' : '로그인 실패', message);
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [applyAuthSession, authEmail, authMode, authName, authPassword]);

  const handleSocialLogin = useCallback((provider: 'KAKAO' | 'GOOGLE') => {
    Alert.alert(
      '소셜 로그인 보류',
      `${provider === 'KAKAO' ? '카카오' : 'Google'} SDK 토큰 발급 연동이 필요해서 API 호출은 보류했습니다.`,
    );
  }, []);

  const handleRefreshProfile = useCallback(() => {
    loadUserProfileData();
  }, [loadUserProfileData]);

  const handleUpdateProfile = useCallback(
    async (nickname: string) => {
      const nextNickname = nickname.trim();
      if (!nextNickname) {
        Alert.alert('입력 확인', '닉네임을 입력해 주세요.');
        return;
      }
      if (!authSession?.accessToken) return;

      setIsProfileLoading(true);
      try {
        const response = await updateMe(authSession.accessToken, {nickname: nextNickname});
        setAuthName(response.data.nickname || nextNickname);
        setAuthEmail(response.data.email);
        Alert.alert('프로필 수정 완료', response.message || '내 정보가 수정되었습니다.');
        await loadUserProfileData(authSession.accessToken);
      } catch (error) {
        const message = error instanceof Error ? error.message : '프로필 수정에 실패했습니다.';
        Alert.alert('프로필 수정 실패', message);
      } finally {
        setIsProfileLoading(false);
      }
    },
    [authSession?.accessToken, loadUserProfileData],
  );

  const handleSelectProfileRun = useCallback(
    async (id: string | null) => {
      setSelectedProfileRunId(id);
      const targetRun = id ? savedRuns.find(run => run.id === id) : null;
      if (!targetRun?.recordId || !authSession?.accessToken) return;

      try {
        const response = await getMyRecord(authSession.accessToken, targetRun.recordId);
        setSavedRuns(prev =>
          prev.map(run =>
            run.id === id
              ? {
                  ...run,
                  ...recordToSavedRun(
                    response.data,
                    new Set(prev.filter(item => item.shared).map(item => item.routeId || '')),
                    authName,
                  ),
                  shared: run.shared,
                }
              : run,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '기록 상세 조회에 실패했습니다.';
        setProfileError(message);
      }
    },
    [authName, authSession?.accessToken, savedRuns],
  );

  const handleDeleteMyRecord = useCallback(
    (id: string) => {
      const targetRun = savedRuns.find(run => run.id === id);
      if (!targetRun?.recordId || !authSession?.accessToken) {
        Alert.alert('삭제 불가', '서버에 저장된 기록만 삭제할 수 있습니다.');
        return;
      }

      Alert.alert('완주 기록 삭제', '이 기록을 삭제할까요?', [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyRecord(authSession.accessToken, targetRun.recordId as string);
              setSavedRuns(prev => prev.filter(run => run.id !== id));
              setSelectedProfileRunId(null);
              await loadUserProfileData(authSession.accessToken);
            } catch (error) {
              const message = error instanceof Error ? error.message : '기록 삭제에 실패했습니다.';
              Alert.alert('기록 삭제 실패', message);
            }
          },
        },
      ]);
    },
    [authSession?.accessToken, loadUserProfileData, savedRuns],
  );

  const handleLogout = useCallback(() => {
    Alert.alert('로그아웃', '현재 계정에서 로그아웃할까요?', [
      {text: '취소', style: 'cancel'},
      {
        text: '로그아웃',
        onPress: async () => {
          try {
            await logout(authSession?.accessToken);
          } catch (error) {
            const message = error instanceof Error ? error.message : '로그아웃 API 호출 실패';
            Alert.alert('로그아웃 API 실패', `${message}\n\n앱에서는 로그아웃 상태로 전환합니다.`);
          }
          setAuthSession(null);
          setIsAuthenticated(false);
          setAuthMode('login');
          setAuthPassword('');
          setProfileSummary(null);
          setProfileError(null);
          setServerLikedRuns([]);
          setSelectedProfileRunId(null);
        },
      },
    ]);
  }, [authSession?.accessToken]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      '회원탈퇴',
      '계정과 러닝 기록이 삭제됩니다. 계속할까요?',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            try {
              await withdraw(authSession?.accessToken);
            } catch (error) {
              const message = error instanceof Error ? error.message : '회원탈퇴 API 호출 실패';
              Alert.alert('회원탈퇴 실패', message);
              return;
            }
            setAuthSession(null);
            setIsAuthenticated(false);
            setAuthMode('signup');
            setAuthPassword('');
            setSavedRuns(INITIAL_RUNS);
            setProfileSummary(null);
            setProfileError(null);
            setServerLikedRuns([]);
            setSelectedProfileRunId(null);
          },
        },
      ],
    );
  }, [authSession?.accessToken]);

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
      isSubmitting={isAuthSubmitting}
      onChangeAuthMode={setAuthMode}
      onChangeName={setAuthName}
      onChangeEmail={setAuthEmail}
      onChangePassword={setAuthPassword}
      onSubmit={handleAuthSubmit}
      onSocialLogin={handleSocialLogin}
    />
  );

  const renderProfile = () => (
    <ProfileScreen
      authName={authName}
      authEmail={authEmail}
      savedRuns={savedRuns}
      likedRuns={likedCommunityRuns}
      summary={profileSummary}
      isLoading={isProfileLoading}
      errorMessage={profileError}
      preferences={preferences}
      selectedRunId={selectedProfileRunId}
      onSelectRun={handleSelectProfileRun}
      onToggleShare={toggleShare}
      onRegisterCommunity={handleRegisterCompletedRun}
      onDeleteRun={handleDeleteMyRecord}
      onRefresh={handleRefreshProfile}
      onUpdateProfile={handleUpdateProfile}
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
