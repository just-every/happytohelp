import { useEffect, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { nativeRequest } from './transport';
import '../dashboard/styles/theme.scss';
export default function IdentityPage() {
 const [ready,setReady]=useState(false); useEffect(()=>setReady(true),[]);
 const path=useLocation().pathname;
 const kind=path.slice(1);
 const [newAccount,setNewAccount]=useState(false);
 const [error,setError]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
 const definitions:Record<string,{title:string,fields:string[],action:string}>={
  register:{title:'Create your account',fields:['name','email','password','projectName','allowedOrigin'],action:'register'},
  'forgot-password':{title:'Reset your password',fields:['email'],action:'forgot-password'},
  'reset-password':{title:'Choose a new password',fields:['password'],action:'accept-token'},
  'verify-email':{title:'Verify your email',fields:[],action:'verify-email'},
  'accept-invitation':{title:'Accept invitation',fields:[],action:'accept-invitation'},
 };
 const config=kind==='accept-invitation'&&newAccount?{title:'Accept invitation',fields:['name','password'],action:'accept-token'}:definitions[kind];
 const submit=async(event:any)=>{event.preventDefault();setBusy(true);setError('');const data=Object.fromEntries(new FormData(event.currentTarget));try{await nativeRequest(`/api/identity/${config.action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,token:new URLSearchParams(location.search).get('token')})});setDone(true);}catch(error:any){setError(error.message);}finally{setBusy(false);}};
 return <main className="container py-5"><div className="row justify-content-center"><div className="col-md-5"><h1>{config.title}</h1>{error&&<p className="alert alert-danger" role="alert">{error}</p>}{done?<div role="status"><p>{kind==='register'?'Check your email to verify your account.':kind==='forgot-password'?'If the account exists, a password reset link has been sent.':'Your request completed.'}</p><a href="/login">Sign in</a></div>:<form method="post" onSubmit={submit}>{kind==='accept-invitation'&&<label className="form-check mb-3"><input className="form-check-input" type="checkbox" checked={newAccount} onChange={e=>setNewAccount(e.target.checked)}/>Create a new account</label>}{config.fields.map(name=><div className="form-group" key={name}><label htmlFor={name}>{({name:'Your name',email:'Email address',password:'Password',projectName:'Workspace name',allowedOrigin:'Widget website origin'} as any)[name]}</label><input className="form-control" id={name} name={name} type={name==='password'?'password':name==='email'?'email':name==='allowedOrigin'?'url':'text'} required/></div>)}<button className="btn btn-primary" disabled={busy||!ready}>{busy?'Submitting…':'Continue'}</button></form>}</div></div></main>;
}
