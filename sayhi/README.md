# Say Hi — Daily Wikipedia Greeting

<img width="994" height="338" alt="Say Hi daily Wikipedia greeting preview" src="preview.png" />

A Sidefy plugin that fetches a random **English Wikipedia** article each day and uses AI to generate both the **event title** and **greeting note** in your app language (`sidefy.app.language()`).

## How It Works

1. **Random Pick** — On the first run each day (cache miss), follows the configured English Wikipedia category and its subcategories. Batches of up to 20 candidate articles are verified against Wikidata before fetching a selected article's summary. Animal and plant topics require species rank and the corresponding taxonomic ancestry; place topics require the corresponding entity type. People, lists, disambiguation pages, and unverified articles are skipped. Traversal is bounded to eight category levels, four batches of 500 members per category, and three attempts; sampling is not uniform across all articles.
2. **AI Content** — The page title and summary are sent to `sidefy.ai.chat`, which returns JSON with a **title** containing the entity's name and a **greeting** in your app language. Title wording and structure are otherwise freely chosen. The species or place speaks in first person, with a natural opening and flow inspired by facts from the summary. No fixed greeting, self-introduction, or sentence count is required.
3. **Timeline Event** — An all-day event (midnight) with the AI title, AI greeting in `notes`, article thumbnail, and a link to Wikipedia
4. **Daily Cache** — Cached until local midnight (category lookups, an article summary fetch, and one AI call per day per category and app language)

## Configuration

`category` is required and defaults to `Animals`. Enter one English Wikipedia category name. Empty or whitespace-only values are rejected.

Examples: `Animals` (animals), `Birds` (birds), `Mammals` (mammals), `Plants` (plants), `Trees` (trees), `Flowers` (flowers), `Countries` (countries), `Cities` (cities), `Islands` (islands), `Mountains` (mountains).

Changing the category generates fresh content on the next fetch. Wikidata filters out related people and concepts before any AI call. `Trees` uses plant species within the Wikipedia category; `Flowers` requires flowering plant species. Other category names accept only animal/plant species or countries, cities, islands, mountains, and regions. Missing type data or service failures never fall back to unverified articles; if no eligible article is found within the attempt limit, the plugin shows an error.

## Requirements

- **Network** — Fetches category members, page properties, and summaries from `en.wikipedia.org`; verifies structured types through `query.wikidata.org`. Type filtering consumes no AI tokens.
- **Storage** — Caches the result until end of day by category (scoped by app language automatically)
- **AI** — **Required.** An LLM API key must be configured in Sidefy's Advanced Settings. If AI fails, the plugin shows an error and no event (no template fallback).

## Example

With app language set to English, you might see:

> **A hello from the giant panda**
>
> A bamboo shoot in my paw, black patches around my eyes — you might recognise me already. I'm the giant panda, a bear native to China, stopping by with a little bamboo crunch.

With app language set to Chinese, both the title and greeting are written in Chinese (Wikipedia source text remains English).

## Notes

- Wikipedia source is always English; AI output follows your app language.
- One AI call per day per category and app language. Changing Sidefy's language setting generates fresh content on next fetch.
- Click the event to open the full Wikipedia page (`href`).

## License

Community plugin. See [sidefy-plugins](https://github.com/sidefy-team/sidefy-plugins) for contribution guidelines.

## Changelog

### 0.2.5

- Release configurable, Wikidata-verified entity greetings with natural wording and the entity's name in the title.

### 0.2.4

- Require the entity's name in the title while keeping wording and structure free.
- Invalidate cached greetings from the earlier prompt.

### 0.2.3

- Let the model freely choose the message title without prescribed length or style.
- Invalidate cached greetings from the earlier prompt.

### 0.2.2

- Allow natural, varied entity greetings without prescribed openings, self-introductions, sentence counts, or title naming rules.
- Invalidate cached greetings from the earlier prompt.

### 0.2.1

- Generate brief first-person greetings from the selected species or place, with its name in the title and facts grounded in the summary.
- Invalidate cached greetings from the earlier prompt.

### 0.2.0

- Add a required Wikipedia category setting, defaulting to `Animals`, with ten category examples.
- Verify candidate species and places using Wikidata before generating greetings; exclude people and concepts without extra AI calls.
- Separate daily caches by category and invalidate earlier unfiltered results.
