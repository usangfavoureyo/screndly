Evaluate design effectiveness from a UX perspective. Assesses visual hierarchy, information architecture, emotional resonance, and overall design quality with actionable feedback.

args:
    name: url
    description: The URL to critique (defaults to http://localhost:3000)
    required: false
    name: area
    description: Specific page or route to critique (e.g., /editor, /gallery)
    required: false

Conduct a holistic design critique by **actually viewing the interface** using the Playwright browser. This is a visual audit-not a code review.

**First**: Use the frontend-design skill for design principles and anti-patterns.

## Visual Audit Process

### Step 1: Launch Browser and Navigate

Use the Playwright MCP tools to view the actual interface:

1. Navigate to the target URL using 'mcp_playwright_browser_navigate:
    - If $ARGUMENTS.url provided, use that
    - If $ARGUMENTS.area provided, append to base URL (e.g., `/editor`)

2. Wait for the page to load fully using 'mcp_playwright_browser_wait_for if needed

### Step 2: Capture Visual State

1. **Take a full-page screenshot** using mcp_playwright_browser_take_screenshot:
    - Use fullPage: true to capture everything
    - Save with descriptive filename like critique-{page}-{timestampong

2. **Get accessibility snapshot** using 'mcp_playwright_browser_snapshot':
    - This provides structural information about the page
    - Use this to understand the element hierarchy

3. **Check console for errors** using 'mcp_playwright_browser_console_messages':
    - Note any JavaScript errors that might indicate broken functionality
    - ### Step 3: Interactive Exploration

Explore different states of the interface:

1. **Test responsive behavior** using mcp_playwright_browser_resize":
    - Check desktop (1920x1080)
    - Check tablet (768x1024)
    - Check mobile (375x667)
    - Take screenshots at each breakpoint

2. **Check hover states** using 'mcp_playwright_browser_hover:
    - Hover over interactive elements to see feedback states
    - Note if hover states are present and meaningful

3. **Test dark mode** (if applicable):
    - Look for theme toggle and click it
    - Take screenshot of dark mode
    - Compare contrast and readability

4. **Check empty/loading states**:
    - Navigate to pages that might show empty states
    - Observe loading indicators if any

## Design Critique Dimensions

Based on what you **actually see** in the screenshots and snapshots, evaluate:

### 1. AI Slop Detection (CRITICAL)

**This is the most important check.** Does this look like every other AI-generated interface from 2024-2025?

Review the design against ALL the **DON'T** guidelines in the frontend-design skill—they are the fingerprints of AI-generated work. Check for the AI color palette, gradient text, dark mode with glowing accents, glassmorphism, hero metric layouts, identical card grids, generic fonts, and all other tells.

**The test**: If you showed this to someone and said "AI made this," would they believe you immediately? If yes, that's the problem.

### 2. Visual Hierarchy
- Does the eye flow to the most important element first?
- Is there a clear primary action? Can you spot it in 2 seconds?
- Do size, color, and position communicate importance correctly?
- Is there visual competition between elements that should have different weights?

### 3. Information Architecture
- Is the structure intuitive? Would a new user understand the organization?
- Is related content grouped logically?
- Are there too many choices at once? (cognitive overload)
- Is the navigation clear and predictable?

### 4. Emotional Resonance
- What emotion does this interface evoke? Is that intentional?
- Does it match the brand personality?
- Does it feel trustworthy, approachable, premium, playful—whatever it should feel?
- Would the target user feel "this is for me"?

### 5. Discoverability & Affordance
- Are interactive elements obviously interactive?
- Would a user know what to do without instructions?
- Are hover/focus states providing useful feedback?
- Are there hidden features that should be more visible?

### 6. Composition & Balance
- Does the layout feel balanced or uncomfortably weighted?
- Is whitespace used intentionally or just leftover?
- Is there visual rhythm in spacing and repetition?
- Does asymmetry feel designed or accidental?

### 7. Typography as Communication
- Does the type hierarchy clearly signal what to read first, second, third?
- Is body text comfortable to read? (line length, spacing, size)
- Do font choices reinforce the brand/tone?
- Is there enough contrast between heading levels?

### 8. Color with Purpose
- Is color used to communicate, not just decorate?
- Does the palette feel cohesive?
- Are accent colors drawing attention to the right things?
- Does it work for colorblind users? (not just technically—does meaning still come through?)

### 9. States & Edge Cases
- Empty states: Do they guide users toward action, or just say "nothing here"?
- Loading states: Do they reduce perceived wait time?
- Error states: Are they helpful and non-blaming?
- Success states: Do they confirm and guide next steps?

### 10. Microcopy & Voice
- Is the writing clear and concise?
- Does it sound like a human (the right human for this brand)?
- Are labels and buttons unambiguous?
- Does error copy help users fix the problem?

## Generate Critique Report

Structure your feedback as a design director would:

### Anti-Patterns Verdict
**Start here.** Pass/fail: Does this look AI-generated? List specific tells from the skill's Anti-Patterns section. Be brutally honest.

### Overall Impression
A brief gut reaction—what works, what doesn't, and the single biggest opportunity.

### What's Working
Highlight 2-3 things done well. Be specific about why they work.

### Priority Issues
The 3-5 most impactful design problems, ordered by importance:

For each issue:
- **What**: Name the problem clearly
- **Why it matters**: How this hurts users or undermines goals
- **Fix**: What to do about it (be concrete)
- **Command**: Which command to use (`/polish`, `/simplify`, `/bolder`, `/quieter`, etc.)

### Minor Observations
Quick notes on smaller issues worth addressing.

### Questions to Consider
Provocative questions that might unlock better solutions:
- "What if the primary action were more prominent?"
- "Does this need to feel this complex?"
- "What would a confident version of this look like?"

**Remember**:
- Be direct—vague feedback wastes everyone's time
- Be specific—"the submit button" not "some elements"
- Say what's wrong AND why it matters to users
- Give concrete suggestions, not just "consider exploring..."
- Prioritize ruthlessly—if everything is important, nothing is
- Don't soften criticism—developers need honest feedback to ship great design