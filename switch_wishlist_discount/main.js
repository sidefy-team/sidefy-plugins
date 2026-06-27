/**
 * Switch 多区打折监控插件
 */
function fetchEvents(config) {
    var gameIds = config.game_ids;
    var regionsRaw = config.regions || "JP,US,CA,MX,BR,GB,DE,FR,AU";

    if (!gameIds || gameIds.trim() === "") {
        throw new Error(sidefy.i18n(I18N_ERROR_EMPTY_GAME_IDS));
    }

    if (!sidefy.http || !sidefy.http.get) {
        sidefy.log("Network permission is required for this plugin.");
        return [];
    }

    var cleanedIdsArray = gameIds
        .split(",")
        .map(function (id) {
            return id.trim().replace(/^[A-Z]/i, "");
        })
        .filter(function (id) {
            return id !== "";
        })
        .slice(0, 20);

    if (cleanedIdsArray.length === 0) {
        throw new Error(sidefy.i18n(I18N_ERROR_NO_VALID_NSUID));
    }

    var regionCodes = regionsRaw
        .split(",")
        .map(function (code) {
            return code.trim().toUpperCase();
        })
        .filter(function (code) {
            return REGION_PROFILES[code];
        });

    if (regionCodes.length === 0) {
        regionCodes = ["JP", "US", "CA", "MX", "BR", "GB", "DE", "FR", "AU"];
    }

    var cleanedIds = cleanedIdsArray.join(",");
    var today = new Date();
    var dateKey = today.getFullYear() + "" +
        String(today.getMonth() + 1).padStart(2, "0") +
        String(today.getDate()).padStart(2, "0");
    var cacheKey = "switch_wishlist_multi_v5_" + regionCodes.join("-") + "_" + cleanedIds + "_" + dateKey;

    if (sidefy.storage && sidefy.storage.get) {
        var cachedData = sidefy.storage.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }
    }

    var events = [];
    var fetchComplete = true;

    try {
        for (var r = 0; r < regionCodes.length; r++) {
            var regionCode = regionCodes[r];
            var profile = REGION_PROFILES[regionCode];
            var regionResult = fetchRegionDiscountEvents(profile, regionCode, cleanedIds);
            if (!regionResult.complete) {
                fetchComplete = false;
            }
            for (var e = 0; e < regionResult.events.length; e++) {
                events.push(regionResult.events[e]);
            }
        }

        if (fetchComplete && events.length > 0 && sidefy.storage && sidefy.storage.set) {
            sidefy.storage.set(cacheKey, events, 120);
        } else if (!fetchComplete) {
            sidefy.log("Switch discount fetch incomplete, skipping cache.");
        }
    } catch (err) {
        throw new Error(i18nExecutionFailed(err.message));
    }

    return events;
}

function fetchRegionDiscountEvents(profile, regionCode, cleanedIds) {
    var events = [];
    var complete = true;
    var priceUrl = "https://api.ec.nintendo.com/v1/price?country=" + profile.country +
        "&ids=" + cleanedIds + "&lang=" + profile.lang;
    var priceResponse = sidefy.http.get(priceUrl);

    if (!priceResponse) {
        sidefy.log("Price fetch failed for region: " + regionCode);
        return { events: events, complete: false };
    }

    var priceData;
    try {
        priceData = JSON.parse(priceResponse);
    } catch (parseErr) {
        sidefy.log("Price parse failed for region: " + regionCode);
        return { events: events, complete: false };
    }

    if (!priceData.prices || priceData.prices.length === 0) {
        return { events: events, complete: false };
    }

    var gameInfoMap = {};
    var eventDate = new Date();
    eventDate.setHours(0, 0, 0, 0);
    var timestamp = eventDate.getTime() / 1000;
    var regionLabel = sidefy.i18n(profile.label);

    for (var i = 0; i < priceData.prices.length; i++) {
        var priceInfo = priceData.prices[i];
        if (!isDiscountedPrice(priceInfo)) {
            continue;
        }

        var titleId = String(priceInfo.title_id);
        if (!gameInfoMap[titleId]) {
            var gameInfo = fetchGameInfo(profile, titleId);
            if (gameInfo) {
                gameInfoMap[titleId] = gameInfo;
            } else {
                complete = false;
                sidefy.log("Game info fetch failed for region " + regionCode + ", game: " + titleId);
            }
        }

        var gameMeta = gameInfoMap[titleId];
        if (!gameMeta) {
            continue;
        }

        var regularPrice = parseFloat(priceInfo.regular_price.raw_value);
        var discountPrice = parseFloat(priceInfo.discount_price.raw_value);
        var discountPercent = Math.round((1 - discountPrice / regularPrice) * 100);
        var notes = i18nDiscountNotes(
            regionLabel,
            priceInfo.regular_price.amount,
            priceInfo.discount_price.amount,
            discountPercent
        );

        if (gameMeta.device) {
            notes += "\n" + i18nCompatibleDevice(gameMeta.device);
        }

        events.push({
            title: "[" + regionLabel + "] " + gameMeta.name + " (-" + discountPercent + "%)",
            startDate: sidefy.date.format(timestamp),
            endDate: sidefy.date.format(timestamp),
            color: getDiscountColor(discountPercent),
            notes: notes,
            icon: profile.icon,
            href: gameMeta.url,
            imageURL: gameMeta.image,
            isAllDay: true,
            isPointInTime: true
        });
    }

    return { events: events, complete: complete };
}

