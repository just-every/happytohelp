import { requestJson } from './utils/requestJson';
function request(url, params, method = 'GET', requestOptions = {}) {
    url = url.replace(/\/(?=\?|$)/, '');
    const options = { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
    if (params) {
        if (method === 'GET') { const query = new URLSearchParams(Object.entries(params).filter(([,v])=>v !== null && v !== undefined)); url += (url.includes('?') ? '&' : '?') + query; }
        else if (params instanceof FormData) { delete options.headers['Content-Type']; options.body = params; }
        else options.body = JSON.stringify(params);
    }
    const prefix = /\/local-agents(?:\/|$)|\/delegations(?:\/|$)/.test(url) ? '/api' : '/api/dashboard';
    return requestJson(prefix + url, options, { ...(method === 'GET' ? {} : { timeoutMs: 0 }), ...requestOptions });
}
export default { get:(url,params,options)=>request(url,params,'GET',options), create:(url,params)=>request(url,params,'POST'), update:(url,params)=>request(url,params,'PUT'), remove:(url,params)=>request(url,params,'DELETE') };
