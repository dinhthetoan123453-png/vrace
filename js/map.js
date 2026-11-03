/**
 * map.js - Khởi tạo Leaflet Map, định tuyến OSRM, hiển thị đường cong hữu cơ & đa dạng hoá lộ trình
 */

let map;
let waypoints = [];         // [{lat, lng}, ...]
let routeCoordinates = [];  // Tọa độ chi tiết bám đường OSRM + Uốn lượn hữu cơ
let markers = [];           // Leaflet marker instances
let routePolyline;          // Leaflet polyline instance
let routeFetchSeq = 0;

// Khoanh vùng giới hạn trên bản đồ cho Batch Export
let batchZoneBounds = null;      // L.latLngBounds
let batchZoneRectangle = null;   // L.rectangle instance
let isSelectingZone = false;     // Chế độ bấm bản đồ để khoanh vùng
let zoneStartPoint = null;

let userLocationMarker = null;
let isMapFullscreen = false;

function locateUserLocation() {
    if (!navigator.geolocation) {
        showToast("Trình duyệt không hỗ trợ định vị GPS!", "warn");
        return;
    }
    showToast("Đang xác định vị trí GPS của bạn...", "info");
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (map) {
                map.setView([lat, lng], 16);
                if (userLocationMarker) {
                    map.removeLayer(userLocationMarker);
                }
                const pulseIcon = L.divIcon({
                    className: 'user-location-marker',
                    html: '<div class="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md relative"><div class="absolute -inset-1 rounded-full bg-blue-400 opacity-75 animate-ping"></div></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                });
                userLocationMarker = L.marker([lat, lng], { icon: pulseIcon }).addTo(map);

                if (waypoints.length === 0) {
                    addWaypoint(lat, lng);
                    showToast("Đã đặt điểm xuất phát (A) tại vị trí GPS của bạn!", "success");
                } else {
                    showToast("Đã định vị thành công vị trí hiện tại!", "success");
                }
            }
        },
        (err) => {
            console.warn("GPS error:", err);
            showToast("Không thể lấy vị trí GPS (vui lòng bật quyền truy cập vị trí)!", "warn");
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
}

function toggleMapFullscreen() {
    isMapFullscreen = !isMapFullscreen;
    const mapCard = document.getElementById('mapCard');
    const mapEl = document.getElementById('map');
    const fsBtns = document.querySelectorAll('#btnMapFullscreen, #btnMapFullscreenDesk');

    if (isMapFullscreen) {
        if (mapCard) {
            mapCard.classList.add('fixed', 'inset-0', 'z-50', 'rounded-none', 'p-2', 'bg-white', 'm-0', 'max-w-none');
        }
        if (mapEl) {
            mapEl.classList.remove('h-[400px]', 'sm:h-[440px]', 'md:h-[480px]');
            mapEl.classList.add('h-[calc(100vh-140px)]');
        }
        fsBtns.forEach(btn => {
            btn.innerHTML = `<i data-lucide="minimize" class="w-4 h-4 text-slate-600"></i>`;
        });
        showToast("Đã mở rộng bản đồ toàn màn hình", "info");
    } else {
        if (mapCard) {
            mapCard.classList.remove('fixed', 'inset-0', 'z-50', 'rounded-none', 'p-2', 'bg-white', 'm-0', 'max-w-none');
        }
        if (mapEl) {
            mapEl.classList.remove('h-[calc(100vh-140px)]');
            mapEl.classList.add('h-[400px]', 'sm:h-[440px]', 'md:h-[480px]');
        }
        fsBtns.forEach(btn => {
            btn.innerHTML = `<i data-lucide="maximize" class="w-4 h-4 text-slate-600"></i>`;
        });
    }
    if (window.lucide) lucide.createIcons();
    if (map) {
        setTimeout(() => map.invalidateSize(), 150);
    }
}

function initMap() {
    // Tọa độ trung tâm mặc định: Thị trấn Cao Thượng, Tân Yên, Bắc Giang
    const defaultCenter = [21.3825, 106.1320];
    map = L.map('map', {
        zoomControl: true,
        attributionControl: false,
        tap: false
    }).setView(defaultCenter, 15);

    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    // 1. Google Maps Streets (Chuẩn giao diện Việt Nam)
    const googleStreets = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    }).addTo(map);

    // 2. OpenStreetMap Standard
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    });

    // 3. Esri World Imagery (Vệ tinh siêu nét)
    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri World Imagery'
    });

    // 4. Esri Street Map
    const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri'
    });

    // Thêm bộ chọn Layer nền góc trên bên phải
    L.control.layers({
        "📍 Google Maps": googleStreets,
        "🗺️ OpenStreetMap": osmLayer,
        "🛰️ Vệ tinh Esri": esriSatellite,
        "🌍 Esri Street Map": esriStreet
    }, null, { position: 'topright' }).addTo(map);

    // Khởi tạo Polyline lộ trình (màu cam Strava đậm, uốn cong mềm mại)
    routePolyline = L.polyline([], {
        color: '#fc4c02',
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
        smoothFactor: 1.0
    }).addTo(map);

    // Bắt sự kiện Click lên bản đồ
    map.on('click', function(e) {
        if (isSelectingZone) {
            handleZoneMapClick(e.latlng);
            return;
        }
        addWaypoint(e.latlng.lat, e.latlng.lng);
    });
}

