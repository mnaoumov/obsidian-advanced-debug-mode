import process from 'node:process';
import { registerDemoVaultCoverageSuite } from 'obsidian-dev-utils/script-utils/demo-vault-coverage';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';

// Keeps the in-repo `demo-vault/` in sync with the plugin's public surface WITHOUT
// launching Obsidian: it reflects the real config from source and asserts every
// setting is documented in a note, and that the guard note/member still exist
// (rename drift). Advanced Debug Mode's runtime behavior (long stack traces, debug
// mode, long-running-task timeouts) is exercised by the desktop/android integration
// suites, so here only the PluginSettings config class is reflected.
registerDemoVaultCoverageSuite({
  configInterfaces: [{ interfaceName: 'PluginSettings', sourcePath: 'src/plugin-settings.ts' }],
  interfaces: [],
  nonTrivialGuard: {
    expectDemoNote: '06 Settings.md',
    expectMember: 'shouldIncludeLongStackTraces',
    interfaceName: 'PluginSettings',
    sourcePath: 'src/plugin-settings.ts'
  },
  rootFolder: getRootFolder() ?? process.cwd()
});
