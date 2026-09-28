/**
 * V2EX 未读提醒插件
 * 解析 V2EX 私有 Atom Feed 并在时间线中显示提醒。
 */
function fetchEvents(config) {
    var token = config.token;
    if (!token || token.trim() === "") {
        throw new Error(sidefy.i18n(I18N_ERROR_TOKEN));
    }

    var rssUrl = "https://www.v2ex.com/n/" + token.trim() + ".xml";

    // 生成包含日期的缓存键
    var now = new Date();
    var dateKey = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
    var cacheKey = "v2ex_notifications_" + hashString(token) + "_" + dateKey;

    // 先读取当天的缓存数据
    var cachedEvents = sidefy.storage.get(cacheKey) || [];

    var newEvents = [];
    try {
        var response = sidefy.http.get(rssUrl);
        if (!response) {
            throw new Error(sidefy.i18n(I18N_ERROR_FETCH));
        }

        // Parse Atom entries
        var entries = response.match(/<entry>[\s\S]*?<\/entry>/g);
        if (entries) {
            entries.forEach(function (entry) {
                var title = extractTagContent(entry, "title");
                var link = extractTagAttribute(entry, "link", "href");
                var entryId = extractTagContent(entry, "id");
                var published = extractTagContent(entry, "published");
                var contentRaw = extractTagContent(entry, "content").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
                var authorName = extractTagContent(entry, "name", "<author>", "<\/author>");

                var type = detectType(title, contentRaw, link);
                var color = getTypeColor(type);

                // Construct a meaningful title if the original is empty
                var displayTitle = title;
                if (!displayTitle) {
                    var fallbackAuthor = authorName || sidefy.i18n(I18N_SOMEONE);
                    // detectType() only returns thanks/reward/favorite for an empty title, and
                    // its own catch-all is "thanks" — so the last arm is the total fallback.
                    if (type.id === "reward") {
                        displayTitle = i18nRewardTitle(fallbackAuthor);
                    } else if (type.id === "favorite") {
                        displayTitle = i18nFavoriteTitle(fallbackAuthor);
                    } else {
                        displayTitle = i18nThanksTitle(fallbackAuthor);
                    }
                }

                var pubDate = new Date(published);
                var startDate = sidefy.date.format(pubDate.getTime() / 1000);
                var endDate = sidefy.date.format((pubDate.getTime() + 30 * 60 * 1000) / 1000);

                newEvents.push({
                    id: buildEventId(entryId, published, link, authorName),
                    title: displayTitle,
                    startDate: startDate,
                    endDate: endDate,
                    color: color,
                    notes: type.id === "favorite" ? null : cleanContent(contentRaw),
                    icon: "https://www.v2ex.com/static/favicon.ico",
                    isAllDay: false,
                    isPointInTime: true,
                    href: link
                });
            });
        }

        // 合并缓存数据和新数据,去重
        var mergedEvents = mergeAndDeduplicateEvents(cachedEvents, newEvents);

        // 计算到今天结束的剩余毫秒数
        var endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        var remainingMs = endOfDay.getTime() - now.getTime();
        var ttlMinutes = Math.ceil(remainingMs / (60 * 1000));
        ttlMinutes = Math.max(ttlMinutes, 5);
        ttlMinutes = Math.min(ttlMinutes, 1440);

        sidefy.storage.set(cacheKey, mergedEvents, ttlMinutes);

        return mergedEvents;
    } catch (err) {
        sidefy.log("V2EX plugin error: " + err.message);
        // 如果请求失败但有缓存,返回缓存数据
        if (cachedEvents.length > 0) {
            return cachedEvents;
        }
        throw err;
    }
}

/**
 * 合并并去重事件
 * 使用 Atom entry id + published 作为唯一标识
 */
function mergeAndDeduplicateEvents(cachedEvents, newEvents) {
    var eventMap = {};

    // 先添加缓存的事件
    cachedEvents.forEach(function (event) {
        var eventId = getEventUniqueId(event);
        if (eventId) {
            eventMap[eventId] = event;
        }
    });

    // 添加或更新新事件
    newEvents.forEach(function (event) {
        var eventId = getEventUniqueId(event);
        if (eventId) {
            eventMap[eventId] = event;
        }
    });

    // 转换回数组并按时间排序(最新的在前)
    var mergedArray = [];
    for (var key in eventMap) {
        if (eventMap.hasOwnProperty(key)) {
            mergedArray.push(eventMap[key]);
        }
    }

    // 按 startDate 降序排序
    mergedArray.sort(function (a, b) {
        return b.startDate.localeCompare(a.startDate);
    });

    return mergedArray;
}

function getEventUniqueId(event) {
    if (!event) return "";
    return event.id || buildFallbackEventId(event.href, event.startDate, event.title);
}

function buildEventId(entryId, published, href, suffix) {
    if (entryId || published) {
        return [entryId || "", published || ""].join("|");
    }
    return buildFallbackEventId(href, published, suffix);
}

function buildFallbackEventId(href, published, suffix) {
    return [href || "", published || "", suffix || ""].join("|");
}


/**
 * 根据标题和内容检测通知类型
 * 基于 V2EX RSS 样例:
 * - 回复/提及: 标题不为空
 * - 点赞 (感谢): 标题为空, 内容不为空
 * - 打赏: 标题为空, 内容为空, 且链接为 token 形式
 * - 收藏: 标题为空, 内容为空, 且链接为主题链接
 */
