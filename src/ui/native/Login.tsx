import { useEffect, useState } from 'react';
import { nativeRequest } from './transport';
import { loginDestination } from './dashboard-path';
import AuthFrame from './AuthFrame';
import '../dashboard/styles/dashboard.scss';
export default function Login() {
 const [ready,setReady]=useState(false); useEffect(()=>setReady(true),[]);
    const [error,setError]=useState(''),[busy,setBusy]=useState(false);
    useEffect(() => {
      if (!import.meta.env.DEV || !import.meta.env.H2H_LOCAL_OWNER_LOGIN) return;
      let active = true;
      setBusy(true);
      nativeRequest('/api/identity/local-owner-session', {method: 'POST'}).then(() => {
        if (active) location.assign(loginDestination(new URLSearchParams(location.search).get('returnTo'), location.origin));
      }).catch((error: Error) => { if (active) { setError(error.message); setBusy(false); } });
      return () => { active = false; };
    }, []);
    const submit=async(event:any)=>{event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);try{const result:any=await nativeRequest('/api/identity/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.get('email'),password:form.get('password')})});location.assign(loginDestination(new URLSearchParams(location.search).get('returnTo'), location.origin, result.accountOnly));}catch(error:any){setError(error.message);setBusy(false);}};
    return <AuthFrame><h1 className="display-4 text-center mb-4">Login</h1>{error&&<p className="alert alert-danger" role="alert">{error}</p>}<form method="post" onSubmit={submit}><div className="form-group"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required className="form-control"/></div><div className="form-group"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="form-control"/></div><button disabled={busy||!ready} className="btn btn-lg w-100 btn-primary mb-3 mt-3">{busy?'Signing in…':'Login'}</button></form><div className="auth-secondary-link text-muted text-center"><small>Forgot Your Password? <a href="/forgot-password">Reset it</a>.</small></div><div className="auth-secondary-link text-muted text-center"><small>Don't have an account yet? <a href="/register">Sign up</a>.</small></div></AuthFrame>;
}
