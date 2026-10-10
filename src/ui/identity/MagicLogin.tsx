import { useEffect, useState, type FormEvent } from 'react';
import IdentityFrame from './IdentityFrame';
import { Alert, Field, SubmitButton } from './fields';
import { postJson, useHydrated } from './hooks';

export default function MagicLogin() {
 const ready = useHydrated();
 const [returnTo,setReturnTo]=useState('');
 const [token, setToken] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState('');
 useEffect(() => {
  const capture = () => {
   const found = new URLSearchParams(location.hash.slice(1)).get('token') || '';
   if (!found) return;
   setToken(found);setSent('');setError('');
   setReturnTo(new URLSearchParams(location.search).get('returnTo')||'');
   // Remove the capability after capture, without consuming it or creating history.
   history.replaceState(null, '', '/login/magic'+location.search);
  };
  setReturnTo(new URLSearchParams(location.search).get('returnTo')||'');capture();
  window.addEventListener('hashchange',capture);
  return () => window.removeEventListener('hashchange',capture);
 }, []);

 const submit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault(); setBusy(true); setError('');
  try {
   if (token) {
    const result=await postJson('/api/identity/magic-link/consume', { token,returnTo });
    location.assign(result.destination);
   } else {
    const result = await postJson('/api/identity/magic-link', { email: new FormData(event.currentTarget).get('email'),returnTo });
    setSent(result.message); setBusy(false);
   }
  } catch (failure: any) { setError(failure.message); setBusy(false); }
 };
 return <IdentityFrame>
  <h1>{token ? 'Sign in to your workspace' : 'Email me a sign-in link'}</h1>
  <p className="id-lede">{token ? 'Press Sign in to use your one-time link. Links expire after 15 minutes.' : 'Enter the email address you use for your workspace.'}</p>
  <Alert>{error}</Alert>
  {sent && <p role="status" className="id-note">{sent}</p>}
  <form method="post" onSubmit={submit}>
   {!token && <Field id="email" label="Email" type="email" autoComplete="email" />}
   <SubmitButton busy={busy} ready={ready} busyLabel={token ? 'Signing in…' : 'Requesting link…'}>{token ? 'Sign in' : 'Email me a sign-in link'}</SubmitButton>
  </form>
  <div className="id-links"><a href="/login">Use your password</a>{token && <a href="/login/magic">Request a new link</a>}</div>
 </IdentityFrame>;
}
