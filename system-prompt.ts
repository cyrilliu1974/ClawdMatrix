
import type { ReasoningLevel, ThinkLevel } from "../auto-reply/thinking.js";
import { SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { listDeliverableMessageChannels } from "../utils/message-channel.js";
import type { ResolvedTimeFormat } from "./date-time.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";

// [NEW] Prompt Engine Imports
import { SkillsLoader } from './prompt-engine/skills-loader.js';
import { Triangulator } from './prompt-engine/triangulator.js';
import { SkillInjector } from './prompt-engine/injector.js';
import { SYSTEM_DIRECTIVES } from './prompt-engine/system-directives.js';
import { IntentContext, SkillDefinition } from './prompt-engine/types.js';

/**
 * Controls which hardcoded sections are included in the system prompt.
 * - "full": All sections (default, for main agent)
 * - "minimal": Reduced sections (Tooling, Workspace, Runtime) - used for subagents
 * - "none": Just basic identity line, no sections
 */
export type PromptMode = "full" | "minimal" | "none";

// system-prompt.ts
function buildSkillsSection(params: {
  skillsPrompt?: string;
  isMinimal: boolean;
  readToolName: string;
  context?: IntentContext;
}) {
  if (params.isMinimal) return [];
  const trimmed = params.skillsPrompt?.trim();
  if (!trimmed) return [];

  const isSimpleRequest = params.context?.status === 'COMPLETE';
  const scanDirective = isSimpleRequest
    ? "Optimization: This request appears straightforward. Execute [Protocol: Intent_Triage] to decide if direct response is sufficient."
    : "Before replying: scan <available_skills> <description> entries to find a matching procedural SKILL.md.";

  return [
    "## Skills (mandatory)",
    scanDirective,
    `- If exactly one skill clearly applies: read its SKILL.md at <location> with \`${params.readToolName}\`, then follow it.`,
    "- If multiple could apply: choose the most specific one, then read/follow it.",
    "- If none clearly apply: do not read any SKILL.md.",
    trimmed,
    "",
  ];
}

function buildMemorySection(params: { isMinimal: boolean; availableTools: Set<string> }) {
  if (params.isMinimal) return [];
  if (!params.availableTools.has("memory_search") && !params.availableTools.has("memory_get")) {
    return [];
  }
  return [
    "## Memory Recall",
    "Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search on MEMORY.md + memory/*.md; then use memory_get to pull only the needed lines. If low confidence after search, say you checked.",
    "",
  ];
}

function buildUserIdentitySection(ownerLine: string | undefined, isMinimal: boolean) {
  if (!ownerLine || isMinimal) return [];
  return ["## User Identity", ownerLine, ""];
}

function buildTimeSection(params: { userTimezone?: string }) {
  if (!params.userTimezone) return [];
  return ["## Current Date & Time", `Time zone: ${params.userTimezone}`, ""];
}

function buildReplyTagsSection(isMinimal: boolean) {
  if (isMinimal) return [];
  return [
    "## Reply Tags",
    "To request a native reply/quote on supported surfaces, include one tag in your reply:",
    "- [[reply_to_current]] replies to the triggering message.",
    "- [[reply_to:<id>]] replies to a specific message id when you have it.",
    "Whitespace inside the tag is allowed (e.g. [[ reply_to_current ]] / [[ reply_to: 123 ]]).",
    "Tags are stripped before sending; support depends on the current channel config.",
    "",
  ];
}

function buildMessagingSection(params: {
  isMinimal: boolean;
  availableTools: Set<string>;
  messageChannelOptions: string;
  inlineButtonsEnabled: boolean;
  runtimeChannel?: string;
  messageToolHints?: string[];
}) {
  if (params.isMinimal) return [];
  return [
    "## Messaging",
    "- Reply in current session → automatically routes to the source channel (Signal, Telegram, etc.)",
    "- Cross-session messaging → use sessions_send(sessionKey, message)",
    "- Never use exec/curl for provider messaging; Clawdbot handles all routing internally.",
    params.availableTools.has("message")
      ? [
        "",
        "### message tool",
        "- Use `message` for proactive sends + channel actions (polls, reactions, etc.).",
        "- For `action=send`, include `to` and `message`.",
        `- If multiple channels are configured, pass \`channel\` (${params.messageChannelOptions}).`,
        `- If you use \`message\` (\`action=send\`) to deliver your user-visible reply, respond with ONLY: ${SILENT_REPLY_TOKEN} (avoid duplicate replies).`,
        params.inlineButtonsEnabled
          ? "- Inline buttons supported. Use `action=send` with `buttons=[[{text,callback_data}]]` (callback_data routes back as a user message)."
          : params.runtimeChannel
            ? `- Inline buttons not enabled for ${params.runtimeChannel}. If you need them, ask to set ${params.runtimeChannel}.capabilities.inlineButtons ("dm"|"group"|"all"|"allowlist").`
            : "",
        ...(params.messageToolHints ?? []),
      ]
        .filter(Boolean)
        .join("\n")
      : "",
    "",
  ];
}

function buildVoiceSection(params: { isMinimal: boolean; ttsHint?: string }) {
  if (params.isMinimal) return [];
  const hint = params.ttsHint?.trim();
  if (!hint) return [];
  return ["## Voice (TTS)", hint, ""];
}

function buildDocsSection(params: { docsPath?: string; isMinimal: boolean; readToolName: string }) {
  const docsPath = params.docsPath?.trim();
  if (!docsPath || params.isMinimal) return [];
  return [
    "## Documentation",
    `Clawdbot docs: ${docsPath}`,
    "Mirror: https://docs.clawd.bot",
    "Source: https://github.com/clawdbot/clawdbot",
    "Community: https://discord.com/invite/clawd",
    "Find new skills: https://clawdhub.com",
    "For Clawdbot behavior, commands, config, or architecture: consult local docs first.",
    "When diagnosing issues, run `clawdbot status` yourself when possible; only ask the user if you lack access (e.g., sandboxed).",
    "",
  ];
}


/**
 * Constructs the Matrix-injected prompt sections.
 */
function buildMatrixSection(context: IntentContext, skillBody: string): string[] {
  return [
    `# System Prompt: ${SYSTEM_DIRECTIVES.PERSONA.ROLE}`,
    "",
    "## 1. Role & Identity",
    `* **Role**: Acting as a specialist in ${context.domain}.`,
    `* **Tone**: ${context.tone || 'Professional and Adaptive'}.`,
    `* **Core Philosophy**: ${SYSTEM_DIRECTIVES.PERSONA.CORE_PHILOSOPHY}`,
    "",
    "## 2. Constraints & Quality Gates",
    ...SYSTEM_DIRECTIVES.QUALITY_GATES.NEGATIVE_CONSTRAINTS.map(c => `- ${c}`),
    "",
    "## 3. Active Skills Library",
    "The following skills have been instantiated for this specific session:",
    "",
    skillBody,
    "",
    "## 4. Execution Workflow",
    "1. Analyze the user's request using [Skill: Requirement_Triangulation].",
    "2. Execute domain-specific logic found in the Active Skills Library.",
    "3. Verify output against Constraints before responding.",
    ""
  ];
}

/**
 * Main System Prompt Builder
 * Merges Legacy Infrastructure with New Prompt Engine Logic
 */
export async function buildAgentSystemPrompt(params: {
  workspaceDir: string;
  defaultThinkLevel?: ThinkLevel;
  reasoningLevel?: ReasoningLevel;
  extraSystemPrompt?: string;
  ownerNumbers?: string[];
  reasoningTagHint?: boolean;
  toolNames?: string[];
  toolSummaries?: Record<string, string>;
  modelAliasLines?: string[];
  userTimezone?: string;
  userTime?: string;
  userTimeFormat?: ResolvedTimeFormat;
  contextFiles?: EmbeddedContextFile[];
  skillsPrompt?: string;
  heartbeatPrompt?: string;
  docsPath?: string;
  workspaceNotes?: string[];
  ttsHint?: string;
  /** Controls which hardcoded sections to include. Defaults to "full". */
  promptMode?: PromptMode;
  runtimeInfo?: {
    agentId?: string;
    host?: string;
    os?: string;
    arch?: string;
    node?: string;
    model?: string;
    defaultModel?: string;
    channel?: string;
    capabilities?: string[];
    repoRoot?: string;
  };
  messageToolHints?: string[];
  sandboxInfo?: {
    enabled: boolean;
    workspaceDir?: string;
    workspaceAccess?: "none" | "ro" | "rw";
    agentWorkspaceMount?: string;
    browserControlUrl?: string;
    browserNoVncUrl?: string;
    hostBrowserAllowed?: boolean;
    allowedControlUrls?: string[];
    allowedControlHosts?: string[];
    allowedControlPorts?: number[];
    elevated?: {
      allowed: boolean;
      defaultLevel: "on" | "off" | "ask" | "full";
    };
  };
  /** Reaction guidance for the agent (for Telegram minimal/extensive modes). */
  reactionGuidance?: {
    level: "minimal" | "extensive";
    channel: string;
  };
  /** [NEW] The raw user prompt for triangulation analysis */
  userPrompt?: string;
}): Promise<string> {
  // [NEW] 1. Initialize the Knowledge Base (Data Layer)
  // (library is still loaded for fallback/internal use if needed, but primary routing is via domain-map)
  const library = await SkillsLoader.loadLibrary();

  // [NEW] 2. Phase 1: Input Analysis & Triangulation (Cognitive Layer)
  // Default to general if no user prompt is provided (e.g. heartbeat or first boot before input)
  const userRawText = params.userPrompt || "Hello";
  const context: IntentContext = await Triangulator.analyze(userRawText);

  // [NEW] 3. Phase 2: Skill Selection (Matrix Retrieval) - Now Dynamic
  const selectedSkills = await SkillsLoader.getSkillsForDomain(context.domain);

  // [NEW] 4. Phase 3: Logic Injection (Compiler Layer)
  let instantiatedSkills = selectedSkills.map(skill =>
    SkillInjector.instantiate(skill, context)
  ).join('\n\n');

  // [NEW] Integration: Restore display of user-installed external SKILL.md files
  if (params.skillsPrompt?.trim()) {
    instantiatedSkills += '\n\n### [Library: External Procedural Skills]\n' + params.skillsPrompt.trim();
  }

  // [NEW] Build the Matrix parts
  const matrixLines = buildMatrixSection(context, instantiatedSkills);

  // --- LEGACY CONSTRUCTION BELOW ---

  const coreToolSummaries: Record<string, string> = {
    read: "Read file contents",
    write: "Create or overwrite files",
    edit: "Make precise edits to files",
    apply_patch: "Apply multi-file patches",
    grep: "Search file contents for patterns",
    find: "Find files by glob pattern",
    ls: "List directory contents",
    exec: "Run shell commands (pty available for TTY-required CLIs)",
    process: "Manage background exec sessions",
    web_search: "Search the web (Brave API)",
    web_fetch: "Fetch and extract readable content from a URL",
    // Channel docking: add login tools here when a channel needs interactive linking.
    browser: "Control web browser",
    canvas: "Present/eval/snapshot the Canvas",
    nodes: "List/describe/notify/camera/screen on paired nodes",
    cron: "Manage cron jobs and wake events",
    message: "Send messages and channel actions",
    gateway: "Restart, apply config, or run updates on the running Clawdbot process",
    agents_list: "List agent ids allowed for sessions_spawn",
    sessions_list: "List other sessions (incl. sub-agents) with filters/last",
    sessions_history: "Fetch history for another session/sub-agent",
    sessions_send: "Send a message to another session/sub-agent",
    sessions_spawn: "Spawn a sub-agent session",
    session_status: "Show a /status-equivalent status card",
    image: "Analyze an image with the configured image model",
  };

  const toolOrder = [
    "read",
    "write",
    "edit",
    "apply_patch",
    "grep",
    "find",
    "ls",
    "exec",
    "process",
    "web_search",
    "web_fetch",
    "browser",
    "canvas",
    "nodes",
    "cron",
    "message",
    "gateway",
    "agents_list",
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "session_status",
    "image",
  ];

  const rawToolNames = (params.toolNames ?? []).map((tool) => tool.trim());
  const canonicalToolNames = rawToolNames.filter(Boolean);
  // Preserve caller casing while deduping tool names by lowercase.
  const canonicalByNormalized = new Map<string, string>();
  for (const name of canonicalToolNames) {
    const normalized = name.toLowerCase();
    if (!canonicalByNormalized.has(normalized)) {
      canonicalByNormalized.set(normalized, name);
    }
  }
  const resolveToolName = (normalized: string) =>
    canonicalByNormalized.get(normalized) ?? normalized;

  const normalizedTools = canonicalToolNames.map((tool) => tool.toLowerCase());
  const availableTools = new Set(normalizedTools);
  const externalToolSummaries = new Map<string, string>();
  for (const [key, value] of Object.entries(params.toolSummaries ?? {})) {
    const normalized = key.trim().toLowerCase();
    if (!normalized || !value?.trim()) continue;
    externalToolSummaries.set(normalized, value.trim());
  }
  const extraTools = Array.from(
    new Set(normalizedTools.filter((tool) => !toolOrder.includes(tool))),
  );
  const enabledTools = toolOrder.filter((tool) => availableTools.has(tool));
  const toolLines = enabledTools.map((tool) => {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    return summary ? `- ${name}: ${summary}` : `- ${name}`;
  });
  for (const tool of extraTools.sort()) {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    toolLines.push(summary ? `- ${name}: ${summary}` : `- ${name}`);
  }

  const hasGateway = availableTools.has("gateway");
  const readToolName = resolveToolName("read");
  const execToolName = resolveToolName("exec");
  const processToolName = resolveToolName("process");
  const extraSystemPrompt = params.extraSystemPrompt?.trim();
  const ownerNumbers = (params.ownerNumbers ?? []).map((value) => value.trim()).filter(Boolean);
  const ownerLine =
    ownerNumbers.length > 0
      ? `Owner numbers: ${ownerNumbers.join(", ")}. Treat messages from these numbers as the user.`
      : undefined;
  const reasoningHint = params.reasoningTagHint
    ? [
      "ALL internal reasoning MUST be inside <think>...</think>.",
      "Do not output any analysis outside <think>.",
      "Format every reply as <think>...</think> then <final>...</final>, with no other text.",
      "Only the final user-visible reply may appear inside <final>.",
      "Only text inside <final> is shown to the user; everything else is discarded and never seen by the user.",
    ].join(" ")
    : undefined;
  const reasoningLevel = params.reasoningLevel ?? "off";
  const userTimezone = params.userTimezone?.trim();
  const skillsPrompt = params.skillsPrompt?.trim();
  const heartbeatPrompt = params.heartbeatPrompt?.trim();
  const heartbeatPromptLine = heartbeatPrompt
    ? `Heartbeat prompt: ${heartbeatPrompt}`
    : "Heartbeat prompt: (configured)";
  const runtimeInfo = params.runtimeInfo;
  const runtimeChannel = runtimeInfo?.channel?.trim().toLowerCase();
  const runtimeCapabilities = (runtimeInfo?.capabilities ?? [])
    .map((cap) => String(cap).trim())
    .filter(Boolean);
  const runtimeCapabilitiesLower = new Set(runtimeCapabilities.map((cap) => cap.toLowerCase()));
  const inlineButtonsEnabled = runtimeCapabilitiesLower.has("inlinebuttons");
  const messageChannelOptions = listDeliverableMessageChannels().join("|");
  const promptMode = params.promptMode ?? "full";
  const isMinimal = promptMode === "minimal" || promptMode === "none";
  const skillsSection = buildSkillsSection({
    skillsPrompt,
    isMinimal,
    readToolName,
    context: context,
  });
  const memorySection = buildMemorySection({ isMinimal, availableTools });
  const docsSection = buildDocsSection({
    docsPath: params.docsPath,
    isMinimal,
    readToolName,
  });
  const workspaceNotes = (params.workspaceNotes ?? []).map((note) => note.trim()).filter(Boolean);

  // For "none" mode, return just the basic identity line
  if (promptMode === "none") {
    // If none mode, we might still want the Matrix persona if available, or fallback
    return matrixLines.length > 0
      ? matrixLines.join("\n")
      : "You are a personal assistant.";
  }

  const lines = [
    // [NEW] Use the new Matrix Persona section instead of the hardcoded one
    ...matrixLines,
    "",
    "## Tooling",
    "Tool availability (filtered by policy):",
    "Tool names are case-sensitive. Call tools exactly as listed.",
    toolLines.length > 0
      ? toolLines.join("\n")
      : [
        "Clawdbot lists the standard tools above. This runtime enables:",
        "- grep, find, ls, apply_patch",
        `- ${execToolName}, ${processToolName}`,
        "- browser, canvas, nodes, cron",
        "- sessions_list, sessions_history, sessions_send",
      ].join("\n"),
    "TOOLS.md does not control tool availability; it is user guidance for how to use external tools.",
    "If a task is more complex or takes longer, spawn a sub-agent.",
    "",
    "## Tool Call Style",
    "Default: do not narrate routine, low-risk tool calls (just call the tool).",
    "Narrate only when it helps: multi-step work, complex/challenging problems, sensitive actions.",
    "",
    "## Clawdbot CLI Quick Reference",
    "Clawdbot is controlled via subcommands. Do not invent commands.",
    "- clawdbot gateway status|start|stop|restart",
    "",
    // ...skillsSection, // [NEW] Replacing legacy skills section with active skills library from Matrix
    ...memorySection,
    hasGateway && !isMinimal ? "## Clawdbot Self-Update" : "",
    hasGateway && !isMinimal
      ? [
        "Get Updates (self-update) is ONLY allowed when the user explicitly asks for it.",
        "Actions: config.get, config.schema, config.apply, update.run.",
      ].join("\n")
      : "",
    hasGateway && !isMinimal ? "" : "",
    "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? "## Model Aliases"
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? params.modelAliasLines.join("\n")
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal ? "" : "",
    "## Workspace",
    `Your working directory is: ${params.workspaceDir}`,
    "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
    ...workspaceNotes,
    "",
    ...docsSection,
    params.sandboxInfo?.enabled ? "## Sandbox" : "",
    params.sandboxInfo?.enabled
      ? [
        "You are running in a sandboxed runtime (tools execute in Docker).",
        "Some tools may be unavailable due to sandbox policy.",
        params.sandboxInfo.workspaceDir
          ? `Sandbox workspace: ${params.sandboxInfo.workspaceDir}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
      : "",
    params.sandboxInfo?.enabled ? "" : "",
    ...buildUserIdentitySection(ownerLine, isMinimal),
    ...buildTimeSection({
      userTimezone,
    }),
    "## Explicit Context",
    ...buildReplyTagsSection(isMinimal),
    ...buildMessagingSection({
      isMinimal,
      availableTools,
      messageChannelOptions,
      inlineButtonsEnabled,
      runtimeChannel,
      messageToolHints: params.messageToolHints,
    }),
    ...buildVoiceSection({ isMinimal, ttsHint: params.ttsHint }),
  ];

  if (extraSystemPrompt) {
    const contextHeader =
      promptMode === "minimal" ? "## Subagent Context" : "## Group Chat Context";
    lines.push(contextHeader, extraSystemPrompt, "");
  }
  if (params.reactionGuidance) {
    const { level, channel } = params.reactionGuidance;
    lines.push("## Reactions", level === "minimal" ? "Reaction level: Minimal" : "Reaction level: Extensive", "");
  }
  if (reasoningHint) {
    lines.push("## Reasoning Format", reasoningHint, "");
  }

  const contextFiles = params.contextFiles ?? [];
  if (contextFiles.length > 0) {
    lines.push("# Project Context", "", "The following project context files have been loaded:");

    // 1. 先定義判斷邏輯
    const hasSoulFile = contextFiles.some((file) => {
      const normalizedPath = file.path.trim().replace(/\\/g, "/");
      const baseName = normalizedPath.split("/").pop() ?? normalizedPath;
      return baseName.toLowerCase() === "soul.md";
    });

    // 2. 如果存在，注入指令
    if (hasSoulFile) {
      lines.push(
        "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.",
      );
    }

    // 3. 原有的檔案內容輸出迴圈
    lines.push(""); // 保持間隔
    for (const file of contextFiles) {
      lines.push(`## ${file.path}`, "", file.content, "");
    }
  }

  if (!isMinimal) {
    lines.push(
      "## Silent Replies",
      `When you have nothing to say, respond with ONLY: ${SILENT_REPLY_TOKEN}`,
      ""
    );
  }

  if (!isMinimal) {
    lines.push(
      "## Heartbeats",
      heartbeatPromptLine,
      "If heartbeat poll matches and no attention needed: 'HEARTBEAT_OK'",
      ""
    );
  }

  lines.push(
    "## Runtime",
    buildRuntimeLine(runtimeInfo, runtimeChannel, runtimeCapabilities, params.defaultThinkLevel),
    `Reasoning: ${reasoningLevel}`
  );

  return lines.filter(Boolean).join("\n");
}

/* Re-export buildRuntimeLine as it was exported in .bak */
export function buildRuntimeLine(
  runtimeInfo?: {
    agentId?: string;
    host?: string;
    os?: string;
    arch?: string;
    node?: string;
    model?: string;
    defaultModel?: string;
    repoRoot?: string;
  },
  runtimeChannel?: string,
  runtimeCapabilities: string[] = [],
  defaultThinkLevel?: ThinkLevel,
): string {
  return `Runtime: ${[
    runtimeInfo?.agentId ? `agent=${runtimeInfo.agentId}` : "",
    runtimeInfo?.host ? `host=${runtimeInfo.host}` : "",
    runtimeInfo?.repoRoot ? `repo=${runtimeInfo.repoRoot}` : "",
    runtimeInfo?.os
      ? `os=${runtimeInfo.os}${runtimeInfo?.arch ? ` (${runtimeInfo.arch})` : ""}`
      : runtimeInfo?.arch
        ? `arch=${runtimeInfo.arch}`
        : "",
    runtimeInfo?.node ? `node=${runtimeInfo.node}` : "",
    runtimeInfo?.model ? `model=${runtimeInfo.model}` : "",
    runtimeInfo?.defaultModel ? `default_model=${runtimeInfo.defaultModel}` : "",
    runtimeChannel ? `channel=${runtimeChannel}` : "",
    runtimeChannel
      ? `capabilities=${runtimeCapabilities.length > 0 ? runtimeCapabilities.join(",") : "none"}`
      : "",
    `thinking=${defaultThinkLevel ?? "off"}`,
  ]
    .filter(Boolean)
    .join(" | ")}`;
}