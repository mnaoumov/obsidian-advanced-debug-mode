import { Component } from 'obsidian';

export class ErrorStackTraceLimitComponent extends Component {
  public override onload(): void {
    super.onload();
    const originalStackTraceLimit = Error.stackTraceLimit;
    this.register(() => {
      Error.stackTraceLimit = originalStackTraceLimit;
    });
  }
}
