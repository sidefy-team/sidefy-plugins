function fetchEvents(config) {
    var lat = isNaN(parseFloat(config.latitude)) ? 34.26 : parseFloat(config.latitude);
    var lng = isNaN(parseFloat(config.longitude)) ? 108.94 : parseFloat(config.longitude);
    var cityName = config.city_name;
    var sunriseColor = "#FF9500";
    var sunsetColor = "#5856D6";

    try {
        var now = new Date();
        var year = now.getFullYear();
        var month = now.getMonth() + 1;
        var day = now.getDate();

        // NOAA Solar Position Algorithm
        var N = dayOfYear(year, month, day);
        var lngHour = lng / 15.0;
        var t = N + ((6 - lngHour) / 24.0);
        var M = (0.9856 * t) - 3.289;
        var L = M + (1.916 * sinDeg(M)) + (0.020 * sinDeg(2 * M)) + 282.634;
        L = normalizeAngle(L);
        var RA = atanDeg(0.91764 * tanDeg(L));
        RA = normalizeAngle(RA);
        var Lquadrant = (Math.floor(L / 90)) * 90;
        var RAquadrant = (Math.floor(RA / 90)) * 90;
        RA = RA + (Lquadrant - RAquadrant);
        RA = RA / 15.0;
        var sinDec = 0.39782 * sinDeg(L);
        var cosDec = cosDeg(asinDeg(sinDec));
        var cosH = (cosDeg(90.833) - (sinDec * sinDeg(lat))) / (cosDec * cosDeg(lat));

        // Check for polar day/night
        if (cosH > 1) {
            return [{
                title: sidefy.i18n({"zh": cityName + " 今日极夜", "en": cityName + ": Polar Night"}),
                startDate: sidefy.date.format(startOfDayTimestamp(now)),
                endDate: sidefy.date.format(startOfDayTimestamp(now)),
                color: "#34495e",
                isAllDay: true,
                isPointInTime: false
            }];
        }
        if (cosH < -1) {
            return [{
                title: sidefy.i18n({"zh": cityName + " 今日极昼", "en": cityName + ": Midnight Sun"}),
                startDate: sidefy.date.format(startOfDayTimestamp(now)),
                endDate: sidefy.date.format(startOfDayTimestamp(now)),
                color: "#f1c40f",
                isAllDay: true,
                isPointInTime: false
            }];
        }

        var H = acosDeg(cosH);
        var Hrise = 360 - H;
        var Hset = H;
        var tSunset = N + ((18 - lngHour) / 24.0);
        var Tset = (Hset / 15.0) + RA - (0.06571 * tSunset) - 6.622;
        var Trise = (Hrise / 15.0) + RA - (0.06571 * t) - 6.622;
        var UTset = Tset - lngHour;
        var UTrise = Trise - lngHour;

        // Convert to local time using user-configured timezone offset
        var offsetHours = parseFloat(config.timezone_offset);
        var sunriseHour = UTrise + offsetHours;
        var sunsetHour = UTset + offsetHours;

        sunriseHour = ((sunriseHour % 24) + 24) % 24;
        sunsetHour = ((sunsetHour % 24) + 24) % 24;

        var sunriseTime = formatTime(sunriseHour);
        var sunsetTime = formatTime(sunsetHour);

        var sunriseTs = hourToTimestamp(now, sunriseHour);
        var sunsetTs = hourToTimestamp(now, sunsetHour);

        var daylightHours = sunsetHour - sunriseHour;
        if (daylightHours < 0) daylightHours += 24;
        var daylightH = Math.floor(daylightHours);
        var daylightM = Math.round((daylightHours - daylightH) * 60);

        var events = [
            {
                title: sidefy.i18n({
                    "zh": cityName + " 日出 " + sunriseTime + " | 日照 " + daylightH + "时" + daylightM + "分",
                    "en": cityName + " Sunrise " + sunriseTime + " | Daylight " + daylightH + "h " + daylightM + "m"
                }),
                startDate: sidefy.date.format(sunriseTs),
                endDate: sidefy.date.format(sunriseTs + 1800),
                color: sunriseColor,
                isAllDay: false,
                isPointInTime: true
            },
            {
                title: sidefy.i18n({
                    "zh": cityName + " 日落 " + sunsetTime,
                    "en": cityName + " Sunset " + sunsetTime
                }),
                startDate: sidefy.date.format(sunsetTs),
                endDate: sidefy.date.format(sunsetTs + 1800),
                color: sunsetColor,
                isAllDay: false,
                isPointInTime: true
            }
        ];

        return events;
    } catch (err) {
        sidefy.log("Sunrise/Sunset error: " + err.message);
        return [];
    }
}

// Helper functions
function sinDeg(deg) { return Math.sin(deg * Math.PI / 180); }
function cosDeg(deg) { return Math.cos(deg * Math.PI / 180); }
function tanDeg(deg) { return Math.tan(deg * Math.PI / 180); }
function asinDeg(x) { return Math.asin(x) * 180 / Math.PI; }
function atanDeg(x) { return Math.atan(x) * 180 / Math.PI; }
function acosDeg(x) { return Math.acos(x) * 180 / Math.PI; }

function normalizeAngle(angle) {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
}

function dayOfYear(year, month, day) {
    var isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    var daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var n = 0;
    for (var i = 0; i < month - 1; i++) {
        n += daysInMonth[i];
    }
    return n + day;
}

function decimalToHM(decimalHours) {
    var h = Math.floor(decimalHours);
    var m = Math.floor((decimalHours - h) * 60);
    var s = Math.floor(((decimalHours - h) * 60 - m) * 60);
    if (s >= 30) m++;
    if (m >= 60) { m = 0; h++; }
    return { h: h, m: m };
}

function formatTime(decimalHours) {
    var hm = decimalToHM(decimalHours);
    var h = ((hm.h % 24) + 24) % 24;
    return (h < 10 ? "0" : "") + h + ":" + (hm.m < 10 ? "0" : "") + hm.m;
}

function startOfDayTimestamp(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000;
}

function hourToTimestamp(date, decimalHours) {
    var hm = decimalToHM(decimalHours);
    var dayOffset = 0;
    if (hm.h >= 24) { dayOffset = Math.floor(hm.h / 24); }
    if (hm.h < 0) { dayOffset = Math.floor(hm.h / 24); }
    var h = ((hm.h % 24) + 24) % 24;
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset, h, hm.m, 0);
    return d.getTime() / 1000;
}