function handleZoneMapClick(latlng) {
    if (!zoneStartPoint) {
        zoneStartPoint = latlng;
        showToast("Đã chọn góc 1. Nhấp tiếp một góc đối diện trên bản đồ để hoàn tất vùng!", "info");
    } else {
        const corner1 = zoneStartPoint;
        const corner2 = latlng;
        const bounds = L.latLngBounds(corner1, corner2);
        setBatchZoneBounds(bounds);
        isSelectingZone = false;
        zoneStartPoint = null;
        updateZoneButtonUI();
        showToast("Đã khoanh vùng giới hạn thành công!", "success");
    }
}

function setBatchZoneBounds(bounds) {
    batchZoneBounds = bounds;
    if (batchZoneRectangle) {
        map.removeLayer(batchZoneRectangle);
    }
    batchZoneRectangle = L.rectangle(bounds, {
        color: "#7c3aed",
        weight: 2,
        dashArray: "6, 6",
        fillColor: "#8b5cf6",
        fillOpacity: 0.12
    }).addTo(map);

    const statusEl = document.getElementById('batchZoneStatus');
    if (statusEl) {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        statusEl.innerText = `${sw.lat.toFixed(3)}, ${sw.lng.toFixed(3)} ➔ ${ne.lat.toFixed(3)}, ${ne.lng.toFixed(3)}`;
    }
}

function updateZoneButtonUI() {
    const btn = document.getElementById('btnToggleZoneSelect') || document.getElementById('btnSelectZone');
    if (!btn) return;
    if (isSelectingZone) {
        btn.classList.remove('bg-purple-50', 'text-purple-700', 'border-purple-200');
        btn.classList.add('bg-purple-600', 'text-white', 'border-purple-600', 'animate-pulse');
        btn.innerHTML = `<i data-lucide="crosshair" class="w-4 h-4"></i> Nhấp 2 điểm trên bản đồ...`;
    } else {
        btn.classList.remove('bg-purple-600', 'text-white', 'border-purple-600', 'animate-pulse');
        btn.classList.add('bg-purple-50', 'text-purple-700', 'border-purple-200');
        btn.innerHTML = `<i data-lucide="scan" class="w-4 h-4"></i> ${batchZoneBounds ? 'Khoanh lại vùng' : 'Khoanh vùng tạo hàng loạt'}`;
    }
    if (window.lucide) lucide.createIcons();
}

function toggleZoneSelectionMode() {
    isSelectingZone = !isSelectingZone;
    zoneStartPoint = null;
    updateZoneButtonUI();
    if (isSelectingZone) {
        showToast("Nhấp chuột điểm thứ nhất trên bản đồ để bắt đầu khoanh góc!", "info");
    }
}

function renderMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    waypoints.forEach((pt, index) => {
        let iconHtml = '';
        let className = 'custom-pin ';
        let iconSize = [24, 24];

        if (index === 0) {
            className += 'pin-start';
            iconHtml = 'A';
        } else if (index === waypoints.length - 1) {
            className += 'pin-end';
            iconHtml = 'B';
        } else {
            className += 'pin-waypoint';
            iconHtml = '';
            iconSize = [14, 14];
        }

        const customIcon = L.divIcon({
            className: className,
            html: iconHtml,
            iconSize: iconSize,
            iconAnchor: [iconSize[0] / 2, iconSize[1] / 2]
        });

        const marker = L.marker([pt.lat, pt.lng], {
            icon: customIcon,
            draggable: true
        }).addTo(map);

        marker.on('dragend', function(e) {
            const newPos = e.target.getLatLng();
            waypoints[index] = { lat: newPos.lat, lng: newPos.lng };
            renderRoute();
        });

        markers.push(marker);
    });
}

function addWaypoint(lat, lng) {
    waypoints.push({ lat, lng });
    renderRoute();
    if (waypoints.length === 1) {
        showToast("Đã chọn điểm xuất phát (A). Nhấp tiếp trên bản đồ để nối tuyến!", "info");
    }
}

async function fetchRouteFromOSRM(pts) {
    if (!pts || pts.length < 2) return pts;
    const coordsString = pts.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/foot/${coordsString}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("OSRM server error");
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const geoCoords = data.routes[0].geometry.coordinates;
        return geoCoords.map(c => ({ lat: c[1], lng: c[0] }));
    }
    throw new Error("No route found");
}

async function renderRoute() {
    renderMarkers();

    const snapToRoad = document.getElementById('chkSnapToRoad')?.checked ?? true;
    const humanCurve = document.getElementById('chkHumanCurve')?.checked ?? true;
    const spinner = document.getElementById('routingSpinner');

    if (waypoints.length < 2) {
        routeCoordinates = waypoints.slice();
        routePolyline.setLatLngs(routeCoordinates.map(w => [w.lat, w.lng]));
        updateOverviewStats();
        return;
    }

    const amp = parseFloat(document.getElementById('inputCurveAmp')?.value) || 6.2;

    if (!snapToRoad) {
        // Chế độ vẽ đường thẳng tự do có uốn lượn mềm mại
        const raw = waypoints.slice();
        routeCoordinates = humanCurve ? generateOrganicCurvedPath(raw, { enableCurve: true, curveAmp: amp }) : raw;
        routePolyline.setLatLngs(routeCoordinates.map(w => [w.lat, w.lng]));
        updateOverviewStats();
        return;
    }

    // Chế độ bám theo đường chạy thực tế OSRM
    const currentSeq = ++routeFetchSeq;
    if (spinner) {
        spinner.classList.remove('hidden');
        spinner.classList.add('flex');
    }

    try {
        const roadCoords = await fetchRouteFromOSRM(waypoints);
        if (currentSeq === routeFetchSeq) {
            // Áp dụng thuật toán Authentic Human Running & GPS Drift Engine để đường cong mềm mại như người thật
            routeCoordinates = humanCurve ? generateOrganicCurvedPath(roadCoords, { enableCurve: true, curveAmp: amp }) : roadCoords;
            routePolyline.setLatLngs(routeCoordinates.map(w => [w.lat, w.lng]));
            updateOverviewStats();
        }
    } catch (e) {
        if (currentSeq === routeFetchSeq) {
            const raw = waypoints.slice();
            routeCoordinates = humanCurve ? generateOrganicCurvedPath(raw, { enableCurve: true, curveAmp: amp }) : raw;
            routePolyline.setLatLngs(routeCoordinates.map(w => [w.lat, w.lng]));
            updateOverviewStats();
        }
    } finally {
        if (currentSeq === routeFetchSeq && spinner) {
            spinner.classList.remove('flex');
            spinner.classList.add('hidden');
        }
    }
}

