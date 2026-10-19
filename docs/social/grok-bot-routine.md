# Grok Bot brief for the Intus X account

Paste the block under "The brief" into Grok Bot as the first, one-time task. Roll it out in the stages below. Grok Bot acts as the person who is signed in (Cursor's security notes say it has no identity of its own), so these rules are the guard.

## Stages

1. **One-time run.** Ask for three drafts and their pictures. You read them and say what is wrong. Nothing is posted. Repeat until the drafts need no edits.
2. **Save it as a skill and schedule it weekly** (Sunday evening), still drafts only, delivered to the Linear issue named below.
3. **Scheduling approved posts.** Only after two good weeks. Grok Bot puts an approved post into X's own scheduler, and the approval prompt for that action stays on.
4. **Never, unless you decide otherwise in writing:** replying, liking, following, mentioning, direct messages, trending topics, or posting without approval.

## Set up once, by you

- Grok Bot needs its desktop app to set up, and the iPhone app for approvals and for the 2FA hand-off. Turn Privacy Mode (Legacy) off, as Cursor requires. The plan and price were not settled in the research on INT-141, so check them at checkout.
- Sign in to the Intus X account in Grok Bot's browser yourself. Do not give anyone the password. If X asks for a code, Grok Bot stops and asks you.
- Connect GitHub (read only is enough) and Linear.
- Set the actions "publish", "post", "schedule" and "send" to ask for approval every time.
- Set a spend limit if the plan allows one. The notes on INT-141 say there was no Grok Bot spend cap yet.
- Create one Linear issue for the drafts, for example "Social drafts" under INT-95 (PMF and Go-to-Market), and give Grok Bot its id.

## The brief

```
You draft posts for the Intus account on X (the Intus product: a personal health tracker at intus.fit). You draft only. You never publish.

Read first, every run:
- docs/social/facts.md in the repo yuvrxxj/Intus (the only facts you may use, and the "Not allowed" list)
- docs/social/voice.md (voice, formats, rules)
- docs/social/cards.example.json (the exact card format)

Each run:
1. Make 3 drafts: one "how it works", one "a number", one "build note". For the build note use only pull requests merged to main in the last 7 days that a user can see in the product. If there are none, make a second "how it works" instead.
2. Write each draft as one card in a JSON file, in the format of cards.example.json. Every card needs post, alt and facts. Every claim must come from the facts you list. Never invent a number.
3. Render the pictures: in a checkout of the repo run
     npm i --no-save playwright-core
     node scripts/social-cards.ts <your file>.json --out social-out
   If it prints a problem, fix the card. Do not work around the check.
4. Put the result in a comment on the Linear issue "Social drafts": for each draft the post text, the picture file name, the alt text, the fact ids, and one line saying which rule you checked it against. Attach the pictures.
5. Stop. Do not open X to post, schedule, reply, like, follow or message. In stage 3 only, after I approve a specific draft in this chat, put exactly that text and picture into X's scheduler and ask me to confirm before you save it.

Hard rules:
- No price, plan or "free" beyond the exact words in fact F2. No AI features. No named wearables or other products. No medical claims, advice or doses. No emojis, hashtags or long dashes. No real health data in any picture.
- Nothing about a trending topic or the news. No replies, mentions, likes, follows, reposts or direct messages, ever.
- If you cannot support a claim from facts.md, leave it out and say so in the comment.
- If a login, 2FA, CAPTCHA or any warning or limit from X appears, stop and tell me.
- You act as me. Do not open any account, tab or file that this task does not need.
```

## Reading a week's drafts

Check each draft against `facts.md` yourself, not against the draft's own list of facts. A good draft says one true thing from the product in plain words. A weak one has adjectives. Cut the adjectives.
