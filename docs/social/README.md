# Social kit

What a bot needs to draft posts and pictures for the Intus account on X without saying anything untrue, unsafe or unapproved. Nothing here posts anywhere.

| File | What it is |
| --- | --- |
| `facts.md` | The only facts a post may use, each with its source, and a list of what is never allowed |
| `voice.md` | Voice, the three post formats, the picture rules, and what the account never does |
| `grok-bot-routine.md` | The brief to paste into Grok Bot, the rollout stages and the one-time setup |
| `photoassets.md` | The 20 hosted pictures Buffer posts: what each one shows now, its fact ids, and what changed in version 3. Also the 9 wordless pre-launch pictures, 4K, with their alt text |
| `cards.example.json` | Three example cards in the format the renderer reads |
| `../../scripts/social-cards.ts` | Checks cards against the rules, then draws each as a PNG in the brand's paper, ink and red |
| `../../scripts/social_ascii.py` | Draws the nine wordless pre-launch pictures: one object each in ASCII on a red, paper or ink ground |

## Draw the pictures

```
npm i --no-save playwright-core
CHROMIUM_PATH=/path/to/chrome node scripts/social-cards.ts docs/social/cards.example.json --out social-out --size both
```

`CHROMIUM_PATH` is only needed if Playwright has no browser of its own. Pictures and the post text land in `social-out/`, which git ignores. Drafts that have not been approved stay out of git, because the repository is public.

The checks that run before anything is drawn: the post is at most 280 characters (a link counts as 23), the card has alt text, every fact id exists in `facts.md`, and no field contains a long dash, an emoji, a price or plan, a medical claim, the word AI or another product's name. `test/socialCards.test.ts` pins those rules.

## Wordless pre-launch pictures

Nine pictures with no words: one object each (an hourglass, the mark, a capsule, a dot trail, a crescent moon, three capsules, a bottle with a blank label, a ring, a test tube), drawn as ASCII on a red, paper or ink ground. They are 4:5 for Instagram, with a square crop of each for X, and `grid.png` shows the nine as a profile grid. Post 09 first and 01 last to get that grid.

```
npm i --no-save @fontsource/jetbrains-mono && pip install pillow numpy fonttools
python3 -c "from fontTools.ttLib import TTFont; f = TTFont('node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff'); f.flavor = None; f.save('/tmp/JetBrainsMono-Bold.ttf')"
python3 scripts/social_ascii.py --font /tmp/JetBrainsMono-Bold.ttf --out social-out/prelaunch
```

The pictures land in `social-out/prelaunch/`, 3840 by 4800 (4K wide), with the square crops in `x/`. Use `--width 1080` for a quick draft. The approved set is hosted at `/photoassets` (see `photoassets.md`). None has words, numbers, people or data, in line with `voice.md`. Each one still needs a person's approval, and a caption that passes `facts.md` and `voice.md`, before anything is posted.

## Other ways to post

Grok Bot drives X in a browser as the signed-in person. The alternative is X's API, which X sells as pay per use with no free tier. Third-party pricing pages put a post at about $0.015, and about $0.20 when it carries a link. Those figures come from blogs, not from X, so check the developer console before budgeting. X's rules ask an automated account to switch on the "Automated" label and say in its bio who runs it, and they restrict automatic replies, likes, direct messages and posts about trending topics. The AI-reply part of those rules needs X's prior written approval. The rule text was only partly readable when this was written, so read the current rules before any API route.
