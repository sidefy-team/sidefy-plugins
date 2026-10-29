// GitHub 通知插件 - 获取 GitHub 通知和订阅信息
function fetchEvents(config) {
    var events = [];

    // 获取配置参数
    var token = config.token;
    var limit = parseInt(config.limit) || 20;
    var showParticipating = config.showParticipating === true; // 默认为false
    var showAll = config.showAll !== false; // 默认为true
    var notificationTypes = config.notificationTypes || "";

    if (!token || token.trim() === "") {
        throw new Error(sidefy.i18n(I18N_ERROR_TOKEN));
    }

    // 限制数量范围
    if (limit < 1) limit = 1;
    if (limit > 50) limit = 50;

    // 解析通知类型 - 如果为空则不筛选
    var allowedTypes = [];
    if (notificationTypes && notificationTypes.trim() !== "") {
        allowedTypes = notificationTypes.split(",").map(function(type) {
            return type.trim();
        });
    }

    var cacheKey = "github_notifications_" + (showParticipating ? "participating" : "all") + "_" + limit;

    try {
        // 检查缓存
        var cachedData = sidefy.storage.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        // 构建 API URL
        var url = "https://api.github.com/notifications?per_page=" + limit;
        if (showParticipating && !showAll) {
            url += "&participating=true";
        }
        if (showAll) {
            url += "&all=true";
        }

        // 设置请求头
        var headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "Accept": "application/vnd.github.v3+json",
            "Authorization": "token " + token.trim()
        };

        // 发送请求
        var response = sidefy.http.get(url, headers);

        if (!response || response.length === 0) {
            throw new Error(sidefy.i18n(I18N_ERROR_EMPTY_RESPONSE));
        }

        var notifications = JSON.parse(response);

        if (!Array.isArray(notifications)) {
            if (notifications.message) {
                throw new Error(i18nApiError(notifications.message));
            }
            throw new Error(sidefy.i18n(I18N_ERROR_INVALID_RESPONSE));
        }

        // 处理通知数据
        sidefy.log("[GitHub通知] 开始处理 " + notifications.length + " 个通知");
        notifications.forEach(function(notification) {
            var notificationTime = new Date(notification.updated_at);
            var localTimeStr = notificationTime.toLocaleString();

            sidefy.log("[GitHub通知] 通知: " + notification.subject.title + " | 原始时间: " + notification.updated_at + " | 本地时间: " + localTimeStr + " | 类型: " + notification.reason);

            // 检查通知类型是否在允许列表中（如果有配置的话）
            if (allowedTypes.length > 0 && allowedTypes.indexOf(notification.reason) === -1) {
                sidefy.log("[GitHub通知] 跳过类型: " + notification.reason);
                return; // 跳过不需要的通知类型
            }

            var title = getNotificationTitle(notification);
            var color = getNotificationColor(notification.reason);

            // 直接使用GitHub API返回的UTC时间，JavaScript会自动处理本地时区显示
            var localStartTime = notificationTime;
            var localEndTime = new Date(localStartTime.getTime() + 30 * 60 * 1000); // 30分钟后结束

            var event = {
                title: title,
                startDate: sidefy.date.format(localStartTime.getTime() / 1000),
                endDate: sidefy.date.format(localEndTime.getTime() / 1000),
                color: color,
                notes: getNotificationNotes(notification),
                icon: "https://github.com/favicon.ico",
                isAllDay: false,
                isPointInTime: true,
                href: getNotificationUrl(notification)
            };

            events.push(event);
        });

        // 缓存结果 - 10分钟缓存
        sidefy.storage.set(cacheKey, events, 10);

        return events;

    } catch (error) {
        throw new Error(i18nFetchError(error.message));
    }
}

// 生成通知标题
function getNotificationTitle(notification) {
    var typeText = getNotificationTypeText(notification.reason);
    var repoName = notification.repository.name;
    var subject = notification.subject.title;

    return "[" + typeText + "] " + repoName + ": " + subject;
}

