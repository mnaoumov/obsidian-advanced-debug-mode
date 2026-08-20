import { registerDemoVaultButtonSuite } from 'obsidian-dev-utils/script-utils/demo-vault-buttons';

// Clicks every `code-button` in `demo-vault/` against a real Obsidian.
// A button's failure happens at click time — a wrong `require('/demoSetup.ts')` path, or an API that
// Changed shape under it — so no other gate in this repo can catch it.
// `lint:md` reads the markdown and the coverage suite checks the authoring conventions, and neither
// Executes anything.
//
// `01 Debug mode.md` is excluded, and it is the one vault-wide exception in the fleet.
// Its buttons call `app.debugMode()`, which reloads every plugin — that reload IS the feature this
// Plugin is named for, not a mistake to fix. A button that reloads the app destroys the results panel
// It would report into, so it can never be observed to have succeeded; and because the suite drives one
// Obsidian for the whole run, letting it fire takes the CDP page context down and every LATER note in
// The vault with it. Measured: with the note in, all six notes fail and the errors name a vanished
// `app.plugins`; with it out, the remaining twelve buttons pass.
//
// The cost is that the note's read-only "Is debug mode on?" button is not gated either, since exclusion
// Is per note. That button is the safe one, and it stays in the vault where a reader needs it.
//
// Isolation: `npx vitest run --project integration-tests:demo-vault`.
registerDemoVaultButtonSuite({ excludedNotes: ['README.md', '01 Debug mode.md'] });
