/**
 * TEST ONLY – this key pair is public on purpose (the repo is public). The app's embedded keys
 * never contain this public key, and a test pins that, so codes signed with it are rejected.
 */
import { ed25519 } from '@noble/curves/ed25519.js';

// gitleaks:allow – fixed test seed, not a secret (see header)
export const TEST_SECRET_KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
export const TEST_PUBLIC_KEY = ed25519.getPublicKey(TEST_SECRET_KEY);
export const TEST_KEY_ID = 7;
