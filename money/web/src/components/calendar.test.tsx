import { fireEvent, render, screen } from '@testing-library/react';
import { defaultCategories, defaultSettings } from '../lib/model';
import { boot, useApp } from '../lib/session';
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

  it('keeps the secret once the script is copied, so it still matches after Money Hub locks', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await boot({ demo: true });
    const first = render(<CalendarSheet onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Copy the script/ }));
    await screen.findByText('Script copied');
    const script = writeText.mock.calls.at(-1)![0] as string;
    const secret = /const SECRET = '([^']+)'/.exec(script)![1];
    expect(useApp.getState().snap!.settings.reminders?.scriptSecret).toBe(secret);
    first.unmount(); // what locking does to this panel
    render(<CalendarSheet onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Copy the script/ }));
    await screen.findByText('Script copied');
    expect(writeText.mock.calls.at(-1)![0]).toBe(script);
  });
});