function isDiscountedPrice(priceInfo) {
    if (priceInfo.sales_status === "not_found") {
        return false;
    }
    if (!priceInfo.discount_price || !priceInfo.regular_price) {
        return false;
    }
    return true;
}

function fetchGameInfo(profile, gameId) {
    try {
        if (profile.storeType === "jp") {
            return fetchJapanGameInfo(gameId);
        }
        if (profile.storeType === "eu") {
            return fetchEcNintendoGameInfo(profile, gameId);
        }
        return fetchNoaGameInfo(profile, gameId);
    } catch (err) {
        return null;
    }
}

function fetchJapanGameInfo(gameId) {
    var storeUrl = "https://store-jp.nintendo.com/item/software/D" + gameId;
    var searchUrl = "https://search.nintendo.jp/nintendo_soft/search.json?opt_ss=1&limit=1&fq=id:" + gameId;
    var response = sidefy.http.get(searchUrl);
    if (!response) {
        return null;
    }

    var data;
    try {
        data = JSON.parse(response);
    } catch (parseErr) {
        return null;
    }

    if (!data.result || !data.result.items || data.result.items.length === 0) {
        return null;
    }

    var item = data.result.items[0];
    if (!item.title || isInvalidGameTitle(item.title)) {
        return null;
    }

    var image = "";
    if (item.iurl) {
        image = "https://img-eshop.cdn.nintendo.net/i/" + item.iurl + ".jpg";
    }

    return {
        name: item.title,
        image: image,
        device: "",
        url: storeUrl
    };
}

function fetchNoaGameInfo(profile, gameId) {
    var storeUrl = "https://www.nintendo.com/pos-redirect/" + gameId +
        "?l=" + profile.lang + "&c=" + profile.country;
    var storePage = sidefy.http.get(storeUrl);
    if (!storePage) {
        return fetchEcNintendoGameInfo(profile, gameId);
    }

    var gameName = "";
    var schemaMatch = storePage.match(/"@type":\["VideoGame","Product"\],"name":"([^"]+)"/);
    if (schemaMatch && schemaMatch[1]) {
        gameName = schemaMatch[1];
    } else {
        gameName = parseOgTitle(storePage, profile);
    }

    if (!gameName || isInvalidGameTitle(gameName)) {
        return fetchEcNintendoGameInfo(profile, gameId);
    }

    var ogMeta = parseOgMeta(storePage);
    var storeHref = storeUrl;
    var canonicalMatch = storePage.match(/rel="canonical" href="([^"]*)"/);
    if (canonicalMatch && canonicalMatch[1]) {
        storeHref = canonicalMatch[1];
    }

    return {
        name: gameName,
        image: ogMeta.image,
        device: extractDeviceInfo(storePage),
        url: storeHref
    };
}

function fetchEcNintendoGameInfo(profile, gameId) {
    var storeUrl = "https://ec.nintendo.com/" + profile.country + "/" + profile.lang + "/titles/" + gameId;
    var storePage = sidefy.http.get(storeUrl);
    if (!storePage) {
        return null;
    }

    var gameName = parseOgTitle(storePage, profile);
    if (gameName.indexOf(" / ") !== -1) {
        gameName = gameName.split(" / ")[0].trim();
    }

    if (!gameName || isInvalidGameTitle(gameName)) {
        return null;
    }

    var ogMeta = parseOgMeta(storePage);

    return {
        name: gameName,
        image: ogMeta.image,
        device: extractDeviceInfo(storePage),
        url: storeUrl
    };
}

