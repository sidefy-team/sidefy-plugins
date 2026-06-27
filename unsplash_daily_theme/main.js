/**
 * Unsplash 每日图片插件
 * 每天获取一张 Unsplash 热门首页图片，在0点显示为全天事件。
 */
function fetchEvents(config) {
    // 检查 API 访问密钥是否存在
    var accessKey = config.access_key;
    if (!accessKey || accessKey.trim() === "") {
        throw new Error(sidefy.i18n(I18N_ERROR_EMPTY_ACCESS_KEY));
    }

    // --- 每日缓存逻辑 ---
    var today = new Date();
    var dateString = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    var cacheKey = "unsplash_daily_photo_" + dateString;

    var cachedData = sidefy.storage.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // 计算到当天结束剩余的分钟数
    var endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    var remainingMinutes = Math.ceil((endOfDay.getTime() - today.getTime()) / (1000 * 60));

    // --- 获取热门首页图片 ---
    var events = [];
    try {
        // 获取 Unsplash 热门首页图片
        var url = "https://api.unsplash.com/photos/random?order_by=popular&orientation=landscape";

        var headers = {
            "Authorization": "Client-ID " + accessKey,
            "Accept-Version": "v1"
        };

        var response = sidefy.http.get(url, headers);
        if (!response) {
            throw new Error(sidefy.i18n(I18N_ERROR_FETCH_FAILED));
        }

        var photo = JSON.parse(response);
        if (photo.errors) {
            throw new Error(i18nApiError(photo.errors.join(", ")));
        }

        // --- 创建时间线事件 ---
        var eventDate = new Date();
        eventDate.setHours(0, 0, 0, 0); // 设置为0点

        var title = photo.alt_description || sidefy.i18n(I18N_DEFAULT_TITLE);
        var notes = i18nPhotographer(photo.user.name);
        if (photo.description) {
            notes += "\n" + i18nDescription(photo.description);
        }

        events.push({
            title: title,
            startDate: sidefy.date.format(eventDate.getTime() / 1000),
            endDate: sidefy.date.format(eventDate.getTime() / 1000),
            color: photo.color || "#666666",
            notes: notes,
            href: photo.links.html,
            icon: photo.user.profile_image.small, // 作者头像
            imageURL: photo.urls.small, // 使用 small 尺寸作为预览图
            isAllDay: true, // 设置为全天事件
            isPointInTime: false
        });

        // 将成功获取的事件缓存到当天结束
        if (events.length === 1) {
            sidefy.storage.set(cacheKey, events, remainingMinutes);
        } else {
            throw new Error(sidefy.i18n(I18N_ERROR_FETCH_UNSUCCESSFUL));
        }

    } catch (err) {
        throw new Error(i18nExecutionFailed(err.message));
    }

    return events;
}

// --- i18n ---

var I18N_DEFAULT_TITLE = {
    zh: "Unsplash 每日精选",
    en: "Unsplash Daily Pick",
    ja: "Unsplash 今日の一枚",
    ko: "Unsplash 오늘의 사진"
};

var I18N_ERROR_EMPTY_ACCESS_KEY = {
    zh: "请在插件配置中填入您的 Unsplash API 访问密钥 (Access Key)。",
    en: "Please enter your Unsplash API Access Key in the plugin configuration.",
    ja: "プラグイン設定に Unsplash API アクセスキーを入力してください。",
    ko: "플러그인 설정에서 Unsplash API 액세스 키를 입력하세요."
};

var I18N_ERROR_FETCH_FAILED = {
    zh: "获取 Unsplash 热门图片失败，请检查网络或API密钥。",
    en: "Failed to fetch popular Unsplash photo. Please check your network or API key.",
    ja: "Unsplashの人気写真の取得に失敗しました。ネットワークまたはAPIキーを確認してください。",
    ko: "Unsplash 인기 사진을 가져오는데 실패했습니다. 네트워크 또는 API 키를 확인하세요."
};

var I18N_ERROR_FETCH_UNSUCCESSFUL = {
    zh: "未能成功获取图片。",
    en: "Failed to fetch photo successfully.",
    ja: "写真を正常に取得できませんでした。",
    ko: "사진을 성공적으로 가져오지 못했습니다."
};

function i18nApiError(errors) {
    return sidefy.i18n({
        zh: "Unsplash API 错误: " + errors,
        en: "Unsplash API error: " + errors,
        ja: "Unsplash API エラー: " + errors,
        ko: "Unsplash API 오류: " + errors
    });
}

function i18nPhotographer(name) {
    return sidefy.i18n({
        zh: "摄影师: " + name,
        en: "Photographer: " + name,
        ja: "写真家: " + name,
        ko: "사진가: " + name
    });
}

function i18nDescription(description) {
    return sidefy.i18n({
        zh: "描述: " + description,
        en: "Description: " + description,
        ja: "説明: " + description,
        ko: "설명: " + description
    });
}

function i18nExecutionFailed(message) {
    return sidefy.i18n({
        zh: "Unsplash 插件执行失败: " + message,
        en: "Unsplash plugin execution failed: " + message,
        ja: "Unsplash プラグインの実行に失敗しました: " + message,
        ko: "Unsplash 플러그인 실행 실패: " + message
    });
}
