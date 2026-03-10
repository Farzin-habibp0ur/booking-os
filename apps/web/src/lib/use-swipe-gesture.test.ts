import { renderHook, act } from '@testing-library/react';
import { useSwipeGesture } from './use-swipe-gesture';

function touch(clientX: number, clientY = 0) {
  return { touches: [{ clientX, clientY }] } as any;
}

function touchEnd() {
  return { touches: [] } as any;
}

describe('useSwipeGesture', () => {
  it('returns touch handlers', () => {
    const { result } = renderHook(() => useSwipeGesture({}));
    expect(typeof result.current.onTouchStart).toBe('function');
    expect(typeof result.current.onTouchMove).toBe('function');
    expect(typeof result.current.onTouchEnd).toBe('function');
  });

  it('calls onSwipeRight when swiped right past threshold', () => {
    const onSwipeRight = jest.fn();
    const onSwipeLeft = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeRight, onSwipeLeft }));

    act(() => {
      result.current.onTouchStart(touch(0, 0));
      result.current.onTouchMove(touch(100, 0));
      result.current.onTouchEnd(touchEnd());
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('calls onSwipeLeft when swiped left past threshold', () => {
    const onSwipeLeft = jest.fn();
    const onSwipeRight = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight }));

    act(() => {
      result.current.onTouchStart(touch(200, 0));
      result.current.onTouchMove(touch(80, 0));
      result.current.onTouchEnd(touchEnd());
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('does not trigger swipe when delta is below threshold', () => {
    const onSwipeLeft = jest.fn();
    const onSwipeRight = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight }));

    act(() => {
      result.current.onTouchStart(touch(100, 0));
      result.current.onTouchMove(touch(150, 0));
      result.current.onTouchEnd(touchEnd());
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('calls onSwiping during touch move', () => {
    const onSwiping = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwiping }));

    act(() => {
      result.current.onTouchStart(touch(50, 0));
      result.current.onTouchMove(touch(90, 0));
    });

    expect(onSwiping).toHaveBeenCalledWith(40);
  });

  it('ignores vertical-dominant swipes', () => {
    const onSwipeLeft = jest.fn();
    const onSwipeRight = jest.fn();
    const onSwiping = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight, onSwiping }));

    act(() => {
      result.current.onTouchStart(touch(100, 0));
      // Move more vertically than horizontally
      result.current.onTouchMove({ touches: [{ clientX: 120, clientY: 150 }] } as any);
      result.current.onTouchEnd(touchEnd());
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
    // onSwiping(0) is called when vertical is detected
    expect(onSwiping).toHaveBeenCalledWith(0);
  });

  it('resets and calls onSwiping(0) on touch end', () => {
    const onSwiping = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwiping }));

    act(() => {
      result.current.onTouchStart(touch(0, 0));
      result.current.onTouchMove(touch(100, 0));
      result.current.onTouchEnd(touchEnd());
    });

    // onSwiping should have been called with the delta during move, and 0 on end
    const calls = onSwiping.mock.calls.map((c: number[][]) => c[0]);
    expect(calls).toContain(100);
    expect(calls[calls.length - 1]).toBe(0);
  });

  it('respects custom threshold', () => {
    const onSwipeRight = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeRight, threshold: 40 }));

    act(() => {
      result.current.onTouchStart(touch(0, 0));
      result.current.onTouchMove(touch(50, 0));
      result.current.onTouchEnd(touchEnd());
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });
});
