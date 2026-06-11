# Population Notifier - IW4MAdmin Plugin

Plugin for [IW4MAdmin](https://github.com/RaidMax/IW4M-Admin) that posts Discord notifications when your servers fill up.

<img width="439" height="278" alt="{745556EF-1D35-4A7B-96FC-944FF9F55533}" src="https://github.com/user-attachments/assets/2850a9ab-2ac5-4c49-bbe0-b06d92c4ea97" />

## Features

- Persistent dashboard message updates in real-time
- Configurable player count thresholds
- 60-minute global cooldown prevents spam
- Auto-cleanup after 90 seconds below 3 players
- Servers grouped by game with population, map, and mode
- Readable map names and custom emojis

## Installation

1. Copy `dist/PopulationNotifier.js` to your IW4MAdmin `Plugins` folder

2. Edit your config file and set up your notifications (See Configuration below) 

3. Restart IW4MAdmin

## Configuration

Add this to `ScriptPluginSettings.json`:

```json
{
  "PopulationNotifier": {
    "config": {
      "alerts": [
        { "threshold": 1, "message": "{serverName} is getting active!" },
        { "threshold": 6, "message": "{serverName} is filling up!" },
        { "threshold": 11, "message": "{serverName} is getting crowded!" }
      ],
      "discordBotToken": "YOUR_BOT_TOKEN",
      "discordChannelId": "YOUR_CHANNEL_ID",
      "discordRoleId": "YOUR_ROLE_ID",
      "iw4mApiBaseUrl": "https://your-iw4madmin.example.com",
      "statusOnlineEmoji": "<a:online_ping:1512275050768760863>",
      "statusOfflineEmoji": "<a:offline_ping:1512275084813799554>"
    }
  }
}
```

You can right click an emoji in Discord to get its ID. Note that if you use an animated emoji, you need the "a:" in front of it.

### Config Options

| Key | Required | Description |
|-----|----------|-------------|
| `alerts` | Yes | Array of threshold rules with `threshold` (number) and `message` (string) |
| `discordBotToken` | Yes | Discord bot token |
| `discordChannelId` | Yes | Discord channel ID for messages |
| `discordRoleId` | No | Role ID to mention (uses `@here` if not set) |
| `iw4mApiBaseUrl` | No | IW4MAdmin webfront URL for game detection |
| `statusOnlineEmoji` | No | Emoji for servers with players |
| `statusOfflineEmoji` | No | Emoji for empty servers |

### Message Placeholders

- `{serverName}` - Server name
- `{serverKey}` - Server identifier
- `{playerCount}` - Current players
- `{maxPlayers}` - Max players (18)
- `{slotsRemaining}` - Empty slots
- `{threshold}` - Number of players that triggers the message
- `{fillPercent}` - Fill percentage

## Discord Bot Setup

1. Create bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Copy bot token from **Bot** tab
3. Set permissions: View Channel, Send Messages, Embed Links, Manage Messages, Mention Roles (permission integer: `378880`)
4. Invite bot using OAuth2 URL Generator
5. Get channel ID: Enable Developer Mode → Right-click channel → Copy Channel ID
6. Get role ID (optional): Right-click role → Copy Role ID

## Usage

Run `!popnotify` or `!pn` in-game to check plugin status, thresholds, and cooldowns.

The plugin creates a status dashboard in Discord via a message with one embed per game:

The dashboard updates as players join and leave. Messages configured in your `ScriptPluginSettings.json` are sent as the server fills (max once per hour). 
 
Notifications delete after 90 seconds below 3 players.

## Behavior Details

Dashboard updates on player join/leave. It shows up to 10 game groups, sorts servers by population, and falls back to "more servers not shown" when truncated. Map names use readable names when available.

Notifications fire only on upward threshold crossings. The 60-minute cooldown applies across all servers. At startup, if a server already meets multiple thresholds, only the highest one triggers. Full servers at startup skip notifications.

Notifications delete after 90 seconds below 3 players. The dashboard stays up.

## Development

Available scripts:
- `npm run build` compiles to single JS file for use as a plugin
- `npm run typecheck` runs type checking
- `npm test` runs tests
- `npm run mock:dashboard` generates mock dashboard data

Preview the dashboard locally with mock data:
```bash
npm run mock:dashboard -- --servers 20
```

Send mock data to Discord (requires `.env` with `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID`):
```bash
npm run mock:dashboard -- --servers 20 --send
```

## License

[MIT License](LICENSE)
