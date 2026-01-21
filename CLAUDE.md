# CLAUDE.md - AI Assistant Documentation

## Project Overview

**Project Name**: POH - Progressive Overload Tracking Hagius
**Purpose**: Fitness tracking application focused on progressive overload tracking
**Status**: Early development stage
**Owner**: Hagius (nicolas@hagius.de)

Progressive overload is a fundamental strength training principle where you gradually increase the stress placed on your body during exercise to continuously improve strength, endurance, and muscle growth.

## Repository Structure

### Current State

This is a newly initialized repository. The current structure is minimal:

```
/home/user/POH/
├── .git/                 # Git repository metadata
├── README.md             # Project title and description
└── CLAUDE.md             # This file - AI assistant documentation
```

### Expected Future Structure

As the project develops, the structure should follow these patterns:

```
/home/user/POH/
├── src/                  # Source code
├── tests/                # Test files
├── docs/                 # Additional documentation
├── config/               # Configuration files
├── .github/              # GitHub Actions workflows (if applicable)
├── package.json          # Node.js dependencies (if using JavaScript/TypeScript)
├── requirements.txt      # Python dependencies (if using Python)
├── README.md             # Project overview and setup instructions
├── CLAUDE.md             # This file
└── .gitignore            # Git ignore patterns
```

## Development Workflows

### Git Branch Strategy

**Current Branch**: `claude/add-claude-documentation-7mSNm`

**Branch Naming Convention**:
- Feature branches: `claude/feature-name-{sessionId}`
- Bug fixes: `claude/fix-issue-description-{sessionId}`
- Documentation: `claude/docs-topic-{sessionId}`

**Important Git Rules**:
1. **ALWAYS** develop on the designated feature branch
2. **NEVER** commit directly to main/master without explicit permission
3. **ALWAYS** use descriptive commit messages following this format:
   ```
   <type>: <short description>

   <detailed explanation if needed>
   ```
   Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

4. **GPG Signing**: This repository requires GPG-signed commits (configured)
5. **Push Strategy**: Use `git push -u origin <branch-name>` for initial pushes

### Commit Message Guidelines

**Good Examples**:
```
feat: add workout session tracking functionality

Implemented the core session tracking feature that allows users to
create and save workout sessions with exercises and sets.

docs: update CLAUDE.md with project structure

Added comprehensive documentation for AI assistants working on this project.

fix: correct calculation in progressive overload algorithm
```

**Bad Examples**:
```
updated stuff
fixed bug
WIP
asdf
```

### Development Process

1. **Understand the Request**: Read the issue or request carefully
2. **Plan the Work**: Use TodoWrite to break down complex tasks
3. **Research First**: Always read existing files before modifying them
4. **Implement**: Write clean, maintainable code
5. **Test**: Ensure changes work as expected
6. **Commit**: Create clear, atomic commits
7. **Push**: Push to the designated branch

## Code Conventions

### General Principles

1. **Keep It Simple**: Avoid over-engineering
   - Don't add features that weren't requested
   - Don't create abstractions for one-time operations
   - Don't add error handling for scenarios that can't happen

2. **Be Explicit**: Write self-documenting code
   - Use clear variable and function names
   - Only add comments where logic isn't self-evident
   - Prefer simple solutions over clever ones

3. **Security First**: Watch for vulnerabilities
   - SQL injection
   - XSS (Cross-Site Scripting)
   - Command injection
   - Insecure authentication
   - OWASP Top 10 vulnerabilities

4. **No Backwards Compatibility Hacks**:
   - If code is unused, delete it completely
   - Don't rename unused variables with `_`
   - Don't add `// removed` comments
   - Don't maintain deprecated functions

### Language-Specific Conventions

**When the tech stack is chosen, follow these patterns**:

#### JavaScript/TypeScript
- Use ES6+ features
- Prefer `const` over `let`, avoid `var`
- Use async/await over raw Promises
- Follow functional programming patterns where appropriate
- Use meaningful destructuring

#### Python
- Follow PEP 8 style guide
- Use type hints for function signatures
- Prefer list comprehensions over loops when readable
- Use context managers for resource handling
- Keep functions small and focused

