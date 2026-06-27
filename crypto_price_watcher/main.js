// Crypto Price Monitor - fetches price data via CoinGecko API
function fetchEvents(config) {
    var events = [];

    try {
        var tokens = [];
        if (config.tokens && typeof config.tokens === 'string') {
            tokens = config.tokens.split(',').map(function (t) { return t.trim(); });
        }

        if (tokens.length === 0) {
            sidefy.log("No tokens configured. Set tokens in config.");
            return events;
        }

        var intervalMinutes = Number(config.interval_minutes);
        if (isNaN(intervalMinutes) || intervalMinutes < 1) {
            intervalMinutes = 15;
        }

        var cooldownHours = Number(config.alert_cooldown_hours);
        if (isNaN(cooldownHours) || cooldownHours < 0) {
            cooldownHours = 6;
        }

        var headers = {
            "User-Agent": "Sidefy Crypto Price Monitor",
            "Accept": "application/json"
        };

        var now = new Date();
        var nowTs = now.getTime();
        var cacheKey = "crypto_watcher_price_cache";
        var cacheTimeKey = "crypto_watcher_price_cache_time";
        var cachedTime = Number(sidefy.storage.get(cacheTimeKey)) || 0;
        var data = null;

        if (nowTs - cachedTime < intervalMinutes * 60000) {
            var cachedData = sidefy.storage.get(cacheKey);
            if (cachedData) {
                try {
                    data = JSON.parse(cachedData);
                } catch (e) {
                    data = null;
                }
            }
        }

        if (!data) {
            var url = "https://api.coingecko.com/api/v3/simple/price?ids=" + tokens.join(',') +
                "&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true";

            var response = sidefy.http.get(url, headers);
            if (!response) {
                sidefy.log("CoinGecko API request failed");
                return events;
            }

            data = JSON.parse(response);
            sidefy.storage.set(cacheKey, JSON.stringify(data));
            sidefy.storage.set(cacheTimeKey, String(nowTs));
        }

        var symbolCacheKey = "crypto_watcher_symbol_map";
        var symbolMap = {};
        try {
            var cached = sidefy.storage.get(symbolCacheKey);
            if (cached) {
                symbolMap = JSON.parse(cached);
            }
        } catch (e) {
            symbolMap = {};
        }

        tokens.forEach(function (tokenKey) {
            var coinData = data[tokenKey];
            if (!coinData || coinData.usd === undefined) {
                sidefy.log("Token data not found: " + tokenKey);
                return;
            }

            var price = coinData.usd;
            var change24h = coinData.usd_24h_change || 0;
            var lastUpdated = coinData.last_updated_at
                ? new Date(coinData.last_updated_at * 1000)
                : now;

            var eventDate = new Date(now);
            eventDate.setHours(0, 0, 0, 0);

            var updatedTime =
                String(lastUpdated.getHours()).padStart(2, "0") + ":" +
                String(lastUpdated.getMinutes()).padStart(2, "0") + ":" +
                String(lastUpdated.getSeconds()).padStart(2, "0");
            var notes = sidefy.i18n(I18N_UPDATED_LABEL) + updatedTime;

            var color = "#4285f4";
            var changeText = "";
            if (change24h > 0) {
                color = "#34a853";
                changeText = "↗ +" + change24h.toFixed(2) + "%";
            } else if (change24h < 0) {
                color = "#ea4335";
                changeText = "↘ " + change24h.toFixed(2) + "%";
            } else {
                changeText = "→ 0.00%";
            }

            var symbol = symbolMap[tokenKey] || tokenKey.toUpperCase();
            var title = symbol + " $" + price.toFixed(6) + " " + changeText;
            var href = "https://www.coingecko.com/en/coins/" + tokenKey;

            if (!symbolMap[tokenKey]) {
                try {
                    var coinUrl = "https://api.coingecko.com/api/v3/coins/" + tokenKey;
                    var coinResponse = sidefy.http.get(coinUrl, headers);
                    if (coinResponse) {
                        var coinInfo = JSON.parse(coinResponse);
                        if (coinInfo.symbol) {
                            symbolMap[tokenKey] = coinInfo.symbol.toUpperCase();
                            sidefy.storage.set(symbolCacheKey, JSON.stringify(symbolMap));
                            symbol = symbolMap[tokenKey];
                            title = symbol + " $" + price.toFixed(6) + " " + changeText;
                        }
                    }
                } catch (e) {
                    sidefy.log("Failed to fetch symbol for " + tokenKey + ": " + e.message);
                }
            }

            var alerts = [];
            var alertBelow = config[tokenKey + "_alert_below"];
            var alertAbove = config[tokenKey + "_alert_above"];
            var alertChangePct = config[tokenKey + "_alert_change_pct"];

            if (alertBelow !== undefined && !isNaN(Number(alertBelow))) {
                if (price < Number(alertBelow)) {
                    alerts.push({ type: "below", threshold: Number(alertBelow) });
                }
            }

            if (alertAbove !== undefined && !isNaN(Number(alertAbove))) {
                if (price > Number(alertAbove)) {
                    alerts.push({ type: "above", threshold: Number(alertAbove) });
                }
            }

            if (alertChangePct !== undefined && !isNaN(Number(alertChangePct))) {
                if (Math.abs(change24h) > Number(alertChangePct)) {
                    alerts.push({ type: "change_pct", threshold: Number(alertChangePct) });
                }
            }

            if (alerts.length > 0 && cooldownHours > 0) {
                var storageKey = "crypto_watcher_cooldown_" + tokenKey;
                var cooldownData = sidefy.storage.get(storageKey);
                var cooldowns = {};
                try {
                    if (cooldownData) {
                        cooldowns = JSON.parse(cooldownData);
                    }
                } catch (e) {
                    cooldowns = {};
                }

                var alertNowTs = now.getTime();
                var activeAlerts = [];
                var updatedCooldowns = {};

                for (var i = 0; i < alerts.length; i++) {
                    var a = alerts[i];
                    var lastTrigger = cooldowns[a.type] || 0;
                    if (alertNowTs - lastTrigger > cooldownHours * 3600000) {
                        activeAlerts.push(a);
                        updatedCooldowns[a.type] = alertNowTs;
                    }
                }

                Object.keys(cooldowns).forEach(function (k) {
                    if (!updatedCooldowns[k] && (alertNowTs - cooldowns[k] <= cooldownHours * 3600000)) {
                        updatedCooldowns[k] = cooldowns[k];
                    }
                });

                sidefy.storage.set(storageKey, JSON.stringify(updatedCooldowns));
                alerts = activeAlerts;
            }

            if (alerts.length > 0) {
                color = "#ff6d01";
                var alertTexts = [];
                for (var j = 0; j < alerts.length; j++) {
                    var at = alerts[j];
                    if (at.type === "below") {
                        alertTexts.push("< $" + at.threshold);
                    } else if (at.type === "above") {
                        alertTexts.push("> $" + at.threshold);
                    } else if (at.type === "change_pct") {
                        alertTexts.push(sidefy.i18n(I18N_ALERT_CHANGE_PCT) + at.threshold + "%");
                    }
                }
                title = "[ALERT] " + title + " (" + alertTexts.join(", ") + ")";
            }

            events.push({
                title: title,
                startDate: sidefy.date.format(eventDate.getTime() / 1000),
                endDate: sidefy.date.format(eventDate.getTime() / 1000),
                color: color,
                notes: notes,
                icon: null,
                isAllDay: true,
                isPointInTime: true,
                href: href
            });
        });

        sidefy.log("Fetched " + events.length + " crypto price entries");
    } catch (err) {
        sidefy.log("CoinGecko API request failed: " + err.message);
    }

    return events;
}

// --- i18n ---

var I18N_UPDATED_LABEL = {
    zh: "更新时间：",
    en: "Updated: ",
    ja: "更新: ",
    ko: "업데이트: "
};

var I18N_ALERT_CHANGE_PCT = {
    zh: "24h波动 > ",
    en: "24h change > ",
    ja: "24時間変動 > ",
    ko: "24시간 변동 > "
};
