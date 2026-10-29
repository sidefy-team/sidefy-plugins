# Stock Quotes

Track mainland China, Hong Kong, and US stock prices on your Nunc timeline using Tencent Finance. No API key required.

## Features

- Monitor multiple stocks with one comma-separated symbol list
- Show the latest price, currency, price change, percentage change, and previous close
- Display each stock as an all-day event with the market timestamp in its notes
- Red for gains, green for losses, and gray for no change
- Chinese, English, Japanese, and Korean runtime labels and errors
- Click an event to open its Tencent Finance quote page

## Configuration

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `symbols` | string | `usAAPL` | Stock codes separated by commas, up to 50 unique codes | `usAAPL,sh600519,sz000001,hk00700` |

## Example Configuration

```text
symbols = usAAPL,sh600519,sz000001,hk00700
```

Spaces around codes and Chinese commas are accepted. Duplicate codes are removed. Configure all stocks in this field; plugin duplication is disabled.

## Stock Code Format

| Market | Prefix | Example | Company |
|--------|--------|---------|---------|
| Shanghai | `sh` | `sh600519` | Kweichow Moutai |
| Shenzhen | `sz` | `sz000001` | Ping An Bank |
| Hong Kong | `hk` | `hk00700` | Tencent |
| United States | `us` | `usAAPL` | Apple |

Shanghai and Shenzhen codes have six digits; Hong Kong codes have five. US codes use the ticker after `us`.

## Permissions

Enable **Network** permission. Storage, AI, AI Decision, and Crawler permissions are not required.

## Notes

- Quotes may be delayed. During market closures, the plugin shows the last available trading session.
- Events appear on the current local day. Quote timestamps retain their market time zone: US Eastern Time for US stocks and UTC+8 for mainland China and Hong Kong stocks.
- Prices use CNY, HKD, or USD according to the market.
- Company names are supplied by Tencent and may remain Chinese regardless of the app language.
- Quotes refresh when Nunc runs the plugin. There is no additional plugin cache.
- Missing or invalid quotes are skipped. A failed request or no valid quotes produces an error.
- Tencent's public quote endpoint has no availability guarantee.

## Changelog

### v1.0.3

- Lower the minimum app version to 2025.9.0, matching existing plugins that use the same basic runtime APIs.

### v1.0.2

- Disable plugin duplication.
- Align documentation with the repository's plugin README format.

### v1.0.1

- Align runtime localization with the repository's conventions.

### v1.0.0

- Add multi-market stock quotes with a single symbol-list setting.
- Support Chinese, English, Japanese, and Korean runtime messages.
