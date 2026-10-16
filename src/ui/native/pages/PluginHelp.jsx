import React from 'react';
import CopyCommand from '../setup-help/CopyCommand';
import '../setup-help/setup-help.css';

const guide = '/docs/plugins';

/** A complete plugin page: shows who the open conversation is with and puts a reply into the reply box. */
export const pluginExample = origin => `<!doctype html>
<meta charset="utf-8">
<title>Order lookup</title>
<p id="who">Waiting for a conversation…</p>
<button id="reply">Suggest a reply</button>
<script>
const HAPPYTOHELP = '${origin}';
const send = (type, payload) => parent.postMessage({happytohelp: true, type, payload}, HAPPYTOHELP);
addEventListener('message', event => {
  if (event.origin !== HAPPYTOHELP || event.data?.happytohelp !== true) return;
  if (event.data.type === 'setConversation') {
    const contact = event.data.payload?.contact;
    document.getElementById('who').textContent = contact ? 'Talking with ' + (contact.name || contact.email || 'a visitor') : 'No conversation open';
  }
});
document.getElementById('reply').onclick = () => send('setMessageContent', 'Thanks for waiting! Your order is on its way.');
send('setHeight', 120);
send('getConversation');
</script>`;

/** What a plugin is, what address to give, and what happens once it is added. */
export default function PluginHelp({ adding = false }) {
    const origin = typeof window === 'undefined' ? 'https://support.example.com' : window.location.origin;
    return <div className="sh-steps mb-4 plugin-help">
        <p><b>What a plugin is</b></p>
        <p>A plugin is a small web page of your own that HappyToHelp shows in the side panel of every conversation, under the customer’s details. Use one to show what your other systems know about the customer (orders, plan, account status) next to the chat, or to give your team buttons that write a reply for them.</p>
        <ol>
            <li>{adding ? 'Give' : 'Choose Add Custom Plugin and give'} it a <b>Name</b> (the panel’s heading, for example <code>Order lookup</code>) and the <b>URL</b> of your page, for example <code>https://tools.example.com/happytohelp-plugin.html</code>. Use <code>https://</code>; plain <code>http://</code> works only for a page on this computer (<code>localhost</code>).</li>
            <li>Open any conversation: your page loads there in a frame. Your page’s server must allow being shown in a frame on this address (no <code>X-Frame-Options: DENY</code>).</li>
            <li>Your page and HappyToHelp talk with browser messages. Your page can ask for the open conversation (<code>getConversation</code>), put text in the reply box (<code>setMessageContent</code>), close the open conversation (<code>resolveConversation</code>) and set its own height (<code>setHeight</code>). Nothing is sent to the customer until an agent presses Send.</li>
        </ol>
        <p>A complete example to start from. Save it as an <code>.html</code> file on any web host and add its address here:</p>
        <CopyCommand text={pluginExample(origin)}/>
        <p className="sh-note">Every message, with what each one carries: <a href={guide}>Plugins guide</a>.</p>
    </div>;
}
