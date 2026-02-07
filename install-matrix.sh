#!/bin/bash
# ClawdMatrix Cognitive Engine - Automated Deployment Script
# Includes automated build detection for immediate activation.

# 1. Define Core Paths
OPENCLAW_SRC="./src/agents"
WORKSPACE_SKILLS="$HOME/.openclaw/workspace/skills"

echo "🔍 Starting ClawdMatrix Cognitive Engine deployment..."

# 2. Backup Original File (Safety First)
if [ -f "$OPENCLAW_SRC/system-prompt.ts" ]; then
    cp "$OPENCLAW_SRC/system-prompt.ts" "$OPENCLAW_SRC/system-prompt.ts.bak"
    echo "✅ Backed up original system-prompt.ts to .bak"
fi

# 3. Inject Engine Components
echo "📦 Injecting Prompt Engine core directory..."
cp -r ./prompt-engine "$OPENCLAW_SRC/" 

echo "🧠 Updating system prompt logic..."
cp ./system-prompt.ts "$OPENCLAW_SRC/system-prompt.ts"

# 4. Automated Build Detection
echo "🔨 Detecting environment build requirements..."
if [ -f "./package.json" ]; then
    # Check if a build script exists
    if grep -q "\"build\":" "package.json"; then
        echo "✨ Build command detected. Running 'npm run build' to activate the engine..."
        if npm run build; then
            echo "✅ Build successful! Engine logic is now instantiated."
        else
            echo "❌ Build failed. Please check for errors and compile manually."
            exit 1
        fi
    else
        echo "⚠️  No build script found in package.json. Please ensure your environment is compiled."
    fi
else
    echo "ℹ️  package.json not found. Skipping automated build phase."
fi

# 5. Optional Integration: Deploy Token Optimizer Skill
# This part is optional but prepared for a seamless experience.
if [ -f "./SKILL.md" ]; then
    echo "🛠️  Optimization skill file detected. Setting up optional integration..."
    mkdir -p "$WORKSPACE_SKILLS/token-optimizer"
    cp ./SKILL.md "$WORKSPACE_SKILLS/token-optimizer/"
    [ -f "./package.json" ] && cp ./package.json "$WORKSPACE_SKILLS/token-optimizer/"
    [ -d "./scripts" ] && cp -r ./scripts "$WORKSPACE_SKILLS/token-optimizer/"
    echo "✅ Optimization skill deployed to $WORKSPACE_SKILLS."
fi

echo "---------------------------------------"
echo "🎉 ClawdMatrix Deployment Complete!"
echo "Please run 'openclaw gateway restart' to enable the new engine."