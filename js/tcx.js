/**
 * tcx.js - Bộ đóng gói XML định dạng Garmin Training Center Database (.TCX) Đa Lap
 * Tương thích nhận diện thiết bị trên Strava, Garmin Connect & vRace
 */

function getActiveDeviceProfile() {
    const rawName = (document.getElementById('inputDeviceName')?.value || 
                     document.getElementById('inputBatchDeviceName')?.value || 
                     "Garmin Forerunner 965").trim();

    if (rawName === 'none' || rawName === 'Không dùng đồng hồ') {
        return {
            name: "Không dùng đồng hồ",
            noDevice: true,
            unitId: 0,
            productId: 0,
            verMajor: 1,
            verMinor: 0,
            author: "Strava Mobile App"
        };
    }

    if (DEVICE_PROFILES[rawName]) {
        return {
            name: rawName,
            ...DEVICE_PROFILES[rawName]
        };
    }

    const lower = rawName.toLowerCase();
    if (lower.includes('không') || lower.includes('ko') || lower.includes('ẩn') || lower.includes('điện thoại') || lower === 'none') {
        return {
            name: "Không dùng đồng hồ",
            noDevice: true,
            unitId: 0,
            productId: 0,
            verMajor: 1,
            verMinor: 0,
            author: "Strava Mobile App"
        };
    }

    // Nhận diện các dòng Garmin chính hãng theo từ khóa & mã ProductID chuẩn
    let prodId = 4315; // Mặc định: Forerunner 965 (Huy hiệu đồng hồ cao cấp chuẩn Strava)
    let verMaj = 20;
    let verMin = 26;

    if (lower.includes('265')) {
        prodId = 4257; verMaj = 19; verMin = 18;
    } else if (lower.includes('965')) {
        prodId = 4315; verMaj = 20; verMin = 26;
    } else if (lower.includes('955')) {
        prodId = 4024; verMaj = 19; verMin = 18;
    } else if (lower.includes('255')) {
        prodId = 3992; verMaj = 18; verMin = 15;
    } else if (lower.includes('fenix 7 pro')) {
        prodId = 4375; verMaj = 17; verMin = 28;
    } else if (lower.includes('fenix')) {
        prodId = 3906; verMaj = 17; verMin = 28;
    } else if (lower.includes('745')) {
        prodId = 3589; verMaj = 12; verMin = 10;
    } else if (lower.includes('945')) {
        prodId = 3110; verMaj = 13; verMin = 20;
    } else if (lower.includes('245')) {
        prodId = 3076; verMaj = 11; verMin = 60;
    }

    return {
        name: rawName,
        unitId: Math.floor(3400000000 + Math.random() * 500000000),
        productId: prodId,
        verMajor: verMaj,
        verMinor: verMin,
        author: "Garmin Connect API"
    };
}

