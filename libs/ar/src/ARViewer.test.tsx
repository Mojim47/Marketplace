import { render, screen } from '@testing-library/react';
import { ARViewer } from './ARViewer';

describe('ARViewer', () => {
  it('renders helper text and model-viewer element', () => {
    const { container } = render(<ARViewer modelId="sample-model" />);
    expect(screen.getByText(/واقعیت افزوده/i)).toBeTruthy();
    const viewer = container.querySelector('model-viewer');
    expect(viewer).toBeTruthy();
  });

  it('renders USDZ link when provided', () => {
    render(<ARViewer modelId="sample-model" usdzUrl="/models/sample.usdz" />);
    const link = screen.getByText(/USDZ/i);
    expect(link).toBeTruthy();
  });

  it('supports disabling AR mode', () => {
    const { container } = render(<ARViewer modelId="sample-model" arEnabled={false} />);
    const viewer = container.querySelector('model-viewer');
    expect(viewer?.getAttribute('ar')).toBe('false');
  });
});
