import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extraCorsOrigins, isAllowedBrowserOrigin } from './corsOrigin.js'

describe('LAN CORS origins', () => {
  it('allows localhost, private LAN, and extra listed origins', () => {
    assert.equal(isAllowedBrowserOrigin('http://localhost:5173'), true)
    assert.equal(isAllowedBrowserOrigin('http://127.0.0.1:5173'), true)
    assert.equal(isAllowedBrowserOrigin('http://192.168.1.20:5173'), true)
    assert.equal(isAllowedBrowserOrigin('http://10.0.0.8:5173'), true)
    assert.equal(isAllowedBrowserOrigin('http://172.16.4.2:5173'), true)
    assert.equal(isAllowedBrowserOrigin('https://evil.example'), false)
    assert.equal(isAllowedBrowserOrigin('http://8.8.8.8:5173'), false)
    assert.equal(
      isAllowedBrowserOrigin('https://hospital.example', extraCorsOrigins('https://hospital.example, http://other.local')),
      true
    )
  })
})
