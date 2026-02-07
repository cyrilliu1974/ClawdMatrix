\# 🌌 ClawdMatrix: Dynamic Prompt Engine for OpenClaw



\*\*ClawdMatrix\*\* is a cognitive architecture upgrade designed for OpenClaw agents. Moving beyond static system prompts, it introduces a five-stage cognitive pipeline—including Requirement Triangulation and Dynamic Skill Injection—to maximize token efficiency and ensure precise skill invocation.



---



\## 🚀 Quick Start



Follow these steps to upgrade your OpenClaw instance with the ClawdMatrix engine:



\### 1. Download the Code



Download or clone the entire `ClawdMatrix` repository into your local OpenClaw source directory.



\### 2. Run the Automated Installation



Execute the installation script from your project root:



```bash

chmod +x install-matrix.sh

./install-matrix.sh



```



\*\*What `install-matrix.sh` does:\*\*



\* \*\*Automatic Backup\*\*: Backs up your existing `system-prompt.ts` to a `.bak` file.

\* \*\*Engine Injection\*\*: Deploys the `prompt-engine/` core components, including the intent triangulator and skill loader, into your system.

\* \*\*Brain Replacement\*\*: Replaces the original system prompt generation logic with the ClawdMatrix dynamic construction engine.



---



\## 🧠 Core Features



\* \*\*🕵️ Intent Triage Protocol\*\*: Automatically identifies simple requests (such as greetings or general knowledge questions) and skips the expensive skill-scanning process. This allows the LLM to respond directly, significantly saving tokens.

\* \*\*🧩 Dynamic Skill Injection\*\*: Intelligently loads only the necessary skill definitions based on the detected domain (e.g., Finance, Coding). This prevents the context window from bloating with irrelevant information.

\* \*\*📐 Form Follows Function\*\*: All responses are governed by strict quality gates and negative constraints, ensuring professional-grade output and consistent performance.



---



\## ⚡ Recommended: Token Optimizer Integration



For peak performance, it is highly recommended to separately install the \*\*\[D4kooo/Openclaw-Token-memory-optimizer](https://github.com/D4kooo/Openclaw-Token-memory-optimizer)\*\*.



\*\*ClawdMatrix features built-in integration for this suite:\*\*



\* \*\*Auto-Detection\*\*: When the engine detects high token usage or system latency, it triggers the `Token\_Memory\_Optimizer\_Router`.

\* \*\*Advisory Guidance\*\*: The agent will proactively suggest optimization workflows (such as Cron Isolation, RAG search, or the Reset Protocol). Once you confirm the skill is installed, the agent will automatically read the corresponding `SKILL.md` to execute the task.



---



\## 🛠️ Technical Architecture



| Component | Description |

| --- | --- |

| \*\*Triangulator\*\* | Analyzes the Domain, User Level, and Tone of the input. |

| \*\*SkillInjector\*\* | Instantiates abstract templates from `skills.json` into executable instructions. |

| \*\*Skills Library\*\* | Contains global high-value core skills like `Intent\_Triage` and `Context\_Audit`. |



---



\## 📄 License



This project is licensed under the MIT License.



---



\*Built with ❤️ for the OpenClaw Ecosystem.\*

