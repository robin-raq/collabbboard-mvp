# CollabBoard — AI Cost Analysis

## 1. Development Costs

### AI-Assisted Development (Claude Code CLI)

| Metric | Value |
|--------|-------|
| Development period | Feb 16–22, 2026 (7 days) |
| Total commits | 169 |
| Source code generated | ~7,100 lines |
| Test code generated | ~6,800 lines |
| Estimated API sessions | ~50 sessions |
| Estimated tokens consumed | ~25M tokens (input + output) |
| Estimated development cost | ~$80–130 |

**Cost breakdown by phase:**

| Phase | Sessions | Est. Tokens | Est. Cost |
|-------|----------|-------------|-----------|
| Initial scaffold + real-time sync | 5 | 3M | $10 |
| Rotation, multi-select, group ops | 5 | 2M | $7 |
| Supabase persistence | 3 | 1.5M | $5 |
| AI agent + local parser (73 TDD tests) | 5 | 3M | $10 |
| Security hardening (21 tests) | 2 | 1M | $3 |
| UI polish + accessibility | 3 | 1.5M | $5 |
| Performance optimization (render budget) | 3 | 1.5M | $5 |
| Server hardening + code cleanup | 4 | 1.5M | $5 |
| Multi-board auth + routing + dashboard | 4 | 2.5M | $10 |
| Frame grouping + guest sandbox | 3 | 1.5M | $5 |
| Model routing + Langfuse observability | 3 | 1.5M | $5 |
| Undo/redo + copy/paste + help panel | 4 | 2M | $8 |
| AI line/arrow support + production debugging | 3 | 1.5M | $7 |
| Rubber-band selection fix + scroll/Space pan | 3 | 2M | $8 |

**Note:** These are estimates. Actual costs depend on the Claude Code pricing tier used (Pro vs. API direct).

### Comparison: AI-Assisted vs. Traditional Development

| Approach | Estimated Time | Estimated Cost |
|----------|---------------|----------------|
| AI-assisted (Claude Code) | 7 days | $80–130 (API) + $0 (labor, solo dev) |
| Traditional solo developer | 3–4 weeks | $0 (API) + time cost |
| Traditional team (2 devs) | 2–3 weeks | $0 (API) + salary cost |

The AI reduced development time by approximately 3–5x while maintaining high test coverage (415 tests, TDD throughout).

---

## 2. Production Costs (Running Infrastructure)

### Fixed Monthly Costs

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Railway (WebSocket server) | Starter | $5 |
| Vercel (frontend hosting) | Free | $0 |
| Supabase (PostgreSQL) | Free | $0 |
| Clerk (authentication) | Free (up to 10K MAU) | $0 |
| Langfuse (observability) | Free (hobby) | $0 |
| Domain (raqdrobinson.com) | Annual / 12 | ~$1 |
| **Subtotal (fixed)** | | **$6/month** |

### Variable Costs: AI Commands (Anthropic API)

CollabBoard uses **dual-model routing** — simple commands use Haiku (cheap), complex commands use Sonnet (powerful):

**Simple commands (Haiku) — ~70% of traffic:**

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt + board context | ~800 input | Board snapshot + tool definitions |
| User message | ~50 input | The natural language command |
| Assistant response + tool calls | ~200 output | Tool arguments + confirmation |
| Tool results | ~100 input | Execution feedback |
| **Total per command** | **~950 input + ~200 output** | |

**Pricing (Claude 3.5 Haiku):**
- Input: $0.80 / 1M tokens
- Output: $4.00 / 1M tokens
- **Cost per simple command: ~$0.0016 (~0.16 cents)**

**Complex commands (Sonnet) — ~30% of traffic:**

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt + board context | ~800 input | Board snapshot + tool definitions |
| User message | ~100 input | Longer, multi-step requests |
| Multi-turn tool calls (3–5 turns) | ~1,500 output | Multiple tool arguments + reasoning |
| Tool results (multiple) | ~600 input | Execution feedback per tool |
| **Total per command** | **~2,500 input + ~1,500 output** | |

**Pricing (Claude Sonnet 4):**
- Input: $3.00 / 1M tokens
- Output: $15.00 / 1M tokens
- **Cost per complex command: ~$0.030 (~3.0 cents)**

**Weighted average cost per command:**
- 70% simple × $0.0016 + 30% complex × $0.030 = **~$0.010 per command (~1.0 cent)**

### Scaling Projections (with Model Routing)

