---
name: a11y-testing-coach
description: >
  Accessibility testing methodology coach. Use this skill whenever the user
  asks HOW to test accessibility — screen reader testing with NVDA, JAWS,
  VoiceOver, or TalkBack, keyboard-only testing workflows, automated testing
  setup with axe-core or Playwright, browser DevTools accessibility features,
  or creating accessibility test plans. Also trigger when the user asks about
  testing with assistive technology, verifying screen reader output, building
  CI/CD accessibility testing pipelines, or needs to understand the gap between
  "the code looks right" and "it actually works in a screen reader." This skill
  teaches testing practices — it does not write product code.
---

# Accessibility Testing Coach

There is a massive gap between "the code looks right" and "it actually works
in a screen reader." This skill bridges that gap by teaching developers how
to verify that their code works for people with disabilities.

> **Automated scanning catches roughly 30% of WCAG criteria.** The remaining
> 70% require manual testing — correct tab order, meaningful alt text, logical
> focus management, screen reader announcements. Never rely on automated tools
> alone.

## Authoritative Sources

- **NVDA User Guide** — <https://www.nvaccess.org/files/nvda/documentation/userGuide.html>
- **JAWS Documentation** — <https://www.freedomscientific.com/training/jaws/>
- **VoiceOver User Guide** — <https://support.apple.com/guide/voiceover/welcome/mac>
- **axe-core API** — <https://github.com/dequelabs/axe-core/blob/develop/doc/API.md>
- **Playwright Accessibility** — <https://playwright.dev/docs/accessibility-testing>

## What This Skill Covers

- Screen reader testing (NVDA, VoiceOver, JAWS, Narrator, TalkBack)
- Keyboard-only testing workflows
- Automated testing tools (axe-core, Pa11y, Lighthouse, WAVE)
- Browser DevTools accessibility features
- Testing framework integration (Playwright, Cypress, Jest)
- Accessibility test plans and checklists
- CI/CD accessibility testing pipelines
- Common testing mistakes and blind spots

## What This Skill Does NOT Do

- Write product feature code (use the a11y-code-review skill for that)
- Replace manual testing with automation
- Guarantee compliance (testing reveals issues, not their absence)

## How To Use

Load `references/testing-procedures.md` for detailed step-by-step testing
instructions covering screen readers, keyboard testing, automated tools,
and DevTools.

## Quick Reference: axe-core CLI

```bash
# Single page scan
npx @axe-core/cli <URL> --tags wcag2a,wcag2aa,wcag21a,wcag21aa

# Save to JSON
npx @axe-core/cli <URL> --tags wcag2a,wcag2aa,wcag21a,wcag21aa --save results.json
```

If `@axe-core/cli` is not installed: `npm install -g @axe-core/cli`

## Recommended Testing Combinations

| Platform | Screen Reader | Browser | Why |
|----------|--------------|---------|-----|
| Windows | NVDA (free) | Firefox | Most common free SR + best a11y support |
| Windows | JAWS | Chrome | Enterprise standard |
| macOS | VoiceOver | Safari | Built-in, important for Apple users |
| iOS | VoiceOver | Safari | Mobile web testing baseline |
| Android | TalkBack | Chrome | Android mobile testing baseline |

Test with at least 2 combinations. NVDA + Firefox is the minimum viable
test. Add VoiceOver + Safari if users include Apple device owners.

## Accessibility Test Plan Template

```
## Accessibility Test Plan: [Feature Name]

### Scope
- Pages/components: [list]
- WCAG target: 2.2 AA
- Testing date: [date]

### Keyboard Testing
- [ ] All interactive elements reachable by Tab
- [ ] All elements activatable by Enter/Space
- [ ] Logical tab order (left→right, top→bottom)
- [ ] Focus visible on every element
- [ ] No keyboard traps
- [ ] Skip link present and functional
- [ ] Modal focus trapped, Escape closes

### Screen Reader Testing
- [ ] All images announced with meaningful alt text
- [ ] Headings in correct hierarchy (H key navigation)
- [ ] Landmarks present: banner, navigation, main, contentinfo
- [ ] Form fields have labels announced on focus
- [ ] Error messages announced when they appear
- [ ] Dynamic content changes announced via live regions
- [ ] Modals announced with role, title, and content
- [ ] Tables navigable with column/row headers announced

### Visual Testing
- [ ] All text meets 4.5:1 contrast (3:1 for large text)
- [ ] Focus indicators visible (3:1 contrast)
- [ ] Information not conveyed by color alone
- [ ] Content reflows at 400% zoom without horizontal scroll
- [ ] Animations respect prefers-reduced-motion

### Automated Scan
- [ ] axe-core scan: 0 violations
- [ ] Lighthouse accessibility: 100 score
- [ ] All automated findings reviewed manually

### Results
| Test | Pass/Fail | Notes |
|------|-----------|-------|
```

## How to Report Testing Findings

When reporting findings from testing:

```
## Finding: [Brief description]

**Severity:** [Critical / Major / Minor]
**WCAG:** [criterion number and name]
**Screen reader behavior:** [What the SR actually announced]
**Expected behavior:** [What the SR should announce]
**Steps to reproduce:**
1. [step]
2. [step]
**Browser/SR combination:** [e.g., NVDA 2024.4 + Firefox 132]
```

Include the actual screen reader output — this is the evidence that matters.
"The button doesn't have a label" is vague. "NVDA announces 'button' with
no name" is specific and actionable.
