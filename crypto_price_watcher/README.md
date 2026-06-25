# Crypto Price Monitor

A Sidefy plugin that monitors cryptocurrency prices via CoinGecko API and shows alerts in your timeline.

## Features

- **Multi-Token Monitoring**: Track multiple cryptocurrencies in a single plugin instance.
- **Price Threshold Alerts**: Get notified when price drops below or rises above your configured thresholds.
- **Percentage Change Alerts**: Get notified when 24h price change exceeds your configured percentage.
- **Cooldown Mechanism**: Prevent repeated alerts for the same condition within a configurable cooldown period.
- **Multilingual Support**: Event titles and alert texts support English and Chinese.
- **Color Coding**: Green for price up, red for down, blue for flat, orange for triggered alerts.

## Configuration

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `tokens` | string | `bitcoin,ethereum` | CoinGecko token IDs, comma-separated | `solana,bitcoin,ethereum` |
| `interval_minutes` | number | `15` | Minimum interval in minutes between API calls. Price data is cached for this duration. | `interval_minutes = 15` |
| `alert_cooldown_hours` | number | `6` | Cooldown in hours for the same alert condition on the same token. Set to `0` to disable. | `alert_cooldown_hours = 6` |
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

alert_cooldown_hours = 6
```

## Display Format

### Normal

```
SOL $150.234567 ↗ +3.45%
```

### Alert Triggered

```
[ALERT] SOL $149.500000 ↗ +3.45% (< $150)
[ALERT] BTC $86000.000000 ↘ -1.20% (> $85000, 24h change > 10%)
```

## How to Find CoinGecko Token IDs

1. Go to [CoinGecko](https://www.coingecko.com) and search for a token.
2. Open the token's detail page.
3. Copy the ID from the URL: `https://www.coingecko.com/en/coins/{token-id}`.
4. Use the lowercase ID in your `tokens` configuration.

## Data Source

CoinGecko API: `https://api.coingecko.com/api/v3/simple/price`

## Changelog

### v1.0.0

- Initial release
- Multi-token price monitoring via CoinGecko API
- Price threshold alerts (above / below)
- 24h percentage change alerts
- Configurable alert cooldown
- Multilingual support (English and Chinese)
- Color-coded price change indicators