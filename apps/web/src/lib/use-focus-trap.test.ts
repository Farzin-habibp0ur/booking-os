import { renderHook } from '@testing-library/react';
import { useFocusTrap } from './use-focus-trap';

function createContainer() {
  const container = document.createElement('div');
  container.innerHTML = `
    <button id="btn1">First</button>
    <input id="input1" />
    <button id="btn2">Last</button>
  `;
  document.body.appendChild(container);
  return container;
}

describe('useFocusTrap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses first focusable element when activated', () => {
    const container = createContainer();
    const ref = { current: container };

    renderHook(() => useFocusTrap(ref, true));

    expect(document.activeElement).toBe(container.querySelector('#btn1'));
  });

  it('does not trap focus when inactive', () => {
    const container = createContainer();
    const ref = { current: container };
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    renderHook(() => useFocusTrap(ref, false));

    expect(document.activeElement).toBe(outside);
  });

  it('wraps focus from last to first on Tab', () => {
    const container = createContainer();
    const ref = { current: container };

    renderHook(() => useFocusTrap(ref, true));

    const last = container.querySelector('#btn2') as HTMLElement;
    last.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    container.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(container.querySelector('#btn1'));
  });

  it('wraps focus from first to last on Shift+Tab', () => {
    const container = createContainer();
    const ref = { current: container };

    renderHook(() => useFocusTrap(ref, true));

    const first = container.querySelector('#btn1') as HTMLElement;
    first.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    container.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(container.querySelector('#btn2'));
  });

  it('restores focus to previously focused element on deactivation', () => {
    const container = createContainer();
    const ref = { current: container };
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    const { unmount } = renderHook(() => useFocusTrap(ref, true));

    expect(document.activeElement).toBe(container.querySelector('#btn1'));

    unmount();

    expect(document.activeElement).toBe(outside);
  });
});
