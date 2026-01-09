# Countdown Day

A Sidefy plugin that displays the number of days remaining until a specified date in your timeline.

## Features

- **Custom Target Date**: Set any date you want to track (e.g., product launches, birthdays, deadlines).
- **Custom Event Name**: Give your countdown a meaningful name.
- **Automatic Calculation**: 
  - **Upcoming**: Shows "X days until [Name]".
  - **Today**: Highlights in red "Today is [Name]!".
  - **Past**: Shows "[Name] was X days ago" in gray.
- **Multilingual Support**: Supports English and Chinese.

## Configuration

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `target_date` | date | (Required) | The target date to count down to | `2026-01-01` |
| `event_name` | string | `Important Day` | The name of the event | `Market Launch` |

## Installation

1. Open **Sidefy** and go to the **Plugin Center**.
2. Search for "Countdown Day" and install it.
3. Configure the `target_date` and `event_name` in the plugin settings.

## Changelog

### v0.1.1

- Updated to use native `date` type for `target_date` parameter
- Improved configuration experience with date picker

### v0.1.0

- Initial release
- Support for target date and event name
- Multi-language support (English and Chinese)
- Color-coded status (Blue for upcoming, Red for today, Gray for past)
