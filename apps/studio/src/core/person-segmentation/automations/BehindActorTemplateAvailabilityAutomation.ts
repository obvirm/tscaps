import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';

/**
 * Keeps `availableTemplates` in step with whether the session can
 * render the text-behind-actor effect.
 *
 * The gallery is read once at startup, before any video is loaded, so
 * without this the opt-in templates would be judged against a session
 * that had nothing to play yet. Re-reads the catalog whenever the
 * answer flips: opt-in templates appear once a proxy is playing and
 * disappear when the original is, including after a generation the
 * user asked for.
 */
export class BehindActorTemplateAvailabilityAutomation {

  private lastSupported: boolean | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly templateRepository: TemplateRepository,
    private readonly supportChecker: BehindActorPreviewSupportChecker,
  ) {}

  start(): void {
    this.store.addEventListener('change', this.onChange);
    this.onChange();
  }

  stop(): void {
    this.store.removeEventListener('change', this.onChange);
  }

  private readonly onChange = (): void => {
    const supported = this.supportChecker.isSupported();
    if (supported === this.lastSupported) return;
    this.lastSupported = supported;
    void this.republishTemplates();
  };

  /**
   * A catalog read that resolves after the answer has flipped again is
   * dropped rather than published late.
   */
  private async republishTemplates(): Promise<void> {
    const supportedAtRead = this.lastSupported;
    const availableTemplates = await this.templateRepository.getAll();
    if (this.lastSupported !== supportedAtRead) return;
    this.store.patch({ availableTemplates });
  }
}
