import test from 'node:test'
import {journey} from '../connections/claims.mjs'

// Connections through the real API, settings and dispatcher doors (tests/connections holds each journey's scenarios).
for(const key of ['credentials','api','erasure','delivery','uncertainty','slack'])test(...journey(key))
