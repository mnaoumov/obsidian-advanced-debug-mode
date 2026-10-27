import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import eruda from 'eruda';
import { Platform } from 'obsidian';
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
    destroy: vi.fn(),
    init: vi.fn()
  }
}));

describe('DevToolsComponent', () => {
  let component: DevToolsComponent;
  let mockButton: HTMLDivElement;
  let mockShadowRoot: ShadowRoot;
  let isSavedIsMobileApp: boolean;

  function setIsMobileApp(isMobileApp: boolean): void {
    Object.defineProperty(Platform, 'isMobileApp', { configurable: true, value: isMobileApp });
  }

  beforeEach(() => {
    isSavedIsMobileApp = Platform.isMobileApp;
    vi.mocked(eruda.init).mockClear();
    vi.mocked(eruda.destroy).mockClear();

    mockButton = createDiv();
    mockButton.classList.add('eruda-entry-btn');

    mockShadowRoot = strictProxy<ShadowRoot>({
      find: vi.fn().mockReturnValue(mockButton)
    });

    interface ErudaInitOptions {
      readonly container?: HTMLElement;
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
    setIsMobileApp(isSavedIsMobileApp);
  });

  describe('on mobile', () => {
    beforeEach(() => {
      setIsMobileApp(true);
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

    it('should toggle eruda button visibility without initializing eruda again', () => {
      component.load();

      // isShown() returns false in jsdom (offsetParent is always null),
      // so toggle(!false) → toggle(true) → display = ""
      component.toggleDevToolsButton();
      expect(mockButton.style.display).toBe('');
      expect(eruda.init).toHaveBeenCalledOnce();
    });

    it('should destroy eruda and remove its container div on unload', () => {
      component.load();

      const containerDiv = document.body.lastElementChild;
      expect(containerDiv).toBeTruthy();

      component.unload();

      expect(eruda.destroy).toHaveBeenCalledOnce();
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
  });

  describe('on desktop', () => {
    beforeEach(() => {
      setIsMobileApp(false);
    });

    it('should not initialize eruda on load', () => {
      component.load();

      expect(eruda.init).not.toHaveBeenCalled();
    });

    it('should initialize eruda and show its button on the first toggle', () => {
      component.load();

      component.toggleDevToolsButton();

      expect(eruda.init).toHaveBeenCalledOnce();
      expect(mockButton.style.display).toBe('');
    });

    it('should not destroy eruda on unload when it was never initialized', () => {
      component.load();
      component.unload();

      expect(eruda.destroy).not.toHaveBeenCalled();
    });

    it('should initialize eruda again after a reload', () => {
      component.load();
      component.toggleDevToolsButton();
      component.unload();

      component.load();
      component.toggleDevToolsButton();

      expect(eruda.destroy).toHaveBeenCalledOnce();
      expect(eruda.init).toHaveBeenCalledTimes(2);
    });
  });

  it('should not initialize eruda when toggling before load', () => {
    component.toggleDevToolsButton();

    expect(eruda.init).not.toHaveBeenCalled();
  });
});
