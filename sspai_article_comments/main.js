function fetchEvents(config) {
    var events = [];
    var articleIds = String(config.articleId || "114211").split(/[\s,，]+/).filter(Boolean);
    var pageSize = Math.max(1, Math.min(20, Number(config.pageSize) || 20));

    if (articleIds.length === 0 || articleIds.some(function (articleId) { return !/^\d+$/.test(articleId); })) {
        nunc.log(nunc.i18n(I18N_ERROR_ARTICLE_ID));
        return events;
    }

    articleIds.forEach(function (articleId) {
        var articleTitle = fetchArticleTitle(articleId);
        fetchArticleComments(articleId, articleTitle, pageSize, events);
    });

    nunc.log(i18nLoaded(events.length, articleIds.length));
    return events;
}

function fetchArticleTitle(articleId) {
    var cacheKey = "article_title_v2_" + articleId;
    var cachedTitle = nunc.storage.get(cacheKey);
    if (cachedTitle) return cachedTitle;

    try {
        var response = nunc.http.get("https://sspai.com/api/v1/article/info/get?id=" + articleId, {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"
        });
        if (response) {
            var payload = JSON.parse(response);
            if (payload.error === 0 && payload.data && payload.data.title) {
                var title = cleanText(payload.data.title);
                nunc.storage.set(cacheKey, title, 15);
                return title;
            }
        }
    } catch (error) {
        nunc.log(i18nTitleError(articleId, error.message));
    }
    return "少数派文章 " + articleId;
}

function fetchArticleComments(articleId, articleTitle, pageSize, events) {
    try {
        var cacheKey = "article_comments_v4_" + articleId;
        var cachedEvents = nunc.storage.get(cacheKey);
        if (Array.isArray(cachedEvents)) {
            Array.prototype.push.apply(events, cachedEvents);
            return;
        }

        var offset = 0;
        var total = null;
        var commentCount = 0;
        var articleEvents = [];

        while (commentCount < 100) {
            var requestLimit = Math.min(pageSize, 100 - commentCount);
            var url = "https://sspai.com/api/v1/comment/user/article/hot/page/get?limit=" +
                requestLimit + "&offset=" + offset + "&article_id=" + articleId;
            var response = nunc.http.get(url, {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"
            });

            if (!response) {
                throw new Error(nunc.i18n(I18N_ERROR_REQUEST));
            }

            var payload = JSON.parse(response);
            if (payload.error !== 0 || !Array.isArray(payload.data)) {
                throw new Error(nunc.i18n(I18N_ERROR_RESPONSE));
            }

            if (total === null && typeof payload.total === "number") {
                total = payload.total;
            }

            if (payload.data.length === 0) break;

            payload.data.forEach(function (item) {
                var commentText = cleanText(item.comment);
                if (commentText) {
                    articleEvents.push(makeCommentEvent(item, commentText, articleId, articleTitle, false));
                }

                if (Array.isArray(item.reply)) {
                    item.reply.forEach(function (reply) {
                        var replyText = cleanText(reply.comment);
                        if (replyText) {
                            articleEvents.push(makeCommentEvent(reply, replyText, articleId, articleTitle, true));
                        }
                    });
                }
            });

            offset += payload.data.length;
            commentCount += payload.data.length;
            if ((total !== null && offset >= total) || payload.data.length < requestLimit) break;
        }

        nunc.storage.set(cacheKey, articleEvents, 15);
        Array.prototype.push.apply(events, articleEvents);

    } catch (error) {
        nunc.log(i18nArticleError(articleId, error.message));
    }
}

