import React, {useState} from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mail,
  MapPinned,
  Route as RouteIcon,
  Trash2,
  Trophy,
  User,
} from 'lucide-react-native';
import {ToggleRow} from '../components/AppChrome';
import {styles} from '../styles/appStyles';
import type {Preferences, SavedRun} from '../types/app';
import {parseDistanceKm} from '../utils/geo';

export function ProfileScreen({
  authName,
  authEmail,
  savedRuns,
  preferences,
  selectedRunId,
  onSelectRun,
  onToggleShare,
  onChangePreferences,
  onLogout,
  onDeleteAccount,
}: {
  authName: string;
  authEmail: string;
  savedRuns: SavedRun[];
  preferences: Preferences;
  selectedRunId: string | null;
  onSelectRun: (id: string | null) => void;
  onToggleShare: (id: string) => void;
  onChangePreferences: (updater: (prev: Preferences) => Preferences) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}) {
  const [showRunList, setShowRunList] = useState(false);
  const sharedCount = savedRuns.filter(run => run.shared).length;
  const totalDistance = savedRuns
    .reduce((sum, run) => sum + parseDistanceKm(run.distance), 0)
    .toFixed(1);
  const selectedRun = selectedRunId
    ? savedRuns.find(run => run.id === selectedRunId)
    : null;

  if (selectedRun) {
    return (
      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.communityDetailHeader}>
          <TouchableOpacity
            style={styles.communityBackButton}
            onPress={() => {
              onSelectRun(null);
              setShowRunList(true);
            }}
            activeOpacity={0.78}>
            <ChevronLeft size={22} color="#f8fafc" strokeWidth={2.8} />
          </TouchableOpacity>
          <View style={styles.communityDetailHeaderText}>
            <Text style={styles.communityDetailKicker}>RUN RECORD</Text>
            <Text style={styles.communityDetailTitle}>{selectedRun.shape} 완주 기록</Text>
          </View>
        </View>

        <View style={styles.profileRunDetailHero}>
          <View style={styles.profileRunDetailBadge}>
            <RouteIcon size={30} color="#fff" strokeWidth={2.6} />
          </View>
          <Text style={styles.profileRunDetailTitle}>{selectedRun.shape} 루트</Text>
          <Text style={styles.profileRunDetailSub}>
            {selectedRun.shared ? '커뮤니티에 공유된 기록입니다.' : '아직 공유하지 않은 개인 기록입니다.'}
          </Text>
        </View>

        <View style={styles.communityDetailSummary}>
          <View style={styles.communityDetailMetric}>
            <Text style={styles.communityDetailMetricLabel}>거리</Text>
            <Text style={styles.communityDetailMetricValue}>{selectedRun.distance}</Text>
          </View>
          <View style={styles.communityDetailMetric}>
            <Text style={styles.communityDetailMetricLabel}>페이스</Text>
            <Text style={styles.communityDetailMetricValue}>{selectedRun.pace}</Text>
          </View>
          <View style={styles.communityDetailMetric}>
            <Text style={styles.communityDetailMetricLabel}>일치율</Text>
            <Text style={styles.communityDetailMetricValue}>{selectedRun.matchPct}%</Text>
          </View>
        </View>

        <View style={styles.profileAccountCard}>
          <Text style={styles.profileSectionTitle}>완주 상세</Text>
          <View style={styles.profileInfoRow}>
            <Check size={18} color="#38bdf8" strokeWidth={2.4} />
            <View style={styles.profileInfoCopy}>
              <Text style={styles.profileInfoLabel}>저장 상태</Text>
              <Text style={styles.profileInfoValue}>완주 기록 저장 완료</Text>
            </View>
          </View>
          <View style={styles.profileInfoRow}>
            <MapPinned size={18} color="#38bdf8" strokeWidth={2.4} />
            <View style={styles.profileInfoCopy}>
              <Text style={styles.profileInfoLabel}>루트 품질</Text>
              <Text style={styles.profileInfoValue}>도형 일치율 {selectedRun.matchPct}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.profileDangerCard}>
          <TouchableOpacity
            style={styles.profileLogoutButton}
            onPress={() => onToggleShare(selectedRun.id)}>
            <Bookmark size={18} color="#bfdbfe" strokeWidth={2.4} />
            <Text style={styles.profileLogoutText}>
              {selectedRun.shared ? '공유 해제' : '커뮤니티에 공유'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (showRunList) {
    return (
      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.communityDetailHeader}>
          <TouchableOpacity
            style={styles.communityBackButton}
            onPress={() => setShowRunList(false)}
            activeOpacity={0.78}>
            <ChevronLeft size={22} color="#f8fafc" strokeWidth={2.8} />
          </TouchableOpacity>
          <View style={styles.communityDetailHeaderText}>
            <Text style={styles.communityDetailKicker}>MY RUNS</Text>
            <Text style={styles.communityDetailTitle}>내 완주 기록</Text>
          </View>
        </View>

        <View style={styles.profileRunListSummary}>
          <View style={styles.profileRunListIcon}>
            <Trophy size={24} color="#fff" strokeWidth={2.6} />
          </View>
          <View style={styles.profileHeaderCopy}>
            <Text style={styles.profileRunListTitle}>{savedRuns.length}개의 완주 기록</Text>
            <Text style={styles.profileRunListSub}>
              누적 {totalDistance} km · 공유 루트 {sharedCount}개
            </Text>
          </View>
        </View>

        {savedRuns.map(run => (
          <TouchableOpacity
            key={run.id}
            style={styles.profileRunRecordCard}
            onPress={() => onSelectRun(run.id)}
            activeOpacity={0.82}>
            <View style={styles.runBadge}>
              <Text style={styles.runBadgeText}>{run.shape.slice(0, 1)}</Text>
            </View>
            <View style={styles.runCardBody}>
              <Text style={styles.runCardTitle}>{run.shape} 루트</Text>
              <Text style={styles.runCardSub}>
                {run.distance} · {run.pace} · 일치율 {run.matchPct}%
              </Text>
            </View>
            <View style={[styles.profileRunSharePill, run.shared && styles.profileRunSharePillActive]}>
              <Text
                style={[
                  styles.profileRunShareText,
                  run.shared && styles.profileRunShareTextActive,
                ]}>
                {run.shared ? '공유됨' : '개인'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={styles.panelContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{authName.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.profileHeaderCopy}>
          <Text style={styles.profileName}>{authName}</Text>
          <Text style={styles.profileSub}>{authEmail}</Text>
          <Text style={styles.profileSub}>
            이번 달 {totalDistance} km · 공유 루트 {sharedCount}개
          </Text>
        </View>
      </View>

      <View style={styles.profileAccountCard}>
        <View style={styles.profileSectionHeader}>
          <Text style={styles.profileSectionTitle}>계정 정보</Text>
          <View style={styles.profileStatusPill}>
            <Text style={styles.profileStatusText}>활성</Text>
          </View>
        </View>
        <View style={styles.profileInfoRow}>
          <User size={18} color="#38bdf8" strokeWidth={2.4} />
          <View style={styles.profileInfoCopy}>
            <Text style={styles.profileInfoLabel}>닉네임</Text>
            <Text style={styles.profileInfoValue}>{authName}</Text>
          </View>
        </View>
        <View style={styles.profileInfoRow}>
          <Mail size={18} color="#38bdf8" strokeWidth={2.4} />
          <View style={styles.profileInfoCopy}>
            <Text style={styles.profileInfoLabel}>이메일</Text>
            <Text style={styles.profileInfoValue}>{authEmail}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.profileRunEntryCard}
        onPress={() => setShowRunList(true)}
        activeOpacity={0.82}>
        <View style={styles.profileRunEntryIcon}>
          <Trophy size={24} color="#fff" strokeWidth={2.6} />
        </View>
        <View style={styles.profileHeaderCopy}>
          <Text style={styles.profileRunEntryTitle}>내 완주 기록</Text>
          <Text style={styles.profileRunEntrySub}>
            {savedRuns.length}개 기록 · 누적 {totalDistance} km · 공유 {sharedCount}개
          </Text>
          <View style={styles.profileRunEntryMetaRow}>
            <Text style={styles.profileRunEntryMeta}>
              최근 {savedRuns[0]?.shape || '러닝'} · {savedRuns[0]?.distance || '0 km'}
            </Text>
          </View>
        </View>
        <ChevronRight size={22} color="#8AA0BC" strokeWidth={2.6} />
      </TouchableOpacity>

      <View style={styles.profileAccountCard}>
        <Text style={styles.profileSectionTitle}>러닝 설정</Text>
        <ToggleRow
          label="AI EDM 페이스 조절"
          value={preferences.adaptiveMusic}
          onValueChange={value =>
            onChangePreferences(prev => ({...prev, adaptiveMusic: value}))
          }
        />
        <ToggleRow
          label="실시간 음성 안내"
          value={preferences.voiceCoach}
          onValueChange={value => onChangePreferences(prev => ({...prev, voiceCoach: value}))}
        />
      </View>

      <View style={styles.profileDangerCard}>
        <TouchableOpacity style={styles.profileLogoutButton} onPress={onLogout}>
          <LogOut size={18} color="#bfdbfe" strokeWidth={2.4} />
          <Text style={styles.profileLogoutText}>로그아웃</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileDeleteButton} onPress={onDeleteAccount}>
          <Trash2 size={18} color="#fecaca" strokeWidth={2.4} />
          <Text style={styles.profileDeleteText}>회원탈퇴</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
