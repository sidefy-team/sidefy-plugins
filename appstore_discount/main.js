/**
 * AppStore 折扣监听插件
 * 监控 App Store 应用的价格变化,并在时间线中显示打折应用。
 */
function fetchEvents(config) {
    var appList = resolveAppList(config);

    // --- 缓存逻辑 ---
    // 在缓存键中加入日期,确保跨天后缓存自动失效
    var today = new Date();
    var dateKey = today.getFullYear() + "" +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0');
    var configKey = appList.map(function (app) {
        return app.appId + "_" + app.region + "_" + app.originalPrice;
    }).join(",");
    var cacheKey = "appstore_discount_v9_" + configKey.replace(/[,\s]/g, '_').substring(0, 50) + "_" + dateKey;

    var cachedData = sidefy.storage.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // --- AppStore 折扣检查逻辑 ---
    var events = [];
    try {
        // 检查每个应用的价格
        var discountedApps = [];

        for (var i = 0; i < appList.length; i++) {
            var app = appList[i];
            try {
                // 获取应用信息
                var appUrl = "https://itunes.apple.com/lookup?id=" + app.appId + "&country=" + app.region;
                var appResponse = sidefy.http.get(appUrl);

                if (!appResponse) {
                    continue;
                }

                var apiData = JSON.parse(appResponse);

                if (!apiData.results || apiData.results.length === 0) {
                    continue;
                }

                var appInfo = apiData.results[0];
                var currentPrice = appInfo.formattedPrice || appInfo.price;
                var currentPriceValue = parseFloat(appInfo.price) || 0;

                // 如果是免费应用,跳过
                if (currentPriceValue === 0) {
                    continue;
                }

                // 检查价格是否低于用户配置的原价
                var originalPriceValue = app.originalPrice;

                if (currentPriceValue < originalPriceValue) {
                    // 价格下降,计算折扣
                    var discountPercent = Math.round((1 - currentPriceValue / originalPriceValue) * 100);

                    // 格式化原价 - 从当前价格中提取货币符号并应用到原价
                    var originalPriceFormatted = formatPrice(originalPriceValue, currentPrice, appInfo.currency);

                    // 选择图片：优先使用截图，没有截图则使用图标
                    var imageUrl = null;
                    var appIcon = null;
                    var screenshots = appInfo.screenshotUrls || [];
                    if (screenshots.length > 0) {
                        // 随机选择一张截图
                        imageUrl = screenshots[Math.floor(Math.random() * screenshots.length)];
                    } else {
                        // 使用应用图标作为后备
                        imageUrl = appInfo.artworkUrl512 || appInfo.artworkUrl100;
                    }

                    // 获取应用图标，优先使用最小的图标
                    if (appInfo.artworkUrl60) {
                        appIcon = appInfo.artworkUrl60;
                    } else if (appInfo.artworkUrl100) {
                        appIcon = appInfo.artworkUrl100;
                    } else if (appInfo.artworkUrl512) {
                        appIcon = appInfo.artworkUrl512;
                    }

                    discountedApps.push({
                        appId: appInfo.trackId,
                        name: appInfo.trackName,
                        currentPrice: currentPrice,
                        originalPrice: originalPriceFormatted,
                        discountPercent: discountPercent,
                        imageUrl: imageUrl,
                        appIcon: appIcon,
                        storeUrl: appInfo.trackViewUrl,
                        region: app.region
                    });
                }

                // 添加延迟避免请求过快
                if (i < appList.length - 1) {
                    var start = new Date().getTime();
                    while (new Date().getTime() < start + 100) {
                        // 等待100ms
                    }
                }

            } catch (appErr) {
                continue;
            }
        }

        // 创建折扣时间线事件
        if (discountedApps.length > 0) {
            for (var j = 0; j < discountedApps.length; j++) {
                var app = discountedApps[j];

                // 设置为当天的全天事件
                var eventDate = new Date();
                eventDate.setHours(0, 0, 0, 0);
                var timestamp = eventDate.getTime() / 1000;

                var discountColor = getDiscountColor(app.discountPercent);
                var notes = i18nDiscountNotes(app.originalPrice, app.currentPrice, app.discountPercent, app.region);

                var appEvent = {
                    title: app.name + " (-" + app.discountPercent + "%)",
                    startDate: sidefy.date.format(timestamp),
                    endDate: sidefy.date.format(timestamp),
                    color: discountColor,
                    notes: notes,
                    icon: app.appIcon,
                    href: app.storeUrl,
                    imageURL: app.imageUrl,
                    isAllDay: true,
                    isPointInTime: true
                };

                events.push(appEvent);
            }
        }

        // 缓存结果 (30分钟)
        if (events.length > 0) {
            sidefy.storage.set(cacheKey, events, 30);
        }

    } catch (err) {
        throw new Error(i18nExecutionFailed(err.message));
    }

    return events;
}

/**
 * 格式化价格 - 从示例价格中提取货币符号和格式
 * @param {number} priceValue - 价格数值
 * @param {string} sampleFormatted - 示例格式化价格 (如 "¥68.00" 或 "$9.99")
 * @param {string} currency - 货币代码 (如 "CNY", "USD")
 * @returns {string} 格式化后的价格
 */
