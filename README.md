# AI Process Auditor

Describe a business process in plain language and get back its steps, where work waits, its **flow efficiency** (how much of the total time is actual work), its bottlenecks and waste, and a process diagram.

> **Status:** stage 3 of 4. Finding the steps, measuring flow efficiency, spotting bottlenecks and waste, and drawing the process diagram all work. Redesign proposals are not built yet.

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

Then open **http://localhost:3000**.

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
4. Press **Download JSON** to keep it, including the diagram as BPMN 2.0 XML. Nothing is saved, so refreshing the page clears the result.

The steps and the diagram appear first. Bottlenecks and waste follow in a second request. If that part fails, the steps and diagram stay on screen and you can press **Retry diagnosis**.

Press **Show worked example** to see a finished result without a key.

**Tip:** the more you say about waiting (queues, overnight delays, approvals sitting with someone), the better the result.

## Limits of the free setup

- **About 25 analyses a day** per OpenRouter account. Free keys are capped at 50 requests a day, and each analysis makes two: one for the steps, one for bottlenecks and waste. Retries count too. Adding $10 of credit raises the cap to 1,000 requests. The process diagram is drawn on your own computer and uses none of them.
- **Free models sometimes get it wrong.**
  - The most common mistake is missing the waiting time, which makes flow efficiency read 100%. The app shows a **Check this result** warning.
  - Finding bottlenecks and waste fails more often than finding the steps. Press **Retry diagnosis**. When the findings contain figures that can't be true, the app shows **Check these findings**.
  - Paid models do markedly better. Type a paid model name into the **Model** field. Paid models need credit on your account.
- **Descriptions up to 8,000 characters**, about 1,200 words.

## Privacy

- **Your key** stays in the browser tab. It is sent with each request and never stored or logged by the app. Closing the tab clears it.
- **Your description** goes to OpenRouter and on to whichever company runs the model. On free models, that company may use it for training. **Don't describe anything confidential while using a free model.**
- **Nothing is saved.** No database, no accounts. Results exist only on your screen and in the files you download.

## Troubleshooting

| You see | What it means | What to do |
|---|---|---|
| `key rejected` | The key is wrong or was deleted | Create a new key and paste it again |
| `rate limited — free models are shared and capped per day` | You've used today's 50 requests, or the free model is busy | Try again later, or tomorrow |
| `free models are switched off in your OpenRouter privacy settings` | The setting in step 3 is off | Turn it on at [openrouter.ai/settings/privacy](https://openrouter.ai/settings/privacy) |
| `request failed` | Something else went wrong with the request | Try again. If it keeps happening, check the model name in the **Model** field |
| `returned an empty response after 3 attempts` | The free model is overloaded | Wait a minute and try again |
| `does not match the schema` | The model returned something unusable | Run it again |
| **Check this result** | The steps are probably missing information | Run it again, or add more detail about waiting |
| **Bottlenecks and waste not found** | The second request failed. The steps are unaffected | Press **Retry diagnosis** |
| **Check these findings** | Some bottleneck or waste figures can't be true | Press **Retry diagnosis**, or use a paid model |
| **The diagram could not be drawn** | Drawing failed in your browser. The steps and findings are unaffected | Refresh the page and run it again |

## For developers

```bash
npm test        # offline tests, no key or network needed
npm run lint
npm run build
```

- `app/api/extract/route.ts` and `app/api/diagnose/route.ts`: the two server endpoints, one per AI stage
- `lib/callModel.ts`: the only code that talks to an AI provider
- `lib/schema.ts`: the data shape, and the checks every result must pass
- `lib/quality.ts`: flags results that pass the checks but look implausible
- `lib/bpmn.ts`: builds the process diagram from the steps, in code rather than with AI

Architecture rules and project decisions live in [CLAUDE.md](CLAUDE.md). Read it before changing anything.

## Licence

MIT. See [LICENSE](LICENSE). The diagram is drawn with [bpmn-js](https://bpmn.io), whose licence requires its bpmn.io watermark to stay visible on the diagram.
