import { describe, expect, it } from 'vitest';
import { DocumentNodeId } from '@modules/document/DocumentNodeId';

describe('DocumentNodeId', () => {
  it('is 22 characters, where a UUID string is 36', () => {
    expect(DocumentNodeId.generate()).toHaveLength(22);
  });

  it('uses only the base64url alphabet, so no character is padding or separator', () => {
    for (let i = 0; i < 200; i++) {
      expect(DocumentNodeId.generate()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    }
  });

  // The id ends up inside an attribute in markup that is serialized into a
  // `data:` URL. A character that percent-encodes there would cost three
  // bytes for one and give back more than the shorter alphabet saves.
  it('survives encodeURIComponent unchanged', () => {
    for (let i = 0; i < 200; i++) {
      const id = DocumentNodeId.generate();
      expect(encodeURIComponent(id)).toBe(id);
    }
  });

  it('carries the full 128 bits, so every position varies', () => {
    const ids = Array.from({ length: 2000 }, () => DocumentNodeId.generate());
    expect(new Set(ids).size).toBe(ids.length);
    for (let position = 0; position < 21; position++) {
      const distinct = new Set(ids.map((id) => id[position]));
      expect(distinct.size).toBeGreaterThan(16);
    }
  });
});
