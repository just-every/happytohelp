#!/usr/bin/env node
// Test-only Claude stream-json transport; no provider network.
import { readFile } from 'node:fs/promises';
const scenario = JSON.parse(await readFile(process.env.H2H_PROVIDER_SCENARIO, 'utf8'));
if (scenario.stderr) process.stderr.write(scenario.stderr);
for (const event of scenario.events) process.stdout.write(JSON.stringify(event) + '\n');
process.exitCode = scenario.code || 0;