function buildGarminTCX(trackpoints) {
    if (!trackpoints || trackpoints.length === 0) return '';
    const firstPt = trackpoints[0];
    const startTime = firstPt.time;

    // Nhóm trackpoints theo từng Kilomet (Lap)
    const lapsData = [];
    let currentLapPoints = [];
    let currentLapIdx = trackpoints[0].splitIndex || 1;

    for (let i = 0; i < trackpoints.length; i++) {
        const pt = trackpoints[i];
        const lapNum = pt.splitIndex || 1;

        if (lapNum !== currentLapIdx && currentLapPoints.length > 0) {
            lapsData.push({
                lapIndex: currentLapIdx,
                points: currentLapPoints
            });
            currentLapPoints = [];
            currentLapIdx = lapNum;
        }
        currentLapPoints.push(pt);
    }
    if (currentLapPoints.length > 0) {
        lapsData.push({
            lapIndex: currentLapIdx,
            points: currentLapPoints
        });
    }

    // Lọc bỏ lap rỗng
    const validLaps = lapsData.filter(l => l.points.length > 0);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
  xmlns:ns5="http://www.garmin.com/xmlschemas/ActivityGoals/v1"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xmlns:ns2="http://www.garmin.com/xmlschemas/UserProfile/v2"
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ns4="http://www.garmin.com/xmlschemas/ProfileExtension/v1">
  <Activities>
    <Activity Sport="Running">
      <Id>${startTime}</Id>
`;

    // Sinh từng thẻ <Lap> cho mỗi Kilomet
    validLaps.forEach(lap => {
        const pts = lap.points;
        const lapStart = pts[0];
        const lapEnd = pts[pts.length - 1];
        const lapStartTime = lapStart.time;
        const lapDuration = pts.length;
        const startDist = parseFloat(lapStart.distanceMeters);
        const endDist = parseFloat(lapEnd.distanceMeters);
        const lapDist = Math.max(0, endDist - startDist);

        let sumHr = 0, maxHr = 0, sumCad = 0, maxSpd = 0;
        pts.forEach(p => {
            sumHr += p.heartRate;
            if (p.heartRate > maxHr) maxHr = p.heartRate;
            sumCad += p.cadence;
            if (p.speedMps > maxSpd) maxSpd = p.speedMps;
        });
        const avgHr = Math.round(sumHr / pts.length);
        const avgCad = Math.round(sumCad / pts.length);
        const lapCal = Math.round((lapDist / 1000) * 62);

        // Chế độ xuất Cadence (auto: chia đôi cho thẻ legacy <Cadence>, raw: giữ nguyên)
        const cadenceExportMode = document.querySelector('input[name="cadenceExportMode"]:checked')?.value || 'auto';
        const legacyLapCadence = cadenceExportMode === 'auto' ? Math.round(avgCad / 2) : avgCad;

        xml += `      <Lap StartTime="${lapStartTime}">
        <TotalTimeSeconds>${lapDuration}</TotalTimeSeconds>
        <DistanceMeters>${lapDist.toFixed(2)}</DistanceMeters>
        <MaximumSpeed>${maxSpd.toFixed(2)}</MaximumSpeed>
        <Calories>${lapCal}</Calories>
        <AverageHeartRateBpm>
          <Value>${avgHr}</Value>
        </AverageHeartRateBpm>
        <MaximumHeartRateBpm>
          <Value>${maxHr}</Value>
        </MaximumHeartRateBpm>
        <Intensity>Active</Intensity>
        <Cadence>${legacyLapCadence}</Cadence>
        <TriggerMethod>Distance</TriggerMethod>
        <Track>
`;
        for (let j = 0; j < pts.length; j++) {
            const p = pts[j];
            const legacyPtCadence = cadenceExportMode === 'auto' ? Math.round(p.cadence / 2) : p.cadence;
            xml += `          <Trackpoint>
            <Time>${p.time}</Time>
            <Position>
              <LatitudeDegrees>${p.lat}</LatitudeDegrees>
              <LongitudeDegrees>${p.lng}</LongitudeDegrees>
            </Position>
            <AltitudeMeters>${p.altitude}</AltitudeMeters>
            <DistanceMeters>${p.distanceMeters}</DistanceMeters>
            <HeartRateBpm>
              <Value>${p.heartRate}</Value>
            </HeartRateBpm>
            <Cadence>${legacyPtCadence}</Cadence>
            <Extensions>
              <ns3:TPX>
                <ns3:Speed>${p.speedMps ? p.speedMps.toFixed(2) : '0.00'}</ns3:Speed>
                <ns3:RunCadence>${p.cadence}</ns3:RunCadence>
              </ns3:TPX>
            </Extensions>
          </Trackpoint>
`;
        }
        xml += `        </Track>
        <Extensions>
          <ns3:LX>
            <ns3:AvgRunCadence>${avgCad}</ns3:AvgRunCadence>
            <ns3:MaxRunCadence>${avgCad + 6}</ns3:MaxRunCadence>
          </ns3:LX>
        </Extensions>
      </Lap>
`;
    });

    const devProfile = getActiveDeviceProfile();
    const safeDevName = (devProfile.name || '').replace(/[<>&'"]/g, c => {
        return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c];
    });
    const authorName = devProfile.author || (devProfile.productId > 0 ? 'Garmin Connect API' : 'Strava Mobile App');
    const safeAuthorName = authorName.replace(/[<>&'"]/g, c => {
        return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c];
    });
    const partNumber = devProfile.productId > 0 ? '006-D2449-00' : '000-00000-00';

    if (devProfile.noDevice) {
        xml += `    </Activity>
  </Activities>
  <Author xsi:type="Application_t">
    <Name>Strava Mobile App</Name>
    <Build>
      <Version>
        <VersionMajor>1</VersionMajor>
        <VersionMinor>0</VersionMinor>
        <BuildMajor>0</BuildMajor>
        <BuildMinor>0</BuildMinor>
      </Version>
    </Build>
    <LangID>en</LangID>
    <PartNumber>000-00000-00</PartNumber>
  </Author>
</TrainingCenterDatabase>`;
    } else {
        xml += `      <Notes>${safeDevName}</Notes>
      <Creator xsi:type="Device_t">
        <Name>${safeDevName}</Name>
        <UnitId>${devProfile.unitId || 0}</UnitId>
        <ProductID>${devProfile.productId || 0}</ProductID>
        <Version>
          <VersionMajor>${devProfile.verMajor || 1}</VersionMajor>
          <VersionMinor>${devProfile.verMinor || 0}</VersionMinor>
          <BuildMajor>0</BuildMajor>
          <BuildMinor>0</BuildMinor>
        </Version>
      </Creator>
    </Activity>
  </Activities>
  <Author xsi:type="Application_t">
    <Name>${safeAuthorName}</Name>
    <Build>
      <Version>
        <VersionMajor>${devProfile.verMajor || 1}</VersionMajor>
        <VersionMinor>${devProfile.verMinor || 0}</VersionMinor>
        <BuildMajor>0</BuildMajor>
        <BuildMinor>0</BuildMinor>
      </Version>
    </Build>
    <LangID>en</LangID>
    <PartNumber>${partNumber}</PartNumber>
  </Author>
</TrainingCenterDatabase>`;
    }

    return xml;
}

function triggerDownloadTCX(tcxContent, startDate) {
    const blob = new Blob([tcxContent], { type: 'application/vnd.garmin.tcx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, '0');
    const d = String(startDate.getDate()).padStart(2, '0');
    const hh = String(startDate.getHours()).padStart(2, '0');
    const mm = String(startDate.getMinutes()).padStart(2, '0');

    const totalMeters = calculateTotalDistance(routeCoordinates.length >= 2 ? routeCoordinates : waypoints);
    const paceSec = getSelectedPaceSeconds();
    const paceFormatted = formatPace(paceSec).replace(':', 'p');

    a.href = url;
    a.download = `Run_${y}-${m}-${d}_${hh}${mm}_${(totalMeters / 1000).toFixed(2)}km_Pace${paceFormatted}.tcx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Đã xuất file .TCX thành công!", "success");
}
