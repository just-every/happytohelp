import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
import {githubApiRequest,type GithubCredential} from './github'

type GithubRepository={id:number;full_name:string;private:boolean;default_branch:string}

const repositoryName=/^[-\w.]+\/[-\w.]+$/

const metadata=(row:any):GithubRepository=>({id:Number(row.id),full_name:String(row.full_name),private:Boolean(row.private),default_branch:String(row.default_branch||'')})

async function readGithubJson(path:string,token:string){
 const response=await githubApiRequest(path,token)
 if(!response.ok)throw new HTTPException(response.status===404?404:502,{message:`GitHub HTTP ${response.status}`})
 return response.json() as Promise<any>
}

async function configuredRepositories(env:Env,projectId:string,token:string){
 const row=await env.DB.prepare('SELECT repositories_json FROM github_settings WHERE project_id=?').bind(projectId).first<{repositories_json:string}>()
 const repositories:unknown[]=row?JSON.parse(row.repositories_json):[]
 if(!Array.isArray(repositories)||repositories.some(repository=>typeof repository!=='string'||!repositoryName.test(repository)))throw new HTTPException(500,{message:'Stored GitHub repository selection is invalid'})
 const names=repositories as string[]
 return Promise.all(names.map(async repository=>metadata(await readGithubJson(`repos/${repository.split('/').map(encodeURIComponent).join('/')}`,token))))
}

export async function listGithubRepositories(env:Env,projectId:string,credential:GithubCredential){
 if(credential.mode==='oauth'){
  const rows=await readGithubJson('user/repos?per_page=100&sort=updated',credential.token)
  return (Array.isArray(rows)?rows:[]).map(metadata)
 }
 // Mapped and single project tokens are documented inputs, but may be App
 // installation tokens rather than user OAuth tokens. They cannot use
 // /user/repos reliably, so discovery is the exact project allowlist already
 // stored by the owner and validates each entry with a repository read.
 return configuredRepositories(env,projectId,credential.token)
}
