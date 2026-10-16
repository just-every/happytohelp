import test from 'node:test'
import {journey} from '../reports/claims.mjs'

// Reports through their real doors (tests/reports holds each journey's scenarios).
for(const key of ['figures','outcomes','ratings'])test(...journey(key))
