/**
 * app.js - Điều khiển giao diện, Biểu đồ Chart.js, Tạo hàng loạt & Khởi tạo ứng dụng
 */

let telemetryChart = null;
let generatedTrackpoints = [];
let kmSplits = [];
let splitStrategy = 'random'; // 'random', 'fartlek', 'fatigue', 'progressive', 'even', 'custom'
let kmVarianceSeconds = 45;   // Biên độ dao động giữa các km (mặc định ±45s: ví dụ 5:30 -> 4:45 ~ 6:15)

function calculateTotalDistance(coords) {
    return computePolylineDistance(coords);
}

function getSelectedPaceSeconds() {
    return parseInt(document.getElementById('inputPaceSlider')?.value || 330, 10);
}

function updatePaceVarianceDisplay() {
    const varianceInput = document.getElementById('inputPaceVariance');
    if (!varianceInput) return;
    const variance = parseInt(varianceInput.value, 10);
    const paceSec = getSelectedPaceSeconds();
    const minPaceSec = Math.round(paceSec / (1 + variance / 100));
    const maxPaceSec = Math.round(paceSec / (1 - variance / 100));
    const disp = document.getElementById('varianceDisplay');
    if (disp) {
        disp.innerText = `± ${variance}% (${formatPace(minPaceSec)} ~ ${formatPace(maxPaceSec)})`;
    }
}

function generateKmSplits(forceReset = false) {
    const ptsToMeasure = (routeCoordinates && routeCoordinates.length >= 2) ? routeCoordinates : waypoints;
    const totalMeters = calculateTotalDistance(ptsToMeasure);
    if (totalMeters <= 5) {
        kmSplits = [];
        renderKmSplitsUI();
        return;
    }

    const numKm = Math.ceil(totalMeters / 1000);
    const basePaceSec = getSelectedPaceSeconds();

    if (splitStrategy === 'custom' && !forceReset && kmSplits.length === numKm) {
        let distLeft = totalMeters;
        for (let i = 0; i < numKm; i++) {
            const segDist = Math.min(1000, distLeft);
            kmSplits[i].distanceMeters = segDist;
            kmSplits[i].fromMeter = i * 1000;
            kmSplits[i].toMeter = (i * 1000) + segDist;
            kmSplits[i].durationSeconds = Math.round(segDist * (kmSplits[i].paceSeconds / 1000));
            distLeft -= segDist;
        }
        renderKmSplitsUI();
        return;
    }

    kmSplits = calculateRealisticKmSplits(totalMeters, basePaceSec, splitStrategy, kmVarianceSeconds);
    renderKmSplitsUI();
}

function renderKmSplitsUI() {
    const container = document.getElementById('kmSplitsContainer');
    const badge = document.getElementById('splitCountBadge');
    const tableBody = document.getElementById('splitsTableBody');
    const varianceDisplay = document.getElementById('kmVarianceDisplay');

    if (varianceDisplay) {
        const m = Math.floor(kmVarianceSeconds / 60);
        const s = kmVarianceSeconds % 60;
        const timeStr = m > 0 ? `${m}p${s > 0 ? s + 's' : ''}` : `${s}s`;
        varianceDisplay.innerText = `± ${kmVarianceSeconds}s (~${timeStr} /km)`;
    }

    if (badge) {
        badge.innerText = `${kmSplits.length} Km`;
    }

    if (!container) return;

    if (kmSplits.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-xs text-slate-500 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Chưa có điểm mốc trên bản đồ để chia Km.
            </div>`;
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-xs text-slate-500 italic">Vẽ lộ trình để xem bảng Splits từng Km</td></tr>`;
        }
        return;
    }

    let cardsHtml = '';
    kmSplits.forEach((sp, idx) => {
        const paceStr = formatPace(sp.paceSeconds);
        const durStr = formatDuration(sp.durationSeconds);
        const distKm = (sp.distanceMeters / 1000).toFixed(2);

        cardsHtml += `
        <div class="bg-slate-50 hover:bg-white border border-slate-200 hover:border-orange-300 rounded-xl p-2.5 transition flex flex-col gap-1.5 shadow-2xs">
            <div class="flex items-center justify-between text-xs font-bold text-slate-700">
                <span class="flex items-center gap-1.5 text-orange-600 font-extrabold">
                    <span class="w-2 h-2 rounded-full bg-orange-500"></span>
                    ${sp.label}
                </span>
                <span class="text-slate-400 font-normal text-[11px]">${distKm} km</span>
            </div>

            <!-- Pace Controller -->
            <div class="flex items-center justify-between gap-1 mt-0.5">
                <span class="text-[11px] text-slate-500">Pace:</span>
                <div class="flex items-center gap-1">
                    <button type="button" onclick="adjustKmPace(${idx}, -5)" class="w-5 h-5 rounded bg-white hover:bg-orange-50 text-slate-600 hover:text-orange-600 border border-slate-200 flex items-center justify-center text-xs font-bold transition">−</button>
                    <span class="font-mono font-bold text-xs text-slate-800 px-1 min-w-[42px] text-center">${paceStr}</span>
                    <button type="button" onclick="adjustKmPace(${idx}, 5)" class="w-5 h-5 rounded bg-white hover:bg-orange-50 text-slate-600 hover:text-orange-600 border border-slate-200 flex items-center justify-center text-xs font-bold transition">+</button>
                </div>
            </div>

            <!-- Cadence Controller -->
            <div class="flex items-center justify-between gap-1">
                <span class="text-[11px] text-slate-500">Guồng chân:</span>
                <div class="flex items-center gap-1">
                    <button type="button" onclick="adjustKmCadence(${idx}, -2)" class="w-5 h-5 rounded bg-white hover:bg-cyan-50 text-slate-600 hover:text-cyan-600 border border-slate-200 flex items-center justify-center text-xs font-bold transition">−</button>
                    <span class="font-mono font-bold text-xs text-cyan-700 px-1 min-w-[42px] text-center">${sp.cadEstimated}</span>
                    <button type="button" onclick="adjustKmCadence(${idx}, 2)" class="w-5 h-5 rounded bg-white hover:bg-cyan-50 text-slate-600 hover:text-cyan-600 border border-slate-200 flex items-center justify-center text-xs font-bold transition">+</button>
                </div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 font-mono">
                <span>⏱️ ${durStr}</span>
                <span class="text-rose-500 font-semibold">❤️ ${sp.hrEstimated} bpm</span>
            </div>
        </div>`;
    });
    container.innerHTML = cardsHtml;

    if (tableBody) {
        let tblHtml = '';
        kmSplits.forEach(sp => {
            const paceStr = formatPace(sp.paceSeconds);
            const durStr = formatDuration(sp.durationSeconds);
            tblHtml += `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="py-2.5 px-3 font-semibold text-slate-800">${sp.label}</td>
                <td class="py-2.5 px-3 text-slate-600 font-mono">${(sp.distanceMeters / 1000).toFixed(2)} km</td>
                <td class="py-2.5 px-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 font-mono">
                        ${paceStr} /km
                    </span>
                </td>
                <td class="py-2.5 px-3 text-slate-700 font-mono">${durStr}</td>
                <td class="py-2.5 px-3 text-rose-600 font-mono font-semibold">${sp.hrEstimated}</td>
                <td class="py-2.5 px-3 text-cyan-700 font-mono font-bold">${sp.cadEstimated} SPM</td>
            </tr>`;
        });
        tableBody.innerHTML = tblHtml;
    }

    if (window.lucide) lucide.createIcons();
}

