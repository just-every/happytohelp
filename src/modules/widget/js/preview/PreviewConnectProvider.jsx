import React, {useContext, useState} from 'react';
import AppContext from '../context/AppContext';
import {ConnectContext} from '../context/ConnectContext';
import {emptyTypingState} from '../context/typingState';

/** Settings editor presentation only: no invented transcript or application responses. The header shows the project's own first agent (`preview.agent`) so the theme can be judged against a real header. */
export default function PreviewConnectProvider({children, open}) {
  const context = useContext(AppContext);
  const [mainView, setMainView] = useState('conversation');
  const [contact, setContact] = useState(context.contact || {});
  const [conversationSettings, setConversationSettings] = useState({ais: [], human: context.preview?.agent ?? null, ...context.conversationSettings});
  const unavailable = () => Promise.reject(new Error('Sending is unavailable in the settings preview'));
  return <ConnectContext.Provider value={{open, messages: [], agentTyping: emptyTypingState(), thinking: false, insight: null, connectErrors: [], contact, setContact, localContact: contact, setLocalContact: setContact, contactAuth: {}, conversationSettings, setConversationSettings, getCurrentAgent: () => conversationSettings.human, mainView, setMainView, sendMessage: unavailable, assertConnected: unavailable, uploadMedia: unavailable, sendInsight: unavailable, setFilteredMessages: () => {}}}>{children}</ConnectContext.Provider>;
}
