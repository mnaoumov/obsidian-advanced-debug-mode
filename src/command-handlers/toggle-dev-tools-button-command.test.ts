import type { Mock } from 'vitest';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DevToolsComponent } from '../dev-tools-component.ts';

import { ToggleDevToolsButtonCommandHandler } from './toggle-dev-tools-button-command.ts';

interface MockDevToolsComponent {
  toggleDevToolsButton: Mock;
}

function createMockDevToolsComponent(): DevToolsComponent & MockDevToolsComponent {
  return { toggleDevToolsButton: vi.fn() } as DevToolsComponent & MockDevToolsComponent;
}

describe('ToggleDevToolsButtonCommandHandler', () => {
  it('should have correct command metadata', () => {
    const devToolsComponent = createMockDevToolsComponent();
    const handler = new ToggleDevToolsButtonCommandHandler(devToolsComponent);
    const command = handler.buildCommand();

    expect(command.id).toBe('toggle-dev-tools-button');
    expect(command.name).toBe('Toggle dev tools button');
    expect(command.icon).toBe('keyboard-toggle');
  });

  it('should call toggleDevToolsButton when command executes', () => {
    const devToolsComponent = createMockDevToolsComponent();
    const handler = new ToggleDevToolsButtonCommandHandler(devToolsComponent);

    const command = handler.buildCommand();
    const isChecking = false;
    command.checkCallback?.(isChecking);

    expect(devToolsComponent.toggleDevToolsButton).toHaveBeenCalledOnce();
  });

  it('should return true when checking if command can execute', () => {
    const devToolsComponent = createMockDevToolsComponent();
    const handler = new ToggleDevToolsButtonCommandHandler(devToolsComponent);

    const command = handler.buildCommand();
    const isChecking = true;
    const result = command.checkCallback?.(isChecking);

    expect(result).toBe(true);
  });
});
