import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountPortabilitySubPanel } from './AccountPortabilitySubPanel';

describe('AccountPortabilitySubPanel', () => {
  it('renders export and import buttons, triggers file picker, and validates valid/invalid backup files', async () => {
    render(<AccountPortabilitySubPanel isActive={true} />);

    expect(screen.getByTestId('library-portability-section')).not.toHaveClass('hidden');

    // Click Import Backup button to trigger hidden file input click
    const importBtn = screen.getByRole('button', { name: /Import library backup from JSON file/i });
    fireEvent.click(importBtn);

    const fileInput = screen.getByTestId('library-backup-file-input');

    // Upload a structurally invalid Bookarium backup JSON (missing library section)
    const invalidJson = JSON.stringify({ app: 'Bookarium' });
    const invalidSchemaFile = new File([invalidJson], 'invalid.json', {
      type: 'application/json',
    });
    Object.defineProperty(invalidSchemaFile, 'text', {
      value: () => Promise.resolve(invalidJson),
    });
    fireEvent.change(fileInput, { target: { files: [invalidSchemaFile] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/missing required library section/i);

    // Upload a valid Bookarium backup JSON to open AccountRestoreModal
    const validPayload = {
      version: '1.0',
      app: 'Bookarium',
      exportedAt: '2026-10-23T00:00:00.000Z',
      library: {
        savedBooks: [{ id: 1342, title: 'Pride and Prejudice' }],
      },
    };
    const validJson = JSON.stringify(validPayload);
    const validFile = new File([validJson], 'valid.json', {
      type: 'application/json',
    });
    Object.defineProperty(validFile, 'text', {
      value: () => Promise.resolve(validJson),
    });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Confirm restore and close modal
    const restoreBtn = screen.getByRole('button', { name: /Confirm & Restore/i });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(screen.getByText(/Backup Successfully Restored/i)).toBeInTheDocument();
    });

    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

