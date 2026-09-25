export function submitInstructionsOnEnter(event, { busy, composing }) {
    if (event.key !== 'Enter' || event.shiftKey || composing || event.nativeEvent?.isComposing || event.nativeEvent?.keyCode === 229) return;

    event.preventDefault();
    if (!busy && !event.repeat) event.currentTarget.form?.requestSubmit();
}
