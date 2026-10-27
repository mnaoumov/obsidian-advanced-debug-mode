import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';

export class ErrorStackTraceLimitComponent extends ComponentEx {
  public override onload(): void {
    const originalStackTraceLimit = Error.stackTraceLimit;
    this.register(() => {
      Error.stackTraceLimit = originalStackTraceLimit;
    });
  }
}
