// GitHub Repository — track today's repo activity (stars / releases / PRs / forks / issues / discussions)
var BUILTIN_KEYS = { token: true };
var ALL_EVENT_TYPES = ["stars", "releases", "pullRequests", "forks", "issues", "discussions"];
var EMPTY_CACHE_TTL_MINUTES = 5;
var POPULATED_CACHE_TTL_MINUTES = 15;
var USER_AGENT = "Sidefy-GitHub-Repository-Plugin";

function fetchEvents(config) {
    var events = [];
    var token = (config.token || "").trim();
    var repos = collectRepositories(config);

    if (repos.length === 0) {
        sidefy.log("No repositories configured. Add incremental keys like owner/repo.");
        return events;
    }

    var headers = defaultHeaders(token);
    var now = new Date();
    var day = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
    var midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    var expiresAt = midnight.getTime();

    for (var i = 0; i < repos.length; i++) {
        var repo = repos[i];
        var types = repo.types;
        var cacheKey = "github_repo_daily_v3_" + encodeURIComponent(repo.name.toLowerCase()) + "_" + day + "_" + repositoryConfigHash([repo]);
        var cached = sidefy.storage.get(cacheKey);
        if (!cached || cached.expiresAt <= now.getTime()) {
            cached = { events: [], last: 0 };
        }
        cached.events.forEach(function(event) { event.attribution = repo.name; });
        var interval = cached.events.length > 0 ? POPULATED_CACHE_TTL_MINUTES : EMPTY_CACHE_TTL_MINUTES;
        if (cached.last && now.getTime() - cached.last < interval * 60000) {
            appendAll(events, cached.events);
            continue;
        }
        var repoEvents = [];
        try {
            if (types.stars) {
                appendAll(repoEvents, fetchStars(repo.name, headers, token));
            }
            if (types.releases) {
                appendAll(repoEvents, fetchReleases(repo.name, headers));
            }
            if (types.pullRequests) {
                appendAll(repoEvents, fetchPullRequests(repo.name, headers));
            }
            if (types.forks) {
                appendAll(repoEvents, fetchForks(repo.name, headers));
            }
            if (types.issues) {
                appendAll(repoEvents, fetchIssues(repo.name, headers));
            }
            if (types.discussions) {
                appendAll(repoEvents, fetchDiscussions(repo.name, headers, token));
            }
        } catch (err) {
            sidefy.log("Failed for " + repo.name + ": " + (err && err.message ? err.message : err));
        }
        var merged = mergeRepositoryEvents(cached.events, repoEvents);
        var result = sidefy.storage.set(cacheKey, { events: merged, last: now.getTime(), expiresAt: expiresAt },
            Math.max(5, (expiresAt - now.getTime()) / 60000));
        if (result === false || (result && result.error)) {
            sidefy.log("Cache save failed for " + repo.name);
        }
        appendAll(events, merged);
    }
    return events;
}

function mergeRepositoryEvents(existing, incoming) {
    var events = [];
    var positions = Object.create(null);
    existing.concat(incoming).forEach(function (event) {
        var key = event.id;
        if (positions[key] === undefined) {
            positions[key] = events.length;
            events.push(event);
        } else {
            events[positions[key]] = event;
        }
    });
    return events;
}

function collectRepositories(config) {
    var repos = [];
    var seen = {};

    Object.keys(config || {}).forEach(function (key) {
        if (BUILTIN_KEYS[key]) {
            return;
        }
        var repoName = parseRepositoryName(key);
        if (!repoName) {
            return;
        }
        if (seen[repoName]) {
            return;
        }
        var types = parseEventTypes(config[key]);
        if (!types) {
            return;
        }
        seen[repoName] = true;
        repos.push({ name: repoName, types: types });
    });

    return repos;
}

function repositoryConfigHash(repos) {
    var normalized = repos.map(function (repo) {
        var enabledTypes = ALL_EVENT_TYPES.filter(function (type) {
            return repo.types[type];
        });
        return repo.name.toLowerCase() + ":" + enabledTypes.join(",");
    }).sort().join("|");

    var hash = 0;
    for (var i = 0; i < normalized.length; i++) {
        hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0).toString(16);
}

function parseRepositoryName(raw) {
    if (!raw || typeof raw !== "string") {
        return null;
    }
    var key = raw.trim();
    if (!key) {
        return null;
    }

    var urlMatch = key.match(/^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+?)(?:\.git)?\/?$/i);
    if (urlMatch) {
        return urlMatch[1] + "/" + urlMatch[2].replace(/\.git$/i, "");
    }

    if (/^[^\/\s]+\/[^\/\s]+$/.test(key)) {
        return key;
    }
    return null;
}

