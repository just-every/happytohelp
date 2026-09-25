import {useEffect} from 'react';
import {envelope, exactOrigin, validateCommand} from '../../../modules/plugin-sdk/protocol';

export default function usePluginMessageEvent(handler, type = null) {
  useEffect(() => {
    const receive = event => {
      if (!envelope(event.data) || !validateCommand(event.data.type, event.data.payload) || type && event.data.type !== type) return;
      const frame = [...document.querySelectorAll('iframe[data-h2h-plugin-origin]')].find(frame => frame.contentWindow === event.source);
      if (!frame) return;
      try {
        const origin = exactOrigin(frame.dataset.h2hPluginOrigin);
        if (event.origin !== origin || new URL(frame.src).origin !== origin) return;
      } catch { return; }
      handler(event);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [handler, type]);
}
