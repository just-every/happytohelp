import React from 'react';
import CopyCommand from '../setup-help/CopyCommand';
import {helpScoutScript,intercomContactsScript,zendeskScript} from './move-in-guides';

const tools = <>Run it in Terminal on a Mac or Linux computer with <code>curl</code> and <code>jq</code> installed (on a Mac: <code>brew install jq</code>). It asks for the secret without showing or saving it.</>;

/** How to produce the file Move in accepts, step by step, from each vendor's own export or API. */
export const vendorGuides = {
 zendesk: {label: 'Zendesk', accept: '.json,.jsonl,.ndjson,.zip', guide: <>
  <ol>
   <li>In Zendesk Admin Center, open <b>Apps and integrations</b>, <b>APIs</b>, <b>API tokens</b>, and add a token. Copy it.</li>
   <li>Copy this script, change the first two lines to your Zendesk address and admin email, and run it. {tools}<CopyCommand text={zendeskScript}/></li>
   <li>It writes <code>zendesk-move-in-1.ndjson</code>, <code>-2</code> and so on: 50 tickets each, with every comment and the people in them. Upload them one at a time below.</li>
  </ol>
  <p className="sh-note">Saved replies (macros) and Help Center articles are optional extras; see <a href="/docs/moving-in#zendesk">Zendesk in the Move in guide</a>. To copy only your help articles, use Knowledge, Import instead.</p>
 </>},
 intercom: {label: 'Intercom', accept: '.json,.jsonl,.zip', guide: <>
  <ol>
   <li>In Intercom, set up the <a href="https://www.intercom.com/help/en/articles/7029721-export-conversations-data-to-amazon-s3" target="_blank" rel="noreferrer">conversation export to Amazon S3</a> and choose API version <b>2.16</b>. When it has run, download the exported files into a folder named <code>intercom-export</code>.</li>
   <li>The export holds conversations but not the people in them. In Intercom’s Developer Hub, open your app’s <b>Authentication</b> page and copy the <b>Access token</b>.</li>
   <li>In the folder that holds <code>intercom-export</code>, run this script. {tools} It fetches each contact and packs everything into <code>intercom-move-in.zip</code>:<CopyCommand text={intercomContactsScript}/></li>
   <li>Upload <code>intercom-move-in.zip</code> below. Over 2 MiB? Split the exported files across several folders and run the script once for each.</li>
  </ol>
  <p className="sh-note">Saved replies and articles: see <a href="/docs/moving-in#intercom">Intercom in the Move in guide</a>.</p>
 </>},
 helpscout: {label: 'Help Scout', accept: '.json,.jsonl,.zip', guide: <>
  <ol>
   <li>In Help Scout, open <b>Your Profile</b>, <b>My Apps</b>, <b>Create My App</b> (any redirect URL works), and copy its App ID and App Secret.</li>
   <li>Open the mailbox you are moving and note the number in its web address.</li>
   <li>Copy this script, set the first two lines, and run it. {tools}<CopyCommand text={helpScoutScript}/></li>
   <li>It writes <code>helpscout-move-in-1.jsonl</code>, <code>-2</code> and so on: 25 conversations each, with every thread page and customer. Upload them one at a time below.</li>
  </ol>
  <p className="sh-note">Docs articles: see <a href="/docs/moving-in#help-scout-inbox-v2-and-docs-v1">Help Scout in the Move in guide</a>.</p>
 </>},
 freshdesk: {label: 'Freshdesk', guide: <>
  <p>Freshdesk conversation history can’t be moved in yet: there is no reader for its tickets. Your Freshdesk help articles can come across now with <b>Knowledge</b>, <b>Import</b>, <b>Freshdesk</b>.</p>
 </>},
 happytohelp: {label: 'HappyToHelp (the original service)', guide: <>
  <p>History from the original HappyToHelp service moves in with a command run on your computer, not an upload here. Follow <a href="/docs/operations#import-data-from-the-original-happytohelp-service">Import data from the original HappyToHelp service</a>.</p>
 </>},
};