// 获取通知类型显示文本
function getNotificationTypeText(reason) {
    return sidefy.i18n(I18N_TYPE[reason] || { zh: reason, en: reason, ja: reason, ko: reason });
}

// 获取通知颜色
function getNotificationColor(reason) {
    var colorMap = {
        "mention": "#FF6B6B",           // 红色 - 提及
        "assign": "#4ECDC4",           // 青色 - 分配
        "review_requested": "#45B7D1", // 蓝色 - 审查请求
        "subscribed": "#96CEB4",       // 绿色 - 订阅
        "author": "#DDA0DD",           // 紫色 - 作者
        "manual": "#98D8C8",           // 浅绿 - 手动订阅
        "security_alert": "#DC3545"    // 深红色 - 安全警报
    };

    return colorMap[reason] || "#95A5A6";
}

// 生成通知详细信息
function getNotificationNotes(notification) {
    var notes = [];

    notes.push(i18nLabel("Repository", notification.repository.full_name));
    notes.push(i18nLabel("Subject", notification.subject.type));

    notes.push(i18nLabel("Status", notification.unread ? sidefy.i18n(I18N_STATUS_UNREAD) : sidefy.i18n(I18N_STATUS_READ)));

    // 添加具体的原因描述
    var reasonDesc = getReasonDescription(notification.reason);
    if (reasonDesc) {
        notes.push(i18nLabel("Details", reasonDesc));
    }

    return notes.join("\n");
}

// 获取通知原因的详细描述
function getReasonDescription(reason) {
    return I18N_REASON[reason] ? sidefy.i18n(I18N_REASON[reason]) : "";
}

// 获取通知链接
function getNotificationUrl(notification) {
    // 优先使用 subject.url，转换为网页链接
    if (notification.subject.url) {
        var url = notification.subject.url;
        // 只需要替换 API 前缀为网页前缀
        url = url.replace("https://api.github.com/repos/", "https://github.com/");
        url = url.replace("/pulls/", "/pull/");
        return url;
    }

    // 备用：仓库链接
    if (notification.repository.html_url) {
        return notification.repository.html_url;
    }

    return "https://github.com/" + notification.repository.full_name;
}

// 格式化日期
function formatDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    var hours = String(date.getHours()).padStart(2, '0');
    var minutes = String(date.getMinutes()).padStart(2, '0');

    return year + "-" + month + "-" + day + " " + hours + ":" + minutes;
}

// --- i18n ---

var I18N_STATUS_UNREAD = { zh: "未读", en: "Unread", ja: "未読", ko: "읽지 않음", de: "Ungelesen", es: "Sin leer", fr: "Non lu", pt: "Não lido", ru: "Непрочитано" };
var I18N_STATUS_READ = { zh: "已读", en: "Read", ja: "既読", ko: "읽음", de: "Gelesen", es: "Leído", fr: "Lu", pt: "Lido", ru: "Прочитано" };

var I18N_ERROR_TOKEN = {
    zh: "请配置 GitHub Personal Access Token。", en: "Please configure a GitHub Personal Access Token.", ja: "GitHub Personal Access Token を設定してください。", ko: "GitHub Personal Access Token을 설정하세요.", de: "Bitte konfigurieren Sie ein persönliches GitHub-Zugriffstoken.", es: "Configura un token de acceso personal de GitHub.", fr: "Configurez un jeton d’accès personnel GitHub.", pt: "Configure um token de acesso pessoal do GitHub.", ru: "Настройте персональный токен доступа GitHub."
};

var I18N_ERROR_EMPTY_RESPONSE = { zh: "GitHub API 返回了空响应。", en: "GitHub API returned an empty response.", ja: "GitHub API が空の応答を返しました。", ko: "GitHub API가 빈 응답을 반환했습니다.", de: "Die GitHub-API hat eine leere Antwort zurückgegeben.", es: "La API de GitHub devolvió una respuesta vacía.", fr: "L’API GitHub a renvoyé une réponse vide.", pt: "A API do GitHub retornou uma resposta vazia.", ru: "API GitHub вернул пустой ответ." };

