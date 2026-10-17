import {request} from 'node:http';

// Browser work can outlive workerd's idle HTTP connections. Fixture writes use
// one fresh socket and one attempt, so an ambiguous write is never replayed.
export function nativeHttp(url, {method = 'GET', headers = {}, body} = {}) {
 return new Promise((resolve, reject) => {
  const call = request(url, {method, headers, agent: false, signal: AbortSignal.timeout(30000)}, response => {
   const chunks = [];
   response.on('data', chunk => chunks.push(chunk));
   response.on('error', reject);
   response.on('end', () => resolve({status: response.statusCode, body: Buffer.concat(chunks).toString('utf8')}));
  });
  call.on('error', reject);
  call.end(body);
 });
}
