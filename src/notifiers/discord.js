function responseToText(response) {
  if (response == null) return '';
  if (typeof response === 'string') return response;

  try {
    if (typeof response.body === 'string') return response.body;
    if (typeof response.content === 'string') return response.content;
    if (typeof response.data === 'string') return response.data;
  } catch (_) { }

  try {
    return JSON.stringify(response);
  } catch (_) {
    try {
      return String(response);
    } catch (_error) {
      return '';
    }
  }
}

function createHeaders(botToken) {
  const stringDict = System.Collections.Generic.Dictionary(System.String, System.String);
  const headers = new stringDict();

  const token = String(botToken || '');
  const authValue = token.indexOf('Bot ') === 0 ? token : ('Bot ' + token);
  headers.add('Authorization', authValue);

  return headers;
}

function requestJson(plugin, url, method, bodyObject, headers, done) {
  try {
    const pluginScript = importNamespace('IW4MAdmin.Application.Plugin.Script');
    const body = bodyObject ? JSON.stringify(bodyObject) : '';
    const request = new pluginScript.ScriptPluginWebRequest(
      url,
      body,
      method,
      'application/json',
      headers
    );

    plugin.pluginHelper.requestUrl(request, function (response) {
      const text = responseToText(response);
      if (!text || String(text).trim() === '') {
        done(true, '', response);
        return;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (_jsonErr) { }

      if (parsed && parsed.id) {
        done(true, '', response);
        return;
      }

      if (String(text).indexOf('"id"') !== -1) {
        done(true, '', response);
        return;
      }

      done(false, text, response);
    });
  } catch (error) {
    done(false, error && error.message ? error.message : 'discord request setup failed', null);
  }
}

export function createDiscordNotifier(config) {
  const botToken = String(config && config.discordBotToken ? config.discordBotToken : '').trim();
  const channelId = String(config && config.discordChannelId ? config.discordChannelId : '').trim();

  if (!botToken || !channelId) return null;

  const url = 'https://discord.com/api/v10/channels/' + channelId + '/messages';

  return {
    name: 'discord',
    send: function (plugin, messageText) {
      const headers = createHeaders(botToken);
      plugin.logger.logInformation('{Name}: Discord send attempt channel={ChannelId} message_length={Length}',
        plugin.name,
        channelId,
        String(messageText || '').length);

      requestJson(plugin, url, 'POST', { content: String(messageText || '') }, headers, function (ok, errorText, response) {
        if (!ok) {
          plugin.logger.logWarning('{Name}: Discord notification failed - {Error}',
            plugin.name,
            String(errorText || 'unknown discord error'));
          return;
        }

        const statusCode = response && (response.statusCode || response.status || response.StatusCode);
        plugin.logger.logInformation('{Name}: Discord notification accepted channel={ChannelId} status={Status}',
          plugin.name,
          channelId,
          statusCode == null ? '(unknown)' : String(statusCode));
      });
    }
  };
}
