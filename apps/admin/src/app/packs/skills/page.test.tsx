import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import PackSkillsPage from './page';

beforeEach(() => resetMocks());

describe('PackSkillsPage', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<PackSkillsPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockResolvedValue({
      packs: [
        {
          slug: 'aesthetic',
          skills: [
            {
              agentType: 'WAITLIST',
              name: 'Waitlist Agent',
              description: 'Auto-match waitlist entries',
              category: 'proactive',
              defaultEnabled: true,
              enabledCount: 3,
              businessCount: 5,
              adoptionPercent: 60,
            },
          ],
        },
      ],
    });

    render(<PackSkillsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Skills Catalog').length).toBeGreaterThan(0);
    });
  });
});
