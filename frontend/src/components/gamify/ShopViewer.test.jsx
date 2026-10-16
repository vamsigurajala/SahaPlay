import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ShopViewer from './ShopViewer';
import { SHOPS, SHOP_IDS } from '../../data/gamifyShops';

afterEach(cleanup);

describe('Market shops', () => {
  it('has the four shops, each with plenty of items that have an icon and a price', () => {
    expect(SHOP_IDS.sort()).toEqual(['dressings', 'electronics', 'fastfood', 'medical']);
    for (const s of Object.values(SHOPS)) {
      expect(s.items.length).toBeGreaterThanOrEqual(8);
      for (const it of s.items) { expect(it.price).toBeGreaterThan(0); expect(it.icon).toBeTruthy(); }
    }
  });

  it.each(SHOP_IDS)('%s opens with its items on show', (id) => {
    render(<ShopViewer id={id} onClose={() => {}} />);
    expect(screen.getByText(SHOPS[id].name)).toBeInTheDocument();
    for (const it of SHOPS[id].items) expect(screen.getByRole('button', { name: it.name })).toBeInTheDocument();
  });

  it('adds items to the basket, totals them and checks out', () => {
    render(<ShopViewer id="fastfood" onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Order Cheese Burger' }));
    fireEvent.click(screen.getByRole('button', { name: 'add another Cheese Burger' }));
    fireEvent.click(screen.getByRole('button', { name: 'Order Cold Drink' }));
    expect(screen.getByText(/3 items/)).toBeInTheDocument();
    expect(screen.getByText('₹303')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
    expect(screen.getByText(/nothing was charged/i)).toBeInTheDocument();
  });

  it('tapping an item shows its details', () => {
    render(<ShopViewer id="medical" onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Digital Thermometer' }));
    expect(screen.getByText(/Accurate in 10 seconds/)).toBeInTheDocument();
  });
});
