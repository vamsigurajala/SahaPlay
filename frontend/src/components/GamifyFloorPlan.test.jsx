import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import GamifyFloorPlan from './GamifyFloorPlan';
import PropViewer from './gamify/PropViewers';

// Mock Three.js & R3F components for JSDOM
vi.mock('@react-three/fiber', async () => {
  return {
    Canvas: ({ children }) => <div data-testid="gamify-canvas">{children}</div>,
    useFrame: vi.fn(),
    useThree: () => ({
      camera: {
        position: { set: vi.fn(), copy: vi.fn().mockReturnThis(), add: vi.fn() },
        rotation: { order: 'XYZ', x: 0, y: 0, z: 0 },
        lookAt: vi.fn(),
        updateProjectionMatrix: vi.fn(),
        updateMatrixWorld: vi.fn(),
        zoom: 1,
      },
      gl: {
        domElement: document.createElement('div'),
        shadowMap: {},
        setPixelRatio: vi.fn(),
        getPixelRatio: () => 1,
      },
      size: { width: 1024, height: 768 },
    }),
  };
});

vi.mock('@react-three/drei', () => ({
  PerformanceMonitor: () => null,
  Html: ({ children }) => <div data-testid="drei-html">{children}</div>,
  OrbitControls: () => null,
}));

vi.mock('./gamify/GamifyRig', async () => {
  const React = await import('react');
  const zones = await vi.importActual('../data/gamifyZones');
  return {
    default: ({ onReady }) => {
      React.useEffect(() => {
        if (onReady) onReady();
      }, [onReady]);
      return null;
    },
    MIN_ZOOM: 0.36,
    MAX_ZOOM: 2.0,
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    ZONES_BY_FLOOR: [
      Object.values(zones.FLOORPLAN_ZONES),
      Object.values(zones.ALL_ZONES).filter((z) => z.floor === 1),
    ],
  };
});

vi.mock('./gamify/GamifyMirror', () => ({
  default: ({ children }) => <div data-testid="gamify-mirror">{children}</div>,
}));

vi.mock('./gamify/GamifyTvProjector', () => ({
  default: () => null,
}));

vi.mock('./gamify/GamifyScene', () => ({
  default: () => <div data-testid="gamify-scene" />,
  WALL_H: 5.5,
}));

vi.mock('./gamify/Avatar3D', () => ({
  default: ({ username }) => <div data-testid={`avatar-${username}`}>{username}</div>,
}));

