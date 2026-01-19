
// FreshRSS Plugin for Sidefy
// Uses Google Reader API to fetch unread articles

function fetchEvents(config) {
    if (!config.url || !config.username || !config.password) {
        throw new Error("Please configure FreshRSS URL, Username, and API Password.");
    }

    // Clean URL
    var baseUrl = config.url.trim().replace(/\/$/, "");
    if (!baseUrl.endsWith("/api/greader.php")) {
        // If user didn't provide the API path, try to append it or assume it's the root
        // But usually user provides the base FreshRSS URL.
        // Let's assume user provides the root url, e.g. https://rss.myserver.com
        // We should append /api/greader.php if not present.
        // However, some users might have FreshRSS in a subfolder.
        // Safe bet: if it doesn't contain greader.php, append it.
        if (baseUrl.indexOf("greader.php") === -1) {
            baseUrl += "/api/greader.php";
        }
    }

    var limit = config.limit || 50;
    var cacheKey = "freshrss_auth_token_" + config.username;
    var articlesCacheKey = "freshrss_articles_" + config.username + "_" + limit + "_" + (config.onlyUnread ? "unread" : "all");

    // Helper to perform login
    function login() {
        // 将参数直接拼接到 URL 后面
        var loginUrl = baseUrl + "/accounts/ClientLogin?Email=" +
            encodeURIComponent(config.username) +
            "&Passwd=" + encodeURIComponent(config.password);

        sidefy.log("[FreshRSS] Logging in to: " + loginUrl.replace(/Passwd=[^&]+/, "Passwd=***"));

        var headers = {
            "User-Agent": "Mozilla/5.0"
        };

        var response = sidefy.http.get(loginUrl, headers);

        if (!response) {
            throw new Error("Login failed (empty response)");
        }

        // Response format is line-based text usually:
        // SID=...
        // LSID=...
        // Auth=...

        var authMatch = response.match(/Auth=([^\s]+)/);
        if (authMatch && authMatch[1]) {
            var token = authMatch[1];
            // Wrap in object for storage just in case
            sidefy.storage.set(cacheKey, { token: token });
            return token;
        } else {
            // Try to see if it returned an error
            if (response.indexOf("Error=") !== -1) {
                throw new Error("FreshRSS Login Error: " + response);
            }

            // Debugging: Show what we actually got
            var debugRes = typeof response === 'string' ? response : JSON.stringify(response);
            if (debugRes.length > 200) debugRes = debugRes.substring(0, 200) + "...";

            throw new Error("Failed to parse Auth token. Response start: " + debugRes);
        }
    }

    // specific fetch function
    function getData(authToken) {
        // API: stream/contents/reading-list 获取所有文章
        // 添加 xt=user/-/state/com.google/read 参数可以排除已读文章
        var feedUrl = baseUrl + "/reader/api/0/stream/contents/reading-list?n=" + limit;

        // 如果配置为只显示未读,则排除已读文章
        if (config.onlyUnread === true) {
            feedUrl += "&xt=user/-/state/com.google/read";
            sidefy.log("[FreshRSS] Only fetching unread articles");
        } else {
            sidefy.log("[FreshRSS] Fetching all recent articles");
        }

        var headers = {
            "Authorization": "GoogleLogin auth=" + authToken
        };

        sidefy.log("[FreshRSS] Fetching articles: " + feedUrl);
        try {
            var response = sidefy.http.get(feedUrl, headers);
            sidefy.log("[FreshRSS] Response length: " + (response ? response.length : 0));

            var parsed = JSON.parse(response);
            sidefy.log("[FreshRSS] Parsed data - items count: " + (parsed.items ? parsed.items.length : 0));

            // 如果没有 items,打印整个响应结构
            if (!parsed.items || parsed.items.length === 0) {
                var debugData = JSON.stringify(parsed).substring(0, 500);
                sidefy.log("[FreshRSS] Response structure: " + debugData);
            }

            return parsed;
        } catch (e) {
            sidefy.log("[FreshRSS] Error fetching data: " + e.message);
            // If 401, sidefy.http.get might throw or return error code depending on impl.
            if (e.message && (e.message.indexOf("401") !== -1 || e.message.indexOf("Unauthorized") !== -1)) {
                return null; // Signal auth failure
            }
            throw e;
        }
    }

    // 先检查文章列表缓存
    var cachedArticles = sidefy.storage.get(articlesCacheKey);
    if (cachedArticles) {
        sidefy.log("[FreshRSS] Using cached articles (" + cachedArticles.length + " items)");
        return cachedArticles;
    }

    var cached = sidefy.storage.get(cacheKey);
    var token = cached ? cached.token : null;
    var data = null;

    if (token) {
        sidefy.log("[FreshRSS] Using cached token");
        try {
            data = getData(token);
        } catch (e) {
            sidefy.log("[FreshRSS] Cached token failed or other error: " + e.message);
            data = null; // Retry login
        }
    }

    if (!data) {
        sidefy.log("[FreshRSS] No cached token or failed, performing login");
        token = login();
        sidefy.log("[FreshRSS] Login successful, token: " + token.substring(0, 20) + "...");
        data = getData(token);
    }

    if (!data || !data.items) {
        sidefy.log("[FreshRSS] No data or no items, returning empty array");
        return [];
    }

    sidefy.log("[FreshRSS] Processing " + data.items.length + " items");

    // Transform to Sidefy Events
    var events = data.items.map(function (item) {
        var publishedTime = item.published * 1000; // API usually returns seconds
        var startDate = new Date(publishedTime);
        var endDate = new Date(publishedTime + 30 * 60 * 1000); // +30 mins

        // 尝试多种方式获取链接
        var link = "";
        if (item.alternate && item.alternate.length > 0 && item.alternate[0].href) {
            link = item.alternate[0].href;
        } else if (item.canonical && item.canonical.length > 0 && item.canonical[0].href) {
            link = item.canonical[0].href;
        } else if (item.origin && item.origin.htmlUrl) {
            link = item.origin.htmlUrl;
        }

        // Clean summary (remove HTML tags for notes if desired, or keep as is)
        // Sidefy notes usually plaintext or simple? Let's strip tags for cleaner view if possible, 
        // but simple impl is just taking content.
        var summary = item.summary ? item.summary.content : "";
        // Simple HTML strip
        var summaryPlain = summary.replace(/<[^>]+>/g, "").substring(0, 200) + (summary.length > 200 ? "..." : "");

        var feedTitle = item.origin ? item.origin.title : "FreshRSS";

        return {
            title: "[" + feedTitle + "] " + item.title,
            startDate: sidefy.date.format(startDate.getTime() / 1000),
            endDate: sidefy.date.format(endDate.getTime() / 1000),
            notes: summaryPlain,
            href: link,
            isAllDay: false,
            isPointInTime: true,
            color: sidefy.color.hash(item.origin.htmlUrl || feedTitle)
        };
    });

    // 缓存文章列表 5 分钟
    sidefy.storage.set(articlesCacheKey, events, { ttl: 5 * 60 * 1000 });
    sidefy.log("[FreshRSS] Cached " + events.length + " articles for 5 minutes");

    return events;
}
