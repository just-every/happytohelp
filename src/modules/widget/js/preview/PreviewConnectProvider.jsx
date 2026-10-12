import React, {useContext, useState} from 'react';
import AppContext from '../context/AppContext';
import {ConnectContext} from '../context/ConnectContext';
import {emptyTypingState} from '../context/typingState';

/** Settings editor presentation only: no invented transcript or application responses. */
export default function PreviewConnectProvider({children, open}) {
  const context = useContext(AppContext);
  const [mainView, setMainView] = useState('conversation');
  const [contact, setContact] = useState(context.contact || {});
  const [conversationSettings, setConversationSettings] = useState({ais: [], human: null, ...context.conversationSettings});
  const previewAgent = context.preview?.agent;
  const previewSettings = {...conversationSettings, mailMode: context.preview?.mailMode, workspace_brand: context.preview?.workspace_brand || conversationSettings.workspace_brand};
  const unavailable = () => Promise.reject(new Error('Sending is unavailable in the settings preview'));
  return <ConnectContext.Provider value={{open, messages: [], agentTyping: emptyTypingState(), thinking: false, insight: null, connectErrors: [], contact, setContact, localContact: contact, setLocalContact: setContact, contactAuth: {}, conversationSettings: previewSettings, setConversationSettings, getCurrentAgent: () => previewAgent || conversationSettings.human, mainView, setMainView, sendMessage: unavailable, assertConnected: unavailable, uploadMedia: unavailable, sendInsight: unavailable, setFilteredMessages: () => {}}}>{children}</ConnectContext.Provider>;
}
