# Plugin Maintenance Audit

Generated during the repository documentation cleanup on 2026-10-29. The i18n baseline is now nine languages matching Nunc `AppConstants.Language`: `zh`, `en`, `ja`, `ko`, `de`, `es`, `fr`, `pt`, `ru`.

## Scope

All directories at the repository root were checked for the required plugin files:

- `main.js`
- `info.json`
- `README.md`

Runtime checks covered declared network, storage, general AI, and AI decision permissions, plus i18n language keys in `main.js`.

## Results

| Plugin | Version | Structure | Permission scan | i18n key scan |
|---|---:|---|---|---|
| appstore_discount | 1.0.3 | complete | passed | passed |
| bilibili_user_videos | 0.4.2 | complete | passed | passed |
| countdown_day | 0.1.6 | complete | passed | passed |
| freshrss | 1.2.4 | complete | passed | passed |
| github_notifications | 0.2.4 | complete | passed | passed; discontinued |
| github_repositories | 1.1.1 | complete | passed | passed; review logs separately |
| github_user_events | 0.2.3 | complete | passed | passed; discontinued |
| pokemon_daily | 0.0.7 | complete | passed | passed |
| sspai_article_comments | 1.2.10 | complete | passed | passed |
| steam_wishlist_discount | 0.1.7 | complete | passed | passed |
| stock_quotes | 1.0.4 | complete | passed | passed |
| sunrise-sunset | 1.0.7 | complete | passed | passed |
| switch_wishlist_discount | 1.0.6 | complete | passed | passed |
| unsplash_daily_theme | 0.2.2 | complete | passed | passed |
| v2ex_notifications | 1.1.4 | complete | passed | passed |
| x_posts | 0.2.2 | complete | passed | passed |

## Follow-up items

- The two GitHub plugins are discontinued. Their i18n migration is complete for the maintained source, but they should remain clearly marked and should not be treated as new-plugin examples.
- Continue reviewing input validation, cache-key isolation, credential handling, and external URL construction per the security checklist in `README.md`.
- Every behavior change must update the plugin version and the matching README Changelog entry.
- All 16 complete plugins contain the nine required i18n language keys; `x_posts` uses quoted keys, which are semantically equivalent and is covered by the source inspection.
- Static checks do not replace running plugins in Nunc on macOS; validate representative output in each supported app language before release.

This audit is a maintenance baseline, not a security certification.
