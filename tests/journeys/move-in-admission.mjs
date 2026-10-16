import test from 'node:test'
import {journey} from '../move-in/claims.mjs'

// Move in through its real upload, review, apply, resume, undo and erasure doors (tests/move-in holds each journey's scenarios).
test(...journey('refusals'))
test(...journey('review'))
test(...journey('landing'))
