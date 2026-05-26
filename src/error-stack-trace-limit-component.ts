import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';

export class ErrorStackTraceLimitComponent extends ComponentEx {
  public override onload(): void {
    const originalStackTraceLimit = Error.stackTraceLimit;
    this.register(() => {
      Error.stackTraceLimit = originalStackTraceLimit;
    });
  }
}
