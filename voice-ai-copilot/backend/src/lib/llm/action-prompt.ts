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
- Judge each action against the transcript and its triggerPrompt.
- status "missed": the transcript clearly reaches a moment matching the action's triggerPrompt, but the action is NOT in the fired list.
- status "incorrect": the action fired but at the wrong moment / with the wrong context, OR fired when no trigger condition was met.
- status "correct": the action fired appropriately when its trigger condition arose.
- Only emit a finding when it is noteworthy: always emit "missed" and "incorrect"; emit "correct" only for actions that genuinely fired and were appropriate. Do NOT emit findings for actions whose trigger condition simply never arose.
- For "missed" and "incorrect", set "promptFlaw" to the specific flaw in THAT action's triggerPrompt that explains the failure (ambiguous wording, missing condition, conflicting instruction), and "suggestedTriggerPrompt" to an improved triggerPrompt that would fix it.
- Set "transcriptTurnIndex" to the most relevant transcript turn, and "actionName"/"actionType" to identify the action.
- Set "ghlActionId" to the bracketed "id" shown for that action above, copied verbatim, so the finding links back to its definition. Use null only when the id shown is literally "unknown".`
}
