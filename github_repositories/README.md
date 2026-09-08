## GitHub Repository Plugin

Track today's GitHub repository activity on your Sidefy timeline: stars, releases, pull requests, forks, issues, and discussions.

### Features

- Multiple repositories via incremental config keys
- Optional Personal Access Token (higher rate limits; needed for private repos)
- Per-repository event type filters
- Response cache isolated by repository and event-type configuration: 5 minutes for empty results, 15 minutes for results with events

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

- empty / `*` / `all` / `true` / `1` — enable all event types
- `stars,releases,pullRequests` — only selected types (`,` `;` or whitespace separated)
- `false` / `0` / `off` / `disabled` — temporarily disable that repository

Unrecognized type names are ignored. If none of the listed names match, all event types are enabled.

| Type | Aliases |
|------|---------|
| `stars` | `star` |
| `releases` | `release` |
| `pullRequests` | `pr`, `prs`, `pull_requests`, `pull-requests` |
| `forks` | `fork` |
| `issues` | `issue` |
| `discussions` | `discussion` |

### Example

```
token = ghp_xxx                    # optional
sidefy-team/sidefy = *             # all event types
octocat/Hello-World = stars,forks  # only stars and forks
```

### Changelog

#### v1.0.4

- Cache empty results for 5 minutes and results with events for 15 minutes

#### v1.0.3

- Reduce response cache duration from 15 minutes to 5 minutes
- Isolate cached responses by repository and event-type configuration

#### v1.0.2

- Document all event type aliases and value rules (`1` / `0`, separators, unrecognized names)

#### v1.0.1

- Fix event title i18n: zh/ja/ko no longer keep English verbs like "starred" / "forked"

#### v1.0.0

- Initial release (ported from Sidefy built-in GitHub Repository plugin)
- Incremental repository configuration; optional token
