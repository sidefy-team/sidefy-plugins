// GitHub 个人事件插件 - 获取指定用户的公开活动
function fetchEvents(config) {
    var events = [];

    // 获取配置参数
    var username = String(config.username || "").trim();
    var token = String(config.token || "").trim();
    var limit = Math.max(1, Math.min(100, Number(config.limit) || 10));
    var filterSelf = config.filterSelf === "true" || config.filterSelf === true;

    if (!username) {
        throw new Error(sidefy.i18n(I18N_ERROR_USERNAME));
    }

    // 限制数量范围
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;

    var cacheKey = "github_user_events_" + username + "_" + limit + "_" + (filterSelf ? "filtered" : "all");

    try {
        // 检查缓存 - 简化处理
        var cachedData = sidefy.storage.get(cacheKey);
        if (cachedData) {
            return cachedData; // 直接返回，TTL函数已处理反序列化
        }

        // 构建 API URL
        var url = "https://api.github.com/users/" + encodeURIComponent(username) + "/events/public?per_page=" + limit;

        // 设置请求头
        var headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "Accept": "application/vnd.github.v3+json"
        };

        // 如果有 token，添加认证头
        if (token) {
            headers["Authorization"] = "token " + token;
        }

        // 发送请求
        var response = sidefy.http.get(url, headers);

        if (!response) {
            throw new Error(sidefy.i18n(I18N_ERROR_REQUEST));
        }

        // 检查响应是否为有效 JSON
        if (!response.trim().startsWith('[')) {
            throw new Error(sidefy.i18n(I18N_ERROR_RESPONSE));
        }

        var data = JSON.parse(response);

        if (!Array.isArray(data)) {
            throw new Error(sidefy.i18n(I18N_ERROR_RESPONSE));
        }

        // 处理每个事件
        data.forEach(function (event) {
            // 如果启用了过滤自己的事件，且当前事件是用户自己的，则跳过
            if (filterSelf && event.actor && event.actor.login === username) {
                return; // 跳过此事件
            }

            var eventTime = new Date(event.created_at);
            var title = generateEventTitle(event);
            var color = getEventColor(event.type);
            var notes = generateEventNotes(event);
            var href = generateEventUrl(event);

            events.push({
                title: title,
                startDate: sidefy.date.format(eventTime.getTime() / 1000),
                endDate: sidefy.date.format(eventTime.getTime() / 1000),
                color: color,
                notes: notes,
                icon: event.actor.avatar_url || "https://github.com/favicon.ico",
                isAllDay: false,
                isPointInTime: true,
                href: href
            });
        });

        // 缓存结果 - 直接传递数组，使用30分钟TTL
        sidefy.storage.set(cacheKey, events, 30);

    } catch (err) {
        throw new Error(i18nFetchError(err.message));
    }

    return events;
}

// --- i18n ---

var I18N_GITHUB_ACTIVITY = { zh: "GitHub 活动", en: "GitHub Activity", ja: "GitHub アクティビティ", ko: "GitHub 활동", de: "GitHub-Aktivität", es: "Actividad de GitHub", fr: "Activité GitHub", pt: "Atividade do GitHub", ru: "Активность GitHub" };

var I18N_ERROR_USERNAME = { zh: "请配置 GitHub 用户名。", en: "Please configure a GitHub username.", ja: "GitHub ユーザー名を設定してください。", ko: "GitHub 사용자 이름을 설정하세요.", de: "Bitte konfigurieren Sie einen GitHub-Benutzernamen.", es: "Configura un nombre de usuario de GitHub.", fr: "Configurez un nom d’utilisateur GitHub.", pt: "Configure um nome de usuário do GitHub.", ru: "Настройте имя пользователя GitHub." };

