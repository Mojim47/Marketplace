import { describe, it, expect } from 'vitest';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  breakpoints,
  animation,
  grid,
} from './index';

describe('Design Tokens', () => {
  describe('colors', () => {
    it('should have primary color scale', () => {
      expect(colors.primary).toBeDefined();
      expect(colors.primary[500]).toBe('#2196F3');
      expect(Object.keys(colors.primary)).toHaveLength(10);
    });

    it('should have secondary color scale', () => {
      expect(colors.secondary).toBeDefined();
      expect(colors.secondary[500]).toBe('#E91E63');
    });

    it('should have neutral color scale', () => {
      expect(colors.neutral).toBeDefined();
      expect(colors.neutral[0]).toBe('#FFFFFF');
      expect(colors.neutral[1000]).toBe('#000000');
    });

    it('should have semantic colors', () => {
      expect(colors.success.main).toBe('#4CAF50');
      expect(colors.warning.main).toBe('#FF9800');
      expect(colors.error.main).toBe('#F44336');
      expect(colors.info.main).toBe('#2196F3');
    });

    it('should have contrast colors for accessibility', () => {
      expect(colors.success.contrast).toBe('#FFFFFF');
      expect(colors.warning.contrast).toBe('#000000');
      expect(colors.error.contrast).toBe('#FFFFFF');
    });
  });

  describe('typography', () => {
    it('should have font families including Persian', () => {
      expect(typography.fontFamily.primary).toContain('Inter');
      expect(typography.fontFamily.persian).toContain('Vazirmatn');
    });

    it('should have fluid font sizes with clamp', () => {
      expect(typography.fontSize.base).toContain('clamp');
      expect(typography.fontSize.xl).toContain('clamp');
    });

    it('should have font weights', () => {
      expect(typography.fontWeight.normal).toBe(400);
      expect(typography.fontWeight.bold).toBe(700);
    });

    it('should have line heights', () => {
      expect(typography.lineHeight.normal).toBe(1.5);
      expect(typography.lineHeight.tight).toBe(1.25);
    });
  });

  describe('spacing', () => {
    it('should have spacing scale based on 4px', () => {
      expect(spacing[0]).toBe('0');
      expect(spacing[1]).toBe('0.25rem'); // 4px
      expect(spacing[4]).toBe('1rem'); // 16px
      expect(spacing[8]).toBe('2rem'); // 32px
    });

    it('should have pixel spacing', () => {
      expect(spacing.px).toBe('1px');
    });
  });

  describe('borderRadius', () => {
    it('should have border radius scale', () => {
      expect(borderRadius.none).toBe('0');
      expect(borderRadius.full).toBe('9999px');
      expect(borderRadius.lg).toBe('0.5rem');
    });
  });

  describe('shadows', () => {
    it('should have shadow scale', () => {
      expect(shadows.none).toBe('none');
      expect(shadows.sm).toBeDefined();
      expect(shadows.lg).toBeDefined();
      expect(shadows['2xl']).toBeDefined();
    });

    it('should have colored shadows', () => {
      expect(shadows.primary).toContain('rgb(33 150 243');
      expect(shadows.success).toContain('rgb(76 175 80');
      expect(shadows.error).toContain('rgb(244 67 54');
    });
  });

  describe('zIndex', () => {
    it('should have z-index scale', () => {
      expect(zIndex.base).toBe(0);
      expect(zIndex.modal).toBe(1400);
      expect(zIndex.tooltip).toBe(1800);
      expect(zIndex.toast).toBe(1700);
    });

    it('should have proper stacking order', () => {
      expect(zIndex.dropdown).toBeLessThan(zIndex.modal);
      expect(zIndex.modal).toBeLessThan(zIndex.tooltip);
    });
  });

  describe('breakpoints', () => {
    it('should have mobile-first breakpoints', () => {
      expect(breakpoints.xs).toBe('320px');
      expect(breakpoints.sm).toBe('640px');
      expect(breakpoints.md).toBe('768px');
      expect(breakpoints.lg).toBe('1024px');
      expect(breakpoints.xl).toBe('1280px');
    });
  });

  describe('animation', () => {
    it('should have duration scale', () => {
      expect(animation.duration.fast).toBe('100ms');
      expect(animation.duration.normal).toBe('200ms');
      expect(animation.duration.slow).toBe('300ms');
    });

    it('should have easing functions', () => {
      expect(animation.easing.linear).toBe('linear');
      expect(animation.easing.easeInOut).toContain('cubic-bezier');
      expect(animation.easing.spring).toContain('cubic-bezier');
    });

    it('should have keyframes', () => {
      expect(animation.keyframes.fadeIn).toBeDefined();
      expect(animation.keyframes.slideInUp).toBeDefined();
      expect(animation.keyframes.spin).toBeDefined();
    });
  });

  describe('grid', () => {
    it('should have 12 column grid', () => {
      expect(grid.columns).toBe(12);
    });

    it('should have responsive gutters', () => {
      expect(grid.gutter.xs).toBe(spacing[4]);
      expect(grid.gutter.lg).toBe(spacing[8]);
    });

    it('should have container max-widths', () => {
      expect(grid.container.xl).toBe('1280px');
      expect(grid.container['2xl']).toBe('1536px');
    });
  });
});
