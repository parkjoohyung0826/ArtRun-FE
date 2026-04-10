// Embedded Leaflet map HTML rendered inside react-native-webview.
// Communication protocol:
//   RN → WebView: postMessage(JSON string)
//     { type: 'GENERATE', shapePts, targetKm, profile, startLat, startLng }
//     { type: 'SET_LOCATION', lat, lng }
//     { type: 'CLEAR' }
//   WebView → RN: ReactNativeWebView.postMessage(JSON string)
//     { type: 'READY' }
//     { type: 'MAP_CLICK', lat, lng }
//     { type: 'ROUTING_START' }
//     { type: 'ROUTE_DONE', distM, durS }
//     { type: 'ROUTE_ERROR', message }

export const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #e8eaed; }
    #map { width: 100%; height: 100%; }
    .start-dot {
      width: 16px;
      height: 16px;
      background: #f97316;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    }
    .leaflet-control-zoom {
      margin-top: 12px !important;
      margin-right: 12px !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([37.5665, 126.9780], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '\\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    var routeLayer = null;
    var startMarker = null;

    var startIcon = L.divIcon({
      className: '',
      html: '<div class="start-dot"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    function send(data) {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
        }
      } catch(e) {}
    }

    map.on('click', function(e) {
      send({ type: 'MAP_CLICK', lat: e.latlng.lat, lng: e.latlng.lng });
    });

    function setLocation(lat, lng) {
      map.setView([lat, lng], 14);
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.marker([lat, lng], { icon: startIcon }).addTo(map);
    }

    function clearRoute() {
      if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    }

    function perimeter(pts) {
      var total = 0;
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        total += Math.sqrt(Math.pow(b[0]-a[0],2) + Math.pow(b[1]-a[1],2));
      }
      return total;
    }

    async function generateRoute(msg) {
      var shapePts = msg.shapePts;
      var targetKm = msg.targetKm;
      var profile = msg.profile;
      var startLat = msg.startLat;
      var startLng = msg.startLng;

      send({ type: 'ROUTING_START' });

      var peri = perimeter(shapePts);
      var scaleM = (targetKm * 1000) / peri;

      var cx = 0, cy = 0;
      for (var i = 0; i < shapePts.length; i++) { cx += shapePts[i][0]; cy += shapePts[i][1]; }
      cx /= shapePts.length; cy /= shapePts.length;

      var latPerM = 1 / 111320;
      var lngPerM = 1 / (111320 * Math.cos(startLat * Math.PI / 180));

      var waypoints = shapePts.map(function(p) {
        return {
          lat: startLat + (cy - p[1]) * scaleM * latPerM,
          lng: startLng + (p[0] - cx) * scaleM * lngPerM,
        };
      });

      // Close loop
      var wpts = waypoints.concat([waypoints[0]]);
      var coords = wpts.map(function(w) {
        return w.lng.toFixed(6) + ',' + w.lat.toFixed(6);
      }).join(';');

      var geojson, distM, durS;

      try {
        var url = 'https://router.project-osrm.org/route/v1/' + profile + '/' + coords
          + '?overview=full&geometries=geojson';
        var res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        if (data.code !== 'Ok' || !data.routes || !data.routes.length) throw new Error('No route');
        geojson = data.routes[0].geometry;
        distM = data.routes[0].distance;
        durS = data.routes[0].duration;
      } catch(err) {
        // Fallback: connect waypoints directly
        geojson = {
          type: 'LineString',
          coordinates: wpts.map(function(w) { return [w.lng, w.lat]; }),
        };
        distM = targetKm * 1000;
        durS = null;
      }

      if (routeLayer) map.removeLayer(routeLayer);
      routeLayer = L.geoJSON(geojson, {
        style: {
          color: '#ef4444',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        },
      }).addTo(map);

      map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

      // Re-place start marker on top
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.marker([startLat, startLng], { icon: startIcon }).addTo(map);

      send({ type: 'ROUTE_DONE', distM: distM, durS: durS });
    }

    function handleMessage(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'GENERATE') generateRoute(msg);
        else if (msg.type === 'SET_LOCATION') setLocation(msg.lat, msg.lng);
        else if (msg.type === 'CLEAR') clearRoute();
      } catch(err) {}
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    // Signal ready after Leaflet loads
    setTimeout(function() { send({ type: 'READY' }); }, 400);
  <\/script>
</body>
</html>`;
