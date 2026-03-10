# Population Notifier - IW4MAdmin Plugin

JavaScript plugin for [IW4MAdmin](https://github.com/RaidMax/IW4M-Admin) that sends Discord notifications when server population crosses configured player thresholds.

## What It Does

- Tracks player population per active server.
- Sends threshold alerts only when crossing upward.
- Resets a threshold once population drops below it.
- Supports multiple threshold/message pairs through config.
- Uses Discord bot token + channel id for delivery.

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
| `discordChannelId` | string | *(empty)* | Discord channel id where notifications are posted. |

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
  "discordChannelId": "123456789012345678"
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

## Startup Behavior

- Max players is fixed at `18`.
- On first observation after plugin startup, if a server is already at/above one or more thresholds, only the highest met threshold message is sent.
- If the server is already full (`18/18`) at startup, no startup alert is sent.

## In-Game Command

| Command | Alias | Permission | Description |
|---|---|---|---|
| `!popnotify` | `!pn` | User | Shows current plugin status (thresholds, notifiers, known servers). |

## Troubleshooting

- Confirm the bot has `Send Messages` permission in the target channel.
- Confirm `discordBotToken` and `discordChannelId` are both set.
- Check IW4M logs for `Population Notifier` entries like:
  - `Initial population snapshot...`
  - `Threshold crossed upward...`
  - `Discord send attempt...`
  - `Discord notification accepted...` or `Discord notification failed...`
