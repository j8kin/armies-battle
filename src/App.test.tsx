import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the armies battle title', () => {
  render(<App />);
  const title = screen.getByText(/armies battle/i);
  expect(title).toBeInTheDocument();
});