function setSplitStrategy(strat) {
    splitStrategy = strat;
    document.querySelectorAll('.strat-btn').forEach(btn => {
        btn.classList.remove('bg-orange-50', 'border-orange-300', 'text-orange-700', 'font-semibold');
        btn.classList.add('bg-slate-100', 'border-slate-200', 'text-slate-700', 'font-medium');
    });
    const activeBtn = document.getElementById(`btnStrat${strat.charAt(0).toUpperCase() + strat.slice(1)}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-slate-100', 'border-slate-200', 'text-slate-700', 'font-medium');
        activeBtn.classList.add('bg-orange-50', 'border-orange-300', 'text-orange-700', 'font-semibold');
    }

    generateKmSplits(true);
    updateOverviewStats();
}

function randomizeSplits() {
    setSplitStrategy('random');
    showToast("Đã tạo tổ hợp Pace mới ngẫu nhiên cho các Km!", "success");
}

function onKmCadenceChange(idx, val) {
    if (!kmSplits[idx]) return;
    const cad = parseInt(val, 10);
    kmSplits[idx].cadEstimated = Math.max(90, Math.min(220, cad));
    splitStrategy = 'custom';
    renderKmSplitsUI();
}

function adjustKmCadence(idx, deltaCad) {
    if (!kmSplits[idx]) return;
    const current = kmSplits[idx].cadEstimated || 172;
    onKmCadenceChange(idx, current + deltaCad);
}

function onKmPaceChange(idx, val) {
    if (!kmSplits[idx]) return;
    const paceSec = parseInt(val, 10);
    kmSplits[idx].paceSeconds = paceSec;
    kmSplits[idx].durationSeconds = Math.round(kmSplits[idx].distanceMeters * (paceSec / 1000));
    
    // Tự động đồng bộ chuẩn sinh học nhịp tim và guồng chân cho Km này
    if (typeof getPhysiologicalMetrics === 'function') {
        const phys = getPhysiologicalMetrics(paceSec);
        kmSplits[idx].hrEstimated = phys.baseHr;
        kmSplits[idx].cadEstimated = phys.baseCad;
    }

    splitStrategy = 'custom';
    renderKmSplitsUI();
    updateOverviewStats();
}

function adjustKmPace(idx, deltaSec) {
    if (!kmSplits[idx]) return;
    const current = kmSplits[idx].paceSeconds;
    onKmPaceChange(idx, Math.max(180, Math.min(780, current + deltaSec)));
}

function onCadenceModeChange() {
    const mode = document.querySelector('input[name="cadenceExportMode"]:checked')?.value || 'auto';
    const lblAuto = document.getElementById('lblCadenceModeAuto');
    const lblRaw = document.getElementById('lblCadenceModeRaw');
    if (mode === 'auto') {
        lblAuto.className = "cursor-pointer px-2 py-0.5 rounded font-medium transition text-xs bg-cyan-600 text-white shadow-2xs";
        lblRaw.className = "cursor-pointer px-2 py-0.5 rounded font-medium transition text-xs text-slate-600 hover:text-slate-900";
    } else {
        lblRaw.className = "cursor-pointer px-2 py-0.5 rounded font-medium transition text-xs bg-cyan-600 text-white shadow-2xs";
        lblAuto.className = "cursor-pointer px-2 py-0.5 rounded font-medium transition text-xs text-slate-600 hover:text-slate-900";
    }
}

function updateOverviewStats() {
    const ptsToMeasure = (routeCoordinates && routeCoordinates.length >= 2) ? routeCoordinates : waypoints;
    const totalMeters = calculateTotalDistance(ptsToMeasure);
    const totalKm = totalMeters / 1000;

    const mobDist = document.getElementById('mobStatDistance');
    const mobDur = document.getElementById('mobStatDuration');
    const mobPace = document.getElementById('mobStatPace');

    if (totalMeters <= 5) {
        kmSplits = [];
        renderKmSplitsUI();
        const distEl = document.getElementById('statDistance');
        if (distEl) distEl.innerHTML = `0.00 <span class="text-xs font-normal text-slate-400">km</span>`;
        const durEl = document.getElementById('statDuration');
        if (durEl) durEl.innerText = "00:00:00";
        const paceEl = document.getElementById('statPace');
        if (paceEl) paceEl.innerHTML = `${formatPace(getSelectedPaceSeconds())} <span class="text-xs font-normal text-slate-400">/km</span>`;
        const ptEl = document.getElementById('statPoints');
        if (ptEl) ptEl.innerText = waypoints ? waypoints.length : 0;
        const spdEl = document.getElementById('statSpeed');
        if (spdEl) spdEl.innerText = "0.0 km/h";
        const calEl = document.getElementById('statCalories');
        if (calEl) calEl.innerText = "0 kcal";
        const paceDisp = document.getElementById('paceDisplay');
        if (paceDisp) paceDisp.innerText = `${formatPace(getSelectedPaceSeconds())} min/km`;

        if (mobDist) mobDist.innerText = "0.00 km";
        if (mobDur) mobDur.innerText = "00:00:00";
        if (mobPace) mobPace.innerText = `${formatPace(getSelectedPaceSeconds())} /km`;

        updatePaceVarianceDisplay();
        return;
    }

    const numKm = Math.ceil(totalMeters / 1000);
    if (kmSplits.length !== numKm && totalMeters > 5) {
        generateKmSplits(false);
    }

    let totalSeconds = 0;
    if (kmSplits.length > 0) {
        kmSplits.forEach(sp => {
            totalSeconds += sp.durationSeconds;
        });
    } else {
        totalSeconds = totalKm * getSelectedPaceSeconds();
    }

    const avgPaceSec = totalKm > 0 ? Math.round(totalSeconds / totalKm) : getSelectedPaceSeconds();
    const speedKmh = avgPaceSec > 0 ? (3600 / avgPaceSec) : 0;
    const calories = Math.round(totalKm * 62);

    const distEl = document.getElementById('statDistance');
    if (distEl) distEl.innerHTML = `${totalKm.toFixed(2)} <span class="text-xs font-normal text-slate-400">km</span>`;
    const durEl = document.getElementById('statDuration');
    if (durEl) durEl.innerText = formatDuration(totalSeconds);
    const paceEl = document.getElementById('statPace');
    if (paceEl) paceEl.innerHTML = `${formatPace(avgPaceSec)} <span class="text-xs font-normal text-slate-400">/km</span>`;
    const ptEl = document.getElementById('statPoints');
    if (ptEl) ptEl.innerText = waypoints ? waypoints.length : 0;
    const spdEl = document.getElementById('statSpeed');
    if (spdEl) spdEl.innerText = `${speedKmh.toFixed(1)} km/h`;
    const calEl = document.getElementById('statCalories');
    if (calEl) calEl.innerText = `${calories} kcal`;
    const paceDisp = document.getElementById('paceDisplay');
    if (paceDisp) paceDisp.innerText = `${formatPace(getSelectedPaceSeconds())} min/km`;

    if (mobDist) mobDist.innerText = `${totalKm.toFixed(2)} km`;
    if (mobDur) mobDur.innerText = formatDuration(totalSeconds);
    if (mobPace) mobPace.innerText = `${formatPace(avgPaceSec)} /km`;

    updatePaceVarianceDisplay();
}

let currentMobileTab = 'map';

function switchMobileTab(tab) {
    currentMobileTab = tab;
    const tabBtnMap = document.getElementById('tabBtnMap');
    const tabBtnSettings = document.getElementById('tabBtnSettings');
    const tabBtnAnalysis = document.getElementById('tabBtnAnalysis');

    const panelMap = document.getElementById('mobilePanelMap');
    const panelSettings = document.getElementById('mobilePanelSettings');
    const panelAnalysis = document.getElementById('mobilePanelAnalysis');

    const activeClass = "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition bg-orange-500 text-white shadow-xs";
    const inactiveClass = "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition text-slate-600 hover:bg-slate-100";

    if (tabBtnMap) tabBtnMap.className = tab === 'map' ? activeClass : inactiveClass;
    if (tabBtnSettings) tabBtnSettings.className = tab === 'settings' ? activeClass : inactiveClass;
    if (tabBtnAnalysis) tabBtnAnalysis.className = tab === 'analysis' ? activeClass : inactiveClass;

    if (panelMap) {
        if (tab === 'map') {
            panelMap.classList.remove('hidden');
        } else {
            panelMap.classList.add('hidden');
        }
    }

    if (panelSettings) {
        if (tab === 'settings') {
            panelSettings.classList.remove('hidden');
        } else {
            panelSettings.classList.add('hidden');
        }
    }

    if (panelAnalysis) {
        if (tab === 'analysis') {
            panelAnalysis.classList.remove('hidden');
            if (routeCoordinates && routeCoordinates.length >= 2) {
                try {
                    generatedTrackpoints = generateTelemetryData();
                    updateChartWithTelemetry(generatedTrackpoints);
                } catch(e) {}
            }
        } else {
            panelAnalysis.classList.add('hidden');
        }
    }

    if (window.lucide) lucide.createIcons();

    if (tab === 'map' && map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 150);
    }
}

function openBatchModalFromMobile() {
    const btn = document.getElementById('btnOpenBatchModal');
    if (btn) btn.click();
}

function generateTelemetryData() {
    const ptsToRun = (routeCoordinates && routeCoordinates.length >= 2) ? routeCoordinates : waypoints;
    const totalMeters = calculateTotalDistance(ptsToRun);
    if (totalMeters <= 5) {
        throw new Error("Vui lòng vẽ ít nhất 2 điểm mốc trên bản đồ!");
    }

    if (!kmSplits || kmSplits.length === 0) {
        generateKmSplits(true);
    }

    const startTimeStr = document.getElementById('inputStartTime').value;
    const startDate = startTimeStr ? new Date(startTimeStr) : new Date();

    const options = {
        startDate: startDate,
        cadBase: parseInt(document.getElementById('inputCadenceBase').value, 10) || 172,
        cadNoise: parseInt(document.getElementById('inputCadenceNoise').value, 10) || 3,
        hrStart: parseInt(document.getElementById('inputHrStart').value, 10) || 135,
        hrTarget: parseInt(document.getElementById('inputHrTarget').value, 10) || 162,
        cornerSlowdown: document.getElementById('chkCornerSlowdown')?.checked ?? true,
        sprintFinish: document.getElementById('chkSprintFinish')?.checked ?? true
    };

    return generateSingleTelemetry(ptsToRun, totalMeters, kmSplits, options);
}

// BIỂU ĐỒ CHART.JS
function initChart() {
    const canvas = document.getElementById('telemetryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    telemetryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Nhịp tim (BPM)',
                    data: [],
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.2,
                    yAxisID: 'yHr',
                    fill: true
                },
                {
                    label: 'Guồng chân (SPM)',
                    data: [],
                    borderColor: '#06b6d4',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.15,
                    yAxisID: 'yCad'
                },
                {
                    label: 'Tốc độ Pace (min/km)',
                    data: [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.15,
                    yAxisID: 'yPace'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        usePointStyle: true,
                        font: { size: 11, weight: 'bold' }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: (ctx) => `Thời gian: ${ctx[0].label}s`,
                        label: (ctx) => {
                            if (ctx.datasetIndex === 2) {
                                const val = ctx.raw;
                                const m = Math.floor(val);
                                const s = Math.round((val - m) * 60);
                                return `Pace: ${m}:${String(s).padStart(2, '0')} /km`;
                            }
                            return `${ctx.dataset.label}: ${ctx.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { display: false },
                    title: { display: true, text: 'Thời gian (Giây)', font: { size: 11 } }
                },
                yHr: {
                    type: 'linear',
                    position: 'left',
                    min: 100,
                    max: 200,
                    grid: { color: 'rgba(226, 232, 240, 0.6)' },
                    title: { display: true, text: 'Nhịp tim (BPM)', font: { size: 10 } }
                },
                yCad: {
                    type: 'linear',
                    position: 'right',
                    min: 140,
                    max: 210,
                    grid: { display: false },
                    title: { display: true, text: 'SPM', font: { size: 10 } }
                },
                yPace: {
                    type: 'linear',
                    position: 'right',
                    reverse: true,
                    min: 3.5,
                    max: 8.5,
                    grid: { display: false },
                    title: { display: true, text: 'Pace (min/km)', font: { size: 10 } }
                }
            }
        }
    });
}

