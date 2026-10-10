// Progressive navigation retains the last real page when a request fails.
// Direct links and the server-rendered search form remain usable without JavaScript.
(() => {
 let pending = null, controller = null;
 const status = () => document.querySelector('[data-help-status]');
 const show = (message, retry = false) => {
  const node = status(); if (!node) return;
  node.hidden = false; node.replaceChildren(document.createTextNode(message));
  if (retry) {
   const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Try again';
   button.addEventListener('click', () => navigate(pending || location.href)); node.append(' ', button);
  }
 };
 const clear = () => { if (status()) status().hidden = true; };
 const eligible = url => document.body.dataset.helpBase !== '/' && url.origin === location.origin && (url.pathname === document.body.dataset.helpBase || url.pathname.startsWith(document.body.dataset.helpBase + '/'));
 async function navigate(destination, push = true) {
  const url = new URL(destination, location.href); pending = url.href;
  controller?.abort(); const request = new AbortController(); controller = request;
  if (!navigator.onLine) { show('You’re offline. The last loaded page is still available.', true); return; }
  show('Loading Help Center…');
  try {
   const response = await fetch(url.href, {signal:request.signal, headers:{Accept:'text/html'}});
   if (!response.ok && response.status !== 404) throw Error('Help Center could not load.');
   const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
   const main = doc.querySelector('main'), nav = doc.querySelector('[data-help-center-nav]');
   if (!main || !nav || !doc.body.dataset.helpBase) throw Error('Help Center could not load.');
   if (controller !== request) return;
   document.querySelector('main').replaceWith(main); document.querySelector('[data-help-center-nav]').replaceWith(nav);
   document.body.dataset.helpBase = doc.body.dataset.helpBase; document.body.style.cssText = doc.body.style.cssText;
   document.title = doc.title; if (push) history.pushState(null, '', url.href);
   pending = null; clear(); main.tabIndex = -1; main.focus(); window.scrollTo(0, 0);
  } catch (error) {
   if (error.name === 'AbortError') return;
   show(navigator.onLine ? 'Help Center could not load. Your last loaded page is still available.' : 'You’re offline. The last loaded page is still available.', true);
  }
 }
 document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.download) return;
  const url = new URL(link.href); if (!eligible(url) || url.hash) return;
  event.preventDefault(); navigate(url.href);
 });
 document.addEventListener('submit', event => {
  if (!event.target.matches('.help-center-search')) return;
  event.preventDefault(); const url = new URL(event.target.action); url.search = new URLSearchParams(new FormData(event.target)); navigate(url.href);
 });
 window.addEventListener('popstate', () => navigate(location.href, false));
 window.addEventListener('offline', () => show('You’re offline. The last loaded page is still available.', true));
 window.addEventListener('online', () => {if(pending) show('You’re back online. Try loading that page again.', true);else clear();});
})();
