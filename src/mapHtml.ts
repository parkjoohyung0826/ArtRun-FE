import {NAVER_MAP_NCP_KEY_ID} from './config';

const NAVER_MAP_SCRIPT_URL =
  `https://oapi.map.naver.com/openapi/v3/maps.js?` +
  `ncpKeyId=${NAVER_MAP_NCP_KEY_ID}&ncpClientId=${NAVER_MAP_NCP_KEY_ID}`;

// Embedded NAVER map HTML rendered inside react-native-webview.
// Communication protocol:
//   RN -> WebView: postMessage(JSON string)
//     { type: 'GENERATE', shapePts, targetKm, startLat, startLng }
//     { type: 'DRAW_ROUTE', points: [{lat, lng}], startLat?, startLng? }
//     { type: 'UPDATE_RUNNER', location: {lat, lng} }
//     { type: 'SET_LOCATION', lat, lng }
//     { type: 'CLEAR' }
//   WebView -> RN: ReactNativeWebView.postMessage(JSON string)
//     { type: 'READY' }
//     { type: 'MAP_CLICK', lat, lng }
//     { type: 'ROUTING_START' }
//     { type: 'ROUTE_DONE', distM, durS, routePoints }
//     { type: 'ROUTE_ERROR', message }

export const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <script src="${NAVER_MAP_SCRIPT_URL}"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #e8eaed; }
    #map { width: 100%; height: 100%; }
    .marker-dot {
      width: 18px;
      height: 18px;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    }
    .start-dot { background: #f97316; }
    .runner-dot {
      width: 20px;
      height: 20px;
      background: #2f80ff;
      border: 4px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 12px rgba(47,128,255,0.55);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = null;
    var routeLine = null;
    var startMarker = null;
    var runnerMarker = null;
    var startPosition = { lat: 37.5665, lng: 126.9780 };

    function send(data) {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
        }
      } catch(e) {}
    }

    function toLatLng(point) {
      return new naver.maps.LatLng(point.lat, point.lng);
    }

    function createHtmlMarker(position, html) {
      return new naver.maps.Marker({
        map: map,
        position: position,
        icon: {
          content: html,
          size: new naver.maps.Size(24, 24),
          anchor: new naver.maps.Point(12, 12)
        }
      });
    }

    function setStartMarker(position) {
      if (startMarker) startMarker.setMap(null);
      startMarker = createHtmlMarker(
        position,
        '<div class="marker-dot start-dot"></div>'
      );
    }

    function setRunnerMarker(position) {
      if (!runnerMarker) {
        runnerMarker = createHtmlMarker(position, '<div class="runner-dot"></div>');
      } else {
        runnerMarker.setPosition(position);
      }
    }

    function haversineMeters(a, b) {
      var earth = 6371000;
      var toRad = function(deg) { return deg * Math.PI / 180; };
      var dLat = toRad(b.lat - a.lat);
      var dLng = toRad(b.lng - a.lng);
      var lat1 = toRad(a.lat);
      var lat2 = toRad(b.lat);
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(lat1) * Math.cos(lat2)
        * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * earth * Math.asin(Math.sqrt(h));
    }

    function routeDistanceMeters(points) {
      var total = 0;
      for (var i = 1; i < points.length; i++) {
        total += haversineMeters(points[i - 1], points[i]);
      }
      return total;
    }

    function fitRoute(path) {
      if (!path.length) return;
      var bounds = new naver.maps.LatLngBounds(path[0], path[0]);
      path.forEach(function(point) {
        bounds.extend(point);
      });
      map.fitBounds(bounds, { top: 70, right: 50, bottom: 70, left: 50 });
    }

    function clearRoute() {
      if (routeLine) {
        routeLine.setMap(null);
        routeLine = null;
      }
    }

    function drawPolyline(points, startLat, startLng) {
      if (!points || !points.length) return;
      var path = points.map(toLatLng);

      clearRoute();
      routeLine = new naver.maps.Polyline({
        map: map,
        path: path,
        strokeColor: '#ef4444',
        strokeOpacity: 0.95,
        strokeWeight: 6,
        strokeLineCap: 'round',
        strokeLineJoin: 'round'
      });

      fitRoute(path);

      var markerPoint = new naver.maps.LatLng(
        startLat || points[0].lat,
        startLng || points[0].lng
      );
      setStartMarker(markerPoint);
    }

    function shapePerimeter(pts) {
      var total = 0;
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        total += Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));
      }
      return total;
    }

    function generateRoute(msg) {
      var shapePts = msg.shapePts || [];
      var targetKm = msg.targetKm || 5;
      var startLat = msg.startLat || startPosition.lat;
      var startLng = msg.startLng || startPosition.lng;

      if (!shapePts.length) {
        send({ type: 'ROUTE_ERROR', message: 'shapePts is empty' });
        return;
      }

      send({ type: 'ROUTING_START' });

      var peri = shapePerimeter(shapePts);
      var scaleM = (targetKm * 1000) / peri;
      var cx = 0, cy = 0;
      for (var i = 0; i < shapePts.length; i++) {
        cx += shapePts[i][0];
        cy += shapePts[i][1];
      }
      cx /= shapePts.length;
      cy /= shapePts.length;

      var latPerM = 1 / 111320;
      var lngPerM = 1 / (111320 * Math.cos(startLat * Math.PI / 180));

      var routePoints = shapePts.map(function(p) {
        return {
          lat: startLat + (cy - p[1]) * scaleM * latPerM,
          lng: startLng + (p[0] - cx) * scaleM * lngPerM
        };
      });
      routePoints.push(routePoints[0]);

      drawPolyline(routePoints, startLat, startLng);

      var distM = routeDistanceMeters(routePoints);
      var durS = Math.round(distM / 1000 * 360);
      setTimeout(function() {
        send({ type: 'ROUTE_DONE', distM: distM, durS: durS, routePoints: routePoints });
      }, 120);
    }

    function drawRoute(msg) {
      var points = msg.points || [];
      drawPolyline(points, msg.startLat, msg.startLng);
    }

    function updateRunner(location) {
      if (!location) return;
      var pos = new naver.maps.LatLng(location.lat, location.lng);
      setRunnerMarker(pos);
      map.panTo(pos);
    }

    function setLocation(lat, lng) {
      startPosition = { lat: lat, lng: lng };
      var pos = new naver.maps.LatLng(lat, lng);
      map.setCenter(pos);
      setStartMarker(pos);
    }

    function handleMessage(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'GENERATE') generateRoute(msg);
        else if (msg.type === 'DRAW_ROUTE') drawRoute(msg);
        else if (msg.type === 'UPDATE_RUNNER') updateRunner(msg.location);
        else if (msg.type === 'SET_LOCATION') setLocation(msg.lat, msg.lng);
        else if (msg.type === 'CLEAR') clearRoute();
      } catch(err) {
        send({ type: 'ROUTE_ERROR', message: String(err && err.message ? err.message : err) });
      }
    }

    function initMap() {
      if (!window.naver || !naver.maps) {
        send({ type: 'ROUTE_ERROR', message: 'NAVER Maps SDK failed to load' });
        return;
      }

      map = new naver.maps.Map('map', {
        center: new naver.maps.LatLng(startPosition.lat, startPosition.lng),
        zoom: 14,
        scaleControl: false,
        logoControl: true,
        mapDataControl: false,
        zoomControl: false
      });

      naver.maps.Event.addListener(map, 'click', function(e) {
        send({ type: 'MAP_CLICK', lat: e.coord.lat(), lng: e.coord.lng() });
      });

      setStartMarker(new naver.maps.LatLng(startPosition.lat, startPosition.lng));
      send({ type: 'READY' });
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
    window.addEventListener('load', initMap);
  </script>
</body>
</html>`;
