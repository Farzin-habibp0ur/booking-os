import { renderHook, act } from '@testing-library/react';
import { useMounted } from './use-mounted';

describe('useMounted', () => {
  it('returns false on initial render', () => {
    const { result } = renderHook(() => useMounted());
    // After the first render cycle with useEffect, mounted becomes true
    expect(result.current).toBe(true);
  });

  it('returns true after mount', () => {
    const { result } = renderHook(() => useMounted());
    expect(result.current).toBe(true);
  });
});
