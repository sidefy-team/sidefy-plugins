# Sunrise Sunset

A Sidefy plugin that displays today's sunrise and sunset times on your timeline, calculated locally using the NOAA solar position algorithm.

## Features

- **Local Calculation**: Uses NOAA solar position algorithm, no network required.
- **Daylight Duration**: Sunrise event shows total daylight hours and minutes.
- **Custom Location**: Configurable latitude and longitude, defaults to Xi'an, China.
- **Polar Day/Night**: Handles edge cases where the sun never rises or never sets.
- **Multilingual Support**: Supports English and Chinese.

## Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `city_name` | string | `Xi'an` | Display name of the city |
| `latitude` | number | `34.26` | Latitude of the location |
| `longitude` | number | `108.94` | Longitude of the location |
| `timezone_offset` | string | `8` | UTC offset in hours (e.g. 8 for UTC+8, -5 for UTC-5). Required. |

## Algorithm

Based on the [NOAA Solar Position Calculator](https://gml.noaa.gov/grad/solcalc/). Timezone offset is user-configured via the required `timezone_offset` parameter.

## Changelog

### v1.0.0

- Initial release
- NOAA solar position algorithm for sunrise/sunset calculation
- Configurable latitude, longitude, and city name
- Polar day/night detection
- Daylight duration display
- Multilingual support (English and Chinese)