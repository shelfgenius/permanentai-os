import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore.js';
import { CAR_CLASSES, CAR_MODELS, DEFAULT_VEHICLE, findClass, findModel } from '../../lib/mappy/cars.js';
import { searchPlaces, reverseGeocode, routeBetween, humanInstruction, formatDistance, formatDuration } from '../../lib/mappy/nav.js';
import { ALL_RADARS, nearestRadarAhead, bearingTo, haversineMeters, radarLabel } from '../../lib/mappy/radar.js';
import { enqueueSpeak } from '../../lib/ttsQueue.js';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

/* ── Leaflet loader (vanilla, so we don't pull another React wrapper) ─── */
function useLeaflet() {
  const [L, setL] = useState(() => (typeof window !== 'undefined' ? window.L : null));
  useEffect(() => {
    if (L) return;
    if (document.getElementById('leaflet-css')) return;
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => setL(window.L);
    document.body.appendChild(s);
  }, [L]);
  return L;
}

/* ── Radar icon factory ─────────────────────────────────────────── */
function radarDivIcon(L, type) {
  const colour = type === 'redlight'  ? '#ff3366'
               : type === 'mobile'    ? '#ff9f0a'
               : type === 'average'   ? '#5e5ce6'
               : type === 'rovinieta' ? '#22d3ee'
               :                        '#ff453a';
  return L.divIcon({
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${colour};border:2px solid #fff;
      box-shadow:0 0 10px ${colour}aa, 0 1px 3px rgba(0,0,0,0.5);
    "></div>`,
    className: '',
    iconAnchor: [10, 10],
  });
}

