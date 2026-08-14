export class Tag {
  constructor(readonly name: string) {}

  equals(other: Tag): boolean {
    return this.name === other.name;
  }

  toCssClass(): string {
    return this.name;
  }

  static of(name: string): Tag {
    return new Tag(name);
  }
}
