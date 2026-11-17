import { describe, it, expect } from 'vitest';
import { PALETTE } from '../src/app/render/palette';
import type { Board, Placement } from '../src/core/types';

describe('P0 Bootstrap sanity checks', () => {
  it('defines the 9 palette tokens strictly per Art Bible', () => {
    expect(PALETTE.void).toBe('#0B0F1C');
    expect(PALETTE.hull).toBe('#141B2F');
    expect(PALETTE.grid).toBe('#26304D');
    expect(PALETTE.chalk).toBe('#EDE6D1');
    expect(PALETTE.dust).toBe('#8C93A8');
    expect(PALETTE.ember).toBe('#FF5A2B');
    expect(PALETTE.solar).toBe('#FFC53D');
    expect(PALETTE.coolant).toBe('#3FD0C0');
    expect(PALETTE.rust).toBe('#A8452D');
    expect(Object.keys(PALETTE)).toHaveLength(9);
  });

  it('can typecheck core interfaces', () => {
    const board: Board = {
      w: 7,
      h: 7,
      cells: new Array(49).fill(null),
      spark: 'CROSS',
      rulesetVersion: 1,
    };
    const placement: Placement = { x: 3, y: 3 };

    expect(board.w).toBe(7);
    expect(board.cells.length).toBe(49);
    expect(placement.x).toBe(3);
  });
});
