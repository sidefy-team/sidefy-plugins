function fetchEvents(config) {
    var username = String(config.username || "").trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) throw new Error(nunc.i18n(I18N_USERNAME));
    var now = Date.now();
    var midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    var expiresAt = midnight.getTime();
    var key = "x_posts_daily_v3_" + username.toLowerCase();
    var cached = nunc.storage.get(key);
    if (!cached || cached.expiresAt <= now || cached.expiresAt !== expiresAt || !Array.isArray(cached.posts)) {
        cached = { posts: [], last: 0, expiresAt: expiresAt };
    }
    var posts = cached.posts;
    var interval = posts.length ? 15 : 5;
    if (!cached.last || now - cached.last >= interval * 60000) {
        var incoming = [];
        try {
            var page = nunc.crawler("https://x.com/" + username);
            if (!page || page.success !== true || typeof page.content !== "string") throw new Error(nunc.i18n(I18N_CRAWLER));
            var blocks = page.content.split(/\n\s*\*\s+/);
            var seen = {};
            blocks.forEach(function(block) {
                var first = /\[[^\]\n]*\]\(https:\/\/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/status\/(\d+)\)/.exec(block);
                if (!first || first[1].toLowerCase() !== username.toLowerCase() || seen[first[2]]) return;
                var id = first[2];
                var timeLink = new RegExp("\\[([^\\]\\n]+)\\]\\(https:\\/\\/(?:x\\.com|twitter\\.com)\\/" + first[1] + "\\/status\\/" + id + "\\)");
                var timeMatch = timeLink.exec(block);
                if (!timeMatch) return;
                var body = block.slice(timeMatch.index + timeMatch[0].length);
                if (/^\s*Replying to\b/i.test(body)) return;
                var footer = new RegExp("\\[\\d[^\\]]*\\]\\(https:\\/\\/(?:x\\.com|twitter\\.com)\\/compose\\/post\\?in_reply_to=" + id + "\\)");
                var footerMatch = footer.exec(body);
                if (footerMatch) body = body.slice(0, footerMatch.index);
                var image = /!\[[^\]]*\]\((https:\/\/pbs\.twimg\.com\/(?:media|amplify_video_thumb|ext_tw_video_thumb)\/[^)]+)\)/.exec(body);
                body = body.replace(/!\[[^\]]*\]\([^)]+\)/g, "")
                           .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
                           .replace(/\\(["'_*])/g, "$1")
                           .replace(/\s+/g, " ").trim();
                if (!body) body = nunc.i18n(I18N_MEDIA);
                var seconds = (Math.floor(Number(id) / 4194304) + 1288834974657) / 1000;
                if (!isFinite(seconds) || seconds < 1288834974 || seconds > Date.now() / 1000 + 300) return;
                seen[id] = true;
                incoming.push({ id: id, text: body, seconds: seconds, image: image ? image[1] : "" });
            });
            if (!incoming.length) throw new Error(nunc.i18n(I18N_EMPTY));
        } catch (error) {
            nunc.log(error && error.message ? error.message : String(error));
        }
        var byId = Object.create(null);
        posts.concat(incoming).forEach(function(post) { byId[post.id] = post; });
        posts = Object.keys(byId).map(function(id) { return byId[id]; });
        posts.sort(function(a, b) { return b.seconds - a.seconds; });
        posts = posts.slice(0, 30);
        var saved = nunc.storage.set(key, { posts: posts, last: now, expiresAt: expiresAt },
            Math.min(1440, Math.max(5, (expiresAt - now) / 60000)));
        if (!saved || saved.error || saved.success === false) nunc.log(nunc.i18n(I18N_CACHE));
        nunc.log("Fetched @" + username + ": " + incoming.length + " posts; retained " + posts.length);
    } else {
        nunc.log("Using daily cache for @" + username);
    }
    return posts.map(function(post) {
        var stamp = nunc.date.format(post.seconds);
        var characters = Array.from(post.text);
        var event = {
            title: "@" + username + " · " + (characters.length > 64 ? characters.slice(0, 64).join("") + "…" : post.text),
            notes: post.text,
            startDate: stamp,
            endDate: stamp,
            color: "#1D9BF0",
            isAllDay: false,
            isPointInTime: true,
            href: "https://x.com/" + username + "/status/" + post.id
        };
        if (post.image) event.imageURL = post.image;
        return event;
    });
}

var I18N_USERNAME = {
    "zh": "username 请填写一个 X 用户名，不含网址",
    "en": "Enter one X username, not a URL.",
    "ja": "URLではなく、Xのユーザー名を1つ入力してください。",
    "ko": "URL 대신 X 사용자 이름 하나를 입력하세요."
};

var I18N_CRAWLER = {
    "zh": "X 页面抓取失败，请检查爬虫服务配置",
    "en": "Failed to retrieve X profile. Check crawler settings.",
    "ja": "Xプロフィールを取得できません。クローラーの設定を確認してください。",
    "ko": "X 프로필을 가져오지 못했습니다. 크롤러 설정을 확인하세요."
};

var I18N_MEDIA = {
    "zh": "查看图片或视频",
    "en": "View image or video",
    "ja": "画像または動画を見る",
    "ko": "이미지 또는 동영상 보기"
};

var I18N_EMPTY = {
    "zh": "页面未解析到公开帖子，可能需要登录或页面结构已变化；保留已有缓存",
    "en": "No public posts could be parsed. X may require login or its layout may have changed. Existing cached posts are retained.",
    "ja": "公開ポストを解析できませんでした。ログインが必要か、ページ構造が変更された可能性があります。既存のキャッシュは保持されます。",
    "ko": "공개 게시물을 분석하지 못했습니다. 로그인이 필요하거나 페이지 구조가 변경되었을 수 있습니다. 기존 캐시 게시물은 유지됩니다."
};

var I18N_CACHE = {
    "zh": "缓存未写入，下次刷新可能重新抓取",
    "en": "Cache write failed; the next refresh may retrieve the profile again.",
    "ja": "キャッシュを保存できませんでした。次回の更新時に再取得する場合があります。",
    "ko": "캐시 저장에 실패했습니다. 다음 새로고침 시 프로필을 다시 가져올 수 있습니다."
};
