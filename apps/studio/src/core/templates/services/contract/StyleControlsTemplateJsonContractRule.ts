import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import {
  CONTROL_FIELD_TYPES,
  CONTROL_GROUPS,
  CONTROL_SUBGROUPS_BY_GROUP,
  CONTROL_UNITS,
  type ControlGroup,
} from '@core/templates/domain/definition/ControlField';

const FIELD_TYPES: ReadonlySet<string> = new Set(CONTROL_FIELD_TYPES);
const UNITS: ReadonlySet<string> = new Set(CONTROL_UNITS);
const GROUPS: ReadonlySet<string> = new Set(CONTROL_GROUPS);

/**
 * Fields the concept owns. When the id is catalogued, redeclaring one
 * of these in `template.json` is drift: the entry would say something
 * the catalog already says, or contradict it.
 *
 * `label` and `legend` are deliberately excluded: the concept has a
 * canonical name, but a template that presents the same concept in a
 * different visual role (ivo's second-line "Top text", lena's chat
 * "Bubble radius", kel's "Past word") is telling the user something
 * about that role, not a synonym. The template may override those two
 * strings; nothing else.
 */
const CONCEPT_OWNED_FIELDS: readonly string[] = [
  'type', 'unit', 'group', 'subgroup', 'min', 'max', 'step', 'valueOn', 'valueOff', 'options',
];

/**
 * Checks the `styleControls` array. Each entry needs a unique id and
 * a default. What else it needs depends on whether the id is
 * catalogued: a catalogued entry is shorthand and cannot redeclare any
 * field the concept owns; an uncatalogued entry is the whole field
 * and needs the same shape the runtime does — known type, `options`
 * for `select`, a known `unit` if declared.
 */
export class StyleControlsTemplateJsonContractRule implements TemplateJsonContractRule {

  constructor(private readonly catalog: StyleControlCatalog) {}

  check(templateJson: unknown): ContractViolation[] {
    const controls = this.controlsOf(templateJson);
    if (controls === null) return [];
    const violations: ContractViolation[] = [];
    const seenIds = new Set<string>();
    controls.forEach((control, index) => {
      if (control === null || typeof control !== 'object' || Array.isArray(control)) {
        violations.push({ message: `styleControls[${index}] must be an object.` });
        return;
      }
      this.checkControl(control as Record<string, unknown>, index, seenIds, violations);
    });
    return violations;
  }

  private checkControl(
    control: Record<string, unknown>,
    index: number,
    seenIds: Set<string>,
    violations: ContractViolation[],
  ): void {
    const id = this.checkId(control, index, seenIds, violations);
    this.checkDefault(control, id ?? `styleControls[${index}]`, violations);
    if (id !== null && this.catalog.has(id)) {
      this.checkCataloguedShorthand(control, id, violations);
    } else {
      this.checkFreeFormField(control, id ?? `styleControls[${index}]`, violations);
    }
  }

  private checkId(
    control: Record<string, unknown>,
    index: number,
    seenIds: Set<string>,
    violations: ContractViolation[],
  ): string | null {
    const id = control['id'];
    if (typeof id !== 'string' || id === '') {
      violations.push({ message: `styleControls[${index}] must declare a non-empty string "id".` });
      return null;
    }
    if (seenIds.has(id)) {
      violations.push({ message: `styleControls declares the id "${id}" more than once.` });
      return id;
    }
    seenIds.add(id);
    return id;
  }

  private checkDefault(control: Record<string, unknown>, name: string, violations: ContractViolation[]): void {
    if (control['default'] === undefined) {
      violations.push({ message: `Style control ${this.quoted(name)} must declare a "default".` });
    }
  }

  private checkCataloguedShorthand(
    control: Record<string, unknown>,
    id: string,
    violations: ContractViolation[],
  ): void {
    const conflicting = CONCEPT_OWNED_FIELDS.filter((field) => control[field] !== undefined);
    if (conflicting.length === 0) return;
    const names = conflicting.map((field) => `"${field}"`).join(', ');
    const ownership = conflicting.length === 1 ? 'the concept owns it' : 'the concept owns them';
    violations.push({
      message: `Style control "${id}" is catalogued, so ${names} must not be declared here — ${ownership}. `
        + `Keep only "id" and "default"; a template may also override "label" or "legend" when the concept plays a contextual role.`,
    });
  }

  private checkFreeFormField(control: Record<string, unknown>, name: string, violations: ContractViolation[]): void {
    const type = control['type'];
    if (typeof type !== 'string' || !FIELD_TYPES.has(type)) {
      violations.push({ message: `Style control ${this.quoted(name)} has unknown type "${String(type)}".` });
    }
    if (type === 'select' && !this.hasOptions(control)) {
      violations.push({ message: `Select control ${this.quoted(name)} must declare a non-empty "options" array.` });
    }
    const unit = control['unit'];
    if (unit !== undefined && (typeof unit !== 'string' || !UNITS.has(unit))) {
      violations.push({ message: `Style control ${this.quoted(name)} declares unknown unit "${String(unit)}".` });
    }
    this.checkPlacement(control, name, violations);
  }

  /**
   * The group decides which panel the control shows up in and the
   * subgroup which section of it, so neither is a section of its own
   * when misspelt — the control silently lands somewhere nobody meant.
   * The pair has to come from one row: a style control cannot sit under
   * `words`, and a motion control cannot sit under `colors`.
   */
  private checkPlacement(control: Record<string, unknown>, name: string, violations: ContractViolation[]): void {
    const group = control['group'];
    if (group !== undefined && (typeof group !== 'string' || !GROUPS.has(group))) {
      violations.push({
        message: `Style control ${this.quoted(name)} declares unknown group "${String(group)}". `
          + `Name one of: ${CONTROL_GROUPS.join(', ')}.`,
      });
      return;
    }
    const subgroup = control['subgroup'];
    if (subgroup === undefined) return;
    if (group === undefined) {
      violations.push({
        message: `Style control ${this.quoted(name)} declares a "subgroup" without a "group" to put it under.`,
      });
      return;
    }
    const allowed = CONTROL_SUBGROUPS_BY_GROUP[group as ControlGroup];
    if (typeof subgroup !== 'string' || !allowed.some((known) => known === subgroup)) {
      violations.push({
        message: `Style control ${this.quoted(name)} declares subgroup "${String(subgroup)}", `
          + `which the "${group}" group does not have. Name one of: ${allowed.join(', ')}.`,
      });
    }
  }

  private controlsOf(templateJson: unknown): unknown[] | null {
    if (templateJson === null || typeof templateJson !== 'object') return null;
    const controls = (templateJson as Record<string, unknown>)['styleControls'];
    return Array.isArray(controls) ? controls : null;
  }

  private hasOptions(control: Record<string, unknown>): boolean {
    const options = control['options'];
    return Array.isArray(options) && options.length > 0;
  }

  private quoted(name: string): string {
    return name.startsWith('styleControls[') ? name : `"${name}"`;
  }
}
