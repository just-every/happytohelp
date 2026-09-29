import React, {useContext, useState} from 'react';

import AppContext from './context/AppContext';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faEnvelope as fasEnvelope} from "@fortawesome/free-solid-svg-icons";

import {ConnectContext} from "./context/ConnectContext";

export default function ChatPrompt({ contact, sendContact }) {
    const context = useContext(AppContext);
    const { insight } = useContext(ConnectContext);
    const [email, setEmail] = useState("");
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);

    const handleFocus = (event) => {
        event.target.select();
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        if(!/\S+@\S+\.\S+/.test(email)) { // basic email validation
            setShake(!shake);
            setError(context.text.prompt.validate_error);
        }
        else {
            setError(false);
            sendContact({provided_email: email});
        }
    }

    if(insight && insight.content) return null;

    return (
        <form key='collect-prompt' className='happytohelp-chat-agent happytohelp-chat-prompt' onSubmit={ handleSubmit }>
            <div className={'happytohelp-chat-box happytohelp-chat-box-prompt'+(error ? ' happytohelp-chat-box-prompt-error' : '')}>
                { error || context.text.prompt.email_prompt }
                <div className={"happytohelp-send-message-row happytohelp-has-icon"+(shake ? " happytohelp-shake" : "")}>
                    <div className="happytohelp-prompt"><div className="happytohelp-prompt-dash1" /><div className="happytohelp-prompt-dash2" /><div className="happytohelp-prompt-dash3" /><div className="happytohelp-prompt-dash4" /><FontAwesomeIcon icon={fasEnvelope} /></div>
                    <input type="email" name="email" aria-label={context.text.prompt.placeholder_email} defaultValue={ contact.email } autoComplete="email" onChange={e => setEmail(e.target.value)} onFocus={ handleFocus } onBlur={ handleSubmit } placeholder={ context.text.prompt.placeholder_email } />
                </div>
            </div>
        </form>
    );
};
