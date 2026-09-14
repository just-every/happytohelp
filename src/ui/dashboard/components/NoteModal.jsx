import React, { useContext, useState } from 'react';
import { Button, Form, Modal } from "react-bootstrap";
import { useForm } from "react-hook-form";
import Api from "../api";
import { ChatContext } from "../contexts/ChatContext";

function NoteModal({ onHide, conversation }) {
    const { fetchBucket } = useContext(ChatContext);
    const [ requestError, setRequestError ] = useState('');
    const [ errors, setErrors ] = useState({});
    const [ isValidated, setIsValidated ] = useState(null);
    const [ isLoading, setIsLoading ] = useState(false);
    const { register, handleSubmit, getValues } = useForm({ });

    const handleAddNote = values => {
        setRequestError('');
        setIsLoading(true);
        setIsValidated(null);
        setErrors({});
        Api.create(`/projects/${ conversation.project_id }/conversations/${ conversation.id }/notes/`, values)
            .then(async data => {
                await fetchBucket(conversation.id, {id: data.data.bucket_id}, undefined, conversation.project_id);
                setIsLoading(false);
                onHide();
            })
            .catch(error => {
                setIsLoading(false);
                setIsValidated(false);
                setErrors(error.errors || {});
                setRequestError(error.message);
            });
    }

    return (
        <Modal show onHide={ onHide }>
            <Modal.Header closeButton>
                <Modal.Title>Add Note</Modal.Title>
            </Modal.Header>
            <Form onSubmit={ handleSubmit(handleAddNote) } onChange={ () => { setIsValidated(null); setErrors({})} } noValidate validated={ isValidated }>
                <Modal.Body>
                    {requestError && <p role="alert" className="alert alert-danger">{requestError}</p>}
                    <Form.Group className="form-group" controlId="form-note-content">
                        <Form.Label>Note</Form.Label>
                        <Form.Control
                            disabled={ isLoading }
                            as="textarea"
                            rows={3}
                            { ...register('content') }
                            isInvalid={ errors && !!errors['content'] } />
                        { errors && errors['content'] && errors['content'].map((error, i) => <Form.Control.Feedback key={ i } type="invalid">{ error }</Form.Control.Feedback>) }
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" disabled={ isLoading } onClick={ onHide }>Close</Button>
                    <Button variant="primary" disabled={ isLoading } onClick={ handleSubmit(handleAddNote) }>Add</Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}

export default NoteModal;
