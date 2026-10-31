import { fireEvent, render, screen } from '@testing-library/react';
import { defaultCategories, defaultSettings } from '../lib/model';
import { useApp } from '../lib/session';
import { CalendarSheet } from './calendar';

describe('CalendarSheet', () => {
  it('shows the steps and refuses a link that is not an Apps Script web app', async () => {
    useApp.setState({
      snap: { accounts: [], txns: [], categories: defaultCategories(), budgets: [], bills: [], rules: [], captures: [], settings: defaultSettings(), version: 1 },
    });
    render(<CalendarSheet onClose={() => undefined} />);
    expect(screen.getByText('Copy the script')).toBeInTheDocument();
    expect(screen.getByText(/5 days before it is due/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/script.google.com/), { target: { value: 'https://example.com/hook' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect and send/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/starts with https:\/\/script.google.com\/macros\/s\//);
  });
});
