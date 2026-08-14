import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

/**
 * Flags a control the template declares by hand when its stylesheet
 * already declares the same id.
 *
 * Both declarations reach the editor, so the template ships two
 * sliders writing one custom property, and the hand-written one is
 * free to contradict the catalogued bounds — which is the drift a
 * catalogued control exists to prevent, arriving through the back
 * door. The template keeps whichever declaration it means: the
 * stylesheet's if the primitive should own it, its own if the control
 * is genuinely the template's.
 */
export class RedeclaredControlsTemplateJsonContractRule implements TemplateJsonContractRule {

  check(_templateJson: unknown, context: TemplateContractContext): ContractViolation[] {
    if (context.stylesheetDeclaredControlIds === undefined) return [];
    const fromStylesheet = new Set(context.stylesheetDeclaredControlIds);
    return (context.handDeclaredControlIds ?? [])
      .filter((id) => fromStylesheet.has(id))
      .map((id) => ({
        message: `styleControls declares "${id}", which this template's stylesheet already declares `
          + `through a primitive. Remove one: two declarations ship two controls for one variable.`,
      }));
  }
}
