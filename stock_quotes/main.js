function fetchEvents(config) {
    var input = String(config.symbols || "usAAPL").trim();
    var codes = [], seen = {};
    input.split(/[,，]/).forEach(function(value) {
        var code = value.trim();
        if (!code) return;
        if (/^(sh|sz)\d{6}$/i.test(code) || /^hk\d{5}$/i.test(code)) {
            code = code.toLowerCase();
        } else if (/^us[A-Za-z][A-Za-z0-9.\-]{0,14}$/i.test(code)) {
            code = "us" + code.slice(2).toUpperCase();
        } else {
            throw new Error(i18nInvalidCode(code));
        }
        if (!seen[code]) { seen[code] = true; codes.push(code); }
    });
    if (!codes.length) throw new Error(sidefy.i18n(I18N_EMPTY));
    if (codes.length > 50) throw new Error(sidefy.i18n(I18N_LIMIT));
    var response = sidefy.http.get("https://qt.gtimg.cn/utf8/q=" + codes.join(","), {});
    if (typeof response !== "string" || !response.trim()) throw new Error(sidefy.i18n(I18N_NETWORK));
    var quotes = {}, pattern = /v_([A-Za-z0-9_.\-]+)="([^"]*)";?/g, match;
    while ((match = pattern.exec(response)) !== null) quotes[match[1].toLowerCase()] = match[2].split("~");
    var stamp = sidefy.date.format(Date.now() / 1000);
    var events = [];
    codes.forEach(function(code) {
        var fields = quotes[code.toLowerCase()];
        if (!fields || fields.length < 35 || !fields[1] || !fields[30]) {
            sidefy.log(i18nMissingQuote(code)); return;
        }
        function numberAt(index) {
            var value = fields[index];
            return value && value.trim() !== "" && isFinite(Number(value)) ? Number(value) : null;
        }
        var price = numberAt(3), change = numberAt(31), percent = numberAt(32);
        if (price === null || price <= 0 || change === null || percent === null) {
            sidefy.log(i18nInvalidPrice(code)); return;
        }
        var market = code.slice(0,2);
        var currency = market === "us" ? "USD" : market === "hk" ? "HKD" : "CNY";
        var zone = market === "us" ? sidefy.i18n(I18N_US_TIME) : sidefy.i18n(I18N_CN_TIME);
        var quoteTime = fields[30].trim();
        if (/^\d{14}$/.test(quoteTime)) {
            quoteTime = quoteTime.slice(0,4)+"-"+quoteTime.slice(4,6)+"-"+quoteTime.slice(6,8)+" "+quoteTime.slice(8,10)+":"+quoteTime.slice(10,12)+":"+quoteTime.slice(12,14);
        }
        function signed(value) { return (value > 0 ? "+" : "") + value.toFixed(2); }
        var notes = [
            sidefy.i18n(I18N_SYMBOL) + code,
            sidefy.i18n(I18N_PRICE) + fields[3] + " " + currency,
            sidefy.i18n(I18N_CHANGE) + signed(change) + " " + currency,
            sidefy.i18n(I18N_PERCENT) + signed(percent) + "%",
            sidefy.i18n(I18N_TIME) + quoteTime + " · " + zone,
            sidefy.i18n(I18N_SOURCE),
            sidefy.i18n(I18N_DELAY)
        ];
        if (numberAt(4) !== null) notes.splice(4,0,sidefy.i18n(I18N_PREVIOUS) + fields[4] + " " + currency);
        events.push({
            title: fields[1] + " (" + code + ") " + fields[3] + " " + currency + " · " + signed(percent) + "%",
            notes: notes.join("\n"),
            startDate: stamp, endDate: stamp,
            isAllDay: true, isPointInTime: false,
            color: percent > 0 ? "#E05252" : percent < 0 ? "#2E9D64" : "#8E8E93",
            href: "https://gu.qq.com/" + code
        });
    });
    if (!events.length) throw new Error(sidefy.i18n(I18N_NO_QUOTES));
    return events;
}

// --- i18n ---

var I18N_EMPTY = {
    zh: "请在 symbols 中填写股票代码",
    en: "Enter stock codes in symbols.",
    ja: "symbols に銘柄コードを入力してください。",
    ko: "symbols에 종목 코드를 입력하세요.",
    de: "Geben Sie Aktiensymbole in symbols ein.",
    es: "Introduce códigos bursátiles en symbols.",
    fr: "Saisissez des symboles boursiers dans symbols.",
    pt: "Insira códigos de ações em symbols.",
    ru: "Введите тикеры в symbols."
};

