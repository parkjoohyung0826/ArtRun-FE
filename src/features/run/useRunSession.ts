import {useCallback, useEffect, useRef, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import {Alert} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {saveRecord, startSession, trackLocation} from '../../api/routeApi';
import type {Coordinate, RoutePhase, RouteStats, SavedRun, TabKey} from '../../types/app';
import {distanceBetweenCoords} from '../../utils/geo';
import {shapeNameFromKey} from '../../utils/routeFormat';

const START_DISTANCE_LIMIT_KM = 0.2;

interface UseRunSessionParams {
  authName: string;
  distance: number;
  postToMap: (data: object) => void;
  routeStats: RouteStats | null;
  selectedShape: string;
  setActiveTab: (tab: TabKey) => void;
  setRoutePhase: (phase: RoutePhase) => void;
  setSavedRuns: Dispatch<SetStateAction<SavedRun[]>>;
  setSheetSnap: (snap: 'expanded' | 'middle' | 'collapsed') => void;
  shapePrompt: string;
  startCoord: Coordinate;
  targetPace: number;
  routePhase: RoutePhase;
}

export function useRunSession({
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
}: UseRunSessionParams) {
  const runWatchId = useRef<number | null>(null);
  const runStartedAt = useRef<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gpsPoints, setGpsPoints] = useState<Array<Coordinate & {timestamp: number}>>([]);
  const [runProgress, setRunProgress] = useState(0);
  const [currentPace, setCurrentPace] = useState(5.8);
  const [currentBpm, setCurrentBpm] = useState(156);
  const [voiceCue, setVoiceCue] = useState('경로를 생성하면 러닝 코치가 준비됩니다.');
  const [shareCardSaved, setShareCardSaved] = useState(false);
  const [lastCompletedRunId, setLastCompletedRunId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (runWatchId.current !== null) {
        Geolocation.clearWatch(runWatchId.current);
      }
    };
  }, []);

  const resetSession = useCallback(() => {
    setSessionId(null);
    setGpsPoints([]);
  }, []);

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
    setRoutePhase,
    setSavedRuns,
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
        postToMap({type: 'UPDATE_RUNNER', location: currentPoint});

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
  }, [finishRun, postToMap, routePhase, selectedShape, sessionId, shapePrompt, targetPace]);

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
  }, [postToMap, routeStats, setActiveTab, setRoutePhase, setSheetSnap, startCoord, targetPace]);

  const handleNewRun = useCallback(() => {
    setRoutePhase('idle');
    setRunProgress(0);
    resetSession();
    setShareCardSaved(false);
    setLastCompletedRunId(null);
    setVoiceCue('새 러닝 루트를 생성할 준비가 되었습니다.');
  }, [resetSession, setRoutePhase]);

  const handleSaveShareCard = useCallback(() => {
    setShareCardSaved(true);
    Alert.alert(
      '공유 카드 저장',
      'SNS 공유용 러닝 카드가 저장되었습니다. 실제 갤러리 저장은 네이티브 저장 권한 연동 단계에서 연결하면 됩니다.',
    );
  }, []);

  return {
    currentBpm,
    currentPace,
    handleNewRun,
    handleSaveShareCard,
    handleStartRun,
    lastCompletedRunId,
    resetSession,
    runProgress,
    setRunProgress,
    setVoiceCue,
    shareCardSaved,
    voiceCue,
  };
}
