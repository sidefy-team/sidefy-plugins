# Crypto Price Monitor

A Nunc plugin that monitors cryptocurrency prices via CoinGecko API and shows alerts in your timeline.

## Features

- **Multi-Token Monitoring**: Track multiple cryptocurrencies in a single plugin instance.
- **Price Threshold Alerts**: Highlight when price drops below or rises above your configured thresholds.
- **Percentage Change Alerts**: Highlight when 24h price change exceeds your configured percentage.
- **Multilingual Support**: Event titles, alert texts, and notes support zh, en, ja, and ko.
- **Color Coding**: Green for price up, red for down, blue for flat, orange for triggered alerts.

## Configuration

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `tokens` | string | `bitcoin,ethereum` | CoinGecko token IDs, comma-separated | `solana,bitcoin,ethereum` |
| `interval_minutes` | number | `15` | Minimum interval in minutes between API calls. Price data is cached for this duration. | `interval_minutes = 15` |
| `{token}_alert_below` | number | (Optional) | Manually add this key. Alert when price drops below this value. | `solana_alert_below = 150` |
| `{token}_alert_above` | number | (Optional) | Manually add this key. Alert when price rises above this value. | `solana_alert_above = 250` |
| `{token}_alert_change_pct` | number | (Optional) | Manually add this key. Alert when 24h change exceeds this absolute percentage. | `solana_alert_change_pct = 10` |

## Example Configuration

```
tokens = solana,bitcoin

solana_alert_below = 150
solana_alert_above = 250
solana_alert_change_pct = 10

bitcoin_alert_below = 80000
```

## Display Format

### Normal

```
SOL $150.23 ↗ +3.45% (24h)
```

### Alert Triggered

```
[ALERT] SOL $149.50 ↗ +3.45% (24h) (< $150)
[ALERT] BTC $86000.00 ↘ -12.00% (24h) (> $85000, |Δ| > 10%)
```

Alerts stay visible for as long as the condition is true. Empty, nonnumeric, non-finite, and negative thresholds are ignored. Missing 24h changes display as unavailable and do not trigger percentage alerts.

Prices use two decimal places at or above $1 and four significant digits below $1; very small prices use scientific notation. Notes show the full local update date and time. Cached quotes are marked stale when a refresh fails, the quote is older than the configured interval, or its update time is unknown. Existing threshold highlights may remain on stale quotes.

Failed requests and unknown token IDs respect the configured retry interval. Adding a token triggers an immediate refresh. Alert and stale labels follow the app language.

## How to Find CoinGecko Token IDs

1. Go to [CoinGecko](https://www.coingecko.com) and search for a token.
2. Open the token's detail page.
3. Copy the ID from the URL: `https://www.coingecko.com/en/coins/{token-id}`.
4. Use the lowercase ID in your `tokens` configuration.

## Data Source

CoinGecko API: `https://api.coingecko.com/api/v3/simple/price`

## Changelog

### v1.1.5

- Keep the existing configuration keys and input format
- Validate prices and thresholds; distinguish missing changes from zero
- Apply retry intervals to failed requests, missing tokens, and symbol lookups
- Show full update timestamps and mark stale quotes
- Adapt price precision and localize alert labels

### v1.1.4

- Remove alert cooldown; show `[ALERT]` whenever the condition is still true

### v1.1.3

- Restore CoinGecko `simple/price` fetch after `coins/markets` failed in Sidefy

### v1.1.2

- Show 24h window on price change in the event title
- Unify percentage-change alert text as `|Δ| > x%`
- Store price, symbol, and related state in one JSON keyed by coin
- Reuse cached coin state if the price request fails; resolve symbols into the same JSON

### v1.1.1

- Expanded i18n to 4 languages (zh, en, ja, ko)

### v1.1.0

- Display price events as all-day items instead of pinning to API update time
- Show price update time (HH:MM:SS) in event notes
- Use `sidefy.date.format` for timeline dates

### v1.0.0

- Initial release
- Multi-token price monitoring via CoinGecko API
- Price threshold alerts (above / below)
- 24h percentage change alerts
- Multilingual support (zh, en, ja, ko)
- Color-coded price change indicators
