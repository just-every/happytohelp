import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from "react-bootstrap";

function FormMedia({ media, onRemove }) {
    const [showModal, setShowModal] = useState(false);

    const handleCloseModal = () => setShowModal(false);

    const handleRemove = event => {
        event.preventDefault();
        onRemove(media);

        return false;
    }

    const handleShowModal = (e) => {
        e.preventDefault();
        setShowModal(true);

        return false;
    }

    return media.aggregate_type === 'image'
        ? <>
            <div className="theme-file-preview position-relative me-3 dz-processing dz-image-preview dz-error dz-complete">
                <a className="avatar avatar-lg dropzone-image-preview bg-body-secondary rounded"
                   href="#"
                   onClick={ handleShowModal }>
                    <img
                        src={ media.preview_url ?? media.url }
                        alt={ media.filename_original }
                        className="avatar-img rounded file-title" />
                </a>
                <a className="badge badge-circle text-bg-secondary position-absolute badge-top-right" href="#" onClick={ handleRemove }>
                    <i className="fe fe-x"></i>
                </a>
            </div>
            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <h4 className="mb-0">{ media.filename_original }</h4>
                </Modal.Header>
                <Modal.Body><img src={ media.url } alt={ media.filename_original } className="img-fluid" /></Modal.Body>
            </Modal>
        </>
        : <div className="theme-file-preview position-relative me-3 dz-processing dz-image-preview dz-error dz-complete">
            <a href={ media.url } target="_blank" rel="noreferrer" className="avatar avatar-lg dropzone-image-preview">
                <span className="avatar-text rounded bg-secondary file-title" title={ media.filename_original }><i className="fe fe-file"></i></span>
            </a>
            <a className="badge badge-circle text-bg-secondary position-absolute badge-top-right" href="#" onClick={ handleRemove }>
                <i className="fe fe-x"></i>
            </a>
        </div>;
}

FormMedia.propTypes = {
    media: PropTypes.object,
    onRemove: PropTypes.func,
};

export default FormMedia;
