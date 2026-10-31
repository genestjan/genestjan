import { fireEvent, render, screen } from '@testing-library/react';
import { clearProblems, problems } from '../lib/problems';
import { CrashGuard } from './problems';
import { ErrorText } from './ui';

describe('error details for screenshots', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the exact error under the message and copies both', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ErrorText detail="AuthApiError 404: Invalid path specified in request URL">Money Hub has the wrong cloud address.</ErrorText>);
    expect(screen.getByText(/AuthApiError 404: Invalid path specified in request URL · Money Hub \S+ web/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy the details' }));
    expect(await screen.findByText('Copied. Paste it into your message.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^Money Hub has the wrong cloud address\.\nAuthApiError 404/));
  });

  it('keeps messages for people plain', () => {
    render(<ErrorText>That password is not right.</ErrorText>);
    expect(screen.getByRole('alert')).toHaveTextContent(/^That password is not right\.$/);
  });

  it('shows a crash screen instead of a blank page, and writes it down', () => {
    clearProblems();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Broken(): never {
      throw new TypeError('x is not a function');
    }
    render(<CrashGuard><Broken /></CrashGuard>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('x is not a function')).toBeInTheDocument();
    expect(problems()[0]).toMatchObject({ where: 'Screen crashed', message: 'x is not a function' });
  });
});
