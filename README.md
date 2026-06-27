# Sidefy Plugin Contribution Guide

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
    // AI permission: uses user-configured LLM capabilities in advanced settings, limited to 5 requests per 5 minutes, 30-second timeout per request
    "ai": false
  }
}
```

## main.js

Must include the `fetchEvents` function (see [bilibili_user_videos](https://github.com/sha2kyou/sidefy-plugins/tree/main/bilibili_user_videos) for reference):

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

## Internationalization (i18n)

All user-facing strings in plugins must use `sidefy.i18n()`. See also [claude.md](claude.md) for full conventions.

### Supported languages

Use **only** these 4 language codes. Do not add `de`, `es`, `fr`, `pt`, `ru`, or others:

| Code | Language |
|------|----------|
| `zh` | Chinese |
| `en` | English |
| `ja` | Japanese |
| `ko` | Korean |

Plugin i18n keys use **`zh`** for Chinese (matches `sidefy.app.language()`). Do not use `zh-Hans`, `zh-Hant`, `zh-CN`, or `zh-TW` as keys.

### Code organization

1. Declare all i18n strings at the **bottom** of `main.js` (mark the section with `// --- i18n ---`).
2. Use semantic names such as `I18N_UPDATED_LABEL`, `I18N_ERROR_NETWORK`.
3. **Static text**: define `I18N_*` object constants; call `sidefy.i18n(I18N_XXX)` in business logic. Do not inline language objects in `fetchEvents` or helpers above the i18n block.
4. **Dynamic text** (with variables): define `i18nXxx(...)` helper functions at the bottom; return `sidefy.i18n({ zh: ..., en: ..., ja: ..., ko: ... })`.
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

`sidefy.i18n()` picks the string for the current app language, then falls back to `en`, then to the first available value. All four languages must be filled in for every string.

## Submission Steps

1. Fork this repository
2. Edit code in Sidefy's custom plugin code editor
3. Test plugin functionality in Sidefy
4. Create plugin folder and files in the repository
5. Submit a Pull Request

>[!WARNING]
>For more API documentation, please check the custom plugin editor documentation page within the Sidefy app

## Checklist

- Plugin tested successfully in Sidefy
- Includes complete error handling
- Submitted plugin directory structure is correct
- info.json information is complete and accurate
- README.md instructions are clear
- Code comments are appropriate
- User-facing strings use `sidefy.i18n()` with all 4 languages (`zh`, `en`, `ja`, `ko`)
- i18n constants and helpers are declared at the bottom of `main.js`
