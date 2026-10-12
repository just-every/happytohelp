import SetupReview from './SetupReview';
import { shownColour, type SetupDraft } from './draft';
type Props = { draft: SetupDraft; update: (key: keyof SetupDraft, value: string) => void; tokenRequired: boolean; step: number };
export default function SetupFields({ draft, update, tokenRequired, step }: Props) {
    const field = (key: keyof SetupDraft, label: string, type = 'text', hint?: string) => <label className="setup-field" key={key}><span>{label}</span><input aria-label={label} aria-describedby={hint ? `setup-${key}-hint` : undefined} name={key} type={type} required value={draft[key]} onChange={event => update(key, event.target.value)} minLength={key === 'password' ? 12 : undefined} maxLength={key === 'password' || key === 'setupToken' ? 1024 : key === 'name' || key === 'ownerName' ? 200 : 320} autoComplete={key === 'password' ? 'new-password' : key === 'email' ? 'username' : key === 'ownerName' ? 'name' : key === 'setupToken' ? 'off' : 'organization'} />{hint && <small id={`setup-${key}-hint`}>{hint}</small>}</label>;
    if (step === 0) return <div className="setup-fields">
        {field('ownerName', 'Your name')}{field('email', 'Owner email', 'email')}
        {field('password', 'Owner password', 'password', 'At least 12 characters. This protects your owner account.')}
        {(tokenRequired || draft.setupToken) && field('setupToken', 'Owner setup token', 'password', 'Provided privately with your installation.')}
    </div>;
    if (step === 1) return <div className="setup-fields">
        {field('name', 'Workspace name')}{field('allowedOrigin', 'Widget website origin', 'url', 'The website where your customer support widget will run.')}
        <label className="setup-field"><span>Brand colour</span><div className="setup-colour"><input type="color" aria-label="Choose brand colour" value={shownColour(draft.primaryColor)} onChange={event => update('primaryColor', event.target.value)} /><input aria-label="Brand colour" aria-describedby="setup-primaryColor-hint" name="primaryColor" pattern="#[0-9a-fA-F]{6}" required value={draft.primaryColor} onChange={event => update('primaryColor', event.target.value)} /></div><small id="setup-primaryColor-hint">Used by your workspace. You can change it later.</small></label>
    </div>;
    return <SetupReview draft={draft} />;
}
