/**
 * Say Hi — Daily Wikipedia Greeting Plugin
 *
 * Fetches a random English Wikipedia article each day and uses AI
 * to generate the event title and greeting in the user's app language.
 */

function fetchEvents(config) {
  var today = new Date();
  var dateKey =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0");
  var cacheKey = "sayhi_v6_" + dateKey;

  var cachedData = sidefy.storage.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  var endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  var remainingMinutes = Math.ceil(
    (endOfDay.getTime() - today.getTime()) / (1000 * 60),
  );
  if (remainingMinutes < 1) remainingMinutes = 1;

  var pageData = fetchRandomPage();
  if (!pageData) {
    throw new Error(
      sidefy.i18n({
        zh: "无法获取维基百科条目，请检查网络连接。",
        en: "Failed to fetch Wikipedia page. Check your network connection.",
      }),
    );
  }

  var title = pageData.title;
  var extract = pageData.extract || "";
  var thumbnail = pageData.thumbnail ? pageData.thumbnail.source : null;
  var pageUrl = pageData.content_urls ? pageData.content_urls.desktop.page : "";

  var aiContent = generateContent(title, extract);

  var eventDate = new Date(today);
  eventDate.setHours(0, 0, 0, 0);

  var events = [
    {
      title: aiContent.title,
      startDate: sidefy.date.format(eventDate.getTime() / 1000),
      endDate: sidefy.date.format(eventDate.getTime() / 1000),
      color: "#3366CC",
      notes: aiContent.greeting,
      icon: "https://en.wikipedia.org/static/favicon/wikipedia.ico",
      href: pageUrl,
      imageURL: thumbnail,
      isAllDay: true,
      isPointInTime: true,
    },
  ];

  sidefy.storage.set(cacheKey, events, remainingMinutes);

  return events;
}

function fetchRandomPage() {
  var maxAttempts = 3;
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    var page = fetchRandomPageOnce();
    if (page) return page;
  }
  return null;
}

function fetchRandomPageOnce() {
  try {
    var apiUrl = "https://en.wikipedia.org/api/rest_v1/page/random/summary";
    var headers = {
      "User-Agent": "SidefySayHi/0.1.0 (sidefy plugin)",
      Accept: "application/json",
    };

    var response = sidefy.http.get(apiUrl, headers);
    if (!response) return null;

    var data = JSON.parse(response);
    if (!data || !data.title || !data.extract) return null;

    return data;
  } catch (err) {
    sidefy.log("fetchRandomPage error: " + err.message);
    return null;
  }
}

function generateContent(articleTitle, extract) {
  var snippet = extract.substring(0, 500);
  if (extract.length > 500) snippet += "…";

  var prompt = buildPrompt(articleTitle, snippet);
  var raw = sidefy.ai.chat(prompt);

  if (!raw || raw.trim() === "") {
    throwAIError("empty");
  }

  if (raw.trim().indexOf("Error:") === 0) {
    sidefy.log("AI API error: " + raw.trim());
    throwAIError("failed");
  }

  return parseAIResponse(raw);
}

function buildPrompt(articleTitle, snippet) {
  var appLang = sidefy.app.language();

  return (
    "You are a warm, playful daily greeting companion.\n\n" +
    'Wikipedia article title: "' +
    articleTitle +
    '"\n' +
    "Summary: " +
    snippet +
    "\n\n" +
    'Write in the language with ISO 639-1 code "' +
    appLang +
    '". If that language is not supported, use English.\n\n' +
    "Return ONLY a JSON object (no markdown, no code fences) with:\n" +
    '- "title": a short, vivid timeline event title (max 40 characters)\n' +
    '- "greeting": a warm daily greeting (50-100 words) inspired by this article, like a friend sharing trivia\n\n' +
    "Keep the tone natural, not formal or academic. " +
    'Do not start the greeting with "Dear" or "Hello everyone".'
  );
}

function parseAIResponse(raw) {
  var text = raw.trim();

  // Strip markdown code fences if the model adds them anyway
  if (text.indexOf("```") === 0) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    sidefy.log("AI response JSON parse error: " + err.message);
    throwAIError("invalid");
  }

  var title = parsed && parsed.title ? String(parsed.title).trim() : "";
  var greeting =
    parsed && parsed.greeting ? String(parsed.greeting).trim() : "";

  if (!title || !greeting) {
    sidefy.log("AI response missing title or greeting");
    throwAIError("invalid");
  }

  return { title: title, greeting: greeting };
}

function throwAIError(reason) {
  var messages = {
    empty: {
      zh: "AI 未返回内容，请检查 Sidefy 高级设置中的 LLM API Key。",
      en: "AI returned no content. Check your LLM API key in Sidefy Advanced Settings.",
    },
    failed: {
      zh: "AI 生成失败，请检查 API Key、网络或配额。",
      en: "AI generation failed. Check your API key, network, or quota.",
    },
    invalid: {
      zh: "AI 返回格式无效，请重试。",
      en: "AI returned an invalid format. Please try again.",
    },
  };

  var bucket = messages[reason] || messages.failed;
  throw new Error(sidefy.i18n(bucket));
}
