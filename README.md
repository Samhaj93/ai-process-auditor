# AI Process Auditor

Describe a business process in plain language and get back its steps, where work waits, and its **flow efficiency**: how much of the total time is actual work.

> **Status:** stage 1 of 4. Finding the steps and measuring flow efficiency works. Bottleneck and waste detection, the process diagram, and redesign proposals are not built yet.

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
3. Read the result: flow efficiency, then a table of steps with their working time and waiting time.
4. Press **Download JSON** to keep it. Nothing is saved, so refreshing the page clears the result.

Press **Show worked example** to see a finished result without a key.

**Tip:** the more you say about waiting (queues, overnight delays, approvals sitting with someone), the better the result.

## Limits of the free setup

- **50 analyses a day** per OpenRouter account. Adding $10 of credit raises this to 1,000.
- **Free models sometimes get it wrong.** The most common mistake is missing the waiting time, which makes flow efficiency read 100%. When a result looks like that, the app shows a **Check this result** warning. Run it again, add more detail, or type a paid model name into the **Model** field. Paid models need credit on your account.
- **Descriptions up to 8,000 characters**, about 1,200 words.

## Privacy

- **Your key** stays in the browser tab. It is sent with each analysis and never stored or logged by the app. Closing the tab clears it.
- **Your description** goes to OpenRouter and on to whichever company runs the model. On free models, that company may use it for training. **Don't describe anything confidential while using a free model.**
- **Nothing is saved.** No database, no accounts. Results exist only on your screen and in the files you download.

## Troubleshooting

| You see | What it means | What to do |
|---|---|---|
| `key rejected` | The key is wrong or was deleted | Create a new key and paste it again |
| `rate limited — free models are shared and capped per day` | You've used today's 50 analyses, or the free model is busy | Try again later, or tomorrow |
| `request failed` | Can mean the free-model setting in step 3 is off | Check [openrouter.ai/settings/privacy](https://openrouter.ai/settings/privacy) |
| `returned an empty response after 3 attempts` | The free model is overloaded | Wait a minute and try again |
| `does not match the schema` | The model returned something unusable | Run it again |
| **Check this result** | The result is probably missing information | Run it again, or add more detail about waiting |

## For developers

```bash
npm test        # 33 offline tests, no key or network needed
npm run lint
npm run build
```

- `app/api/extract/route.ts`: the one server endpoint
- `lib/callModel.ts`: the only code that talks to an AI provider
- `lib/schema.ts`: the data shape, and the checks every result must pass
- `lib/quality.ts`: flags results that pass the checks but look implausible

Architecture rules and project decisions live in [CLAUDE.md](CLAUDE.md). Read it before changing anything.

## Licence

MIT. See [LICENSE](LICENSE).
