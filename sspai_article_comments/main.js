function fetchEvents(config) {
    var events = [];
    var articleIds = String(config.articleId || "114211").split(/[\s,，]+/).filter(Boolean);
    var pageSize = Math.max(1, Math.min(20, Number(config.pageSize) || 20));

    if (articleIds.length === 0 || articleIds.some(function (articleId) { return !/^\d+$/.test(articleId); })) {
        sidefy.log(sidefy.i18n(I18N_ERROR_ARTICLE_ID));
        return events;
    }

    articleIds.forEach(function (articleId) {
        var articleTitle = fetchArticleTitle(articleId);
        fetchArticleComments(articleId, articleTitle, pageSize, events);
    });

    sidefy.log(i18nLoaded(events.length, articleIds.length));
    return events;
}

function fetchArticleTitle(articleId) {
    var cacheKey = "article_title_v2_" + articleId;
    var cachedTitle = sidefy.storage.get(cacheKey);
    if (cachedTitle) return cachedTitle;

    try {
        var response = sidefy.http.get("https://sspai.com/api/v1/article/info/get?id=" + articleId, {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"
        });
        if (response) {
            var payload = JSON.parse(response);
            if (payload.error === 0 && payload.data && payload.data.title) {
                var title = cleanText(payload.data.title);
                sidefy.storage.set(cacheKey, title, 15);
                return title;
            }
        }
    } catch (error) {
        sidefy.log(i18nTitleError(articleId, error.message));
    }
    return "少数派文章 " + articleId;
}

function fetchArticleComments(articleId, articleTitle, pageSize, events) {
    try {
        var cacheKey = "article_comments_v15_" + articleId;
        var cachedEvents = sidefy.storage.get(cacheKey);
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
            var response = sidefy.http.get(url, {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"
            });

            if (!response) {
                throw new Error(sidefy.i18n(I18N_ERROR_REQUEST));
            }

            var payload = JSON.parse(response);
            if (payload.error !== 0 || !Array.isArray(payload.data)) {
                throw new Error(sidefy.i18n(I18N_ERROR_RESPONSE));
            }

            if (total === null && typeof payload.total === "number") {
                total = payload.total;
            }

            if (payload.data.length === 0) break;

            payload.data.forEach(function (item) {
                var commentText = cleanText(item.comment);
                if (commentText) {
                    articleEvents.push(makeCommentEvent(item, commentText, articleId, articleTitle, null));
                }

                if (Array.isArray(item.reply)) {
                    var context = [item];
                    item.reply.forEach(function (reply) {
                        var replyText = cleanText(reply.comment);
                        if (replyText) {
                            articleEvents.push(makeCommentEvent(
                                reply,
                                replyText,
                                articleId,
                                articleTitle,
                                quoteFromOthers(context, reply)
                            ));
                        }
                        context.push(reply);
                    });
                }
            });

            offset += payload.data.length;
            commentCount += payload.data.length;
            if ((total !== null && offset >= total) || payload.data.length < requestLimit) break;
        }

        sidefy.storage.set(cacheKey, articleEvents, 15);
        Array.prototype.push.apply(events, articleEvents);

    } catch (error) {
        sidefy.log(i18nArticleError(articleId, error.message));
    }
}