describe('Gamify Mode End-to-End Test Suite', () => {
  const mockUserList = [
    { socketId: 'user-1', username: 'Alex', isHost: true, avatarPath: 'cat' },
    { socketId: 'user-2', username: 'Sam', isHost: false, avatarPath: 'dog' },
  ];
  const mockAvatarPositions = {
    'user-1': { x: 0, y: 0, zone: 'hall' },
    'user-2': { x: 10, y: 10, zone: 'kitchen' },
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
      if (type === '2d') {
        return {
          createRadialGradient: () => ({ addColorStop: vi.fn() }),
          fillRect: vi.fn(),
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          beginPath: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          stroke: vi.fn(),
          fillStyle: '',
          strokeStyle: '',
        };
      }
      return null;
    });

    global.fetch = vi.fn((url) => {
      const u = String(url);
      if (u.includes('stars.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, name: 'Sirius', bsc: 2491, con: 'CMa', mag: -1.46, bv: 0.0, ra: 101.287, dec: -16.716 },
            { id: 2, name: 'Canopus', bsc: 2326, con: 'Car', mag: -0.74, bv: 0.15, ra: 95.988, dec: -52.696 },
            { id: 3, name: 'Vega', bsc: 7001, con: 'Lyr', mag: 0.03, bv: 0.0, ra: 279.234, dec: 38.784 },
          ]),
        });
      }
      if (u.includes('constellations.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'ORI', name: 'Orion', eng: 'Hunter', lines: [[101, 102]] },
            { id: 'UMA', name: 'Ursa Major', eng: 'Great Bear', lines: [[201, 202]] },
          ]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Entering Gamify Mode & Navigation', () => {
    it('mounts floor plan, shows room header, movement hint, and control buttons', () => {
      render(
        <GamifyFloorPlan
          userList={mockUserList}
          mySocketId="user-1"
          avatarPositions={mockAvatarPositions}
          knownAvatars={{}}
          hostId="user-1"
          onMove={vi.fn()}
          onExitHouse={vi.fn()}
          tvElementRef={{ current: document.createElement('div') }}
          onTvReady={vi.fn()}
        />
      );

      // Living room is the default spawn zone
      const livingRooms = screen.getAllByText('Living Room');
      expect(livingRooms.length).toBeGreaterThan(0);
      expect(screen.getByText('Drag to look around, tap a door to go through')).toBeInTheDocument();

      // Floor buttons & initial stairs button
      expect(screen.getByRole('button', { name: /Go upstairs/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Ground floor$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Upstairs$/i })).toBeInTheDocument();

      // Floating control buttons (Flip, AlwaysDots, ResetView, ZoomIn, ZoomOut)
      expect(screen.getByTitle(/Flip house left\/right/i)).toBeInTheDocument();
      expect(screen.queryByTitle(/Interactive dots/i)).not.toBeInTheDocument();
      expect(screen.getByTitle(/Back to my room/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Zoom in/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Zoom out/i)).toBeInTheDocument();
    });

    it('switches between Ground Floor and Upstairs via stairs button', () => {
      render(
        <GamifyFloorPlan
          userList={mockUserList}
          mySocketId="user-1"
          avatarPositions={mockAvatarPositions}
          knownAvatars={{}}
          hostId="user-1"
          onMove={vi.fn()}
          onExitHouse={vi.fn()}
          tvElementRef={{ current: document.createElement('div') }}
          onTvReady={vi.fn()}
        />
      );

      const stairsBtn = screen.getByRole('button', { name: /Go upstairs/i });
      expect(stairsBtn).toBeInTheDocument();

      // Click to go upstairs
      fireEvent.click(stairsBtn);

      // Upstairs button text changes to "Go downstairs"
      expect(screen.getByRole('button', { name: /Go downstairs/i })).toBeInTheDocument();

      // Upstairs room buttons become visible on room map
      expect(screen.getByTitle(/Go to Master Bedroom/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Go to Balcony/i)).toBeInTheDocument();

      // Click to go back downstairs
      fireEvent.click(screen.getByRole('button', { name: /Go downstairs/i }));
      expect(screen.getByRole('button', { name: /Go upstairs/i })).toBeInTheDocument();
    });

    it('navigates to different rooms using the room map', () => {
      render(
        <GamifyFloorPlan
          userList={mockUserList}
          mySocketId="user-1"
          avatarPositions={mockAvatarPositions}
          knownAvatars={{}}
          hostId="user-1"
          onMove={vi.fn()}
          onExitHouse={vi.fn()}
          tvElementRef={{ current: document.createElement('div') }}
          onTvReady={vi.fn()}
        />
      );

      // Click Kitchen in room map
      const kitchenBtn = screen.getByTitle(/Go to Kitchen/i);
      fireEvent.click(kitchenBtn);

      // Header updates to focus on Kitchen
      const kitchens = screen.getAllByText('Kitchen');
      expect(kitchens.length).toBeGreaterThan(0);
    });
  });

  describe('Opening each Prop Viewer & Balcony Telescope', () => {
    it('opens and closes Bookshelf viewer with book reading capability', () => {
      const handleClose = vi.fn();
      render(
        <PropViewer kind="books" arg="hall" onClose={handleClose} />
      );

      // Bookshelf renders title
      expect(screen.getByText('Living room shelf')).toBeInTheDocument();

      // Books are shown - find Treasure Island
      const bookCard = screen.getByTitle(/Treasure Island/i);
      expect(bookCard).toBeInTheDocument();
      fireEvent.click(bookCard);

      // Reader view opens with book title & back button
      expect(screen.getByRole('button', { name: /Back to shelf/i })).toBeInTheDocument();

      // Click Back to return to shelf
      fireEvent.click(screen.getByRole('button', { name: /Back to shelf/i }));
      expect(screen.getByText('Living room shelf')).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByTitle('Close');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalled();
    });

    it('opens and closes Fridge viewer with self-hosted curated foods', () => {
      const handleClose = vi.fn();
      render(
        <PropViewer kind="fridge" arg="kitchen" onClose={handleClose} />
      );

      expect(screen.getByText(/Fridge Crime Scene Investigation/i)).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByTitle('Close'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('opens and closes Oven viewer with baking items', () => {
      const handleClose = vi.fn();
      render(
        <PropViewer kind="oven" arg="kitchen" onClose={handleClose} />
      );

      expect(screen.getByText('Oven')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Chocolate cake' })).toBeInTheDocument();

      fireEvent.click(screen.getByTitle('Close'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('opens and closes Stove viewer with burner controls', () => {
      const handleClose = vi.fn();
      render(
        <PropViewer kind="stove" arg="kitchen" onClose={handleClose} />
      );

      expect(screen.getByText(/Master Chef Stove/i)).toBeInTheDocument();
      expect(screen.getByText(/Masala chai/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTitle('Close'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('opens and closes Wardrobe viewer with curated realistic clothes', () => {
      const handleClose = vi.fn();
      render(
        <PropViewer kind="wardrobe" arg="wd-a" onClose={handleClose} />
      );

      expect(screen.getByText('Everyday wardrobe')).toBeInTheDocument();
      expect(screen.getByText(/Hover or tap an item/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTitle('Close'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('opens and closes Cosmetics viewer with beauty products', () => {
      const handleClose = vi.fn();
      render(
        <PropViewer kind="cosmetics" arg="master" onClose={handleClose} />
      );

      expect(screen.getByText('Dressing table')).toBeInTheDocument();
      expect(screen.getByText(/Hover or tap an item/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTitle('Close'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('opens and closes Garden viewer with botanical plants', () => {
      const handleClose = vi.fn();
      render(
        <PropViewer kind="garden" arg="front" onClose={handleClose} />
      );

      expect(screen.getByText('Flower garden')).toBeInTheDocument();
      expect(screen.getByText('Rose')).toBeInTheDocument();

      fireEvent.click(screen.getByTitle('Close'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('opens Balcony Telescope and verifies SpaceViewer modes, stars and constellations', async () => {
      const handleClose = vi.fn();
      render(
        <PropViewer kind="telescope" arg="balcony" onClose={handleClose} />
      );

      // Modes: Night sky, Solar system, Milky Way
      const skyTab = await screen.findByRole('button', { name: /^Night sky$/i });
      const solarTab = screen.getByRole('button', { name: /^Solar system$/i });
      const milkyTab = screen.getByRole('button', { name: /^Milky Way$/i });
      expect(skyTab).toBeInTheDocument();
      expect(solarTab).toBeInTheDocument();
      expect(milkyTab).toBeInTheDocument();

      // Check constellations toggle
      const constBtn = screen.getByRole('button', { name: /Constellations/i });
      expect(constBtn).toBeInTheDocument();
      fireEvent.click(constBtn); // toggle constellations

      // Switch to Solar system mode
      fireEvent.click(solarTab);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pause time|Run time/i })).toBeInTheDocument();
      });

      // Switch to Milky Way mode
      fireEvent.click(milkyTab);
      await waitFor(() => {
        expect(screen.getByText(/Galactic centre/i)).toBeInTheDocument();
      });

      // Close telescope
      fireEvent.click(screen.getByTitle('Close'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('closes any active viewer when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(
        <PropViewer kind="fridge" arg="kitchen" onClose={handleClose} />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
