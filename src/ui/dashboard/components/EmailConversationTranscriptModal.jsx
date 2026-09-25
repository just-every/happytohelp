import React, { useState } from 'react';
import { Button, Form, Modal } from "react-bootstrap";
import { useForm } from "react-hook-form";
import Api from "../api";

function EmailConversationTranscriptModal({ onHide, conversation }) {
    const [ errors, setErrors ] = useState({});
    const [ isValidated, setIsValidated ] = useState(null);
    const [ isLoading, setIsLoading ] = useState(false);
    const [ email, setEmail ] = useState(conversation.contact.email);
    const { register, handleSubmit } = useForm();

    const fields = [
        {
            name: 'send_transcript_to',
            label: 'Email',
            type: 'email',
            value: email,
        },
    ];

    const handleEmailTranscript = values => {
        setIsLoading(true);
        setIsValidated(null);
        setErrors({});
        Api.update(`/projects/${ conversation.project_id }/conversations/${ conversation.id }`, values)
            .then(data => {
                setIsLoading(false);
                onHide();
            })
            .catch(error => {
                setIsLoading(false);
                setIsValidated(false);
                setErrors(error.errors);
            });
    }

    return (
        <Modal show onHide={ onHide }>
            <Modal.Header closeButton>
                <Modal.Title>Email Conversation Transcript</Modal.Title>
            </Modal.Header>
            <Form onSubmit={ handleSubmit(handleEmailTranscript) } onChange={ () => { setIsValidated(null); setErrors({})} } noValidate validated={ isValidated }>
                <Modal.Body>
                    { fields.map((field, i) => (
                        <Form.Group className="form-group" controlId={ `form-participant-${ field.name }` } key={ i }>
                            <Form.Label>{ field.label }</Form.Label>
                            <Form.Control
                                disabled={ isLoading }
                                type={ field.type ? field.type : 'text' }
                                { ...register(field.name) }
                                value={ field.value }
                                onChange={ e => setEmail(e.target.value) }
                                isInvalid={ field.name in errors } />
                            { errors[field.name] && errors[field.name].map((error, i) => <Form.Control.Feedback key={ i } type="invalid">{ error }</Form.Control.Feedback>) }
                        </Form.Group>
                    )) }
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" disabled={ isLoading } onClick={ onHide }>Close</Button>
                    <Button variant="primary" disabled={ isLoading } onClick={ handleSubmit(handleEmailTranscript) }>Send</Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}

export default EmailConversationTranscriptModal;
