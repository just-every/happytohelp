import React from 'react';
import ReactDOM from "react-dom";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faTimes as falTimes} from "@fortawesome/free-solid-svg-icons";

const ModalPreview = ({ previewFile, hide, }) => previewFile ? ReactDOM.createPortal(
    <React.Fragment>
        <div id="happytohelp-modal-preview" onClick={hide}>
            <FontAwesomeIcon className="happytohelp-modal-preview-close" icon={falTimes} />
            {previewFile.isImage ?
                <img src={previewFile.url} alt={previewFile.path} /> :
                <iframe src={previewFile.url} title={previewFile.path} />
            }

        </div>
    </React.Fragment>, document.body
) : null;

export default ModalPreview;
