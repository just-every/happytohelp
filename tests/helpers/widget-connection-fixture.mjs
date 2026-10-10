// Test-only browser/network boundary; WidgetTransport is never replaced.
export function connectionFixture() {
  const originals = Object.fromEntries(['fetch', 'WebSocket', 'localStorage', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const online = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', {configurable: true, value: true});
  const storage = new Map(), sockets = [], requests = [];
  const state = {settingsFailure: false, messageFailure: false, transcript: [], revision: 0, sessionCount: 0};
  globalThis.window = Object.assign(new EventTarget(), {setTimeout, clearTimeout, setInterval, clearInterval});
  globalThis.localStorage = {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)};
  globalThis.WebSocket = class {
    constructor(url) {this.url = url; this.readyState = 0; sockets.push(this);}
    open() {this.readyState = 1; this.onopen?.();}
    close(code = 1000) {this.readyState = 3; this.onclose?.({code});}
  };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({url, options});
    if (url.includes('/api/widget/settings')) {
      if (state.settingsFailure) throw new TypeError('Settings network unavailable');
      return Response.json({collectorEnabled: false, project: {name: 'Support'}, settings: {}});
    }
    if (url.endsWith('/widget/session')) {
      state.sessionCount++;
      return Response.json({token: 'visitor-token', contactId: 'visitor', projectId: 'project', settings: {ai_id: 'admitted-agent'}});
    }
    if (url.endsWith('/api/conversations')) return Response.json(options.method === 'POST' ? {id: 'conversation'} : {conversations: []});
    if (url.endsWith('/messages') && options.method === 'POST') {
      const command = JSON.parse(options.body);
      let message = state.transcript.find(message => message.local_id === command.localId);
      const duplicate = !!message;
      if (!message) {
        message = {id: 'message-' + command.localId, local_id: command.localId, content: command.content, actor_role: 'contact', revision: ++state.revision};
        state.transcript.push(message);
      }
      if (state.messageFailure) throw new TypeError('Response lost after admission');
      return Response.json({accepted: true, duplicate, message});
    }
    if (url.endsWith('/messages')) return Response.json({messages: state.transcript, revision: state.revision, lastMessageId: state.transcript.at(-1)?.id || null});
    return Response.json({});
  };
  return {state, sockets, requests, storage, restore() {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
    if (online) Object.defineProperty(navigator, 'onLine', online); else delete navigator.onLine;
  }};
}

export const settle = () => new Promise(resolve => setImmediate(resolve));
