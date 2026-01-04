import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn utility function', () => {
  describe('basic class handling', () => {
    it('should return empty string when no arguments provided', () => {
      expect(cn()).toBe('');
    });

    it('should return a single class name as-is', () => {
      expect(cn('foo')).toBe('foo');
    });

    it('should merge multiple class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle undefined and null values', () => {
      expect(cn('foo', undefined, 'bar', null)).toBe('foo bar');
    });

    it('should handle false values', () => {
      expect(cn('foo', false, 'bar')).toBe('foo bar');
    });

    it('should handle empty strings', () => {
      expect(cn('foo', '', 'bar')).toBe('foo bar');
    });
  });

  describe('conditional class handling (objects)', () => {
    it('should include classes when condition is true', () => {
      expect(cn({ foo: true, bar: true })).toBe('foo bar');
    });

    it('should exclude classes when condition is false', () => {
      expect(cn({ foo: true, bar: false })).toBe('foo');
    });

    it('should handle mixed strings and objects', () => {
      expect(cn('base', { conditional: true, hidden: false })).toBe(
        'base conditional'
      );
    });

    it('should handle empty objects', () => {
      expect(cn('foo', {}, 'bar')).toBe('foo bar');
    });
  });

  describe('array handling', () => {
    it('should handle arrays of class names', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('should handle nested arrays', () => {
      expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz');
    });

    it('should handle arrays with conditional values', () => {
      expect(cn(['foo', { bar: true, baz: false }])).toBe('foo bar');
    });

    it('should handle mixed arrays and strings', () => {
      expect(cn('base', ['a', 'b'], 'end')).toBe('base a b end');
    });
  });

  describe('tailwind-merge functionality', () => {
    it('should merge conflicting padding classes', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('should merge conflicting margin classes', () => {
      expect(cn('m-4', 'm-8')).toBe('m-8');
    });

    it('should merge conflicting background colors', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('should merge conflicting text colors', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('should keep non-conflicting classes', () => {
      expect(cn('p-4', 'm-4', 'text-red-500')).toBe('p-4 m-4 text-red-500');
    });

    it('should handle conflicting width classes', () => {
      expect(cn('w-full', 'w-1/2')).toBe('w-1/2');
    });

    it('should handle conflicting height classes', () => {
      expect(cn('h-screen', 'h-full')).toBe('h-full');
    });

    it('should merge conflicting flex classes', () => {
      expect(cn('flex-row', 'flex-col')).toBe('flex-col');
    });

    it('should handle direction-specific padding', () => {
      expect(cn('px-4', 'px-2')).toBe('px-2');
      expect(cn('py-4', 'py-2')).toBe('py-2');
    });

    it('should keep different directional padding', () => {
      expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
    });

    it('should handle hover states correctly', () => {
      expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe(
        'hover:bg-blue-500'
      );
    });

    it('should keep different state modifiers', () => {
      expect(cn('hover:bg-red-500', 'focus:bg-blue-500')).toBe(
        'hover:bg-red-500 focus:bg-blue-500'
      );
    });
  });

  describe('real-world usage patterns', () => {
    it('should handle typical component class pattern', () => {
      const isActive = true;
      const isDisabled = false;
      const result = cn(
        'px-4 py-2 rounded',
        {
          'bg-blue-500 text-white': isActive,
          'bg-gray-200 text-gray-500': isDisabled,
        },
        'font-medium'
      );
      expect(result).toBe(
        'px-4 py-2 rounded bg-blue-500 text-white font-medium'
      );
    });

    it('should handle variant overrides', () => {
      const baseClasses = 'bg-white text-black p-4';
      const variantClasses = 'bg-black text-white';
      expect(cn(baseClasses, variantClasses)).toBe('p-4 bg-black text-white');
    });

    it('should handle className prop override pattern', () => {
      const defaultClasses = 'flex items-center justify-center gap-2';
      const customClasses = 'justify-start gap-4';
      expect(cn(defaultClasses, customClasses)).toBe(
        'flex items-center justify-start gap-4'
      );
    });

    it('should handle responsive classes', () => {
      expect(cn('text-sm', 'md:text-base', 'lg:text-lg')).toBe(
        'text-sm md:text-base lg:text-lg'
      );
    });

    it('should merge responsive overrides', () => {
      expect(cn('md:text-sm', 'md:text-base')).toBe('md:text-base');
    });
  });
});
