import test from 'node:test'
import {journey} from '../move-in/claims.mjs'

// Move in through its real upload, review, apply, resume, undo and erasure doors (tests/move-in holds each journey's scenarios).
test(...journey('erasure'))
test(...journey('upgrade'))
test(...journey('helpscout'))
