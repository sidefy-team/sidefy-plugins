/**
 * Countdown Day Plugin
 * Displays how many days are left until a specified date in the timeline.
 */
function fetchEvents(config) {
    var targetDateStr = config.target_date;
    var eventName = config.event_name || sidefy.i18n(I18N_DEFAULT_EVENT_NAME);
    var warningDays = config.warning_days || 3;

    if (!targetDateStr) {
        return [];
    }

    try {
        var today = new Date();
        var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        var targetDate = new Date(targetDateStr);
        var targetDateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

        var diffTime = targetDateStart.getTime() - todayStart.getTime();
        var diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        var message = "";
        var color = "#3498db";

        if (diffDays > 0) {
            message = i18nCountdownFuture(eventName, diffDays);
            if (diffDays <= warningDays) {
                color = "#f39c12";
            }
        } else if (diffDays === 0) {
            message = i18nCountdownToday(eventName);
            color = "#e74c3c";
        } else {
            message = i18nCountdownPast(eventName, Math.abs(diffDays));
            color = "#95a5a6";
        }

        var eventDate = new Date();
        var timestamp = eventDate.getTime() / 1000;

        return [{
            title: message,
            startDate: sidefy.date.format(timestamp),
            endDate: sidefy.date.format(timestamp),
            color: color,
            isAllDay: true,
            isPointInTime: true
        }];
    } catch (err) {
        throw new Error(i18nExecutionFailed(err.message));
    }
}

// --- i18n ---

var I18N_DEFAULT_EVENT_NAME = {
    zh: "重要日子",
    en: "Important Day",
    ja: "大切な日",
    ko: "중요한 날"
};

function i18nCountdownFuture(eventName, diffDays) {
    return sidefy.i18n({
        zh: "距离 " + eventName + " 还有 " + diffDays + " 天",
        en: diffDays + " days until " + eventName,
        ja: eventName + "まであと" + diffDays + "日",
        ko: eventName + "까지 " + diffDays + "일 남음"
    });
}

function i18nCountdownToday(eventName) {
    return sidefy.i18n({
        zh: "今天是 " + eventName + "！",
        en: "Today is " + eventName + "!",
        ja: "今日は" + eventName + "！",
        ko: "오늘은 " + eventName + "!"
    });
}

function i18nCountdownPast(eventName, absDiff) {
    return sidefy.i18n({
        zh: eventName + " 已经过去 " + absDiff + " 天",
        en: eventName + " was " + absDiff + " days ago",
        ja: eventName + "から" + absDiff + "日経過",
        ko: eventName + "이(가) " + absDiff + "일 지남"
    });
}

function i18nExecutionFailed(message) {
    return sidefy.i18n({
        zh: "倒计时日插件执行失败: " + message,
        en: "Countdown Day plugin execution failed: " + message,
        ja: "カウントダウン日プラグインの実行に失敗しました: " + message,
        ko: "카운트다운 플러그인 실행 실패: " + message
    });
}
