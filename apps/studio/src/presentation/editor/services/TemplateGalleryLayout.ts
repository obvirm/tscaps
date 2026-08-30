import type { Template } from '@core/templates/domain/Template';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_NAMES,
  type TemplateCategory,
} from '@core/templates/domain/TemplateCategory';

/** Sections that hold templates by where they came from, not by family. */
export type TemplateGallerySectionId = TemplateCategory | 'saved' | 'favorites';

export interface TemplateGallerySectionView {
  readonly id: TemplateGallerySectionId;
  readonly label: string;
  readonly templates: readonly Template[];
}

export interface TemplateGalleryInput {
  readonly builtins: readonly Template[];
  readonly userTemplates: readonly Template[];
  readonly favoriteIds: ReadonlySet<string>;
}

/**
 * Arranges the gallery: which sections exist, in what order, and which
 * templates sit in each. Search is answered separately as one flat list,
 * because a reader who typed a name is no longer browsing families.
 *
 * How a template is previewed is not decided here. It belongs to the
 * template, so favouriting one — which lands it in a second section —
 * cannot change how it is drawn.
 *
 * Sections are built whole. How many of a section's templates fit above
 * its "view all" link is a question about the space it is drawn in, and
 * is answered where that is known.
 */
export class TemplateGalleryLayout {

  /** Sections in display order. Empty ones are dropped. */
  build(input: TemplateGalleryInput): TemplateGallerySectionView[] {
    const sections = [
      ...this.originSections(input),
      ...this.familySections(input),
    ];
    return sections.filter((section) => section.templates.length > 0);
  }

  /**
   * Every template whose name contains `query`, saved ones first and
   * favourites floated inside each half. An empty query returns nothing:
   * the caller shows sections instead.
   */
  search(input: TemplateGalleryInput, query: string): Template[] {
    const needle = query.trim().toLowerCase();
    if (needle === '') return [];
    const matches = (template: Template) => template.metadata.name.toLowerCase().includes(needle);
    return [
      ...this.favoritesFirst(input.userTemplates.filter(matches), input.favoriteIds),
      ...this.favoritesFirst(input.builtins.filter(matches), input.favoriteIds),
    ];
  }

  private originSections(input: TemplateGalleryInput): TemplateGallerySectionView[] {
    const favorites = [...input.userTemplates, ...input.builtins]
      .filter((template) => input.favoriteIds.has(template.metadata.id));
    return [
      { id: 'saved', label: 'Saved', templates: input.userTemplates },
      { id: 'favorites', label: 'Favorites', templates: favorites },
    ];
  }

  private familySections(input: TemplateGalleryInput): TemplateGallerySectionView[] {
    return TEMPLATE_CATEGORY_NAMES.map((category) => ({
      id: category,
      label: TEMPLATE_CATEGORIES[category].label,
      templates: this.favoritesFirst(
        input.builtins.filter((template) => template.metadata.category === category),
        input.favoriteIds,
      ),
    }));
  }

  private favoritesFirst(
    templates: readonly Template[],
    favoriteIds: ReadonlySet<string>,
  ): Template[] {
    // `sort` is stable, so everything that is not a favourite keeps the
    // order it arrived in.
    return [...templates].sort((a, b) => {
      const aRank = favoriteIds.has(a.metadata.id) ? 1 : 0;
      const bRank = favoriteIds.has(b.metadata.id) ? 1 : 0;
      return bRank - aRank;
    });
  }
}
