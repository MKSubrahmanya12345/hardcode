# Changes Log

## Latest Updates

### UI and Layout
- Added logout buttons on key authenticated pages:
  - Home page
  - Project workspace page
  - Design page
- Reworked Home page hero section and replaced top project-management intro block.
- Added centered headline with custom serif display style and split it into 5 lines:
  - Your
  - AI
  - Companion
  - for
  - Hardware
- Removed the large outer wrapper card around the chatbot input section.

### Chat Input Experience
- Replaced the old project creation prompt flow with a chat-first input flow.
- Added a custom component: `PromptInputDynamicGrow.jsx`.
- Increased input height and adjusted spacing for visual parity with reference.
- Added helper text (`Press Enter to start`) and styled action button (`Get started`).
- Rethemed chatbot visuals to match shader palette (violet/blue glass style).

### Readability Improvements (Lower Section)
- Kept the top hero/chat area unchanged and improved only the section below it.
- Increased visibility of:
  - My Projects subtitle
  - Open/Manage info cards
  - Project cards and metadata text
  - Divider lines and action button contrast
- Updated lower cards to darker, less transparent glass styling so they stay clearly visible above shaders.

### Shader Background
- Removed previous shader implementation.
- Added `TubesCursor.jsx` shader component.
- Fixed shader to render across the full viewport.
- Ensured content remains layered above shader using z-index.

### Typography and Styling
- Added `Playfair Display` font import.
- Added `.hero-display` utility class for serif/italic uppercase heading style.

### Hero Copy Changes
- Updated hero headline text to: `Your AI Companion for Hardware`.
- Updated hero description text to:
  `Go from idea to working prototype in minutes, not weekends. Just tell it what you want.`

## Files Added
- `frontend/src/components/ui/PromptInputDynamicGrow.jsx`
- `frontend/src/components/ui/TubesCursor.jsx`
- `changes/changes.md`

## Files Updated
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/components/ProjectMainPage.jsx`
- `frontend/src/pages/DesignPage.jsx`
- `frontend/src/pages/HeroPage.jsx`
- `frontend/src/index.css`
- `package-lock.json` (root lockfile added)

## Changed Files by Area

### Authentication / Logout
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/components/ProjectMainPage.jsx`
- `frontend/src/pages/DesignPage.jsx`

### Home Page Layout and Content
- `frontend/src/pages/HomePage.jsx`

### Prompt / Chat Input Component
- `frontend/src/components/ui/PromptInputDynamicGrow.jsx`
- `frontend/src/pages/HomePage.jsx`

### Shader Integration
- `frontend/src/components/ui/TubesCursor.jsx`
- `frontend/src/pages/HomePage.jsx`

### Typography and Fonts
- `frontend/src/index.css`
- `frontend/src/pages/HomePage.jsx`

### Hero Text Copy
- `frontend/src/pages/HeroPage.jsx`

### Project-Level Dependency Lock
- `package-lock.json`
