import React, {useState, useContext, useRef, useEffect, useLayoutEffect} from 'react';

import AppContext from './context/AppContext';
import {FileHandler, FileHandlerList, FileHandlerButton} from './FileHandler';
import takeScreenshot, {canTakeScreenshot} from './includes/takeScreenshot';
import TextareaAutosize from './includes/TextareaAutosize';
import CollectCustomer from './CollectCustomer';

import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faArrowRight as fasArrowAltRight} from "@fortawesome/free-solid-svg-icons";
import {faPaperclip as falPaperclip, faExpand as falExpand, faEnvelope as faUser} from "@fortawesome/free-solid-svg-icons";

import { Tooltip } from 'react-tooltip'
import {formatRelative, parseISO} from "date-fns";
import {ConnectContext} from "./context/ConnectContext";
import {updateViewportProperties} from "./includes/utils";

export default function SendMessage({ mainView, setView, messages, localContact, contact, sendContact, onSend, displayError }) {
    const context = useContext(AppContext);
    const isPreview = context.preview?.enabled === true;
    const { open, getCurrentAgent } = useContext(ConnectContext);
    const currentAgent = getCurrentAgent();
    const needsNotifyEmail = ( !currentAgent?.is_ai && messages.length && !contact.email);

    const [message, setMessage] = useState("");
    const [files, setFiles] = useState([]);
    const [wasContactLoading, setWasContactLoading] = useState(contact.loading_name || contact.loading_email);
    const [showCollector, setShowCollector] = useState(needsNotifyEmail || (context.settings.collect.require_name && !contact.name) || (context.settings.collect.require_email && !contact.email));
    const textareaRef = useRef(null);

    const handleSend = event => {
        event.preventDefault();
        var error_messages = [];
        if(context.settings.collect.require_name && !contact.name) {
            error_messages.push(context.text.message.error_name);
        }
        if(context.settings.collect.require_email && !contact.email) {
            error_messages.push(context.text.message.error_email);
        }
        if(!message && !files.length) {
            error_messages.push(context.text.message.error_message);
        }
        if(error_messages.length) {
            displayError(error_messages, {clear: true});
            return;
        }
        onSend(message, files); // Don't wait for response? Improves UI if we clear inputs straight away.
        setMessage('');
        setFiles([]);

        if(textareaRef.current) {
            // Ensure focus is retained
            textareaRef.current.focus();
        }
    }

    useEffect(() => {
        const isContactLoading = contact.loading_name || contact.loading_email;
        if(wasContactLoading !== isContactLoading) {
            if(wasContactLoading) {
                setShowCollector(false);
            }
            setWasContactLoading(isContactLoading);
        }
    }, [ contact, wasContactLoading ]);

    useEffect(() => {
        const isContactLoading = contact.loading_name || contact.loading_email;
        if(!isContactLoading) {
            setShowCollector(needsNotifyEmail || (context.settings.collect.require_name && !contact.name) || (context.settings.collect.require_email && !contact.email));
        }
    }, [ needsNotifyEmail, contact ]); // eslint-disable-line react-hooks/exhaustive-deps

    useLayoutEffect(() => {
        if (isPreview) {
            return undefined;
        }

        // Define the focus and blur event handlers
        const handleFocusChange = () => {
            if(window.matchMedia("(max-width: 768px)").matches) {
                document.body.style.zoom = 1;

                let checkTimes = 0;
                let timer = window.setInterval(() => {
                    updateViewportProperties();
                    window.scrollTo({ top:0, left: 0, behavior: 'instant' });
                    if((++checkTimes) > 5) {
                        window.clearInterval(timer);
                    }
                }, 200);
            }
        };

        const textarea = textareaRef.current;

        // Attach the event listeners if the ref is available
        if (textarea) {
            textarea.addEventListener('focus', handleFocusChange);
            textarea.addEventListener('blur', handleFocusChange);
        }

        // Focus on the textarea once the component is loaded
        // Only run this on large screens as it can be annoying on mobile
        if (open && textarea && !window.matchMedia("(max-width: 768px)").matches) {
            textarea.focus();
        }

        // Cleanup function to remove event listeners
        return () => {
            if (textarea) {
                textarea.removeEventListener('focus', handleFocusChange);
                textarea.removeEventListener('blur', handleFocusChange);
            }
        };
    }, [ isPreview, open, textareaRef ]);

    const focusText = event => {
        event.preventDefault();
        if(textareaRef) {
            textareaRef.current.focus();
        }
    }

    let content = null;
    if( messages.length && mainView !== 'conversation' ) {
        let lastMessageDate = messages[messages.length - 1].created_at ? parseISO(messages[messages.length - 1].created_at) : false;
        content = (
            <button type="button" className="happytohelp-return-to-chat" onClick={setView} aria-label={context.text.chat.return_title}>
                <FontAwesomeIcon icon={fasArrowAltRight} />
                <span className="happytohelp-return-to-chat-title">
                    {context.text.chat.return_title}
                </span>
                <span className="happytohelp-return-to-chat-content">
                    { lastMessageDate ?
                        context.text.chat.return_last_message+" "+formatRelative(lastMessageDate, new Date())
                        : context.text.chat.return_active
                    }
                </span>
            </button>
        );
    }
    else {
        content = (
            <FileHandler className={"happytohelp-message-input"} setFiles={setFiles} files={files}>
                { showCollector && <CollectCustomer needsNotifyEmail={ needsNotifyEmail } setShowCollector={ setShowCollector } localContact={ localContact } contact={ contact } sendContact={ sendContact } /> }
                <FileHandlerList files={files} setFiles={setFiles} />
                <div className="happytohelp-send-message-row">
                <TextareaAutosize forwardRef={textareaRef} name="content" value={message} onChange={e => setMessage(e.target.value)} onEnter={handleSend} aria-label={(mainView === 'conversation' ? context.text.message.placeholder_message_chat : context.text.message.placeholder_message)} placeholder={(mainView === 'conversation' ? context.text.message.placeholder_message_chat : context.text.message.placeholder_message)} style={ context.theme.input.message } />
                </div>
                <div className={"happytohelp-send-message-row happytohelp-send-message-row-buttons"+((contact.email || contact.name) ? " happytohelp-send-message-row-larger" : "")} onClick={event => { if (!event.target.closest('button')) focusText(event); }}>
                    { !showCollector && (contact.email || contact.name) && <div className="happytohelp-message-show-contact-container">
                        <button type="button" data-tooltip-id="h2h-tooltip-send"
                             data-tooltip-content={context.text.message.tooltip_contact}
                             className="happytohelp-message-show-contact"
                            aria-label={context.text.message.tooltip_contact}
                            onClick={() => setShowCollector(true)}>
                            <FontAwesomeIcon icon={faUser}/>
                            <span>{contact.email || contact.name}</span>
                        </button>
                    </div>}
                    {
                        context.settings.message.collect_screenshot && canTakeScreenshot ?
                            <button data-tooltip-id="h2h-tooltip-send"
                                    data-tooltip-content={isPreview ? 'Screenshots are disabled in preview' : context.text.message.tooltip_screenshot} name="screenshot"
                                    className="happytohelp-btn" disabled={isPreview}
                                    aria-label={isPreview ? 'Screenshots are disabled in preview' : context.text.message.tooltip_screenshot}
                                    title={isPreview ? 'Screenshots are disabled in preview' : undefined}
                                    onClick={isPreview ? undefined : () => takeScreenshot(files, setFiles)} style={ context.theme.input.button }>
                                <FontAwesomeIcon icon={falExpand}/></button>
                            : null
                    }
                    {
                        context.settings.message.collect_attachments ?
                            isPreview ?
                                <button data-tooltip-id="h2h-tooltip-send"
                                        data-tooltip-content="Attachments are disabled in preview" name="attach"
                                        className="happytohelp-btn" disabled aria-label="Attachments are disabled in preview"
                                        title="Attachments are disabled in preview" style={ context.theme.input.button }>
                                    <FontAwesomeIcon icon={falPaperclip}/></button>
                                : <FileHandlerButton>
                                <button data-tooltip-id="h2h-tooltip-send"
                                        data-tooltip-content={context.text.message.tooltip_attach} name="attach"
                                        aria-label={context.text.message.tooltip_attach}
                                        className="happytohelp-btn"><FontAwesomeIcon icon={falPaperclip} style={ context.theme.input.button }/></button>
                            </FileHandlerButton>
                            : null
                    }
                    <button type="submit" name="submit" className="happytohelp-btn"
                            onClick={handleSend}
                            aria-label={context.text.message.tooltip_send}
                            data-tooltip-id="h2h-tooltip-send" data-tooltip-content={context.text.message.tooltip_send}  style={ context.theme.input.send }>
                        <FontAwesomeIcon icon={fasArrowAltRight}/></button>
                </div>
                <Tooltip id="h2h-tooltip-send" effect="solid" place="top" delayShow={100} delayHide={100}
                         offset={{top: 0, right: 0, bottom: 0, left: 5}} className="happytohelp-tooltip"/>
            </FileHandler>
        );
    }

    return (
        <div className={"happytohelp-send-message" +(mainView === 'conversation' ? " happytohelp-send-message-conversation" : "")} style={ context.theme.input.message }>
            { content }
        </div>
    );
};