var I18N_ERROR_INVALID_RESPONSE = { zh: "GitHub API 返回了无法识别的数据格式。", en: "GitHub API returned an invalid data format.", ja: "GitHub API が無効なデータ形式を返しました。", ko: "GitHub API가 잘못된 데이터 형식을 반환했습니다.", de: "Die GitHub-API hat ein ungültiges Datenformat zurückgegeben.", es: "La API de GitHub devolvió un formato de datos no válido.", fr: "L’API GitHub a renvoyé un format de données invalide.", pt: "A API do GitHub retornou um formato de dados inválido.", ru: "API GitHub вернул недопустимый формат данных." };

var I18N_TYPE = {
    mention: { zh: "提及", en: "mention", ja: "メンション", ko: "멘션", de: "Erwähnung", es: "mención", fr: "mention", pt: "menção", ru: "упоминание" },
    assign: { zh: "分配", en: "assignment", ja: "割り当て", ko: "할당", de: "Zuweisung", es: "asignación", fr: "attribution", pt: "atribuição", ru: "назначение" },
    review_requested: { zh: "请求审查", en: "review request", ja: "レビュー依頼", ko: "리뷰 요청", de: "Review-Anfrage", es: "solicitud de revisión", fr: "demande de revue", pt: "solicitação de revisão", ru: "запрос на проверку" },
    subscribed: { zh: "订阅", en: "subscription", ja: "購読", ko: "구독", de: "Abonnement", es: "suscripción", fr: "abonnement", pt: "assinatura", ru: "подписка" },
    author: { zh: "作者", en: "author", ja: "作成者", ko: "작성자", de: "Autor", es: "autor", fr: "auteur", pt: "autor", ru: "автор" },
    manual: { zh: "手动订阅", en: "manual subscription", ja: "手動購読", ko: "수동 구독", de: "manuelles Abonnement", es: "suscripción manual", fr: "abonnement manuel", pt: "assinatura manual", ru: "ручная подписка" },
    security_alert: { zh: "安全警报", en: "security alert", ja: "セキュリティ警告", ko: "보안 경고", de: "Sicherheitswarnung", es: "alerta de seguridad", fr: "alerte de sécurité", pt: "alerta de segurança", ru: "предупреждение безопасности" }
};

var I18N_REASON = {
    mention: { zh: "有人在评论中提及你", en: "You were mentioned in a comment", ja: "コメントでメンションされました", ko: "댓글에서 멘션되었습니다", de: "Du wurdest in einem Kommentar erwähnt", es: "Te mencionaron en un comentario", fr: "Vous avez été mentionné dans un commentaire", pt: "Você foi mencionado em um comentário", ru: "Вас упомянули в комментарии" },
    assign: { zh: "有人将此任务分配给你", en: "You were assigned to this task", ja: "このタスクが割り当てられました", ko: "이 작업이 할당되었습니다", de: "Dir wurde diese Aufgabe zugewiesen", es: "Te asignaron esta tarea", fr: "Cette tâche vous a été attribuée", pt: "Esta tarefa foi atribuída a você", ru: "Вам назначили эту задачу" },
    review_requested: { zh: "有人请求你进行代码审查", en: "A code review was requested from you", ja: "コードレビューを依頼されました", ko: "코드 리뷰를 요청받았습니다", de: "Eine Codeprüfung wurde von dir angefordert", es: "Te solicitaron una revisión de código", fr: "Une revue de code vous a été demandée", pt: "Foi solicitada uma revisão de código a você", ru: "Вас попросили проверить код" },
    subscribed: { zh: "你订阅了此内容的更新", en: "You subscribed to updates", ja: "更新を購読しています", ko: "업데이트를 구독했습니다", de: "Du hast Updates abonniert", es: "Te suscribiste a las actualizaciones", fr: "Vous avez souscrit aux mises à jour", pt: "Você assinou as atualizações", ru: "Вы подписались на обновления" },
    author: { zh: "你是此内容的作者", en: "You are the author", ja: "あなたが作成者です", ko: "회원님이 작성자입니다", de: "Du bist der Autor", es: "Eres el autor", fr: "Vous êtes l’auteur", pt: "Você é o autor", ru: "Вы автор" },
    manual: { zh: "手动订阅", en: "Manually subscribed", ja: "手動で購読しています", ko: "수동으로 구독했습니다", de: "Manuell abonniert", es: "Suscripción manual", fr: "Abonnement manuel", pt: "Assinatura manual", ru: "Ручная подписка" },
    security_alert: { zh: "发现安全漏洞", en: "A security vulnerability was found", ja: "セキュリティ脆弱性が見つかりました", ko: "보안 취약점이 발견되었습니다", de: "Eine Sicherheitslücke wurde gefunden", es: "Se encontró una vulnerabilidad de seguridad", fr: "Une vulnérabilité de sécurité a été détectée", pt: "Foi encontrada uma vulnerabilidade de segurança", ru: "Обнаружена уязвимость безопасности" }
};