| Users | AI Commands/mo | Simple (Haiku) | Complex (Sonnet) | AI API Cost/mo | Total Cost/mo |
|-------|---------------|----------------|-------------------|----------------|---------------|
| 100 | 2,000 | 1,400 | 600 | $20 | $26 |
| 1,000 | 20,000 | 14,000 | 6,000 | $202 | $208 |
| 10,000 | 200,000 | 140,000 | 60,000 | $2,024 | $2,030 |
| 100,000 | 2,000,000 | 1,400,000 | 600,000 | $20,240 | $20,246 |

**Assumptions:**
- Average 20 AI commands per active user per month
- Simple commands (1 tool call, Haiku): 70% of usage
- Complex commands (3–5 tool calls, Sonnet): 30% of usage
- Model routing already implemented and active

---

## 3. Cost Optimization Strategies

### Implemented

| Strategy | Impact | Status |
|----------|--------|--------|
| **Local parser fallback** | 12 command patterns handled by regex at zero API cost. Covers ~60% of common commands when API key not set. | Deployed |
| **Model routing (Haiku/Sonnet)** | Simple commands use Haiku ($0.80/$4.00 per 1M) instead of Sonnet ($3/$15 per 1M). ~70% cost reduction on simple commands. | Deployed |
| **Token budget limits** | Simple: max 512 tokens, 3 turns. Complex: max 2,048 tokens, 8 turns. Prevents runaway multi-turn loops. | Deployed |
| **perMessageDeflate** | WebSocket compression reduces bandwidth ~70%, lowering Railway egress costs. | Deployed |
| **Langfuse cost tracking** | Per-command observability with cost attribution by model — enables data-driven optimization. | Deployed |

### Recommended (Medium-term)

- **Prompt caching:** Anthropic's prompt caching can reduce input token costs by ~90% for the system prompt (board context), since it's largely static between commands in the same session. Estimated additional 30% overall savings.
- **Rate limiting:** Cap AI commands per user to prevent abuse (e.g., 50/hour).
- **Client-side command parsing:** Expand the local parser to handle more patterns client-side before reaching the server, reducing API calls further.

### Long-term (at scale)

- **Batch inference:** Group non-urgent AI requests and process in batches for lower per-token pricing.
- **Fine-tuned model:** For the most common command patterns, a fine-tuned smaller model could handle creation/manipulation at a fraction of the cost.
- **Client-side inference:** Simple commands (create object, change color) could run entirely client-side using a lightweight model, reserving server-side Claude for complex layout/template commands.

### Projected Costs with Further Optimizations

| Users | Current (Model Routing) | + Prompt Caching | + Rate Limiting | Total Savings |
|-------|------------------------|------------------|-----------------|---------------|
| 100 | $26/mo | $20/mo | $18/mo | 31% |
| 1,000 | $208/mo | $155/mo | $130/mo | 37% |
| 10,000 | $2,030/mo | $1,500/mo | $1,200/mo | 41% |
| 100,000 | $20,246/mo | $15,000/mo | $12,000/mo | 41% |

---

## 4. Break-Even Analysis

At what point does CollabBoard need to generate revenue to cover AI costs?

| Pricing Model | Break-Even (1K users) | Break-Even (10K users) |
|---------------|----------------------|------------------------|
| $5/user/month | 42 paying users | 406 paying users |
| $10/user/month | 21 paying users | 203 paying users |
| Freemium (5% convert, $10/mo) | 416 total users | 4,060 total users |

**Conclusion:** The AI feature cost is manageable at MVP scale ($26/mo for 100 users) and scales linearly. With model routing already implemented, costs are ~50% lower than using Sonnet for everything. Prompt caching would provide the next significant reduction. Revenue from even a small percentage of paying users covers AI infrastructure.

---

## 5. Cost Comparison: Before vs. After Model Routing

| Metric | Sonnet-Only (before) | Haiku+Sonnet (after) | Savings |
|--------|---------------------|---------------------|---------|
| Simple command cost | $0.009 | $0.0016 | 82% |
| Complex command cost | $0.030 | $0.030 | 0% |
| Weighted avg per command | $0.015 | $0.010 | 33% |
| 100 users / month | $36 | $26 | 28% |
| 1,000 users / month | $306 | $208 | 32% |
| 10,000 users / month | $3,006 | $2,030 | 32% |

---

## 6. Summary

| Category | Cost |
|----------|------|
| **Development (one-time)** | ~$80–130 |
| **Production at 100 users** | ~$26/month |
| **Production at 1,000 users** | ~$208/month |
| **Production at 1,000 users (+ prompt caching)** | ~$130/month |
| **Most expensive component** | Anthropic API (AI commands) |
| **Best implemented optimization** | Model routing (Haiku for simple, Sonnet for complex) |
| **Best future optimization** | Prompt caching (~30% additional reduction) |
| **Observability** | Langfuse traces per command with per-model cost attribution |