function parseEventTypes(raw) {
    if (raw === undefined || raw === null) {
        return typeSet(ALL_EVENT_TYPES);
    }
    var value = String(raw).trim();
    if (!value || value === "*" || value.toLowerCase() === "all" || value.toLowerCase() === "true" || value === "1") {
        return typeSet(ALL_EVENT_TYPES);
    }
    var lower = value.toLowerCase();
    if (lower === "false" || lower === "0" || lower === "off" || lower === "disabled") {
        return null;
    }

    var parts = value.split(/[,;\s]+/);
    var selected = [];
    for (var i = 0; i < parts.length; i++) {
        var part = normalizeEventType(parts[i]);
        if (part && selected.indexOf(part) === -1) {
            selected.push(part);
        }
    }
    if (selected.length === 0) {
        return typeSet(ALL_EVENT_TYPES);
    }
    return typeSet(selected);
}

function normalizeEventType(name) {
    var n = String(name || "").trim().toLowerCase();
    if (!n) {
        return null;
    }
    if (n === "stars" || n === "star") return "stars";
    if (n === "releases" || n === "release") return "releases";
    if (n === "pullrequests" || n === "pull_requests" || n === "pull-requests" || n === "prs" || n === "pr") {
        return "pullRequests";
    }
    if (n === "forks" || n === "fork") return "forks";
    if (n === "issues" || n === "issue") return "issues";
    if (n === "discussions" || n === "discussion") return "discussions";
    return null;
}

function typeSet(list) {
    var set = {};
    for (var i = 0; i < ALL_EVENT_TYPES.length; i++) {
        set[ALL_EVENT_TYPES[i]] = false;
    }
    for (var j = 0; j < list.length; j++) {
        set[list[j]] = true;
    }
    return set;
}

function defaultHeaders(token) {
    var headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/vnd.github.v3+json"
    };
    if (token) {
        headers["Authorization"] = "token " + token;
    }
    return headers;
}

function graphqlHeaders(token) {
    var headers = {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };
    if (token) {
        headers["Authorization"] = "bearer " + token;
    }
    return headers;
}

function httpGetJson(url, headers) {
    var response = sidefy.http.get(url, headers);
    if (!response) {
        return null;
    }
    try {
        return typeof response === "string" ? JSON.parse(response) : response;
    } catch (e) {
        sidefy.log("JSON parse failed for " + url);
        return null;
    }
}

function httpPostJson(url, body, headers) {
    var response = sidefy.http.post(url, body, headers);
    if (!response) {
        return null;
    }
    try {
        return typeof response === "string" ? JSON.parse(response) : response;
    } catch (e) {
        sidefy.log("JSON parse failed for POST " + url);
        return null;
    }
}

function appendAll(target, items) {
    if (!items || !items.length) {
        return;
    }
    for (var i = 0; i < items.length; i++) {
        target.push(items[i]);
    }
}

function isToday(date) {
    if (!date || isNaN(date.getTime())) {
        return false;
    }
    var now = new Date();
    return date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
}

function parseGitHubDate(value) {
    if (!value) {
        return null;
    }
    var date = new Date(value);
    if (isNaN(date.getTime())) {
        return null;
    }
    return date;
}

function avatarUrl(login) {
    return "https://github.com/" + encodeURIComponent(login) + ".png?size=40";
}

function pointEvent(opts) {
    var ts = opts.date.getTime() / 1000;
    return {
        id: opts.id || ((opts.eventType || "").replace(/^pr_.*/, "pr") + ":" + (opts.href || "")),
        attribution: opts.attribution,
        title: opts.title,
        startDate: sidefy.date.format(ts),
        endDate: sidefy.date.format(ts),
        color: opts.color,
        notes: opts.notes || "",
        icon: opts.icon || "",
        href: opts.href || "",
        eventType: opts.eventType || "",
        isAllDay: false,
        isPointInTime: true
    };
}

function splitOwnerRepo(repo) {
    var parts = repo.split("/");
    if (parts.length !== 2) {
        return null;
    }
    return { owner: parts[0], name: parts[1] };
}

