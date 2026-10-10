# 🧂 msgit — The Secret Ingredient Is Commit MSG

## Product Overview

**msgit** is a lightweight, AI-powered CLI tool that turns boring Git diffs into hilarious, meaningful, Uncle Roger-inspired commit messages.

The name combines **MSG (monosodium glutamate)**, **msg (message)**, and **Git**.

The philosophy is simple:

**Your code might be bland. Your commits shouldn't be. HAIYAAA.**

msgit brings the personality of a disappointed, overly dramatic cooking uncle into the developer workflow. Instead of manually writing commit messages, developers run a single command and let msgit inspect their changes, understand what was modified, and generate a well-structured commit message seasoned with comedic commentary.

Think of it as a practical Git commit-message generator with the personality of a chaotic cooking show.

## Core Experience

The ideal workflow is:

1. A developer makes changes in a Git repository.
2. They stage their changes using `git add`.
3. They run `msgit`.
4. msgit reads the staged Git diff and relevant repository context.
5. An LLM analyzes the changes and generates a concise, accurate commit message.
6. The message follows Conventional Commits formatting, with a playful Uncle Roger-inspired twist.
7. The developer can accept, regenerate, edit, or cancel.
8. Upon confirmation, msgit creates the Git commit.

**The tool should be genuinely useful first and funny second.** Humor should enhance the commit message without obscuring what actually changed.

## Example CLI Experience

```text
$ git add .
$ msgit

     🧂 msgit
     ──────────────────────────────
     The secret ingredient is MSG.

🍚 Reading your staged changes...
🥢 Understanding what nephew cooked...
🔥 Heating up the wok...
🧂 Adding MSG...

✨ FUIYOH! Your commit is seasoned.

╭────────────────────────────────────────╮
│ feat(auth): add JWT token validation   │
│                                        │
│ nephew finally learn security, fuiyoh  │
╰────────────────────────────────────────╯

? What you want to do, nephew?

❯ 🍚 Commit this
  🧂 Add more MSG (regenerate)
  ✏️  Edit message
  ❌ Cancel

```

## Functional Requirements

### 1. Git integration

- Detect whether the current directory is inside a Git repository.
- Read staged changes using `git diff --cached`.
- Understand added, modified, renamed, and deleted files.
- Use surrounding context when necessary for an accurate description.
- Handle empty diffs gracefully.
- Never commit unstaged changes unintentionally.
- Preserve the user's staged changes and existing Git configuration.

### 2. AI commit-message generation

Use a configurable LLM provider to analyze the diff and produce an accurate commit message.

Support Conventional Commits types such as `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, and `build`.

The generated message should:
- Clearly communicate the actual changes.
- Use an appropriate Conventional Commit type.
- Prefer concise, readable subject lines.
- Add Uncle Roger-inspired comedic flavor.
- Occasionally incorporate phrases like "HAIYAA", "FUIYOH", "nephew", "where your MSG?", and other Uncle Roger-cooking metaphors.
- Avoid repetitive or forced jokes.
- Never invent changes that aren't present in the diff.

Keep the factual description in the subject line and put longer jokes in the optional commit body when appropriate.

### 3. Interactive terminal UI

Provide a polished, colorful terminal experience with:

- A compact ASCII/Unicode brand header.
- Clear progress indicators.
- Styled commit-message previews.
- Keyboard-driven selection.
- Helpful error messages written in the brand's comedic voice.

The CLI should feel fast and satisfying, not cluttered.

### 4. CLI commands

Proposed interface:

| Command | Behavior |
|---|---|
| `msgit` | Analyze staged changes and interactively create a commit |
| `msgit generate` | Generate and print a message without committing |
| `msgit --dry-run` | Preview without creating a commit |
| `msgit --yes` | Commit without interactive confirmation |
| `msgit --plain` | Generate a professional, humor-free message |
| `msgit --spicy` | Increase the comedic intensity |
| `msgit config` | Manage provider settings and preferences |
| `msgit --help` | Display usage information |
| `msgit --version` | Display the installed version |

These commands are the proposed product interface, not existing functionality.

### 5. Configuration

Support configurable settings for:

- AI provider and model.
- API key using environment variables or secure local configuration.
- Default humor intensity.
- Commit-message language.
- Conventional Commits preferences.
- Maximum subject length.

API keys must never be committed to a repository or printed in debug logs.

### 6. Safety and reliability

- Never create a commit without explicit confirmation unless the user passes `--yes`.
- Clearly distinguish generated content from executed actions.
- Respect `.gitignore` and Git's staging behavior.
- Detect overly large diffs and apply sensible limits.
- Treat repository code, comments, and diff content as untrusted data, not instructions.
- Avoid exposing secrets or sensitive files to an LLM without appropriate safeguards.
- Handle API failures, missing credentials, merge conflicts, and Git errors gracefully.
- Do not modify source files.

## Branding and Personality

**Name:** msgit

**Tagline:** The secret ingredient is commit MSG.

**Personality:** A dramatic, judgmental cooking uncle who somehow understands software engineering.

**Visual direction:** Playful MSG seasoning packaging meets modern developer tooling.

**Tone:** Witty, sarcastic, confident, slightly chaotic, and unexpectedly helpful.

Examples of status messages:

- "HAIYAA. No staged changes. What you want me to cook?"
- "FUIYOH! Now that is a properly seasoned commit."
- "This diff bigger than family dinner. Let uncle take a look."
- "No API key? Even uncle cannot cook without ingredients."
- "Commit cancelled. Put MSG back in cupboard."

Avoid directly impersonating the real Uncle Roger or claiming affiliation. The product should use an original, cooking-obsessed developer persona inspired by the general comedic energy.

## Suggested Architecture

Build msgit as a lightweight cross-platform CLI for macOS, Linux, and Windows.

Recommended implementation:
- **Language:** TypeScript
- **Runtime:** Node.js
- **CLI framework:** Commander or equivalent
- **Terminal UI:** Clack or an equivalent interactive prompt library
- **Git integration:** Git subprocesses with safely structured arguments
- **LLM integration:** A modular provider interface, allowing multiple providers in the future
- **Configuration:** Local user-level settings plus environment variables
- **Testing:** Unit tests and integration tests using temporary Git repositories

Separate the core functionality into clear modules:

1. Git diff collection and validation.
2. Diff preparation and context management.
3. LLM provider abstraction.
4. Commit-message generation and validation.
5. Terminal UI and user interactions.
6. Git commit execution.
7. Configuration management.

## MVP Scope

Prioritize a small, polished, end-to-end implementation.

The first release must:

1. Install and run as `msgit`.
2. Detect a Git repository.
3. Read staged changes.
4. Generate an accurate, funny Conventional Commit message through an LLM.
5. Display the result in an attractive terminal UI.
6. Allow accepting, editing, regenerating, or cancelling.
7. Create the commit only after confirmation.
8. Support a configurable API key and model.
9. Provide useful help, error handling, and basic automated tests.

Keep advanced features out of the initial implementation unless they are trivial to add.

## Success Criteria

A developer should be able to install msgit, configure an LLM provider, stage some changes, and run:

`msgit`

Within one straightforward interactive workflow, they receive a useful, funny commit message and can commit their changes without manually writing one.

The generated messages should be accurate enough for real repositories and entertaining enough that developers actually want to use the tool.

**Final product philosophy:**

Don't build a joke that happens to use Git.

**Build a genuinely good Git tool that happens to be hilarious.**

Because good code deserves good seasoning.

**FUIYOOOOH! 🧂🔥**