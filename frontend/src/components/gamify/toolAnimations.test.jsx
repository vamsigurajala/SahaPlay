import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import ToolAnimation, { TOOL_ANIMATION_TYPES } from './toolAnimations';
import GarageWorkshopViewer, { GARAGE_CATEGORIES } from './GarageWorkshopViewer';

describe('garage tool animations', () => {
  it('every garage tool has its own animated illustration', () => {
    for (const cat of Object.values(GARAGE_CATEGORIES)) {
      for (const item of cat.items) expect(TOOL_ANIMATION_TYPES).toContain(item.animationType);
    }
  });

  it('every illustration renders an svg without throwing', () => {
    for (const type of TOOL_ANIMATION_TYPES) {
      const { container } = render(<ToolAnimation type={type} c="#ef4444" k="#0f172a" />);
      expect(container.querySelector('svg')).toBeTruthy();
      cleanup();
    }
  });

  it('opens on the tab it was asked for and lists the shared gearbox tools', () => {
    const { getByText, getAllByText } = render(<GarageWorkshopViewer onClose={() => {}} arg="shared" />);
    expect(getAllByText('Transmission Gearbox Bench').length).toBeGreaterThan(0);
    expect(getByText('Digital Multimeter')).toBeInTheDocument();
  });
});
