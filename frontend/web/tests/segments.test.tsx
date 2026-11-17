// Phase G: segments on an activity show a medal for your best three passes and link to the segment.
import {describe,it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {medal} from '@/lib/activities';
import {MedalBadge,SegmentsOnActivity,segmentRoute} from '@/components/segments';
import type {Activity} from '@/lib/activities';

describe('segments',()=>{
 it('gold, silver and bronze for your best three, then your place',()=>{
  expect([1,2,3,4].map(p=>medal(p)?.tone??null)).toEqual(['gold','silver','bronze',null]);
  render(<><MedalBadge place={1}/><MedalBadge place={5}/></>);
  expect(screen.getByText('Your best')).toBeTruthy();expect(screen.getByText('#5 of your times')).toBeTruthy();
 });
 it('a segment line is drawn like a route',()=>{expect(segmentRoute([[1,2],[3,4]])).toEqual([[1,2,null,null,null],[3,4,null,null,null]]);});
 it('lists the segments an activity was timed on, and offers the owner a new one',()=>{
  const a={id:'a',sport:'run',distance_m:5000,mine:true,route:[],segments:[{segment_id:'s1',name:'Hill sprint',distance_m:400,elapsed_s:95,place:1}]} as unknown as Activity;
  render(<MemoryRouter><SegmentsOnActivity activity={a}/></MemoryRouter>);
  expect(screen.getByText('Hill sprint').closest('a')?.getAttribute('href')).toBe('/segments/s1');
  expect(screen.getByRole('button',{name:/Make a segment/})).toBeTruthy();
 });
 it('shows nothing on someone else’s activity with no segments',()=>{
  const a={id:'a',sport:'run',distance_m:5000,mine:false,route:[],segments:[]} as unknown as Activity;
  const {container}=render(<MemoryRouter><SegmentsOnActivity activity={a}/></MemoryRouter>);expect(container.textContent).toBe('');
 });
});