var I18N_ERROR_REQUEST = { zh: "GitHub API 请求失败。", en: "GitHub API request failed.", ja: "GitHub API リクエストに失敗しました。", ko: "GitHub API 요청에 실패했습니다.", de: "Die GitHub-API-Anfrage ist fehlgeschlagen.", es: "La solicitud a la API de GitHub falló.", fr: "La requête de l’API GitHub a échoué.", pt: "A solicitação à API do GitHub falhou.", ru: "Запрос к API GitHub не выполнен." };

var I18N_ERROR_RESPONSE = { zh: "GitHub API 返回了无效数据。", en: "GitHub API returned invalid data.", ja: "GitHub API が無効なデータを返しました。", ko: "GitHub API가 잘못된 데이터를 반환했습니다.", de: "Die GitHub-API hat ungültige Daten zurückgegeben.", es: "La API de GitHub devolvió datos no válidos.", fr: "L’API GitHub a renvoyé des données invalides.", pt: "A API do GitHub retornou dados inválidos.", ru: "API GitHub вернул недопустимые данные." };

function i18nFetchError(message) {
    return sidefy.i18n({ zh: "获取 GitHub 用户事件失败：" + message, en: "Failed to fetch GitHub user events: " + message, ja: "GitHub ユーザーイベントの取得に失敗しました: " + message, ko: "GitHub 사용자 이벤트를 가져오지 못했습니다: " + message, de: "GitHub-Benutzerereignisse konnten nicht abgerufen werden: " + message, es: "No se pudieron obtener los eventos del usuario de GitHub: " + message, fr: "Échec de la récupération des événements GitHub : " + message, pt: "Falha ao buscar eventos do usuário do GitHub: " + message, ru: "Не удалось получить события пользователя GitHub: " + message });
}

