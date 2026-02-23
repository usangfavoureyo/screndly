// ============================================================================
// HAPTICS UTILITY TESTS
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { haptics } from '../../utils/haptics';

describe('Haptics Utility', () => {
  beforeEach(() => {
    // Mock navigator.vibrate
    global.navigator.vibrate = vi.fn();
    localStorage.clear();
  });

  it('should trigger light haptic feedback', () => {
    haptics.light();
    expect(navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it('should trigger medium haptic feedback', () => {
    haptics.medium();
    expect(navigator.vibrate).toHaveBeenCalledWith(20);
  });

  it('should trigger heavy haptic feedback', () => {
    haptics.heavy();
    expect(navigator.vibrate).toHaveBeenCalledWith(30);
  });

  it('should trigger success haptic pattern', () => {
    haptics.success();
    expect(navigator.vibrate).toHaveBeenCalledWith([10, 50, 10]);
  });

  it('should trigger error haptic pattern', () => {
    haptics.error();
    expect(navigator.vibrate).toHaveBeenCalledWith([20, 50, 20, 50, 20]);
  });

  it('should trigger warning haptic pattern', () => {
    haptics.warning();
    expect(navigator.vibrate).toHaveBeenCalledWith([15, 30, 15]);
  });

  it('should not vibrate when haptics are disabled', () => {
    localStorage.setItem('screndly_settings', JSON.stringify({ 
      hapticsEnabled: false 
    }));
    
    haptics.light();
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it('should handle missing vibrate API gracefully', () => {
    delete (global.navigator as any).vibrate;
    
    expect(() => haptics.light()).not.toThrow();
  });
});
