# Wikipedia On This Day

A Sidefy plugin that adds **one all-day event per day** with Wikipedia’s featured **“On this day”** anniversaries (selected feed only) for the current calendar date.

## Features

- **Selected only**: Uses [`/feed/onthisday/selected/`](https://wikitech.wikimedia.org/wiki/Understanding_Entry_points#On_this_day), not events / births / deaths / holidays.
- **English or Chinese Wikipedia**: Configure `en` or `zh` (see table below for aliases).
- **Full list**: Shows every item returned for that day (no limit).
- **Markdown lines**: Each line is `• [(year) description](article URL)` so titles can open the article where Sidefy renders Markdown.
- **Popup**: Card tap uses `sidefy.popup.build(title, content)` with the same text as details (`notes`).
- **Caching**: Fetched data is cached until local midnight.

## Configuration

| Parameter  | Type   | Default | Description |
| ---------- | ------ | ------- | ----------- |
| `language` | string | `en`    | Wikipedia edition: **`en`** or **`zh`**. Aliases normalized to `zh`: `zh-cn`, `zh-hans`, `zh-tw`, `zh-hant`, `zh-hk`. Any other value uses **`en`**. |

## Requirements

- **Network**: Required (REST API).
- **Storage**: Required (daily cache).

## Data source

- Wikimedia REST API: `https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/{MM}/{DD}` (or `zh.wikipedia.org` when `language` is `zh`).

## Installation

1. Open **Sidefy** → **Plugin Center**.
2. Install **Wikipedia On This Day** (or load this folder as a custom plugin).
3. Set `language` to `en` or `zh` if needed.
