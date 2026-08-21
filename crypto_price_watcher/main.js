// Crypto Price Monitor - fetches price data via CoinGecko API
var STORAGE_KEY = "crypto_watcher_state";
var CHANGE_WINDOW = "24h";

function fetchEvents(config) {
    var events = [];

    try {
        var tokens = [];
        var seen = {};
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

        // One JSON: { fetchedAt, tokens, coins: { id: { symbol, price, change24h, updatedAt, cooldowns? } } }
        var state = { fetchedAt: 0, tokens: [], coins: {} };
        var raw = sidefy.storage.get(STORAGE_KEY);
        if (raw) {
            try {
                if (typeof raw === "string") {
                    raw = JSON.parse(raw);
                }
                if (raw && typeof raw === "object") {
                    state.fetchedAt = Number(raw.fetchedAt) || 0;
                    state.tokens = Array.isArray(raw.tokens) ? raw.tokens : [];
                    state.coins = raw.coins && typeof raw.coins === "object" ? raw.coins : {};
                }
            } catch (e) {
                state = { fetchedAt: 0, tokens: [], coins: {} };
            }
        }

        // Drop coins no longer in config
        Object.keys(state.coins).forEach(function (id) {
            if (tokens.indexOf(id) === -1) {
                delete state.coins[id];
            }
        });

        var needFetch = !(state.fetchedAt > 0 && (nowTs - state.fetchedAt < intervalMinutes * 60000));
        if (!needFetch) {
            for (var i = 0; i < tokens.length; i++) {
                if (!state.coins[tokens[i]]) {
                    needFetch = true;
                    break;
                }
            }
        }

        if (needFetch) {
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
                            if (!item || item.usd === undefined || item.usd === null) {
                                continue;
                            }
                            var prev = state.coins[id] || {};
                            state.coins[id] = {
                                symbol: prev.symbol || id.toUpperCase(),
                                price: Number(item.usd),
                                change24h: Number(item.usd_24h_change) || 0,
                                updatedAt: item.last_updated_at ? Number(item.last_updated_at) * 1000 : nowTs,
                                cooldowns: prev.cooldowns
                            };
                            if (!state.coins[id].cooldowns) {
                                delete state.coins[id].cooldowns;
                            }
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
            if (!coinForSymbol || coinForSymbol.symbol !== tokens[s].toUpperCase()) {
                continue;
            }
            try {
                var coinUrl = "https://api.coingecko.com/api/v3/coins/" + encodeURIComponent(tokens[s]);
                var coinResponse = sidefy.http.get(coinUrl, headers);
                if (coinResponse) {
                    var coinInfo = typeof coinResponse === "string" ? JSON.parse(coinResponse) : coinResponse;
                    if (coinInfo && coinInfo.symbol) {
                        coinForSymbol.symbol = String(coinInfo.symbol).toUpperCase();
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
            if (!coin || coin.price === undefined || coin.price === null) {
                sidefy.log("Token data not found: " + tokenKey);
                return;
            }

            var price = coin.price;
            var change24h = coin.change24h || 0;
            var lastUpdated = coin.updatedAt ? new Date(coin.updatedAt) : now;
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

            var symbol = coin.symbol || tokenKey.toUpperCase();
            var title = symbol + " $" + price.toFixed(6) + " " + changeText + " (" + CHANGE_WINDOW + ")";
            var href = "https://www.coingecko.com/en/coins/" + tokenKey;

            var alerts = [];
            var alertBelow = config[tokenKey + "_alert_below"];
            var alertAbove = config[tokenKey + "_alert_above"];
            var alertChangePct = config[tokenKey + "_alert_change_pct"];

            if (alertBelow !== undefined && !isNaN(Number(alertBelow)) && price < Number(alertBelow)) {
                alerts.push({ type: "below", threshold: Number(alertBelow) });
            }
            if (alertAbove !== undefined && !isNaN(Number(alertAbove)) && price > Number(alertAbove)) {
                alerts.push({ type: "above", threshold: Number(alertAbove) });
            }
            if (alertChangePct !== undefined && !isNaN(Number(alertChangePct)) && Math.abs(change24h) > Number(alertChangePct)) {
                alerts.push({ type: "change_pct", threshold: Number(alertChangePct) });
            }

            if (alerts.length > 0 && cooldownHours > 0) {
                var cooldowns = coin.cooldowns || {};
                var activeAlerts = [];
                var updatedCooldowns = {};

                for (var a = 0; a < alerts.length; a++) {
                    var alertItem = alerts[a];
                    var lastTrigger = cooldowns[alertItem.type] || 0;
                    if (nowTs - lastTrigger > cooldownHours * 3600000) {
                        activeAlerts.push(alertItem);
                        updatedCooldowns[alertItem.type] = nowTs;
                    }
                }

                Object.keys(cooldowns).forEach(function (key) {
                    if (!updatedCooldowns[key] && (nowTs - cooldowns[key] <= cooldownHours * 3600000)) {
                        updatedCooldowns[key] = cooldowns[key];
                    }
                });

                if (Object.keys(updatedCooldowns).length > 0) {
                    coin.cooldowns = updatedCooldowns;
                } else {
                    delete coin.cooldowns;
                }
                alerts = activeAlerts;
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
