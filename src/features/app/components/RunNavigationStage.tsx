import React from 'react';
import {ActivityIndicator, Animated, Text, View} from 'react-native';
import {MapPinned} from 'lucide-react-native';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import {NAVER_MAP_WEB_BASE_URL} from '../../../config';
import {MAP_HTML} from '../../../mapHtml';
import {styles} from '../../../styles/appStyles';
import {GREEN} from '../../../styles/theme';
import type {RoutePhase} from '../../../types/app';

export function RunNavigationStage({
  isGenerating,
  mapReady,
  onMapMessage,
  renderPlan,
  renderRunMode,
  routePhase,
  sheetHeight,
  sheetOffset,
  webViewRef,
}: {
  isGenerating: boolean;
  mapReady: boolean;
  onMapMessage: (event: WebViewMessageEvent) => void;
  renderPlan: () => React.ReactNode;
  renderRunMode: () => React.ReactNode;
  routePhase: RoutePhase;
  sheetHeight: number;
  sheetOffset: Animated.Value;
  webViewRef: React.RefObject<WebView | null>;
}) {
  return (
    <View style={styles.runNavigationStage}>
      <View style={[styles.mapShell, styles.navigationMapShell, styles.navigationMapFull]}>
        <WebView
          ref={webViewRef}
          source={{html: MAP_HTML, baseUrl: NAVER_MAP_WEB_BASE_URL}}
          style={styles.webview}
          onMessage={onMapMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          allowsInlineMediaPlayback
        />
        {routePhase === 'running' || routePhase === 'paused' ? (
          <View style={styles.navigationBanner}>
            <View style={styles.navigationBannerIcon}>
              <MapPinned size={17} color="#2f80ff" strokeWidth={2.7} />
            </View>
            <View style={styles.navigationBannerTextBox}>
              <Text style={styles.navigationBannerTitle}>
                {routePhase === 'paused' ? '러닝 일시정지' : '320m 앞 포인트 통과'}
              </Text>
              <Text style={styles.navigationBannerSub}>
                {routePhase === 'paused'
                  ? '재개하면 위치 추적을 다시 시작합니다'
                  : '별 모양 상단 라인을 따라가세요'}
              </Text>
            </View>
          </View>
        ) : null}
        {(isGenerating || !mapReady) && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator color={GREEN} size="large" />
              <Text style={styles.loadingText}>
                {mapReady ? 'AI 경로 생성 중' : '지도 준비 중'}
              </Text>
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
        {routePhase === 'running' || routePhase === 'paused' || routePhase === 'complete'
          ? renderRunMode()
          : renderPlan()}
      </Animated.View>
    </View>
  );
}
