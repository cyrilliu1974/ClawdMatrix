// [NEW FILE] src/agents/prompt-engine/types.ts

/**
 * Phase 1: Result of the Requirement Triangulation.
 * This object captures the detected intent and context from user input.
 */
export interface IntentContext {
  /**
   * The target domain detected from input (e.g., 'Finance', 'Occult', 'Coding').
   * This is a dynamic variable derived by the Triangulator.
   */
  domain: string;

  /**
   * The target audience level (e.g., 'Beginner', 'Expert', 'Curious').
   * Nullable if not specified in input.
   */
  userLevel: string | null;

  /**
   * The desired tone for the response (e.g., 'Ruthless', 'Empathetic', 'Professional').
   * Nullable if not specified in input.
   */
  tone: string | null;

  /**
   * Gate status: 
   * 'COMPLETE' if all mandatory fields are present.
   * 'MISSING' if triangulation requires more information.
   */
  status: 'COMPLETE' | 'MISSING';
  
  /**
   * List of fields missing from the user input to trigger Guide Mode.
   */
  missingFields?: ('domain' | 'userLevel' | 'tone')[];

  /**
   * Metadata to track if the intent was caught by rules or LLM inference.
   */
  source?: 'RULE_BASED' | 'LLM_INFERENCE' | 'FALLBACK';
}

/**
 * Structure of a Skill as defined in skills.json
 */
export interface SkillDefinition {
  skill_name: string;
  description: string;
  variants?: SkillVariant[];
  generalized_instruction_template?: string; 
}

export interface SkillVariant {
  variant_name: string;
  generalized_instruction_template: string;
}

/**
 * Top-level structure for the skills database.
 */
export interface SkillLibrary {
  [category: string]: {
    description: string;
    categories?: SkillCategory[];
    skills?: SkillDefinition[];
  }
}

export interface SkillCategory {
  category_name: string;
  category_description: string;
  skills: SkillDefinition[];
}