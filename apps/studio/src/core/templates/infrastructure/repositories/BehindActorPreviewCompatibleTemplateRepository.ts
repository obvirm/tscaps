import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';

/**
 * `TemplateRepository` decorator that hides templates depending on
 * person segmentation when the session cannot preview them. Filters
 * `getAll()` only; `getById` keeps answering, because a saved
 * project referencing one is substituted after its preview is
 * published rather than starved here.
 */
export class BehindActorPreviewCompatibleTemplateRepository implements TemplateRepository {

  constructor(
    private readonly inner: TemplateRepository,
    private readonly supportChecker: BehindActorPreviewSupportChecker,
  ) {}

  async getAll(): Promise<Template[]> {
    const all = await this.inner.getAll();
    if (this.supportChecker.isSupported()) return all;
    return all.filter((template) => !template.behindActor.required);
  }

  async getById(id: string): Promise<Template | null> {
    return this.inner.getById(id);
  }
}
