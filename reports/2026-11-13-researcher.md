# Deep Researcher - 2026-11-13

## TL;DR
- **New Models & Engines**: Google introduced Gemini 4 Hydrogen in Search [1]; Baidu released ERNIE 5.5 Flash (280B MoE, 1M context) free on OpenRouter [2]; Edge0 open-sourced laptop-focused MoE models [3]; `llama.cpp` reached v1.0.0 API stability [4].
- **Cost & Outages**: AWS published a code-free Bedrock budget capping method using IAM Deny policies [7]; Claude services suffered a 2-hour auth incident [8], alongside Microsoft 365 degradation [9].
- **Agent Research**: New papers introduce CoReMem for cost-aware agent memory [11], Metal Sandbox for macOS GPU agents [13], and energy-based reasoning models [12].

## Major AI Models & Platform Capabilities
- **Google Search Upgrade**: Google released Gemini 4 Hydrogen globally in Search, expanding multi-part intent recognition, "query fan-out" across subtopics, and structured comparison visual outputs [1].
- **ERNIE 5.5 Flash Preview**: Baidu made its ERNIE 5.5 Flash Preview model accessible on OpenRouter via `baidu/ernie-5.5-flash-preview:free` [2]. It is a 280-billion-parameter Mixture-of-Experts (MoE) model activating 14 billion parameters per token with a 1-million-token context window [2]. Apache 2.0 weights are promised by November 25, 2026 [2].
- **Edge0 Local Models**: Edge0 released Edge0-145B and Edge0-120B for local PC deployment [3]. Edge0 claims Edge0-145B runs on a MacBook Pro with "29GB peak memory and decoding above 80 tokens per second" by sharing two weight matrices across 64 experts (activating ~10B parameters per step) and scoring 64.6 on DeepSWE 1.1 [3].
- **llama.cpp v1.0.0**: Hugging Face and ggml-org tagged `llama.cpp` v1.0.0 and `ggml` v1.0.0, committing to strict Semantic Versioning where major version bumps indicate API/ABI breaking changes for downstream consumers [4].

## Tools & Cost Control for Agent Workflows
- **AWS Bedrock Cost Enforcement**: AWS outlined a zero-code pattern to track and strictly limit Amazon Bedrock consumption per IAM identity [7]. It uses IAM principal attribution, Cost Allocation Tags, CUR 2.0, and AWS Budgets configured with automated budget actions that attach a `Deny` IAM policy once a spending limit is exceeded [7].
- **Agent Skills**: GitHub detailed architectural guidance on building portable skills across AI agent frameworks [5].

## Outages & Leadership Shifts
- **Claude Authentication Outage**: Anthropic reported an outage affecting `claude.ai`, Claude Code, `platform.claude.com`, and Claude Cowork starting at 09:58 UTC on Nov 13, 2026, which was resolved at 11:58 UTC after a fix was deployed [8].
- **Service & Leadership News**: Microsoft 365 reported service health degradation [9]. Reports circulated regarding Nvidia leadership [10], though primary news source details were blocked [10].

## Research: Memory, On-Device, & Reasoning
- **CoReMem Agent Memory**: Researchers introduced CoReMem, a framework for software agents tackling successive repo tasks that evaluates the "future usefulness against the costs of writing and reading" memory for unknown future tasks [11].
- **Metal Sandbox**: A new paper presents Metal Sandbox, an execution environment designed for Apple Silicon that isolates command scheduling for AI agents generating and testing native Apple Metal GPU kernels concurrently on macOS [13].
- **Energy-Based Reasoning**: Research shows that descent on a classical energy function enables models to solve reasoning puzzles "1,000x faster than looped models" while reducing parameter bloat and training instability [12].

## Try this
1. **Free Long-Context Testing**: Query `baidu/ernie-5.5-flash-preview:free` via the OpenRouter API to test 1M context capabilities on text prompts without incurring cost during the preview window [2].
2. **Automated Bedrock Cost Capping**: Attach a budget action to an AWS Budget filtering on Bedrock IAM tags to apply a `Deny` policy automatically when project spending thresholds are breached [7].

## Confidence & gaps
- **Unverified Vendor Claims**: Edge0's benchmark scores (64.6 on DeepSWE 1.1) and memory metrics (29GB peak) rely entirely on internal testing; a full technical report and external reproduction remain pending [3].
- **Inaccessible Sources**: OpenAI's ChatGPT Wallet launch [6] and the AP News report on Nvidia [10] returned HTTP 403 errors and could not be independently verified beyond headlines.
- **Abstract Truncation**: Papers covering CoReMem [11], Classical Energies [12], and Metal Sandbox [13] were available only as short abstracts, omitting full experimental setups.

## Citation check
- 13 sources cited, 13 read; every citation matches a source that was read.
- All cited sources are primary (official, paper or repository) or link straight to one.
- Couldn't load the full page for [6], [10]; those claims rest on the title and summary only.

## Sources
- [1] [Google Search gets a major upgrade with Gemini 4 Hydrogen](https://blog.google/products-and-platforms/products/search/gemini-4-hydrogen-search-upgrade/) — Google AI
- [2] [Baidu releases ERNIE 5.5 Flash Preview, free on OpenRouter](https://pasqualepillitteri.it/en/news/32984/baidu-releases-ernie-55-flash-preview-free-openrouter) — Exa web search
- [3] [Edge0 releases 145B-parameter model for laptops](https://aivionews.com/models/edge0-open-sources-145-billion-parameter-ai-model-built-to-run-on-a/) — Exa web search
- [4] [llama.cpp v1.0.0 : A stronger foundation for the local AI ecosystem](https://huggingface.co/blog/ggml-org/llama-cpp-v1) — Hugging Face
- [5] [Build once, run on any agent: A practical guide to agent skills](https://github.blog/ai-and-ml/github-copilot/build-once-run-on-any-agent-a-practical-guide-to-agent-skills/) — GitHub Blog
- [6] [Introducing ChatGPT Wallet](https://openai.com/index/introducing-chatgpt-wallet) — OpenAI
- [7] [Tokenomics at scale: Track and cap Amazon Bedrock spend per IAM principal with CUR 2.0 and AWS Budgets](https://aws.amazon.com/blogs/machine-learning/tokenomics-at-scale-track-and-cap-amazon-bedrock-spend-per-iam-principal-with-cur-2-0-and-aws-budgets/) — AWS Machine Learning
- [8] [Elevated errors on claude.ai, Claude Code, and platform.claude.com](https://status.claude.com/incidents/nn11wk485zfn) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50481187)
- [9] [Service degradation on Microsoft 365](https://status.cloud.microsoft/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50471731)
- [10] [Jensen Huang resigns](https://apnews.com/article/nvidia-megaspeed-china-singapore-huang-5403f152a601cf82ce939f1d24fffa0f) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50467087)
- [11] [CoReMem: Cost-Internalizing Memory for Successive Coding Tasks with Prospective Valuation](https://arxiv.org/abs/2611.17316v1) — arXiv (paper, abstract read)
- [12] [Classical Energies Learn to Reason 1,000x Faster than Looped Models](https://arxiv.org/abs/2611.17309v1) — arXiv (paper, abstract read)
- [13] [Metal Sandbox: Isolated Execution and Command Scheduling for GPU Coding Agents on Apple Silicon](https://arxiv.org/abs/2611.17294v1) — arXiv (paper, abstract read)
