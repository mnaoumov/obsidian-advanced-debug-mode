import eruda from 'eruda';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { DevToolsComponent } from './dev-tools-component.ts';

vi.mock('eruda', () => ({
  default: {
    init: vi.fn()
  }
}));

describe('DevToolsComponent', () => {
  let component: DevToolsComponent;
  let mockButton: HTMLDivElement;
  let mockShadowRoot: ShadowRoot;

  beforeEach(() => {
    mockButton = createDiv();
    mockButton.classList.add('eruda-entry-btn');

    // eslint-disable-next-line no-restricted-syntax -- Test mock requires double assertion.
    mockShadowRoot = {
      find: vi.fn().mockReturnValue(mockButton)
    } as unknown as ShadowRoot;

    interface ErudaInitOptions {
      container?: HTMLElement;
    }

    vi.mocked(eruda.init).mockImplementation((options?: ErudaInitOptions) => {
      if (options?.container) {
        Object.defineProperty(options.container, 'shadowRoot', {
          configurable: true,
          value: mockShadowRoot
        });
      }
    });

    component = new DevToolsComponent();
  });

  afterEach(() => {
    component.unload();
  });

  it('should initialize eruda on load', () => {
    component.load();

    expect(eruda.init).toHaveBeenCalledOnce();
    expect(eruda.init).toHaveBeenCalledWith(expect.objectContaining({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matcher.
      container: expect.anything()
    }));
  });

  it('should hide eruda button on load', () => {
    component.load();

    expect(mockButton.style.display).toBe('none');
  });

  it('should toggle eruda button visibility based on isShown state', () => {
    component.load();

    // IsShown() returns false in jsdom (offsetParent is always null),
    // So toggle(!false) → toggle(true) → display = ""
    component.toggleDevToolsButton();
    expect(mockButton.style.display).toBe('');
  });

  it('should remove eruda container div on unload', () => {
    component.load();

    const containerDiv = document.body.lastElementChild;
    expect(containerDiv).toBeTruthy();

    component.unload();

    expect(containerDiv?.parentElement).toBeNull();
  });

  it('should stop focusin event propagation', () => {
    component.load();

    const containerDiv = document.body.lastElementChild as HTMLElement;
    const focusEvent = new FocusEvent('focusin', { bubbles: true });
    const stopPropagationSpy = vi.spyOn(focusEvent, 'stopPropagation');

    containerDiv.dispatchEvent(focusEvent);

    expect(stopPropagationSpy).toHaveBeenCalledOnce();
  });

  it('should not throw when toggling before load', () => {
    expect(() => {
      component.toggleDevToolsButton();
    }).not.toThrow();
  });
});
