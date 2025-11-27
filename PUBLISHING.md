# Publishing Guide

Complete checklist for publishing `ts-introspect` to npm.

---

## Quick Start

```bash
npm run validate           # Automated checklist
npm publish --access public
```

---

## Manual Checklist

```
[ ] npm login
[ ] npm run check          # lint + build + test
[ ] npm audit              # security
[ ] npm pack --dry-run     # preview contents
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
- [ ] `dist/` is built

### Security
- [ ] `npm audit` — No vulnerabilities
- [ ] `npm pack --dry-run` — No sensitive files

---

## 2. Recommended (Optional)

| Item | Status | Notes |
|------|--------|-------|
| `prepublishOnly` script | ✅ | Auto lint+build+test |
| `files` field | ✅ | Controls published files |
| `CHANGELOG.md` | ❌ | Track version changes |
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

## 4. Version Bump

```bash
npm version patch   # 1.0.0 → 1.0.1 (bug fixes)
npm version minor   # 1.0.0 → 1.1.0 (new features)
npm version major   # 1.0.0 → 2.0.0 (breaking changes)
```

---

## 5. Publish

```bash
# Login (once)
npm login

# Dry run first
npm publish --dry-run

# Publish
npm publish --access public

# With 2FA
npm publish --access public --otp=123456
```

---

## 6. Post-Publish Verification

```bash
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
| `npm audit` | ✅ 0 vulnerabilities |
| Tests | ✅ 136 passing |

**Ready to publish!** ✅

