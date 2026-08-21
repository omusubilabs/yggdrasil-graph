/**
 * Enforces this repo's commit-message convention (CLAUDE.md § Commit
 * messages): a single-line, imperative `type(scope): summary` subject, and —
 * if there's a body — short `-` bullets, one physical line each, never prose
 * and never a wrapped continuation line.
 *
 * Invoked as a `commit-msg` git hook via .githooks/commit-msg, which git
 * calls with the path to a file holding the message being committed.
 */
import { readFileSync } from 'node:fs';

const SUBJECT_MAX = 72;
const BULLET_MAX = 100;
const SUBJECT_PATTERN = /^[a-z][a-z-]*(\([^()]+\))?: \S.*$/;
const TRAILER_PATTERN = /^[A-Za-z][A-Za-z-]*: \S/;

const path = process.argv[2];
if (!path) {
  console.error('check-commit-msg: no message file given (run via .githooks/commit-msg)');
  process.exit(1);
}

const raw = readFileSync(path, 'utf8');
// Git strips '#' comment lines itself for an editor-authored message, but not
// for `-m`/`-F`, so drop them here too rather than trusting the caller.
const lines = raw.split('\n').filter((line) => !line.startsWith('#'));
while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

const errors: string[] = [];

const subject = lines[0] ?? '';
if (subject.trim() === '') {
  errors.push('subject line is empty.');
} else {
  if (subject.length > SUBJECT_MAX) {
    errors.push(
      `subject is ${subject.length} chars, over the ${SUBJECT_MAX}-char limit: "${subject}"`,
    );
  }
  if (subject.endsWith('.')) {
    errors.push(`subject ends with a period — drop it: "${subject}"`);
  }
  if (!SUBJECT_PATTERN.test(subject)) {
    errors.push(
      `subject doesn't match "type(scope): summary" (lowercase type, optional scope): "${subject}"`,
    );
  }
}

if (lines.length > 1) {
  if (lines[1] !== '') {
    errors.push('line 2 must be blank, separating the subject from the body.');
  }

  let previousWasBullet = false;
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === '') {
      previousWasBullet = false;
      continue;
    }
    if (line.startsWith('- ')) {
      if (line.length > BULLET_MAX) {
        errors.push(
          `body bullet is ${line.length} chars, over the ${BULLET_MAX}-char limit — shorten it, don't wrap it: "${line}"`,
        );
      }
      previousWasBullet = true;
      continue;
    }
    if (TRAILER_PATTERN.test(line)) {
      previousWasBullet = false;
      continue;
    }
    if (previousWasBullet && /^\s/.test(line)) {
      errors.push(
        `line ${i + 1} reads like a wrapped continuation of the bullet above ("${line.trim()}") — keep each bullet on one physical line; shorten the wording instead of wrapping.`,
      );
    } else {
      errors.push(
        `line ${i + 1} is neither a "- " bullet nor a trailer line — CLAUDE.md wants short bullets, not prose: "${line}"`,
      );
    }
    previousWasBullet = false;
  }
}

if (errors.length > 0) {
  console.error(`\n  commit message doesn't match CLAUDE.md's "Commit messages" convention:\n`);
  for (const e of errors) console.error(`    ✗ ${e}`);
  console.error('');
  process.exit(1);
}
