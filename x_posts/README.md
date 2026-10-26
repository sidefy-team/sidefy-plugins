## X Posts Plugin

Follow public posts from one X account on your Nunc timeline, with the original publication time and a link to each post.

### Features

- Single-account subscription; duplicate the plugin to follow additional accounts independently
- Post titles of up to 64 characters, with the complete retrieved text in notes
- Post images when available and direct links to X
- Publication times displayed in your local time zone
- Account-specific caches that expire at local midnight
- Merge posts by ID and preserve cached posts on empty, partial, or failed responses
- Refresh every 15 minutes with cached posts or every 5 minutes without posts

### Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | One X username, with or without `@` (e.g., `thsottiaux`). Do not enter a profile URL. |

### How to Get and Configure the Username

1. Open the account's X profile, for example `https://x.com/thsottiaux`.
2. Copy the username from the URL and enter it in `username`.
3. Configure the Jina crawler service in Nunc.
4. Enable Network, Crawler, and Storage permissions for the plugin.

To follow another account, duplicate the plugin and change its username. AI and AI Decision permissions are not required.

### Display Format

```text
@username · First 64 characters of the post…

Complete retrieved post text
```

The account prefix and ellipsis do not count toward the 64-character limit. Titles are counted by Unicode code point. Short posts appear in full in both the title and notes. Click the event to open the original post on X.

### Notes

- Retains up to 30 recent posts exposed by the public profile; this is not a complete timeline or permanent archive.
- Long posts may be truncated by X before retrieval.
- Skips other authors and replies identified by the page's English “Replying to” label. Reply detection can vary with page format.
- Login restrictions or page changes may prevent retrieval. Failures are logged, and existing cached posts remain available until midnight. If no posts are cached, no events are returned.

### Changelog

#### v0.1.7

- Declare Network permission alongside Crawler and Storage.
- Preserve list items inside post bodies when separating timeline entries.
- Refresh the cache namespace to discard previously truncated posts.

#### v0.1.6

- Shorten post titles to 64 Unicode code points while keeping the complete retrieved text in notes.

#### v0.1.5

- Add the twitter tag for plugin discovery.

#### v0.1.4

- Set the plugin author to Nunc. to match the repository metadata convention.

#### v0.1.3

- Separate refresh intervals from daily cache expiry, following the GitHub Repository plugin.
- Merge posts by ID and preserve cached posts on failed, empty, or partial responses.

#### v0.1.2

- Publish the single-account X plugin with duplication support and no keyword filtering.
- Support profile posts with either an empty status link or an avatar at the beginning.
- Provide Chinese, English, Japanese, and Korean runtime messages.
