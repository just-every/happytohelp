import React, {useContext} from 'react';
import {ConnectContext} from './context/ConnectContext';

export default function ConnectionNotice() {
 const {connectionState, retryConnection} = useContext(ConnectContext);
 if (!connectionState || connectionState === 'connected') return null;
 return <div className="happytohelp-connection-state" role="status">
  <span>{connectionState === 'connecting' ? 'Connecting to support…' : connectionState === 'offline' ? 'You’re offline. Your conversation is saved. Reconnect to continue.' : 'Connection interrupted. Your conversation is saved.'}</span>
  {connectionState !== 'connecting' && <button type="button" onClick={() => retryConnection().catch(() => {})}>Reconnect</button>}
 </div>;
}
