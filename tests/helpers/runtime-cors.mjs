import assert from 'node:assert/strict'

export async function verifyCorsUploadRejections(origin) {
  // Each rejected upload must keep its own response through the workerd proxy.
  // These are independent requests, never retries of a failed request.
  for (const method of ['POST', 'PUT']) for (let index = 0; index < 64; index++) {
    const response = await fetch(origin + '/api/identity/local-owner-session', {
      method,
      headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectedUpload: index }),
    })
    const body = await response.text()
    assert.equal(response.status, 403, `${method} rejected origin ${index}: ${body}`)
    assert.deepEqual(JSON.parse(body), { error: 'Origin not allowed' })
    assert.equal(response.headers.get('Set-Cookie'), null)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
  }
}
