import { shownWebsite, type SetupDraft } from './draft';

type Props = { draft: SetupDraft; update: (key: keyof SetupDraft, value: string) => void; tokenRequired: boolean };
type Field = { key: 'email' | 'password' | 'setupToken' | 'website'; label: string; type: string; autoComplete: string; hint?: string };

const fields: Field[] = [
    { key: 'email', label: 'Your email', type: 'email', autoComplete: 'username' },
    { key: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 12 characters. This protects your owner account.' },
    { key: 'setupToken', label: 'Setup token', type: 'password', autoComplete: 'off', hint: 'Provided privately with your installation.' },
    { key: 'website', label: 'Your website', type: 'url', autoComplete: 'url', hint: 'Where your chat widget will live.' },
];

/** The whole form: email, password, the setup token only when the server needs one, and the website. */
export default function SetupFields({ draft, update, tokenRequired }: Props) {
    return <div className="setup-fields">{fields.filter(field => field.key !== 'setupToken' || tokenRequired || draft.setupToken).map(({ key, label, type, autoComplete, hint }) => {
        const value = key === 'website' ? shownWebsite(draft) : draft[key];
        return <label className="setup-field" key={key}><span>{label}</span>
            <input aria-label={label} aria-describedby={hint ? `setup-${key}-hint` : undefined} name={key === 'website' ? 'allowedOrigin' : key} type={type} inputMode={key === 'website' ? 'url' : undefined} required value={value} onChange={event => update(key, event.target.value)} minLength={key === 'password' ? 12 : undefined} maxLength={key === 'password' || key === 'setupToken' ? 1024 : key === 'website' ? 2048 : 320} autoComplete={autoComplete} />
            {hint && <small id={`setup-${key}-hint`}>{hint}</small>}</label>;
    })}</div>;
}
