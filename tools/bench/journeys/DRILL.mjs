// Failure drill only: Version A's journeys with J3 deliberately broken (it looks for a control that doesn't exist).
// LABEL=DRILL ONLY=J3 node lib/journeys.mjs must report J3 as FAILED with the reason, never as a pass.
import {journeys as base} from './A.mjs';

export const journeys = base.map(j => j.id !== 'J3' ? j : {
  ...j,
  async run(page, {act}) {
    page.setDefaultTimeout(5000);
    await act.tap(page.getByRole('button', {name: 'Re-log favourite (drill: this control does not exist)'}));
  },
});