var I18N_LIMIT = {
    zh: "最多配置 50 个股票代码",
    en: "Configure at most 50 stock codes.",
    ja: "銘柄コードは50件まで設定できます。",
    ko: "종목 코드는 최대 50개까지 설정할 수 있습니다.",
    de: "Konfigurieren Sie höchstens 50 Aktiensymbole.",
    es: "Configura como máximo 50 códigos bursátiles.",
    fr: "Configurez au maximum 50 symboles boursiers.",
    pt: "Configure no máximo 50 códigos de ações.",
    ru: "Настройте не более 50 тикеров."
};

var I18N_NETWORK = {
    zh: "行情获取失败，请检查网络权限后重试",
    en: "Could not fetch quotes. Check network access and try again.",
    ja: "株価を取得できません。ネットワーク権限を確認してください。",
    ko: "시세를 가져올 수 없습니다. 네트워크 권한을 확인하세요.",
    de: "Kurse konnten nicht abgerufen werden. Prüfen Sie den Netzwerkzugriff.",
    es: "No se pudieron obtener cotizaciones. Comprueba el acceso a la red.",
    fr: "Impossible de récupérer les cours. Vérifiez l’accès réseau.",
    pt: "Não foi possível obter cotações. Verifique o acesso à rede.",
    ru: "Не удалось получить котировки. Проверьте доступ к сети."
};

var I18N_US_TIME = {
    zh: "美国东部时间（交易所时间）",
    en: "US Eastern Time (exchange time)",
    ja: "米国東部時間（取引所時刻）",
    ko: "미국 동부 시간(거래소 시간)",
    de: "US-Ostküstenzeit (Börsenzeit)",
    es: "Hora del este de EE. UU. (hora de la bolsa)",
    fr: "Heure de l’Est des États-Unis (heure de la Bourse)",
    pt: "Horário do leste dos EUA (horário da bolsa)",
    ru: "Восточное время США (биржевое время)"
};

var I18N_CN_TIME = {
    zh: "北京时间（UTC+8）",
    en: "Beijing / Hong Kong time (UTC+8)",
    ja: "北京・香港時間（UTC+8）",
    ko: "베이징/홍콩 시간(UTC+8)",
        de: "Peking-/Hongkong-Zeit (UTC+8)",
    es: "Hora de Pekín/Hong Kong (UTC+8)",
    fr: "Heure de Pékin/Hong Kong (UTC+8)",
    pt: "Horário de Pequim/Hong Kong (UTC+8)",
    ru: "Пекинское/гонконгское время (UTC+8)"
};

var I18N_SYMBOL = {
    zh: "股票代码：",
    en: "Symbol: ",
    ja: "銘柄コード: ",
    ko: "종목 코드: ",
    de: "Symbol: ",
    es: "Código: ",
    fr: "Symbole : ",
    pt: "Código: ",
    ru: "Тикер: "
};

var I18N_PRICE = {
    zh: "最新价：",
    en: "Last price: ",
    ja: "直近価格: ",
    ko: "최근 가격: ",
    de: "Letzter Kurs: ",
    es: "Último precio: ",
    fr: "Dernier cours : ",
    pt: "Último preço: ",
    ru: "Последняя цена: "
};

var I18N_CHANGE = {
    zh: "涨跌额：",
    en: "Change: ",
    ja: "前日比: ",
    ko: "등락액: ",
    de: "Änderung: ",
    es: "Variación: ",
    fr: "Variation : ",
    pt: "Variação: ",
    ru: "Изменение: "
};

var I18N_PERCENT = {
    zh: "涨跌幅：",
    en: "Change (%): ",
    ja: "騰落率: ",
    ko: "등락률: ",
    de: "Änderung (%): ",
    es: "Variación (%): ",
    fr: "Variation (%) : ",
    pt: "Variação (%): ",
    ru: "Изменение (%): "
};

var I18N_TIME = {
    zh: "行情时间：",
    en: "Quote time: ",
    ja: "株価時刻: ",
    ko: "시세 시간: ",
    de: "Kurszeit: ",
    es: "Hora de cotización: ",
    fr: "Heure du cours : ",
    pt: "Hora da cotação: ",
    ru: "Время котировки: "
};

var I18N_SOURCE = {
    zh: "数据来源：腾讯财经",
    en: "Source: Tencent Finance",
    ja: "データ提供: Tencent Finance",
    ko: "출처: Tencent Finance",
    de: "Quelle: Tencent Finance",
    es: "Fuente: Tencent Finance",
    fr: "Source : Tencent Finance",
    pt: "Fonte: Tencent Finance",
    ru: "Источник: Tencent Finance"
};

