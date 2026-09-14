import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from "react-bootstrap";

import prettyBytes from 'pretty-bytes';

function Media({ media }) {
    const [showModal, setShowModal] = useState(false);

    const handleCloseModal = () => setShowModal(false);
    const handleShowModal = (e) => {
        e.preventDefault();
        setShowModal(true);

        return false;
    }

    return media.aggregate_type === 'image'
        ? <>
            <a href={ media.url } onClick={ handleShowModal }><img src={ media.preview_url ?? media.url } alt={ media.filename_original } /></a>
            <Modal show={showModal} onHide={handleCloseModal} dialogClassName="modal-fullscreen">
                <Modal.Header closeButton>
                    <h4 className="mb-0">{ media.filename_original }</h4>
                </Modal.Header>
                <Modal.Body><img src={ media.url } alt={ media.filename_original } className="img-fluid" /></Modal.Body>
            </Modal>
        </>
        : <div className="media mb-1">
            <a href={ media.url } className="icon-shape me-3" target="_blank" rel="noreferrer">
                <i className="fe-paperclip"></i>
            </a>
            <div className="media-body overflow-hidden flex-fill">
                <a href={ media.url } className="d-block text-truncate font-medium text-reset" target="_blank" rel="noreferrer">{ media.filename_original }</a>
                <ul className="list-inline small mb-0">
                    <li className="list-inline-item">
                        <span className="t">{ prettyBytes(media.size) }</span>
                    </li>
                </ul>
            </div>
        </div>;
}

Media.propTypes = {
    media: PropTypes.object,
};

export default Media;
