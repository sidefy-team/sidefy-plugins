# Nunc Plugins Contribution Guide

This repository contains community plugins for the Nunc/Sidefy plugin runtime.

[English](README.md) | [中文](README_ZH.md)

>[!WARNING]
>Disclaimer: Community plugins are provided by third parties. Sidefy is not responsible for their security. Users should verify and evaluate plugins themselves.

## 📁 File Structure

```
// Directory name, also serves as the unique plugin ID in the client
your-plugin-name/
    ├── main.js # Plugin code
    ├── info.json # Plugin metadata
    └── README.md # Documentation
```

## info.json

`info.json` is the client-facing metadata contract. Keep `version`, configuration options, requirements, and README documentation synchronized. Use semantic versioning: patch for fixes, minor for compatible features, and major for breaking configuration changes.

```json
{
  "name": "Bilibili User Videos",
  "description": "Track the latest video uploads from specified Bilibili content creators, displaying video titles, view counts, and publish times in real-time",
  // Plugin version, client will show update notification after updates
  "version": "0.1.0",
  "author": "sha2kyou",
  // Minimum supported Sidefy version, clients below this version cannot download the plugin
  "min_support_app_version": "2025.3.0",
  "tags": ["bilibili", "video", "content creator", "social media"],
  "category": "Social Media",
  // Config parameters will be automatically mapped to corresponding input fields after plugin download
  "config_options": {
    "mid": {
      "type": "string",
      "default": "",
      "description": "Bilibili user ID (mid parameter)"
    },
    "pageSize": {
      "type": "number",
      "default": 10,
      "description": "Number of videos to fetch per request"
    }
  },
  // Without proper permissions, corresponding operations cannot be performed. Default is false if not configured
  "requirements": {
    // Network permission: single request timeout limited to 30 seconds
    "network": true,
    // Storage permission: maximum 16k data storage, up to 5 entries
    "storage": true,
    // AI permission: uses user-configured General AI service (nunc.ai.chat); requests are subject to service limits and the plugin execution timeout
    "ai": false,
    // AI Decision permission: allows nunc.ai.decide
    "ai_decision": false
  }
}
```

## main.js

Must include the `fetchEvents` function (see [bilibili_user_videos](./bilibili_user_videos) for reference):

```javascript
function fetchEvents(config) {
  var events = [];

  try {
    // Your business logic
    events.push({
      title: "Event Title",
      startDate: "2024-01-01T10:00:00Z", // Required, ISO8601 format
      endDate: "2024-01-01T11:00:00Z", // Required, ISO8601 format
      color: "#FF5733", // Required, hexadecimal color
      notes: "Detailed description", // Optional
      icon: "https://example.com/icon.png", // Optional
      isAllDay: false, // Required
      isPointInTime: true, // Required
      href: "https://example.com", // Optional, click to navigate. Supports http/https/popup (custom protocol, displays text in macOS popup on click)
    });
  } catch (err) {
  }

  return events;
}
```

## AI decision API

`nunc.ai.decide(input, decision)` (also `sidefy.ai.decide`) uses the app's **AI Decision** service and requires the independent `ai_decision` permission (`ai` only grants `ai.chat`). Configure AI Decision separately from General AI.

```javascript
var text = "Xcode update: a new version of Apple's development tools.";

var probability = sidefy.ai.decide(text, { match: "About Apple development" });
var category = sidefy.ai.decide(text, { choice: { news: "News", other: "Other" } });
var importance = sidefy.ai.decide(text, { score: ["Routine", "Important", "Urgent"] });
```

Input accepts non-empty text or JSON objects/arrays. Arrays are context, not automatic batches. Specify exactly one decision field. `match` returns a probability in [0,1]; `choice` returns an option key; `score` returns a weighted level index (0–2 in this example). Choice requires at least two named options with non-empty descriptions; score requires at least two non-empty levels, lowest first.

Calls are synchronous and successful responses are cached automatically. Invalid arguments throw `TypeError`; permission/configuration/service failures return `null` and log the reason. Check `probability !== null` before applying a threshold; zero is valid. Uncached calls may incur cost and remain subject to provider limits and the plugin execution timeout.

## Internationalization (i18n)

All user-facing strings in plugins must use `sidefy.i18n()`. This includes event titles, notes, validation errors, and user-visible status text; third-party content such as a fetched article title may remain unchanged. Every active plugin is checked against this rule during maintenance.

### Supported languages

Use the exact language codes returned by Nunc's `app.language()` API. Chinese is normalized to `zh`, including system variants such as `zh-CN`, `zh-Hans`, `zh-TW`, and `zh-Hant`. Plugins must provide all 9 language keys below:

