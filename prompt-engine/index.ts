/**
 * Prompt Engine Public API
 * Exports the core engine and shared types.
 */

// Export Types for consumers
export * from './types.js';

// Export the Core Engine aliased as PromptEngine (Facade Pattern)
export { ClawdMatrix as PromptEngine } from './clawd-matrix.js';