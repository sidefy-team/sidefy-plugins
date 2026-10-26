# X Posts

Follow public posts from one X account in Nunc. Duplicate the plugin to follow additional accounts independently.

## Setup

1. Configure the Jina crawler service in Nunc.
2. Enable Network, Crawler, and Storage permissions.
3. Set `username` to one X handle, with or without `@`, for example `thsottiaux`. Profile URLs are not accepted.

This plugin has no keyword filter and does not use AI or AI Decision.

## Behavior and limitations

- Retrieves the public profile when Nunc refreshes plugins, at most once every 15 minutes with cached posts or every 5 minutes without posts.
- Keeps an account-specific cache until local midnight, independently of the refresh interval. Merges posts by ID and retains up to 30 recent posts when a response is partial, empty, or fails.
- Uses the post ID to determine its publication timestamp, returns UTC timestamps, and lets Nunc display local time.
- Includes original text, a link to the post, and an available image. Titles are shortened to 64 Unicode code points; notes retain the retrieved text.
- Reads up to 30 posts exposed by the public profile. This is not a complete timeline or permanent archive. Long posts may be truncated by X.
- Skips other authors and replies identified by the page's English “Replying to” label. Reply detection is not guaranteed across page formats.
- Login restrictions and page changes can prevent retrieval. Failures are logged, existing posts remain available until midnight, and the attempt time is recorded to avoid repeated requests on every refresh. With no cached posts, the plugin returns no events.

## Changelog

### v0.1.7

- Declare Network permission alongside Crawler and Storage.
- Preserve list items inside post bodies when separating timeline entries.
- Refresh the cache namespace to discard previously truncated posts.

### v0.1.6

- Shorten post titles to 64 Unicode code points while keeping the complete retrieved text in notes.

### v0.1.5

- Add the twitter tag for plugin discovery.

### v0.1.4

- Set the plugin author to Nunc. to match the repository metadata convention.

### v0.1.3

- Separate refresh intervals from daily cache expiry, following the GitHub Repository plugin.
- Merge posts by ID and preserve cached posts on failed, empty, or partial responses.

### v0.1.2

- Publish the single-account X plugin with duplication support and no keyword filtering.
- Support profile posts with either an empty status link or an avatar at the beginning.
- Provide Chinese, English, Japanese, and Korean runtime messages.
