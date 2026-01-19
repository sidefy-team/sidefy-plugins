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
| limit     | number | 50      | Number of articles to fetch |

### How to Setup API Access

1. Log in to your FreshRSS instance
2. Go to **Administration** → **Profile** → **API management**
3. Enable API access and set an **API Password** (different from login password)
4. Use the full API endpoint URL: `https://your-domain.com/api/greader.php`

### Color Coding

Each RSS feed source is automatically assigned one of 7 standard colors based on its URL for easy identification:

- Red
- Orange
- Yellow
- Green
- Cyan
- Blue
- Purple

Multiple feeds may share the same color if they have similar URLs (same hash value).

### Changelog

#### v1.1.0

- **Simplified color system**: Now uses 7 standard colors (Red, Orange, Yellow, Green, Cyan, Blue, Purple) instead of complex HSL generation
- **Changed color source**: Now uses RSS feed URL instead of feed title for color assignment
- Removed unused HSL to HEX conversion code
- Updated color assignment documentation

#### v1.0.0

- Initial release
- Google Reader API support with 5-minute caching
- Automatic color assignment per feed
