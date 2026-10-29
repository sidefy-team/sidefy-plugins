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

    var mids = parseMids(config.mids);
    var pageSize = Math.max(1, Math.min(20, Number(config.pageSize) || 10));
    var index = sidefy.storage.get(CACHE_KEY);
    var storage = index ? loadUsers(index) : null;
    if (storage && ((storage.meta.expiresAt && now >= storage.meta.expiresAt) ||
                    (storage.meta.date && storage.meta.date !== today))) storage = null;
    if (!storage) storage = initStorage(mids);

    if (storage.meta.mids.join(',') !== mids.join(',')) {
        storage.meta.idx = 0;
        storage.meta.last = 0;
    }
    storage.meta.mids = mids;
    storage.meta.date = today;
    storage.meta.expiresAt = expiresAt;

    var shouldPoll = mids.length > 0 && (now - storage.meta.last) >= POLL_INTERVAL;
    if (shouldPoll) {
        pollNextMid(storage, Math.min(VIDEOS_PER_MID, pageSize));
        storage.meta.last = now;
    }

    var ttlMinutes = Math.max(5, (expiresAt - now) / 60000);
    var savedIndex = { meta: storage.meta, data: {} };
    for (var mid in storage.data) {
        saveCache(userKey(mid), { vids: storage.data[mid].vids || [], expiresAt: expiresAt }, ttlMinutes);
        savedIndex.data[mid] = {};
    }
    saveCache(CACHE_KEY, savedIndex, ttlMinutes);
    return buildEvents(storage, config);

    function userKey(mid) { return "bili_user_v1_" + today + "_" + mid; }
    function loadUsers(index) {
        var result = { meta: index.meta, data: {} };
        for (var mid in index.data) {
            var cached = sidefy.storage.get(userKey(mid));
            if (cached && cached.expiresAt > now) result.data[mid] = { vids: cached.vids || [] };
        }
        return result;
    }
    function saveCache(key, value, ttlMinutes) {
        var result = sidefy.storage.set(key, value, ttlMinutes);
        if (result === false || (result && result.error)) throw new Error(sidefy.i18n(I18N_CACHE_ERROR));
    }
    function getTodayKey() {
        var date = new Date();
        return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, '0') + "-" + String(date.getDate()).padStart(2, '0');
    }
    function parseMids(midStr) {
        if (!midStr) return [];
        var seen = {}, result = [];
        String(midStr).split(',').map(function(m) { return m.trim(); }).filter(Boolean).forEach(function(mid) {
            if (/^\d+$/.test(mid) && !seen[mid]) { seen[mid] = true; result.push(mid); }
        });
        return result.slice(0, MAX_MIDS);
    }
    function initStorage(mids) { return { meta: { mids: mids, idx: 0, last: 0 }, data: {} }; }
    function pollNextMid(storage, pageSize) {
        var mids = storage.meta.mids;
        if (!mids.length) return;
        var idx = storage.meta.idx % mids.length;
        var mid = mids[idx];
        try {
            var videos = fetchBilibiliVideos(mid, pageSize);
            var existing = storage.data[mid] ? storage.data[mid].vids || [] : [];
            var merged = [], positions = Object.create(null);
            existing.concat(videos).forEach(function(video) {
                if (!video.b) return;
                if (positions[video.b] === undefined) { positions[video.b] = merged.length; merged.push(video); }
                else merged[positions[video.b]] = video;
            });
            storage.data[mid] = { vids: merged };
        } catch (err) {
            sidefy.log(err && err.message ? err.message : String(err));
        }
        storage.meta.idx = (idx + 1) % mids.length;
    }
    function fetchBilibiliVideos(mid, pageSize) {
        var url = "https://api.bilibili.com/x/space/arc/search?mid=" + encodeURIComponent(mid) + "&pn=1&ps=" + pageSize + "&order=pubdate";
        var headers = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36", "Accept": "application/json", "Referer": "https://www.bilibili.com/" };
        var response = null;
        for (var attempt = 0; attempt < 3; attempt++) {
            try {
                response = sidefy.http.get(url, headers);
                if (response && response.length > 0) {
                    var parsed = JSON.parse(response);
                    if (parsed.code === 0) break;
                    if (parsed.code === -799 && attempt < 2) { sleep(5000); continue; }
                    throw new Error(i18nApiError(parsed.code));
                }
            } catch (err) {
                if (attempt === 2) throw err;
                sleep(3000);
            }
        }
        if (!response) throw new Error(sidefy.i18n(I18N_REQUEST_ERROR));
        var data = JSON.parse(response);
        if (data.code !== 0 || !data.data || !data.data.list || !data.data.list.vlist) throw new Error(sidefy.i18n(I18N_RESPONSE_ERROR));
        var todayStart = new Date(getTodayKey() + "T00:00:00").getTime() / 1000;
        var todayEnd = new Date(getTodayKey() + "T23:59:59").getTime() / 1000;
        return data.data.list.vlist.filter(function(v) { return v.created >= todayStart && v.created <= todayEnd; }).map(function(v) {
            return { t: v.title, d: v.created, b: v.bvid, p: v.pic, a: v.author, pc: v.play || 0, dc: v.video_review || 0, l: v.length };
        });
    }
    function buildEvents(storage, config) {
        var events = [];
        for (var mid in storage.data) {
            (storage.data[mid].vids || []).forEach(function(v) {
                events.push({ title: v.t, startDate: sidefy.date.format(v.d), endDate: sidefy.date.format(v.d), color: "#FB7299", icon: config.icon, notes: i18nVideoNotes(v.a, formatCount(v.pc), formatCount(v.dc), v.l), isAllDay: false, isPointInTime: true, href: "https://www.bilibili.com/video/" + encodeURIComponent(v.b), imageURL: v.p });
            });
        }
        return events;
    }
    function formatCount(count) { if (!count) return "0"; if (count >= 100000000) return (count / 100000000).toFixed(1) + sidefy.i18n(I18N_HUNDRED_MILLION); if (count >= 10000) return (count / 10000).toFixed(1) + sidefy.i18n(I18N_TEN_THOUSAND); return String(count); }
    function sleep(ms) { var endTime = Date.now() + ms; while (Date.now() < endTime) {} }
}