function detectType(title, content, link) {
    if (!title || title.trim() === "") {
        // If title is empty, check content first.
        var cleanTxt = cleanContent(content);
        if (cleanTxt && cleanTxt.length > 0) {
            return { id: "thanks" };
        }

        // Empty title/content + token-style link is treated as reward.
        // Example: https://www.v2ex.com2GcVra...
        var lowerLink = (link || "").toLowerCase();
        if (isTokenStyleV2exLink(lowerLink)) {
            return { id: "reward" };
        }

        // Empty title/content + topic link is usually "favorite".
        if (lowerLink.indexOf("/t/") !== -1 || lowerLink.indexOf("/topic/") !== -1) {
            return { id: "favorite" };
        }

        // Opaque/non-topic links with empty title/content are usually thanks/reward notifications.
        return { id: "thanks" };
    }

    var text = title.toLowerCase();
    if (text.indexOf("回复了你") !== -1 || text.indexOf("回复了") !== -1) {
        return { id: "reply" };
    }
    if (text.indexOf("感谢了你") !== -1 || text.indexOf("感谢了") !== -1) {
        return { id: "thanks" };
    }
    if (text.indexOf("提到你") !== -1 || text.indexOf("提到了你") !== -1) {
        return { id: "mention" };
    }
    if (text.indexOf("收藏了") !== -1) {
        return { id: "favorite" };
    }
    return { id: "other" };
}

/**
 * 获取通知类型的对应颜色
 */
function getTypeColor(type) {
    var colors = {
        "reply": "#4ECDC4",    // 青色
        "thanks": "#FFD93D",   // 金色
        "reward": "#8E44AD",   // 紫色
        "mention": "#FF6B6B",  // 红色
        "favorite": "#FF8B13", // 橙色
        "other": "#95A5A6"     // 灰色
    };
    return colors[type.id] || colors.other;
}

/**
 * 判断是否为 V2EX 的 token 形式链接（域名后没有 "/"）
 * 例如: https://www.v2ex.com2GcVra...
 */
function isTokenStyleV2exLink(link) {
    if (!link) return false;
    return /^https:\/\/www\.v2ex\.com[^\/].+/.test(link);
}

/**
 * 提取 XML 标签内容
 */
function extractTagContent(xml, tag, startBoundary, endBoundary) {
    var searchArea = xml;
    if (startBoundary && endBoundary) {
        var boundaryRegex = new RegExp(startBoundary + "([\\s\\S]*?)" + endBoundary);
        var match = xml.match(boundaryRegex);
        if (match) searchArea = match[1];
        else return "";
    }

    var tagRegex = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">");
    var match = searchArea.match(tagRegex);
    return match ? match[1].trim() : "";
}

/**
 * 提取 XML 标签属性值
 */
function extractTagAttribute(xml, tag, attr) {
    var tagRegex = new RegExp("<" + tag + "[^>]*" + attr + "=['\"]([^'\"]*)['\"][^>]*>");
    var match = xml.match(tagRegex);
    return match ? match[1] : "";
}

/**
 * 清理 HTML 内容以用于备注
 */
function cleanContent(content) {
    if (!content) return "";
    // Remove HTML tags
    var text = content.replace(/<[^>]*>/g, " ");
    // Unescape common entities
    text = text.replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    // Clean whitespace
    return text.trim().replace(/\s+/g, " ");
}

/**
 * 简单的字符串哈希，用于生成缓存键
 */
function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}

// --- i18n ---

var I18N_SOMEONE = {
    zh: "有人",
    en: "Someone",
    ja: "誰か",
    ko: "익명의 사용자"
};

var I18N_ERROR_TOKEN = {
    zh: "请配置您的 V2EX 私有 RSS Token。",
    en: "Please configure your V2EX private RSS token.",
    ja: "V2EX のプライベート RSS トークンを設定してください。",
    ko: "V2EX 개인 RSS 토큰을 설정해 주세요."
};

var I18N_ERROR_FETCH = {
    zh: "获取 V2EX RSS 订阅失败。",
    en: "Failed to fetch the V2EX RSS feed.",
    ja: "V2EX RSS フィードの取得に失敗しました。",
    ko: "V2EX RSS 피드를 가져오지 못했습니다."
};

function i18nThanksTitle(author) {
    return sidefy.i18n({
        zh: author + " 感谢了你的回复",
        en: author + " thanked your reply",
        ja: author + " があなたの返信に感謝しました",
        ko: author + "님이 회원님의 답글에 감사를 표했습니다"
    });
}

function i18nRewardTitle(author) {
    return sidefy.i18n({
        zh: author + " 打赏了你",
        en: author + " rewarded you",
        ja: author + " があなたに投げ銭しました",
        ko: author + "님이 회원님에게 후원했습니다"
    });
}

function i18nFavoriteTitle(author) {
    return sidefy.i18n({
        zh: author + " 收藏了你的主题",
        en: author + " favorited your topic",
        ja: author + " があなたのトピックをお気に入りに追加しました",
        ko: author + "님이 회원님의 게시글을 즐겨찾기에 추가했습니다"
    });
}