function i18nEvent(type, values) {
    var actor = values.actor, repo = values.repo, count = values.count, ref = values.ref, number = values.number, action = values.action, tag = values.tag;
    var text = {
        PushEvent: { zh: actor + " 向 " + repo + " 推送", en: actor + " pushed to " + repo, ja: actor + " が " + repo + " にプッシュ", ko: actor + "님이 " + repo + "에 푸시", de: actor + " hat an " + repo + " gepusht", es: actor + " hizo push a " + repo, fr: actor + " a effectué un push vers " + repo, pt: actor + " fez push para " + repo, ru: actor + " отправил изменения в " + repo },
        CreateRepository: { zh: actor + " 创建了仓库 " + repo, en: actor + " created repository " + repo, ja: actor + " がリポジトリ " + repo + " を作成", ko: actor + "님이 저장소 " + repo + "를 생성", de: actor + " hat das Repository " + repo + " erstellt", es: actor + " creó el repositorio " + repo, fr: actor + " a créé le dépôt " + repo, pt: actor + " criou o repositório " + repo, ru: actor + " создал репозиторий " + repo },
        CreateRef: { zh: actor + " 在 " + repo + " 创建了" + ref, en: actor + " created " + ref + " in " + repo, ja: actor + " が " + repo + " に " + ref + " を作成", ko: actor + "님이 " + repo + "에 " + ref + " 생성", de: actor + " hat " + ref + " in " + repo + " erstellt", es: actor + " creó " + ref + " en " + repo, fr: actor + " a créé " + ref + " dans " + repo, pt: actor + " criou " + ref + " em " + repo, ru: actor + " создал " + ref + " в " + repo },
        Delete: { zh: actor + " 删除了 " + ref + "（" + repo + "）", en: actor + " deleted " + ref + " in " + repo, ja: actor + " が " + repo + " の " + ref + " を削除", ko: actor + "님이 " + repo + "에서 " + ref + " 삭제", de: actor + " hat " + ref + " in " + repo + " gelöscht", es: actor + " eliminó " + ref + " en " + repo, fr: actor + " a supprimé " + ref + " dans " + repo, pt: actor + " excluiu " + ref + " em " + repo, ru: actor + " удалил " + ref + " в " + repo },
        Fork: { zh: actor + " fork 了 " + repo, en: actor + " forked " + repo, ja: actor + " が " + repo + " をフォーク", ko: actor + "님이 " + repo + "를 포크", de: actor + " hat " + repo + " geforkt", es: actor + " bifurcó " + repo, fr: actor + " a forké " + repo, pt: actor + " bifurcou " + repo, ru: actor + " создал форк " + repo },
        Watch: { zh: actor + " 收藏了 " + repo, en: actor + " starred " + repo, ja: actor + " が " + repo + " にスター", ko: actor + "님이 " + repo + "에 별표", de: actor + " hat " + repo + " markiert", es: actor + " marcó con estrella " + repo, fr: actor + " a ajouté une étoile à " + repo, pt: actor + " marcou " + repo + " com estrela", ru: actor + " поставил звезду репозиторию " + repo },
        Issue: { zh: actor + " " + action + " 了 issue #" + number + "（" + repo + "）", en: actor + " " + action + " issue #" + number + " in " + repo, ja: actor + " が " + repo + " の issue #" + number + " を" + action, ko: actor + "님이 " + repo + "의 이슈 #" + number + "을(를) " + action, de: actor + " hat Issue #" + number + " in " + repo + " " + action, es: actor + " " + action + " el issue #" + number + " en " + repo, fr: actor + " a " + action + " l’issue n°" + number + " dans " + repo, pt: actor + " " + action + " a issue #" + number + " em " + repo, ru: actor + " " + action + " задачу №" + number + " в " + repo },
        Comment: { zh: actor + " 评论了 issue #" + number + "（" + repo + "）", en: actor + " commented on issue #" + number + " in " + repo, ja: actor + " が " + repo + " の issue #" + number + " にコメント", ko: actor + "님이 " + repo + "의 이슈 #" + number + "에 댓글", de: actor + " hat Issue #" + number + " in " + repo + " kommentiert", es: actor + " comentó el issue #" + number + " en " + repo, fr: actor + " a commenté l’issue n°" + number + " dans " + repo, pt: actor + " comentou a issue #" + number + " em " + repo, ru: actor + " прокомментировал задачу №" + number + " в " + repo },
        PullRequest: { zh: actor + " " + action + " 了 PR #" + number + "（" + repo + "）", en: actor + " " + action + " PR #" + number + " in " + repo, ja: actor + " が " + repo + " の PR #" + number + " を" + action, ko: actor + "님이 " + repo + "의 PR #" + number + "을(를) " + action, de: actor + " hat PR #" + number + " in " + repo + " " + action, es: actor + " " + action + " el PR #" + number + " en " + repo, fr: actor + " a " + action + " la PR n°" + number + " dans " + repo, pt: actor + " " + action + " a PR #" + number + " em " + repo, ru: actor + " " + action + " PR №" + number + " в " + repo },
        Review: { zh: actor + " 审查了 PR #" + number + "（" + repo + "）", en: actor + " reviewed PR #" + number + " in " + repo, ja: actor + " が " + repo + " の PR #" + number + " をレビュー", ko: actor + "님이 " + repo + "의 PR #" + number + "을(를) 검토", de: actor + " hat PR #" + number + " in " + repo + " geprüft", es: actor + " revisó el PR #" + number + " en " + repo, fr: actor + " a examiné la PR n°" + number + " dans " + repo, pt: actor + " revisou a PR #" + number + " em " + repo, ru: actor + " проверил PR №" + number + " в " + repo },
        Release: { zh: actor + " 发布了 " + tag + "（" + repo + "）", en: actor + " released " + tag + " in " + repo, ja: actor + " が " + repo + " で " + tag + " をリリース", ko: actor + "님이 " + repo + "에서 " + tag + " 릴리스", de: actor + " hat " + tag + " in " + repo + " veröffentlicht", es: actor + " publicó " + tag + " en " + repo, fr: actor + " a publié " + tag + " dans " + repo, pt: actor + " lançou " + tag + " em " + repo, ru: actor + " выпустил " + tag + " в " + repo }
    };
    return sidefy.i18n(text[type] || { zh: actor + " 在 " + repo + " 有新活动", en: actor + " had activity in " + repo, ja: actor + " が " + repo + " で活動", ko: actor + "님이 " + repo + "에서 활동", de: actor + " war in " + repo + " aktiv", es: actor + " tuvo actividad en " + repo, fr: actor + " a eu une activité dans " + repo, pt: actor + " teve atividade em " + repo, ru: actor + " проявил активность в " + repo });
}