function updateChartWithTelemetry(trackpoints) {
    if (!telemetryChart || !trackpoints || trackpoints.length === 0) return;

    const step = Math.max(1, Math.floor(trackpoints.length / 500));
    const labels = [];
    const hrData = [];
    const cadData = [];
    const paceData = [];

    for (let i = 0; i < trackpoints.length; i += step) {
        const pt = trackpoints[i];
        labels.push(pt.second);
        hrData.push(pt.heartRate);
        cadData.push(pt.cadence);
        paceData.push(parseFloat(pt.paceMinKm.toFixed(2)));
    }

    telemetryChart.data.labels = labels;
    telemetryChart.data.datasets[0].data = hrData;
    telemetryChart.data.datasets[1].data = cadData;
    telemetryChart.data.datasets[2].data = paceData;
    telemetryChart.update();
}

// BATCH MODAL LOGIC
function getLocalDateTimeIso() {
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return now.toISOString().slice(0, 16);
}

function parsePaceInputToSeconds(valStr, defaultSec = 450) {
    if (!valStr) return defaultSec;
    valStr = valStr.toString().trim().replace(',', '.');
    if (valStr.includes(':')) {
        const parts = valStr.split(':');
        const m = parseInt(parts[0], 10) || 7;
        const s = parseInt(parts[1], 10) || 0;
        return m * 60 + s;
    }
    const num = parseFloat(valStr);
    if (!isNaN(num)) return Math.round(num * 60);
    return defaultSec;
}

