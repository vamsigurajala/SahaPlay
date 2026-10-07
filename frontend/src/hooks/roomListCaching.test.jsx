import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { usePinnedRooms } from './usePinnedRooms';
import { useRoomHistory } from './useRoomHistory';

// Pinned Rooms / Room History used to start empty behind a skeleton on every
// visit, flash that skeleton again on every app resume (focus), and wipe the
// list entirely when a refresh failed. These pin the replacement behavior:
// the last good list paints instantly, a background refresh never blanks it,
// and a failed refresh keeps it.
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const room = (id) => ({ id, name: `Room ${id}`, thumbnailPath: null, category: 'movies', userCount: 0 });

function jsonResponse(data, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(data) });
}

describe('usePinnedRooms — cached list + quiet refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('watch_token', 'tok');
    localStorage.setItem('pinned_rooms', JSON.stringify(['a', 'b']));
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  test('paints the cached rooms immediately and never shows the loading skeleton', async () => {
    localStorage.setItem('pinned_rooms_cache', JSON.stringify([room('a'), room('b')]));
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse([room('a'), room('b')])));

    const { result } = renderHook(() => usePinnedRooms());
    // First render, before any network response: data already there, no skeleton.
    expect(result.current.pinnedRooms.map(r => r.id)).toEqual(['a', 'b']);
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current.isLoading).toBe(false);
  });

  test('ignores cached rooms that are no longer in the pinned id list', () => {
    localStorage.setItem('pinned_rooms', JSON.stringify(['a']));
    localStorage.setItem('pinned_rooms_cache', JSON.stringify([room('a'), room('b')]));
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse([room('a')])));

    const { result } = renderHook(() => usePinnedRooms());
    expect(result.current.pinnedRooms.map(r => r.id)).toEqual(['a']);
  });

  test('with nothing cached it still shows the skeleton while the first fetch is in flight', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse([room('a'), room('b')])));
    const { result } = renderHook(() => usePinnedRooms());
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    await waitFor(() => expect(result.current.pinnedRooms.length).toBe(2));
    expect(result.current.isLoading).toBe(false);
    // ...and the result is remembered for next time.
    expect(JSON.parse(localStorage.getItem('pinned_rooms_cache')).map(r => r.id)).toEqual(['a', 'b']);
  });

  test('a refresh on app focus does not flash the skeleton over an existing list', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse([room('a'), room('b')])));
    const { result } = renderHook(() => usePinnedRooms());
    await waitFor(() => expect(result.current.pinnedRooms.length).toBe(2));

    let sawLoading = false;
    fetch.mockImplementation(() => { sawLoading = sawLoading || result.current.isLoading; return jsonResponse([room('a'), room('b')]); });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(sawLoading).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.pinnedRooms.length).toBe(2);
  });
});

describe('useRoomHistory — cached list + quiet refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('watch_token', 'tok');
    localStorage.setItem('watch_username', 'Krish');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  test('paints cached history immediately, per user, with no skeleton', async () => {
    localStorage.setItem('room_history_cache_krish', JSON.stringify([room('x'), room('y')]));
    localStorage.setItem('room_history_cache_someoneelse', JSON.stringify([room('z')]));
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse([room('x'), room('y')])));

    const { result } = renderHook(() => useRoomHistory());
    expect(result.current.roomHistory.map(r => r.id)).toEqual(['x', 'y']);
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  test('a failed refresh keeps the list instead of wiping it', async () => {
    localStorage.setItem('room_history_cache_krish', JSON.stringify([room('x')]));
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse([], false)));

    const { result } = renderHook(() => useRoomHistory());
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.roomHistory.map(r => r.id)).toEqual(['x']);
  });

  test('a network error keeps the list too', async () => {
    localStorage.setItem('room_history_cache_krish', JSON.stringify([room('x')]));
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));

    const { result } = renderHook(() => useRoomHistory());
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.roomHistory.map(r => r.id)).toEqual(['x']);
  });

  test('a successful refresh replaces the list and updates the cache', async () => {
    localStorage.setItem('room_history_cache_krish', JSON.stringify([room('x')]));
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse([room('x'), room('n')])));

    const { result } = renderHook(() => useRoomHistory());
    await waitFor(() => expect(result.current.roomHistory.length).toBe(2));
    expect(JSON.parse(localStorage.getItem('room_history_cache_krish')).map(r => r.id)).toEqual(['x', 'n']);
  });

  test('guests never get a cached list', () => {
    localStorage.setItem('watch_is_guest', 'true');
    localStorage.setItem('room_history_cache_krish', JSON.stringify([room('x')]));
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse([])));
    const { result } = renderHook(() => useRoomHistory());
    expect(result.current.roomHistory).toEqual([]);
  });
});
