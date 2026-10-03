import assert from 'node:assert/strict';

/** Submit one actual form, matching browser behavior on pages with several actions. */
export function getServerActionForm(html) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match => match[0]).filter(form => /name="\$ACTION/.test(form));
  assert.ok(forms.length, 'Server Action form missing.');
  const transition = forms.find(form => /name="confirm"/.test(form));
  if (transition) return transition;
  assert.equal(forms.length, 1, 'Select a specific form when multiple actions are present.');
  return forms[0];
}
