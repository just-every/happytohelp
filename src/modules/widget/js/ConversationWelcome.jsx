import React, {useContext} from 'react';
import AppContext from './context/AppContext';
import {ConnectContext} from './context/ConnectContext';

export default function ConversationWelcome({empty}) {
 const {brand} = useContext(AppContext);
 const {connectionState, retryConnection} = useContext(ConnectContext);
 return <>
  {empty && <div className="happytohelp-welcome">
   {brand?.avatar_url && <img src={brand.avatar_url} alt={`${brand.name} support`} />}
   <p>{brand?.greeting || 'Hi! How can we help you today?'}</p>
  </div>}
  {connectionState && connectionState !== 'connected' && <div className="happytohelp-connection-state" role="status">
   <span>{connectionState === 'connecting' ? 'Connecting to support…' : connectionState === 'offline' ? 'You’re offline. Your conversation is saved. Reconnect to continue.' : 'Connection interrupted. Your conversation is saved.'}</span>
   {connectionState !== 'connecting' && <button type="button" onClick={() => retryConnection().catch(() => {})}>Reconnect</button>}
  </div>}
 </>;
}
