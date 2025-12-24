## FreshRSS

Fetch unread and recent articles from your self-hosted FreshRSS instance, displaying them in Sidefy calendar.

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

Each RSS feed source is automatically assigned a unique color based on its name for easy identification.

### Changelog

#### v1.0.0

- Initial release
- Google Reader API support with 5-minute caching
- Automatic color assignment per feed
