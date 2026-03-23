const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { render } from '@testing-library/react';
import MarketingLayout from './layout';

describe('MarketingLayout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to /ai', () => {
    render(
      <MarketingLayout>
        <div>should not render</div>
      </MarketingLayout>,
    );
    expect(mockPush).toHaveBeenCalledWith('/ai');
  });

  it('renders nothing', () => {
    const { container } = render(
      <MarketingLayout>
        <div>hidden</div>
      </MarketingLayout>,
    );
    expect(container.innerHTML).toBe('');
  });
});
