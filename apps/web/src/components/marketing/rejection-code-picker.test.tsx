// @ts-nocheck
jest.mock('@/lib/cn', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));

import { render, screen, fireEvent } from '@testing-library/react';
import {
  RejectionCodePicker,
  REJECTION_CODES,
  REJECTION_CODE_LABELS,
} from './rejection-code-picker';

describe('RejectionCodePicker', () => {
  const onSelect = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders with all 10 rejection codes', () => {
    render(<RejectionCodePicker selectedCode="R01" onSelect={onSelect} />);
    const picker = screen.getByTestId('rejection-code-picker');
    expect(picker).toBeInTheDocument();
    const options = picker.querySelectorAll('option');
    expect(options.length).toBe(10);
  });

  it('shows selected code', () => {
    render(<RejectionCodePicker selectedCode="R05" onSelect={onSelect} />);
    const picker = screen.getByTestId('rejection-code-picker') as HTMLSelectElement;
    expect(picker.value).toBe('R05');
  });

  it('calls onSelect when code changes', () => {
    render(<RejectionCodePicker selectedCode="R01" onSelect={onSelect} />);
    fireEvent.change(screen.getByTestId('rejection-code-picker'), { target: { value: 'R03' } });
    expect(onSelect).toHaveBeenCalledWith('R03');
  });

  it('renders grouped mode with optgroups', () => {
    render(<RejectionCodePicker selectedCode="R01" onSelect={onSelect} grouped />);
    const picker = screen.getByTestId('rejection-code-picker');
    const groups = picker.querySelectorAll('optgroup');
    expect(groups.length).toBe(3); // CRITICAL, MAJOR, MINOR
  });

  it('shows labels for each code', () => {
    render(<RejectionCodePicker selectedCode="R01" onSelect={onSelect} />);
    REJECTION_CODES.forEach((code) => {
      expect(screen.getByText(`${code} — ${REJECTION_CODE_LABELS[code]}`)).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    render(<RejectionCodePicker selectedCode="R01" onSelect={onSelect} className="extra" />);
    expect(screen.getByTestId('rejection-code-picker').className).toContain('extra');
  });

  it('exports REJECTION_CODES with 10 items', () => {
    expect(REJECTION_CODES).toHaveLength(10);
  });

  it('exports REJECTION_CODE_LABELS with all codes', () => {
    REJECTION_CODES.forEach((code) => {
      expect(REJECTION_CODE_LABELS[code]).toBeDefined();
    });
  });
});
