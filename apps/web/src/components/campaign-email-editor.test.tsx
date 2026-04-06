import { render, screen } from '@testing-library/react';
import CampaignEmailEditor from './campaign-email-editor';

// Mock next/dynamic to render a simple placeholder
jest.mock('next/dynamic', () => {
  return function mockDynamic() {
    return function MockEmailEditor() {
      return <div data-testid="unlayer-editor">Email Editor</div>;
    };
  };
});

describe('CampaignEmailEditor', () => {
  it('renders the editor container', () => {
    render(<CampaignEmailEditor onChange={jest.fn()} />);
    expect(screen.getByTestId('email-editor')).toBeInTheDocument();
  });

  it('renders the email editor', () => {
    render(<CampaignEmailEditor onChange={jest.fn()} />);
    expect(screen.getByTestId('unlayer-editor')).toBeInTheDocument();
  });
});
