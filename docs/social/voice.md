# Voice and rules for posts

What a post for the Intus account on X sounds like, and the lines it never crosses. `scripts/social-cards.ts` checks the rules a program can check. A person checks the rest before anything goes out.

## Voice

- Plain, short, specific. One idea per post. Say what Intus does and how, in the words the product uses.
- Honest about limits. The strongest lines are the ones where Intus says what it will not do ("never colours a change good or bad", "never predicts ovulation"). Use them.
- Sentence case. No exclamation marks, no emojis, no hashtags, no questions that bait replies, no long dashes.
- The brand line is "Your health, in plain numbers." Use it sparingly, as a sign-off, not in every post.
- Write as the people who build it ("we"), never as a doctor and never as the product speaking to the reader about their body.

## Formats

1. **How it works.** One fact from `facts.md` as a `list` or `statement` card.
2. **A number.** One real number from `facts.md` as a `number` card, with the context that keeps it honest ("10 logged days a side", "one report").
3. **Build note.** What shipped to production this week and can be seen by a user, from merged pull requests and Done issues in Linear. Nothing in progress, nothing internal.

Start with three posts a week, one of each, and never more than one a day. A link to intus.fit goes in a build note at most. The profile carries the link otherwise.

## Pictures

- Made with `scripts/social-cards.ts`: paper, ink and red, Inter and JetBrains Mono, the mark top left, INTUS.FIT bottom left. 1200 by 675 for the feed, 1080 square when wanted.
- No stock photos, no pictures of bodies, no before and after photos, no AI-generated people, no charts with invented numbers.
- Every picture has alt text that says what it shows and says.

## Never, in any post

- Reply to anyone, quote anyone, mention anyone, like, follow, repost or send a direct message.
- Post about a trending topic or an event in the news.
- Say anything that is not in `facts.md`, or anything on its "Not allowed" list.
- Post without a person's approval of that exact text and picture.

## Why these limits

Health claims are regulated and the advice on target markets is still open (INT-36). X restricts automated activity, and a restricted account cannot be fixed with a pull request. A post that reads like medical advice or a promise costs more than a quiet week.