function updateBatchPaceDisplay() {
    const pMinInp = document.getElementById('inputBatchPaceMin');
    const pMaxInp = document.getElementById('inputBatchPaceMax');
    const pDisp = document.getElementById('batchPaceDisplay');

    let secMin = parsePaceInputToSeconds(pMinInp?.value, 435);
    let secMax = parsePaceInputToSeconds(pMaxInp?.value, 660);
    if (secMin < 420) {
        secMin = 420;
        if (pMinInp) pMinInp.value = "7:00";
    }
    if (secMax < secMin) {
        secMax = secMin + 30;
        if (pMaxInp) pMaxInp.value = formatPace(secMax);
    }
    if (pDisp) {
        pDisp.innerText = `${formatPace(secMin)} ➔ ${formatPace(secMax)} /km`;
    }
}

async function runBatchGeneration() {
    if (typeof JSZip === 'undefined') {
        showToast("Thư viện JSZip chưa sẵn sàng, vui lòng thử lại sau!", "warn");
        return;
    }

    let bounds = batchZoneBounds;
    if (!bounds) {
        if (waypoints && waypoints.length >= 2) {
            bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng])).pad(0.35);
        } else {
            bounds = map.getBounds();
        }
        setBatchZoneBounds(bounds);
    }

    const count = Math.max(1, Math.min(50, parseInt(document.getElementById('inputBatchCount')?.value || 5, 10)));
    const distMinKm = Math.max(1, parseFloat(document.getElementById('inputBatchDistMin')?.value || 3.0));
    const distMaxKm = Math.max(distMinKm, parseFloat(document.getElementById('inputBatchDistMax')?.value || 5.5));

    let paceMinSec = Math.max(420, parsePaceInputToSeconds(document.getElementById('inputBatchPaceMin')?.value, 435));
    let paceMaxSec = Math.max(paceMinSec, parsePaceInputToSeconds(document.getElementById('inputBatchPaceMax')?.value, 660));

    const startDtStr = document.getElementById('inputBatchStartDateTime')?.value;
    let initialStart = startDtStr ? new Date(startDtStr) : new Date();
    if (isNaN(initialStart.getTime())) initialStart = new Date();

    const gapMinutes = Math.max(0, parseInt(document.getElementById('inputBatchGapMinutes')?.value || 10, 10));
    const gapMode = document.getElementById('selectBatchGapMode')?.value || 'after_finish';
    let lastActivityEndTime = null;

    const progContainer = document.getElementById('batchProgressContainer');
    const progBar = document.getElementById('batchProgressBar');
    const progText = document.getElementById('batchProgressText');
    const progPercent = document.getElementById('batchProgressPercent');
    const btnStart = document.getElementById('btnStartBatchGenerate');

    if (progContainer) progContainer.classList.remove('hidden');
    if (btnStart) btnStart.disabled = true;

    const zip = new JSZip();

    try {
        for (let i = 1; i <= count; i++) {
            if (progText) progText.innerText = `Đang tạo file ${i}/${count}: Sinh lộ trình hữu cơ đa hướng...`;
            const pct = Math.round(((i - 0.5) / count) * 100);
            if (progBar) progBar.style.width = `${pct}%`;
            if (progPercent) progPercent.innerText = `${pct}%`;

            // Tốc độ Pace trung bình cho file này (CHÊNH LỆCH RÕ RỆT GIỮA CÁC FILE)
            const fileOffset = Math.round((Math.random() - 0.5) * 36 / 5) * 5;
            let activityPaceSec = Math.max(420, Math.round((paceMinSec + Math.random() * (paceMaxSec - paceMinSec)) / 5) * 5 + fileOffset);

            // Cự ly ngẫu nhiên trong khoảng
            const targetDistanceKm = distMinKm + Math.random() * (distMaxKm - distMinKm);
            const targetDistanceMeters = targetDistanceKm * 1000;
            const activityDurationSec = Math.max(60, Math.round(targetDistanceMeters * (activityPaceSec / 1000)));

            // Tính thời gian xuất phát cách nhau 10 phút sau kết thúc
            let fileDate;
            if (i === 1) {
                fileDate = new Date(initialStart.getTime());
            } else {
                if (gapMode === 'fixed_start') {
                    fileDate = new Date(initialStart.getTime() + (i - 1) * gapMinutes * 60 * 1000);
                } else {
                    fileDate = new Date(lastActivityEndTime.getTime() + gapMinutes * 60 * 1000);
                }
            }
            lastActivityEndTime = new Date(fileDate.getTime() + activityDurationSec * 1000);

            // Sinh waypoints ngẫu nhiên đa phân khu, đa hình thái
            const rawLoopPts = generateDiverseRandomRouteInBounds(bounds, targetDistanceMeters, i);

            // Dò đường phố thực tế qua OSRM
            let simRoadCoords = [];
            try {
                simRoadCoords = await fetchRouteFromOSRM(rawLoopPts);
            } catch (e) {
                simRoadCoords = rawLoopPts;
            }
            if (!simRoadCoords || simRoadCoords.length < 2) {
                simRoadCoords = rawLoopPts;
            }

            // Đảm bảo đủ chiều dài đường bộ thực tế
            let currentRoadMeters = computePolylineDistance(simRoadCoords);
            let safetyExtends = 0;
            while (currentRoadMeters < targetDistanceMeters && safetyExtends < 6) {
                simRoadCoords = simRoadCoords.concat(simRoadCoords.slice(1));
                currentRoadMeters = computePolylineDistance(simRoadCoords);
                safetyExtends++;
            }

            // Sinh Telemetry hàng loạt CÓ ĐỘ CONG HỮU CƠ & BIẾN THIÊN TỐC ĐỘ TỪNG KM
            const simTrackpoints = generateSyntheticBatchTelemetry(simRoadCoords, targetDistanceMeters, activityPaceSec, fileDate);

            // Xuất XML TCX
            const tcxXml = buildGarminTCX(simTrackpoints);

            // Tên file rõ ràng có ngày giờ, km và Pace
            const y = fileDate.getFullYear();
            const m = String(fileDate.getMonth() + 1).padStart(2, '0');
            const d = String(fileDate.getDate()).padStart(2, '0');
            const hh = String(fileDate.getHours()).padStart(2, '0');
            const mm = String(fileDate.getMinutes()).padStart(2, '0');
            const paceFormatted = formatPace(activityPaceSec).replace(':', 'p');
            const fileName = `Run_${y}-${m}-${d}_${hh}${mm}_${(targetDistanceMeters / 1000).toFixed(2)}km_Pace${paceFormatted}.tcx`;

            zip.file(fileName, tcxXml);
            await new Promise(r => setTimeout(r, 120));
        }

        if (progText) progText.innerText = "Đang nén file .ZIP...";
        if (progBar) progBar.style.width = "100%";
        if (progPercent) progPercent.innerText = "100%";

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = `Batch_Garmin_TCX_${count}_Activities_PaceOver7.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(zipUrl);

        showToast(`Đã xuất thành công gói ZIP gồm ${count} file TCX chuẩn Pace > 7p/km!`, "success");
        setTimeout(() => {
            document.getElementById('batchModal')?.classList.add('hidden');
        }, 1500);
    } catch (err) {
        showToast(`Lỗi tạo hàng loạt: ${err.message}`, "warn");
    } finally {
        if (btnStart) btnStart.disabled = false;
        setTimeout(() => progContainer?.classList.add('hidden'), 2500);
    }
}

// TOAST NOTIFICATIONS
function showToast(msg, type = "info") {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');
    if (!toast || !toastMsg || !toastIcon) return;

    toastMsg.innerText = msg;
    toast.className = "fixed bottom-5 right-5 z-50 transform transition-all duration-300 pointer-events-none flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold ";

    if (type === "success") {
        toast.className += "bg-white border-emerald-200 text-emerald-800 shadow-emerald-500/10 translate-y-0 opacity-100";
        toastIcon.innerHTML = `<svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    } else if (type === "warn") {
        toast.className += "bg-white border-amber-200 text-amber-800 shadow-amber-500/10 translate-y-0 opacity-100";
        toastIcon.innerHTML = `<svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else {
        toast.className += "bg-white border-slate-200 text-slate-800 shadow-slate-500/10 translate-y-0 opacity-100";
        toastIcon.innerHTML = `<svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }

    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
}

