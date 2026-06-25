import {useCallback, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import {Alert} from 'react-native';
import {login, logout, signup, withdraw} from '../../api/authApi';
import type {AuthResponse} from '../../api/authApi';
import {
  deleteMyRecord,
  getLikedRoutes,
  getMe,
  getMyRecord,
  getMyRecords,
  getMySharedRoutes,
  getSummary,
  updateMe,
} from '../../api/userApi';
import type {MyPageSummaryResponse} from '../../api/userApi';
import {INITIAL_RUNS} from '../../constants/appData';
import {communityRouteToSavedRun, recordToSavedRun} from '../profile/profileMappers';
import type {
  AuthMode,
  ProfileSummary,
  SavedRun,
  TabKey,
} from '../../types/app';

interface UseAuthProfileParams {
  savedRuns: SavedRun[];
  setSavedRuns: Dispatch<SetStateAction<SavedRun[]>>;
  setActiveTab: (tab: TabKey) => void;
  setSelectedProfileRunId: (id: string | null) => void;
}

export function useAuthProfile({
  savedRuns,
  setSavedRuns,
  setActiveTab,
  setSelectedProfileRunId,
}: UseAuthProfileParams) {
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

  const resetProfileState = useCallback(() => {
    setProfileSummary(null);
    setProfileError(null);
    setServerLikedRuns([]);
    setSelectedProfileRunId(null);
  }, [setSelectedProfileRunId]);

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
    [authName, authSession?.accessToken, setSavedRuns],
  );

  const applyAuthSession = useCallback(
    (session: AuthResponse) => {
      setAuthSession(session);
      setIsAuthenticated(true);
      setAuthName(session.user.nickname || session.user.email);
      setAuthEmail(session.user.email);
      setAuthMode('login');
      setAuthPassword('');
      setActiveTab('home');
      loadUserProfileData(session.accessToken);
    },
    [loadUserProfileData, setActiveTab],
  );

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
    [authName, authSession?.accessToken, savedRuns, setSavedRuns, setSelectedProfileRunId],
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
    [
      authSession?.accessToken,
      loadUserProfileData,
      savedRuns,
      setSavedRuns,
      setSelectedProfileRunId,
    ],
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
          resetProfileState();
        },
      },
    ]);
  }, [authSession?.accessToken, resetProfileState]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert('회원탈퇴', '계정과 러닝 기록이 삭제됩니다. 계속할까요?', [
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
          resetProfileState();
        },
      },
    ]);
  }, [authSession?.accessToken, resetProfileState, setSavedRuns]);

  return {
    authEmail,
    authMode,
    authName,
    authPassword,
    authSession,
    handleAuthSubmit,
    handleDeleteAccount,
    handleDeleteMyRecord,
    handleLogout,
    handleRefreshProfile: loadUserProfileData,
    handleSelectProfileRun,
    handleSocialLogin,
    handleUpdateProfile,
    isAuthSubmitting,
    isAuthenticated,
    isProfileLoading,
    profileError,
    profileSummary,
    serverLikedRuns,
    setAuthEmail,
    setAuthMode,
    setAuthName,
    setAuthPassword,
  };
}
