# Deep Researcher - 2026-11-14

## TL;DR
- Google’s Gemini 4 Hydrogen is now GA in GitHub Copilot, while GitHub scheduled a major model deprecation sweep for December 14, 2026 [1][2].
- GitHub Agentic Workflows reached GA for GitHub Actions, compiling natural language instructions into Actions YAML with micro-VM sandboxing and strict cost caps [5].
- OpenAI disbanded its standalone robotics team, absorbing researchers into core teams under the premise that general frontier models (e.g., GPT-6 Astra) can handle embodied AI directly [13].

## AI Model Updates, Runtime Engines, & Copilot Integrations
- **GitHub Copilot Model Shifts**: Gemini 4 Hydrogen (Google's latest Flash model) is generally available across Copilot plans, billed at provider list price [1]. Simultaneously, GitHub announced a December 14, 2026 deprecation date for multiple models, directing users to upgrade: Claude Haiku 4.5 $\rightarrow$ 5.5, Gemini 3.8 Flash $\rightarrow$ Gemini 4 Hydrogen, and Grok 4.6 $\rightarrow$ 4.7 [2].
- **Runtime Engines**: `ggml v1.0.0` was released, pruning legacy `DIAG_MASK` ops, upgrading the RPC protocol to v9, and adding configurable YaRN truncation and FP8 support [4]. It also introduces CUDA/Metal MoE tile optimization and SYCL device-side MoE scheduling [4].
- **Classification Models**: Perplexity released Apache-licensed Decider v1.3 and Decider Flash v1.3 decision models on Hugging Face and OpenRouter [11]. The release introduces a `locate` feature designed to extract exact substring spans for entity recognition without token-by-token text generation [11].

## Open-Source Tooling, Agentic Frameworks, & API Controls
- **GitHub Agentic Workflows GA**: Developers can now automate issue triage, test writing, and doc updates directly in GitHub Actions using Markdown instructions [5]. Agents run inside Cloud Hypervisor or NVX micro-VMs with default read-only access and a default spending cap of 1,000 AI Credits ($10) per run [5].
- **Repository Security Control**: GitHub added REST API endpoints (`GET/PATCH /orgs/{org}/code-scanning/ai-scan` and `/repos/{owner}/{repo}/code-scanning/ai-scan`) to programmatically toggle repository-level AI scanning via Infrastructure as Code [6].
- **Agent Routing & Quants**: AWS published an architecture combining NVIDIA NeMo Switchyard (v0.3.0) and LiteLLM (v1.102.0) on ECS to route coding agent tasks based on "cost per solved task" [7]. Meanwhile, Unsloth released Dynamic V3.1 GGUF quantizations for Qwen3.8-27B, claiming a 5–10% accuracy gain on agentic benchmarks (Terminal Bench 2.1, DeepSWE v1.1) at 256K context lengths [3].

## AI Research Insights & Model Evaluation Frameworks
- **JEPA World Model Planning**: 600 experiments on LeCun’s LeWM (Push-T benchmark) revealed that the model's reliable planning horizon is ~25 steps [9]. Chaining plans through 25-step subgoals increased long-horizon task success from 22% to 80% without any model retraining—performing on par with a planner backed by perfect physics (77%) [9].
- **LLM Historical Transcription**: Logician Jan von Plato used Claude to transcribe 1,009 pages of Kurt Gödel’s obsolete Gabelsberger shorthand workbooks from the 1940s, generating a 650-page digest that unveiled hundreds of previously unexamined proved theorems [10].

## Structural Shifts & Cost Management Patterns
- **Embodied AI Reorganization**: OpenAI disbanded its dedicated robotics team, reassigning researchers to Chief Research Officer Mark Chen and Applied org lead Greg Brockman [13]. OpenAI stated that general-purpose frontier models like GPT-6 Astra demonstrate that robotics is "no longer a special problem" requiring isolated models [13].
- **Session Cold-Starts & FinOps**: AWS detailed Bedrock AgentCore runtime V2, which freezes microVM memory snapshots after the first healthy `/ping` (clearing the OS file cache) to cut interactive agent cold starts to ~2 seconds [8]. For FinOps, Bedrock now exports caller identity to CUR 2.0 (`line_item_iam_principal`) for zero-instrumentation per-user cost allocation across tools like Claude Code and OpenAI Codex [12].

## Try this
1. **GitHub Agentic Workflows**: Define routine repo maintenance tasks in Markdown within `.github/workflows` to test automated Actions execution under sandboxed micro-VMs [5].
2. **AI Scan Controls**: Test the new GitHub REST API endpoints via `curl` or Octokit to programmatically query or toggle `repository_scan` settings across your org's repositories [6].

## Confidence & gaps
- **Disagreements & Benchmark Validity**: Unsloth explicitly challenged ISTA's GSQ-RCO evaluation methodology, noting that ISTA reported 100% accuracy recovery based on single-run evaluations [3]. Unsloth’s 14-run trials showed non-deterministic GPU behavior caps average recovery at 93–96% [3].
- **Experimental Code Warnings**: NVIDIA NeMo Switchyard 0.3.0 is officially designated by NVIDIA as a demo/evaluation component; AWS notes its APIs and configurations remain experimental and subject to breaking changes [7].
- **Thin Sources**: The OpenAI robotics reorganization relies on corporate statements and field reporting from an empty CoRL conference booth; no empirical benchmarks on GPT-6 Astra's physical control capabilities were provided [13].

## Citation check
- 13 sources cited, 13 read; every citation matches a source that was read.
- All cited sources are primary (official, paper or repository) or link straight to one.

## Sources
- [1] [Gemini 4 Hydrogen in GitHub Copilot](https://github.blog/changelog/2026-11-13-gemini-4-hydrogen-in-github-copilot) — GitHub Changelog
- [2] [Upcoming deprecation of selected GitHub Copilot models in December](https://github.blog/changelog/2026-11-13-upcoming-deprecation-of-selected-github-copilot-models-in-december) — GitHub Changelog
- [3] [Unsloth Qwen3.8-27B Quantizations – Dynamic v3.1 Update](https://unsloth.ai/docs/models/qwen3.8) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50491980)
- [4] [Ggml v1.0.0](https://github.com/ggml-org/ggml/releases/tag/v1.0.0) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50493062)
- [5] [GitHub Agentic Workflows open source tool reaches general availability](https://gcn.com/github-agentic-workflows-open-source-tool/23243/) — Exa web search
- [6] [Manage AI Scan for repositories using the REST API](https://github.blog/changelog/2026-11-13-manage-ai-scan-for-repositories-using-the-rest-api) — GitHub Changelog
- [7] [Route coding agent requests to the right model on Amazon Bedrock with NVIDIA NeMo Switchyard](https://aws.amazon.com/blogs/machine-learning/route-coding-agent-requests-to-the-right-model-on-amazon-bedrock-with-nvidia-nemo-switchyard/) — AWS Machine Learning
- [8] [Architecture patterns for fast session startup on Amazon Bedrock AgentCore runtime](https://aws.amazon.com/blogs/machine-learning/architecture-patterns-for-fast-session-startup-on-amazon-bedrock-agentcore-runtime/) — AWS Machine Learning
- [9] [After 600 experiments, here's what I discovered about JEPA world models](https://haddyalchaer.com/jepa) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50487185)
- [10] [AI unlocks Gödel's notebooks, said to contain hundreds of proved theorems](https://www.theguardian.com/science/2026/nov/13/kurt-godel-notebooks-ai-helps-unlock-hidden-discoveries-man-who-transformed-maths) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50486748)
- [11] [Perplexity Decider v1.3: Training, eval, and use cases](https://www.perplexity.ai/hub/blog/perplexity-decider) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50488464)
- [12] [Cost attribution and controls for AI developer and productivity tools on Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/cost-attribution-and-controls-for-ai-developer-and-productivity-tools-on-amazon-bedrock/) — AWS Machine Learning
- [13] [OpenAI disbands its robotics team as its general models start running robots](https://fortune.com/2026/11/13/openai-disbands-robotics-team-as-its-general-models-start-running-robots/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50487184)
