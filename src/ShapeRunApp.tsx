import React, {useEffect, useMemo, useState} from 'react';
import {
  StatusBar,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {INITIAL_RUNS} from './constants/appData';
import {AppHeader} from './features/app/components/AppHeader';
import {FooterNav} from './features/app/components/FooterNav';
import {RunNavigationStage} from './features/app/components/RunNavigationStage';
import {useAuthProfile} from './features/auth/useAuthProfile';
import {useRunBottomSheet} from './features/run/useRunBottomSheet';
import {useRunFlow} from './features/run/useRunFlow';
import {AuthScreen} from './screens/AuthScreen';
import {CommunityScreen} from './screens/CommunityScreen';
import {HomeScreen} from './screens/HomeScreen';
import {ProfileScreen} from './screens/ProfileScreen';
import {RunModeScreen} from './screens/RunModeScreen';
import {RunPlanScreen} from './screens/RunPlanScreen';
import {styles} from './styles/appStyles';
import type {SavedRun, TabKey} from './types/app';

const FOOTER_BASE_HEIGHT = 66;

export default function ShapeRunApp() {
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const rootSafeAreaStyle = useMemo(() => ({paddingTop: insets.top}), [insets.top]);

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>(INITIAL_RUNS);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [selectedProfileRunId, setSelectedProfileRunId] = useState<string | null>(null);

  const {
    authEmail,
    authMode,
    authName,
    authPassword,
    authSession,
    handleAuthSubmit,
    handleDeleteAccount,
    handleDeleteMyRecord,
    handleLogout,
    handleRefreshProfile,
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
  } = useAuthProfile({
    savedRuns,
    setSavedRuns,
    setActiveTab,
    setSelectedProfileRunId,
  });

  const footerHeight = FOOTER_BASE_HEIGHT + Math.max(insets.bottom, 8);
  const runStageHeight = Math.max(0, windowHeight - footerHeight);
  const {
    setSheetSnap,
    sheetHeight,
    sheetOffset,
    sheetPanResponder,
    sheetScrollBottomInset,
    syncSheetOffset,
  } = useRunBottomSheet(runStageHeight);

  const run = useRunFlow({
    accessToken: authSession?.accessToken,
    authName,
    savedRuns,
    serverLikedRuns,
    setActiveTab,
    setSavedRuns,
    setSelectedCommunityId,
    setSheetSnap,
  });

  useEffect(() => {
    syncSheetOffset();
  }, [syncSheetOffset]);

  const renderPlan = () => (
    <RunPlanScreen
      sheetPanResponder={sheetPanResponder}
      activity={run.activity}
      preferences={run.preferences}
      shapePrompt={run.shapePrompt}
      selectedShape={run.selectedShape}
      distance={run.distance}
      targetPace={run.targetPace}
      startCoord={run.startCoord}
      routeStats={run.routeStats}
      isGenerating={run.isGenerating}
      mapReady={run.mapReady}
      routeStatusMessage={run.voiceCue}
      sheetScrollBottomInset={sheetScrollBottomInset}
      onGoHome={() => setActiveTab('home')}
      onChangeShapePrompt={text => {
        run.setShapePrompt(text);
        run.setRouteStats(null);
        run.setRoutePhase('idle');
      }}
      onSelectShape={item => {
        run.setSelectedShape(item.key);
        run.setShapePrompt(item.label);
        run.setRouteStats(null);
        run.setRoutePhase('idle');
      }}
      onChangeDistance={value => {
        run.setDistance(value);
        run.setRouteStats(null);
        run.setRoutePhase('idle');
      }}
      onChangeTargetPace={run.setTargetPace}
      onChangeActivity={run.setActivity}
      onChangePreferences={run.setPreferences}
      onGetLocation={run.handleGetLocation}
      onRegenerate={run.handleRegenerate}
      onGenerate={run.handleGenerate}
      onStartRun={run.handleStartRun}
    />
  );

  const renderHome = () => (
    <HomeScreen
      shapePrompt={run.shapePrompt}
      distance={run.distance}
      pendingQuickGenerate={run.pendingQuickGenerate}
      onChangeShapePrompt={text => {
        run.setShapePrompt(text);
        run.setRouteStats(null);
        run.setRoutePhase('idle');
      }}
      onSelectPresetShape={item => {
        run.setSelectedShape(item.key);
        run.setShapePrompt(item.label);
      }}
      onSelectDistance={run.setDistance}
      onQuickGenerate={run.handleQuickGenerate}
      onOpenCommunity={() => setActiveTab('community')}
    />
  );

  const renderRunMode = () => (
    <RunModeScreen
      sheetPanResponder={sheetPanResponder}
      routePhase={run.routePhase}
      shapePrompt={run.shapePrompt}
      distance={run.distance}
      routeStats={run.routeStats}
      currentBpm={run.currentBpm}
      runProgress={run.runProgress}
      progressDistance={run.progressDistance}
      currentPace={run.currentPace}
      voiceCue={run.voiceCue}
      sheetScrollBottomInset={sheetScrollBottomInset}
      averagePaceLabel={run.averagePaceLabel}
      elapsedTimeLabel={run.elapsedTimeLabel}
      shareMapImageUrl={run.shareMapImageUrl}
      shareCardSaved={run.shareCardSaved}
      completedRunId={run.lastCompletedRunId}
      completedRunShared={savedRuns.some(runItem => runItem.id === run.lastCompletedRunId && runItem.shared)}
      onSaveShareCard={run.handleSaveShareCard}
      onPauseRun={run.handlePauseRun}
      onResumeRun={run.handleResumeRun}
      onCancelRun={run.handleCancelRun}
      onFinishRun={run.handleFinishRun}
      onRegisterCommunity={run.handleRegisterCompletedRun}
      onGoHome={() => setActiveTab('home')}
      onNewRun={run.handleNewRun}
    />
  );

  const renderCommunity = () => (
    <CommunityScreen
      communityRuns={run.communityRuns}
      communityActions={run.communityActions}
      communityError={run.communityError}
      isCommunityLoading={run.isCommunityLoading}
      selectedCommunityId={selectedCommunityId}
      communityQuery={run.communityQuery}
      communityFilter={run.communityFilter}
      startCoord={run.startCoord}
      onSelectCommunityId={run.handleSelectCommunityId}
      onChangeQuery={run.setCommunityQuery}
      onChangeFilter={run.setCommunityFilter}
      onToggleAction={run.toggleCommunityAction}
      onUseRoute={run.handleUseCommunityRoute}
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
      likedRuns={run.likedCommunityRuns}
      summary={profileSummary}
      isLoading={isProfileLoading}
      errorMessage={profileError}
      preferences={run.preferences}
      selectedRunId={selectedProfileRunId}
      onSelectRun={handleSelectProfileRun}
      onToggleShare={run.toggleShare}
      onRegisterCommunity={run.handleRegisterCompletedRun}
      onDeleteRun={handleDeleteMyRecord}
      onRefresh={handleRefreshProfile}
      onUpdateProfile={handleUpdateProfile}
      onChangePreferences={run.setPreferences}
      onLogout={handleLogout}
      onDeleteAccount={handleDeleteAccount}
    />
  );

  const isNavigationMode = activeTab === 'run';

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, rootSafeAreaStyle]}>
        <StatusBar barStyle="light-content" backgroundColor="#151c2b" />
        <View style={styles.contentShell}>{renderAuth()}</View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        isNavigationMode ? styles.rootNavigationMode : rootSafeAreaStyle,
      ]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={isNavigationMode ? 'transparent' : '#151c2b'}
        translucent={isNavigationMode}
      />
      {!isNavigationMode && <AppHeader onOpenProfile={() => setActiveTab('profile')} />}

      {activeTab === 'run' ? (
        <RunNavigationStage
          isGenerating={run.isGenerating}
          mapReady={run.mapReady}
          onMapMessage={run.handleMessage}
          renderPlan={renderPlan}
          renderRunMode={renderRunMode}
          routePhase={run.routePhase}
          sheetHeight={sheetHeight}
          sheetOffset={sheetOffset}
          webViewRef={run.webViewRef}
        />
      ) : (
        <View style={styles.contentShell}>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'community' && renderCommunity()}
          {activeTab === 'profile' && renderProfile()}
        </View>
      )}

      <FooterNav
        activeTab={activeTab}
        bottomInset={Math.max(insets.bottom, 8)}
        onChangeTab={setActiveTab}
      />
    </View>
  );
}
