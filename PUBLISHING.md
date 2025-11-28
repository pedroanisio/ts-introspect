# Publishing Guide

Complete checklist for publishing `ts-introspect` to npm.

---

## Quick Start

```bash
npm run validate           # Automated checklist
npm run release            # Git tag + GitHub release + npm publish
```

---

## Manual Checklist

```
[ ] npm login
[ ] npm run check          # lint + build + test
[ ] npm audit              # security
[ ] npm pack --dry-run     # preview contents
[ ] npm version patch      # bump version + git tag
[ ] git push --tags        # push to GitHub
[ ] gh release create      # create GitHub release
[ ] npm publish --access public
```

---

## 1. Pre-Flight Checks

### Code Quality
- [ ] `npm run lint` — No ESLint errors
- [ ] `npm run build` — TypeScript compiles
- [ ] `npm test` — All tests pass
- [ ] `npm run check` — Full pipeline

### Package.json Required Fields
- [ ] `name` — `ts-introspect`
- [ ] `version` — Valid semver
- [ ] `description` — Package description
- [ ] `license` — `MIT`
- [ ] `exports` — Entry points defined
- [ ] `files` — `["dist", "bin", "templates", "README.md"]`

### Files
- [ ] `LICENSE` exists
- [ ] `README.md` exists
- [ ] `CHANGELOG.md` exists
- [ ] `dist/` is built

### Security
- [ ] `npm audit` — No vulnerabilities
- [ ] `npm pack --dry-run` — No sensitive files

### Git & GitHub (Required Before npm Publish)
- [ ] Working directory is clean (`git status`)
- [ ] On `main` branch
- [ ] Up to date with remote (`git pull`)
- [ ] Version tag exists locally (`git tag -l "v*"`)
- [ ] Tag pushed to GitHub (`git push origin --tags`)
- [ ] GitHub release created (`gh release list`)

---

## 2. Recommended (Optional)

| Item | Status | Notes |
|------|--------|-------|
| `prepublishOnly` script | ✅ | Auto lint+build+test |
| `files` field | ✅ | Controls published files |
| `CHANGELOG.md` | ✅ | Track version changes |
| npm 2FA enabled | ⏳ | Security for publish |
| `np` or `release-it` | ❌ | Automates releases |

---

## 3. Validation Commands

```bash
# Full validation sequence
npm run clean
npm install
npm run check
npm run test:coverage
npm audit
npm pack --dry-run
```

---

## 4. Versioning