function i18nNotesLabel(label, value) {
    var labels = { Repository: { zh: "仓库", en: "Repository", ja: "リポジトリ", ko: "저장소", de: "Repository", es: "Repositorio", fr: "Dépôt", pt: "Repositório", ru: "Репозиторий" }, "Latest commit": { zh: "最新提交", en: "Latest commit", ja: "最新コミット", ko: "최근 커밋", de: "Letzter Commit", es: "Último commit", fr: "Dernier commit", pt: "Último commit", ru: "Последний коммит" }, Title: { zh: "标题", en: "Title", ja: "タイトル", ko: "제목", de: "Titel", es: "Título", fr: "Titre", pt: "Título", ru: "Заголовок" }, Version: { zh: "版本", en: "Version", ja: "バージョン", ko: "버전", de: "Version", es: "Versión", fr: "Version", pt: "Versão", ru: "Версия" }, Name: { zh: "名称", en: "Name", ja: "名前", ko: "이름", de: "Name", es: "Nombre", fr: "Nom", pt: "Nome", ru: "Название" } };
    return sidefy.i18n(labels[label] || { zh: label, en: label, ja: label, ko: label, de: label, es: label, fr: label, pt: label, ru: label }) + ": " + value;
}

// 其余函数保持不变...
function generateEventTitle(event) {
    var actor = event.actor.login;
    var repo = event.repo ? event.repo.name : "";

    switch (event.type) {
        case "PushEvent":
            var commitCount = event.payload.commits ? event.payload.commits.length : 0;
            // 如果没有提交(如force push、删除分支等操作)，显示不同的文案
            if (commitCount === 0) {
                return i18nEvent("PushEvent", { actor: actor, repo: repo, count: commitCount });
            }
            return sidefy.i18n({ zh: actor + " 向 " + repo + " 推送了 " + commitCount + " 个提交", en: actor + " pushed " + commitCount + " commits to " + repo, ja: actor + " が " + repo + " に " + commitCount + " 件のコミットをプッシュ", ko: actor + "님이 " + repo + "에 " + commitCount + "개 커밋을 푸시", de: actor + " hat " + commitCount + " Commits an " + repo + " gepusht", es: actor + " hizo push de " + commitCount + " commits a " + repo, fr: actor + " a poussé " + commitCount + " commits vers " + repo, pt: actor + " fez push de " + commitCount + " commits para " + repo, ru: actor + " отправил " + commitCount + " коммитов в " + repo });

        case "CreateEvent":
            var refType = event.payload.ref_type;
            if (refType === "repository") {
                return i18nEvent("CreateRepository", { actor: actor, repo: repo });
            } else if (refType === "branch") {
                return i18nEvent("CreateRef", { actor: actor, repo: repo, ref: "branch " + event.payload.ref });
            } else if (refType === "tag") {
                return i18nEvent("CreateRef", { actor: actor, repo: repo, ref: "tag " + event.payload.ref });
            }
            return i18nEvent("CreateRef", { actor: actor, repo: repo, ref: refType });

        case "DeleteEvent":
            return i18nEvent("Delete", { actor: actor, repo: repo, ref: event.payload.ref_type + " " + event.payload.ref });

        case "ForkEvent":
            return i18nEvent("Fork", { actor: actor, repo: repo });

        case "WatchEvent":
            return i18nEvent("Watch", { actor: actor, repo: repo });

        case "IssuesEvent":
            var action = event.payload.action;
            var issueNumber = event.payload.issue ? event.payload.issue.number : "";
            return i18nEvent("Issue", { actor: actor, repo: repo, action: action, number: issueNumber });

        case "IssueCommentEvent":
            var issueNumber = event.payload.issue ? event.payload.issue.number : "";
            return i18nEvent("Comment", { actor: actor, repo: repo, number: issueNumber });

        case "PullRequestEvent":
            var action = event.payload.action;
            var prNumber = event.payload.pull_request ? event.payload.pull_request.number : "";
            return i18nEvent("PullRequest", { actor: actor, repo: repo, action: action, number: prNumber });

        case "PullRequestReviewEvent":
            var prNumber = event.payload.pull_request ? event.payload.pull_request.number : "";
            return i18nEvent("Review", { actor: actor, repo: repo, number: prNumber });

        case "ReleaseEvent":
            var tagName = event.payload.release ? event.payload.release.tag_name : "";
            return i18nEvent("Release", { actor: actor, repo: repo, tag: tagName });

        
        default:
            return i18nEvent("Unknown", { actor: actor, repo: repo });
    }
}

