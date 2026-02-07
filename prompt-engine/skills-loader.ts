// [NEW FILE] src/agents/prompt-engine/skills-loader.ts

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SkillCategory, SkillDefinition, SkillLibrary } from './types.js';

// Path to the skills database provided by the user
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_PATH = path.join(__dirname, 'data', 'skills.json');

export class SkillsLoader {
  private static cache: SkillLibrary | null = null;

  /**
   * Loads the skills.json file and caches it in memory.
   * Performs basic JSON structure validation.
   */
  static async loadLibrary(): Promise<SkillLibrary> {
    if (this.cache) return this.cache;

    try {
      const rawData = await fs.readFile(SKILLS_PATH, 'utf-8');
      this.cache = JSON.parse(rawData) as SkillLibrary;
      return this.cache;
    } catch (error) {
      console.error('[PromptEngine] Failed to load skills library:', error);
      return {};
    }
  }

  /**
   * Deep search for a skill by its name across all categories and sub-categories.
   */
  static findSkill(library: SkillLibrary, skillName: string): SkillDefinition | null {
    for (const key in library) {
      const section = library[key];

      // Check top-level skills in section
      if (section.skills) {
        const found = section.skills.find(s => s.skill_name === skillName);
        if (found) return found;
      }

      // Check nested categories
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