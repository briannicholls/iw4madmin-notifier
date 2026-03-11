# Population Notifier - IW4MAdmin Plugin

JavaScript plugin for [IW4MAdmin](https://github.com/RaidMax/IW4M-Admin) that posts Discord updates for server population.

## What It Does

- Maintains one persistent status message per server in a Discord channel.
- Updates each status message with current player count, readable map name, and readable mode name.
- Sends separate `@here` notify messages when thresholds are crossed.
- Enforces a global anti-spam cooldown: max one notify message every 1 hour (across all servers).
- Auto-deletes a server's active notify message when that server drops below 3 players.
- Uses pre-hosted BO2 map thumbnails from the `iw4m` S3 bucket in status embeds.

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

## Behavior Rules

- Max players is fixed at `18`.
- Startup behavior: if a server is already at/above thresholds, only the highest met threshold is considered.
- Startup full-server exception: if server is already full (`18/18`), startup notify is skipped.
- Notify cooldown: only one notify send per 60 minutes globally across all servers.
- Notify cleanup: active notify message for a server is deleted whenever observed population is below `3` players (including enter/leave activity events).
- Status creation guard: a new status message is not created while server population is `0`; once created, it can still be updated to `0/18`.
- Notify message format: one sentence with `@here` and your configured threshold message.

## Thumbnail Pipeline

- Thumbnail URLs are resolved against the fixed base URL: `https://iw4m.s3.us-east-2.amazonaws.com`.
- Status embeds resolve map images as `https://iw4m.s3.us-east-2.amazonaws.com/loadscreen_<mapSlug>.jpg`.
- Local thumbnail generation is optional and not part of `npm run build`.

## S3 Bucket Setup

- Example base URL:
  - `https://iw4m.s3.us-east-2.amazonaws.com`
- Required bucket/object settings:
  - Upload all thumbnail files to bucket root with filenames like `loadscreen_mp_raid.jpg`.
  - Ensure objects are publicly readable (`s3:GetObject`) for the files being served.
  - Set object `Content-Type` to `image/jpeg`.
  - Keep URLs unsigned (no temporary query params).
- Recommended cache header:
  - `Cache-Control: public, max-age=31536000, immutable`

Minimal read-only bucket policy example:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPublicReadForThumbnails",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

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
