import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './Switch';

describe('Switch component', () => {
  it('renders accessible button switch mode with aria-checked and thumb slide state', () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Switch
        checked={false}
        onCheckedChange={onCheckedChange}
        ariaLabel="Toggle Exit Bookmark Prompt"
        dataTestId="exit-prompt-switch"
        className="custom-track"
      />
    );

    const switchBtn = screen.getByRole('switch', { name: 'Toggle Exit Bookmark Prompt' });
    expect(switchBtn.tagName).toBe('BUTTON');
    expect(switchBtn).toHaveAttribute('aria-checked', 'false');
    expect(switchBtn).toHaveClass('bg-muted-foreground/30', 'custom-track');
    expect(switchBtn.firstElementChild).toHaveClass('translate-x-0');

    fireEvent.click(switchBtn);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    rerender(
      <Switch
        checked={true}
        onCheckedChange={onCheckedChange}
        ariaLabel="Toggle Exit Bookmark Prompt"
        dataTestId="exit-prompt-switch"
      />
    );

    const checkedSwitch = screen.getByTestId('exit-prompt-switch');
    expect(checkedSwitch).toHaveAttribute('aria-checked', 'true');
    expect(checkedSwitch).toHaveClass('bg-primary');
    expect(checkedSwitch.firstElementChild).toHaveClass('translate-x-4');
  });

  it('renders checkbox-backed peer switch compatible with .toBeChecked() assertions', () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <div>
        <label htmlFor="public-profile-toggle">Enable Public Scholar Profile</label>
        <Switch
          id="public-profile-toggle"
          mode="checkbox"
          checked={false}
          onCheckedChange={onCheckedChange}
        />
      </div>
    );

    const checkboxSwitch = screen.getByRole('switch', {
      name: 'Enable Public Scholar Profile',
    });
    expect(checkboxSwitch.tagName).toBe('INPUT');
    expect(checkboxSwitch).toHaveAttribute('type', 'checkbox');
    expect(checkboxSwitch).toHaveAttribute('aria-checked', 'false');
    expect(checkboxSwitch).not.toBeChecked();

    fireEvent.click(checkboxSwitch);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    rerender(
      <div>
        <label htmlFor="public-profile-toggle">Enable Public Scholar Profile</label>
        <Switch
          id="public-profile-toggle"
          mode="checkbox"
          checked={true}
          onCheckedChange={onCheckedChange}
        />
      </div>
    );
    expect(checkboxSwitch).toBeChecked();
    expect(checkboxSwitch).toHaveAttribute('aria-checked', 'true');
  });
});
