import {describe,expect,it} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {WatchHow,kindForTemplate} from '@/components/exercise-demo';

describe('kindForTemplate', () => {
  it('finds the camera exercise behind a library or plan template', () => {
    expect(kindForTemplate('camera_squat')).toBe('squat');
    expect(kindForTemplate('camera_kbhighpull')).toBe('kbhighpull');
    expect(kindForTemplate('strength')).toBe('wallpush');
    expect(kindForTemplate('gym')).toBe('curl');
    expect(kindForTemplate('pushup')).toBe('pushup');
  });
  it('has no example for activities without a move to show', () => {
    expect(kindForTemplate('walk')).toBeUndefined();
    expect(kindForTemplate('recovery')).toBeUndefined();
  });
});

describe('WatchHow', () => {
  it('opens the moving example only when asked, and closes it again', () => {
    render(<WatchHow kind="squat"/>);
    const button = screen.getByRole('button', {name: /watch how to do it/i});
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('How to do it')).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('How to do it')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /hide demo/i}));
    expect(screen.queryByText('How to do it')).toBeNull();
  });
});
