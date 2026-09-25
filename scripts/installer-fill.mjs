#!/usr/bin/env node
import { fill } from './base-onboarding/fill.mjs';
import { seed } from './installer/seed.mjs';
await fill(seed);