#### General Code Style
- **Indentation**: Use consistent indentation (2 or 4 spaces, no tabs unless project standard)
- **Line Length**: Keep lines under 100 characters when reasonable
- **Functions**: Keep functions focused on a single responsibility
- **Naming**:
  - Variables/Functions: `camelCase` or `snake_case` (depend on language)
  - Classes: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`

## Testing Guidelines

### Test Organization

When tests are added, they should follow these patterns:

1. **Unit Tests**: Test individual functions/methods in isolation
2. **Integration Tests**: Test how components work together
3. **E2E Tests**: Test complete user workflows

### Test Naming

```
test_<function>_<scenario>_<expected_result>
```

Example: `test_calculate_progressive_overload_with_valid_data_returns_correct_increase`

### Test Coverage

- Aim for high coverage of critical paths
- Don't test for the sake of 100% coverage
- Focus on edge cases and error conditions
- Test user-facing functionality thoroughly

## AI Assistant Guidelines

### DO:

1. **Read Before Writing**: Always read existing files before suggesting changes
2. **Ask Questions**: Use AskUserQuestion when clarification is needed
3. **Plan Complex Tasks**: Use TodoWrite for multi-step work
4. **Be Thorough**: Research the codebase to understand context
5. **Follow Conventions**: Maintain consistency with existing code
6. **Test Changes**: Verify that modifications work correctly
7. **Document Decisions**: Explain complex changes in commits
8. **Security Minded**: Always check for vulnerabilities

### DON'T:

1. **Don't Over-Engineer**: Only solve the immediate problem
2. **Don't Add Unnecessary Features**: Stick to the requirements
3. **Don't Skip Reading**: Never propose changes to code you haven't seen
4. **Don't Guess**: If unsure, ask the user
5. **Don't Break Things**: Test before committing
6. **Don't Ignore Errors**: Address issues as they arise
7. **Don't Push to Wrong Branch**: Always verify the branch name
8. **Don't Add Emoji**: Unless explicitly requested by the user

### Common Workflows

#### Adding a New Feature

```
1. Read the feature request carefully
2. Use TodoWrite to plan implementation steps
3. Research existing code that might be affected
4. Implement the feature incrementally
5. Test the feature works as expected
6. Commit with a clear message
7. Push to the designated branch
```

#### Fixing a Bug

```
1. Reproduce the bug if possible
2. Identify the root cause
3. Read the affected files
4. Implement the fix
5. Verify the bug is resolved
6. Check for similar issues elsewhere
7. Commit and push
```

#### Refactoring Code

```
1. Ensure refactoring is actually requested
2. Understand the current implementation
3. Plan the refactoring approach
4. Make changes incrementally
5. Verify functionality remains unchanged
6. Update tests if needed
7. Commit and push
```

## Progressive Overload Domain Knowledge

### Core Concepts

1. **Progressive Overload**: Gradually increasing workout stress over time
   - Increase weight
   - Increase reps
   - Increase sets
   - Decrease rest time
   - Increase training volume

2. **Workout Session**: A single training session
   - Date/Time
   - Exercises performed
   - Sets and reps
   - Weight used
   - Rest periods

3. **Exercise**: A specific movement pattern
   - Name (e.g., "Bench Press", "Squat")
   - Muscle groups targeted
   - Equipment needed
   - Form cues

4. **Progression Tracking**: Comparing performance over time
   - Week-over-week changes
   - Month-over-month trends
   - Personal records (PRs)
   - Volume calculations (sets × reps × weight)

### Benchmark Sessions

**Feature implemented**: 2026-01-21

When a user logs their first session for an exercise, the system enters **Benchmark Mode** - a special calibration phase designed to establish an accurate baseline for progressive overload.

#### How It Works

1. **Pre-Benchmark Screen** (`BenchmarkIntroScreen`)
   - Full-screen motivational explanation
   - Clear instructions for the user
   - Reduces intimidation factor for beginners
   - Location: `/home/user/POH/src/ProgressiveOverloadTracker.jsx`

2. **Benchmark Logging**
   - User performs 3-5 sets at varying weights
   - System tracks all sets during the session
   - Flexible rep range (5-12 reps) encourages exploration
   - Special UI banner shows progress (e.g., "3/5 sets logged")
   - Location: Log view with `currentRecommendation.benchmark_mode` check

3. **Benchmark Analysis** (`analyzeBenchmarkSession`)
   - Calculates e1RM for each logged set
   - Selects the set with highest e1RM as baseline
   - Applies exercise-specific modifiers (e.g., Front Squat = 0.82x)
   - Location: `/home/user/POH/src/lib/recommendation-engine.js:254-300`

4. **Benchmark Reward Screen** (`BenchmarkRewardScreen`)
   - Special celebration screen (different from normal rewards)
   - Shows baseline e1RM prominently
   - Displays all sets with best set highlighted (👑)
   - Motivational messaging: "Your Journey Begins Now!"
   - Preview of next workout target
   - Location: `/home/user/POH/src/ProgressiveOverloadTracker.jsx`

5. **Post-Benchmark**
   - Next session receives progressive prescription
   - System uses established baseline for intensity calculations
   - Training status: `'progressive'`
   - Flag: `'post_benchmark_first_prescription'`

#### Code Locations

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Benchmark Detection | recommendation-engine.js | 541-576 | Returns `benchmark_mode: true` |
| Benchmark Analysis | recommendation-engine.js | 254-300 | Analyzes sets, finds best e1RM |
| Post-Benchmark Logic | recommendation-engine.js | 578-656 | First prescription after benchmark |
| Intro Screen | ProgressiveOverloadTracker.jsx | ~2175-2275 | Motivational pre-session UI |
| Banner UI | ProgressiveOverloadTracker.jsx | ~1950-1975 | In-session benchmark indicator |
| Reward Screen | ProgressiveOverloadTracker.jsx | ~2320-2470 | Post-benchmark celebration |
| Tests | recommendation-engine.test.js | 500-641 | 8 test cases for benchmark mode |

#### Design Philosophy

- **Swiss Style / Neo-Brutalism**: Bold typography, high contrast, minimal gradients
- **Color Coding**: Gold (#FFD700) for benchmark mode, Green (#00C805) for success
- **Progressive Disclosure**: Information revealed when needed, not all at once
- **Motivational**: Reduces first-session anxiety with clear guidance

#### Testing

50 test cases total, including:
- `should return benchmark mode for first session`
- `should analyze benchmark session correctly with multiple sets`
- `should generate progressive recommendation after benchmark`
- `should apply exercise-specific modifiers to benchmark e1RM`
- `should use correct baseline e1RM for post-benchmark prescription`

All tests passing ✓

#### User Flow Example

```
User selects "Bench Press" (no history)
    ↓
