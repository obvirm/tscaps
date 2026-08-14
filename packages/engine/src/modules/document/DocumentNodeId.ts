const RANDOM_BYTES = 16;

/**
 * Identifier for a document node, generated so that it is cheap to put
 * in rendered markup.
 *
 * The form is 16 random bytes in base64url — 22 characters carrying 128
 * bits, against the 36 characters and 122 bits of a UUID string, which
 * spends half of every character on a 16-symbol alphabet and four more
 * on separators. Same guarantee, fourteen fewer characters on an
 * attribute the renderer may serialize once per frame per element.
 *
 * base64url rather than base64 is load-bearing: `+` and `/` survive a
 * round through `encodeURIComponent` as `%2B` and `%2F`, which would
 * cost more than the encoding saves, while `-` and `_` pass through
 * untouched.
 *
 * Ids are opaque strings everywhere they are read, so nodes carrying an
 * older form keep working and no stored document needs rewriting.
 */
export class DocumentNodeId {
  static generate(): string {
    const bytes = new Uint8Array(RANDOM_BYTES);
    crypto.getRandomValues(bytes);
    return DocumentNodeId.toBase64Url(bytes);
  }

  private static toBase64Url(bytes: Uint8Array): string {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
