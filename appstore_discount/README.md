# AppStore Discount Tracker

Monitor App Store app prices and get timeline notifications when prices drop below your configured reference price.

## Features

- Monitor multiple apps across different regions
- Per-app region and reference price configuration
- Color-coded discount levels
- Smart caching (refreshes daily)

## Configuration

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `apps` | string | — | App Store app IDs, comma-separated | `6751482006,9876543210` |
| `default_region` | string | `us` | Default region when `{appId}_region` is not set | `default_region = us` |
| `{appId}_region` | string | (Optional) | Manually add this key. Store region for the app. | `6751482006_region = us` |
| `{appId}_original_price` | number | (Required) | Manually add this key. Reference/regular price. | `6751482006_original_price = 19.99` |

## Example Configuration

```
apps = 6751482006,9876543210

6751482006_region = us
6751482006_original_price = 19.99

9876543210_region = cn
9876543210_original_price = 68.00

default_region = us
```

## How to Find App ID

1. Open the App Store and find the app
2. Copy the share link (e.g. `https://apps.apple.com/us/app/goodnotes-6/id6751482006`)
3. The numbers after `id` are the app ID (e.g. `6751482006`)

## How to Determine Reference Price

The iTunes API only returns the current price — it cannot detect whether an app is on sale. Set `{appId}_original_price` to the regular price (or your target buy price).

## Discount Color Coding

- Blue (0–24%): Small discount
- Yellow (25–49%): Medium discount
- Orange (50–74%): Large discount
- Red (75%+): Huge discount

## Changelog

### v1.0.0

- **Breaking change** — config format replaced; `app_data` is no longer used

**What changed**

| Before (v0.0.x) | After (v1.0.0) |
|-----------------|----------------|
| Single `app_data` field | `apps` list + per-app `{appId}_*` keys |
| Format: `12345_us_68.00,9876543_cn_38.00` | See [Example Configuration](#example-configuration) |

**Migration**

Old config:

```
app_data = 6751482006_us_19.99,9876543210_cn_68.00
```

New config:

```
apps = 6751482006,9876543210

6751482006_region = us
6751482006_original_price = 19.99

9876543210_region = cn
9876543210_original_price = 68.00
```

If all apps share the same region, set `default_region` and omit `{appId}_region`.
