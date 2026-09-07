## GitHub Repository Plugin

Track today's GitHub repository activity on your Sidefy timeline: stars, releases, pull requests, forks, issues, and discussions.

### Features

- Multiple repositories via incremental config keys
- Optional Personal Access Token (higher rate limits; needed for private repos)
- Per-repository event type filters
- 15-minute response cache

### Configuration

#### Built-in

| Parameter | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `token`   | password | No       | GitHub PAT. Improves rate limits; recommended for Discussions / private repos. |

#### Incremental repositories

Add custom config entries:

| Key | Value |
|-----|-------|
| `owner/repo` or `https://github.com/owner/repo` | Event types (see below) |

Value examples:

- empty / `*` / `all` / `true` — enable all event types
- `stars,releases,pullRequests` — only selected types
- `false` / `off` / `disabled` — temporarily disable that repository

Supported event type names: `stars`, `releases`, `pullRequests` (aliases: `pr`, `prs`), `forks`, `issues`, `discussions`.

### Example

```
token = ghp_xxx                    # optional
sidefy-team/sidefy = *             # all event types
octocat/Hello-World = stars,forks  # only stars and forks
```

### Changelog

#### v1.0.1

- Fix event title i18n: zh/ja/ko no longer keep English verbs like "starred" / "forked"

#### v1.0.0

- Initial release (ported from Sidefy built-in GitHub Repository plugin)
- Incremental repository configuration; optional token