function cleanText(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isArticleAuthor(item) {
    return !!(item && item.is_author === true);
}

function avatarIcon(avatar) {
    if (!avatar) return null;
    if (avatar.indexOf("http") === 0) {
        return avatar.replace("://cdnfile.sspai.com/", "://rssfile.sspai.com/");
    }
    return "https://rssfile.sspai.com/" + avatar;
}

function commentLabel(isReply, isAuthor) {
    if (isAuthor) {
        return nunc.i18n(isReply ? I18N_AUTHOR_REPLY_LABEL : I18N_AUTHOR_LABEL);
    }
    return nunc.i18n(isReply ? I18N_REPLY_LABEL : I18N_COMMENT_LABEL);
}

function makeCommentEvent(item, text, articleId, articleTitle, isReply) {
    var user = item.user || item.author || {};
    var nickname = cleanText(user.nickname) || nunc.i18n(I18N_UNKNOWN_USER);
    var isAuthor = isArticleAuthor(item);
    var timestamp = Number(item.created_at) || Date.now() / 1000;
    var articleURL = "https://sspai.com/post/" + articleId;
    var notes = nunc.i18n(I18N_ORIGINAL_ARTICLE) + ": " + articleTitle +
        "\n" + articleURL + "\n\n" +
        commentLabel(isReply, isAuthor) +
        " · " + nickname + "\n\n" + text;

    return {
        title: nickname + ": " + text.slice(0, 70) + (text.length > 70 ? "…" : ""),
        startDate: nunc.date.format(timestamp),
        endDate: nunc.date.format(timestamp),
        color: isAuthor ? "#007AFF" : "#D7000F",
        notes: notes,
        icon: avatarIcon(user.avatar),
        isAllDay: false,
        isPointInTime: true,
        eventType: "comment",
        href: articleURL
    };
}

// --- i18n ---

var I18N_ERROR_ARTICLE_ID = {
    zh: "文章 ID 必须是数字。",
    en: "The article ID must contain digits only.",
    ja: "記事 ID は数字のみ指定できます。",
    ko: "문서 ID는 숫자만 사용할 수 있습니다."
};

var I18N_ERROR_REQUEST = {
    zh: "少数派评论请求失败。",
    en: "The SSPAI comments request failed.",
    ja: "少数派のコメント取得に失敗しました。",
    ko: "SSPAI 댓글 요청에 실패했습니다."
};

var I18N_ERROR_RESPONSE = {
    zh: "少数派返回了无法识别的评论数据。",
    en: "SSPAI returned an unrecognized comments response.",
    ja: "少数派から認識できないコメントデータが返されました。",
    ko: "SSPAI에서 인식할 수 없는 댓글 데이터를 반환했습니다."
};

var I18N_UNKNOWN_USER = {
    zh: "少数派用户",
    en: "SSPAI user",
    ja: "少数派ユーザー",
    ko: "SSPAI 사용자"
};

var I18N_COMMENT_LABEL = {
    zh: "评论",
    en: "Comment",
    ja: "コメント",
    ko: "댓글"
};

var I18N_REPLY_LABEL = {
    zh: "回复",
    en: "Reply",
    ja: "返信",
    ko: "답글"
};

var I18N_AUTHOR_LABEL = {
    zh: "作者",
    en: "Author",
    ja: "著者",
    ko: "작성자"
};

var I18N_AUTHOR_REPLY_LABEL = {
    zh: "作者回复",
    en: "Author reply",
    ja: "著者の返信",
    ko: "작성자 답글"
};

var I18N_ORIGINAL_ARTICLE = {
    zh: "原文章",
    en: "Original article",
    ja: "元の記事",
    ko: "원문"
};

function i18nTitleError(articleId, message) {
    return nunc.i18n({
        zh: "获取文章 " + articleId + " 标题失败，将使用文章 ID：" + message,
        en: "Could not load title for article " + articleId + "; using its ID: " + message,
        ja: "記事 " + articleId + " のタイトルを取得できません。ID を使用します：" + message,
        ko: "문서 " + articleId + " 제목을 가져오지 못해 ID를 사용합니다: " + message
    });
}

function i18nLoaded(count, articleCount) {
    return nunc.i18n({
        zh: "已从 " + articleCount + " 篇文章读取 " + count + " 条评论和回复。",
        en: "Loaded " + count + " comments and replies from " + articleCount + " articles.",
        ja: articleCount + " 件の記事からコメントと返信を " + count + " 件取得しました。",
        ko: articleCount + "개 문서에서 댓글과 답글 " + count + "개를 가져왔습니다."
    });
}

function i18nArticleError(articleId, message) {
    return nunc.i18n({
        zh: "读取文章 " + articleId + " 的评论时出错：" + message,
        en: "Error loading comments for article " + articleId + ": " + message,
        ja: "記事 " + articleId + " のコメント取得中にエラーが発生しました：" + message,
        ko: "문서 " + articleId + "의 댓글을 가져오는 중 오류가 발생했습니다: " + message
    });
}
