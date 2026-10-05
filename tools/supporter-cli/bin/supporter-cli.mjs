#!/usr/bin/env node
import process from 'node:process';
import { run, nodeIo } from '../src/cli.ts';

process.exitCode = await run(process.argv.slice(2), nodeIo());
