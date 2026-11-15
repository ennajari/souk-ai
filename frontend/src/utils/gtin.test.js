// Run: node --test src/utils/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validGtin } from './gtin.js'

test('valid GTINs', () => {
  // EAN-13, EAN-8 and UPC-A examples with correct check digits
  for (const c of ['4006381333931', '96385074', '036000291452']) assert.ok(validGtin(c), c)
})

test('misreads are rejected', () => {
  assert.equal(validGtin('4006381333932'), false) // last digit off by one
  assert.equal(validGtin('400638133393'), false)  // truncated EAN-13 (12 digits, wrong check)
  assert.equal(validGtin('abc'), false)
})
