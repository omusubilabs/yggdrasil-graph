/**
 * Minimal ambient types for fontkit.
 *
 * The package ships no usable declarations and there is no @types entry, but
 * check-glyphs.ts only needs two things from it: open a file, and read its
 * character map. Declaring exactly that is preferable to an `any` import, which
 * would silently swallow a typo in the one call this project depends on.
 */
declare module 'fontkit' {
  export interface Font {
    numGlyphs: number;
    /** Every codepoint the font's cmap maps to a glyph. */
    characterSet: number[];
    hasGlyphForCodePoint(codePoint: number): boolean;
  }
  export function open(path: string): Promise<Font>;
  export function openSync(path: string): Font;
}