function undoLastPoint() {
    if (!waypoints || waypoints.length === 0) {
        showToast("Không có điểm nào để hoàn tác!", "warn");
        return;
    }
    waypoints.pop();
    renderRoute();
    if (waypoints.length === 0) {
        if (routePolyline) routePolyline.setLatLngs([]);
        if (typeof kmSplits !== 'undefined') kmSplits = [];
        if (typeof renderKmSplitsUI === 'function') renderKmSplitsUI();
        if (typeof updateOverviewStats === 'function') updateOverviewStats();
    }
    showToast("Đã hoàn tác điểm gần nhất", "info");
}

function clearRoute() {
    if ((!waypoints || waypoints.length === 0) && (!routeCoordinates || routeCoordinates.length === 0)) {
        showToast("Lộ trình đang trống!", "info");
        return;
    }
    waypoints = [];
    routeCoordinates = [];
    if (typeof markers !== 'undefined' && Array.isArray(markers)) {
        markers.forEach(m => map.removeLayer(m));
        markers = [];
    }
    if (routePolyline) {
        routePolyline.setLatLngs([]);
    }
    if (telemetryChart) {
        telemetryChart.data.labels = [];
        telemetryChart.data.datasets.forEach(d => d.data = []);
        telemetryChart.update();
    }
    if (typeof kmSplits !== 'undefined') kmSplits = [];
    if (typeof renderKmSplitsUI === 'function') renderKmSplitsUI();
    if (typeof updateOverviewStats === 'function') updateOverviewStats();
    showToast("Đã xóa toàn bộ lộ trình", "info");
}

async function loadPreset(key) {
    if (!PRESETS[key]) return;
    waypoints = JSON.parse(JSON.stringify(PRESETS[key]));
    await renderRoute();
    if (map) {
        if (routePolyline && routePolyline.getLatLngs().length > 0) {
            const b = routePolyline.getBounds();
            if (b && b.isValid && b.isValid()) {
                map.fitBounds(b, { padding: [40, 40] });
            }
        } else if (waypoints.length > 0) {
            const b = L.latLngBounds(waypoints.map(p => [p.lat, p.lng]));
            if (b && b.isValid && b.isValid()) {
                map.fitBounds(b, { padding: [40, 40] });
            }
        }
    }
    showToast(`Đã tải lộ trình mẫu: ${key}`, "success");
}

async function searchLocation(query) {
    if (!query || !query.trim()) return;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'vi,en' } });
        const data = await res.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            map.setView([lat, lng], 15);
            showToast(`Đã tìm thấy: ${data[0].display_name.split(',')[0]}`, "success");
        } else {
            showToast("Không tìm thấy địa điểm này!", "warn");
        }
    } catch (e) {
        showToast("Lỗi kết nối khi tìm địa điểm!", "warn");
    }
}