function fetchStars(repo, headers, token) {
    // Prefer GraphQL STARRED_AT DESC so we can stop at "not today" without Link headers.
    var pair = splitOwnerRepo(repo);
    if (!pair) {
        return [];
    }

    var query =
        "{" +
        "repository(owner:\"" + escapeGraphQLString(pair.owner) + "\",name:\"" + escapeGraphQLString(pair.name) + "\"){" +
        "stargazers(first:100,orderBy:{field:STARRED_AT,direction:DESC}){" +
        "edges{starredAt node{login avatarUrl url}}" +
        "}}}";

    var data = httpPostJson("https://api.github.com/graphql", { query: query }, graphqlHeaders(token));
    var edges = data && data.data && data.data.repository && data.data.repository.stargazers
        ? data.data.repository.stargazers.edges
        : null;

    if (!edges) {
        // Fallback: first REST page (may miss today's stars on very popular repos).
        return fetchStarsRestFallback(repo, headers);
    }

    var events = [];
    for (var i = 0; i < edges.length; i++) {
        var edge = edges[i];
        var date = parseGitHubDate(edge.starredAt);
        if (!date) {
            continue;
        }
        if (!isToday(date)) {
            break;
        }
        var login = edge.node && edge.node.login ? edge.node.login : "unknown";
        var icon = (edge.node && edge.node.avatarUrl) || avatarUrl(login);
        events.push(pointEvent({
            attribution: repo,
            id: "star:" + repo.toLowerCase() + ":" + login.toLowerCase() + ":" + date.toISOString(),
            title: i18nStarred(login, repo),
            date: date,
            color: "#F1C232",
            icon: icon,
            href: "https://github.com/" + repo,
            eventType: "star"
        }));
    }
    return events;
}

function fetchStarsRestFallback(repo, headers) {
    var starHeaders = {};
    Object.keys(headers).forEach(function (k) {
        starHeaders[k] = headers[k];
    });
    starHeaders["Accept"] = "application/vnd.github.v3.star+json";

    var data = httpGetJson(
        "https://api.github.com/repos/" + repo + "/stargazers?per_page=100",
        starHeaders
    );
    if (!Array.isArray(data)) {
        return [];
    }

    var events = [];
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        var date = parseGitHubDate(item.starred_at);
        if (!date || !isToday(date)) {
            continue;
        }
        var login = item.user && item.user.login ? item.user.login : "unknown";
        events.push(pointEvent({
            attribution: repo,
            id: "star:" + repo.toLowerCase() + ":" + login.toLowerCase() + ":" + date.toISOString(),
            title: i18nStarred(login, repo),
            date: date,
            color: "#F1C232",
            icon: (item.user && item.user.avatar_url) || avatarUrl(login),
            href: "https://github.com/" + repo,
            eventType: "star"
        }));
    }
    return events;
}

function fetchReleases(repo, headers) {
    var data = httpGetJson("https://api.github.com/repos/" + repo + "/releases?per_page=30", headers);
    if (!Array.isArray(data)) {
        return [];
    }

    var events = [];
    for (var i = 0; i < data.length; i++) {
        var release = data[i];
        if (release.draft) {
            continue;
        }
        var date = parseGitHubDate(release.published_at);
        if (!date || !isToday(date)) {
            continue;
        }
        var login = release.author && release.author.login ? release.author.login : "unknown";
        var notes = release.name || release.tag_name || "";
        if (release.body) {
            notes = notes + "\n\n" + release.body;
        }
        events.push(pointEvent({
            attribution: repo,
            title: i18nReleased(repo, release.tag_name),
            date: date,
            color: release.prerelease ? "#FF9500" : "#34C759",
            notes: notes,
            icon: (release.author && release.author.avatar_url) || avatarUrl(login),
            href: release.html_url || ("https://github.com/" + repo + "/releases"),
            eventType: "release"
        }));
    }
    return events;
}

function fetchPullRequests(repo, headers) {
    var data = httpGetJson(
        "https://api.github.com/repos/" + repo + "/pulls?state=all&sort=created&direction=desc&per_page=50",
        headers
    );
    if (!Array.isArray(data)) {
        return [];
    }

    var events = [];
    for (var i = 0; i < data.length; i++) {
        var pr = data[i];
        if (pr.draft) {
            continue;
        }
        var date = parseGitHubDate(pr.created_at);
        if (!date) {
            continue;
        }
        if (!isToday(date)) {
            break;
        }
        var login = pr.user && pr.user.login ? pr.user.login : "unknown";
        var status = prStatus(pr);
        events.push(pointEvent({
            attribution: repo,
            title: "[" + status.label + "] " + i18nCreatedPR(login, repo),
            date: date,
            color: status.color,
            notes: pr.title || "",
            icon: (pr.user && pr.user.avatar_url) || avatarUrl(login),
            href: pr.html_url || "",
            eventType: status.eventType
        }));
    }
    return events;
}

