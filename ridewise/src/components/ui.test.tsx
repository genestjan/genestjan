import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Notice, NumberField } from './ui';

describe('UI primitives', () => {
  it('Notice states its level in words, not only colour', () => {
    render(<Notice level="danger" title="No water for 30 km" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Warning: No water for 30 km');
  });
  it('NumberField reports out-of-range values', async () => {
    function W() {
      const [v, setV] = useState(18);
      return <NumberField id="s" label="Speed" suffix="km/h" value={v} min={5} max={45} onChange={setV} />;
    }
    render(<W />);
    const input = screen.getByLabelText('Speed (km/h)');
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a value from 5 to 45');
  });
});
