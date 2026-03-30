# Wikipedia On This Day

A Sidefy plugin that adds **one all-day event per day** with Wikipedia’s featured **“On this day”** anniversaries (selected feed only) for the current calendar date.

## Features

- **Selected only**: Uses [`/feed/onthisday/selected/`](https://wikitech.wikimedia.org/wiki/Understanding_Entry_points#On_this_day), not events / births / deaths / holidays.
- **Any Wikipedia language edition**: Configure a language subdomain such as `en`, `zh`, `ja`, `de`, `fr`.
- **Full list**: Shows every item returned for that day (no limit).
- **Details (`notes`)**: Plain text — title line with a bullet, URL on the next indented line (no link styling).
- **Popup**: HTML list; **titles are normal text**, a second line **「查看条目 / Open article」** is a link with minimal styling (no fixed colors; follows light/dark context).
- **Caching**: Fetched data is cached until local midnight.

## Configuration

| Parameter  | Type   | Default | Description |
| ---------- | ------ | ------- | ----------- |
| `language` | string | `en`    | Wikipedia language subdomain used in API URL, e.g. `en`, `zh`, `ja`, `de`, `fr`. |

## Requirements

- **Network**: Required (REST API).
- **Storage**: Required (daily cache).

## Data source

- Wikimedia REST API: `https://{language}.wikipedia.org/api/rest_v1/feed/onthisday/selected/{MM}/{DD}`.

## Installation

1. Open **Sidefy** → **Plugin Center**.
2. Install **Wikipedia On This Day** (or load this folder as a custom plugin).
3. Set `language` to your preferred Wikipedia language code if needed.
