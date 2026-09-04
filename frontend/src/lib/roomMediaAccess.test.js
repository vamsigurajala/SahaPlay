import { describe, test, expect } from 'vitest';
import { evaluateRoomMediaAccess } from './roomMediaAccess';

describe('evaluateRoomMediaAccess', () => {
  test('permission "all" lets everyone use the device, host or not', () => {
    expect(evaluateRoomMediaAccess('all', false, 'cam')).toEqual({ canUse: true, reason: '' });
    expect(evaluateRoomMediaAccess('all', true, 'cam')).toEqual({ canUse: true, reason: '' });
  });

  test('permission "none" blocks everyone, including the host', () => {
    const result = evaluateRoomMediaAccess('none', true, 'cam');
    expect(result.canUse).toBe(false);
    expect(result.reason).toBe('Webcam is disabled');
  });

  test('permission "host" lets the effective host through', () => {
    expect(evaluateRoomMediaAccess('host', true, 'cam')).toEqual({ canUse: true, reason: '' });
  });

  test('permission "host" blocks a non-host with the real reason (not a generic "not available")', () => {
    const result = evaluateRoomMediaAccess('host', false, 'cam');
    expect(result.canUse).toBe(false);
    expect(result.reason).toBe('Only the host or admins can use webcam');
  });

  test('mic denial messages use "microphone", not "webcam"', () => {
    expect(evaluateRoomMediaAccess('none', false, 'mic').reason).toBe('Microphone is disabled');
    expect(evaluateRoomMediaAccess('host', false, 'mic').reason).toBe('Only the host or admins can use microphone');
  });

  test('an allowed user always gets an empty reason string', () => {
    expect(evaluateRoomMediaAccess('all', false, 'mic').reason).toBe('');
    expect(evaluateRoomMediaAccess('host', true, 'mic').reason).toBe('');
  });
});
