#!/bin/bash
#
# Pre-publish validation script for ts-introspect
# Run: npm run validate
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
WARNINGS=0

pass() {
  echo -e "${GREEN}✓${NC} $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  FAILED=$((FAILED + 1))
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  WARNINGS=$((WARNINGS + 1))
}

info() {
  echo -e "${BLUE}→${NC} $1"
}

header() {
  echo ""
  echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

# ============================================
header "Package.json Fields"
# ============================================

if [ ! -f "package.json" ]; then
  fail "package.json not found"
  exit 1
fi

# Check fields using node
NAME=$(node -p "require('./package.json').name" 2>/dev/null)
VERSION=$(node -p "require('./package.json').version" 2>/dev/null)
LICENSE=$(node -p "require('./package.json').license" 2>/dev/null)
DESCRIPTION=$(node -p "require('./package.json').description" 2>/dev/null)
MAIN=$(node -p "require('./package.json').main" 2>/dev/null)
TYPES=$(node -p "require('./package.json').types" 2>/dev/null)
EXPORTS_COUNT=$(node -p "Object.keys(require('./package.json').exports||{}).length" 2>/dev/null)
FILES=$(node -p "(require('./package.json').files||[]).join(', ')" 2>/dev/null)
PREPUB=$(node -p "require('./package.json').scripts?.prepublishOnly||''" 2>/dev/null)

[ "$NAME" = "ts-introspect" ] && pass "name = $NAME" || fail "name should be ts-introspect"
[ -n "$VERSION" ] && pass "version = $VERSION" || fail "version missing"
[ "$LICENSE" = "MIT" ] && pass "license = $LICENSE" || fail "license should be MIT"
[ -n "$DESCRIPTION" ] && pass "description defined" || fail "description missing"
[ -n "$MAIN" ] && pass "main = $MAIN" || fail "main missing"
[ -n "$TYPES" ] && pass "types = $TYPES" || fail "types missing"
[ "$EXPORTS_COUNT" -gt 0 ] 2>/dev/null && pass "exports ($EXPORTS_COUNT entry points)" || fail "exports missing"
[ -n "$FILES" ] && pass "files = [$FILES]" || fail "files missing"
[ -n "$PREPUB" ] && pass "prepublishOnly defined" || warn "prepublishOnly not defined"

# ============================================
header "Required Files"
# ============================================

[ -f "LICENSE" ] && pass "LICENSE exists" || fail "LICENSE missing"
[ -f "README.md" ] && pass "README.md exists" || fail "README.md missing"
[ -d "dist" ] && pass "dist/ exists" || warn "dist/ not built (run: npm run build)"
[ -f "dist/index.js" ] && pass "dist/index.js exists" || warn "dist/index.js missing"
[ -f "dist/index.d.ts" ] && pass "dist/index.d.ts exists" || warn "dist/index.d.ts missing"
[ -d "bin" ] && pass "bin/ exists" || fail "bin/ missing"

# ============================================
header "Code Quality"
# ============================================

info "Running lint..."
if npm run lint --silent >/dev/null 2>&1; then
  pass "Lint passed"
else
  fail "Lint failed (run: npm run lint)"
fi

info "Running build..."
if npm run build --silent >/dev/null 2>&1; then
  pass "Build passed"
else
  fail "Build failed (run: npm run build)"
fi

info "Running tests..."
if npm test --silent >/dev/null 2>&1; then
  pass "Tests passed"
else
  fail "Tests failed (run: npm test)"
fi

# ============================================
header "Security"
# ============================================

info "Running audit..."
AUDIT=$(npm audit 2>&1)
if echo "$AUDIT" | grep -q "found 0 vulnerabilities"; then
  pass "No vulnerabilities"
else
  warn "Vulnerabilities found (run: npm audit)"
fi

# ============================================
header "Package Preview"
# ============================================

info "Checking package contents..."
PACK=$(npm pack --dry-run 2>&1)
SIZE=$(echo "$PACK" | grep "package size" | sed 's/.*: //')
FILES_NUM=$(echo "$PACK" | grep "total files" | sed 's/.*: //')

[ -n "$SIZE" ] && pass "Package size: $SIZE" || warn "Could not determine size"
[ -n "$FILES_NUM" ] && pass "Total files: $FILES_NUM" || warn "Could not count files"

# Check for sensitive files
if echo "$PACK" | grep -qiE '\.env|\.key|\.pem|secret'; then
  fail "Sensitive files in package!"
else
  pass "No sensitive files"
fi

# ============================================
header "Optional"
# ============================================

[ -f "CHANGELOG.md" ] && pass "CHANGELOG.md exists" || warn "CHANGELOG.md missing"

# ============================================
header "Summary"
# ============================================

echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${RED}Failed:${NC}   $FAILED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  ✓ Ready to publish!${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  ${BLUE}Package:${NC}  $NAME@$VERSION"
  echo -e "  ${BLUE}npm URL:${NC}  https://www.npmjs.com/package/$NAME"
  echo -e "  ${BLUE}Install:${NC}  npm install $NAME"
  echo ""
  echo -e "  ${YELLOW}Publish:${NC}  npm publish --access public"
  echo ""
  exit 0
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  ✗ Fix $FAILED issue(s) before publishing${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  exit 1
fi
