// Bilibili 用户视频插件 - 按用户 ID 缓存
// 作者: 李慕白
function fetchEvents(config) {
    var POLL_INTERVAL = 10 * 60 * 1000;
    var MAX_MIDS = 10;
    var VIDEOS_PER_MID = 10;

    var now = Date.now();
    var today = getTodayKey();
    var CACHE_KEY = "bili_index_v2_" + today;
    var midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    var expiresAt = midnight.getTime();

    // 2. 解析配置（带去重）
    var mids = parseMids(config.mids);
    // 3. 读取或初始化存储
    var index = sidefy.storage.get(CACHE_KEY);
    var storage = index ? loadUsers(index) : null;
    if (storage && ((storage.meta.expiresAt && now >= storage.meta.expiresAt) ||
                    (storage.meta.date && storage.meta.date !== today))) {
        storage = null;
    }
    if (!storage) {
        storage = initStorage(mids);
    }

    // 4. 配置变化只重置轮询，不删除已保存的视频
    if (storage.meta.mids.join(',') !== mids.join(',')) {
        storage.meta.idx = 0;
        storage.meta.last = 0;
    }
    storage.meta.mids = mids;
    storage.meta.date = today;
    storage.meta.expiresAt = expiresAt;

    // 5. 判断是否需要轮询
    var shouldPoll = mids.length > 0 && (now - storage.meta.last) >= POLL_INTERVAL;

    if (shouldPoll) {
        // 轮询：查询一个 UP 主
        pollNextMid(storage, VIDEOS_PER_MID);

        // 更新轮询时间
        storage.meta.last = now;

    }

    // 客户端 TTL 最短为 5 分钟；expiresAt 保证午夜后不返回旧缓存
    var ttlMinutes = Math.max(5, (expiresAt - now) / 60000);
    var savedIndex = { meta: storage.meta, data: {} };
    for (var mid in storage.data) {
        saveCache(userKey(mid), { vids: storage.data[mid].vids || [], expiresAt: expiresAt }, ttlMinutes);
        savedIndex.data[mid] = {};
    }
    saveCache(CACHE_KEY, savedIndex, ttlMinutes);

    // 6. 返回所有事件
    return buildEvents(storage, config);


    // ==================== 辅助函数 ====================

    function userKey(mid) {
        return "bili_user_v1_" + today + "_" + mid;
    }

    function loadUsers(index) {
        var result = { meta: index.meta, data: {} };
        for (var mid in index.data) {
            var cached = sidefy.storage.get(userKey(mid));
            if (cached && cached.expiresAt > now) {
                result.data[mid] = { vids: cached.vids || [] };
            }
        }
        return result;
    }

    function saveCache(key, value, ttlMinutes) {
        var result = sidefy.storage.set(key, value, ttlMinutes);
        if (result === false || (result && result.error)) {
            throw new Error("视频缓存保存失败，已有存储未删除");
        }
    }

    /**
     * 获取今天的日期字符串
     */
    function getTodayKey() {
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        return year + "-" + month + "-" + day;
    }

    /**
     * 解析并去重 mid 字符串
     */
    function parseMids(midStr) {
        if (!midStr) return [];

        var mids = midStr.split(',')
            .map(function(m) { return m.trim(); })
            .filter(function(m) { return m.length > 0; });

        // 去重
        var uniqueMids = {};
        var result = [];

        for (var i = 0; i < mids.length; i++) {
            var mid = mids[i];
            if (!uniqueMids[mid]) {
                uniqueMids[mid] = true;
                result.push(mid);
            }
        }

        return result.slice(0, MAX_MIDS);
    }

    /**
     * 初始化存储结构
     */
    function initStorage(mids) {
        return {
            meta: {
                mids: mids,
                idx: 0,
                last: 0
            },
            data: {}
        };
    }

    /**
     * 查询下一个 UP 主（轮询）
     */
    function pollNextMid(storage, pageSize) {
        var mids = storage.meta.mids;
        if (mids.length === 0) return;

        var idx = storage.meta.idx % mids.length;
        var mid = mids[idx];

        try {
            var videos = fetchBilibiliVideos(mid, pageSize);

            var existing = storage.data[mid] ? storage.data[mid].vids || [] : [];
            var merged = [];
            var positions = Object.create(null);
            existing.concat(videos).forEach(function(video) {
                if (!video.b) return;
                if (positions[video.b] === undefined) {
                    positions[video.b] = merged.length;
                    merged.push(video);
                } else {
                    merged[positions[video.b]] = video;
                }
            });
            storage.data[mid] = { vids: merged };
        } catch (err) {
            // 查询失败，保持原有数据不变
        }

        storage.meta.idx = (idx + 1) % mids.length;
    }

    /**
     * 调用 B 站 API 获取视频（只保留今天发布的）
     */
    function fetchBilibiliVideos(mid, pageSize) {
        var url = "https://api.bilibili.com/x/space/arc/search?mid=" + mid +
                  "&pn=1&ps=" + pageSize + "&order=pubdate";

        var headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36",
            "Accept": "application/json",
            "Referer": "https://www.bilibili.com/"
        };

        var maxRetries = 3;
        var response = null;

        for (var attempt = 0; attempt < maxRetries; attempt++) {
            try {
                response = sidefy.http.get(url, headers);
                if (response && response.length > 0) {
                    var data = JSON.parse(response);
                    if (data.code === 0) {
                        break;
                    } else if (data.code === -799) {
                        if (attempt < maxRetries - 1) {
                            sleep(5000);
                        }
                    } else {
                        throw new Error("API 返回错误: " + data.code);
                    }
                }
            } catch (err) {
                if (attempt === maxRetries - 1) {
                    throw err;
                }
                sleep(3000);
            }
        }

        if (!response) {
            throw new Error("HTTP 请求失败");
        }

        var data = JSON.parse(response);
        if (data.code !== 0 || !data.data || !data.data.list || !data.data.list.vlist) {
            throw new Error("API 返回格式错误");
        }

        // 获取今天的时间范围
        var today = getTodayKey();
        var todayStart = new Date(today + "T00:00:00").getTime() / 1000;
        var todayEnd = new Date(today + "T23:59:59").getTime() / 1000;

        var videos = [];
        var vlist = data.data.list.vlist;

        for (var i = 0; i < vlist.length; i++) {
            var v = vlist[i];

            // 只保留今天发布的视频
            if (v.created >= todayStart && v.created <= todayEnd) {
                videos.push({
                    t: v.title,
                    d: v.created,
                    b: v.bvid,
                    p: v.pic,
                    a: v.author,
                    pc: v.play || 0,
                    dc: v.video_review || 0,
                    l: v.length
                });
            }
        }

        return videos;
    }

    /**
     * 构建事件列表
     */
    function buildEvents(storage, config) {
        var events = [];

        for (var mid in storage.data) {
            var upData = storage.data[mid];

            var videos = upData.vids || [];
            for (var i = 0; i < videos.length; i++) {
                var v = videos[i];

                var playCount = formatCount(v.pc);
                var danmakuCount = formatCount(v.dc);

                events.push({
                    title: v.t,
                    startDate: sidefy.date.format(v.d),
                    endDate: sidefy.date.format(v.d),
                    color: "#FB7299",
                    icon: config.icon,
                    notes: "UP主: " + v.a +
                           "\n播放: " + playCount +
                           "\n弹幕: " + danmakuCount +
                           "\n时长: " + v.l,
                    isAllDay: false,
                    isPointInTime: true,
                    href: "https://www.bilibili.com/video/" + v.b,
                    imageURL: v.p
                });
            }
        }

        return events;
    }

    /**
     * 格式化数字
     */
    function formatCount(count) {
        if (!count || count === 0) return "0";
        if (count >= 100000000) return (count / 100000000).toFixed(1) + "亿";
        if (count >= 10000) return (count / 10000).toFixed(1) + "万";
        return count.toString();
    }

    /**
     * 同步延迟
     */
    function sleep(ms) {
        var endTime = Date.now() + ms;
        while (Date.now() < endTime) {
            // 忙等待
        }
    }
}
