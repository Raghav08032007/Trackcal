import { render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it,expect,vi } from "vitest";
vi.mock('../src/components/account-session',()=>({useAccount:()=>({ready:true,user:{id:'member',email_verified:true}})}));
import { CoachBooking } from "../src/components/coach-booking";
it('loads available slots, confirms, reschedules and cancels with the server actions',async()=>{
  const calls:string[]=[];let status='none',time='2099-01-01T12:00:00Z';
  vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
    const action=url.split('/api/coaching/')[1];calls.push(action);
    if(action==='coaches')return Response.json({coaches:[{id:'coach',name:'Coach One'}],can_publish:false});
    if(action==='bookings')return Response.json({bookings:status==='none'?[]:[{id:'appointment',slot_id:'slot',starts_at:time,ends_at:'2099-01-01T13:00:00Z',status,coach_name:'Coach One',member_name:null,hosting:false}]});
    if(action.startsWith('slots?'))return Response.json({slots:[{id:'slot',starts_at:'2099-01-02T12:00:00Z',ends_at:'2099-01-02T13:00:00Z'}]});
    if(action==='reserve')status='confirmed';if(action==='move'){expect(JSON.parse(options?.body as string).id).toBe('appointment');time='2099-01-02T12:00:00Z';}if(action==='cancel')status='cancelled';return Response.json({status:'ok'});
  }));
  render(<CoachBooking/>);await userEvent.click(screen.getByRole('button',{name:'Load coaches and my appointments'}));await userEvent.selectOptions(await screen.findByLabelText('Choose coach'),'coach');await userEvent.click(screen.getByRole('button',{name:'Find available times'}));await userEvent.click(await screen.findByRole('button',{name:'Confirm appointment'}));expect(await screen.findByRole('button',{name:'Reschedule appointment'})).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:'Reschedule appointment'}));await userEvent.click(screen.getByRole('button',{name:'Find available times'}));await userEvent.click(await screen.findByRole('button',{name:'Move to this time'}));await waitFor(()=>expect(calls).toContain('move'));
  await userEvent.click(screen.getByRole('button',{name:'Cancel appointment'}));await waitFor(()=>expect(calls).toContain('cancel'));expect((await screen.findByRole('status')).textContent).toContain('cancelled');
});