// --- i18n ---
var I18N_CACHE_ERROR = { zh: "视频缓存保存失败。", en: "Failed to save video cache.", ja: "動画キャッシュの保存に失敗しました。", ko: "동영상 캐시를 저장하지 못했습니다.", de: "Videocache konnte nicht gespeichert werden.", es: "No se pudo guardar la caché de vídeos.", fr: "Impossible d’enregistrer le cache vidéo.", pt: "Não foi possível salvar o cache de vídeos.", ru: "Не удалось сохранить кэш видео." };
var I18N_REQUEST_ERROR = { zh: "Bilibili 请求失败。", en: "Bilibili request failed.", ja: "Bilibili のリクエストに失敗しました。", ko: "Bilibili 요청에 실패했습니다.", de: "Bilibili-Anfrage fehlgeschlagen.", es: "La solicitud a Bilibili falló.", fr: "La requête Bilibili a échoué.", pt: "A solicitação ao Bilibili falhou.", ru: "Запрос к Bilibili не выполнен." };
var I18N_RESPONSE_ERROR = { zh: "Bilibili 返回的数据格式无效。", en: "Bilibili returned an invalid response.", ja: "Bilibili が無効な応答を返しました。", ko: "Bilibili가 잘못된 응답을 반환했습니다.", de: "Bilibili hat eine ungültige Antwort zurückgegeben.", es: "Bilibili devolvió una respuesta no válida.", fr: "Bilibili a renvoyé une réponse invalide.", pt: "O Bilibili retornou uma resposta inválida.", ru: "Bilibili вернул недопустимый ответ." };
var I18N_HUNDRED_MILLION = { zh: "亿", en: " hundred million", ja: "億", ko: "억", de: " Hundert Millionen", es: " cien millones", fr: " cent millions", pt: " cem milhões", ru: " сотен миллионов" };
var I18N_TEN_THOUSAND = { zh: "万", en: " ten thousand", ja: "万", ko: "만", de: " Zehntausend", es: " diez mil", fr: " dix mille", pt: " dez mil", ru: " десять тысяч" };
function i18nApiError(code) { return sidefy.i18n({ zh: "Bilibili API 错误：" + code, en: "Bilibili API error: " + code, ja: "Bilibili API エラー: " + code, ko: "Bilibili API 오류: " + code, de: "Bilibili-API-Fehler: " + code, es: "Error de la API de Bilibili: " + code, fr: "Erreur de l’API Bilibili : " + code, pt: "Erro da API do Bilibili: " + code, ru: "Ошибка API Bilibili: " + code }); }
function i18nVideoNotes(author, play, danmaku, length) { return sidefy.i18n({ zh: "UP主：" + author + "\n播放：" + play + "\n弹幕：" + danmaku + "\n时长：" + length, en: "Creator: " + author + "\nViews: " + play + "\nDanmaku: " + danmaku + "\nDuration: " + length, ja: "投稿者: " + author + "\n再生数: " + play + "\n弾幕: " + danmaku + "\n長さ: " + length, ko: "업로더: " + author + "\n조회수: " + play + "\n탄막: " + danmaku + "\n길이: " + length, de: "Ersteller: " + author + "\nAufrufe: " + play + "\nDanmaku: " + danmaku + "\nDauer: " + length, es: "Creador: " + author + "\nVistas: " + play + "\nDanmaku: " + danmaku + "\nDuración: " + length, fr: "Créateur : " + author + "\nVues : " + play + "\nDanmaku : " + danmaku + "\nDurée : " + length, pt: "Criador: " + author + "\nVisualizações: " + play + "\nDanmaku: " + danmaku + "\nDuração: " + length, ru: "Автор: " + author + "\nПросмотры: " + play + "\nДанмаку: " + danmaku + "\nДлительность: " + length }); }
