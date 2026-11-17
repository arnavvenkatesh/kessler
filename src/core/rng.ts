/**
 * Deterministic 32-bit integer PRNG routines.
 * Pure integer math only: no floats, no Math.random, no Date.
 */

/**
 * 32-bit string hashing using xmur3 algorithm.
 * Returns a generator function that yields successive 32-bit unsigned integer seeds.
 */
export function xmur3(str: string): () => number {
  let h = (1779033703 ^ str.length) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353) >>> 0;
    h = ((h << 13) | (h >>> 19)) >>> 0;
  }

  return function nextSeed(): number {
    h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
  };
}

/**
 * Creates a deterministic 32-bit PRNG generator using mulberry32.
 * Output is pure 32-bit unsigned integers.
 */
export function mulberry32(seed: number): {
  nextUint32: () => number;
  nextInt: (min: number, maxInclusive: number) => number;
} {
  let a = seed >>> 0;

  function nextUint32(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a) >>> 0;
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return (t ^ (t >>> 14)) >>> 0;
  }

  function nextInt(min: number, maxInclusive: number): number {
    const range = (maxInclusive - min + 1) >>> 0;
    if (range <= 1) return min;
    const raw = nextUint32();
    return min + ((raw % range) | 0);
  }

  return { nextUint32, nextInt };
}

/**
 * Convenience helper to hash a string to a single 32-bit unsigned integer.
 */
export function hash32(str: string): number {
  return xmur3(str)();
}
