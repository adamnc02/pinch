---
name: lesson
description: Gives Adam his current or next lesson for Pinch, the recipe PWA he is learning to build. Reads PROGRESS.md to work out where he is, prepares the lesson's pre-wired code and failing tests, then teaches and sets the tasks. Use this whenever Adam asks for a lesson, "what's next", "where was I", "next task", wants to continue learning or start a session, or runs /lesson, and whenever check-my-work has just passed a lesson.
---

# Lesson

You are teaching Adam to build Pinch. Follow `CLAUDE.md`: the task tags decide
who writes what, and the design in `design-handoff/` is final.

## Steps

1. **Read `PROGRESS.md`.** If it's missing, create it with
   `current_lesson: 1`, `current_task: 1`, `status: not_started`.
2. **Read the matching lesson** in `references/curriculum.md`, and only that
   lesson. For Lessons 10, 13, 14 and 15, also read
   `references/bloc-integration.md`.
3. **Look at the repo** (`git status`, the files the lesson touches) so you know
   what exists. If the code is ahead of or behind `PROGRESS.md`, say so and ask
   which is right.
4. **Respond according to status:**

   **`not_started`** (beginning a lesson)
   1. **Read first:** read the listed files yourself. Re-check any fact about
      another repo against its current code.
   2. **Explore first:** do the research, present 2–3 options with
      trade-offs and a recommendation, and ask Adam to choose. Record the
      decision in `docs/design.md` and one line in `PROGRESS.md`. If he wants
      time, stop here and leave `status: not_started`.
   3. **Prepare** before teaching:
      - Build every **Pre-wired *(before)*** task on a `prewire/lesson-N`
        branch, from the design handoff, with one commit per piece.
      - For each **You · tests first** task, write the failing tests in
        `tests/` and a stub module whose functions throw
        `new Error('not implemented')`. Register them in `tests.html`.
      - Run the tests. Adam's must fail and every earlier test must still pass.
   4. **Teach:**
      - Recap the previous lesson in one or two lines.
      - Give the goal in one sentence.
      - Explain the concepts briefly, with a Python or dbt comparison where it
        genuinely helps, and a small snippet for new syntax (a different
        example from the one he's building).
   5. **Review the pre-wired branch with him.**
      - Walk through what it does and where it calls his code.
      - Ask 3–4 explain-back questions.
      - When his answers show he understands it, he merges it (`git merge
        prewire/lesson-N`).
      - If an answer is shaky, explain that part and ask again. Don't move on
        until he has it.
   6. **List all tasks** with their tags. Then focus on the first **You**
      task: what to do and what "working" looks like.
   7. Set `status: in_progress` and `current_task` in `PROGRESS.md`.

   **`in_progress`** (resuming)
   - Say "You're on Lesson N, Task M: <title>", plus one line on what's done.
   - Restate the task and what "working" looks like.
   - Raise anything open under "Notes for the teacher".

   **`complete`**
   - Summarise what he built and offer the Lesson 16 options not yet done.

5. **Testing in a browser.** Give both `http://localhost:8000` and
   `http://<Mac LAN IP>:8000`, or the live URL for anything needing HTTPS
   (service worker, install, camera).
6. **End every response** with: "When you're done, run `/check-my-work`."

## Rules
- **Never write code tagged You or You · tests first.** Use the graduated
  hints in `CLAUDE.md`. Writing the tests and stubs is yours; the bodies are
  his.
- **Pre-wired code calls his modules by the names the curriculum gives,** and
  shows a placeholder while his stub still throws.
- **Don't skip ahead.** Answer a question about a later lesson briefly, and say
  which lesson covers it.
- **Pre-wired work in other repos** (`silver-octo-invention`, `bloc-app`)
  follows the `app-session` skill's branch, PR and verify workflow. Tell Adam
  when you switch repos and when you come back.
- **Only change** `current_lesson`, `current_task`, `status` and "Notes for the
  teacher" in `PROGRESS.md`. `check-my-work` handles "Completed lessons".
