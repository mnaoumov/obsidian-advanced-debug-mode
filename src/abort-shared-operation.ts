import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';

import { getSharedAbortController } from 'obsidian-dev-utils/abort-controller';
import { SilentError } from 'obsidian-dev-utils/error';

const ABORT_REASON_MESSAGE = 'Aborted by Advanced Debug Mode.';

/**
 * Aborts the app-wide shared abort controller, cancelling whichever long-running operation is currently in
 * flight — in any plugin built on `obsidian-dev-utils`, not just this one.
 *
 * The reason is a {@link SilentError} rather than the native `AbortError`: a deliberate user-initiated cancel
 * is not a failure, so a listener that rethrows the reason should not print a red stack for something that
 * was asked for.
 *
 * The notice claims only that the abort was signalled. The shared signal keeps no registry of its observers,
 * so there is no way to know whether anything was listening, and the wording must not imply otherwise.
 *
 * @param pluginNoticeComponent - The notice component used to report that the abort was signalled.
 */
export function abortSharedOperation(pluginNoticeComponent: PluginNoticeComponent): void {
  getSharedAbortController().abort(new SilentError(ABORT_REASON_MESSAGE));
  pluginNoticeComponent.showNotice('Abort signalled. Any operation listening to the shared abort signal — in any plugin — will stop.');
}