| Code | Language |
|------|----------|
| `zh` | Chinese |
| `en` | English |
| `ja` | Japanese |
| `ko` | Korean |
| `de` | German |
| `es` | Spanish |
| `fr` | French |
| `pt` | Portuguese |
| `ru` | Russian |

Plugin i18n keys use **`zh`** for Chinese (matches `sidefy.app.language()`). Do not use `zh-Hans`, `zh-Hant`, `zh-CN`, or `zh-TW` as keys. The app language codes are defined by Nunc's `AppConstants.Language` and currently are exactly `zh`, `en`, `ja`, `ko`, `de`, `es`, `fr`, `pt`, and `ru`.

### Code organization

1. Declare all i18n strings at the **bottom** of `main.js` (mark the section with `// --- i18n ---`).
2. Use semantic names such as `I18N_UPDATED_LABEL`, `I18N_ERROR_NETWORK`.
3. **Static text**: define `I18N_*` object constants; call `sidefy.i18n(I18N_XXX)` in business logic. Do not inline language objects in `fetchEvents` or helpers above the i18n block.
4. **Dynamic text** (with variables): define `i18nXxx(...)` helper functions at the bottom; return `sidefy.i18n({ zh: ..., en: ..., ja: ..., ko: ..., de: ..., es: ..., fr: ..., pt: ..., ru: ... })`.
5. Keep business logic and utilities **above** the i18n block.

### Example

```javascript
function fetchEvents(config) {
    var notes = sidefy.i18n(I18N_UPDATED_LABEL) + timeStr;
    // ...
    return events;
}

// --- i18n ---

var I18N_UPDATED_LABEL = {
    zh: "更新时间：",
    en: "Updated: ",
    ja: "更新: ",
    ko: "업데이트: "
};

function i18nCountdownFuture(eventName, days) {
    return sidefy.i18n({
        zh: "距离 " + eventName + " 还有 " + days + " 天",
        en: days + " days until " + eventName,
        ja: eventName + "まであと" + days + "日",
        ko: eventName + "까지 " + days + "일 남음"
    });
}
```

`sidefy.i18n()` picks the string for the current app language, then falls back to `en`, then to the first available value. All nine languages must be filled in for every string.

## Plugin permissions and security

`info.json` must declare every capability a plugin uses:

- `network`: permits HTTP requests; document the domains and APIs used.
- `storage`: permits persistent plugin storage; document cached data and retention where relevant.
- `ai`: permits the configured general AI service; disclose what user or remote content is sent.
- `ai_decision`: permits `sidefy.ai.decide`; declare it separately from `ai`.

Request the minimum permissions necessary. Validate and encode user-controlled URL, ID, token, and query parameters. Do not log passwords, access tokens, cookies, or raw authorization headers. Community plugins are untrusted code: review the source, requested permissions, network destinations, storage behavior, and AI data flow before installing or enabling one. The repository maintainers do not guarantee the security or availability of third-party services.

## Submission Steps

1. Fork this repository
2. Edit code in Sidefy's custom plugin code editor
3. Test plugin functionality in Sidefy
4. Create plugin folder and files in the repository
5. Submit a Pull Request

>[!WARNING]
>For more API documentation, please check the custom plugin editor documentation page within the Sidefy app

## Maintenance and review checklist

Before merging a plugin change, maintainers should scan every plugin directory and verify:

- `main.js`, `info.json`, and `README.md` are present.
- `fetchEvents(config)` exists and event fields are valid.
- `info.json` permissions match actual network, storage, and AI calls.
- All user-facing runtime strings use nine complete i18n keys: `zh`, `en`, `ja`, `ko`, `de`, `es`, `fr`, `pt`, and `ru`.
- i18n declarations are at the bottom of `main.js`.
- Configuration documented in `README.md` matches both `info.json` and code.
- Behavior changes bump `info.json` version and add a matching Changelog entry.
- User-controlled inputs, external URLs, credentials, and cache keys are validated and handled safely.

The repository may contain discontinued plugins. They should be clearly marked and should not be treated as examples for new contributions.

## Checklist

- Plugin tested successfully in Sidefy
- Includes complete error handling
- Submitted plugin directory structure is correct
- info.json information is complete and accurate
- README.md instructions are clear
- Code comments are appropriate
- User-facing strings use `sidefy.i18n()` with all 9 languages (`zh`, `en`, `ja`, `ko`, `de`, `es`, `fr`, `pt`, `ru`)
- i18n constants and helpers are declared at the bottom of `main.js`

## Maintenance audit

See [PLUGIN_AUDIT.md](PLUGIN_AUDIT.md) for the latest repository-wide structure, permission, i18n, and follow-up review baseline.

## License

Copyright (C) 2025 Nunc.

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for the full terms.
