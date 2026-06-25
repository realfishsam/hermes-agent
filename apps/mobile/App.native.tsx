import { useCallback, useRef } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { bundledRendererHtml } from './src/bundled-renderer-html';

const rendererUrl = process.env.EXPO_PUBLIC_RENDERER_URL;
const defaultGatewayUrl = process.env.EXPO_PUBLIC_HERMES_GATEWAY_URL || 'https://hermes-desktop.pmxt.dev';
const defaultGatewayToken = process.env.EXPO_PUBLIC_HERMES_GATEWAY_TOKEN || '';

function toWebSocketUrl(baseUrl: string, token: string) {
  const url = new URL('/ws', baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  if (token) {
    url.searchParams.set('token', token);
  }
  return url.toString();
}

const mobileDesktopBridgeScript = `
  (function () {
    var gatewayUrl = ${JSON.stringify(defaultGatewayUrl)}.replace(/\\/+$/, '');
    var gatewayToken = ${JSON.stringify(defaultGatewayToken)};
    var connection = {
      baseUrl: gatewayUrl,
      isFullscreen: false,
      mode: 'remote',
      authMode: 'token',
      nativeOverlayWidth: 0,
      source: 'settings',
      token: gatewayToken,
      wsUrl: ${JSON.stringify(toWebSocketUrl(defaultGatewayUrl, defaultGatewayToken))},
      logs: [],
      profile: 'default',
      windowButtonPosition: null
    };
    var noopUnsubscribe = function () { return function () {}; };
    window.hermesDesktop = {
      api: function (request) {
        return new Promise(function (resolve, reject) {
          var id = 'mobile-' + Date.now() + '-' + Math.random().toString(16).slice(2);
          function onMessage(event) {
            var payload = event && event.data;
            if (typeof payload === 'string') {
              try { payload = JSON.parse(payload); } catch (_) {}
            }
            if (!payload || payload.type !== 'hermes:api:result' || payload.id !== id) return;
            window.removeEventListener('message', onMessage);
            if (payload.ok) resolve(payload.data);
            else reject(new Error(payload.error || 'Hermes API request failed'));
          }
          window.addEventListener('message', onMessage);
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'hermes:api',
            id: id,
            request: {
              baseUrl: gatewayUrl,
              token: gatewayToken,
              method: request && request.method,
              path: request && request.path,
              body: request && request.body,
              timeoutMs: request && request.timeoutMs
            }
          }));
        });
      },
      getConnection: function () { return Promise.resolve(connection); },
      getConnectionConfig: function () { return Promise.resolve({
        envOverride: true,
        mode: 'remote',
        profile: null,
        remoteAuthMode: gatewayToken ? 'token' : 'oauth',
        remoteOauthConnected: !gatewayToken,
        remoteTokenPreview: gatewayToken ? 'set' : null,
        remoteTokenSet: !!gatewayToken,
        remoteUrl: gatewayUrl
      }); },
      getBootProgress: function () { return Promise.resolve({ phase: 'done', message: 'Connected', progress: 100 }); },
      onBootProgress: noopUnsubscribe,
      onPowerResume: noopUnsubscribe,
      revalidateConnection: function () { return Promise.resolve(connection); },
      touchBackend: function () { return Promise.resolve(); },
      profile: { set: function () { return Promise.resolve(); } },
      settings: { getDefaultProjectDir: function () { return Promise.resolve('~'); } },
      sanitizeWorkspaceCwd: function (cwd) { return Promise.resolve(cwd || '~'); },
      setTranslucency: function () { return Promise.resolve(); },
      notify: function () { return Promise.resolve(); },
      applyConnectionConfig: function () { return Promise.resolve(connection); }
    };
  })();
  true;
`;

const disableViewportZoomScript = `
  (function () {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    document.documentElement.style.webkitTextSizeAdjust = '100%';
    document.documentElement.style.textSizeAdjust = '100%';
  })();
  true;
`;

type HermesApiMessage = {
  id?: string;
  request?: {
    baseUrl?: string;
    body?: string;
    method?: string;
    path?: string;
    timeoutMs?: number;
    token?: string;
  };
  type?: string;
};

function cleanBaseUrl(value: unknown) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  return trimmed || 'http://127.0.0.1:8642';
}

function postResultScript(id: string, payload: { data?: unknown; error?: string; ok: boolean }) {
  return `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
    JSON.stringify({ type: 'hermes:api:result', id, ...payload })
  )} })); true;`;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);

  const sendResult = useCallback((id: string, payload: { data?: unknown; error?: string; ok: boolean }) => {
    webViewRef.current?.injectJavaScript(postResultScript(id, payload));
  }, []);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let message: HermesApiMessage | null = null;
      try {
        message = JSON.parse(event.nativeEvent.data) as HermesApiMessage;
      } catch {
        return;
      }

      if (!message || message.type !== 'hermes:api' || !message.id || !message.request?.path) {
        return;
      }

      const id = message.id;
      const request = message.request;
      const method = String(request.method || 'GET').toUpperCase();
      const baseUrl = cleanBaseUrl(request.baseUrl);
      const url = `${baseUrl}${request.path}`;
      const timeoutMs = Number(request.timeoutMs) > 0 ? Number(request.timeoutMs) : 30000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const headers: Record<string, string> = { accept: 'application/json' };
        if (request.body !== undefined) {
          headers['content-type'] = 'application/json';
        }
        if (request.token) {
          headers['X-Hermes-Session-Token'] = request.token;
          headers.authorization = `Bearer ${request.token}`;
        }

        const response = await fetch(url, {
          body: request.body,
          headers,
          method,
          signal: controller.signal,
        });
        const text = await response.text();

        if (!response.ok) {
          throw new Error(`Hermes API ${response.status} ${request.path}${text ? `: ${text.slice(0, 240)}` : ''}`);
        }

        let data: unknown = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }

        sendResult(id, { ok: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendResult(id, { ok: false, error: `${method} ${request.path} failed: ${message}` });
      } finally {
        clearTimeout(timer);
      }
    },
    [sendResult]
  );

  return (
    <SafeAreaView style={styles.root}>
      <WebView
        ref={webViewRef}
        source={rendererUrl ? { uri: rendererUrl } : { html: bundledRendererHtml, baseUrl: 'https://hermes.local/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScriptBeforeContentLoaded={`${mobileDesktopBridgeScript}\n${disableViewportZoomScript}`}
        scalesPageToFit={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        allowsBackForwardNavigationGestures
        startInLoadingState
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060a' },
});
