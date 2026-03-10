import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcut, useChordShortcut, useListNavigation } from './use-keyboard-shortcut';

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
  window.dispatchEvent(event);
}

function fireKeyOnInput(key: string) {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  input.dispatchEvent(event);
  document.body.removeChild(input);
}

describe('useKeyboardShortcut', () => {
  it('calls handler on matching key press', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut('n', handler));

    fireKey('n');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire when typing in an input', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut('n', handler));

    fireKeyOnInput('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('fires in inputs when allowInInputs is true', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut('Escape', handler, { allowInInputs: true }));

    fireKeyOnInput('Escape');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('requires meta key when meta option is set', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut('k', handler, { meta: true }));

    fireKey('k');
    expect(handler).not.toHaveBeenCalled();

    fireKey('k', { metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('requires shift key when shift option is set', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut('?', handler, { shift: true }));

    fireKey('?');
    expect(handler).not.toHaveBeenCalled();

    fireKey('?', { shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores non-matching keys', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut('n', handler));

    fireKey('m');
    fireKey('x');
    expect(handler).not.toHaveBeenCalled();
  });

  it('cleans up listener on unmount', () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useKeyboardShortcut('n', handler));

    unmount();
    fireKey('n');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useChordShortcut', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fires handler on chord sequence (g then b)', () => {
    const handler = jest.fn();
    renderHook(() => useChordShortcut('g', { b: handler }));

    fireKey('g');
    fireKey('b');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire if timeout expires between keys', () => {
    const handler = jest.fn();
    renderHook(() => useChordShortcut('g', { b: handler }, 500));

    fireKey('g');
    jest.advanceTimersByTime(600);
    fireKey('b');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire if wrong second key', () => {
    const handler = jest.fn();
    renderHook(() => useChordShortcut('g', { b: handler }));

    fireKey('g');
    fireKey('x');
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple chord targets', () => {
    const handlerB = jest.fn();
    const handlerC = jest.fn();
    renderHook(() => useChordShortcut('g', { b: handlerB, c: handlerC }));

    fireKey('g');
    fireKey('c');
    expect(handlerC).toHaveBeenCalledTimes(1);
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('ignores chord when in input', () => {
    const handler = jest.fn();
    renderHook(() => useChordShortcut('g', { b: handler }));

    fireKeyOnInput('g');
    fireKey('b');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useListNavigation', () => {
  it('moves down with j key', () => {
    const onSelect = jest.fn();
    renderHook(() => useListNavigation(5, onSelect));

    fireKey('j');
    expect(onSelect).toHaveBeenCalledWith(0);

    fireKey('j');
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('moves up with k key', () => {
    const onSelect = jest.fn();
    const { result } = renderHook(() => useListNavigation(5, onSelect));

    // Start at index 2
    act(() => result.current.setIndex(2));
    fireKey('k');
    expect(onSelect).toHaveBeenLastCalledWith(1);
  });

  it('wraps around at boundaries', () => {
    const onSelect = jest.fn();
    const { result } = renderHook(() => useListNavigation(3, onSelect));

    // At index 2 (last), j should wrap to 0
    act(() => result.current.setIndex(2));
    fireKey('j');
    expect(onSelect).toHaveBeenLastCalledWith(0);
  });

  it('wraps up from first item', () => {
    const onSelect = jest.fn();
    const { result } = renderHook(() => useListNavigation(3, onSelect));

    act(() => result.current.setIndex(0));
    fireKey('k');
    expect(onSelect).toHaveBeenLastCalledWith(2);
  });

  it('works with ArrowDown and ArrowUp too', () => {
    const onSelect = jest.fn();
    renderHook(() => useListNavigation(5, onSelect));

    fireKey('ArrowDown');
    expect(onSelect).toHaveBeenCalledWith(0);

    fireKey('ArrowUp');
    expect(onSelect).toHaveBeenLastCalledWith(4);
  });

  it('does not fire in inputs', () => {
    const onSelect = jest.fn();
    renderHook(() => useListNavigation(5, onSelect));

    fireKeyOnInput('j');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does nothing when count is 0', () => {
    const onSelect = jest.fn();
    renderHook(() => useListNavigation(0, onSelect));

    fireKey('j');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
