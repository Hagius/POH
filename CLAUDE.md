# CLAUDE.md - AI Assistant Documentation

## Project Overview

**Project Name**: POH - Progressive Overload Tracking Hagius
**Purpose**: Fitness tracking application focused on progressive overload tracking
**Status**: Early development stage
**Owner**: Hagius (nicolas@hagius.de)
**Repository**: https://github.com/Hagius/POH

Progressive overload is a fundamental strength training principle where you gradually increase the stress placed on your body during exercise to continuously improve strength, endurance, and muscle growth.

## Quick Start for AI Assistants

When starting work on this repository:

1. **Verify your branch**: Ensure you're on the correct `claude/*-{sessionId}` branch
2. **Read existing code**: Always use Read tool before modifying files
3. **Plan your work**: Use TodoWrite for complex tasks
4. **Commit frequently**: Make atomic commits with clear messages
5. **Push carefully**: Use `git push -u origin <branch-name>` with retry logic
6. **Security first**: Always check for vulnerabilities before committing

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

### Repository Configuration

**Git Configuration**:
- **Remote Origin**: https://github.com/Hagius/POH
- **Default Branch**: main (not yet created with content)
- **Current Working Branch**: `claude/add-claude-documentation-7mSNm`
- **Commit Signing**: Enabled (SSH-based GPG signing)
- **Proxy**: Local proxy configured for git operations

**Environment**:
- **Working Directory**: `/home/user/POH`
- **Platform**: Linux 4.4.0
- **Git User**: Claude (Anthropic AI)
- **Git Email**: noreply@anthropic.com

**Commit History**:
```
34c4261 - docs: add comprehensive CLAUDE.md documentation
6bd1bfe - Initial commit
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
3. **Branch names MUST**:
   - Start with `claude/`
   - End with matching session ID (e.g., `-7mSNm`)
   - Follow pattern: `claude/feature-description-{sessionId}`
   - **CRITICAL**: Pushes to branches not following this pattern will fail with 403 error

4. **ALWAYS** use descriptive commit messages following this format:
   ```
   <type>: <short description>

   <detailed explanation if needed>
   ```
   Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

5. **GPG Signing**: This repository requires GPG-signed commits (SSH-based, auto-configured)
   - Committer: Claude (noreply@anthropic.com)
   - Signing key: SSH key at `/home/claude/.ssh/commit_signing_key.pub`
   - All commits are automatically signed

6. **Push Strategy**: Use `git push -u origin <branch-name>` for initial pushes

### Git Operations with Retry Logic

**For git push operations**:
- ALWAYS use: `git push -u origin <branch-name>`
- If network errors occur, retry up to 4 times with exponential backoff:
  - 1st retry: wait 2 seconds
  - 2nd retry: wait 4 seconds
  - 3rd retry: wait 8 seconds
  - 4th retry: wait 16 seconds
- Only retry on network failures, NOT on authentication/permission errors

**For git fetch/pull operations**:
- Prefer fetching specific branches: `git fetch origin <branch-name>`
- Apply same retry logic as push (up to 4 times with exponential backoff)
- For pulls use: `git pull origin <branch-name>`

**Example retry implementation**:
```bash
# Push with retry logic
for i in 1 2 3 4; do
  git push -u origin branch-name && break
  sleep $((2 ** i))
done
```

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

### Working with Claude Code Tools

This repository is designed to work with Claude Code, which provides specialized tools:

**Essential Tools**:
- **Read**: Read files before modifying (REQUIRED before using Edit/Write)
- **Edit**: Make targeted changes to existing files
- **Write**: Create new files (only when necessary)
- **Glob**: Find files by pattern (e.g., `**/*.js`)
- **Grep**: Search code content (supports regex)
- **Bash**: Execute shell commands (git, npm, test runners, etc.)
- **TodoWrite**: Track multi-step tasks and show progress
- **AskUserQuestion**: Clarify requirements when needed

**Tool Usage Guidelines**:
1. **Always Read First**: Never edit files you haven't read
2. **Prefer Edit over Write**: Edit existing files rather than creating new ones
3. **Use TodoWrite for Complex Tasks**: Break down multi-step work
4. **Parallel Tool Calls**: Make independent tool calls in parallel for efficiency
5. **No Bash for File Operations**: Use Read/Edit/Write instead of cat/sed/echo
6. **Search Efficiently**: Use Glob for file patterns, Grep for content

**Example Workflow**:
```
1. Read file(s) to understand current state
2. Use TodoWrite to plan changes
3. Edit files incrementally
4. Test changes with Bash
5. Commit with clear message
6. Push to designated branch
```

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

## Troubleshooting

### Common Issues

**Git Push Fails with 403 Error**:
- **Cause**: Branch name doesn't follow required pattern
- **Solution**: Ensure branch name starts with `claude/` and ends with session ID
- **Example**: `claude/add-feature-7mSNm` ✓, `feature/add-feature` ✗

**Network Errors During Push**:
- **Cause**: Temporary network issues
- **Solution**: Implement retry logic with exponential backoff (see Git Operations section)
- **Max retries**: 4 attempts with 2s, 4s, 8s, 16s delays

**Commit Signature Verification Failed**:
- **Cause**: GPG signing configuration issue
- **Solution**: This should be auto-configured; verify with `git config --list | grep gpg`
- **Expected**: SSH-based signing with `/home/claude/.ssh/commit_signing_key.pub`

**File Edit Failed - File Not Read**:
- **Cause**: Attempting to edit a file without reading it first
- **Solution**: Always use Read tool before Edit or Write tools

**Cannot Find Files**:
- **Cause**: Looking for files that don't exist yet in early-stage project
- **Solution**: Check current repository structure; many directories haven't been created yet

### Getting Help

If you encounter issues not covered here:
1. Check git status: `git status`
2. Review recent commits: `git log --oneline -5`
3. Verify branch: `git branch -a`
4. Check remote: `git remote -v`
5. Review configuration: `git config --list`

## Resources

### Fitness/Training Resources
- Progressive overload principles
- Common exercise databases
- Workout programming methodologies
- Rep max calculators (1RM, 3RM, 5RM)

### Development Resources
- Project README: `/home/user/POH/README.md`
- This document: `/home/user/POH/CLAUDE.md`
- GitHub Repository: https://github.com/Hagius/POH

### Tool Documentation
- Claude Code tools are context-aware and provide inline help
- Use tools in parallel when operations are independent
- Always read files before modifying them

## Maintenance

This document should be updated when:

1. **Technology Stack Changes**: New frameworks or libraries are added
2. **Conventions Evolve**: Coding standards are established or modified
3. **New Workflows**: Development processes are refined
4. **Major Features**: Significant functionality is added
5. **Lessons Learned**: Important insights from development
6. **Repository Structure Changes**: New directories or significant files added
7. **Git Configuration Changes**: Branch strategies or signing requirements modified

### Update History

**Version 1.1.0** (2026-01-19):
- Added Quick Start section for AI assistants
- Enhanced Git Operations section with retry logic details
- Added strict branch naming requirements (claude/* with session ID)
- Documented GPG signing configuration (SSH-based)
- Added Repository Configuration section with environment details
- Added Working with Claude Code Tools section
- Added Troubleshooting section with common issues
- Expanded Resources section
- Updated commit history

**Version 1.0.0** (2026-01-19):
- Initial CLAUDE.md creation
- Project overview and structure documentation
- Git workflows and conventions
- Code conventions and testing guidelines
- AI assistant guidelines
- Progressive overload domain knowledge
- Technology stack considerations

---

Last Updated: 2026-01-19
Version: 1.1.0
Author: Claude (Anthropic AI)
