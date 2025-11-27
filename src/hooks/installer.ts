/**
 * Git Hooks Installer
 *
 * Installs pre-commit hooks for introspection validation
 */

import fs from 'fs';
import path from 'path';

const PRE_COMMIT_HOOK = `#!/bin/bash
# ts-introspect pre-commit hook
# Validates TypeScript files have proper metadata

echo "🔍 Running introspection lint..."

# Get staged TypeScript files
STAGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\\.ts$' | grep -v '\\.d\\.ts$' | grep -v '\\.test\\.ts$' | grep -v '\\.spec\\.ts$')

if [ -z "$STAGED_TS_FILES" ]; then
  echo "No TypeScript files staged, skipping introspection check."
  exit 0
fi

# Check if tsi is available
if command -v tsi &> /dev/null; then
  tsi lint $STAGED_TS_FILES
elif command -v npx &> /dev/null; then
  npx ts-introspect lint $STAGED_TS_FILES
else
  echo "⚠️  ts-introspect not found, skipping check"
  exit 0
fi

LINT_EXIT_CODE=$?

if [ $LINT_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Commit blocked: Introspection validation failed"
  echo "   Fix the issues above or use --no-verify to skip (not recommended)"
  exit 1
fi

echo "✅ Introspection check passed"
exit 0
`;

/**
 * Find the .git directory
 */
function findGitDir(): string | null {
  let dir = process.cwd();

  while (dir !== path.dirname(dir)) {
    const gitDir = path.join(dir, '.git');

    if (fs.existsSync(gitDir)) {
      // Check if it's a directory (normal repo) or file (worktree/submodule)
      const stat = fs.statSync(gitDir);

      if (stat.isDirectory()) {
        return gitDir;
      }

      // If it's a file, read the actual git dir path
      if (stat.isFile()) {
        const content = fs.readFileSync(gitDir, 'utf-8').trim();
        const match = /gitdir:\s*(.+)/.exec(content);
        if (match?.[1]) {
          return path.resolve(dir, match[1]);
        }
      }
    }

    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Install git hooks
 */
export async function installHooks(): Promise<void> {
  const gitDir = findGitDir();

  if (!gitDir) {
    throw new Error('Not a git repository');
  }

  const hooksDir = path.join(gitDir, 'hooks');

  // Create hooks directory if it doesn't exist
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const preCommitPath = path.join(hooksDir, 'pre-commit');

  // Check if pre-commit already exists
  if (fs.existsSync(preCommitPath)) {
    const existing = fs.readFileSync(preCommitPath, 'utf-8');

    // Check if it's our hook
    if (existing.includes('ts-introspect')) {
      // Update with latest version
      fs.writeFileSync(preCommitPath, PRE_COMMIT_HOOK);
      fs.chmodSync(preCommitPath, '755');
      return;
    }

    // Append to existing hook
    const updated = existing + '\n\n' + PRE_COMMIT_HOOK.replace('#!/bin/bash\n', '');
    fs.writeFileSync(preCommitPath, updated);
    fs.chmodSync(preCommitPath, '755');
    return;
  }

  // Create new hook
  fs.writeFileSync(preCommitPath, PRE_COMMIT_HOOK);
  fs.chmodSync(preCommitPath, '755');
}

/**
 * Uninstall git hooks
 */
export async function uninstallHooks(): Promise<void> {
  const gitDir = findGitDir();

  if (!gitDir) {
    throw new Error('Not a git repository');
  }

  const preCommitPath = path.join(gitDir, 'hooks', 'pre-commit');

  if (!fs.existsSync(preCommitPath)) {
    return; // Nothing to uninstall
  }

  const existing = fs.readFileSync(preCommitPath, 'utf-8');

  // Check if it's solely our hook
  if (existing.trim() === PRE_COMMIT_HOOK.trim()) {
    fs.unlinkSync(preCommitPath);
    return;
  }

  // Remove our section from the hook
  if (existing.includes('ts-introspect')) {
    const updated = existing
      .replace(/# ts-introspect pre-commit hook[\s\S]*?exit 0\n?/g, '')
      .trim();

    if (updated.length > 20) {
      fs.writeFileSync(preCommitPath, updated);
    } else {
      fs.unlinkSync(preCommitPath);
    }
  }
}

/**
 * Check if hooks are installed
 */
export async function checkHooksInstalled(): Promise<{ preCommit: boolean }> {
  const gitDir = findGitDir();

  if (!gitDir) {
    return { preCommit: false };
  }

  const preCommitPath = path.join(gitDir, 'hooks', 'pre-commit');

  if (!fs.existsSync(preCommitPath)) {
    return { preCommit: false };
  }

  const content = fs.readFileSync(preCommitPath, 'utf-8');
  return { preCommit: content.includes('ts-introspect') };
}

