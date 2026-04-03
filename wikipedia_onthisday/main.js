function fetchEvents(config) {
    var lang = String(config.language || "en").trim().toLowerCase() || "en";

    var now = new Date();
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth() + 1).padStart(2, "0");
    var dd = String(now.getDate()).padStart(2, "0");
    var dateKey = yyyy + "-" + mm + "-" + dd;
    var cacheKey = "wikipedia_onthisday_v9_" + lang + "_" + dateKey;

    var cached = sidefy.storage.get(cacheKey);
    if (cached) {
        return cached;
    }

    var endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    var remainingMinutes = Math.ceil((endOfDay.getTime() - now.getTime()) / (1000 * 60));
    if (remainingMinutes < 1) {
        remainingMinutes = 1;
    }

    var url =
        "https://" +
        lang +
        ".wikipedia.org/api/rest_v1/feed/onthisday/selected/" +
        mm +
        "/" +
        dd;

    var response;
    try {
        response = sidefy.http.get(url, {
            "Accept": "application/json",
            "User-Agent": "SidefyPlugins/1.0 (Wikipedia On This Day)"
        });
    } catch (e) {
        throw new Error(
            sidefy.i18n({
                "zh": "请求维基百科失败: " + e.message,
                "en": "Wikipedia request failed: " + e.message
            })
        );
    }

    if (!response) {
        throw new Error(
            sidefy.i18n({
                "zh": "维基百科返回空响应，请检查网络或语言配置。",
                "en": "Empty response from Wikipedia. Check network or language setting."
            })
        );
    }

    var data;
    try {
        data = JSON.parse(response);
    } catch (e) {
        throw new Error(
            sidefy.i18n({
                "zh": "无法解析维基百科 JSON。",
                "en": "Failed to parse Wikipedia JSON."
            })
        );
    }

    var notes = buildSelectedNotes(data);
    var cardTitle = buildCardTitle(mm, dd);
    var popupHtml = buildSelectedHtml(data);
    var href = sidefy.popup.build(cardTitle, popupHtml, "html");

    var eventDate = new Date(now);
    eventDate.setHours(0, 0, 0, 0);

    var events = [
        {
            title: cardTitle,
            startDate: sidefy.date.format(eventDate.getTime() / 1000),
            endDate: sidefy.date.format(eventDate.getTime() / 1000),
            color: "#3366CC",
            notes: notes,
            href: href,
            isAllDay: true,
            isPointInTime: false
        }
    ];

    sidefy.storage.set(cacheKey, events, remainingMinutes);
    return events;
}

function buildCardTitle(mm, dd) {
    var monthDay = mm + "-" + dd;
    return sidefy.i18n({
        "zh": "维基历史上的今天 · " + monthDay,
        "en": "On This Day · " + monthDay
    });
}

function buildSelectedNotes(data) {
    var list = data.selected;
    if (!list || !list.length) {
        return sidefy.i18n({
            "zh": "当日精选暂无数据。",
            "en": "No selected entries for this date."
        });
    }

    var lines = [];
    for (var i = 0; i < list.length; i++) {
        lines.push(selectedLineText(list[i]));
    }

    return lines.join("\n").trim();
}

function buildSelectedHtml(data) {
    var list = data.selected;
    if (!list || !list.length) {
        return "<p>" + escapeHtml(buildSelectedNotes(data)) + "</p>";
    }

    var parts = ["<ul>"];
    for (var i = 0; i < list.length; i++) {
        parts.push(selectedLineHtml(list[i]));
    }
    parts.push("</ul>");
    return parts.join("");
}

function selectedLineText(item) {
    var label = formatItemLabel(item);
    var link = primaryArticleUrl(item);
    if (!link) {
        return "• " + label;
    }
    return "• " + label + "\n  " + link;
}

function popupLinkLabel() {
    return sidefy.i18n({
        "zh": "查看条目",
        "en": "Open article"
    });
}

function selectedLineHtml(item) {
    var label = formatItemLabel(item);
    var link = primaryArticleUrl(item);
    var titleRow = "<div>• " + escapeHtml(label) + "</div>";
    if (!link) {
        return "<li>" + titleRow + "</li>";
    }
    var aStyle = "color:inherit;text-decoration:underline;";
    var action =
        '<a href="' +
        escapeHtml(link) +
        '" style="' +
        aStyle +
        '">' +
        escapeHtml(popupLinkLabel()) +
        "</a>";
    return "<li>" + titleRow + "<div>" + action + "</div></li>";
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatItemLabel(item) {
    var text = (item.text || "").trim();
    var y = item.year;
    if (y !== undefined && y !== null && String(y) !== "") {
        return "(" + y + ") " + text;
    }
    return text || sidefy.i18n({ zh: "（无标题）", en: "(No title)" });
}

function primaryArticleUrl(item) {
    var pages = item.pages;
    if (!pages || !pages.length) {
        return "";
    }
    var p = pages[0];
    if (p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page) {
        return p.content_urls.desktop.page;
    }
    return "";
}
