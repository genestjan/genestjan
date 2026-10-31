import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { PasswordInput } from './Auth';

function Form() {
  const [pw, setPw] = useState('secret words');
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <PasswordInput value={pw} onChange={setPw} autoComplete="new-password" />
      <button>Create my account</button>
    </form>
  );
}

describe('PasswordInput', () => {
  it('hides the password again when the form is sent, so a screenshot of an error never shows it', () => {
    render(<Form />);
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByDisplayValue('secret words')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(screen.getByDisplayValue('secret words')).toHaveAttribute('type', 'password');
  });
});
