import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { AgentDecisionSchema, type AgentDecision } from './schemas';
import dotenv from 'dotenv';

dotenv.config();

interface AgentState {
  customerMessage: string;
  amountInRupees: number;
  failureReason: string;
  retryCount: number;
  decision: AgentDecision | null;
  validationError: string | null;
}

// Select Free LLM Provider
function getFreeModel() {
  const provider = process.env.LLM_PROVIDER || 'ollama';

  if (provider === 'groq') {
    return new ChatOpenAI({
      apiKey: process.env.GROQ_API_KEY,
      configuration: {
        baseURL: 'https://api.groq.com/openai/v1',
      },
      modelName: 'llama-3.1-8b-instant',
      temperature: 0.1,
    });
  }

  // Default: Local Ollama
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    temperature: 0.1,
  });
}

const model = getFreeModel();

const SYSTEM_PROMPT = `You are Razorpay DunningCore's bounded autonomous recovery agent.
Your job is to analyze failed payment objections and output a JSON decision.

OPERATIONAL CONSTRAINTS:
1. nextAction must be one of: "SEND_LINK", "SCHEDULE_P2P", "APPLY_DISCOUNT", "ESCALATE_HUMAN", "ABORT"
2. discountBps: Maximum 500 basis points (5%). Keep 0 unless user explicitly complains about price.
3. promiseDate: ISO date string if user mentions payment time (e.g., "tomorrow"), else null.
4. customerFacingMessage: Clear, polite response.
5. internalReasoning: Step-by-step logic.

Respond ONLY with a valid JSON object matching this schema.`;

async function reasoningNode(state: AgentState): Promise<Partial<AgentState>> {
  try {
    const prompt = `${SYSTEM_PROMPT}

Context:
- Customer Message: "${state.customerMessage}"
- Invoice Amount: ₹${state.amountInRupees}
- Failure Reason: ${state.failureReason}
- Retry Count: ${state.retryCount}

Return JSON:`;

    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    // Extract JSON block even if model includes markdown formatting
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in model response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = AgentDecisionSchema.parse(parsed);

    return { decision: validated, validationError: null };
  } catch (err: any) {
    return { validationError: err.message };
  }
}

// Deterministic Policy Guard (Red-team defense)
function deterministicPolicyGuard(state: AgentState): Partial<AgentState> {
  if (!state.decision) {
    return {
      decision: {
        nextAction: 'SEND_LINK',
        discountBps: 0,
        promiseDate: null,
        customerFacingMessage: 'Here is your secure Razorpay link to complete the payment.',
        internalReasoning: 'Fallback link dispatched due to parsing exception.'
      }
    };
  }

  // Hard clamp discounts to maximum 500 bps (5%)
  if (state.decision.discountBps > 500) {
    state.decision.discountBps = 500;
    state.decision.internalReasoning += ' [GUARDRAIL APPLIED: Discount clamped to maximum 500 bps]';
  }

  return { decision: state.decision };
}

const workflow = new StateGraph<AgentState>({
  channels: {
    customerMessage: { value: (x, y) => y ?? x, default: () => '' },
    amountInRupees: { value: (x, y) => y ?? x, default: () => 0 },
    failureReason: { value: (x, y) => y ?? x, default: () => '' },
    retryCount: { value: (x, y) => y ?? x, default: () => 0 },
    decision: { value: (x, y) => y ?? x, default: () => null },
    validationError: { value: (x, y) => y ?? x, default: () => null }
  }
});

workflow.addNode('reasoning', reasoningNode);
workflow.addNode('policyGuard', deterministicPolicyGuard);

workflow.addEdge(START as any, 'reasoning' as any);
workflow.addEdge('reasoning' as any, 'policyGuard' as any);
workflow.addEdge('policyGuard' as any, END as any);

export const recoveryAgentApp = workflow.compile();
