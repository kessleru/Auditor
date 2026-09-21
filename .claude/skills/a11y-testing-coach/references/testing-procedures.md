## Screen Reader Testing

### NVDA (Windows - Free)

**Setup:**

1. Download from [nvaccess.org](https://www.nvaccess.org/download/)
2. Settings > Speech: Set rate to ~40% while learning
3. Settings > Browse Mode: Auto focus on focusable elements = ON

**Essential Commands:**

| Action | Keys |
|--------|------|
| Start/Stop speech | Ctrl |
| Read next item | Down |
| Read previous item | Up |
| Activate link/button | Enter |
| Enter forms mode | Enter (on a form field) |
| Exit forms mode | Escape |
| List all headings | NVDA+F7 then Alt+H |
| List all links | NVDA+F7 then Alt+K |
| List all landmarks | NVDA+F7 then Alt+D |
| Read current line | NVDA+L |
| Navigate by heading | H / Shift+H |
| Navigate by landmark | D / Shift+D |
| Navigate by form field | F / Shift+F |
| Navigate by button | B / Shift+B |
| Navigate by table | T / Shift+T |
| Navigate table cells | Ctrl+Alt+Arrow keys |

**NVDA key:** Insert (desktop) or Caps Lock (laptop layout)

**What to test with NVDA:**

1. Can you navigate to every interactive element?
2. Does every element announce its role, name, and state?
3. Do headings create a logical outline? (NVDA+F7 heading list)
4. Are form fields labeled? (Navigate to each, listen for the label)
5. Do error messages announce when they appear?
6. Can you complete the full user journey eyes-closed?

### VoiceOver (macOS - Built-in)

**Setup:**

1. System Settings > Accessibility > VoiceOver > Enable
2. Or press Cmd+F5 to toggle
3. VoiceOver Utility > Verbosity: Set to High while learning

**Essential Commands:**

| Action | Keys |
|--------|------|
| Toggle VoiceOver | Cmd+F5 |
| Navigate next | VO+-> (VO = Ctrl+Option) |
| Navigate previous | VO+<- |
| Activate | VO+Space |
| Read all from here | VO+A |
| Open Rotor | VO+U |
| Navigate by heading (Rotor) | VO+U then <- or -> to Headings |
| Enter web area | VO+Shift+Down |
| Exit web area | VO+Shift+Up |
| Read current item | VO+F3 |
| Navigate table cells | VO+Arrow keys |

**VoiceOver Rotor (VO+U):** The most useful testing tool. Shows lists of headings, links, landmarks, form controls, and tables. Navigate between lists with <- ->, within a list with Up Down.

**What to test with VoiceOver:**

1. Open the Rotor: Are headings logical? Are landmarks present?
2. Navigate every interactive element: Does it announce correctly?
3. Test forms: Are labels announced? Are errors announced?
4. Test modals: Does focus trap inside? Can you escape?
5. Test dynamic content: Do live regions announce updates?

### JAWS (Windows - Paid, most common enterprise screen reader)

**Essential Commands:**

| Action | Keys |
|--------|------|
| Read next line | Down |
| Read previous line | Up |
| List headings | JAWS+F6 |
| List links | JAWS+F7 |
| List form fields | JAWS+F5 |
| Enter forms mode | Enter (on form field) |
| Virtual cursor toggle | JAWS+Z |
| Navigate by heading | H / Shift+H |
| Navigate by landmark | ; / Shift+; |

**JAWS key:** Insert

### Narrator (Windows - Built-in)

Good for quick checks, not as thorough as NVDA or JAWS:

| Action | Keys |
|--------|------|
| Toggle Narrator | Win+Ctrl+Enter |
| Read next item | Caps Lock+-> |
| Read previous item | Caps Lock+<- |
| Activate | Caps Lock+Enter |
| List headings | Caps Lock+F6 |

### Testing Workflow for Any Screen Reader

Follow this sequence for every page or component:

```text
1. HEADING STRUCTURE
   - List all headings (NVDA+F7, VO Rotor, JAWS+F6)
   - Verify: Single H1, no skipped levels, logical hierarchy
   
2. LANDMARK NAVIGATION
   - List landmarks (NVDA+F7 landmarks, VO Rotor landmarks)
   - Verify: header, nav, main, footer present
   - Verify: Multiple navs have unique labels
   
3. TAB THROUGH EVERYTHING
   - Tab from top to bottom
   - Verify: Every interactive element reachable
   - Verify: Tab order matches visual layout
   - Verify: No focus traps (except modals)
   - Verify: Focus indicator visible
   
4. FORM FIELDS
   - Tab to each input
   - Verify: Label announced
   - Verify: Required state announced
   - Verify: Error messages announced on invalid submit
   - Verify: Autocomplete announced if present
   
5. INTERACTIVE COMPONENTS
   - Test every button, link, tab, accordion, dropdown
   - Verify: Role announced ("button", "link", "tab")
   - Verify: State announced ("expanded", "selected", "checked")
   - Verify: State updates announced when changed
   
6. DYNAMIC CONTENT
   - Trigger content updates (search, filter, AJAX load, toast)
   - Verify: Changes announced via live region
   - Verify: Focus managed appropriately
   
7. COMPLETE USER JOURNEY
   - Close your eyes (or turn off the monitor)
   - Complete the primary task (sign up, checkout, search)
   - Note every point of confusion or failure
```

---

## Keyboard Testing

This does NOT require a screen reader. Test keyboard access independently.

### The 5-Minute Keyboard Test

1. **Unplug your mouse** (or don't touch it)
2. **Press Tab** - Can you see where focus is? If not, the focus indicator is missing or insufficient
3. **Tab through the entire page** - Can you reach every interactive element?
4. **Press Enter/Space** on every button and link - Do they work?
5. **Press Escape** on any overlay - Does it close?
6. **Press Tab after closing an overlay** - Does focus return to the trigger?

### What Each Key Should Do

| Key | Expected Behavior |
|-----|-------------------|
| Tab | Move to next interactive element |
| Shift+Tab | Move to previous interactive element |
| Enter | Activate link or button |
| Space | Activate button, toggle checkbox, open select |
| Escape | Close modal/dropdown/popover |
| Arrow keys | Navigate within a widget (tabs, radio group, menu, grid) |
| Home/End | Jump to first/last item in a list or menu |

### Keyboard Traps

A keyboard trap occurs when Tab gets stuck in a loop or a section with no exit. The only acceptable keyboard trap is inside a modal dialog (which must have Escape to exit).

Test for traps:

1. Tab into every component
2. Verify you can Tab out of it
3. Pay special attention to: iframes, embedded widgets, custom dropdown menus, date pickers, rich text editors

### Custom Widget Keyboard Patterns

When testing custom widgets, verify they follow the [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/):

| Widget | Expected Keyboard |
|--------|-------------------|
| Tabs | Arrow keys switch tabs, Tab moves to tab panel |
| Accordion | Enter/Space toggles, Arrow keys navigate headers |
| Menu | Arrow keys navigate, Enter selects, Escape closes |
| Dialog | Tab trapped inside, Escape closes, focus returns |
| Combobox | Arrow keys navigate options, Enter selects, Escape closes |
| Tree view | Arrow keys navigate, Enter expands/collapses |
| Slider | Arrow keys adjust value, Home/End for min/max |

---

## Automated Testing

### What Automation Catches (~30% of issues)

- Missing alt text
- Missing form labels
- Insufficient color contrast
- Missing document language
- Duplicate IDs
- Invalid ARIA attributes
- Missing landmark regions

### What Automation Cannot Catch (~70% of issues)

- Whether alt text is actually accurate
- Whether tab order makes logical sense
- Whether focus management works correctly
- Whether live regions announce at the right time
- Whether the user experience is confusing
- Whether custom widgets follow keyboard patterns
- Whether content makes sense when linearized

### axe-core (The Gold Standard)

**In Playwright:**

```javascript
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test('homepage has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  
  expect(results.violations).toEqual([]);
});

// Test specific components
test('login form is accessible', async ({ page }) => {
  await page.goto('/login');
  
  const results = await new AxeBuilder({ page })
    .include('#login-form')
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  
  expect(results.violations).toEqual([]);
});

// Test after interaction (modal open, dropdown expanded)
test('modal is accessible when open', async ({ page }) => {
  await page.goto('/');
  await page.click('#open-modal');
  await page.waitForSelector('[role="dialog"]');
  
  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  
  expect(results.violations).toEqual([]);
});
```

**In Cypress:**

```javascript
import 'cypress-axe';

describe('Accessibility', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.injectAxe();
  });

  it('has no violations on load', () => {
    cy.checkA11y(null, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag22aa']
      }
    });
  });

  it('has no violations after opening modal', () => {
    cy.get('#open-modal').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.checkA11y('[role="dialog"]');
  });
});
```

**In Jest (using jest-axe for React components):**

```javascript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('LoginForm has no accessibility violations', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**In Storybook:**

```javascript
// .storybook/main.js
module.exports = {
  addons: ['@storybook/addon-a11y'],
};

// The a11y addon runs axe-core against every story automatically
// Check the "Accessibility" panel in the Storybook UI
```

### Pa11y (CLI and CI)

```bash
# Single page
npx pa11y https://example.com

# With WCAG 2.2 AA standard
npx pa11y --standard WCAG2AA https://example.com

# Multiple pages
npx pa11y-ci --config .pa11yci.json
```

`.pa11yci.json`:

```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 10000,
    "wait": 1000
  },
  "urls": [
    "http://localhost:3000/",
    "http://localhost:3000/login",
    "http://localhost:3000/dashboard",
    {
      "url": "http://localhost:3000/modal-page",
      "actions": [
        "click element #open-modal",
        "wait for element [role='dialog'] to be visible"
      ]
    }
  ]
}
```

### Lighthouse (Chrome DevTools)

Built into Chrome, not as thorough as axe but easy to access:

1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Check "Accessibility" category
4. Click "Analyze page load"
5. Review the accessibility score and specific findings

Note: Lighthouse accessibility tests are a subset of axe-core. A 100 score does NOT mean the page is accessible - it means it passed the automated checks.

### CI/CD Pipeline

```yaml
# GitHub Actions example
name: Accessibility
on: [pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      
      # Start the server
      - run: npm start &
      - run: npx wait-on http://localhost:3000
      
      # Run axe-core via Playwright
      - run: npx playwright test --project=a11y
      
      # Or run Pa11y
      - run: npx pa11y-ci
```

---

## Browser DevTools Accessibility Features

### Chrome

1. **Accessibility Tree:** Elements panel > Accessibility tab - shows what the browser exposes to assistive technology
2. **Contrast Checker:** Elements panel > Styles > hover over a color - shows contrast ratio and AA/AAA pass/fail
3. **CSS Overview:** More tools > CSS Overview > Capture overview - shows all low-contrast text on the page
4. **Rendering:** More tools > Rendering > Emulate vision deficiencies - simulate color blindness, blurred vision
5. **Forced element state:** Elements panel > right-click element > Force state > :focus - check focus styles without tabbing

### Firefox

1. **Accessibility Inspector:** DevTools > Accessibility tab - the best built-in accessibility tool in any browser
2. **Check for issues:** Accessibility tab > dropdown > "All Issues" - runs automated checks
3. **Simulate:** Accessibility tab > Simulate > various vision deficiencies
4. **Tab order overlay:** Accessibility tab > "Show Tabbing Order" - shows numbered tab order on the page

### Edge

Same as Chrome (Chromium-based), plus:

1. **Accessibility tree in Elements panel**
2. **ARIA validation warnings** in Issues panel

---