function getEventColor(eventType) {
    switch (eventType) {
        case "PushEvent":
            return "#4285f4";
        case "CreateEvent":
            return "#ff6d01";
        case "DeleteEvent":
            return "#ea4335";
        case "ForkEvent":
            return "#34a853";
        case "WatchEvent":
            return "#f1c232";
        case "IssuesEvent":
        case "IssueCommentEvent":
            return "#ea4335";
        case "PullRequestEvent":
        case "PullRequestReviewEvent":
            return "#9b59b6";
        case "ReleaseEvent":
            return "#ff6d01";
        default:
            return "#666666";
    }
}

function generateEventNotes(event) {
    var notes = sidefy.i18n(I18N_GITHUB_ACTIVITY);

    if (event.repo) {
        notes += "\n" + i18nNotesLabel("Repository", event.repo.name);
    }

    switch (event.type) {
        case "PushEvent":
            if (event.payload.commits && event.payload.commits.length > 0) {
                notes += "\n" + i18nNotesLabel("Latest commit", event.payload.commits[0].message);
            }
            break;

        case "IssuesEvent":
        case "PullRequestEvent":
            var item = event.payload.issue || event.payload.pull_request;
            if (item && item.title) {
                notes += "\n" + i18nNotesLabel("Title", item.title);
            }
            break;

        case "ReleaseEvent":
            if (event.payload.release) {
                notes += "\n" + i18nNotesLabel("Version", event.payload.release.tag_name);
                if (event.payload.release.name) {
                    notes += "\n" + i18nNotesLabel("Name", event.payload.release.name);
                }
            }
            break;
    }

    return notes;
}

function generateEventUrl(event) {
    if (!event.repo) {
        return "https://github.com/" + event.actor.login;
    }

    var baseUrl = "https://github.com/" + event.repo.name;

    switch (event.type) {
        case "IssuesEvent":
            if (event.payload.issue) {
                return baseUrl + "/issues/" + event.payload.issue.number;
            }
            break;

        case "PullRequestEvent":
            if (event.payload.pull_request) {
                return baseUrl + "/pull/" + event.payload.pull_request.number;
            }
            break;

        case "ReleaseEvent":
            if (event.payload.release) {
                return baseUrl + "/releases/tag/" + event.payload.release.tag_name;
            }
            break;

        case "CreateEvent":
            if (event.payload.ref_type === "branch") {
                return baseUrl + "/tree/" + event.payload.ref;
            } else if (event.payload.ref_type === "tag") {
                return baseUrl + "/releases/tag/" + event.payload.ref;
            }
            break;
    }

    return baseUrl;
}