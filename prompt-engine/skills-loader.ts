// path: ClawdMatrix/prompt-engine/skills-loader.ts

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SkillCategory, SkillDefinition, SkillLibrary } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_PATH = path.join(__dirname, 'data', 'skills.json');
const MAP_PATH = path.join(__dirname, 'data', 'domain-map.json');

// [NEW] 更新後的介面定義
interface DomainConfig {
  triggers: string[];
  skills: string[];
}

interface DomainMap {
  domains: Record<string, DomainConfig>;
  global_defaults?: string[];
}

export class SkillsLoader {
  private static libraryCache: SkillLibrary | null = null;
  private static mapCache: DomainMap | null = null;

  static async loadLibrary(): Promise<SkillLibrary> {
    if (this.libraryCache) return this.libraryCache;
    try {
      const rawData = await fs.readFile(SKILLS_PATH, 'utf-8');
      this.libraryCache = JSON.parse(rawData) as SkillLibrary;
      return this.libraryCache;
    } catch (error) {
      console.error('[PromptEngine] Failed to load skills library:', error);
      return {};
    }
  }

  static async loadDomainMap(): Promise<DomainMap> {
    if (this.mapCache) return this.mapCache;
    try {
      const rawData = await fs.readFile(MAP_PATH, 'utf-8');
      this.mapCache = JSON.parse(rawData) as DomainMap;
      return this.mapCache;
    } catch (error) {
      console.warn('[PromptEngine] Domain map not found or invalid.', error);
      return { domains: {} };
    }
  }

  // [NEW] 獲取所有領域的觸發規則，供 Triangulator 使用
  static async getDomainTriggers(): Promise<Array<{ domain: string, patterns: string[] }>> {
    const map = await this.loadDomainMap();
    return Object.entries(map.domains).map(([domain, config]) => ({
      domain,
      patterns: config.triggers || []
    }));
  }

  // [UPDATED] 根據新結構獲取技能
  static async getSkillsForDomain(domain: string): Promise<SkillDefinition[]> {
    const library = await this.loadLibrary();
    const map = await this.loadDomainMap();
    const loadedSkills: SkillDefinition[] = [];

    // 1. 查找匹配的領域配置 (Case-insensitive)
    const targetKey = Object.keys(map.domains).find(
      k => k.toLowerCase() === domain.toLowerCase()
    );

    const skillNames = targetKey ? [...map.domains[targetKey].skills] : [];

    // 2. 加入全域預設
    if (map.global_defaults) {
      skillNames.push(...map.global_defaults);
    }

    // 3. 檢索實體
    for (const name of new Set(skillNames)) {
      const skill = this.findSkill(library, name);
      if (skill) {
        loadedSkills.push(skill);
      } else {
        // Silent fail or debug log
      }
    }

    // 4. Fallback if no skills found at all
    if (loadedSkills.length === 0) {
      const generalSkill = this.findSkill(library, 'General_Reasoning');
      if (generalSkill) loadedSkills.push(generalSkill);
    }

    return loadedSkills;
  }

  static findSkill(library: SkillLibrary, skillName: string): SkillDefinition | null {
    for (const key in library) {
      const section = library[key];
      if (section.skills) {
        const found = section.skills.find(s => s.skill_name === skillName);
        if (found) return found;
      }
      if (section.categories) {
        const foundInNested = this.findInCategories(section.categories, skillName);
        if (foundInNested) return foundInNested;
      }
    }
    return null;
  }

  private static findInCategories(categories: SkillCategory[], skillName: string): SkillDefinition | null {
    for (const category of categories) {
      const found = category.skills.find(s => s.skill_name === skillName);
      if (found) return found;
    }
    return null;
  }
}