var I18N_DELAY = {
    zh: "最新可用报价，可能延迟；休市时显示上一交易日行情。",
    en: "Latest available quote; may be delayed. Closed markets show the last trading session.",
    ja: "直近の株価です。遅延する場合があり、休場時は直近取引日の株価を表示します。",
    ko: "최근 제공 시세이며 지연될 수 있습니다. 휴장 시 마지막 거래일 시세를 표시합니다.",
    de: "Letzter verfügbarer Kurs, möglicherweise verzögert. Bei geschlossenen Märkten wird die letzte Sitzung angezeigt.",
    es: "Cotización disponible más reciente; puede estar retrasada. En mercados cerrados se muestra la última sesión.",
    fr: "Dernier cours disponible, potentiellement retardé. Les marchés fermés affichent la dernière séance.",
    pt: "Cotação disponível mais recente; pode estar atrasada. Mercados fechados exibem a última sessão.",
    ru: "Последняя доступная котировка может быть задержана. Для закрытых рынков показана последняя сессия."
};

var I18N_PREVIOUS = {
    zh: "昨收：",
    en: "Previous close: ",
    ja: "前日終値: ",
    ko: "전일 종가: ",
    de: "Schlusskurs zuvor: ",
    es: "Cierre anterior: ",
    fr: "Clôture précédente : ",
    pt: "Fechamento anterior: ",
    ru: "Предыдущее закрытие: "
};

var I18N_NO_QUOTES = {
    zh: "未获取到任何有效行情，请检查股票代码",
    en: "No valid quotes received. Check your stock codes.",
    ja: "有効な株価を取得できません。銘柄コードを確認してください。",
    ko: "유효한 시세가 없습니다. 종목 코드를 확인하세요.",
    de: "Keine gültigen Kurse erhalten. Prüfen Sie Ihre Symbole.",
    es: "No se recibieron cotizaciones válidas. Comprueba los códigos.",
    fr: "Aucun cours valide reçu. Vérifiez vos symboles.",
    pt: "Nenhuma cotação válida recebida. Verifique os códigos.",
    ru: "Действительные котировки не получены. Проверьте тикеры."
};

function i18nInvalidCode(code) {
    return sidefy.i18n({
        zh: "股票代码格式不正确：" + code + "。示例：usAAPL,sh600519,sz000001,hk00700",
        en: "Invalid stock code: " + code + ". Example: usAAPL,sh600519,sz000001,hk00700",
        ja: "銘柄コードが無効です: " + code + "。例: usAAPL,sh600519,sz000001,hk00700",
        ko: "잘못된 종목 코드: " + code + ". 예: usAAPL,sh600519,sz000001,hk00700",
        de: "Ungültiges Aktiensymbol: " + code + ". Beispiel: usAAPL,sh600519,sz000001,hk00700",
        es: "Código bursátil no válido: " + code + ". Ejemplo: usAAPL,sh600519,sz000001,hk00700",
        fr: "Symbole boursier invalide : " + code + ". Exemple : usAAPL,sh600519,sz000001,hk00700",
        pt: "Código de ação inválido: " + code + ". Exemplo: usAAPL,sh600519,sz000001,hk00700",
        ru: "Недопустимый тикер: " + code + ". Пример: usAAPL,sh600519,sz000001,hk00700"
    });
}

function i18nMissingQuote(code) {
    return sidefy.i18n({
        zh: "未返回有效行情：" + code,
        en: "No valid quote returned: " + code,
        ja: "有効な株価がありません: " + code,
        ko: "유효한 시세가 없습니다: " + code,
        de: "Kein gültiger Kurs: " + code,
        es: "No se recibió una cotización válida: " + code,
        fr: "Aucun cours valide reçu : " + code,
        pt: "Nenhuma cotação válida recebida: " + code,
        ru: "Действительная котировка не получена: " + code
    });
}

function i18nInvalidPrice(code) {
    return sidefy.i18n({
        zh: "价格或涨跌字段无效：" + code,
        en: "Invalid price or change fields: " + code,
        ja: "価格または騰落データが無効です: " + code,
        ko: "가격 또는 등락 데이터가 잘못되었습니다: " + code,
        de: "Ungültige Preis- oder Änderungsdaten: " + code,
        es: "Datos de precio o variación no válidos: " + code,
        fr: "Données de prix ou de variation invalides : " + code,
        pt: "Dados de preço ou variação inválidos: " + code,
        ru: "Недопустимые данные цены или изменения: " + code
    });
}
