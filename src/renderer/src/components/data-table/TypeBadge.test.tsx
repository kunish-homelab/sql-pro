import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TypeBadge } from './TypeBadge';

describe('typeBadge', () => {
  describe('rendering', () => {
    it('should render numeric type badge', () => {
      render(<TypeBadge type="INTEGER" typeCategory="numeric" />);
      expect(screen.getByText('INTEGER')).toBeDefined();
      expect(screen.getByTitle('Data type: INTEGER')).toBeDefined();
    });

    it('should render text type badge', () => {
      render(<TypeBadge type="VARCHAR" typeCategory="text" />);
      expect(screen.getByText('VARCHAR')).toBeDefined();
    });

    it('should render date type badge', () => {
      render(<TypeBadge type="DATETIME" typeCategory="date" />);
      expect(screen.getByText('DATETIME')).toBeDefined();
    });

    it('should render boolean type badge', () => {
      render(<TypeBadge type="BOOLEAN" typeCategory="boolean" />);
      expect(screen.getByText('BOOLEAN')).toBeDefined();
    });

    it('should render unknown type badge', () => {
      render(<TypeBadge type="CUSTOM" typeCategory="unknown" />);
      expect(screen.getByText('CUSTOM')).toBeDefined();
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <TypeBadge
          type="INTEGER"
          typeCategory="numeric"
          className="custom-class"
        />
      );
      const badge = container.querySelector('.custom-class');
      expect(badge).toBeDefined();
    });

    it('should have correct color classes for numeric type', () => {
      const { container } = render(
        <TypeBadge type="INTEGER" typeCategory="numeric" />
      );
      const badge = container.querySelector('.bg-blue-500\\/10');
      expect(badge).toBeDefined();
    });

    it('should have correct color classes for text type', () => {
      const { container } = render(
        <TypeBadge type="TEXT" typeCategory="text" />
      );
      const badge = container.querySelector('.bg-amber-500\\/10');
      expect(badge).toBeDefined();
    });

    it('should have correct color classes for date type', () => {
      const { container } = render(
        <TypeBadge type="DATE" typeCategory="date" />
      );
      const badge = container.querySelector('.bg-purple-500\\/10');
      expect(badge).toBeDefined();
    });

    it('should have correct color classes for boolean type', () => {
      const { container } = render(
        <TypeBadge type="BOOL" typeCategory="boolean" />
      );
      const badge = container.querySelector('.bg-green-500\\/10');
      expect(badge).toBeDefined();
    });

    it('should have correct color classes for unknown type', () => {
      const { container } = render(
        <TypeBadge type="CUSTOM" typeCategory="unknown" />
      );
      const badge = container.querySelector('.bg-gray-500\\/10');
      expect(badge).toBeDefined();
    });
  });

  describe('accessibility', () => {
    it('should have title attribute for tooltip', () => {
      render(<TypeBadge type="INTEGER" typeCategory="numeric" />);
      const badge = screen.getByTitle('Data type: INTEGER');
      expect(badge).toBeDefined();
    });

    it('should render icon with correct size', () => {
      const { container } = render(
        <TypeBadge type="INTEGER" typeCategory="numeric" />
      );
      const icon = container.querySelector('.h-2\\.5.w-2\\.5');
      expect(icon).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty type string', () => {
      render(<TypeBadge type="" typeCategory="unknown" />);
      expect(screen.getByTitle('Data type: ')).toBeDefined();
    });

    it('should handle long type names', () => {
      const longType = 'VARCHAR(255) NOT NULL DEFAULT';
      render(<TypeBadge type={longType} typeCategory="text" />);
      expect(screen.getByText(longType)).toBeDefined();
    });

    it('should render with mixed case types', () => {
      render(<TypeBadge type="Integer" typeCategory="numeric" />);
      expect(screen.getByText('Integer')).toBeDefined();
    });
  });
});
