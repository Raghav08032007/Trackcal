// Version B journeys: A's, with the two daily tasks that now have a one-tap path on Home.
// The success checks are A's, so both versions are held to the same stored result.
import {journeys as base} from './A.mjs';

const quick = {
  J3: async (page, {act}) => {
    await act.tap(page.getByRole('button', {name: 'Log Idli with sambar'}));
    await page.getByRole('status').filter({hasText: 'Logged Idli with sambar'}).waitFor();
  },
  J5: async (page, {act}) => {
    await act.tap(page.getByRole('button', {name: '+250 ml water'}));
    await page.getByRole('status').filter({hasText: 'ml today'}).waitFor();
  },
};

export const journeys = base.map(j => quick[j.id] ? {...j, run: quick[j.id]} : j);
