import React, { useContext, useState } from 'react';
import { Button, Form, Modal } from "react-bootstrap";
import { useForm } from "react-hook-form";
import Api from "../api";
import { ChatContext } from "../contexts/ChatContext";

function AddParticipantModal({ onHide, conversation }) {
    const {
        updateConversation,
    } = useContext(ChatContext);
    const [ errors, setErrors ] = useState({});
    const [ isValidated, setIsValidated ] = useState(null);
    const [ isLoading, setIsLoading ] = useState(false);
    const { register, handleSubmit } = useForm();

    const fields = [
        {
            name: 'email',
            label: 'Email',
            type: 'email',
        },
    ];

    const handleAddParticipant = values => {
        setIsLoading(true);
        setIsValidated(null);
        setErrors({});
        Api.create(`/projects/${ conversation.project_id }/conversations/${ conversation.id }/participants`, values)
            .then(data => {
                setIsLoading(false);
                updateConversation(conversation.id, {
                    participants: [ ...conversation.participants, Object.assign(data.data.contact, { pivot: { id: data.data.id } }) ]
                });
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
                <Modal.Title>Add Participant</Modal.Title>
            </Modal.Header>
            <Form onSubmit={ handleSubmit(handleAddParticipant) } onChange={ () => { setIsValidated(null); setErrors({})} } noValidate validated={ isValidated }>
                <Modal.Body>
                    { fields.map((field, i) => (
                        <Form.Group className="form-group" controlId={ `form-participant-${ field.name }` } key={ i }>
                            <Form.Label>{ field.label }</Form.Label>
                            <Form.Control
                                disabled={ isLoading }
                                type={ field.type ? field.type : 'text' }
                                { ...register(field.name) }
                                isInvalid={ field.name in errors } />
                            { errors[field.name] && errors[field.name].map((error, i) => <Form.Control.Feedback key={ i } type="invalid">{ error }</Form.Control.Feedback>) }
                        </Form.Group>
                    )) }
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" disabled={ isLoading } onClick={ onHide }>Close</Button>
                    <Button variant="primary" disabled={ isLoading } onClick={ handleSubmit(handleAddParticipant) }>Add</Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}

export default AddParticipantModal;
