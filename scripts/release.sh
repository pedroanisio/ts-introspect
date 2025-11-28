#!/bin/bash
#
# Release script for ts-introspect
# Ensures Git tag + GitHub release exist before npm publish
#
# Usage:
#   ./scripts/release.sh [patch|minor|major]
#   npm run release -- patch
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}→${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

header() {
  echo ""
  echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

# ============================================
header "Pre-Release Checks"
# ============================================

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  error "GitHub CLI (gh) is not installed. Install from: https://cli.github.com/"
fi

# Check if logged in to gh
if ! gh auth status &> /dev/null; then
  error "Not logged in to GitHub CLI. Run: gh auth login"
fi

# Check working directory is clean
if [[ -n $(git status --porcelain) ]]; then
  error "Working directory is not clean. Commit or stash changes first."
fi

# Check we're on main branch
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
  error "Not on main branch. Current branch: $BRANCH"
fi

# Ensure we're up to date
info "Fetching latest from origin..."
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [[ "$LOCAL" != "$REMOTE" ]]; then
  error "Local branch is not up to date with origin/main. Run: git pull"
fi

success "Pre-release checks passed"

# ============================================
header "Validation"
# ============================================

info "Running validation..."
npm run validate || error "Validation failed"

success "Validation passed"

# ============================================
header "Version Bump"
# ============================================

# Get version type from argument (default: patch)
VERSION_TYPE=${1:-patch}

if [[ "$VERSION_TYPE" != "patch" && "$VERSION_TYPE" != "minor" && "$VERSION_TYPE" != "major" ]]; then
  error "Invalid version type: $VERSION_TYPE. Use: patch, minor, or major"
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")
info "Current version: $CURRENT_VERSION"
info "Bumping: $VERSION_TYPE"

# Bump version (creates commit and tag)
npm version "$VERSION_TYPE" -m "chore(release): v%s"

NEW_VERSION=$(node -p "require('./package.json').version")
success "Version bumped to: $NEW_VERSION"

# ============================================
header "Git Push"
# ============================================

info "Pushing commits and tags to origin..."
git push origin main --tags

success "Pushed to GitHub"

# ============================================
header "GitHub Release"
# ============================================

TAG="v$NEW_VERSION"

info "Creating GitHub release for $TAG..."

# Check if release already exists
if gh release view "$TAG" &> /dev/null; then
  warn "Release $TAG already exists, skipping..."
else
  # Create release with auto-generated notes
  gh release create "$TAG" \
    --title "$TAG" \
    --generate-notes

  success "GitHub release created: $TAG"
fi

# ============================================
header "npm Publish"
# ============================================

info "Publishing to npm..."

# Check if already published
PUBLISHED_VERSION=$(npm view ts-introspect version 2>/dev/null || echo "none")
if [[ "$PUBLISHED_VERSION" == "$NEW_VERSION" ]]; then
  warn "Version $NEW_VERSION already published to npm, skipping..."
else
  npm publish --access public
  success "Published to npm: ts-introspect@$NEW_VERSION"
fi

# ============================================
header "Release Complete"
# ============================================

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Release v$NEW_VERSION complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}npm:${NC}     https://www.npmjs.com/package/ts-introspect"
echo -e "  ${BLUE}GitHub:${NC}  https://github.com/pedroanisio/ts-introspect/releases/tag/$TAG"
echo -e "  ${BLUE}Install:${NC} npm install ts-introspect@$NEW_VERSION"
echo ""

