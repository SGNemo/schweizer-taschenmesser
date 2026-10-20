// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => ({
  captureFrame: vi.fn(),
  copyImage: vi.fn(),
  shareImage: vi.fn(),
  canShareImage: vi.fn(() => false),
}));
vi.mock('./capture', () => capture);
const saveFile = vi.hoisted(() => vi.fn(async () => 'saved'));
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ saveFile }) }));

import ScreenshotTool from './Tool';

const shot = { blob: new Blob(['png'], { type: 'image/png' }), width: 640, height: 400 };

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getDisplayMedia: vi.fn() },
    configurable: true,
  });
  URL.createObjectURL = vi.fn(() => 'blob:shot');
  URL.revokeObjectURL = vi.fn();
  capture.captureFrame.mockReset();
  capture.copyImage.mockReset();
  saveFile.mockClear();
});
afterEach(cleanup);

describe('ScreenshotTool', () => {
  it('says so, friendly, where the device cannot capture', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    render(<ScreenshotTool />);
    expect(screen.getByTestId('screenshot-unsupported')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bildschirm aufnehmen' })).toBeNull();
  });

  it('takes a picture, shows it and saves it as a PNG with the time in the name', async () => {
    capture.captureFrame.mockResolvedValue(shot);
    render(<ScreenshotTool />);
    fireEvent.click(screen.getByRole('button', { name: 'Bildschirm aufnehmen' }));
    const img = await screen.findByTestId('screenshot-preview');
    expect(img).toHaveAttribute('alt', expect.stringContaining('640 × 400'));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(saveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        mime: 'image/png',
        fileName: expect.stringMatching(/^bildschirmfoto-.*\.png$/),
      }),
    );
  });

  it('a dismissed picker is "Nichts aufgenommen.", a real failure asks to try again', async () => {
    capture.captureFrame.mockRejectedValueOnce({ name: 'NotAllowedError' });
    render(<ScreenshotTool />);
    fireEvent.click(screen.getByRole('button', { name: 'Bildschirm aufnehmen' }));
    expect(await screen.findByText('Nichts aufgenommen.')).toBeInTheDocument();
    capture.captureFrame.mockRejectedValueOnce(new Error('no-frame'));
    fireEvent.click(screen.getByRole('button', { name: 'Bildschirm aufnehmen' }));
    expect(
      await screen.findByText('Die Aufnahme hat nicht geklappt. Probier es noch einmal.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('screenshot-preview')).toBeNull();
  });

  it('discarding removes the picture', async () => {
    capture.captureFrame.mockResolvedValue(shot);
    render(<ScreenshotTool />);
    fireEvent.click(screen.getByRole('button', { name: 'Bildschirm aufnehmen' }));
    await screen.findByTestId('screenshot-preview');
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByTestId('screenshot-preview')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('asks for the 3 second pause only when ticked, and offers Teilen only where it exists', async () => {
    capture.captureFrame.mockResolvedValue(shot);
    render(<ScreenshotTool />);
    fireEvent.click(screen.getByRole('button', { name: 'Bildschirm aufnehmen' }));
    await screen.findByTestId('screenshot-preview');
    expect(capture.captureFrame).toHaveBeenLastCalledWith(
      expect.objectContaining({ delaySeconds: 0 }),
    );
    expect(screen.queryByRole('button', { name: 'Teilen' })).toBeNull();

    capture.canShareImage.mockReturnValue(true);
    fireEvent.click(screen.getByLabelText('Nach 3 Sekunden aufnehmen'));
    fireEvent.click(screen.getByRole('button', { name: 'Noch einmal aufnehmen' }));
    await waitFor(() =>
      expect(capture.captureFrame).toHaveBeenLastCalledWith(
        expect.objectContaining({ delaySeconds: 3 }),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Teilen' }));
    await waitFor(() => expect(capture.shareImage).toHaveBeenCalled());
  });

  it('copies through the clipboard helper', async () => {
    capture.captureFrame.mockResolvedValue(shot);
    capture.copyImage.mockResolvedValue(true);
    render(<ScreenshotTool />);
    fireEvent.click(screen.getByRole('button', { name: 'Bildschirm aufnehmen' }));
    await screen.findByTestId('screenshot-preview');
    fireEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    await waitFor(() => expect(capture.copyImage).toHaveBeenCalledWith(shot.blob));
  });
});
