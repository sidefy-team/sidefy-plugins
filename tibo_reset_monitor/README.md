# Tibo Reset Monitor

Monitor [Tibo (@thsottiaux)](https://x.com/thsottiaux) for ChatGPT and Codex usage reset announcements in Nunc.

## Features

- Identify new reset announcements and exclude general plans, follow-up confirmations, and unrelated posts.
- Display events at the original post time, with the original text and a link to X.
- Cache posts and decisions to reduce repeated requests.

## Setup

Requires a Nunc build with `nunc.ai.decide()` and the independent `ai_decision` permission.

1. Configure **AI Decision** in Settings > Services.
2. Configure a **Jina API key** for webpage retrieval.
3. Enable the plugin with **AI Decision**, **Crawler**, and **Storage** permissions.

No plugin parameters are needed. The account is fixed to `@thsottiaux`.

## Notes

- Checks when Nunc refreshes plugins; the profile is cached for 5 minutes.
- Reads posts exposed by the public X profile. Login restrictions, page changes, or crawler caching may delay or omit posts.
- Event times are publication times. Recent announcements are cached, not permanently archived.

## Changelog

### v0.0.1

- Initial release.
