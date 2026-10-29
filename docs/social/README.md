# Social kit

What a bot needs to draft posts and pictures for the Intus account on X without saying anything untrue, unsafe or unapproved. Nothing here posts anywhere.

| File | What it is |
| --- | --- |
| `facts.md` | The only facts a post may use, each with its source, and a list of what is never allowed |
| `voice.md` | Voice, the three post formats, the picture rules, and what the account never does |
| `grok-bot-routine.md` | The brief to paste into Grok Bot, the rollout stages and the one-time setup |
| `photoassets.md` | The 20 hosted pictures Buffer posts: what each one shows now, its fact ids, and what changed in version 3 |
| `cards.example.json` | Three example cards in the format the renderer reads |
| `../../scripts/social-cards.ts` | Checks cards against the rules, then draws each as a PNG in the brand's paper, ink and red |

## Draw the pictures

```
npm i --no-save playwright-core
CHROMIUM_PATH=/path/to/chrome node scripts/social-cards.ts docs/social/cards.example.json --out social-out --size both
```

`CHROMIUM_PATH` is only needed if Playwright has no browser of its own. Pictures and the post text land in `social-out/`, which git ignores. Drafts that have not been approved stay out of git, because the repository is public.

The checks that run before anything is drawn: the post is at most 280 characters (a link counts as 23), the card has alt text, every fact id exists in `facts.md`, and no field contains a long dash, an emoji, a price or plan, a medical claim, the word AI or another product's name. `test/socialCards.test.ts` pins those rules.

## Other ways to post

Grok Bot drives X in a browser as the signed-in person. The alternative is X's API, which X sells as pay per use with no free tier. Third-party pricing pages put a post at about $0.015, and about $0.20 when it carries a link. Those figures come from blogs, not from X, so check the developer console before budgeting. X's rules ask an automated account to switch on the "Automated" label and say in its bio who runs it, and they restrict automatic replies, likes, direct messages and posts about trending topics. The AI-reply part of those rules needs X's prior written approval. The rule text was only partly readable when this was written, so read the current rules before any API route.
