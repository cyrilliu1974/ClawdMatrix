// [NEW FILE] src/agents/prompt-engine/injector.ts

import { IntentContext, SkillDefinition } from './types.js';

/**
 * Defines how Generic variables map to Specific variables based on Domain.
 * This mapping table allows the same skill structure to be reused across different contexts.
 */
const DOMAIN_VARIABLE_MAP: Record<string, Record<string, string>> = {
  'Finance': {
    '{Input_Data}': '$Stock_Price_Feed',
    '{Risk_Factor}': '$Market_Volatility_Index',
    '{Goal}': 'Maximize_Alpha'
  },
  'Occult': {
    '{Input_Data}': '$Card_Symbolism',
    '{Risk_Factor}': '$Karmic_Debt_Level',
    '{Goal}': 'Reveal_Hidden_Truths'
  },
  'Coding': {
    '{Input_Data}': '$Source_Code_AST',
    '{Risk_Factor}': '$Cyclomatic_Complexity',
    '{Goal}': 'Refactor_For_Readability'
  },
  // Default fallback for general conversation
  'General': {
    '{Input_Data}': '$User_Message',
    '{Risk_Factor}': '$Ambiguity_Level',
    '{Goal}': 'Helpful_Answer'
  }
};

export class SkillInjector {

  /**
   * Phase 3: Logic Injection & Contextualization
   * Executes the Skill Instantiation Protocol.
   * * @param skill The raw skill definition from JSON.
   * @param context The intent context derived from the Triangulator.
   * @returns A fully instantiated, executable prompt string for this skill.
   */
  static instantiate(skill: SkillDefinition, context: IntentContext): string {
    // 1. Template Extraction
    // Prefer userLevel specific variant if available (e.g., "Expert" vs "Beginner")
    // otherwise fall back to the base template.
    let template = this.selectTemplateVariant(skill, context.userLevel);

    if (!template) {
      // Fallback: Use description if no template exists (Compatibility Mode)
      // This ensures the system doesn't break if skills.json is missing templates.
      return `### Skill: ${skill.skill_name}\n${skill.description}`;
    }

    // 2. Variable Binding Strategy
    // Determine which variable map to use based on the detected domain.
    const domainKey = DOMAIN_VARIABLE_MAP[context.domain] ? context.domain : 'General';
    const variableMap = DOMAIN_VARIABLE_MAP[domainKey];

    // 3. Rewrite Directives (Regex Replacement)
    // Replace all generic placeholders (e.g. {Input_Data}) with domain-specific vars.
    for (const [generic, specific] of Object.entries(variableMap)) {
      // Escape curly braces for regex safety
      const regex = new RegExp(generic.replace(/\{/g, '\\{').replace(/\}/g, '\\}'), 'g');
      template = template.replace(regex, specific);
    }

    // 4. Inject Dynamic Context (Tone/UserLevel)
    // If the template supports dynamic tone injection, apply it here.
    if (context.tone) {
      template = template.replace(/{Tone}/g, context.tone);
    }

    // 5. Final Assembly formatting
    return `### [Skill: ${skill.skill_name}]\n${template}`;
  }

  /**
   * Helper to select the best variant of a skill based on user level.
   */
  private static selectTemplateVariant(skill: SkillDefinition, userLevel: string | null): string {
    // If no variants defined, use the main generalized template
    if (!skill.variants || skill.variants.length === 0) {
      return skill.generalized_instruction_template || "";
    }

    // Try to match variant name with user level (e.g. find "Expert" variant for "Expert" user)
    if (userLevel) {
      const match = skill.variants.find(v => v.variant_name.toLowerCase().includes(userLevel.toLowerCase()));
      if (match) return match.generalized_instruction_template;
    }

    // Default to the first variant if no specific match found
    return skill.variants[0].generalized_instruction_template;
  }
}