function i18nApiError(message) {
    return sidefy.i18n({ zh: "GitHub API 错误：" + message, en: "GitHub API error: " + message, ja: "GitHub API エラー: " + message, ko: "GitHub API 오류: " + message, de: "GitHub-API-Fehler: " + message, es: "Error de la API de GitHub: " + message, fr: "Erreur de l’API GitHub : " + message, pt: "Erro da API do GitHub: " + message, ru: "Ошибка API GitHub: " + message });
}

function i18nFetchError(message) {
    return sidefy.i18n({ zh: "获取 GitHub 通知失败：" + message, en: "Failed to fetch GitHub notifications: " + message, ja: "GitHub 通知の取得に失敗しました: " + message, ko: "GitHub 알림을 가져오지 못했습니다: " + message, de: "GitHub-Benachrichtigungen konnten nicht abgerufen werden: " + message, es: "No se pudieron obtener las notificaciones de GitHub: " + message, fr: "Échec de la récupération des notifications GitHub : " + message, pt: "Falha ao buscar notificações do GitHub: " + message, ru: "Не удалось получить уведомления GitHub: " + message });
}

function i18nLabel(label, value) {
    var labels = { Repository: { zh: "仓库：", en: "Repository: ", ja: "リポジトリ: ", ko: "저장소: ", de: "Repository: ", es: "Repositorio: ", fr: "Dépôt : ", pt: "Repositório: ", ru: "Репозиторий: " }, Subject: { zh: "主题：", en: "Subject: ", ja: "件名: ", ko: "제목: ", de: "Betreff: ", es: "Asunto: ", fr: "Sujet : ", pt: "Assunto: ", ru: "Тема: " }, Status: { zh: "状态：", en: "Status: ", ja: "状態: ", ko: "상태: ", de: "Status: ", es: "Estado: ", fr: "Statut : ", pt: "Status: ", ru: "Статус: " }, Details: { zh: "详情：", en: "Details: ", ja: "詳細: ", ko: "세부 정보: ", de: "Details: ", es: "Detalles: ", fr: "Détails : ", pt: "Detalhes: ", ru: "Подробности: " } };
    return sidefy.i18n(labels[label]) + value;
}

// String.padStart polyfill for older environments
if (!String.prototype.padStart) {
    String.prototype.padStart = function(targetLength, padString) {
        targetLength = targetLength >> 0;
        padString = String(padString || ' ');
        if (this.length > targetLength) {
            return String(this);
        } else {
            targetLength = targetLength - this.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength / padString.length);
            }
            return padString.slice(0, targetLength) + String(this);
        }
    };
}