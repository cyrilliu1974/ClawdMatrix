import { SkillInjector } from './injector.js';
import { SkillsLoader } from './skills-loader.js';
import { Triangulator } from './triangulator.js';
import { IntentContext, SkillDefinition } from './types.js';

/**
 * ClawdMatrix: The dynamic prompt builder engine.
 * Orchestrates routing, skill loading, and context injection.
 */
export class ClawdMatrix {
  private static instance: ClawdMatrix;

  private constructor() {
  }

  /**
   * Singleton accessor to ensure consistent state/caching.
   */
  public static getInstance(): ClawdMatrix {
    if (!ClawdMatrix.instance) {
      ClawdMatrix.instance = new ClawdMatrix();
    }
    return ClawdMatrix.instance;
  }

  /**
   * Main pipeline entry point: Builds the final system prompt based on query and context.
   */
  public static async build(query: string, context: IntentContext): Promise<string> {
    return this.getInstance().process(query, context);
  }

  /**
   * Internal processing pipeline.
   */
  private async process(query: string, context: IntentContext): Promise<string> {
    // 1. Layer 1 & 2 Routing (Fast Path -> Semantic)
    const routingResult = await Triangulator.analyze(query);

    // 2. Load relevant skills based on detected domain
    const library = await SkillsLoader.loadLibrary();
    const skills: SkillDefinition[] = [];

    const triageSkill = SkillsLoader.findSkill(library, 'Intent_Triage_Protocol');
    if (triageSkill) {
      skills.push(triageSkill);
    } else {
      const coreSkill = SkillsLoader.findSkill(library, 'Context_Audit_&_Triage');
      if (coreSkill) skills.push(coreSkill);
    }


    if (routingResult.domain === 'Finance') {
      const financeSkill = SkillsLoader.findSkill(library, 'Financial_Risk_&_Deployment');
      if (financeSkill) skills.push(financeSkill);
    } else if (routingResult.domain === 'Coding') {
      const codingSkill = SkillsLoader.findSkill(library, 'Workflow_to_Code_Mapping');
      if (codingSkill) skills.push(codingSkill);
    } else if (routingResult.domain === 'System_Ops') {

      const opsRouter = SkillsLoader.findSkill(library, 'Token_Memory_Optimizer_Router');
      if (opsRouter) skills.push(opsRouter);
    }


    if (skills.length <= 1) {
      const generalSkill = SkillsLoader.findSkill(library, 'General_Reasoning');
      if (generalSkill) skills.push(generalSkill);
    }

    // 5. Dynamic Skill Injection (Binding context to skills)

    const activeSkills = skills.map(skill =>
      SkillInjector.instantiate(skill, context)
    ).join('\n\n');

    // 6. Final Prompt Assembly

    return this.assemblePrompt(routingResult.domain, activeSkills, context);
  }

  private assemblePrompt(domain: string, skillInstructions: string, _context: IntentContext): string {
    return `
# Role
You are Clawd, an AI assistant specialized in ${domain}.

# Active Context
Current Domain: ${domain}

# Enabled Skills
${skillInstructions}
`.trim();
  }
}