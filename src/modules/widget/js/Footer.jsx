import React, {useContext} from 'react';
import circleSide from '../img/icon-circle-side.svg';
import smile from '../img/icon-smile.svg';

import AppContext from "./context/AppContext";

export default function Footer(props) {
    const context = useContext(AppContext);
    if(!context.app_logo.show) return null;

    return (
        <div className="happytohelp-footer">
            <div className="happytohelp-logo" onClick={() => window.open(context.app_logo.url) }>
                { true && <div className="happytohelp-logo-icon">
                    <img src={circleSide} alt="" className="happytohelp-logo-circle-top" />
                    <img src={circleSide} alt="" className="happytohelp-logo-circle-bottom" />
                    <img src={smile} alt="" className="happytohelp-logo-smile" />
                </div> }
                <span className="happytohelp-logo-pre">
                    We use
                </span>
                <span className="happytohelp-logo-text"><strong>Happy</strong> to <strong>Help</strong></span>
                <span className="happytohelp-logo-post">
                    !
                </span>
            </div>
        </div>
    );
}
