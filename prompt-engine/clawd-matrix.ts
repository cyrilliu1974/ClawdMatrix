// path: ClawdMatrix/prompt-engine/clawd-matrix.ts

import { SkillInjector } from './injector.js';
import { SkillsLoader } from './skills-loader.js';
import { Triangulator } from './triangulator.js';
import { IntentContext, SkillDefinition } from './types.js';

export class ClawdMatrix {
  private static instance: ClawdMatrix;

  private constructor() { }

  public static getInstance(): ClawdMatrix {
    if (!ClawdMatrix.instance) {
      ClawdMatrix.instance = new ClawdMatrix();
    }
    return ClawdMatrix.instance;
  }

  public static async build(query: string, context: IntentContext): Promise<string> {
    return this.getInstance().process(query, context);
  }

  private async process(query: string, context: IntentContext): Promise<string> {
    // 1. Layer 1 & 2 Routing (Fast Path -> Semantic)
    const routingResult = await Triangulator.analyze(query);

    // 2. Load relevant skills based on detected domain using External Mapping
    // [OPTIMIZED] 這裡只有一行代碼，實現了完全解耦
    const skills = await SkillsLoader.getSkillsForDomain(routingResult.domain);

    // *註：Triage Protocol 等核心技能如果已在 domain-map.json 的 "global_defaults" 定義，
    // 這裡甚至不需要手動 push，但為了保險起見，可以保留硬性要求的核心技能檢查，
    // 或者完全信任 JSON 配置（建議完全信任 JSON 以達到最大靈活度）。

    // 3. Dynamic Skill Injection
    const activeSkills = skills.map(skill =>
      SkillInjector.instantiate(skill, context)
    ).join('\n\n');

    // 5. Final Prompt Assembly
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