/**
 * telemetry.js - Động cơ toán học, đường cong hữu cơ & sinh dữ liệu Telemetry từng giây
 */

// 1. TOÁN HỌC & ĐỊA LÝ
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Bán kính Trái Đất (mét)
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) -
              Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return ((theta * 180) / Math.PI + 360) % 360;
}

function randomGaussian(mean = 0, stdev = 1) {
    let u = 1 - Math.random();
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
}

function computePolylineDistance(coords) {
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        total += haversineDistance(coords[i].lat, coords[i].lng, coords[i + 1].lat, coords[i + 1].lng);
    }
    return total;
}

function formatDuration(totalSeconds) {
    const sec = Math.round(totalSeconds);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPace(paceSec) {
    const sec = Math.round(paceSec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// 2. TẠO ĐƯỜNG CHẠY NGƯỜI THẬT & NHIỄU GPS PHẦN CỨNG (AUTHENTIC HUMAN RUNNING & GPS DRIFT ENGINE)
function generateOrganicCurvedPath(rawCoords, options = {}) {
    if (!rawCoords || rawCoords.length < 2) return rawCoords || [];

    const enableCurve = options.enableCurve ?? true;
    if (!enableCurve) return rawCoords;

    const stepSizeMeters = options.stepSizeMeters || 8.0; // Mật độ chia điểm tự nhiên (mỗi 8m)
    const curveAmp = options.curveAmp ?? (typeof document !== 'undefined' ? (parseFloat(document.getElementById('inputCurveAmp')?.value) || 6.2) : 6.2);

    const cumDists = [0];
    for (let i = 0; i < rawCoords.length - 1; i++) {
        const d = haversineDistance(rawCoords[i].lat, rawCoords[i].lng, rawCoords[i + 1].lat, rawCoords[i + 1].lng);
        cumDists.push(cumDists[i] + d);
    }
    const totalDist = cumDists[cumDists.length - 1];
    if (totalDist < 15) return rawCoords;

    // 1. Sinh các điểm neo chọn làn đường (Lane Anchors):
    // Người chạy thật chạy bám lề một đoạn dài (70m - 160m), sau đó mới chuyển làn hoặc dạt sang lề đối diện
    const anchors = [{ dist: 0, offset: 0 }];
    let curAnchorD = 0;
    while (curAnchorD < totalDist) {
        const span = 65 + Math.random() * 95;
        curAnchorD = Math.min(totalDist, curAnchorD + span);
        const laneChoice = (Math.random() - 0.5) * 2; // [-1.0, 1.0]
        const targetOffset = laneChoice * curveAmp * (0.65 + Math.random() * 0.35);
        anchors.push({ dist: curAnchorD, offset: targetOffset });
    }
    anchors[anchors.length - 1].offset = 0; // Taper về 0 ở đích

    function getLaneOffset(d) {
        if (d <= 0) return 0;
        if (d >= totalDist) return 0;
        let idx = 0;
        while (idx < anchors.length - 1 && d > anchors[idx + 1].dist) {
            idx++;
        }
        const a1 = anchors[idx];
        const a2 = anchors[idx + 1] || a1;
        const span = Math.max(0.1, a2.dist - a1.dist);
        const t = Math.max(0, Math.min(1, (d - a1.dist) / span));
        const h = t * t * (3 - 2 * t); // Smoothstep cubic
        return a1.offset + h * (a2.offset - a1.offset);
    }

    // 2. Tính trước góc di chuyển của từng đoạn
    const segmentBearings = [];
    for (let i = 0; i < rawCoords.length - 1; i++) {
        segmentBearings.push(calculateBearing(rawCoords[i].lat, rawCoords[i].lng, rawCoords[i + 1].lat, rawCoords[i + 1].lng));
    }

    const densePoints = [];
    let curSeg = 0;
    let gpsDriftLat = 0;
    let gpsDriftLng = 0;
    const totalSteps = Math.max(12, Math.ceil(totalDist / stepSizeMeters));

    for (let s = 0; s <= totalSteps; s++) {
        const curD = Math.min(totalDist, (s / totalSteps) * totalDist);

        while (curSeg < rawCoords.length - 2 && curD > cumDists[curSeg + 1]) {
            curSeg++;
        }

        const segStart = cumDists[curSeg];
        const segLen = (cumDists[curSeg + 1] - segStart) || 0.0001;
        const frac = Math.max(0, Math.min(1, (curD - segStart) / segLen));

        const p1 = rawCoords[curSeg];
        const p2 = rawCoords[curSeg + 1] || p1;

        let lat = p1.lat + frac * (p2.lat - p1.lat);
        let lng = p1.lng + frac * (p2.lng - p1.lng);

        if (s > 0 && s < totalSteps) {
            // Tapering êm ái ở 25m đầu và 25m cuối để khớp chính xác ghim A và B
            const taper = Math.min(1.0, Math.min(curD / 25.0, (totalDist - curD) / 25.0));

            // Tầng 1: Chọn làn & bám lề đường người thật (Lane Persistence)
            const laneOffset = getLaneOffset(curD);

            // Tầng 2: Sóng né chướng ngại vật / vũng nước / rẽ nhẹ (24m - 50m)
            const obstacleWave = Math.sin((curD / 24.0) * Math.PI + 0.5) * (curveAmp * 0.32) + 
                                 Math.sin((curD / 52.0) * Math.PI + 1.1) * (curveAmp * 0.22);

            // Tầng 3: Cắt cua (Apex Cutting) khi gặp khúc rẽ hoặc ngã ba
            let apexOffset = 0;
            if (curSeg < segmentBearings.length - 1) {
                const b1 = segmentBearings[curSeg];
                const b2 = segmentBearings[curSeg + 1];
                let diff = b2 - b1;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                const distToTurn = Math.abs(cumDists[curSeg + 1] - curD);
                if (distToTurn < 32) {
                    const turnProximity = 1.0 - (distToTurn / 32.0);
                    // Rẽ trái (diff < 0) ôm mép trái (-), rẽ phải ôm mép phải (+)
                    apexOffset = Math.max(-5.0, Math.min(5.0, (diff / 90.0) * 4.0 * turnProximity));
                }
            }

            const totalLateralMeters = (laneOffset + obstacleWave + apexOffset) * taper;

            const bearing = segmentBearings[curSeg] || calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
            const orthoAngle = ((bearing + 90) * Math.PI) / 180;

            // Tầng 4: Rung lắc vi mô GPS 2D thực tế (Markov Random Walk)
            gpsDriftLat = 0.65 * gpsDriftLat + randomGaussian(0, 0.7);
            gpsDriftLng = 0.65 * gpsDriftLng + randomGaussian(0, 0.7);

            const dLatMeters = (Math.cos(orthoAngle) * totalLateralMeters) + (gpsDriftLat * taper);
            const dLngMeters = (Math.sin(orthoAngle) * totalLateralMeters) + (gpsDriftLng * taper);

            lat += dLatMeters / 111111;
            lng += dLngMeters / (111111 * Math.cos((lat * Math.PI) / 180));
        }

        densePoints.push({ lat, lng });
    }

    return densePoints;
}

// 3. MÔ HÌNH SINH LÝ HỌC NHỊP TIM & GUỒNG CHÂN CHUẨN XÁC THEO TỪNG MỨC PACE (BIOMETRIC PHYSIOLOGICAL MODEL)
function getPhysiologicalMetrics(paceSec) {
    const p = Math.max(180, Math.min(780, paceSec)); // 3:00 - 13:00 min/km
    const speedKmh = 3600 / p;

    let baseHr, warmHr, baseCad;

    if (speedKmh <= 6.0) {
        // Đi bộ dưỡng sinh / Chậm (Pace > 10:00, 4.5 - 6.0 km/h)
        // HR: 105 - 120 bpm | Warmup: 95 - 105 bpm | Cadence: 112 - 128 SPM
        const ratio = Math.max(0, Math.min(1, (speedKmh - 4.5) / 1.5));
        baseHr = 105 + ratio * 15;
        warmHr = 95 + ratio * 10;
        baseCad = 112 + ratio * 16;
    } else if (speedKmh <= 8.5) {
        // Đi bộ nhanh / Jogging nhẹ (Pace 7:00 - 10:00, 6.0 - 8.5 km/h)
        // HR: 120 - 142 bpm | Warmup: 105 - 122 bpm | Cadence: 128 - 154 SPM
        const ratio = (speedKmh - 6.0) / 2.5;
        baseHr = 120 + ratio * 22;
        warmHr = 105 + ratio * 17;
        baseCad = 128 + ratio * 26;
    } else if (speedKmh <= 12.0) {
        // Chạy bền Easy & Aerobic (Pace 5:00 - 7:00, 8.5 - 12.0 km/h)
        // HR: 142 - 165 bpm | Warmup: 122 - 138 bpm | Cadence: 154 - 173 SPM
        const ratio = (speedKmh - 8.5) / 3.5;
        baseHr = 142 + ratio * 23;
        warmHr = 122 + ratio * 16;
        baseCad = 154 + ratio * 19;
    } else {
        // Chạy nhanh Threshold & Nước rút (Pace 3:00 - 5:00, 12.0 - 16.0 km/h)
        // HR: 165 - 186 bpm | Warmup: 138 - 148 bpm | Cadence: 173 - 188 SPM
        const ratio = Math.min(1.0, (speedKmh - 12.0) / 4.0);
        baseHr = 165 + ratio * 21;
        warmHr = 138 + ratio * 10;
        baseCad = 173 + ratio * 15;
    }

    return {
        baseHr: Math.round(baseHr),
        warmHr: Math.round(warmHr),
        baseCad: Math.round(baseCad)
    };
}

// Tính toán Km Splits thực tế
function calculateRealisticKmSplits(totalMeters, basePaceSec, strategy = 'random', varianceSec = 45) {
    const numKm = Math.ceil(totalMeters / 1000);
    const splits = [];
    if (numKm === 0) return splits;

    let distLeft = totalMeters;
    const rawPaces = [];
    let prevPace = null;

    for (let i = 0; i < numKm; i++) {
        let p = basePaceSec;
        const progress = i / Math.max(1, numKm - 1);

        if (strategy === 'positive') {
            const delta = (progress - 0.5) * varianceSec * 1.6;
            p = Math.round(basePaceSec + delta);
        } else if (strategy === 'negative') {
            const delta = (0.5 - progress) * varianceSec * 1.6;
            p = Math.round(basePaceSec + delta);
        } else if (strategy === 'even') {
            const tinyNoise = Math.round((Math.random() - 0.5) * 8);
            p = Math.round(basePaceSec + tinyNoise);
        } else {
            // Mặc định: Random tự nhiên
            const maxSwing = Math.max(15, Math.min(140, varianceSec));
            let rShift = (Math.random() - 0.5) * 2 * maxSwing;
            if (i > 0 && i === numKm - 1 && Math.random() > 0.45) {
                rShift = -Math.abs(rShift) - 15; // Nước rút km cuối
            }
            p = Math.round(basePaceSec + rShift);

            if (prevPace !== null && Math.abs(p - prevPace) < 12) {
                p = (p >= prevPace) ? (p + 15) : (p - 15);
            }
        }

        p = Math.max(210, Math.min(720, p));
        prevPace = p;
        rawPaces.push(p);
    }

    for (let i = 0; i < numKm; i++) {
        const segDist = Math.min(1000, distLeft);
        distLeft -= segDist;
        const kmIdx = i + 1;
        const pace = rawPaces[i];
        const dur = Math.max(1, Math.round(segDist * (pace / 1000)));

        // Tính toán nhịp tim & guồng chân sinh lý chuẩn theo tốc độ km này
        const phys = getPhysiologicalMetrics(pace);
        const speedRatio = basePaceSec / pace;
        const hrEst = Math.round(Math.max(98, Math.min(192, phys.baseHr + (speedRatio - 1) * 14)));
        const cadEst = Math.round(Math.max(105, Math.min(200, phys.baseCad + (speedRatio - 1) * 8)));

        splits.push({
            index: kmIdx,
            label: `Km ${kmIdx}`,
            fromMeter: i * 1000,
            toMeter: (i * 1000) + segDist,
            distanceMeters: segDist,
            paceSeconds: pace,
            durationSeconds: dur,
            hrEstimated: hrEst,
            cadEstimated: cadEst
        });
    }

    return splits;
}

// 4. MÔ PHỎNG TELEMETRY ĐƠN LẺ VỚI TỐC ĐỘ PHÂN BỔ CHUẨN XÁC THEO TỪNG KM
function generateSingleTelemetry(coords, totalMeters, splits, options = {}) {
    if (!coords || coords.length < 2) {
        throw new Error("Vui lòng vẽ ít nhất 2 điểm mốc trên bản đồ!");
    }
    if (totalMeters <= 5) {
        throw new Error("Lộ trình quá ngắn!");
    }

    const startTime = options.startDate || new Date();
    const startEpoch = startTime.getTime();
    
    // Đồng bộ chuẩn sinh học theo Pace trung bình nếu người dùng không khóa thủ công
    const basePace = (splits && splits.length > 0) ? splits[0].paceSeconds : 330;
    const defaultPhys = getPhysiologicalMetrics(basePace);

    const cadBase = options.cadBase || defaultPhys.baseCad;
    const cadNoise = options.cadNoise || 3;
    const hrStart = options.hrStart || defaultPhys.warmHr;
    const hrTarget = options.hrTarget || defaultPhys.baseHr;
    const cornerSlowdown = options.cornerSlowdown ?? true;
    const sprintFinish = options.sprintFinish ?? true;

    // Tính lũy kế đường chạy
    const segLens = [];
    const cumLens = [0];
    for (let i = 0; i < coords.length - 1; i++) {
        const d = haversineDistance(coords[i].lat, coords[i].lng, coords[i + 1].lat, coords[i + 1].lng);
        segLens.push(d);
        cumLens.push(cumLens[i] + d);
    }
    const roadLength = cumLens[cumLens.length - 1] || 1;

    // Nhận diện góc cua để giảm tốc
    const turns = [];
    for (let i = 1; i < coords.length - 1; i++) {
        const b1 = calculateBearing(coords[i - 1].lat, coords[i - 1].lng, coords[i].lat, coords[i].lng);
        const b2 = calculateBearing(coords[i].lat, coords[i].lng, coords[i + 1].lat, coords[i + 1].lng);
        let diff = Math.abs(b2 - b1);
        if (diff > 180) diff = 360 - diff;
        if (diff > 25) {
            turns.push({ dist: cumLens[i], slowdown: Math.min(0.28, (diff / 180) * 0.35), radius: 15 });
        }
    }

    const trackpoints = [];
    let globalSec = 0;
    let distTravelled = 0;
    let segIdx = 0;
    let curHr = hrStart;
    let curCad = cadBase;

    for (let k = 0; k < splits.length; k++) {
        const sp = splits[k];
        const segDistTotal = sp.distanceMeters;
        const segDurationSec = sp.durationSeconds;
        const kmBaseSpeed = segDistTotal / segDurationSec;

        let kmDistAccum = 0;
        for (let s = 0; s < segDurationSec; s++) {
            const wave = Math.sin((globalSec / 38.0) * Math.PI) * 0.05 + Math.sin((globalSec / 85.0) * Math.PI) * 0.03;
            let cornerFactor = 1.0;
            if (cornerSlowdown) {
                for (let t of turns) {
                    const diffD = Math.abs(distTravelled - t.dist);
                    if (diffD < t.radius) {
                        cornerFactor = Math.min(cornerFactor, 1.0 - t.slowdown);
                    }
                }
            }

            let phaseFactor = 1.0;
            if (globalSec < 20) {
                phaseFactor = 0.92 + 0.08 * (globalSec / 20);
            } else if (sprintFinish && (totalMeters - distTravelled) < 100) {
                phaseFactor = 1.0 + 0.12 * Math.pow((100 - (totalMeters - distTravelled)) / 100, 2);
            }

            const stepSpeed = Math.max(0.7, Math.min(6.5, kmBaseSpeed * (1.0 + wave) * cornerFactor * phaseFactor));
            const stepDist = (s === segDurationSec - 1) ? (segDistTotal - kmDistAccum) : (segDistTotal / segDurationSec);
            kmDistAccum += stepDist;
            distTravelled += stepDist;

            // Vị trí trên road khớp chuẩn mét thực tế (không co dãn méo mó)
            const roadPos = Math.min(roadLength, distTravelled);
            while (segIdx < segLens.length - 1 && roadPos > cumLens[segIdx + 1]) {
                segIdx++;
            }
            const sStart = cumLens[segIdx];
            const sLen = segLens[segIdx] || 0.0001;
            const frac = Math.max(0, Math.min(1, (roadPos - sStart) / sLen));

            const p1 = coords[segIdx];
            const p2 = coords[segIdx + 1] || p1;
            const lat = p1.lat + frac * (p2.lat - p1.lat);
            const lng = p1.lng + frac * (p2.lng - p1.lng);

            // Trôi tim sinh lý thực tế: Tối đa 5-7 bpm suốt cả bài chạy
            const cardiacDrift = Math.min(6.0, (globalSec / 2400) * 5.0);
            const sprintHr = (sprintFinish && (totalMeters - distTravelled) < 100) ? 
                Math.min(6.0, ((100 - (totalMeters - distTravelled)) / 100) * 6.0) : 0;
            const targetHr = sp.hrEstimated + cardiacDrift + sprintHr + randomGaussian(0, 0.5);

            curHr += (targetHr - curHr) * 0.08;
            curCad += ((sp.cadEstimated + randomGaussian(0, cadNoise * 0.35)) - curCad) * 0.12;

            const ptTime = new Date(startEpoch + globalSec * 1000).toISOString();
            const instPace = stepSpeed > 0 ? (1000 / stepSpeed) / 60 : sp.paceSeconds / 60;

            trackpoints.push({
                second: globalSec,
                time: ptTime,
                lat: lat.toFixed(7),
                lng: lng.toFixed(7),
                altitude: (12.0 + Math.sin(globalSec / 50) * 2).toFixed(1),
                distanceMeters: distTravelled.toFixed(2),
                heartRate: Math.round(curHr),
                cadence: Math.round(curCad),
                speedMps: stepSpeed,
                paceMinKm: instPace,
                splitIndex: k + 1
            });

            globalSec++;
        }
    }

    return trackpoints;
}

// 5. MÔ PHỎNG TELEMETRY HÀNG LOẠT VỚI TỐC ĐỘ BIẾN THIÊN TỰ NHIÊN GIỮA CÁC KM (CHUẨN THEO BẢN GỐC BATCH 8)
function generateSyntheticBatchTelemetry(roadCoords, targetDistMeters, avgPaceSec, startDate) {
    // 1. Tạo lộ trình hữu cơ có độ cong & uốn lượn ngẫu nhiên người thật (chuẩn Batch 8 ngày trước)
    const amp = typeof document !== 'undefined' ? (parseFloat(document.getElementById('inputCurveAmp')?.value) || 6.2) : 6.2;
    const organicRoad = generateOrganicCurvedPath(roadCoords, { enableCurve: true, curveAmp: amp });

    // 2. Tự động sinh Km Splits với độ chênh lệch tốc độ thực tế (±35s ~ ±55s)
    const splits = calculateRealisticKmSplits(targetDistMeters, avgPaceSec, 'random', 45);

    // 3. Tính độ dài road thực tế từ organicRoad
    const segLens = [];
    const cumLens = [0];
    for (let i = 0; i < organicRoad.length - 1; i++) {
        const d = haversineDistance(organicRoad[i].lat, organicRoad[i].lng, organicRoad[i + 1].lat, organicRoad[i + 1].lng);
        segLens.push(d);
        cumLens.push(cumLens[i] + d);
    }
    const actualRoadLen = cumLens[cumLens.length - 1] || 1;

    // 4. Lấy chỉ số sinh học chuẩn theo Pace bài này
    const phys = getPhysiologicalMetrics(avgPaceSec);
    const startEpoch = startDate.getTime();
    const trackpoints = [];
    let globalSec = 0;
    let distTravelled = 0;
    let segIdx = 0;
    let curHr = phys.warmHr;
    let curCad = phys.baseCad;

    for (let k = 0; k < splits.length; k++) {
        const sp = splits[k];
        const segDistTotal = sp.distanceMeters;
        const segDurationSec = sp.durationSeconds;
        const kmSpeed = segDistTotal / segDurationSec;

        let kmDistAccum = 0;
        for (let s = 0; s < segDurationSec; s++) {
            // Sóng thở vi mô
            const wave = Math.sin((globalSec / 42.0) * Math.PI) * 0.04 + Math.sin((globalSec / 90.0) * Math.PI) * 0.02;
            const stepSpeed = kmSpeed * (1.0 + wave);
            const stepDist = (s === segDurationSec - 1) ? (segDistTotal - kmDistAccum) : (segDistTotal / segDurationSec);
            kmDistAccum += stepDist;
            distTravelled += stepDist;

            // Đi dọc đường hữu cơ khớp chuẩn mét thực tế
            const roadPos = Math.min(actualRoadLen, distTravelled);
            while (segIdx < segLens.length - 1 && roadPos > cumLens[segIdx + 1]) {
                segIdx++;
            }
            const sStart = cumLens[segIdx];
            const sLen = segLens[segIdx] || 0.0001;
            const frac = Math.max(0, Math.min(1, (roadPos - sStart) / sLen));

            const p1 = organicRoad[segIdx];
            const p2 = organicRoad[segIdx + 1] || p1;
            let lat = p1.lat + frac * (p2.lat - p1.lat);
            let lng = p1.lng + frac * (p2.lng - p1.lng);

            // Rung lắc vi mô GPS 1 giây chuẩn thiết bị Garmin
            lat += (randomGaussian(0, 0.35)) / 111111;
            lng += (randomGaussian(0, 0.35)) / (111111 * Math.cos((lat * Math.PI) / 180));

            // Trôi tim sinh lý thực tế
            const drift = Math.min(6.5, (globalSec / 2400) * 5.0);
            curHr += ((sp.hrEstimated + drift + randomGaussian(0, 0.6)) - curHr) * 0.08;
            curCad += ((sp.cadEstimated + Math.sin(globalSec / 35) * 1.5 + randomGaussian(0, 0.8)) - curCad) * 0.12;

            const ptTime = new Date(startEpoch + globalSec * 1000).toISOString();
            const instPace = stepSpeed > 0 ? (1000 / stepSpeed) / 60 : sp.paceSeconds / 60;

            trackpoints.push({
                second: globalSec,
                time: ptTime,
                lat: lat.toFixed(7),
                lng: lng.toFixed(7),
                altitude: (14.0 + Math.sin(globalSec / 60) * 2).toFixed(1),
                distanceMeters: distTravelled.toFixed(2),
                heartRate: Math.round(curHr),
                cadence: Math.round(curCad),
                speedMps: stepSpeed,
                paceMinKm: instPace,
                splitIndex: k + 1
            });

            globalSec++;
        }
    }

    return trackpoints;
}

// Global window exports
if (typeof window !== 'undefined') {
    window.getPhysiologicalMetrics = getPhysiologicalMetrics;
    window.generateOrganicCurvedPath = generateOrganicCurvedPath;
    window.calculateRealisticKmSplits = calculateRealisticKmSplits;
    window.generateSingleTelemetry = generateSingleTelemetry;
    window.generateSyntheticBatchTelemetry = generateSyntheticBatchTelemetry;
}