function prStatus(pr) {
    if (pr.state === "open") {
        return { label: sidefy.i18n(I18N_STATUS_OPEN), color: "#007AFF", eventType: "pr_open" };
    }
    if (pr.merged_at) {
        return { label: sidefy.i18n(I18N_STATUS_MERGED), color: "#34C759", eventType: "pr_merged" };
    }
    return { label: sidefy.i18n(I18N_STATUS_CLOSED), color: "#FF3B30", eventType: "pr_closed" };
}

function fetchForks(repo, headers) {
    var data = httpGetJson(
        "https://api.github.com/repos/" + repo + "/forks?sort=newest&per_page=100",
        headers
    );
    if (!Array.isArray(data)) {
        return [];
    }

    var events = [];
    for (var i = 0; i < data.length; i++) {
        var fork = data[i];
        var date = parseGitHubDate(fork.created_at);
        if (!date) {
            continue;
        }
        if (!isToday(date)) {
            break;
        }
        var login = fork.owner && fork.owner.login ? fork.owner.login : "unknown";
        events.push(pointEvent({
            attribution: repo,
            title: i18nForked(login, repo),
            date: date,
            color: "#AF52DE",
            icon: (fork.owner && fork.owner.avatar_url) || avatarUrl(login),
            href: fork.html_url || "",
            eventType: "fork"
        }));
    }
    return events;
}

function fetchIssues(repo, headers) {
    var data = httpGetJson(
        "https://api.github.com/repos/" + repo + "/issues?state=all&sort=created&direction=desc&per_page=100",
        headers
    );
    if (!Array.isArray(data)) {
        return [];
    }

    var events = [];
    for (var i = 0; i < data.length; i++) {
        var issue = data[i];
        if (issue.pull_request) {
            continue;
        }
        var date = parseGitHubDate(issue.created_at);
        if (!date) {
            continue;
        }
        if (!isToday(date)) {
            break;
        }
        var login = issue.user && issue.user.login ? issue.user.login : "unknown";
        var open = issue.state === "open";
        events.push(pointEvent({
            attribution: repo,
            title: "[" + sidefy.i18n(open ? I18N_STATUS_OPEN : I18N_STATUS_CLOSED) + "] " +
                i18nCreatedIssue(login, repo),
            date: date,
            color: open ? "#FF3B30" : "#34C759",
            notes: issue.title || "",
            icon: (issue.user && issue.user.avatar_url) || avatarUrl(login),
            href: issue.html_url || "",
            eventType: "issue"
        }));
    }
    return events;
}

function fetchDiscussions(repo, headers, token) {
    var pair = splitOwnerRepo(repo);
    if (!pair) {
        return [];
    }

    var query =
        "{" +
        "repository(owner:\"" + escapeGraphQLString(pair.owner) + "\",name:\"" + escapeGraphQLString(pair.name) + "\"){" +
        "discussions(first:50,orderBy:{field:CREATED_AT,direction:DESC}){" +
        "nodes{number title body author{login avatarUrl} createdAt url category{name} isAnswered}" +
        "}}}";

    var data = httpPostJson("https://api.github.com/graphql", { query: query }, graphqlHeaders(token));
    var nodes = data && data.data && data.data.repository && data.data.repository.discussions
        ? data.data.repository.discussions.nodes
        : null;
    if (!Array.isArray(nodes)) {
        return [];
    }

    var events = [];
    for (var i = 0; i < nodes.length; i++) {
        var discussion = nodes[i];
        var date = parseGitHubDate(discussion.createdAt);
        if (!date) {
            continue;
        }
        if (!isToday(date)) {
            break;
        }
        var login = discussion.author && discussion.author.login ? discussion.author.login : "unknown";
        var notes = discussion.title || "";
        if (discussion.body) {
            notes = notes + "\n\n" + discussion.body;
        }
        events.push(pointEvent({
            attribution: repo,
            title: i18nDiscussion(login, repo),
            date: date,
            color: "#FF9500",
            notes: notes,
            icon: (discussion.author && discussion.author.avatarUrl) || avatarUrl(login),
            href: discussion.url || "",
            eventType: "discussion"
        }));
    }
    return events;
}

