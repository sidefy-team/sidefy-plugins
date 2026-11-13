// Crypto Price Monitor - fetches price data via CoinGecko API
var STORAGE_KEY = "crypto_watcher_state";
var CHANGE_WINDOW = "24h";

function fetchEvents(config) {
    var events = [];

    try {
        var tokens = [];
        var seen = Object.create(null);
        if (config.tokens && typeof config.tokens === "string") {
            config.tokens.split(",").forEach(function (item) {
                var token = item.trim();
                if (token && !seen[token]) {
                    seen[token] = true;
                    tokens.push(token);
                }
            });
        }

        if (tokens.length === 0) {
            sidefy.log("No tokens configured. Set tokens in config.");
            return events;
        }

        var intervalMinutes = Number(config.interval_minutes);
        if (!isFinite(intervalMinutes) || intervalMinutes < 1) {
            intervalMinutes = 15;
        }

        var headers = {
            "User-Agent": "Sidefy Crypto Price Monitor",
            "Accept": "application/json"
        };

        var now = new Date();
        var nowTs = now.getTime();

        // Persist request attempts separately from successful quotes.
        var state = { fetchedAt: 0, attemptedAt: 0, tokens: [], coins: {} };
        var raw = sidefy.storage.get(STORAGE_KEY);
        if (raw) {
            try {
                if (typeof raw === "string") {
                    raw = JSON.parse(raw);
                }
                if (raw && typeof raw === "object") {
                    state.fetchedAt = finiteNumber(raw.fetchedAt) || 0;
                    state.attemptedAt = finiteNumber(raw.attemptedAt) || state.fetchedAt;
                    state.tokens = Array.isArray(raw.tokens) ? raw.tokens : [];
                    state.coins = raw.coins && typeof raw.coins === "object" ? raw.coins : {};
                }
            } catch (e) {
                state = { fetchedAt: 0, attemptedAt: 0, tokens: [], coins: {} };
            }
        }

        // Drop coins no longer in config; strip legacy cooldown fields
        Object.keys(state.coins).forEach(function (id) {
            if (tokens.indexOf(id) === -1 || !state.coins[id] || typeof state.coins[id] !== "object") {
                delete state.coins[id];
                return;
            }
            delete state.coins[id].cooldowns;
        });

        var age = nowTs - state.attemptedAt;
        var needFetch = !(state.attemptedAt > 0 && age >= 0 && age < intervalMinutes * 60000);
        if (!needFetch) {
            for (var i = 0; i < tokens.length; i++) {
                if (state.tokens.indexOf(tokens[i]) === -1) {
                    needFetch = true;
                    break;
                }
            }
        }

        if (needFetch) {
            state.attemptedAt = nowTs;
            tokens.forEach(function (id) {
                if (state.coins[id]) state.coins[id].refreshFailed = true;
            });
            try {
                var url = "https://api.coingecko.com/api/v3/simple/price?ids=" +
                    tokens.map(encodeURIComponent).join(",") +
                    "&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true";
                var response = sidefy.http.get(url, headers);
                if (response) {
                    var data = typeof response === "string" ? JSON.parse(response) : response;
                    if (data && typeof data === "object") {
                        for (var j = 0; j < tokens.length; j++) {
                            var id = tokens[j];
                            var item = data[id];
                            if (!item || finiteNumber(item.usd) === null || Number(item.usd) < 0) {
                                continue;
                            }
                            var prev = state.coins[id] || {};
                            state.coins[id] = {
                                symbol: prev.symbol || id.toUpperCase(),
                                price: Number(item.usd),
                                change24h: finiteNumber(item.usd_24h_change),
                                updatedAt: validTimestamp(item.last_updated_at, nowTs),
                                refreshFailed: false,
                                symbolResolved: prev.symbolResolved || false
                            };
                        }
                        state.fetchedAt = nowTs;
                    }
                } else {
                    sidefy.log("CoinGecko API request failed; using cached coin state");
                }
            } catch (fetchErr) {
                sidefy.log("CoinGecko API request failed: " + fetchErr.message);
            }
        }

        // Resolve placeholder symbols (id uppercased) once
        for (var s = 0; s < tokens.length; s++) {
            var coinForSymbol = state.coins[tokens[s]];
            if (!needFetch || !coinForSymbol || coinForSymbol.symbolResolved || coinForSymbol.symbol !== tokens[s].toUpperCase()) {
                continue;
            }
            try {
                var coinUrl = "https://api.coingecko.com/api/v3/coins/" + encodeURIComponent(tokens[s]);
                var coinResponse = sidefy.http.get(coinUrl, headers);
                if (coinResponse) {
                    var coinInfo = typeof coinResponse === "string" ? JSON.parse(coinResponse) : coinResponse;
                    if (coinInfo && coinInfo.symbol) {
                        coinForSymbol.symbol = String(coinInfo.symbol).toUpperCase();
                        coinForSymbol.symbolResolved = true;
                    }
                }
            } catch (symbolErr) {
                sidefy.log("Failed to fetch symbol for " + tokens[s] + ": " + symbolErr.message);
            }
        }

        state.tokens = tokens.slice();

        var eventDate = new Date(now);
        eventDate.setHours(0, 0, 0, 0);

        tokens.forEach(function (tokenKey) {
            var coin = state.coins[tokenKey];
            if (!coin || finiteNumber(coin.price) === null || Number(coin.price) < 0) {
                sidefy.log("Token data not found: " + tokenKey);
                return;
            }

            var price = Number(coin.price);
            var change24h = finiteNumber(coin.change24h);
            var updatedAt = finiteNumber(coin.updatedAt);
            var stale = coin.refreshFailed || !updatedAt || nowTs - updatedAt >= intervalMinutes * 60000;
            var notes = sidefy.i18n(I18N_UPDATED_LABEL) +
                (updatedAt ? formatTimestamp(updatedAt) : sidefy.i18n(I18N_UNKNOWN));
            if (stale) notes += "\n" + sidefy.i18n(I18N_STALE_NOTE);

            var color = "#4285f4";
            var changeText = "";
            if (change24h === null) {
                changeText = sidefy.i18n(I18N_UNKNOWN);
            } else if (change24h > 0) {
                color = "#34a853";
                changeText = "↗ +" + change24h.toFixed(2) + "%";
            } else if (change24h < 0) {
                color = "#ea4335";
                changeText = "↘ " + change24h.toFixed(2) + "%";
            } else {
                changeText = "→ 0.00%";
            }

            var symbol = coin.symbol || tokenKey.toUpperCase();
            var title = symbol + " $" + formatPrice(price) + " " + changeText + " (" + CHANGE_WINDOW + ")";
            var href = "https://www.coingecko.com/en/coins/" + tokenKey;

            var alerts = [];
            var alertBelow = thresholdNumber(config[tokenKey + "_alert_below"]);
            var alertAbove = thresholdNumber(config[tokenKey + "_alert_above"]);
            var alertChangePct = thresholdNumber(config[tokenKey + "_alert_change_pct"]);

            if (alertBelow !== null && price < Number(alertBelow)) {
                alerts.push({ type: "below", threshold: Number(alertBelow) });
            }
            if (alertAbove !== null && price > Number(alertAbove)) {
                alerts.push({ type: "above", threshold: Number(alertAbove) });
            }
            if (alertChangePct !== null && change24h !== null && Math.abs(change24h) > Number(alertChangePct)) {
                alerts.push({ type: "change_pct", threshold: Number(alertChangePct) });
            }

            if (alerts.length > 0) {
                color = "#ff6d01";
                var alertTexts = [];
                for (var t = 0; t < alerts.length; t++) {
                    var at = alerts[t];
                    if (at.type === "below") {
                        alertTexts.push("< $" + at.threshold);
                    } else if (at.type === "above") {
                        alertTexts.push("> $" + at.threshold);
                    } else if (at.type === "change_pct") {
                        alertTexts.push("|Δ| > " + at.threshold + "%");
                    }
                }
                title = "[" + sidefy.i18n(I18N_ALERT) + "] " + title + " (" + alertTexts.join(", ") + ")";
            }

            if (stale) title = "[" + sidefy.i18n(I18N_STALE) + "] " + title;

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

        sidefy.storage.set(STORAGE_KEY, state);
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

function finiteNumber(value) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && !value.trim()) return null;
    var number = Number(value);
    return isFinite(number) ? number : null;
}

function thresholdNumber(value) {
    var number = finiteNumber(value);
    return number !== null && number >= 0 ? number : null;
}

function validTimestamp(seconds, nowTs) {
    var value = finiteNumber(seconds);
    return value !== null && value > 0 && value * 1000 <= nowTs ? value * 1000 : null;
}

function formatPrice(price) {
    if (price === 0) return "0.00";
    if (price >= 1) return price.toFixed(2);
    return price.toPrecision(4).replace(/(\.\d*?[1-9])0+(?=e|$)|\.0+(?=e|$)/g, "$1");
}

function formatTimestamp(timestamp) {
    var date = new Date(timestamp);
    function pad(value) { return String(value).padStart(2, "0"); }
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
        " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
}

var I18N_ALERT = { zh: "提醒", en: "ALERT", ja: "アラート", ko: "알림" };
var I18N_UNKNOWN = { zh: "暂无数据", en: "Unavailable", ja: "データなし", ko: "데이터 없음" };
var I18N_STALE = { zh: "非实时", en: "STALE", ja: "未更新", ko: "갱신 지연" };
var I18N_STALE_NOTE = {
    zh: "数据已过期、更新失败或更新时间未知；价格及提醒仅供参考。",
    en: "Data is outdated, refresh failed, or update time is unknown; prices and alerts may be stale.",
    ja: "データが古い、更新に失敗した、または更新時刻が不明です。価格とアラートは参考情報です。",
    ko: "데이터가 오래되었거나 갱신에 실패했거나 갱신 시간이 없습니다. 가격과 알림은 참고용입니다."
};
