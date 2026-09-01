import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

declare global {
  interface Window {
    /**
     * `obsidian-dev-utils`' shared-state bag, the seam its own getters read and the one the library
     * documents for the devtools console.
     */
    __obsidianDevUtils: ObsidianDevUtilsStateBag;
  }
}

interface AbortResult {
  readonly isCapturedSignalAborted: boolean;
  readonly isNextSignalAborted: boolean;
  readonly reasonName: string;
}

interface ObsidianDevUtilsStateBag {
  sharedAbortController: ValueWrapperLike<ResettableAbortControllerLike>;
}

interface ResettableAbortControllerLike {
  signal: AbortSignal;
}

interface ValueWrapperLike<T> {
  value: T;
}

// The shared abort controller is app-wide state owned by `obsidian-dev-utils`, so the only thing that can
// Prove this feature works is firing the command inside a real Obsidian and watching a signal captured
// Beforehand flip. A unit test asserts the same shape against the library, but not that the command is
// Registered, reachable by id, and wired to the SAME controller instance the library hands every other
// Plugin — which is the entire point of an app-wide cancel.
describe('Abort the running operation', () => {
  it('should abort the shared signal and leave a fresh one behind', async () => {
    const result = await evalInObsidian({
      callback({ app }): AbortResult {
        // Reached through the shared-state global rather than an import: the closure is serialized into the
        // Renderer, so it cannot import `obsidian-dev-utils/abort-controller`.
        const stateBag = window.__obsidianDevUtils;

        // Captured BEFORE the abort: `ResettableAbortController` replaces its inner controller, so a signal
        // Read afterwards is the fresh one and would never look aborted.
        const capturedSignal = stateBag.sharedAbortController.value.signal;

        app.commands.executeCommandById('advanced-debug-mode:abort-shared-operation');

        const reason: unknown = capturedSignal.reason;

        return {
          isCapturedSignalAborted: capturedSignal.aborted,
          isNextSignalAborted: stateBag.sharedAbortController.value.signal.aborted,
          reasonName: reason instanceof Error ? reason.name : ''
        };
      }
    });

    expect(result.isCapturedSignalAborted).toBe(true);
    // The whole point of the resettable controller: the next operation must not start already cancelled.
    expect(result.isNextSignalAborted).toBe(false);
    // A deliberate cancel is a SilentError, not the native AbortError, so it is not printed as a failure.
    expect(result.reasonName).toBe('SilentError');
  });
});
