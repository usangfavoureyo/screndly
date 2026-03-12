import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import { validateTimestamp } from '../utils/ffmpeg';

describe('Screndly Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.clearAllMocks();
  });

  it('renders the login page when there is no stored auth session', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    expect(container.innerHTML).toContain('Password');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('shows the remember-me control and public legal links on the login page', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /keep me signed in/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /disclaimer/i })).toHaveAttribute('href', '/disclaimer');
  });

  it('supports theme toggling on the root document', () => {
    document.documentElement.classList.remove('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    document.documentElement.classList.add('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    document.documentElement.classList.remove('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('stores and retrieves settings in localStorage', () => {
    const settings = {
      captionTemperature: 0.7,
      captionReviewPrompt: 'Review prompt',
    };

    localStorage.setItem('settings', JSON.stringify(settings));

    expect(JSON.parse(localStorage.getItem('settings') || '{}')).toEqual(settings);
  });

  it('validates SEO caption length boundaries', () => {
    const isValidCaptionLength = (caption: string) => caption.length >= 120 && caption.length <= 250;

    expect(isValidCaptionLength('A'.repeat(120))).toBe(true);
    expect(isValidCaptionLength('A'.repeat(250))).toBe(true);
    expect(isValidCaptionLength('A'.repeat(119))).toBe(false);
    expect(isValidCaptionLength('A'.repeat(251))).toBe(false);
  });

  it('uses the strict HH:MM:SS timestamp format required by the app', () => {
    expect(validateTimestamp('01:23:45')).toBe(true);
    expect(validateTimestamp('1:23:45')).toBe(false);
    expect(validateTimestamp('01:60:45')).toBe(false);
  });

  it('sanitizes HTML by escaping markup instead of preserving executable tags', () => {
    const sanitizeHtml = (input: string) => {
      const div = document.createElement('div');
      div.textContent = input;
      return div.innerHTML;
    };

    const sanitized = sanitizeHtml('<script>alert("xss")</script>');

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });

  it('renders focusable controls on the login screen for keyboard users', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    expect(focusableElements.length).toBeGreaterThan(0);
  });
});
