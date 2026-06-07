# Population Notifier - IW4MAdmin Plugin

JavaScript plugin for [IW4MAdmin](https://github.com/RaidMax/IW4M-Admin) that posts Discord updates for server population.

## What It Does

- Maintains one persistent status dashboard message in a Discord channel.
- Updates that dashboard with compact embeds grouped by game.
- Sends separate `@here` notify messages when thresholds are crossed.
- Enforces a global anti-spam cooldown: max one notify message every 1 hour (across all servers).
- Auto-deletes a server's active notify message after that server remains below 3 players for 90 seconds.
- Displays each server with joinable status, population, map name, and mode.

## Installation

1. Run `npm install`.
2. Run `npm run build`.
3. Copy `dist/PopulationNotifier.js` into your IW4MAdmin `Plugins` folder.
4. Restart IW4MAdmin.
5. Edit plugin config in:

```
<IW4MAdmin>/Configuration/ScriptPluginSettings.json
```

## Configuration

Config is stored under your script plugin entry key in the `config` object.

| Key | Type | Default | Description |
|---|---|---|---|
| `alerts` | array | `[{threshold:1,...},{threshold:6,...},{threshold:11,...}]` | Threshold/message rules. Each rule is `{ "threshold": number, "message": string }`. |
| `discordBotToken` | string | *(empty)* | Discord bot token used for channel message API calls. |
| `discordChannelId` | string | *(empty)* | Discord channel id where status + notify messages are posted. |
| `discordRoleId` | string | *(empty)* | Optional Discord role id to mention on notify messages. When unset, notify messages mention `@here`. |
| `iw4mApiBaseUrl` | string | *(empty)* | Optional IW4MAdmin Webfront base URL. When set, the plugin reads `GET /api/server` to resolve each server's game code/name for grouped dashboard embeds. |

Example:

```json
{
  "alerts": [
    {
      "threshold": 1,
      "message": "{serverName} is getting active."
    },
    {
      "threshold": 6,
      "message": "{serverName} is filling up."
    },
    {
      "threshold": 11,
      "message": "{serverName} is getting crowded."
    }
  ],
  "discordBotToken": "BotTokenHere",
  "discordChannelId": "123456789012345678",
  "discordRoleId": "987654321098765432",
  "iw4mApiBaseUrl": "https://your-iw4madmin.example.com"
}
```

## Message Placeholders

These placeholders are available in each alert `message`:

- `{serverName}`
- `{serverKey}`
- `{playerCount}`
- `{maxPlayers}`
- `{slotsRemaining}`
- `{threshold}`
- `{fillPercent}`

## Behavior Rules

- Max players is fixed at `18`.
- Startup behavior: if a server is already at/above thresholds, only the highest met threshold is considered.
- Startup full-server exception: if server is already full (`18/18`), startup notify is skipped.
- Notify cooldown: only one notify send per 60 minutes globally across all servers.
- Notify cleanup: active notify message cleanup waits for population to remain below `3` players for 90 seconds, avoiding false resets during match-load transitions.
- Status dashboard shape: one message with up to `10` game embeds. Servers are grouped by actual game, sorted by active population, and rendered as compact lines inside each game group.
- Status dashboard map display: each server line shows the readable map name. The map slug is only shown as a fallback when no readable name is available.
- Status dashboard joinable status: `:online_ping:` means the server currently has players; `:offline_ping:` means the server has `0` players.
- Status dashboard game display: when `iw4mApiBaseUrl` is configured, game names come from IW4MAdmin's `GET /api/server` response. Otherwise the plugin falls back to game fields exposed on live server/event objects.
- Notify message format: one sentence with either `<@&discordRoleId>` (when configured) or `@here`, plus your configured threshold message.

## Dashboard Layout

- The status dashboard no longer uses map thumbnails.
- Each game gets a single compact embed titled with only the game name and an S3-hosted game logo thumbnail when available.
- Each server appears as a separated block:
  - `:online_ping: **Server Name**  \`players/max\``
  - `*Readable Map*`
  - `Mode Name`
- Long game groups are truncated to stay within Discord embed limits and include a `more servers not shown` note.

## In-Game Command

| Command | Alias | Permission | Description |
|---|---|---|---|
| `!popnotify` | `!pn` | User | Shows plugin status (thresholds, cooldown, known servers, active messages). |

## Local Dashboard Mocking

Use this when you want to preview the single-message Discord dashboard with many fake servers.

- Generate payload only (no Discord send):
  - `npm run mock:dashboard`
- Generate payload with a custom server count:
  - `npm run mock:dashboard -- --servers 20`
- Post a mock dashboard directly to your Discord channel:
  - `DISCORD_BOT_TOKEN=... DISCORD_CHANNEL_ID=... npm run mock:dashboard -- --servers 20 --send`

Notes:
- The script auto-loads `.env` from the repo root if present (`DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID`).
- The mock generates many servers across multiple games so you can preview grouped dashboard layout and overflow behavior.

## Troubleshooting

- Confirm bot permissions in the channel: `View Channel`, `Send Messages`, `Embed Links`, and mention permission for either `@everyone/@here` (fallback mode) or your configured role (`discordRoleId`).
- Confirm `discordBotToken` and `discordChannelId` are both set.
- Check IW4M logs for `Population Notifier` entries such as:
  - `Initial population snapshot...`
  - `Threshold crossed upward...`
  - `Notify suppressed by global cooldown...`
  - `Discord status message created/updated...`
  - `Discord notify message created/updated/deleted...`