function escapeGraphQLString(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

// --- i18n ---

var I18N_STATUS_OPEN = {
    zh: "开启",
    en: "Open",
    ja: "オープン",
    ko: "열림",
    de: "Offen",
    es: "Abierto",
    fr: "Ouvert",
    pt: "Aberto",
    ru: "Открыт"
};

var I18N_STATUS_MERGED = {
    zh: "已合并",
    en: "Merged",
    ja: "マージ済み",
    ko: "병합됨",
    de: "Zusammengeführt",
    es: "Fusionado",
    fr: "Fusionné",
    pt: "Mesclado",
    ru: "Объединён"
};

var I18N_STATUS_CLOSED = {
    zh: "已关闭",
    en: "Closed",
    ja: "クローズ",
    ko: "닫힘",
    de: "Geschlossen",
    es: "Cerrado",
    fr: "Fermé",
    pt: "Fechado",
    ru: "Закрыт"
};

function i18nStarred(login, repo) {
    return sidefy.i18n({
        zh: login + " 标星了 " + repo,
        en: login + " starred " + repo,
        ja: login + " が " + repo + " をスターしました",
        ko: login + "님이 " + repo + "에 스타를 했습니다",
        de: login + " hat " + repo + " markiert",
        es: login + " marcó " + repo,
        fr: login + " a ajouté une étoile à " + repo,
        pt: login + " adicionou estrela a " + repo,
        ru: login + " отметил " + repo + " звездой"
    });
}

function i18nReleased(repo, tag) {
    return sidefy.i18n({
        zh: repo + " 发布了 " + tag,
        en: repo + " released " + tag,
        ja: repo + " が " + tag + " をリリースしました",
        ko: repo + "에서 " + tag + "을(를) 릴리스했습니다",
        de: repo + " hat " + tag + " veröffentlicht",
        es: repo + " publicó " + tag,
        fr: repo + " a publié " + tag,
        pt: repo + " lançou " + tag,
        ru: repo + " выпустил " + tag
    });
}

function i18nCreatedPR(login, repo) {
    return sidefy.i18n({
        zh: login + " 在 " + repo + " 创建了拉取请求",
        en: login + " created PR in " + repo,
        ja: login + " が " + repo + " でプルリクエストを作成しました",
        ko: login + "님이 " + repo + "에서 풀 리퀘스트를 생성했습니다",
        de: login + " hat einen Pull Request in " + repo + " erstellt",
        es: login + " creó una solicitud de extracción en " + repo,
        fr: login + " a créé une pull request dans " + repo,
        pt: login + " criou um pull request em " + repo,
        ru: login + " создал pull request в " + repo
    });
}

function i18nForked(login, repo) {
    return sidefy.i18n({
        zh: login + " 分叉了 " + repo,
        en: login + " forked " + repo,
        ja: login + " が " + repo + " をフォークしました",
        ko: login + "님이 " + repo + "를 포크했습니다",
        de: login + " hat " + repo + " geforkt",
        es: login + " bifurcó " + repo,
        fr: login + " a forké " + repo,
        pt: login + " fez fork de " + repo,
        ru: login + " создал форк " + repo
    });
}

function i18nCreatedIssue(login, repo) {
    return sidefy.i18n({
        zh: login + " 在 " + repo + " 创建了议题",
        en: login + " created issue in " + repo,
        ja: login + " が " + repo + " で Issue を作成しました",
        ko: login + "님이 " + repo + "에서 이슈를 생성했습니다",
        de: login + " hat ein Issue in " + repo + " erstellt",
        es: login + " creó un issue en " + repo,
        fr: login + " a créé une issue dans " + repo,
        pt: login + " criou uma issue em " + repo,
        ru: login + " создал issue в " + repo
    });
}

function i18nDiscussion(login, repo) {
    return sidefy.i18n({
        zh: login + " 在 " + repo + " 发起了讨论",
        en: login + " started discussion in " + repo,
        ja: login + " が " + repo + " でディスカッションを開始しました",
        ko: login + "님이 " + repo + "에서 토론을 시작했습니다",
        de: login + " hat eine Diskussion in " + repo + " gestartet",
        es: login + " inició una discusión en " + repo,
        fr: login + " a lancé une discussion dans " + repo,
        pt: login + " iniciou uma discussão em " + repo,
        ru: login + " начал обсуждение в " + repo
    });
}
