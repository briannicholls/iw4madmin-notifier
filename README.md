# Population Notifier - IW4MAdmin Plugin

JavaScript plugin for [IW4MAdmin](https://github.com/RaidMax/IW4M-Admin) that posts Discord updates for server population.

## What It Does

- Maintains one persistent status message per server in a Discord channel.
- Updates each status message with current player count and map.
- Sends separate `@here` notify messages when thresholds are crossed.
- Enforces a global anti-spam cooldown: max one notify message every 1 hour (across all servers).
- Auto-deletes a server's active notify message when that server drops below 3 players.
- Supports optional map image URLs by map name.

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
| `mapImageUrls` | object | `{}` | Optional map-name to image URL dictionary. Keys are normalized to lowercase. |

Example:

```json
{
  "alerts": [
    {
      "threshold": 1,
      "message": "[Join] {serverName} has activity ({playerCount}/{maxPlayers})."
    },
    {
      "threshold": 6,
      "message": "[Warmup] {serverName} reached {playerCount}/{maxPlayers} players."
    },
    {
      "threshold": 11,
      "message": "[Hot] {serverName} reached {playerCount}/{maxPlayers} players. {slotsRemaining} slots left."
    }
  ],
  "discordBotToken": "BotTokenHere",
  "discordChannelId": "123456789012345678",
  "mapImageUrls": {
    "mp_nuketown": "https://your-cdn.example/maps/mp_nuketown.jpg",
    "mp_slums": "https://your-cdn.example/maps/mp_slums.jpg"
  }
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
- Notify cleanup: active notify message for a server is deleted when that server drops below `3` players.
- Status creation guard: a new status message is not created while server population is `0`; once created, it can still be updated to `0/18`.

## In-Game Command

| Command | Alias | Permission | Description |
|---|---|---|---|
| `!popnotify` | `!pn` | User | Shows plugin status (thresholds, cooldown, known servers, active messages). |

## Troubleshooting

- Confirm bot permissions in the channel: `View Channel`, `Send Messages`, `Embed Links`, and `Mention @everyone, @here, and All Roles`.
- Confirm `discordBotToken` and `discordChannelId` are both set.
- Check IW4M logs for `Population Notifier` entries such as:
  - `Initial population snapshot...`
  - `Threshold crossed upward...`
  - `Notify suppressed by global cooldown...`
  - `Discord status message created/updated...`
  - `Discord notify message created/updated/deleted...`