function parseOgTitle(pageHtml, profile) {
    var titleMatch = pageHtml.match(/property="og:title"[^>]*content="([^"]*)"/);
    if (!titleMatch || !titleMatch[1]) {
        return "";
    }
    return cleanStoreGameTitle(titleMatch[1], profile);
}

function parseOgMeta(pageHtml) {
    var image = "";
    var imageMatch = pageHtml.match(/property="og:image"[^>]*content="\s*([^"]*)"/);
    if (imageMatch && imageMatch[1]) {
        image = imageMatch[1].replace(/\s+/g, "");
    }
    return { image: image };
}

function isInvalidGameTitle(title) {
    if (!title || title.trim() === "") {
        return true;
    }
    if (/Games\s*(?:[–\-]|&ndash;)\s*Nintendo Store/i.test(title)) {
        return true;
    }
    if (/404|I AM ERROR|not available|page you requested|見つかりません|ご指定のページ/i.test(title)) {
        return true;
    }
    return false;
}

function cleanStoreGameTitle(rawTitle, profile) {
    if (!rawTitle) {
        return "";
    }

    if (profile.lang === "pt") {
        var brMatch = rawTitle.match(/^(.+?)\s+para Nintendo Switch/i);
        if (brMatch && brMatch[1]) {
            return brMatch[1].trim();
        }
        return rawTitle.replace(/\s*-\s*Site Oficial da Nintendo para Brasil/i, "").trim();
    }

    if (profile.lang === "es") {
        var esMatch = rawTitle.match(/^(.+?)\s+para Nintendo Switch/i);
        if (esMatch && esMatch[1]) {
            return esMatch[1].trim();
        }
        return rawTitle.replace(/\s*-\s*Sitio oficial de Nintendo/i, "").trim();
    }

    if (profile.lang === "de") {
        var deMatch = rawTitle.match(/^(.+?)\s+für Nintendo Switch/i);
        if (deMatch && deMatch[1]) {
            return deMatch[1].trim();
        }
    }

    if (profile.lang === "fr") {
        var frMatch = rawTitle.match(/^(.+?)\s+pour Nintendo Switch/i);
        if (frMatch && frMatch[1]) {
            return frMatch[1].trim();
        }
    }

    var enMatch = rawTitle.match(/^(.+?)\s+for Nintendo Switch/i);
    if (enMatch && enMatch[1]) {
        return enMatch[1].trim();
    }

    return rawTitle
        .replace(/\s*-\s*Nintendo Official Site/i, "")
        .replace(/\s*-\s*Official Nintendo Site/i, "")
        .trim();
}

function extractDeviceInfo(pageHtml) {
    try {
        var switchMatch = pageHtml.match(/"productDetail\.playableHardNotice\.label":\[\{"type":\d+,"value":"Nintendo Switch"\}\]/);
        var switch2Match = pageHtml.match(/"productDetail\.playableHardNotice\.label\.onlySuper":\[\{"type":\d+,"value":"Nintendo Switch 2"\}\]/);
        if (switchMatch && switch2Match) {
            return "Switch/Switch 2";
        } else if (switch2Match) {
            return "Switch 2";
        } else if (switchMatch) {
            return "Switch";
        }

        var hasSwitch2 = pageHtml.indexOf("Nintendo Switch 2") !== -1;
        var hasSwitch = pageHtml.indexOf("Nintendo Switch") !== -1;
        if (hasSwitch2 && hasSwitch) {
            return "Switch/Switch 2";
        } else if (hasSwitch2) {
            return "Switch 2";
        } else if (hasSwitch) {
            return "Switch";
        }
    } catch (err) {
        // ignore
    }
    return "";
}

function getDiscountColor(discountPercent) {
    if (discountPercent >= 75) {
        return "#E74C3C";
    } else if (discountPercent >= 50) {
        return "#E67E22";
    } else if (discountPercent >= 25) {
        return "#F39C12";
    }
    return "#3498DB";
}

// --- i18n ---

var I18N_ERROR_EMPTY_GAME_IDS = {
    zh: "游戏 ID 列表不能为空，请在插件配置中填入要监控的游戏 NSUID。",
    en: "Game ID list cannot be empty. Please enter the game NSUIDs you want to monitor.",
    ja: "ゲーム ID リストを空にすることはできません。監視するゲーム ID を入力してください。",
    ko: "게임 ID 목록은 비워둘 수 없습니다. 모니터링할 게임 NSUID를 입력하세요."
};

var I18N_ERROR_NO_VALID_NSUID = {
    zh: "未找到有效的游戏 NSUID。",
    en: "No valid game NSUIDs found.",
    ja: "有効なゲーム ID が見つかりません。",
    ko: "유효한 게임 NSUID를 찾을 수 없습니다."
};