function cleanText(value) {
    if (typeof value !== "string") return "";
    return value
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function commentUser(item) {
    return (item && (item.user || item.author)) || {};
}

function userKey(item) {
    var user = commentUser(item);
    if (user.id) return "id:" + user.id;
    var nickname = cleanText(user.nickname);
    return nickname ? "name:" + nickname : "";
}

function displayName(item) {
    return cleanText(commentUser(item).nickname) || sidefy.i18n(I18N_UNKNOWN_USER);
}

function quoteFromOthers(context, reply) {
    var currentKey = userKey(reply);
    for (var i = context.length - 1; i >= 0; i--) {
        var source = context[i];
        if (!currentKey || userKey(source) === currentKey) continue;
        var text = cleanText(source.comment);
        if (!text) continue;
        return { nickname: displayName(source), text: text };
    }
    return null;
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

function makeCommentEvent(item, text, articleId, articleTitle, quoted) {
    var user = commentUser(item);
    var nickname = displayName(item);
    var isAuthor = isArticleAuthor(item);
    var timestamp = Number(item.created_at) || Date.now() / 1000;
    var articleURL = "https://sspai.com/post/" + articleId;
    var notes = sidefy.i18n(I18N_ORIGINAL_ARTICLE) + ": " + articleTitle + " " + articleURL +
        "\n" + i18nCurrentReply(nickname, text);
    if (quoted) {
        notes += "\n" + i18nQuotedReply(quoted.nickname, quoted.text);
    }

    return {
        title: nickname + ": " + text.slice(0, 70) + (text.length > 70 ? "…" : ""),
        startDate: sidefy.date.format(timestamp),
        endDate: sidefy.date.format(timestamp),
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
    ko: "문서 ID는 숫자만 사용할 수 있습니다.",
    de: "Die Artikel-ID darf nur Ziffern enthalten.",
    es: "El ID del artículo solo puede contener dígitos.",
    fr: "L’identifiant de l’article ne doit contenir que des chiffres.",
    pt: "O ID do artigo deve conter apenas dígitos.",
    ru: "ID статьи должен содержать только цифры."
};

var I18N_ERROR_REQUEST = {
    zh: "少数派评论请求失败。",
    en: "The SSPAI comments request failed.",
    ja: "少数派のコメント取得に失敗しました。",
    ko: "SSPAI 댓글 요청에 실패했습니다.",
    de: "Die SSPAI-Kommentaranfrage ist fehlgeschlagen.",
    es: "La solicitud de comentarios de SSPAI falló.",
    fr: "La requête de commentaires SSPAI a échoué.",
    pt: "A solicitação de comentários do SSPAI falhou.",
    ru: "Не удалось запросить комментарии SSPAI."
};

var I18N_ERROR_RESPONSE = {
    zh: "少数派返回了无法识别的评论数据。",
    en: "SSPAI returned an unrecognized comments response.",
    ja: "少数派から認識できないコメントデータが返されました。",
    ko: "SSPAI에서 인식할 수 없는 댓글 데이터를 반환했습니다.",
    de: "SSPAI gab nicht erkennbare Kommentardaten zurück.",
    es: "SSPAI devolvió datos de comentarios no reconocidos.",
    fr: "SSPAI a renvoyé des données de commentaires illisibles.",
    pt: "O SSPAI retornou dados de comentários não reconhecidos.",
    ru: "SSPAI вернул нераспознанные данные комментариев."
};

var I18N_UNKNOWN_USER = {
    zh: "少数派用户",
    en: "SSPAI user",
    ja: "少数派ユーザー",
    ko: "SSPAI 사용자",
    de: "SSPAI-Benutzer",
    es: "Usuario de SSPAI",
    fr: "Utilisateur SSPAI",
    pt: "Usuário do SSPAI",
    ru: "Пользователь SSPAI"
};

var I18N_ORIGINAL_ARTICLE = {
    zh: "原文章",
    en: "Original article",
    ja: "元の記事",
    ko: "원문",
    de: "Originalartikel",
    es: "Artículo original",
    fr: "Article original",
    pt: "Artigo original",
    ru: "Исходная статья"
};

function i18nQuotedReply(nickname, text) {
    return sidefy.i18n({
        zh: "原回复（" + nickname + "）：" + text,
        en: "Original reply (" + nickname + "): " + text,
        ja: "元の返信（" + nickname + "）：" + text,
        ko: "원 답글 (" + nickname + "): " + text,
        de: "Ursprüngliche Antwort (" + nickname + "): " + text,
        es: "Respuesta original (" + nickname + "): " + text,
        fr: "Réponse originale (" + nickname + ") : " + text,
        pt: "Resposta original (" + nickname + "): " + text,
        ru: "Исходный ответ (" + nickname + "): " + text
    });
}

function i18nCurrentReply(nickname, text) {
    return sidefy.i18n({
        zh: "回复（" + nickname + "）：" + text,
        en: "Reply (" + nickname + "): " + text,
        ja: "返信（" + nickname + "）：" + text,
        ko: "답글 (" + nickname + "): " + text,
        de: "Antwort (" + nickname + "): " + text,
        es: "Respuesta (" + nickname + "): " + text,
        fr: "Réponse (" + nickname + ") : " + text,
        pt: "Resposta (" + nickname + "): " + text,
        ru: "Ответ (" + nickname + "): " + text
    });
}

function i18nTitleError(articleId, message) {
    return sidefy.i18n({
        zh: "获取文章 " + articleId + " 标题失败，将使用文章 ID：" + message,
        en: "Could not load title for article " + articleId + "; using its ID: " + message,
        ja: "記事 " + articleId + " のタイトルを取得できません。ID を使用します：" + message,
        ko: "문서 " + articleId + " 제목을 가져오지 못해 ID를 사용합니다: " + message,
        de: "Titel für Artikel " + articleId + " konnte nicht geladen werden; ID wird verwendet: " + message,
        es: "No se pudo cargar el título del artículo " + articleId + "; se usará su ID: " + message,
        fr: "Impossible de charger le titre de l’article " + articleId + "; son ID sera utilisé : " + message,
        pt: "Não foi possível carregar o título do artigo " + articleId + "; seu ID será usado: " + message,
        ru: "Не удалось загрузить заголовок статьи " + articleId + "; используется её ID: " + message
    });
}

function i18nLoaded(count, articleCount) {
    return sidefy.i18n({
        zh: "已从 " + articleCount + " 篇文章读取 " + count + " 条评论和回复。",
        en: "Loaded " + count + " comments and replies from " + articleCount + " articles.",
        ja: articleCount + " 件の記事からコメントと返信を " + count + " 件取得しました。",
        ko: articleCount + "개 문서에서 댓글과 답글 " + count + "개를 가져왔습니다.",
        de: count + " Kommentare und Antworten aus " + articleCount + " Artikeln geladen.",
        es: "Se cargaron " + count + " comentarios y respuestas de " + articleCount + " artículos.",
        fr: count + " commentaires et réponses chargés depuis " + articleCount + " articles.",
        pt: "Carregados " + count + " comentários e respostas de " + articleCount + " artigos.",
        ru: "Загружено комментариев и ответов: " + count + " из статей: " + articleCount
    });
}

function i18nArticleError(articleId, message) {
    return sidefy.i18n({
        zh: "读取文章 " + articleId + " 的评论时出错：" + message,
        en: "Error loading comments for article " + articleId + ": " + message,
        ja: "記事 " + articleId + " のコメント取得中にエラーが発生しました：" + message,
        ko: "문서 " + articleId + "의 댓글을 가져오는 중 오류가 발생했습니다: " + message,
        de: "Fehler beim Laden der Kommentare für Artikel " + articleId + ": " + message,
        es: "Error al cargar los comentarios del artículo " + articleId + ": " + message,
        fr: "Erreur lors du chargement des commentaires de l’article " + articleId + " : " + message,
        pt: "Erro ao carregar comentários do artigo " + articleId + ": " + message,
        ru: "Ошибка загрузки комментариев статьи " + articleId + ": " + message
    });
}