// KHỞI TẠO DOM & EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initChart();

    // Giờ xuất phát đơn lẻ
    const startTimeInp = document.getElementById('inputStartTime');
    if (startTimeInp) startTimeInp.value = getLocalDateTimeIso();

    const btnSetNow = document.getElementById('btnSetNow') || document.getElementById('btnSetCurrentTime');
    btnSetNow?.addEventListener('click', () => {
        if (startTimeInp) startTimeInp.value = getLocalDateTimeIso();
        showToast("Đã cập nhật giờ xuất phát hiện tại", "info");
    });

    // Pace Slider & Biến thiên
    document.getElementById('inputPaceSlider')?.addEventListener('input', (e) => {
        const paceVal = parseInt(e.target.value, 10);
        const pDisp = document.getElementById('paceDisplay');
        if (pDisp) pDisp.innerText = `${formatPace(paceVal)} min/km`;

        // Tự động đồng bộ Nhịp Tim & Guồng Chân sinh học chuẩn theo từng trường hợp Pace
        if (typeof getPhysiologicalMetrics === 'function') {
            const bio = getPhysiologicalMetrics(paceVal);
            const hrStartInp = document.getElementById('inputHrStart');
            const hrTargetInp = document.getElementById('inputHrTarget');
            const cadInp = document.getElementById('inputCadenceBase');
            const mainCadDisp = document.getElementById('mainCadenceDisplay');
            const baseCadDisp = document.getElementById('cadenceBaseDisplay');
            if (hrStartInp) hrStartInp.value = bio.warmHr;
            if (hrTargetInp) hrTargetInp.value = bio.baseHr;
            if (cadInp) cadInp.value = bio.baseCad;
            if (mainCadDisp) mainCadDisp.innerText = `${bio.baseCad} SPM`;
            if (baseCadDisp) baseCadDisp.innerText = `${bio.baseCad} SPM`;
            updateHrSummaryDisplay();
        }

        updatePaceVarianceDisplay();
        generateKmSplits(true);
        updateOverviewStats();
    });

    document.getElementById('inputPaceVariance')?.addEventListener('input', () => {
        updatePaceVarianceDisplay();
        generateKmSplits(true);
        updateOverviewStats();
    });

    // Km Variance Slider (hỗ trợ cả inputKmVariance và inputKmVarianceSlider)
    const kmVarInp = document.getElementById('inputKmVariance') || document.getElementById('inputKmVarianceSlider');
    kmVarInp?.addEventListener('input', (e) => {
        kmVarianceSeconds = parseInt(e.target.value, 10);
        updateKmVarianceDisplay();
        generateKmSplits(true);
        updateOverviewStats();
    });

    // Cadence & HR inputs
    document.getElementById('inputCadenceBase')?.addEventListener('input', (e) => {
        const val = e.target.value;
        const d1 = document.getElementById('mainCadenceDisplay');
        if (d1) d1.innerText = `${val} SPM`;
        const d2 = document.getElementById('cadenceBaseDisplay');
        if (d2) d2.innerText = `${val} SPM`;
        generateKmSplits(false);
    });

    document.getElementById('inputCadenceNoise')?.addEventListener('input', (e) => {
        const val = e.target.value;
        const d1 = document.getElementById('cadenceDisplay');
        if (d1) d1.innerText = `± ${val} SPM`;
        const d2 = document.getElementById('cadenceNoiseDisplay');
        if (d2) d2.innerText = `± ${val} SPM`;
    });

    function updateHrSummaryDisplay() {
        const start = document.getElementById('inputHrStart')?.value || 135;
        const target = document.getElementById('inputHrTarget')?.value || 162;
        const hrDisp = document.getElementById('hrDisplay');
        if (hrDisp) hrDisp.innerText = `${start} ➔ ${target} BPM`;
    }

    document.getElementById('inputHrStart')?.addEventListener('input', (e) => {
        updateHrSummaryDisplay();
        const d = document.getElementById('hrStartDisplay');
        if (d) d.innerText = `${e.target.value} BPM`;
    });

    document.getElementById('inputHrTarget')?.addEventListener('input', (e) => {
        updateHrSummaryDisplay();
        const d = document.getElementById('hrTargetDisplay');
        if (d) d.innerText = `${e.target.value} BPM`;
        generateKmSplits(false);
    });

    document.querySelectorAll('input[name="cadenceExportMode"]').forEach(radio => {
        radio.addEventListener('change', onCadenceModeChange);
    });

    // Actions & Toggles: Hoàn tác & Xóa lộ trình (hỗ trợ cả btnUndo/btnUndoPoint, btnClear/btnClearRoute)
    const btnUndoEl = document.getElementById('btnUndo') || document.getElementById('btnUndoPoint');
    btnUndoEl?.addEventListener('click', undoLastPoint);

    const btnClearEl = document.getElementById('btnClear') || document.getElementById('btnClearRoute');
    btnClearEl?.addEventListener('click', clearRoute);
    document.getElementById('chkSnapToRoad')?.addEventListener('change', renderRoute);
    document.getElementById('chkHumanCurve')?.addEventListener('change', renderRoute);
    document.getElementById('inputCurveAmp')?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const disp = document.getElementById('curveAmpDisplay');
        if (disp) {
            let label = `${val.toFixed(1)}m`;
            if (val <= 2.5) label += " (Cong nhẹ)";
            else if (val <= 7.0) label += " (Chuẩn người thật ngày trước)";
            else label += " (Lượn rộng)";
            disp.innerText = label;
        }
        renderRoute();
    });

    // Preview & Export Single
    document.getElementById('btnPreview')?.addEventListener('click', () => {
        try {
            generatedTrackpoints = generateTelemetryData();
            updateChartWithTelemetry(generatedTrackpoints);
            showToast("Đã mô phỏng xong dữ liệu Telemetry!", "success");
        } catch (err) {
            showToast(err.message, "warn");
        }
    });

    document.getElementById('btnExport')?.addEventListener('click', () => {
        try {
            generatedTrackpoints = generateTelemetryData();
            updateChartWithTelemetry(generatedTrackpoints);
            const xml = buildGarminTCX(generatedTrackpoints);
            const startTimeStr = document.getElementById('inputStartTime').value;
            const startDate = startTimeStr ? new Date(startTimeStr) : new Date();
            triggerDownloadTCX(xml, startDate);
        } catch (err) {
            showToast(err.message, "warn");
        }
    });

    // Search Place
    document.getElementById('btnSearchPlace')?.addEventListener('click', () => {
        searchLocation(document.getElementById('inputSearchPlace').value);
    });
    document.getElementById('inputSearchPlace')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchLocation(e.target.value);
    });

    // Khoanh vùng
    document.getElementById('btnToggleZoneSelect')?.addEventListener('click', toggleZoneSelectionMode);
    document.getElementById('btnSelectZone')?.addEventListener('click', toggleZoneSelectionMode);

    // Đồng bộ thiết bị
    const mainDevInp = document.getElementById('inputDeviceName');
    const batchDevInp = document.getElementById('inputBatchDeviceName');

    function updateDeviceTagStyles(val) {
        document.querySelectorAll('.btn-device-tag, .btn-batch-device-tag').forEach(btn => {
            const dev = btn.getAttribute('data-name');
            if (dev === val) {
                btn.className = "btn-device-tag btn-batch-device-tag px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition";
            } else {
                btn.className = "btn-device-tag btn-batch-device-tag px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-transparent rounded-lg text-[10px] font-medium transition";
            }
        });
    }

    function syncDeviceName(val) {
        if (mainDevInp) mainDevInp.value = val;
        if (batchDevInp) batchDevInp.value = val;
        updateDeviceTagStyles(val);
    }

    mainDevInp?.addEventListener('change', (e) => syncDeviceName(e.target.value));
    mainDevInp?.addEventListener('input', (e) => syncDeviceName(e.target.value));
    batchDevInp?.addEventListener('change', (e) => syncDeviceName(e.target.value));
    batchDevInp?.addEventListener('input', (e) => syncDeviceName(e.target.value));

    document.querySelectorAll('.btn-device-tag, .btn-batch-device-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const devName = e.currentTarget.getAttribute('data-name');
            if (devName) {
                syncDeviceName(devName);
                const toastMsg = devName === 'none' ? 'Đã chọn: Không dùng đồng hồ (Ẩn thiết bị)' : `Đã chọn thiết bị: ${devName}`;
                showToast(toastMsg, "info");
            }
        });
    });

    // Batch Modal Controls
    const batchModal = document.getElementById('batchModal');
    document.getElementById('btnOpenBatchModal')?.addEventListener('click', () => {
        const dtInp = document.getElementById('inputBatchStartDateTime');
        if (dtInp && !dtInp.value) {
            dtInp.value = getLocalDateTimeIso();
        }
        if (mainDevInp && batchDevInp) {
            batchDevInp.value = mainDevInp.value;
        }
        batchModal?.classList.remove('hidden');
    });

    document.getElementById('btnCloseBatchModal')?.addEventListener('click', () => {
        batchModal?.classList.add('hidden');
    });
    document.getElementById('btnCancelBatch')?.addEventListener('click', () => {
        batchModal?.classList.add('hidden');
    });

    document.getElementById('btnSetBatchNow')?.addEventListener('click', () => {
        const dtInp = document.getElementById('inputBatchStartDateTime');
        if (dtInp) {
            dtInp.value = getLocalDateTimeIso();
            showToast("Đã đặt giờ xuất phát bài 1 theo hiện tại!", "info");
        }
    });

    const gapInp = document.getElementById('inputBatchGapMinutes');
    const gapModeSelect = document.getElementById('selectBatchGapMode');
    const gapDesc = document.getElementById('batchGapDescription');
    function updateBatchGapDesc() {
        const mins = parseInt(gapInp?.value || 10, 10);
        const mode = gapModeSelect?.value || 'after_finish';
        if (gapDesc) {
            if (mode === 'after_finish') {
                gapDesc.innerText = `Mỗi file cách nhau ${mins} phút (sau khi bài trước kết thúc)`;
            } else {
                gapDesc.innerText = `Cố định cứ ${mins} phút xuất phát một file mới`;
            }
        }
    }
    gapInp?.addEventListener('input', updateBatchGapDesc);
    gapModeSelect?.addEventListener('change', updateBatchGapDesc);

    document.getElementById('btnSetZoneCurrentView')?.addEventListener('click', () => {
        if (map) {
            setBatchZoneBounds(map.getBounds());
            showToast("Đã lấy toàn bộ khung nhìn bản đồ hiện tại làm vùng giới hạn!", "success");
        }
    });

    const pMinInp = document.getElementById('inputBatchPaceMin');
    const pMaxInp = document.getElementById('inputBatchPaceMax');
    pMinInp?.addEventListener('change', updateBatchPaceDisplay);
    pMaxInp?.addEventListener('change', updateBatchPaceDisplay);

    document.getElementById('btnStartBatchGenerate')?.addEventListener('click', async () => {
        await runBatchGeneration();
    });

    // Tải mặc định lộ trình làng quê Mỹ Hà quanh co chuẩn thực tế
    loadPreset('myha');

    if (window.lucide) lucide.createIcons();
});

// Global window exports
window.setStartTimeToNow = function() {
    const startTimeInp = document.getElementById('inputStartTime');
    if (startTimeInp) startTimeInp.value = getLocalDateTimeIso();
    showToast("Đã cập nhật giờ xuất phát hiện tại", "info");
};
window.setSplitStrategy = setSplitStrategy;
window.randomizeSplits = randomizeSplits;
window.adjustKmPace = adjustKmPace;
window.adjustKmCadence = adjustKmCadence;
window.onKmPaceChange = onKmPaceChange;
window.onKmCadenceChange = onKmCadenceChange;
window.onCadenceModeChange = onCadenceModeChange;
window.updateOverviewStats = updateOverviewStats;
window.generateKmSplits = generateKmSplits;
window.renderKmSplitsUI = renderKmSplitsUI;
window.switchMobileTab = switchMobileTab;
window.openBatchModalFromMobile = openBatchModalFromMobile;
