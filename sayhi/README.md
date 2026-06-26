# Say Hi — Daily Wikipedia Greeting

A Sidefy plugin that fetches a random **English Wikipedia** article each day and uses AI to generate both the **event title** and **greeting note** in your app language (`sidefy.app.language()`).

## How It Works

1. **Random Pick** — On the first run each day (cache miss), pulls a random page from [English Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/page/random/summary)
2. **AI Content** — The page title and summary are sent to `sidefy.ai.chat`, which returns JSON with a short **title** and a **greeting** in your app language
3. **Timeline Event** — An all-day event (midnight) with the AI title, AI greeting in `notes`, article thumbnail, and a link to Wikipedia
4. **Daily Cache** — Cached until local midnight (one Wikipedia fetch + one AI call per day per app language)

## Configuration

No configuration required. Install and enable the plugin.

## Requirements

- **Network** — Fetches random Wikipedia pages via REST API (`en.wikipedia.org` only)
- **Storage** — Caches the result until end of day (scoped by app language automatically)
- **AI** — **Required.** An LLM API key must be configured in Sidefy's Advanced Settings. If AI fails, the plugin shows an error and no event (no template fallback).

## Example

With app language set to English, you might see:

> **When the sky turns green**
>
> Did you know the Northern Lights happen when solar wind hits Earth's magnetic field? Galileo named them after the Roman dawn goddess back in 1619 — pretty wild that we're still staring up at the same light show centuries later.

With app language set to Chinese, both the title and greeting are written in Chinese (Wikipedia source text remains English).

## Notes

- Wikipedia source is always English; AI output follows your app language.
- One AI call per day per app language. Changing Sidefy's language setting generates fresh content on next fetch.
- Click the event to open the full Wikipedia page (`href`).

## License

Community plugin. See [sidefy-plugins](https://github.com/sidefy-team/sidefy-plugins) for contribution guidelines.
