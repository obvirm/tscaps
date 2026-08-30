import { describe, expect, it } from 'vitest';
import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { Template } from '@core/templates/domain/Template';
import { TemplateSubstitutionNotifier } from '@core/templates/domain/TemplateSubstitutionNotifier';
import { Sheet } from '@core/sheets/domain/Sheet';
import { Project } from '@core/projects/domain/Project';
import { BehindActorTemplateSubstituter } from '@core/person-segmentation/services/BehindActorTemplateSubstituter';
import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0,
};

function templateWith(id: string, behindActor: BehindActorTemplateConfig): Template {
  return new Template(
    { id, category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    ALIGNMENT,
    {} as RenderingConfig,
    {} as FeaturesConfig,
    behindActor,
    [],
    [],
    { mode: 'none' } as unknown as LineSplitterConfig,
    [],
    [],
    {} as SvgFilterDefinitions,
    '',
    '',
    [],
  );
}

const PLAIN = templateWith('plain', { required: false, tagCondition: null });
const OTHER_BEHIND_ACTOR = templateWith('also-needs-actor', { required: true, tagCondition: null });
const BEHIND_ACTOR = templateWith('needs-actor', { required: true, tagCondition: null });

class FixedTemplateRepository implements TemplateRepository {
  constructor(private readonly templates: Template[]) {}
  async getAll(): Promise<Template[]> { return this.templates; }
  async getById(id: string): Promise<Template | null> {
    return this.templates.find((template) => template.metadata.id === id) ?? null;
  }
}

function supportChecker(supported: boolean): BehindActorPreviewSupportChecker {
  return { isSupported: () => supported } as BehindActorPreviewSupportChecker;
}

function projectWith(templates: Template[]): Project {
  const sheets = templates.map(
    (template, index) => Sheet.fromTemplate(`sheet-${index}`, `Sheet ${index}`, null, template, 'ltr'),
  );
  const video = { fileName: 'v.mp4', mimeType: 'video/mp4', size: 1, duration: 10 };
  return Project.fromVideo('Project', video).withSheets(sheets);
}

function substituterOver(supported: boolean, catalog: Template[]) {
  const notifier = new TemplateSubstitutionNotifier();
  const notified: string[] = [];
  notifier.subscribe((id) => { notified.push(id); });
  const substituter = new BehindActorTemplateSubstituter(
    supportChecker(supported),
    new FixedTemplateRepository(catalog),
    notifier,
  );
  return { substituter, notified };
}

describe('BehindActorTemplateSubstituter', () => {
  it('leaves the project alone when the session can render the effect', async () => {
    const project = projectWith([BEHIND_ACTOR]);
    const { substituter, notified } = substituterOver(true, [PLAIN, BEHIND_ACTOR]);

    expect(await substituter.substitute(project)).toBe(project);
    expect(notified).toEqual([]);
  });

  it('leaves the project alone when no sheet asks for the effect', async () => {
    const project = projectWith([PLAIN]);
    const { substituter, notified } = substituterOver(false, [PLAIN]);

    expect(await substituter.substitute(project)).toBe(project);
    expect(notified).toEqual([]);
  });

  it('swaps only the sheets that ask for it, and announces each one', async () => {
    const project = projectWith([BEHIND_ACTOR, PLAIN]);
    const { substituter, notified } = substituterOver(false, [PLAIN, BEHIND_ACTOR]);

    const result = await substituter.substitute(project);

    expect(result.sheets.map((sheet) => sheet.template.metadata.id)).toEqual(['plain', 'plain']);
    expect(notified).toEqual(['needs-actor']);
  });

  // The catalog's first entry is itself an opt-in template here: taking
  // it would leave the sheet as unrenderable as it started.
  it('never replaces a behind-actor template with another one', async () => {
    const project = projectWith([BEHIND_ACTOR]);
    const { substituter } = substituterOver(false, [OTHER_BEHIND_ACTOR, PLAIN]);

    const result = await substituter.substitute(project);

    expect(result.sheets[0]!.template.metadata.id).toBe('plain');
  });

  it('raises when the catalog offers nothing renderable to fall back on', async () => {
    const project = projectWith([BEHIND_ACTOR]);
    const { substituter } = substituterOver(false, [OTHER_BEHIND_ACTOR]);

    await expect(substituter.substitute(project)).rejects.toThrow();
  });
});
