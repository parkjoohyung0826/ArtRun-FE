import {useCallback, useEffect, useRef, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import {Alert} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {regenerateShareCard, saveRecord} from '../../api/recordApi';
import {
  cancelSession,
  finishSession,
  getSession,
  pauseSession,
  resumeSession,
  startSession,
  trackLocation,
} from '../../api/sessionApi';
import type {Coordinate, RoutePhase, RouteStats, SavedRun, TabKey} from '../../types/app';
import {distanceBetweenCoords} from '../../utils/geo';
import {shapeNameFromKey} from '../../utils/routeFormat';

const START_DISTANCE_LIMIT_KM = 0.2;

interface UseRunSessionParams {
  accessToken?: string;
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
  accessToken,
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
  const [lastCompletedRecordId, setLastCompletedRecordId] = useState<string | null>(null);

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

  const clearRunWatch = useCallback(() => {
    if (runWatchId.current !== null) {
      Geolocation.clearWatch(runWatchId.current);
      runWatchId.current = null;
    }
  }, []);

  const getCurrentPoint = useCallback(
    () =>
      new Promise<Coordinate>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          position =>
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }),
          reject,
          {enableHighAccuracy: true, timeout: 12000, maximumAge: 5000},
        );
      }),
    [],
  );

  const finishRun = useCallback(async () => {
    clearRunWatch();
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
        const recordPoints =
          gpsPoints.length >= 2
            ? gpsPoints
            : routeStats.routePoints.map((point, index) => ({
                ...point,
                timestamp: Date.now() + index * 1000,
              }));

        if (recordPoints.length < 2) {
          throw new Error('기록 저장에 필요한 GPS 포인트가 부족합니다.');
        }

        const lastPoint = recordPoints[recordPoints.length - 1];
        await finishSession(accessToken, sessionId, {
          currentPoint: lastPoint,
          totalTimeSeconds,
          gpsPoints: recordPoints,
        });

        const response = await saveRecord(accessToken, {
          sessionId,
          routeId: routeStats.routeId,
          gpsPoints: recordPoints,
          totalTimeSeconds,
          averagePaceSecPerKm: Math.round(targetPace * 60),
          averageBpm: currentBpm,
        });
        savedRecord = {
          recordId: response.data.recordId,
          imageUrl: response.data.imageUrl,
        };
        setLastCompletedRecordId(response.data.recordId);
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
    accessToken,
    authName,
    clearRunWatch,
    currentBpm,
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
        const {latitude, longitude, speed, accuracy, heading, altitude} = position.coords;
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

        trackLocation(
          accessToken,
          sessionId,
          {
            ...currentPoint,
            timestamp,
            currentSpeed: speedMps,
            accuracyMeters: typeof accuracy === 'number' ? accuracy : undefined,
            heading: typeof heading === 'number' ? heading : undefined,
            altitude: typeof altitude === 'number' ? altitude : undefined,
          },
        )
          .then(response => {
            const data = response.data;
            const completionRate = Number(data.completionRate || 0);
            const nextProgress = completionRate > 1 ? completionRate / 100 : completionRate;
            const remaining =
              typeof data.distanceRemainingMeters === 'number'
                ? data.distanceRemainingMeters
                : Number.POSITIVE_INFINITY;

            if (Number.isFinite(nextProgress)) {
              setRunProgress(prev => {
                const normalized = Math.min(1, Math.max(prev, nextProgress));
                if (prev < 0.5 && normalized >= 0.5) {
                  setVoiceCue(`${shapeNameFromKey(selectedShape, shapePrompt)}의 반을 완성했습니다.`);
                }
                return normalized;
              });
            }

            if (data.paceFeedback?.currentPaceSecPerKm) {
              setCurrentPace(Number((data.paceFeedback.currentPaceSecPerKm / 60).toFixed(2)));
            }
            if (data.edmControl?.currentBpm) {
              setCurrentBpm(data.edmControl.currentBpm);
            }

            const guideMessage =
              data.voiceCue?.message ||
              data.warningMessage ||
              data.currentInstruction?.message ||
              data.paceFeedback?.message ||
              data.edmControl?.message;

            if (guideMessage) {
              setVoiceCue(guideMessage);
            } else if (Number.isFinite(remaining) && remaining > 0) {
              setVoiceCue(`남은 거리 ${Math.round(remaining)}m입니다.`);
            } else {
              setVoiceCue('목표 페이스를 유지하고 있습니다.');
            }

            if (nextProgress >= 1 || remaining <= 10) {
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
  }, [accessToken, finishRun, postToMap, routePhase, selectedShape, sessionId, shapePrompt, targetPace]);

  const handleStartRun = useCallback(async () => {
    if (!routeStats?.routeId) {
      Alert.alert('러닝 시작 불가', '서버에서 생성된 경로를 먼저 선택해야 합니다.');
      return;
    }

    try {
      const currentPosition = await getCurrentPoint();
      const routeStart = routeStats.routePoints[0] || startCoord;
      const startDistanceKm = distanceBetweenCoords(currentPosition, routeStart);

      if (startDistanceKm > START_DISTANCE_LIMIT_KM) {
        Alert.alert(
          '출발지와 거리가 멉니다',
          `현재 위치가 루트 시작점에서 약 ${(startDistanceKm * 1000).toFixed(0)}m 떨어져 있습니다. 시작점 근처에서 러닝을 시작해 주세요.`,
        );
        return;
      }

      const response = await startSession(accessToken, routeStats.routeId, {
        currentPoint: {...currentPosition, timestamp: Date.now()},
        targetPaceSecPerKm: Math.round(targetPace * 60),
        voiceGuideEnabled: true,
        edmControlEnabled: true,
      });
      if (response.data.startAllowed === false) {
        Alert.alert(
          '출발 위치 확인 필요',
          response.data.message ||
            `루트 시작점에서 약 ${Math.round(response.data.startDistanceMeters || 0)}m 떨어져 있습니다.`,
        );
        return;
      }
      setSessionId(response.data.sessionId);
      setActiveTab('run');
      setRoutePhase('running');
      setSheetSnap('expanded');
      setRunProgress(0);
      setGpsPoints([{...currentPosition, timestamp: Date.now()}]);
      setShareCardSaved(false);
      setLastCompletedRunId(null);
      setLastCompletedRecordId(null);
      setCurrentPace(targetPace);
      setCurrentBpm(156);
      runStartedAt.current = Date.now();
      postToMap({type: 'UPDATE_RUNNER', location: currentPosition});
      setVoiceCue(response.data.message || `${routeStats.shapeLabel} 러닝을 시작합니다.`);
      getSession(accessToken, response.data.sessionId).catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GPS 확인 또는 세션 시작에 실패했습니다.';
      Alert.alert('러닝 시작 실패', message);
    }
  }, [
    accessToken,
    getCurrentPoint,
    postToMap,
    routeStats,
    setActiveTab,
    setRoutePhase,
    setSheetSnap,
    startCoord,
    targetPace,
  ]);

  const handlePauseRun = useCallback(async () => {
    if (!sessionId) {
      Alert.alert('일시정지 불가', '진행 중인 세션이 없습니다.');
      return;
    }

    try {
      await pauseSession(accessToken, sessionId);
      clearRunWatch();
      setRoutePhase('paused');
      setVoiceCue('러닝을 일시정지했습니다. 재개하면 위치 추적을 다시 시작합니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '세션 일시정지에 실패했습니다.';
      Alert.alert('일시정지 실패', message);
    }
  }, [accessToken, clearRunWatch, sessionId, setRoutePhase]);

  const handleResumeRun = useCallback(async () => {
    if (!sessionId) {
      Alert.alert('재개 불가', '재개할 세션이 없습니다.');
      return;
    }

    try {
      const currentPoint = await getCurrentPoint();
      await resumeSession(accessToken, sessionId, {
        currentPoint: {...currentPoint, timestamp: Date.now()},
      });
      await getSession(accessToken, sessionId).catch(() => undefined);
      setRoutePhase('running');
      setVoiceCue('러닝을 재개했습니다. 현재 위치를 다시 확인합니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '세션 재개에 실패했습니다.';
      Alert.alert('재개 실패', message);
    }
  }, [accessToken, getCurrentPoint, sessionId, setRoutePhase]);

  const handleCancelRun = useCallback(() => {
    const resetToReady = () => {
      clearRunWatch();
      setRoutePhase(routeStats ? 'ready' : 'idle');
      setRunProgress(0);
      resetSession();
      setVoiceCue('러닝 세션을 취소했습니다.');
    };

    if (!sessionId) {
      resetToReady();
      return;
    }

    Alert.alert('러닝 취소', '현재 러닝 세션을 취소할까요?', [
      {text: '계속 달리기', style: 'cancel'},
      {
        text: '취소',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelSession(accessToken, sessionId, {reason: 'USER_CANCELLED'});
          } catch (error) {
            const message = error instanceof Error ? error.message : '세션 취소 API 호출 실패';
            Alert.alert('세션 취소 실패', `${message}\n\n앱에서는 세션을 종료합니다.`);
          }
          resetToReady();
        },
      },
    ]);
  }, [
    accessToken,
    clearRunWatch,
    resetSession,
    routeStats,
    sessionId,
    setRoutePhase,
  ]);

  const handleFinishRun = useCallback(() => {
    if (!sessionId) {
      Alert.alert('완료 불가', '완료할 세션이 없습니다.');
      return;
    }
    finishRun();
  }, [finishRun, sessionId]);

  const handleNewRun = useCallback(() => {
    setRoutePhase('idle');
    setRunProgress(0);
    clearRunWatch();
    resetSession();
    setShareCardSaved(false);
    setLastCompletedRunId(null);
    setLastCompletedRecordId(null);
    setVoiceCue('새 러닝 루트를 생성할 준비가 되었습니다.');
  }, [clearRunWatch, resetSession, setRoutePhase]);

  const handleSaveShareCard = useCallback(async () => {
    if (!lastCompletedRecordId) {
      setShareCardSaved(true);
      Alert.alert(
        '공유 카드 저장',
        '서버 기록 ID가 없어 앱 내 공유 카드 상태만 저장했습니다.',
      );
      return;
    }

    try {
      const response = await regenerateShareCard(accessToken, lastCompletedRecordId);
      const nextImageUrl =
        response.data.imageUrl ||
        response.data.shareCardUrl ||
        response.data.url ||
        response.data.cardUrl;

      if (nextImageUrl) {
        setSavedRuns(prev =>
          prev.map(run =>
            run.recordId === lastCompletedRecordId
              ? {...run, imageUrl: nextImageUrl}
              : run,
          ),
        );
      }
      setShareCardSaved(true);
      Alert.alert('공유 카드 저장', response.message || 'SNS 공유 카드가 재생성되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '공유 카드 재생성에 실패했습니다.';
      Alert.alert('공유 카드 저장 실패', message);
    }
  }, [accessToken, lastCompletedRecordId, setSavedRuns]);

  return {
    currentBpm,
    currentPace,
    handleCancelRun,
    handleFinishRun,
    handleNewRun,
    handlePauseRun,
    handleResumeRun,
    handleSaveShareCard,
    handleStartRun,
    lastCompletedRecordId,
    lastCompletedRunId,
    resetSession,
    runProgress,
    setRunProgress,
    setVoiceCue,
    shareCardSaved,
    voiceCue,
  };
}