// SINH LỘ TRÌNH ĐA HƯỚNG, ĐA HÌNH THÁI VÀ QUANH CO THEO ĐƯỜNG LÀNG / NGÕ XÓM (CHUẨN BATCH 8)
function generateDiverseRandomRouteInBounds(bounds, targetDistanceMeters, routeIndex = 1) {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const latSpan = Math.max(0.005, ne.lat - sw.lat);
    const lngSpan = Math.max(0.005, ne.lng - sw.lng);

    // 8 phân khu xuất phát để các file rải đều khắp các góc, không bị trùng điểm xuất phát
    const sectors = [
        { latF: 0.30, lngF: 0.30 }, // Tây Nam
        { latF: 0.70, lngF: 0.70 }, // Đông Bắc
        { latF: 0.30, lngF: 0.70 }, // Đông Nam
        { latF: 0.70, lngF: 0.30 }, // Tây Bắc
        { latF: 0.50, lngF: 0.75 }, // Phía Đông
        { latF: 0.50, lngF: 0.25 }, // Phía Tây
        { latF: 0.75, lngF: 0.50 }, // Phía Bắc
        { latF: 0.25, lngF: 0.50 }  // Phía Nam
    ];

    const sec = sectors[(routeIndex * 3 + Math.floor(Math.random() * 2)) % sectors.length];
    const startLat = Math.max(sw.lat + 0.05 * latSpan, Math.min(ne.lat - 0.05 * latSpan, sw.lat + (sec.latF + (Math.random() - 0.5) * 0.12) * latSpan));
    const startLng = Math.max(sw.lng + 0.05 * lngSpan, Math.min(ne.lng - 0.05 * lngSpan, sw.lng + (sec.lngF + (Math.random() - 0.5) * 0.12) * lngSpan));

    const archetype = routeIndex % 4;
    const pts = [];

    if (archetype === 0) {
        // Archetype 0: Vòng lặp đa giác theo phân khu (Polygon Sector Loop)
        const radiusM = Math.min((targetDistanceMeters / (2 * Math.PI)) * 0.82, 850);
        const rLat = radiusM / 111111;
        const rLng = radiusM / (111111 * Math.cos(startLat * Math.PI / 180));

        const numPts = 5 + Math.floor(Math.random() * 3);
        const direction = (routeIndex % 2 === 0) ? 1 : -1;
        const baseAngle = Math.random() * Math.PI * 2;
        const cLat = Math.max(sw.lat + rLat, Math.min(ne.lat - rLat, startLat + Math.sin(baseAngle) * rLat * 0.75));
        const cLng = Math.max(sw.lng + rLng, Math.min(ne.lng - rLng, startLng + Math.cos(baseAngle) * rLng * 0.75));

        for (let k = 0; k < numPts; k++) {
            const ang = baseAngle + direction * (k / numPts) * 2 * Math.PI;
            const rf = 0.75 + Math.random() * 0.45;
            const pLat = Math.max(sw.lat + 0.0005, Math.min(ne.lat - 0.0005, cLat + Math.sin(ang) * rLat * rf));
            const pLng = Math.max(sw.lng + 0.0005, Math.min(ne.lng - 0.0005, cLng + Math.cos(ang) * rLng * rf));
            pts.push({ lat: pLat, lng: pLng });
        }
        pts.push({ lat: pts[0].lat, lng: pts[0].lng });

    } else if (archetype === 1) {
        // Archetype 1: Lộ trình hình con thoi / hình lá (Out-and-Back Loop qua các phố khác nhau)
        const heading = Math.random() * Math.PI * 2;
        const outDistM = Math.min(targetDistanceMeters * 0.38, 1200);
        const dLat = (outDistM / 111111) * Math.sin(heading);
        const dLng = (outDistM / (111111 * Math.cos(startLat * Math.PI / 180))) * Math.cos(heading);

        const targetLat = Math.max(sw.lat + 0.001, Math.min(ne.lat - 0.001, startLat + dLat));
        const targetLng = Math.max(sw.lng + 0.001, Math.min(ne.lng - 0.001, startLng + dLng));

        const perpLat = -dLng * 0.3;
        const perpLng = dLat * 0.3;

        const outMid = {
            lat: Math.max(sw.lat + 0.0005, Math.min(ne.lat - 0.0005, (startLat + targetLat) / 2 + perpLat + (Math.random() - 0.5) * 0.001)),
            lng: Math.max(sw.lng + 0.0005, Math.min(ne.lng - 0.0005, (startLng + targetLng) / 2 + perpLng + (Math.random() - 0.5) * 0.001))
        };
        const retMid = {
            lat: Math.max(sw.lat + 0.0005, Math.min(ne.lat - 0.0005, (startLat + targetLat) / 2 - perpLat + (Math.random() - 0.5) * 0.001)),
            lng: Math.max(sw.lng + 0.0005, Math.min(ne.lng - 0.0005, (startLng + targetLng) / 2 - perpLng + (Math.random() - 0.5) * 0.001))
        };

        pts.push({ lat: startLat, lng: startLng });
        pts.push(outMid);
        pts.push({ lat: targetLat, lng: targetLng });
        pts.push(retMid);
        pts.push({ lat: startLat, lng: startLng });

    } else if (archetype === 2) {
        // Archetype 2: Lộ trình hình số 8 / Hai cánh lặp qua các phố khác nhau (Figure-8 / Double Loop)
        const hubLat = startLat;
        const hubLng = startLng;
        const rM = Math.min(targetDistanceMeters / 15, 600);
        const rLat = rM / 111111;
        const rLng = rM / (111111 * Math.cos(hubLat * Math.PI / 180));

        const ang1 = Math.random() * Math.PI * 2;
        const ang2 = ang1 + Math.PI * (0.8 + Math.random() * 0.4);

        pts.push({ lat: hubLat, lng: hubLng });
        pts.push({
            lat: Math.max(sw.lat + 0.0005, Math.min(ne.lat - 0.0005, hubLat + Math.sin(ang1 - 0.6) * rLat * 1.4)),
            lng: Math.max(sw.lng + 0.0005, Math.min(ne.lng - 0.0005, hubLng + Math.cos(ang1 - 0.6) * rLng * 1.4))
        });
        pts.push({
            lat: Math.max(sw.lat + 0.0005, Math.min(ne.lat - 0.0005, hubLat + Math.sin(ang1 + 0.6) * rLat * 1.4)),
            lng: Math.max(sw.lng + 0.0005, Math.min(ne.lng - 0.0005, hubLng + Math.cos(ang1 + 0.6) * rLng * 1.4))
        });
        pts.push({ lat: hubLat, lng: hubLng });
        pts.push({
            lat: Math.max(sw.lat + 0.0005, Math.min(ne.lat - 0.0005, hubLat + Math.sin(ang2 - 0.6) * rLat * 1.4)),
            lng: Math.max(sw.lng + 0.0005, Math.min(ne.lng - 0.0005, hubLng + Math.cos(ang2 - 0.6) * rLng * 1.4))
        });
        pts.push({
            lat: Math.max(sw.lat + 0.0005, Math.min(ne.lat - 0.0005, hubLat + Math.sin(ang2 + 0.6) * rLat * 1.4)),
            lng: Math.max(sw.lng + 0.0005, Math.min(ne.lng - 0.0005, hubLng + Math.cos(ang2 + 0.6) * rLng * 1.4))
        });
        pts.push({ lat: hubLat, lng: hubLng });

    } else {
        // Archetype 3: Lộ trình ziczac khám phá qua các giao lộ trong khu vực (Street Grid Meander)
        let curLat = startLat;
        let curLng = startLng;
        pts.push({ lat: curLat, lng: curLng });

        const numLegs = 6 + Math.floor(Math.random() * 3);
        const legLenM = (targetDistanceMeters * 0.72) / numLegs;
        let curHeading = Math.random() * Math.PI * 2;

        for (let l = 0; l < numLegs - 1; l++) {
            curHeading += (Math.random() > 0.5 ? 1 : -1) * (1.1 + Math.random() * 0.8);
            const dLat = (legLenM / 111111) * Math.sin(curHeading);
            const dLng = (legLenM / (111111 * Math.cos(curLat * Math.PI / 180))) * Math.cos(curHeading);
            curLat = Math.max(sw.lat + 0.0005, Math.min(ne.lat - 0.0005, curLat + dLat));
            curLng = Math.max(sw.lng + 0.0005, Math.min(ne.lng - 0.0005, curLng + dLng));
            pts.push({ lat: curLat, lng: curLng });
        }
        pts.push({ lat: startLat, lng: startLng });
    }

    return pts;
}

// Global window exports
window.undoLastPoint = undoLastPoint;
window.clearRoute = clearRoute;
window.toggleZoneSelectionMode = toggleZoneSelectionMode;
window.loadPreset = loadPreset;
window.renderRoute = renderRoute;
window.searchLocation = searchLocation;
window.generateDiverseRandomRouteInBounds = generateDiverseRandomRouteInBounds;
window.fetchRouteFromOSRM = fetchRouteFromOSRM;
window.locateUserLocation = locateUserLocation;
window.toggleMapFullscreen = toggleMapFullscreen;