function formatPrice(priceValue, sampleFormatted, currency) {
    // 从示例价格中提取货币符号的位置和格式
    var numStr = priceValue.toFixed(2);

    if (!sampleFormatted) {
        return numStr;
    }

    // 提取数字部分
    var sampleNumStr = sampleFormatted.replace(/[^0-9.]/g, '');
    var sampleNum = parseFloat(sampleNumStr);

    if (isNaN(sampleNum)) {
        return numStr;
    }

    // 检查货币符号在前面还是后面
    var currencySymbolBefore = sampleFormatted.indexOf(sampleNumStr) > 0;

    // 提取货币符号
    var currencySymbol = sampleFormatted.replace(/[0-9.,\s]/g, '');

    if (currencySymbolBefore) {
        // 货币符号在前面，如 "¥68.00", "$9.99"
        return currencySymbol + numStr;
    } else {
        // 货币符号在后面，如 "68.00€"
        return numStr + currencySymbol;
    }
}

/**
 * 从配置中解析应用监控列表（与 Crypto Price Monitor 相同的 apps + {id}_* 模式）
 */
function resolveAppList(config) {
    var defaultRegion = (config.default_region || "us").trim().toLowerCase();
    var appEntries = [];

    if (config.apps && typeof config.apps === "string") {
        appEntries = config.apps.split(",").map(function (entry) {
            return entry.trim();
        }).filter(function (entry) {
            return entry !== "";
        });
    }

    if (appEntries.length === 0) {
        throw new Error(sidefy.i18n(I18N_APPS_EMPTY));
    }

    var result = [];
    var missingPrice = [];

    for (var i = 0; i < appEntries.length; i++) {
        var appId = extractAppId(appEntries[i]);
        if (!appId) {
            sidefy.log("Invalid app entry: " + appEntries[i]);
            continue;
        }

        var regionRaw = config[appId + "_region"];
        var region = defaultRegion;
        if (regionRaw !== undefined && regionRaw !== null && String(regionRaw).trim() !== "") {
            region = String(regionRaw).trim().toLowerCase();
        }

        var originalPrice = Number(config[appId + "_original_price"]);
        if (isNaN(originalPrice) || originalPrice <= 0) {
            missingPrice.push(appId);
            continue;
        }

        result.push({
            appId: appId,
            region: region,
            originalPrice: originalPrice
        });
    }

    if (result.length === 0) {
        var hint = missingPrice.length > 0
            ? missingPrice.map(function (id) { return id + "_original_price"; }).join(", ")
            : "";
        throw new Error(i18nNoValidAppConfig(hint));
    }

    if (missingPrice.length > 0) {
        sidefy.log("Skipped apps missing original_price: " + missingPrice.join(", "));
    }

    return result;
}

function extractAppId(entry) {
    var urlMatch = entry.match(/\/id(\d+)/i);
    if (urlMatch) {
        return urlMatch[1];
    }
    if (/^\d+$/.test(entry)) {
        return entry;
    }
    return null;
}

/**
 * 根据折扣百分比获取对应的颜色
 */
function getDiscountColor(discountPercent) {
    if (discountPercent >= 75) {
        return "#E74C3C"; // 深红色 - 超大折扣
    } else if (discountPercent >= 50) {
        return "#E67E22"; // 橙色 - 大折扣
    } else if (discountPercent >= 25) {
        return "#F39C12"; // 黄色 - 中等折扣
    } else {
        return "#3498DB"; // 蓝色 - 小折扣
    }
}

// --- i18n ---

var I18N_APPS_EMPTY = {
    zh: "apps 不能为空。填写逗号分隔的 App Store 应用 ID，并为每个应用手动添加 {appId}_original_price 配置项。",
    en: "apps cannot be empty. Set comma-separated App Store app IDs, and manually add {appId}_original_price for each app.",
    ja: "apps を入力してください。App Store ID をカンマ区切りで指定し、各アプリに {appId}_original_price を追加してください。",
    ko: "apps를 입력하세요. App Store ID를 쉼표로 구분하고 각 앱에 {appId}_original_price를 추가하세요."
};

function i18nDiscountNotes(originalPrice, currentPrice, discountPercent, region) {
    var regionUpper = region.toUpperCase();
    return sidefy.i18n({
        zh: "原价: " + originalPrice + "\n现价: " + currentPrice + "\n折扣: -" + discountPercent + "%\n区域: " + regionUpper,
        en: "Original Price: " + originalPrice + "\nCurrent Price: " + currentPrice + "\nDiscount: -" + discountPercent + "%\nRegion: " + regionUpper,
        ja: "元の価格: " + originalPrice + "\n現在の価格: " + currentPrice + "\n割引: -" + discountPercent + "%\n地域: " + regionUpper,
        ko: "원가: " + originalPrice + "\n현재 가격: " + currentPrice + "\n할인: -" + discountPercent + "%\n지역: " + regionUpper
    });
}

function i18nExecutionFailed(message) {
    return sidefy.i18n({
        zh: "AppStore 折扣插件执行失败: " + message,
        en: "AppStore Discount plugin execution failed: " + message,
        ja: "AppStore 割引プラグインの実行に失敗しました: " + message,
        ko: "AppStore 할인 플러그인 실행 실패: " + message
    });
}

function i18nNoValidAppConfig(hint) {
    return sidefy.i18n({
        zh: "没有有效的应用配置。请为每个应用手动添加参考价配置项，例如：" + hint,
        en: "No valid app configuration. Manually add reference price keys for each app, e.g. " + hint,
        ja: "有効なアプリ設定がありません。各アプリに参考価格キーを追加してください。例: " + hint,
        ko: "유효한 앱 설정이 없습니다. 각 앱에 참고 가격 키를 추가하세요, 예: " + hint
    });
}