function userDivIcon(L, heading, vehicleIcon = '🚗', label = '') {
  // Arrow + vehicle puck rotates with heading; label pill stays upright via
  // a second counter-rotation.
  const unrotate = -heading;
  const safeLabel = label ? String(label).replace(/</g, '&lt;').slice(0, 28) : '';
  return L.divIcon({
    html: `
      <div style="position:relative;width:0;height:0;">
        <!-- rotating arrow + car puck -->
        <div style="
          position:absolute;left:-20px;top:-20px;width:40px;height:40px;
          transform:rotate(${heading}deg);transform-origin:center;
          display:flex;align-items:center;justify-content:center;
        ">
          <!-- compass arrow -->
          <div style="
            position:absolute;top:-4px;left:50%;transform:translateX(-50%);
            width:0;height:0;
            border-left:8px solid transparent;border-right:8px solid transparent;
            border-bottom:14px solid #0a84ff;
            filter:drop-shadow(0 0 6px rgba(10,132,255,0.7));
          "></div>
          <!-- vehicle puck -->
          <div style="
            width:34px;height:34px;border-radius:50%;
            background:linear-gradient(135deg,#0a84ff,#5e5ce6);
            border:3px solid #fff;
            box-shadow:0 0 14px rgba(10,132,255,0.55),0 3px 10px rgba(0,0,0,0.45);
            display:flex;align-items:center;justify-content:center;
            font-size:17px;
          ">
            <span style="transform:rotate(${unrotate}deg);">${vehicleIcon}</span>
          </div>
        </div>
        ${safeLabel ? `
          <!-- upright label -->
          <div style="
            position:absolute;top:22px;left:50%;transform:translateX(-50%);
            background:rgba(255,255,255,0.92);backdrop-filter:blur(10px);
            -webkit-backdrop-filter:blur(10px);
            color:#1d1d1f;font-family:'IBM Plex Mono',monospace;
            font-size:9px;letter-spacing:0.12em;text-transform:uppercase;
            padding:3px 8px;border-radius:999px;
            border:1px solid rgba(0,0,0,0.08);
            white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4);
          ">${safeLabel}</div>` : ''}
      </div>
    `,
    className: '',
    iconAnchor: [0, 0],
  });
}

/* ── Main component ──────────────────────────────────────────── */
export default function MappyMap() {
  const L = useLeaflet();
  const { backendUrl } = useStore();

  const mapDivRef  = useRef(null);
  const mapRef     = useRef(null);
  const userMarkerRef = useRef(null);
  const routeLineRef  = useRef(null);
  const destMarkerRef = useRef(null);
  const radarLayerRef = useRef(null);
  const watchIdRef    = useRef(null);
  const lastPosRef    = useRef(null);
  const lastAnnouncedRadarRef = useRef(null);
  const lastAnnouncedStepRef  = useRef(-1);

  const tileLayerRef = useRef(null);
  const [mapStyle,   setMapStyle]   = useState(() => localStorage.getItem('mappy.style') || 'light');
  const [userPos,    setUserPos]    = useState(null);   // {lat,lng}
  const [heading,    setHeading]    = useState(0);       // degrees 0-360
  const [speed,      setSpeed]      = useState(0);        // m/s
  const [vehicle,    setVehicle]    = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('mappy.vehicle') || 'null');
      return stored ?? DEFAULT_VEHICLE;
    } catch { return DEFAULT_VEHICLE; }
  });
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const [route,   setRoute]   = useState(null);   // {distance,duration,geometry,steps}
  const [destination, setDestination] = useState(null);   // {lat,lng,label}
  const [currentStep, setCurrentStep] = useState(0);
  const [routing, setRouting] = useState(false);

  const [radarAhead, setRadarAhead] = useState(null);
  const [muted,      setMuted]      = useState(false);

  // Pick-on-map workflow (Uber/Bolt-style tap to drop a destination pin)
  const [pickMode,   setPickMode]   = useState(false);
  const [pendingPin, setPendingPin] = useState(null);    // {lat,lng,label}
  const pendingPinMarkerRef = useRef(null);

  // Incident reporting (Waze-style)
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [incidents, setIncidents] = useState([]);  // local session incidents
  const incidentMarkersRef = useRef([]);

  // Route alternatives
  const [altRoutes,    setAltRoutes]    = useState([]);   // [{distance,duration,geometry,steps}]
  const [showAltPanel, setShowAltPanel] = useState(false);
  const altLinesRef = useRef([]);

  // EV charging stations
  const [showEV,    setShowEV]    = useState(false);
  const [evStations,setEvStations]= useState([]);
  const evLayerRef = useRef(null);

  const vehicleClass = findClass(vehicle.classId);
  const vehicleModel = findModel(vehicle.classId, vehicle.modelId);

  /* ── Persist vehicle selection ───────────────────────────── */
  useEffect(() => {
    localStorage.setItem('mappy.vehicle', JSON.stringify(vehicle));
  }, [vehicle]);

  /* ── Init map ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!L || !mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      zoomControl: false,
      attributionControl: false,
      tap: true,
    }).setView([44.1715, 28.6455], 14);   // default: Constanța

    // Initial tiles (dark or satellite based on persisted preference)
    tileLayerRef.current = buildTileLayer(L, mapStyle).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Radar layer (always on)
    const radarLayer = L.layerGroup().addTo(map);
    for (const r of ALL_RADARS) {
      L.marker([r.lat, r.lng], { icon: radarDivIcon(L, r.type) })
        .bindTooltip(`${radarLabel(r)}${r.road ? ' · ' + r.road : ''}`, { direction: 'top' })
        .addTo(radarLayer);
    }
    radarLayerRef.current = radarLayer;

    mapRef.current = map;
  }, [L]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pick-on-map: bind/unbind the click handler ─────────────── */
  useEffect(() => {
    if (!L || !mapRef.current) return;
    const map = mapRef.current;
    const container = map.getContainer();
    container.style.cursor = pickMode ? 'crosshair' : '';

    const handler = async (e) => {
      const { lat, lng } = e.latlng;
      // Drop pending pin immediately with a provisional label
      setPendingPin({ lat, lng, label: 'Locating…' });
      // Reverse-geocode in the background to get a human-readable address
      try {
        const r = await reverseGeocode({ lat, lng });
        setPendingPin({
          lat, lng,
          label: r?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        });
      } catch {
        setPendingPin({ lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      }
      setPickMode(false);   // one-shot: exit pick mode after drop
    };

    if (pickMode) map.on('click', handler);
    return () => { map.off('click', handler); container.style.cursor = ''; };
  }, [L, pickMode]);

  /* ── Render the pending pin on the map ───────────────────────── */
  useEffect(() => {
    if (!L || !mapRef.current) return;
    if (pendingPinMarkerRef.current) {
      mapRef.current.removeLayer(pendingPinMarkerRef.current);
      pendingPinMarkerRef.current = null;
    }
    if (!pendingPin) return;
    pendingPinMarkerRef.current = L.marker([pendingPin.lat, pendingPin.lng], {
      icon: L.divIcon({
        html: `<div style="
          width:26px;height:26px;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          background:linear-gradient(135deg,#ff9f0a 0%,#ff453a 100%);
          border:3px solid #fff;
          box-shadow:0 6px 18px rgba(255,69,58,0.55),0 3px 8px rgba(0,0,0,0.5);
        "></div>`,
        className: '',
        iconAnchor: [13, 26],
      }),
    }).addTo(mapRef.current);
    // Pan to show the pin nicely
    mapRef.current.panTo([pendingPin.lat, pendingPin.lng], { animate: true });
  }, [L, pendingPin]);

  /* ── Swap tiles when user toggles satellite/dark ────────────── */
  useEffect(() => {
    localStorage.setItem('mappy.style', mapStyle);
    if (!L || !mapRef.current) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = buildTileLayer(L, mapStyle).addTo(mapRef.current);
    // Keep radar/route layers on top. Only Path-like layers have bringToFront;
    // LayerGroup doesn't, so we walk its children.
    const bring = (layer) => {
      if (!layer) return;
      if (typeof layer.bringToFront === 'function') layer.bringToFront();
      else if (typeof layer.eachLayer === 'function') layer.eachLayer(bring);
    };
    bring(radarLayerRef.current);
    bring(routeLineRef.current);
  }, [L, mapStyle]);

  /* ── Geolocation watch ───────────────────────────────────── */
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUserPos(pos);
        setSpeed(p.coords.speed || 0);
        if (typeof p.coords.heading === 'number' && !isNaN(p.coords.heading)) {
          setHeading(p.coords.heading);
        } else if (lastPosRef.current) {
          // derive heading from two successive fixes
          const b = bearingTo(lastPosRef.current, pos);
          setHeading(b);
        }
        lastPosRef.current = pos;
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
    watchIdRef.current = id;
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  /* ── Update user marker on the map ──────────────────────── */
  useEffect(() => {
    if (!L || !mapRef.current || !userPos) return;
    const label = vehicleModel?.label || vehicleClass.label;
    const icon  = userDivIcon(L, heading, vehicleClass.icon, label);
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([userPos.lat, userPos.lng], {
        icon, interactive: false, zIndexOffset: 1000,
      }).addTo(mapRef.current);
      mapRef.current.setView([userPos.lat, userPos.lng], 16, { animate: true });
    } else {
      userMarkerRef.current.setLatLng([userPos.lat, userPos.lng]);
      userMarkerRef.current.setIcon(icon);
      if (route) {
        // Close-follow during navigation (Waze-style close view)
        mapRef.current.setView([userPos.lat, userPos.lng], 17, {
          animate: true, duration: 0.6,
        });
      }
    }
  }, [L, userPos, heading, route, vehicleClass.icon, vehicleClass.label, vehicleModel]);

  /* ── Radar proximity warnings ──────────────────────────── */
  useEffect(() => {
    if (!userPos) return;
    const r = nearestRadarAhead(userPos, heading, 900);
    setRadarAhead(r);
    if (!r || muted) return;
    // announce once per unique radar when we enter 500m band
    if (r.distance < 500 && lastAnnouncedRadarRef.current !== r.id) {
      lastAnnouncedRadarRef.current = r.id;
      speak(`${radarLabel(r)} ahead in ${Math.round(r.distance)} meters.`, backendUrl);
    }
    // reset when we leave the band so it can re-announce next time
    if (r.distance > 800) lastAnnouncedRadarRef.current = null;
  }, [userPos, heading, muted, backendUrl]);

  /* ── Turn-by-turn voice announcement ───────────────────── */
  useEffect(() => {
    if (!route || !userPos) return;
    const step = route.steps[currentStep];
    if (!step) return;
    const d = haversineMeters(userPos, { lat: step.location[0], lng: step.location[1] });
    // advance step when within 25m
    if (d < 25 && currentStep < route.steps.length - 1) {
      setCurrentStep((i) => i + 1);
      return;
    }
    // announce upcoming step at ~150m
    if (d < 180 && lastAnnouncedStepRef.current !== currentStep && !muted) {
      lastAnnouncedStepRef.current = currentStep;
      speak(`In ${Math.round(d)} meters. ${step.instruction}.`, backendUrl);
    }
  }, [userPos, route, currentStep, muted, backendUrl]);

  /* ── Search (debounced) ─────────────────────────────────── */
  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await searchPlaces(query, { near: userPos });
      setResults(r);
    }, 280);
    return () => clearTimeout(t);
  }, [query, userPos]);

  /* ── Route alternatives (compute alongside primary route) ─── */
  const computeAlternatives = useCallback(async (from, to, profile) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
      const r = await fetch(url);
      const data = await r.json();
      if (!data.routes || data.routes.length < 2) return [];
      return data.routes.slice(1).map(rt => ({
        distance: rt.distance,
        duration: rt.duration,
        geometry: rt.geometry.coordinates.map(c => [c[1], c[0]]),
        steps: rt.legs[0]?.steps?.map(s => ({
          instruction: s.maneuver?.instruction || humanInstruction(s),
          location: s.maneuver?.location?.reverse ? s.maneuver.location : [s.maneuver.location[1], s.maneuver.location[0]],
          duration: s.duration,
        })) || [],
      }));
    } catch { return []; }
  }, []);

  /* ── Start navigation to a destination ─────────────────── */
  const navigateTo = useCallback(async (dest) => {
    if (!L || !mapRef.current) return;
    setRouting(true);
    setSearchOpen(false);
    setResults([]);
    setQuery(dest.label || '');
    setDestination(dest);

    // 1. Drop destination pin immediately (before route resolves)
    if (destMarkerRef.current) mapRef.current.removeLayer(destMarkerRef.current);
    destMarkerRef.current = L.marker([dest.lat, dest.lng], {
      icon: L.divIcon({
        html: `
          <div style="position:relative;">
            <div style="
              width:22px;height:22px;border-radius:50%;
              background:#ff453a;border:3px solid #fff;
              box-shadow:0 0 12px rgba(255,69,58,0.65),0 2px 6px rgba(0,0,0,0.45);
              display:flex;align-items:center;justify-content:center;
              color:#fff;font-size:12px;font-weight:700;
            ">📍</div>
          </div>`,
        className: '', iconAnchor: [14, 14],
      }),
    }).addTo(mapRef.current);

    // 2. Fit bounds to show both user + destination (auto-zoom to route area)
    if (userPos) {
      const bounds = L.latLngBounds([[userPos.lat, userPos.lng], [dest.lat, dest.lng]]);
      mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16, animate: true });
    } else {
      mapRef.current.setView([dest.lat, dest.lng], 15, { animate: true });
    }

    if (!userPos) {
      setRouting(false);
      speak('Waiting for your location to compute route.', backendUrl);
      return;
    }

    // 3. Compute route via OSRM
    const r = await routeBetween(userPos, dest, vehicleClass.profile);
    setRouting(false);
    if (!r) { speak('Sorry, no route found.', backendUrl); return; }
    setRoute(r);
    setCurrentStep(0);
    lastAnnouncedStepRef.current = -1;

    // 4. Draw route polyline and snap view to the whole route, then close-in
    if (routeLineRef.current) mapRef.current.removeLayer(routeLineRef.current);
    routeLineRef.current = L.polyline(r.geometry, {
      color: '#0a84ff', weight: 6, opacity: 0.9,
    }).addTo(mapRef.current);
    mapRef.current.fitBounds(routeLineRef.current.getBounds(), { padding: [70, 70], animate: true });

    // 5. After briefly showing the full route, zoom into user for live nav
    setTimeout(() => {
      if (mapRef.current && userPos) {
        mapRef.current.setView([userPos.lat, userPos.lng], 17, { animate: true, duration: 1.0 });
      }
    }, 1600);

    speak(`Route set. ${formatDistance(r.distance)}, ${formatDuration(r.duration)}.`, backendUrl);

    // Compute alternative routes in background (non-blocking)
    computeAlternatives(userPos, dest, vehicleClass.profile).then(alts => {
      setAltRoutes(alts);
      if (alts.length > 0) setShowAltPanel(true);
    });
  }, [userPos, L, vehicleClass.profile, backendUrl, computeAlternatives]); // computeAlternatives stable (empty deps)

  const cancelRoute = useCallback(() => {
    if (routeLineRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (destMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }
    setRoute(null);
    setDestination(null);
    setCurrentStep(0);
    setAltRoutes([]);
    setShowAltPanel(false);
  }, []);

  const recenter = useCallback(() => {
    if (userPos && mapRef.current) {
      mapRef.current.setView([userPos.lat, userPos.lng], 16, { animate: true });
    }
  }, [userPos]);

  const currentStepObj = route?.steps?.[currentStep];
  const remainingDistance = useMemo(() => {
    if (!route || !userPos) return 0;
    const last = route.steps[route.steps.length - 1];
    if (!last) return route.distance;
    return haversineMeters(userPos, { lat: last.location[0], lng: last.location[1] });
  }, [route, userPos]);

  /* ── Incident reporting ──────────────────────────────────── */
  const INCIDENT_TYPES = [
    { id: 'police',   icon: '🚓', label: 'Poliție',    color: '#ff453a' },
    { id: 'accident', icon: '💥', label: 'Accident',   color: '#ff9f0a' },
    { id: 'roadwork', icon: '🚧', label: 'Lucrări',    color: '#ffd60a' },
    { id: 'hazard',   icon: '⚠️', label: 'Pericol',    color: '#ff6b35' },
    { id: 'closure',  icon: '🚫', label: 'Blocat',     color: '#ff453a' },
    { id: 'jam',      icon: '🐢', label: 'Aglomerație',color: '#ff9f0a' },
  ];

  const reportIncident = useCallback((type) => {
    if (!userPos || !L || !mapRef.current) return;
    const inc = { id: Date.now(), type, lat: userPos.lat, lng: userPos.lng };
    setIncidents(prev => [...prev, inc]);
    const t = INCIDENT_TYPES.find(t => t.id === type);
    const marker = L.marker([userPos.lat, userPos.lng], {
      icon: L.divIcon({
        html: `<div style="font-size:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${t?.icon || '⚠️'}</div>`,
        className: '', iconAnchor: [11, 11],
      }),
    }).addTo(mapRef.current);
    incidentMarkersRef.current.push(marker);
    setShowReportMenu(false);
    speak(`${t?.label || type} raportat.`, backendUrl);
  }, [userPos, L, backendUrl]);

  /* ── EV Charging stations (OpenChargeMap free API) ───────── */
  useEffect(() => {
    if (!showEV || !L || !mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    const url = `https://api.openchargemap.io/v3/poi/?output=json&maxresults=40&compact=true&verbose=false&boundingbox=${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    fetch(url).then(r => r.json()).then(data => {
      setEvStations(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [showEV, L]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!L || !mapRef.current) return;
    // Remove old EV layer
    if (evLayerRef.current) {
      mapRef.current.removeLayer(evLayerRef.current);
      evLayerRef.current = null;
    }
    if (!showEV || evStations.length === 0) return;
    const layer = L.layerGroup();
    evStations.forEach(s => {
      const lat = s.AddressInfo?.Latitude;
      const lng = s.AddressInfo?.Longitude;
      const name = s.AddressInfo?.Title || 'EV Charger';
      if (!lat || !lng) return;
      L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="background:#22d3ee;color:#000;font-size:11px;font-weight:700;padding:3px 6px;border-radius:8px;border:2px solid #fff;box-shadow:0 2px 8px rgba(34,211,238,0.5);white-space:nowrap;">⚡</div>`,
          className: '', iconAnchor: [10, 10],
        }),
      }).bindTooltip(name, { direction: 'top' }).addTo(layer);
    });
    layer.addTo(mapRef.current);
    evLayerRef.current = layer;
  }, [L, showEV, evStations]);

  // Draw/clear alternative polylines on the map
  useEffect(() => {
    if (!L || !mapRef.current) return;
    altLinesRef.current.forEach(l => mapRef.current.removeLayer(l));
    altLinesRef.current = [];
    if (!showAltPanel) return;
    altRoutes.forEach((rt, i) => {
      const line = L.polyline(rt.geometry, {
        color: i === 0 ? '#a78bfa' : '#22d3ee',
        weight: 4, opacity: 0.65, dashArray: '8 6',
      }).addTo(mapRef.current);
      altLinesRef.current.push(line);
    });
  }, [L, altRoutes, showAltPanel]);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="relative w-full h-full" style={{ background: '#f5f5f7' }}>
      {/* Map canvas */}
      <div ref={mapDivRef} className="absolute inset-0" />

      {/* ── Search bar (top) ──────────────────────── */}
      <div className="absolute top-3 left-3 right-3 z-[1000]">
        <div
          className="flex items-center gap-2 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '10px 14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}
        >
          <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.4)' }}>🔎</span>
          <input
            type="text"
            placeholder="Search address, place or city…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ minWidth: 0, color: '#1d1d1f' }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }}
              style={{ color: 'rgba(0,0,0,0.35)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14 }}>
              ✕
            </button>
          )}
        </div>

        {/* Search results */}
        <AnimatePresence>
          {searchOpen && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-2 rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.94)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(0,0,0,0.06)',
                maxHeight: '50vh', overflowY: 'auto',
              }}
            >
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigateTo({ lat: r.lat, lng: r.lng, label: r.label })}
                  className="w-full text-left px-4 py-3"
                  style={{
                    color: '#1d1d1f',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, lineHeight: 1.4 }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)', marginTop: 2, fontFamily: MONO }}>
                    {r.type?.toUpperCase() || 'LOCATION'}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Pick-mode hint (top-center) ─────────────── */}
      <AnimatePresence>
        {pickMode && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            className="absolute left-1/2 z-[1001] rounded-full"
            style={{
              top: 72, transform: 'translateX(-50%)',
              background: 'rgba(10,132,255,0.95)',
              color: '#fff', padding: '10px 18px',
              fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em',
              textTransform: 'uppercase',
              boxShadow: '0 10px 30px rgba(10,132,255,0.45)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <span>📍 Tap anywhere on the map</span>
            <button
              onClick={() => setPickMode(false)}
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none',
                color: '#fff', borderRadius: 999, padding: '4px 10px',
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom action bar ─────────────────────── */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex flex-col gap-2">
        {/* Pending-pin confirmation (Uber/Bolt style) */}
        <AnimatePresence>
          {pendingPin && !route && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.94)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(255,159,10,0.25)',
                color: '#1d1d1f', padding: '14px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#ff9f0a', marginBottom: 6 }}>
                Destination picked
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 12, color: 'rgba(0,0,0,0.85)' }}>
                {pendingPin.label}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    const dest = { lat: pendingPin.lat, lng: pendingPin.lng, label: pendingPin.label };
                    setPendingPin(null);
                    navigateTo(dest);
                  }}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg,#0a84ff 0%,#5e5ce6 100%)',
                    border: 'none', color: '#fff',
                    padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em',
                    textTransform: 'uppercase', fontWeight: 600,
                    boxShadow: '0 6px 20px rgba(10,132,255,0.35)',
                  }}
                >
                  🧭 Go here
                </button>
                <button
                  onClick={() => setPendingPin(null)}
                  style={{
                    background: 'rgba(0,0,0,0.04)',
                    border: '1px solid rgba(0,0,0,0.10)', color: '#374151',
                    padding: '11px 16px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active route banner */}
        <AnimatePresence>
          {route && currentStepObj && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="rounded-2xl"
              style={{
                background: 'rgba(10,132,255,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                color: '#fff',
                padding: '14px 16px',
                boxShadow: '0 10px 30px rgba(10,132,255,0.35)',
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.8, marginBottom: 6 }}>
                In {formatDistance(haversineMeters(userPos || { lat:0,lng:0 }, { lat: currentStepObj.location[0], lng: currentStepObj.location[1] }))}
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{currentStepObj.instruction}</div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, fontFamily: MONO }}>
                {formatDistance(remainingDistance)} · {formatDuration(route.duration - route.steps.slice(0, currentStep).reduce((a,s)=>a+s.duration,0))} left
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Radar ahead banner */}
        <AnimatePresence>
          {radarAhead && radarAhead.distance < 500 && (
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              className="rounded-2xl flex items-center gap-3"
              style={{
                background: 'rgba(255,69,58,0.92)',
                color: '#fff',
                padding: '12px 14px',
                boxShadow: '0 10px 30px rgba(255,69,58,0.35)',
              }}
            >
              <div style={{ fontSize: 22 }}>📸</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.85 }}>
                  Radar ahead · {Math.round(radarAhead.distance)} m
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{radarLabel(radarAhead)}{radarAhead.road ? ` · ${radarAhead.road}` : ''}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Route alternatives panel ─────────────────── */}
        <AnimatePresence>
          {showAltPanel && altRoutes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(0,0,0,0.06)' }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)', padding: '10px 14px 6px' }}>
                Rute alternative
              </div>
              {altRoutes.map((rt, i) => (
                <button
                  key={i}
                  onClick={() => { setRoute(rt); setCurrentStep(0); setShowAltPanel(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    background: 'transparent', border: 'none', cursor: 'pointer', color: '#1d1d1f',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 11, color: i === 0 ? '#a78bfa' : '#22d3ee' }}>
                    {i === 0 ? '● Alternativă 1' : '● Alternativă 2'}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11 }}>
                    {formatDistance(rt.distance)} · {formatDuration(rt.duration)}
                  </span>
                </button>
              ))}
              <button onClick={() => setShowAltPanel(false)} style={{ width: '100%', padding: '8px', background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.35)', fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>
                ✕ Închide
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Incident report modal ─────────────────────── */}
        <AnimatePresence>
          {showReportMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(0,0,0,0.06)', padding: '12px' }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)', marginBottom: 10, textAlign: 'center' }}>
                Raportează · ce s-a întâmplat?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {INCIDENT_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => reportIncident(t.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 6px', borderRadius: 12,
                      background: `${t.color}18`, border: `1px solid ${t.color}44`,
                      cursor: 'pointer', color: '#1d1d1f',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{t.icon}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.color }}>{t.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowReportMenu(false)} style={{ width: '100%', marginTop: 10, padding: '8px', background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.3)', fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>
                Anulează
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vehicle + controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Speed HUD */}
          <div style={{
            minWidth: 58, height: 46, borderRadius: 14,
            background: speed * 3.6 > 120 ? 'rgba(255,69,58,0.9)' : 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: speed * 3.6 > 120 ? '#fff' : '#1d1d1f', lineHeight: 1 }}>
              {Math.round((speed || 0) * 3.6)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 7, color: speed * 3.6 > 120 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)', letterSpacing: '0.1em' }}>KM/H</span>
          </div>

          <button
            onClick={() => setShowVehiclePicker(true)}
            className="flex items-center gap-2 rounded-2xl flex-1"
            style={{
              background: 'rgba(255,255,255,0.90)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,0,0,0.06)',
              padding: '10px 12px', color: '#1d1d1f', cursor: 'pointer', minWidth: 0,
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{vehicleClass.icon}</span>
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {vehicleModel?.label || vehicleClass.label}
              </div>
            </div>
          </button>

          <CircleBtn onClick={() => setShowReportMenu(m => !m)} title="Raportează incident" active={showReportMenu}>
            🚨
          </CircleBtn>
          <CircleBtn onClick={() => { setPendingPin(null); setPickMode((m) => !m); }} title={pickMode ? 'Cancel' : 'Pin destinație'} active={pickMode}>
            📌
          </CircleBtn>
          <CircleBtn onClick={() => setShowEV(m => !m)} title="Stații EV" active={showEV}>
            ⚡
          </CircleBtn>
          <CircleBtn onClick={() => setMapStyle((s) => (s === 'light' ? 'satellite' : 'light'))} title="Stil hartă">
            {mapStyle === 'light' ? '🛰️' : '🗺️'}
          </CircleBtn>
          <CircleBtn onClick={() => setMuted((m) => !m)} title={muted ? 'Activează sunet' : 'Silențios'}>
            {muted ? '🔇' : '🔊'}
          </CircleBtn>
          <CircleBtn onClick={recenter} title="Centrează">📍</CircleBtn>
          {altRoutes.length > 0 && !route && (
            <CircleBtn onClick={() => setShowAltPanel(m => !m)} title="Rute alternative" active={showAltPanel}>
              �
            </CircleBtn>
          )}
          {route && <CircleBtn onClick={cancelRoute} title="Oprește navigarea" danger>✕</CircleBtn>}
        </div>
      </div>

      {/* ── Vehicle picker ─────────────────────────────── */}
      <AnimatePresence>
        {showVehiclePicker && (
          <VehiclePicker
            vehicle={vehicle}
            onChange={(v) => { setVehicle(v); setShowVehiclePicker(false); }}
            onClose={() => setShowVehiclePicker(false)}
          />
        )}
      </AnimatePresence>

      {/* routing spinner */}
      <AnimatePresence>
        {routing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[900] pointer-events-none flex items-center justify-center"
          >
            <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 16, padding: '14px 20px', color: '#1d1d1f', fontFamily: MONO, fontSize: 12, letterSpacing: '0.2em', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
              ROUTING…
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CircleBtn({ children, onClick, title, danger, active }) {
  const bg = active
    ? 'linear-gradient(135deg,#0a84ff 0%,#5e5ce6 100%)'
    : danger
      ? 'linear-gradient(135deg,#ff453a 0%,#ff3366 100%)'
      : 'rgba(255,255,255,0.88)';
  const border = active
    ? '1px solid rgba(10,132,255,0.5)'
    : danger
      ? '1px solid rgba(255,69,58,0.5)'
      : '1px solid rgba(0,0,0,0.06)';
  return (
    <button onClick={onClick} title={title} style={{
      width: 46, height: 46, borderRadius: '50%',
      background: bg,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border,
      color: (active || danger) ? '#fff' : '#374151', cursor: 'pointer', fontSize: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      transition: 'all 0.18s',
      boxShadow: active ? '0 0 20px rgba(10,132,255,0.5)' : '0 2px 8px rgba(0,0,0,0.06)',
    }}>{children}</button>
  );
}

function VehiclePicker({ vehicle, onChange, onClose }) {
  const [classId, setClassId] = useState(vehicle.classId);
  const models   = CAR_MODELS[classId] || [];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[1100]"
      style={{ background: 'rgba(0,0,0,0.18)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          maxHeight: '82vh',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase' }}>
            Choose vehicle
          </div>
          <button onClick={onClose} style={{ color: 'rgba(0,0,0,0.45)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Class row */}
        <div className="px-3 pb-3 overflow-x-auto" style={{ whiteSpace: 'nowrap' }}>
          {CAR_CLASSES.map((c) => (
            <button key={c.id}
              onClick={() => setClassId(c.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: classId === c.id ? 'rgba(10,132,255,0.10)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${classId === c.id ? 'rgba(10,132,255,0.5)' : 'rgba(0,0,0,0.06)'}`,
                color: classId === c.id ? '#0a84ff' : 'rgba(0,0,0,0.7)',
                borderRadius: 999, padding: '8px 14px', margin: '0 4px',
                fontSize: 12, fontFamily: MONO, letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}>
              <span style={{ fontSize: 15 }}>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        {/* Models list */}
        <div style={{ overflowY: 'auto', maxHeight: '50vh', padding: '0 10px 10px' }}>
          <button
            onClick={() => onChange({ classId, modelId: null })}
            className="w-full text-left"
            style={{
              background: 'transparent', border: '1px solid rgba(0,0,0,0.06)',
              color: '#1d1d1f', padding: '12px 14px', borderRadius: 12, marginBottom: 6, cursor: 'pointer',
            }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Generic {findClass(classId).label}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginTop: 2 }}>
              no specific model
            </div>
          </button>
          {models.map((m) => (
            <button key={m.id}
              onClick={() => onChange({ classId, modelId: m.id })}
              className="w-full text-left"
              style={{
                background: 'transparent', border: '1px solid rgba(0,0,0,0.06)',
                color: '#1d1d1f', padding: '12px 14px', borderRadius: 12, marginBottom: 6, cursor: 'pointer',
              }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
            </button>
          ))}
          {!models.length && (
            <div style={{ color: 'rgba(0,0,0,0.35)', padding: 16, fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' }}>
              No models listed — pick generic.
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Tile-layer factory (dark / satellite) ──────────────────────── */
function buildTileLayer(L, style) {
  if (style === 'satellite') {
    // Esri World Imagery — free, no API key, worldwide
    const imagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: '' },
    );
    // Overlay labels (semi-transparent street + place names)
    const labels = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, subdomains: 'abcd', opacity: 0.9 },
    );
    // Group them so one removal takes both off together
    return L.layerGroup([imagery, labels]);
  }
  // Default: light CartoDB Voyager tiles
  return L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { maxZoom: 19, subdomains: 'abcd' },
  );
}

/* ── TTS helper — delegates to singleton queue so no overlap ── */
function speak(text, backendUrl) {
  enqueueSpeak(text, backendUrl, 'condus').catch(() => {});
}
