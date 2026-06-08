import { AnalysisPrompt } from '../../types/llm.types'

// Shared system-prompt section describing the agent's Actions (tool calls) and
// what actually fired, plus the rules for emitting actionFindings. Used by both
// the Anthropic and OpenAI providers so the action-analysis behaviour stays
// identical across models.
export function buildActionsSection(prompt: AnalysisPrompt): string {
  if (prompt.actions.length === 0) {
    return `Agent Actions: none configured for this agent — return an empty "actionFindings" array.`
  }

  const available = prompt.actions
    .map((a, i) =>
      `${i + 1}. [id: ${a.ghlActionId ?? 'unknown'}] ${a.name} [${a.actionType}] — triggerPrompt: ${a.triggerPrompt ?? '(none provided)'}`
    )
    .join('\n')

  const fired = prompt.executedActions.length
    ? prompt.executedActions.map((a) => `- [id: ${a.ghlActionId ?? 'unknown'}] ${a.actionName} [${a.actionType}]`).join('\n')
    : '(no actions fired during this call)'

  return `Agent Actions — tools the agent can invoke mid-call. Each has a triggerPrompt describing WHEN it should fire:
${available}

Actions that ACTUALLY fired during this call (deterministic ground truth — trust this list for whether an action fired):
${fired}

Action evaluation rules:
- The fired list means the agent DECIDED to invoke the tool. Judge whether that decision was appropriate given the triggerPrompt and the conversation — NOT whether the downstream system ultimately succeeded.
- A tool that fired but failed to complete for an EXTERNAL reason (e.g. a call transfer that could not connect, an SMS provider error) is still a correct decision. That is not the agent's or the triggerPrompt's fault — do NOT mark it "incorrect" and do NOT invent a promptFlaw for it.
- status "missed": the transcript clearly reaches a moment matching the action's triggerPrompt, but the action is NOT in the fired list. An action that IS in the fired list can NEVER be "missed".
- status "incorrect": the action fired when the conversation did NOT match its triggerPrompt — wrong moment, wrong context, or no trigger condition at all. Reserve this for a wrong DECISION to fire, not a failed execution.
- status "correct": the agent invoked the action in response to a situation matching its triggerPrompt — including when an external system then failed to complete it.
- Only emit a finding when it is noteworthy: always emit "missed" and "incorrect"; emit "correct" only for actions that genuinely fired and were appropriate. Do NOT emit findings for actions whose trigger condition simply never arose.
- For "missed" and "incorrect" ONLY, set "promptFlaw" to the specific flaw in THAT action's triggerPrompt that explains the wrong decision (ambiguous wording, missing condition, conflicting instruction), and "suggestedTriggerPrompt" to an improved triggerPrompt that would fix it. Leave both null for "correct".
- Set "transcriptTurnIndex" to the most relevant transcript turn, and "actionName"/"actionType" to identify the action.
- Set "ghlActionId" to the bracketed "id" shown for that action above, copied verbatim, so the finding links back to its definition. Use null only when the id shown is literally "unknown".`
}
