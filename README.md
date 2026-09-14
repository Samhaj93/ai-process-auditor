# AI Process Auditor

Describe a business process in plain language and get back its steps, where work waits, its **flow efficiency** (how much of the total time is actual work), its bottlenecks and waste, a process diagram, and a proposed redesign with before and after figures.

> **Status:** all four stages work: finding the steps, spotting bottlenecks and waste, drawing the process diagram, and proposing a redesign.

It runs on your own machine and costs nothing. You bring your own free API key.

## What you need

- **Node.js 20.9 or newer.** Check with `node --version`. Download from [nodejs.org](https://nodejs.org).
- **A free OpenRouter account.** No card needed.

## Set up

```bash
git clone https://github.com/Samhaj93/ai-process-auditor.git
cd ai-process-auditor
npm install
npm run dev
```

Then open **http://localhost:3000**. Leave that terminal window open while you use the app; closing it stops the app.

## Get a free key

1. Sign up at [openrouter.ai](https://openrouter.ai).
2. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
3. **Turn on free models.** At [openrouter.ai/settings/privacy](https://openrouter.ai/settings/privacy), enable the setting that allows free endpoints which may train on your inputs. Without it, free models refuse every request. Read [Privacy](#privacy) before you do this.
4. Paste the key into the **API key** field in the app.

## Using it

1. Describe the process: who does what, how long each part takes, and where things wait.
2. Press **Analyse**.
3. Read the result, top to bottom:
   - **Flow efficiency**: the share of total time that is actual work.
   - **Waste**: recoverable minutes in each of the eight Lean waste categories. A dash means none was found.
   - **Process diagram**: the process as a standard BPMN flowchart, with each step's owner in its box and bottlenecks outlined. Drag to move around it.
   - **Steps**: every step with its working and waiting time. Bottlenecks are marked on the step where they occur, with a thick left edge and the evidence behind them.
4. Press **Propose a redesign** at the bottom if you want one. You get:
   - **Before and after**: flow efficiency, lead time, process time and step count side by side, with the change worked out for you.
   - **Changes**: each proposed change, the bottleneck or waste it tackles, its effort and risk, and its estimated saving.
   - **Redesigned process diagram**: the proposed process, drawn the same way as the current one.
5. Press **Download JSON** to keep everything, including both diagrams' data. Nothing is saved, so refreshing the page clears the result.

The steps and the diagram appear first. Bottlenecks and waste follow in a second request. If that part fails, the steps and diagram stay on screen and you can press **Retry diagnosis**. The redesign only runs when you press its button.

The "after" figures are calculated from the redesigned steps, the same way as the "before" figures. They are not the model's estimate. Only each change's individual saving is estimated.

Press **Show worked example** to see a finished result, including a redesign, without a key.

**Tip:** the more you say about waiting (queues, overnight delays, approvals sitting with someone), the better the result.

## Limits of the free setup

- **Free keys are capped at 50 requests a day** per OpenRouter account. An analysis makes two: one for the steps, one for bottlenecks and waste. A redesign makes one more. Retries count too. So expect about 16 full analyses with redesigns a day, or 25 without. Adding $10 of credit raises the cap to 1,000 requests. The process diagrams are drawn on your own computer and use none of them.
- **A redesign is slow on the free model**: one to three minutes.
- **Free models sometimes get it wrong.**
  - The most common mistake is missing the waiting time, which makes flow efficiency read 100%. The app shows a **Check this result** warning.
  - Finding bottlenecks and waste fails more often than finding the steps. Press **Retry diagnosis**. When the findings contain figures that can't be true, the app shows **Check these findings**.
  - A redesign fails about one time in three. Press **Try again**. When a redesign doesn't add up, the app shows **Check this redesign**.
  - Paid models do markedly better. Type a paid model name into the **Model** field. Paid models need credit on your account.
- **Descriptions up to 8,000 characters**, about 1,200 words.

## Privacy

- **Your key** stays in the browser tab. It is sent with each request and never stored or logged by the app. Closing the tab clears it.
- **Your description** goes to OpenRouter and on to whichever company runs the model. On free models, that company may use it for training. **Don't describe anything confidential while using a free model.**
- **Nothing is saved.** No database, no accounts. Results exist only on your screen and in the files you download.

## Troubleshooting

| You see | What it means | What to do |
|---|---|---|
| The page at localhost:3000 won't load | The app isn't running | Run `npm run dev` again and keep that window open |
| `key rejected` | The key is wrong or was deleted | Create a new key and paste it again |
| `rate limited — free models are shared and capped per day` | You've used today's 50 requests, or the free model is busy | Try again later, or tomorrow |
| `free models are switched off in your OpenRouter privacy settings` | The setting in step 3 is off | Turn it on at [openrouter.ai/settings/privacy](https://openrouter.ai/settings/privacy) |
| `request failed` | Something else went wrong with the request | Try again. If it keeps happening, check the model name in the **Model** field |
| `returned an empty response after 3 attempts` | The free model is overloaded | Wait a minute and try again |
| `does not match the schema` | The model returned something unusable | Run it again |
| **Check this result** | The steps are probably missing information | Run it again, or add more detail about waiting |
| **Bottlenecks and waste not found** | The second request failed. The steps are unaffected | Press **Retry diagnosis** |
| **Check these findings** | Some bottleneck or waste figures can't be true | Press **Retry diagnosis**, or use a paid model |
| **Redesign not produced** | The redesign request failed. Everything above it is unaffected | Press **Try again** |
| **Check this redesign** | The redesign doesn't shorten the process, its savings don't add up, or it removes work customers pay for | Press **Propose another redesign**, or use a paid model |
| **The diagram could not be drawn** | Drawing failed in your browser. The steps and findings are unaffected | Refresh the page and run it again |

## For developers

```bash
npm test        # offline tests, no key or network needed
npm run lint
npm run build
```

- `app/api/extract/route.ts`, `app/api/diagnose/route.ts` and `app/api/redesign/route.ts`: the three server endpoints, one per AI stage
- `lib/callModel.ts`: the only code that talks to an AI provider
- `lib/prompts/`: the instructions sent to the model for each AI stage
- `lib/schema.ts`: the data shape, and the checks every result must pass
- `lib/quality.ts`: flags results that pass the checks but look implausible
- `lib/bpmn.ts`: builds the process diagrams from the steps, in code rather than with AI

Architecture rules and project decisions live in [CLAUDE.md](CLAUDE.md). Read it before changing anything.

## Licence

MIT. See [LICENSE](LICENSE). The diagrams are drawn with [bpmn-js](https://bpmn.io), whose licence requires its bpmn.io watermark to stay visible on each diagram.
