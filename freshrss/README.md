## FreshRSS

Fetch unread and recent articles from your self-hosted FreshRSS instance, displaying them in Sidefy timeline.

### Features

- Fetch articles from FreshRSS via Google Reader API
- Smart caching (5 minutes) to reduce API calls
- Automatic color assignment based on feed source
- Click articles to jump directly to original content
- Configurable article limit

### Configuration

#### Required Parameters

| Parameter | Type     | Description                       | Example                                 |
| --------- | -------- | --------------------------------- | --------------------------------------- |
| url       | string   | FreshRSS Server URL               | https://rss.example.com/api/greader.php |
| username  | string   | FreshRSS username                 | alice                                   |
| password  | password | API Password (not login password) | Abcdef123456                            |

#### Optional Parameters

| Parameter | Type   | Default | Description                 |
| --------- | ------ | ------- | --------------------------- |
| limit     | number | 50      | Number of articles to fetch (1–100) |
| onlyUnread | boolean | false | Only fetch unread articles |

### How to Setup API Access

1. Log in to your FreshRSS instance
2. Go to **Administration** → **Profile** → **API management**
3. Enable API access and set an **API Password** (different from login password)
4. Use the full API endpoint URL: `https://your-domain.com/api/greader.php`

### Color Coding

Each RSS feed source is automatically assigned a unique color based on its URL using Sidefy's built-in color hash algorithm.

### Changelog

#### v1.2.5

- 新增可选 `attribution`，使用订阅源名称，显示为「插件名称（归属）· 扩展插件」；保留原有标题、正文及来源字段，兼容旧版 Nunc。

### v1.2.4

- Validate the FreshRSS URL and require HTTPS.
- Isolate cached tokens and articles by server, path, username, limit, and unread mode.
- Stop logging part of the authentication token.

### v1.2.3

- 补齐 i18n 文案，新增德语、西班牙语、法语、葡萄牙语和俄语支持。

#### v1.2.2

- Added the `onlyUnread` option to the plugin configuration and limited `limit` to 1–100 articles.
- Fixed feeds without an `origin` object causing event generation to fail.

#### v1.2.1

- Localized the plugin's error messages with `sidefy.i18n()` using all nine Nunc language codes
- Added i18n constants and helpers in a `// --- i18n ---` block at the bottom of `main.js`

#### v1.2.0

- **Adopted Sidefy's color system**: Now uses `sidefy.color.hash()` for color assignment instead of custom color selection
- Simplified color generation logic

#### v1.1.0

- **Simplified color system**: Now uses 7 standard colors (Red, Orange, Yellow, Green, Cyan, Blue, Purple) instead of complex HSL generation
- **Changed color source**: Now uses RSS feed URL instead of feed title for color assignment
- Removed unused HSL to HEX conversion code
- Updated color assignment documentation

#### v1.0.0

- Initial release
- Google Reader API support with 5-minute caching
- Automatic color assignment per feed
