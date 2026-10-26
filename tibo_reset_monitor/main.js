function fetchEvents(config) {
    var saved = nunc.storage.get("tibo-reset-history-v2");
    var history = Array.isArray(saved) ? saved : [];
    var cutoff = Date.now() - 7 * 86400000;
    history = history.filter(function(item) { return item && typeof item.id === "string" && item.time >= cutoff; });
    try {
        if (!nunc.ai || typeof nunc.ai.decide !== "function") throw new Error("nunc.ai.decide is unavailable");
        var page = nunc.storage.get("tibo-profile-v1");
        if (!page || typeof page.content !== "string") {
            page = nunc.crawler("https://x.com/thsottiaux");
            if (!page || page.success !== true || typeof page.content !== "string") throw new Error("X profile fetch failed");
            nunc.storage.set("tibo-profile-v1", {content: page.content}, 5);
        }
        var posts = parseTiboPosts(page.content);
        if (!posts.length) throw new Error("No readable posts: X may require login or its page format changed");
        var count = 0;
        posts.slice(0, 20).forEach(function(post) {
            if (post.time < cutoff || post.time > Date.now() + 300000) return;
            var key = "decision-v2-" + post.id;
            var cached = nunc.storage.get(key);
            var category;
            if (cached && cached.text === post.text && typeof cached.category === "string") {
                category = cached.category;
            } else {
                if (count >= 5) return;
                count++;
                category = nunc.ai.decide({author: "@thsottiaux", context: "Tibo posts about Codex and ChatGPT Work usage resets. Classify only this post, not quoted content.", post: post.text}, {choice: RESET_CATEGORIES});
                if (category === null) {
                    nunc.log("AI decision unavailable for " + post.id);
                    return;
                }
                nunc.storage.set(key, {text: post.text, category: category}, 1440);
            }
            nunc.log(post.id + " category=" + category);
            history = history.filter(function(item) { return item.id !== post.id; });
            if (category === "announcement") history.push({id: post.id, text: post.text, time: post.time});
        });
        history.sort(function(a, b) { return b.time - a.time; });
        history = history.slice(0, 40);
        nunc.storage.set("tibo-reset-history-v2", history, 1440);
    } catch (error) {
        nunc.log("Tibo reset monitor: " + error.message);
    }
    return history.map(function(post) {
        var stamp = nunc.date.format(post.time / 1000);
        return {
            title: "Tibo: ChatGPT / Codex usage reset",
            startDate: stamp,
            endDate: stamp,
            color: "#10A37F",
            isAllDay: false,
            isPointInTime: true,
            notes: "@thsottiaux\n\n" + post.text,
            href: "https://x.com/thsottiaux/status/" + post.id
        };
    });
}

function parseTiboPosts(content) {
    var seen = {};
    var posts = [];
    content.split(/\n\*\s+/).slice(1).forEach(function(block) {
        // Only top-level posts authored by Tibo, never quoted posts or other authors.
        var first = block.match(/^\[\]\(https:\/\/x\.com\/([^/]+)\/status\/(\d+)\)/);
        if (!first || first[1].toLowerCase() !== "thsottiaux" || seen[first[2]]) return;
        var id = first[2];
        var timeLink = new RegExp("\\[[^\\]\\n]+\\]\\(https://x\\.com/thsottiaux/status/" + id + "\\)");
        var timeMatch = timeLink.exec(block);
        if (!timeMatch) return;
        var text = block.slice(timeMatch.index + timeMatch[0].length);
        var engagement = text.search(/\[[^\]]*\]\(https:\/\/x\.com\/compose\/post\?in_reply_to=/);
        if (engagement >= 0) text = text.slice(0, engagement);
        var quote = text.search(/\[\]\(https:\/\/x\.com\/[^/]+\/status\/\d+\)(?!\/)/);
        if (quote >= 0) text = text.slice(0, quote);
        text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
            .replace(/\[\]\([^)]*\)/g, "")
            .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
            .replace(/\s+/g, " ").trim();
        if (!text) return;
        var time = Number((BigInt(id) >> BigInt(22)) + BigInt("1288834974657"));
        if (!isFinite(time)) return;
        seen[id] = true;
        posts.push({id: id, text: text, time: time});
    });
    return posts.sort(function(a, b) { return b.time - a.time; });
}

var RESET_CATEGORIES = {
    "announcement": "A concrete NEW ChatGPT/Codex usage quota reset is announced, granted, or scheduled. Includes 'Day N/ Reset', 'Rest and reset', 'today is a reset', or 'Le limit reset'.",
    "plan": "A general future policy, conditional promise, alternative ('either ship an improvement OR reset'), poll, speculation, or request. No specific reset has been chosen or announced.",
    "followup": "Only timing or completion of an already announced reset, e.g. 'Done', 'It is all propagated', 'By midnight PST'.",
    "other": "No usage quota reset announcement: product improvements, recruitment, daily life, or unrelated resets."
};

