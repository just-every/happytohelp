import React from 'react';
import {messageCitations} from '../../modules/conversations/citations.js';
export default function MessageCitations({message}) {
 const citations=messageCitations(message);
 return citations.length ? <ul className="message-citations" aria-label="Sources">{citations.map(c => <li key={c.id}><a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a></li>)}</ul> : null;
}
