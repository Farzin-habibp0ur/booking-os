jest.mock('./use-keyboard-shortcut', () => ({
  useKeyboardShortcut: jest.fn(),
  useListNavigation: jest.fn().mockReturnValue({ setIndex: jest.fn(), getIndex: () => -1 }),
}));

import { renderHook } from '@testing-library/react';
import { useKeyboardShortcut, useListNavigation } from './use-keyboard-shortcut';
import { useActionTriageShortcuts, useQueueShortcuts } from './use-marketing-shortcuts';

const mockShortcut = useKeyboardShortcut as jest.Mock;
const mockListNav = useListNavigation as jest.Mock;

describe('useActionTriageShortcuts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers a, d, s, and Escape shortcuts', () => {
    const opts = {
      onApprove: jest.fn(),
      onDismiss: jest.fn(),
      onSnooze: jest.fn(),
      onEscape: jest.fn(),
    };
    renderHook(() => useActionTriageShortcuts(opts));

    // 4 calls: a, d, s, Escape
    expect(mockShortcut).toHaveBeenCalledTimes(4);
    const keys = mockShortcut.mock.calls.map((c) => c[0]);
    expect(keys).toContain('a');
    expect(keys).toContain('d');
    expect(keys).toContain('s');
    expect(keys).toContain('Escape');
  });

  it('Escape has allowInInputs option', () => {
    const opts = {
      onApprove: jest.fn(),
      onDismiss: jest.fn(),
      onSnooze: jest.fn(),
      onEscape: jest.fn(),
    };
    renderHook(() => useActionTriageShortcuts(opts));

    const escapeCall = mockShortcut.mock.calls.find((c) => c[0] === 'Escape');
    expect(escapeCall[2]).toEqual({ allowInInputs: true });
  });

  it('calls the correct handler for each key', () => {
    const opts = {
      onApprove: jest.fn(),
      onDismiss: jest.fn(),
      onSnooze: jest.fn(),
      onEscape: jest.fn(),
    };
    renderHook(() => useActionTriageShortcuts(opts));

    // Invoke 'a' handler
    const aCall = mockShortcut.mock.calls.find((c) => c[0] === 'a');
    aCall[1]();
    expect(opts.onApprove).toHaveBeenCalledTimes(1);

    // Invoke 'd' handler
    const dCall = mockShortcut.mock.calls.find((c) => c[0] === 'd');
    dCall[1]();
    expect(opts.onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('useQueueShortcuts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls useListNavigation with itemCount and onSelect', () => {
    const onSelect = jest.fn();
    renderHook(() =>
      useQueueShortcuts({ itemCount: 10, onSelect, onExpand: jest.fn(), onEscape: jest.fn() }),
    );
    expect(mockListNav).toHaveBeenCalledWith(10, onSelect);
  });

  it('registers Enter and Escape shortcuts', () => {
    renderHook(() =>
      useQueueShortcuts({
        itemCount: 5,
        onSelect: jest.fn(),
        onExpand: jest.fn(),
        onEscape: jest.fn(),
      }),
    );

    const keys = mockShortcut.mock.calls.map((c) => c[0]);
    expect(keys).toContain('Enter');
    expect(keys).toContain('Escape');
  });

  it('returns setIndex and getIndex from useListNavigation', () => {
    const setIndex = jest.fn();
    mockListNav.mockReturnValue({ setIndex, getIndex: () => 3 });
    const { result } = renderHook(() =>
      useQueueShortcuts({
        itemCount: 5,
        onSelect: jest.fn(),
        onExpand: jest.fn(),
        onEscape: jest.fn(),
      }),
    );
    expect(result.current.setIndex).toBe(setIndex);
    expect(result.current.getIndex()).toBe(3);
  });
});
