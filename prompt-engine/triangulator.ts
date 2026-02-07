// path: ClawdMatrix/prompt-engine/triangulator.ts

import { IntentContext } from './types.js';
import { SkillsLoader } from './skills-loader.js';

export interface IDomainClassifier {
  classify(input: string): Promise<Partial<IntentContext>>;
}

export class Triangulator {

  /**
   * [NEW] 動態生成規則緩存
   */
  private static cachedRules: Array<{ domain: string, regex: RegExp }> | null = null;

  /**
   * [NEW] 初始化或獲取規則
   * 將 JSON 中的關鍵字陣列轉換為高效的正則表達式
   */
  private static async getRules() {
    if (this.cachedRules) return this.cachedRules;

    const domainTriggers = await SkillsLoader.getDomainTriggers();

    this.cachedRules = domainTriggers.map(dt => {
      // 自動轉義正則特殊字符並用 | 連接
      const patternString = dt.patterns
        .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

      // 生成邊界匹配的正則: /\b(word1|word2)\b/i
      return {
        domain: dt.domain,
        regex: new RegExp(`\\b(${patternString})\\b`, 'i')
      };
    });

    // 加入一個 General 的預設規則 (如果 JSON 沒定義)
    this.cachedRules.push({
      domain: 'General',
      regex: /^(hi|hello|hey|hola|greetings|help|start)$/i
    });

    return this.cachedRules;
  }

  static async analyze(input: string, classifier?: IDomainClassifier): Promise<IntentContext> {
    // 1. Layer 1: Rule-Based Fast Path (Dynamic)
    const rules = await this.getRules();

    for (const rule of rules) {
      if (rule.regex.test(input)) {
        return this.createContext(rule.domain, 'COMPLETE', 'RULE_BASED');
      }
    }

    // 2. Layer 2: LLM Inference (Semantic)
    if (classifier) {
      try {
        const llmResult = await classifier.classify(input);
        const domain = llmResult.domain || 'General';
        const status = this.evaluateCompleteness(llmResult) ? 'COMPLETE' : 'MISSING';

        return {
          domain,
          userLevel: llmResult.userLevel || null,
          tone: llmResult.tone || null,
          status,
          missingFields: status === 'MISSING' ? this.findMissingFields(llmResult) : [],
          source: 'LLM_INFERENCE'
        };

      } catch (error) {
        console.warn('[Triangulator] LLM classification failed, falling back.', error);
      }
    }

    return this.createContext('General', 'COMPLETE', 'FALLBACK');
  }

  private static createContext(
    domain: string,
    status: 'COMPLETE' | 'MISSING',
    source: 'RULE_BASED' | 'LLM_INFERENCE' | 'FALLBACK'
  ): IntentContext {
    return {
      domain,
      status,
      source,
      userLevel: null,
      tone: null,
      missingFields: []
    };
  }

  private static evaluateCompleteness(result: Partial<IntentContext>): boolean {
    return !!result.domain;
  }

  private static findMissingFields(result: Partial<IntentContext>): ('domain' | 'userLevel' | 'tone')[] {
    const missing: ('domain' | 'userLevel' | 'tone')[] = [];
    if (!result.domain) missing.push('domain');
    return missing;
  }

  static generateClarification(missingFields: ('domain' | 'userLevel' | 'tone')[]): string {
    return `Could you please provide more details about ${missingFields.join(', ')}?`;
  }
}