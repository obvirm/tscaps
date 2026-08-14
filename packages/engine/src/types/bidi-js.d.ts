declare module 'bidi-js' {
  export interface EmbeddingLevels {
    readonly levels: Uint8Array;
    readonly paragraphs: ReadonlyArray<{ start: number; end: number; level: number }>;
  }

  export interface Bidi {
    getEmbeddingLevels(text: string, baseDirection?: 'ltr' | 'rtl' | 'auto'): EmbeddingLevels;
    getReorderedIndices(text: string, embeddingLevels: EmbeddingLevels): number[];
    getBidiCharTypeName(char: string): string;
  }

  export default function bidiFactory(): Bidi;
}
