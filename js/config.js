/**
 * config.js - Presets, Thiết bị đồng hồ & Cấu hình mặc định
 * Bảng ProductID chính thức theo chuẩn Garmin FIT SDK & Strava Device Mapping
 */

const DEVICE_PROFILES = {
    "none": { unitId: 0, productId: 0, verMajor: 1, verMinor: 0, author: "Strava Mobile App", noDevice: true },
    "Không dùng đồng hồ": { unitId: 0, productId: 0, verMajor: 1, verMinor: 0, author: "Strava Mobile App", noDevice: true },
    "Garmin Forerunner 965": { unitId: 3458921470, productId: 4315, verMajor: 20, verMinor: 26, author: "Garmin Connect API" },
    "Garmin Forerunner 265": { unitId: 3412589012, productId: 4257, verMajor: 19, verMinor: 18, author: "Garmin Connect API" },
    "Garmin Forerunner 955": { unitId: 3418925120, productId: 4024, verMajor: 19, verMinor: 18, author: "Garmin Connect API" },
    "Garmin Forerunner 255": { unitId: 3409812450, productId: 3992, verMajor: 18, verMinor: 15, author: "Garmin Connect API" },
    "Garmin Fenix 7 Pro": { unitId: 3389014522, productId: 4375, verMajor: 17, verMinor: 28, author: "Garmin Connect API" },
    "Garmin Fenix 7": { unitId: 3387123901, productId: 3906, verMajor: 17, verMinor: 28, author: "Garmin Connect API" },
    "Garmin Forerunner 745": { unitId: 3371982140, productId: 3589, verMajor: 12, verMinor: 10, author: "Garmin Connect API" },
    "Garmin Forerunner 245": { unitId: 3350912480, productId: 3076, verMajor: 11, verMinor: 60, author: "Garmin Connect API" }
};

// Preset Coordinates mẫu
const PRESETS = {
    myha: [
        { lat: 21.3965, lng: 106.1735 }, // Bến Tuần / Đê Sông Thương
        { lat: 21.3990, lng: 106.1780 }, // Đường ven sông hướng Trường Mầm Non
        { lat: 21.4010, lng: 106.1795 }, // Trường Mầm Non Xã Mỹ Hà
        { lat: 21.4007, lng: 106.1770 }, // Đường bê tông làng uốn lượn qua xóm
        { lat: 21.3998, lng: 106.1750 }, // Khúc cua ngõ xóm hướng tây
        { lat: 21.4040, lng: 106.1732 }, // Rẽ thò vào ngõ cụt quay đầu
        { lat: 21.4015, lng: 106.1745 }, // Trở ra ngã ba xóm
        { lat: 21.3982, lng: 106.1748 }, // Khu Dốc Tình / THCS Mỹ Hà
        { lat: 21.3965, lng: 106.1735 }  // Về lại Bến Tuần khép vòng
    ],
    tanyen: [
        { lat: 21.3868, lng: 106.1315 }, // Đường Cao Kỳ Vân (gần UBND huyện Tân Yên)
        { lat: 21.3842, lng: 106.1348 }, // Rẽ Hoàng Hoa Thám (ĐT 298)
        { lat: 21.3802, lng: 106.1359 }, // Đình Cao Thượng / Phố Hoàng Hoa Thám
        { lat: 21.3775, lng: 106.1338 }, // Đường Hoàng Quốc Việt
        { lat: 21.3788, lng: 106.1306 }, // Đường Cầu Vồng / Phố Mới
        { lat: 21.3835, lng: 106.1275 }, // Cao Kỳ Vân phía Tây
        { lat: 21.3868, lng: 106.1315 }  // Về lại UBND Tân Yên khép vòng
    ],
    hoangkiem: [
        { lat: 21.02868, lng: 105.85244 },
        { lat: 21.03078, lng: 105.85250 },
        { lat: 21.03153, lng: 105.85324 },
        { lat: 21.03158, lng: 105.85465 },
        { lat: 21.02980, lng: 105.85505 },
        { lat: 21.02700, lng: 105.85420 },
        { lat: 21.02685, lng: 105.85255 },
        { lat: 21.02868, lng: 105.85244 }
    ],
    thongnhat: [
        { lat: 21.0145, lng: 105.8425 },
        { lat: 21.0165, lng: 105.8450 },
        { lat: 21.0180, lng: 105.8475 },
        { lat: 21.0150, lng: 105.8490 },
        { lat: 21.0125, lng: 105.8465 },
        { lat: 21.0145, lng: 105.8425 }
    ],
    tayho: [
        { lat: 21.0585, lng: 105.8235 },
        { lat: 21.0645, lng: 105.8270 },
        { lat: 21.0600, lng: 105.8350 },
        { lat: 21.0515, lng: 105.8320 },
        { lat: 21.0585, lng: 105.8235 }
    ]
};