var I18N_REGION_JP = {
    zh: "日本",
    en: "Japan",
    ja: "日本",
    ko: "일본"
};

var I18N_REGION_US = {
    zh: "美国",
    en: "United States",
    ja: "アメリカ",
    ko: "미국"
};

var I18N_REGION_CA = {
    zh: "加拿大",
    en: "Canada",
    ja: "カナダ",
    ko: "캐나다"
};

var I18N_REGION_MX = {
    zh: "墨西哥",
    en: "Mexico",
    ja: "メキシコ",
    ko: "멕시코"
};

var I18N_REGION_BR = {
    zh: "巴西",
    en: "Brazil",
    ja: "ブラジル",
    ko: "브라질"
};

var I18N_REGION_GB = {
    zh: "英国",
    en: "United Kingdom",
    ja: "イギリス",
    ko: "영국"
};

var I18N_REGION_DE = {
    zh: "德国",
    en: "Germany",
    ja: "ドイツ",
    ko: "독일"
};

var I18N_REGION_FR = {
    zh: "法国",
    en: "France",
    ja: "フランス",
    ko: "프랑스"
};

var I18N_REGION_AU = {
    zh: "澳大利亚",
    en: "Australia",
    ja: "オーストラリア",
    ko: "호주"
};

var REGION_PROFILES = {
    JP: {
        country: "JP",
        lang: "ja",
        storeType: "jp",
        icon: "https://store-jp.nintendo.com/mobify/bundle/1763/static/img/head/favicon.ico",
        label: I18N_REGION_JP
    },
    US: {
        country: "US",
        lang: "en",
        storeType: "noa",
        icon: "https://www.nintendo.com/favicon.ico",
        label: I18N_REGION_US
    },
    CA: {
        country: "CA",
        lang: "en",
        storeType: "noa",
        icon: "https://www.nintendo.com/favicon.ico",
        label: I18N_REGION_CA
    },
    MX: {
        country: "MX",
        lang: "es",
        storeType: "noa",
        icon: "https://www.nintendo.com/favicon.ico",
        label: I18N_REGION_MX
    },
    BR: {
        country: "BR",
        lang: "pt",
        storeType: "noa",
        icon: "https://www.nintendo.com/favicon.ico",
        label: I18N_REGION_BR
    },
    GB: {
        country: "GB",
        lang: "en",
        storeType: "eu",
        icon: "https://www.nintendo.com/favicon.ico",
        label: I18N_REGION_GB
    },
    DE: {
        country: "DE",
        lang: "de",
        storeType: "eu",
        icon: "https://www.nintendo.com/favicon.ico",
        label: I18N_REGION_DE
    },
    FR: {
        country: "FR",
        lang: "fr",
        storeType: "eu",
        icon: "https://www.nintendo.com/favicon.ico",
        label: I18N_REGION_FR
    },
    AU: {
        country: "AU",
        lang: "en",
        storeType: "eu",
        icon: "https://www.nintendo.com/favicon.ico",
        label: I18N_REGION_AU
    }
};

function i18nDiscountNotes(regionLabel, regularAmount, discountAmount, discountPercent) {
    return sidefy.i18n({
        zh: "区域: " + regionLabel + "\n原价: " + regularAmount +
            "\n现价: " + discountAmount + "\n折扣: -" + discountPercent + "%",
        en: "Region: " + regionLabel + "\nOriginal: " + regularAmount +
            "\nCurrent: " + discountAmount + "\nDiscount: -" + discountPercent + "%",
        ja: "地域: " + regionLabel + "\n通常価格: " + regularAmount +
            "\n現在価格: " + discountAmount + "\n割引: -" + discountPercent + "%",
        ko: "지역: " + regionLabel + "\n정가: " + regularAmount +
            "\n현재가: " + discountAmount + "\n할인: -" + discountPercent + "%"
    });
}

function i18nCompatibleDevice(device) {
    return sidefy.i18n({
        zh: "对应本体: " + device,
        en: "Compatible Device: " + device,
        ja: "対応本体: " + device,
        ko: "호환 기기: " + device
    });
}

function i18nExecutionFailed(message) {
    return sidefy.i18n({
        zh: "Switch 多区折扣插件执行失败: " + message,
        en: "Switch multi-region discount plugin failed: " + message,
        ja: "Switch マルチリージョン割引プラグインの実行に失敗しました: " + message,
        ko: "Switch 다지역 할인 플러그인 실행 실패: " + message
    });
}