BenchmarkIntroScreen displays
    "Let's Find Your Starting Point!"
    Instructions + Motivation
    ↓
User clicks "Start Benchmark Session"
    ↓
Log View opens with gold banner
    "Benchmark Mode Active - Log 3-5 sets"
    Progress indicator: 0/5 sets
    ↓
User logs:
    Set 1: 60kg × 10 reps (e1RM: 80kg)
    Set 2: 70kg × 8 reps (e1RM: 87.5kg)
    Set 3: 80kg × 6 reps (e1RM: 96kg) ← BEST
    ↓
User slides to log
    ↓
BenchmarkRewardScreen displays
    "Baseline Established! 96.0kg e1RM"
    Shows all 3 sets with Set 3 highlighted 👑
    "Your Journey Begins Now!"
    Next target: 70kg × 10 reps (hypertrophy)
    ↓
User continues training with personalized recommendations
```

### Data Modeling Considerations

When implementing the data model, consider:

1. **User Management**: Multiple users may use the system
2. **Exercise Library**: Standard exercises plus custom user exercises
3. **Workout Templates**: Reusable workout plans
4. **Historical Data**: Complete history for trend analysis
5. **Progress Metrics**: Calculated fields for tracking improvements

## Technology Stack (To Be Determined)

The technology stack has not yet been chosen. When selecting technologies, consider:

### Frontend Options
- **React**: Popular, component-based, good ecosystem
- **Vue.js**: Gentle learning curve, flexible
- **Svelte**: Minimal boilerplate, compiled
- **Flutter**: Cross-platform mobile app

### Backend Options
- **Node.js + Express**: JavaScript full-stack
- **Python + FastAPI**: Fast, modern, easy to use
- **Python + Django**: Batteries-included framework
- **Go**: High performance, compiled

### Database Options
- **PostgreSQL**: Robust, relational, good for structured data
- **MongoDB**: Flexible schema, document-based
- **SQLite**: Simple, embedded, good for single-user apps
- **Firebase**: Real-time, cloud-hosted

### Deployment Considerations
- **Vercel/Netlify**: Easy frontend deployment
- **Heroku/Railway**: Simple full-stack deployment
- **Docker**: Containerized deployment
- **AWS/GCP/Azure**: Full control, scalable

## File References

When referencing code locations, use the format:
```
file_path:line_number
```

Example: `src/services/workout.js:45`

This helps users navigate to specific code locations quickly.

## Questions and Clarifications

When working on this project, don't hesitate to ask questions about:

1. **Requirements**: What exactly should the feature do?
2. **Tech Stack**: What languages/frameworks should be used?
3. **Design Decisions**: How should this be implemented?
4. **User Experience**: How should this work from the user's perspective?
5. **Data Structure**: How should information be organized?
6. **Integration**: How does this fit with existing code?

## Resources

### Fitness/Training Resources
- Progressive overload principles
- Common exercise databases
- Workout programming methodologies
- Rep max calculators (1RM, 3RM, 5RM)

### Development Resources
- Project README: `/home/user/POH/README.md`
- This document: `/home/user/POH/CLAUDE.md`

## Maintenance

This document should be updated when:

1. **Technology Stack Changes**: New frameworks or libraries are added
2. **Conventions Evolve**: Coding standards are established or modified
3. **New Workflows**: Development processes are refined
4. **Major Features**: Significant functionality is added
5. **Lessons Learned**: Important insights from development

Last Updated: 2026-01-19
Version: 1.0.0
