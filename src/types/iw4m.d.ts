declare const __PLUGIN_VERSION__: string;

declare const System: {
  String: unknown;
  Collections: {
    Generic: {
      Dictionary: new (...args: unknown[]) => {
        add: (key: string, value: string) => void;
      };
    };
  };
};

declare function importNamespace(namespaceName: string): {
  ScriptPluginWebRequest: new (
    url: string,
    body: string,
    method: string,
    contentType: string,
    headers: unknown
  ) => unknown;
};
