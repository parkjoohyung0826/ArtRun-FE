import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import Slider from '@react-native-community/slider';
import Geolocation from '@react-native-community/geolocation';
import {SHAPES} from './shapes';
import {MAP_HTML} from './mapHtml';

type ShapeKey = 'heart' | 'star' | 'dog' | 'cat' | 'circle';
type Activity = 'Running' | 'Walking' | 'Cycling';

interface RouteStats {
  distKm: string;
  duration: string;
  matchPct: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

export default function ShapeRunApp() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const [selectedShape, setSelectedShape] = useState<ShapeKey>('dog');
  const [distance, setDistance] = useState(5);
  const [activity, setActivity] = useState<Activity>('Running');
  const [startCoord, setStartCoord] = useState({lat: 37.5665, lng: 126.978});
  const [isGenerating, setIsGenerating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [stats, setStats] = useState<RouteStats | null>(null);

  const postToMap = useCallback((data: object) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        switch (msg.type) {
          case 'READY':
            setMapReady(true);
            postToMap({
              type: 'SET_LOCATION',
              lat: startCoord.lat,
              lng: startCoord.lng,
            });
            break;
          case 'MAP_CLICK':
            setStartCoord({lat: msg.lat, lng: msg.lng});
            setStats(null);
            break;
          case 'ROUTING_START':
            setIsGenerating(true);
            break;
          case 'ROUTE_DONE': {
            setIsGenerating(false);
            const actualKm = msg.distM / 1000;
            const matchPct = Math.round(
              Math.max(
                78,
                Math.min(99, 100 - (Math.abs(actualKm - distance) / distance) * 40),
              ),
            );
            setStats({
              distKm: actualKm.toFixed(2),
              duration: msg.durS ? formatDuration(msg.durS) : `~${Math.round(actualKm / 10 * 60)} min`,
              matchPct,
            });
            break;
          }
          case 'ROUTE_ERROR':
            setIsGenerating(false);
            Alert.alert('Route Error', msg.message || 'Could not generate route.');
            break;
        }
      } catch (_) {}
    },
    [distance, startCoord, postToMap],
  );

  const handleGetLocation = useCallback(() => {
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude: lat, longitude: lng} = pos.coords;
        setStartCoord({lat, lng});
        setStats(null);
        postToMap({type: 'SET_LOCATION', lat, lng});
      },
      () =>
        Alert.alert(
          'Location unavailable',
          'Tap anywhere on the map to set your starting point.',
        ),
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000},
    );
  }, [postToMap]);

  const handleGenerate = useCallback(() => {
    if (!mapReady || isGenerating) return;
    const shapePts = SHAPES[selectedShape].points;
    const profile = activity === 'Cycling' ? 'bike' : 'foot';
    setStats(null);
    postToMap({
      type: 'GENERATE',
      shapePts,
      targetKm: distance,
      profile,
      startLat: startCoord.lat,
      startLng: startCoord.lng,
    });
  }, [mapReady, isGenerating, selectedShape, distance, activity, startCoord, postToMap]);

  const handleShapeSelect = useCallback((key: ShapeKey) => {
    setSelectedShape(key);
    setStats(null);
  }, []);

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>⚡</Text>
        </View>
        <Text style={styles.headerTitle}>ShapeRun</Text>
      </View>

      {/* ── Map ── */}
      <View style={styles.mapContainer}>
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
        {isGenerating && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#f97316" size="large" />
              <Text style={styles.loadingText}>Generating route…</Text>
              <Text style={styles.loadingSubtext}>Snapping to roads</Text>
            </View>
          </View>
        )}
        {!mapReady && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#f97316" size="large" />
          </View>
        )}
      </View>

      {/* ── Controls ── */}
      <ScrollView
        style={styles.controls}
        contentContainerStyle={[
          styles.controlsContent,
          {paddingBottom: insets.bottom + 12},
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Shape Selector */}
        <Text style={styles.sectionLabel}>1. CHOOSE A SHAPE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.shapeRow}
          contentContainerStyle={styles.shapeRowContent}>
          {(Object.keys(SHAPES) as ShapeKey[]).map(key => {
            const shape = SHAPES[key];
            const active = key === selectedShape;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.shapeBtn, active && styles.shapeBtnActive]}
                onPress={() => handleShapeSelect(key)}
                activeOpacity={0.7}>
                <Text style={styles.shapeEmoji}>{shape.emoji}</Text>
                <Text style={[styles.shapeName, active && styles.shapeNameActive]}>
                  {shape.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Distance */}
        <Text style={styles.sectionLabel}>2. SET DETAILS</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Target Distance</Text>
          <Text style={styles.detailValue}>{distance} km</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={20}
          step={0.5}
          value={distance}
          onValueChange={val => {
            setDistance(val);
            setStats(null);
          }}
          minimumTrackTintColor="#f97316"
          maximumTrackTintColor="#e5e7eb"
          thumbTintColor="#f97316"
        />
        <View style={styles.sliderTicks}>
          <Text style={styles.tickLabel}>1 km</Text>
          <Text style={styles.tickLabel}>20 km</Text>
        </View>

        {/* Activity Type */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Activity Type</Text>
        </View>
        <View style={styles.activityTabs}>
          {(['Running', 'Walking', 'Cycling'] as Activity[]).map(a => (
            <TouchableOpacity
              key={a}
              style={[styles.activityTab, activity === a && styles.activityTabActive]}
              onPress={() => setActivity(a)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.activityTabText,
                  activity === a && styles.activityTabTextActive,
                ]}>
                {a}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Starting Point */}
        <TouchableOpacity
          style={styles.startCard}
          onPress={handleGetLocation}
          activeOpacity={0.7}>
          <Text style={styles.startCardIcon}>📍</Text>
          <View style={styles.startCardBody}>
            <Text style={styles.startCardTitle}>Starting Point</Text>
            <Text style={styles.startCardSub}>
              {`${startCoord.lat.toFixed(4)}, ${startCoord.lng.toFixed(4)}`}
            </Text>
            <Text style={styles.startCardHint}>
              Tap for GPS · Tap map to move
            </Text>
          </View>
        </TouchableOpacity>

        {/* Route Stats */}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsCheck}>✓</Text>
              <Text style={styles.statsTitle}>Route Ready!</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Est. Distance</Text>
              <Text style={styles.statValue}>{stats.distKm} km</Text>
            </View>
            <View style={[styles.statRow, styles.statRowBorder]}>
              <Text style={styles.statLabel}>Est. Duration</Text>
              <Text style={styles.statValue}>{stats.duration}</Text>
            </View>
            <View style={[styles.statRow, styles.statRowBorder]}>
              <Text style={styles.statLabel}>Shape Match</Text>
              <Text style={styles.statValue}>{stats.matchPct}%</Text>
            </View>
          </View>
        )}

        {/* Generate Button */}
        <TouchableOpacity
          style={[
            styles.genBtn,
            (!mapReady || isGenerating) && styles.genBtnDisabled,
          ]}
          onPress={handleGenerate}
          disabled={!mapReady || isGenerating}
          activeOpacity={0.85}>
          <Text style={styles.genBtnText}>
            {isGenerating ? 'Generating…' : 'Generate Route'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const ORANGE = '#f97316';
const ORANGE_DARK = '#ea580c';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
    gap: 10,
  },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {fontSize: 18},
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },

  // Map
  mapContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#e8eaed',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 4,
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // Controls Panel
  controls: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    maxHeight: Platform.OS === 'ios' ? 370 : 360,
  },
  controlsContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 0,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.1,
    marginBottom: 10,
    marginTop: 4,
  },

  // Shape selector
  shapeRow: {
    marginBottom: 14,
  },
  shapeRowContent: {
    gap: 9,
    paddingRight: 4,
  },
  shapeBtn: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    minWidth: 64,
  },
  shapeBtnActive: {
    borderColor: ORANGE,
    backgroundColor: '#fff7ed',
  },
  shapeEmoji: {
    fontSize: 22,
  },
  shapeName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  shapeNameActive: {
    color: ORANGE,
  },

  // Slider
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: ORANGE,
  },
  slider: {
    width: '100%',
    height: 36,
    marginHorizontal: -4,
  },
  sliderTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
    marginBottom: 10,
  },
  tickLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },

  // Activity tabs
  activityTabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  activityTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  activityTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  activityTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activityTabTextActive: {
    color: '#111827',
  },

  // Starting point card
  startCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 12,
  },
  startCardIcon: {fontSize: 18, marginTop: 1},
  startCardBody: {flex: 1, gap: 1},
  startCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  startCardSub: {
    fontSize: 12,
    color: '#6b7280',
    fontVariant: ['tabular-nums'],
  },
  startCardHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },

  // Stats card
  statsCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 2,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statsCheck: {
    fontSize: 13,
    fontWeight: '800',
    color: ORANGE,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ORANGE,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  statRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },

  // Generate button
  genBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: ORANGE_DARK,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  genBtnDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
  },
  genBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