We follow [Semantic Versioning](https://semver.org/) (SemVer):

| Version | Format | When to Use |
|---------|--------|-------------|
| **MAJOR** | `X.0.0` | Breaking changes, incompatible API changes |
| **MINOR** | `x.Y.0` | New features, backward compatible |
| **PATCH** | `x.y.Z` | Bug fixes, backward compatible |

### Version Bump Commands

```bash
# Bug fixes (1.0.0 → 1.0.1)
npm version patch

# New features (1.0.0 → 1.1.0)
npm version minor

# Breaking changes (1.0.0 → 2.0.0)
npm version major

# Pre-release versions
npm version prerelease --preid=alpha   # 1.0.0 → 1.0.1-alpha.0
npm version prerelease --preid=beta    # 1.0.0 → 1.0.1-beta.0
npm version prerelease --preid=rc      # 1.0.0 → 1.0.1-rc.0

# Specific version
npm version 2.0.0-beta.1
```

### What `npm version` Does

1. Updates `version` in `package.json`
2. Updates `package-lock.json`
3. Creates a git commit with message `vX.Y.Z`
4. Creates a git tag `vX.Y.Z`

### Version Bump Without Git

```bash
npm version patch --no-git-tag-version
```

---

## 5. Git Tagging

Tags mark specific release points in the repository.

### Create Tags

```bash
# Lightweight tag (just a pointer)
git tag v1.0.0

# Annotated tag (recommended - includes metadata)
git tag -a v1.0.0 -m "Release version 1.0.0"

# Tag a specific commit
git tag -a v1.0.0 -m "Release version 1.0.0" abc1234
```

### Push Tags

```bash
# Push a single tag
git push origin v1.0.0

# Push all tags
git push origin --tags

# Push commits and tags together
git push origin main --tags
```

### List Tags

```bash
# List all tags
git tag

# List tags matching pattern
git tag -l "v1.*"

# Show tag details
git show v1.0.0
```

### Delete Tags

```bash
# Delete local tag
git tag -d v1.0.0

# Delete remote tag
git push origin --delete v1.0.0
```

---

## 6. GitHub Releases

GitHub Releases provide downloadable archives and release notes.

### Create Release via CLI (gh)

```bash
# Install GitHub CLI if needed
# https://cli.github.com/

# Create release from existing tag
gh release create v1.0.0 --title "v1.0.0" --notes "Initial release"

# Create release with auto-generated notes
gh release create v1.0.0 --generate-notes

# Create release from CHANGELOG section
gh release create v1.0.0 --notes-file CHANGELOG.md

# Create draft release (for review before publishing)
gh release create v1.0.0 --draft --generate-notes

# Create pre-release
gh release create v1.0.0-beta.1 --prerelease --generate-notes
```

### Create Release via GitHub UI

1. Go to repository → **Releases** → **Create a new release**
2. Choose or create a tag (e.g., `v1.0.0`)
3. Set release title (e.g., `v1.0.0`)
4. Add release notes (copy from CHANGELOG.md)
5. Check **Set as the latest release**
6. Click **Publish release**

### Release Notes Template

```markdown
## What's New

- Feature 1
- Feature 2

## Bug Fixes

- Fix 1
- Fix 2

## Breaking Changes

- Breaking change 1

## Full Changelog

https://github.com/neo-dom-agent/ts-introspect/compare/v0.9.0...v1.0.0
```

---

## 7. Complete Release Workflow

### Automated Release (Recommended)

The release script handles everything: validation, version bump, git tag, GitHub release, and npm publish.

```bash
# Patch release (1.0.0 → 1.0.1) - bug fixes
npm run release:patch

# Minor release (1.0.0 → 1.1.0) - new features
npm run release:minor

# Major release (1.0.0 → 2.0.0) - breaking changes
npm run release:major

# Or with argument
npm run release -- patch
```

**What the script does:**

1. ✓ Verifies clean working directory
2. ✓ Verifies on `main` branch
3. ✓ Verifies up to date with remote
4. ✓ Runs `npm run validate`
5. ✓ Bumps version (creates git commit + tag)
6. ✓ Pushes commits and tags to GitHub
7. ✓ Creates GitHub release with auto-generated notes
8. ✓ Publishes to npm

**Requirements:**
- GitHub CLI (`gh`) installed and authenticated
- npm logged in (`npm login`)

### Manual Step-by-Step Release

If you prefer manual control:

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Run all checks
npm run validate

# 3. Update CHANGELOG.md with new version section
# Edit CHANGELOG.md manually

# 4. Commit changelog
git add CHANGELOG.md
git commit -m "docs: update changelog for vX.Y.Z"

# 5. Bump version (creates commit + tag)
npm version patch  # or minor/major

# 6. Push commits and tags
git push origin main --tags

# 7. Create GitHub release
gh release create vX.Y.Z --generate-notes

# 8. Publish to npm
npm publish --access public

# 9. Verify publication
npm info ts-introspect
```

### One-Liner Release (After Manual Steps)

```bash
npm run validate && npm version patch && git push origin main --tags && gh release create $(node -p "require('./package.json').version") --generate-notes && npm publish --access public
```

---

## 8. Publish to npm

```bash
# Login (once per machine)
npm login

# Dry run first
npm publish --dry-run

# Publish (public package)
npm publish --access public

# With 2FA
npm publish --access public --otp=123456
```

---

## 9. Post-Publish Verification

```bash
# Check npm registry
npm info ts-introspect

# Test in fresh project
mkdir /tmp/test-ts-introspect && cd /tmp/test-ts-introspect
npm init -y
npm install ts-introspect

# Verify CLI
npx ts-introspect --help
npx tsi --help

# Verify import
node -e "import('ts-introspect').then(m => console.log(Object.keys(m)))"

# Cleanup
cd - && rm -rf /tmp/test-ts-introspect
```

---

## 10. Rollback / Unpublish

### Deprecate a Version

```bash
# Deprecate specific version (users see warning)
npm deprecate ts-introspect@1.0.0 "Critical bug, please upgrade to 1.0.1"

# Remove deprecation
npm deprecate ts-introspect@1.0.0 ""
```

### Unpublish (within 72 hours only)

```bash
# Unpublish specific version
npm unpublish ts-introspect@1.0.0

# Unpublish entire package (use with caution!)
npm unpublish ts-introspect --force
```

> ⚠️ **Warning**: Unpublishing can break dependent projects. Prefer deprecation.

---

## Current Status

| Check | Status |
|-------|--------|
| `name` | ✅ `ts-introspect` |
| `version` | ✅ `1.0.0` |
| `license` | ✅ `MIT` |
| `exports` | ✅ 4 entry points |
| `files` | ✅ Configured |
| `prepublishOnly` | ✅ `clean && lint && build && test` |
| `LICENSE` | ✅ Exists |
| `README.md` | ✅ Exists |
| `CHANGELOG.md` | ✅ Exists |
| `npm audit` | ✅ 0 vulnerabilities |
| Tests | ✅ 147 passing |

**Ready to publish!** ✅

