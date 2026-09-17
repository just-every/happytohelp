#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { launch } from './base-onboarding/launcher.mjs';
import { seed } from './installer/seed.mjs';
await launch(fileURLToPath(new URL('..',import.meta.url)),seed);
