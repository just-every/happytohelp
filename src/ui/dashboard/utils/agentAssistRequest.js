const canSendAgentAssistRequest = ({ expired, expectedKeyState, currentKeyState, socketOpen }) => (
    !expired && expectedKeyState === currentKeyState && socketOpen
);

export { canSendAgentAssistRequest };
