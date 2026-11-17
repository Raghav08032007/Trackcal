import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('../src/components/account-session',()=>({useAccount:()=>({user:{id:'p4-member'},ready:true}),useWorkspaceScope:()=>'p4-member'}));
import {PushSettingsCard,NotificationSwitch} from '../src/components/push-settings';
import {UpdatePrompt,InstallButton,markWorkoutActive} from '../src/components/app-updates';
import {pushSupport} from '../src/lib/push';
const types={daily_plan:{enabled:true,time:'08:00'},workout:{enabled:false,time:'18:00'},meal_log:{enabled:false,time:'13:00'},rest_day:{enabled:false,time:'20:00'},motivation:{enabled:false,time:'09:00'},milestone:{enabled:true,time:null}};
const off={enabled:false,types,max_per_day:2,snooze_until:null,timezone:'Asia/Kolkata',quiet_start:'22:00',quiet_end:'07:00',devices:[]};
const on={...off,enabled:true,devices:[{id:'d1',user_agent:'Chrome on Android',created_at:'2026-10-29T08:00:00Z'}]};
let permission:NotificationPermission='default';const requestPermission=vi.fn(async()=>permission);
const subscribe=vi.fn(async()=>({toJSON:()=>({endpoint:'https://push.example.com/abc',keys:{p256dh:'p'.repeat(40),auth:'a'.repeat(16)}})}));
beforeEach(()=>{
 permission='default';requestPermission.mockClear();subscribe.mockClear();
 const N=function(){} as unknown as {requestPermission:typeof requestPermission};N.requestPermission=requestPermission;Object.defineProperty(N,'permission',{get:()=>permission});vi.stubGlobal('Notification',N);
 vi.stubGlobal('PushManager',function(){});
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve({pushManager:{getSubscription:async()=>null,subscribe}}),getRegistration:async()=>undefined}});
});
afterEach(()=>{vi.unstubAllGlobals();markWorkoutActive(false);});
function api(settings:object,enabled=true){
 const fetcher=vi.fn(async(url:string,o?:RequestInit)=>{
  if(url==='/api/push/config')return Response.json({enabled,public_key:'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'});
  if(url==='/api/push/settings'&&o?.method==='PUT'){const body=JSON.parse(o.body as string);settings={...settings,...body,types:{...(settings as {types:object}).types,...(body.types||{})},devices:(settings as {devices:unknown[]}).devices.length?(settings as {devices:unknown[]}).devices:on.devices};return Response.json(settings);}
  if(url==='/api/push/settings')return Response.json(settings);
  return Response.json({status:'subscribed'});
 });vi.stubGlobal('fetch',fetcher);return fetcher;
}
it('stays hidden while the feature is off',async()=>{const fetcher=api(off,false);const {container}=render(<PushSettingsCard/>);await waitFor(()=>expect(fetcher).toHaveBeenCalled());expect(container.textContent).toBe('');});
it('explains first and asks the browser only after a tap',async()=>{
 const fetcher=api(off);render(<PushSettingsCard/>);
 await screen.findByText(/You choose which reminders you get and when: at most 2 a day, never during your quiet hours \(22:00–07:00, Asia\/Kolkata\)/);
 expect(requestPermission).not.toHaveBeenCalled();
 permission='granted';fireEvent.click(screen.getByRole('button',{name:'Turn on notifications'}));
 await screen.findByText(/Notifications are on for this device/);
 expect(requestPermission).toHaveBeenCalledOnce();expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({userVisibleOnly:true}));
 expect(fetcher.mock.calls.some(([url,o])=>url==='/api/push/subscribe'&&o?.method==='POST')).toBe(true);
 expect(screen.getByRole('switch',{name:/All notifications/})).toBeTruthy();
});
it('a refused permission shows how to re-enable instead of asking again',async()=>{
 api(off);render(<PushSettingsCard/>);const button=await screen.findByRole('button',{name:'Turn on notifications'});permission='denied';fireEvent.click(button);
 await screen.findByText(/Notifications are blocked for TrackCal in this browser/);expect(screen.queryByRole('button',{name:'Turn on notifications'})).toBeNull();
});
it('changing a reminder time and pausing are saved',async()=>{
 const fetcher=api(on);render(<PushSettingsCard/>);await screen.findByText("Today's plan");
 fireEvent.change(screen.getAllByLabelText('Time')[0],{target:{value:'07:30'}});await screen.findByText('Time saved.');
 const put=fetcher.mock.calls.filter(([u,o])=>u==='/api/push/settings'&&o?.method==='PUT').map(([,o])=>JSON.parse(o!.body as string));
 expect(put[0].types.daily_plan).toEqual({enabled:true,time:'07:30'});
 fireEvent.click(screen.getByRole('button',{name:'Pause for a day'}));await screen.findByText('Paused for a day.');
});
it('the Me page switch turns everything off in one tap',async()=>{
 const fetcher=api(on);render(<NotificationSwitch/>);fireEvent.click(await screen.findByRole('switch',{name:'Notifications on'}));
 await screen.findByText(/Notifications are off/);
 expect(fetcher.mock.calls.some(([u,o])=>u==='/api/push/settings'&&o?.method==='PUT'&&JSON.parse(o.body as string).enabled===false)).toBe(true);
});
it('an update waits while a workout is running and applies only on request',async()=>{
 const postMessage=vi.fn();Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{controller:{}}});
 render(<UpdatePrompt/>);markWorkoutActive(true);
 act(()=>{window.dispatchEvent(new CustomEvent('trackcal-update-ready',{detail:{waiting:{postMessage}}}));});
 expect(screen.queryByText(/A new version of TrackCal is ready/)).toBeNull();
 act(()=>markWorkoutActive(false));await screen.findByText(/A new version of TrackCal is ready/);
 fireEvent.click(screen.getByRole('button',{name:'Update now'}));expect(postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});
});
it('offers install only when the browser allows it',async()=>{
 render(<InstallButton/>);expect(screen.queryByRole('button',{name:'Install TrackCal'})).toBeNull();
 const prompt=vi.fn(async()=>{}),event=Object.assign(new Event('beforeinstallprompt'),{prompt,userChoice:Promise.resolve({outcome:'accepted'})});
 act(()=>{window.dispatchEvent(event);});fireEvent.click(await screen.findByRole('button',{name:'Install TrackCal'}));
 await screen.findByText(/TrackCal is installed/);expect(prompt).toHaveBeenCalledOnce();
});
it('iPhone Safari must install first; desktop Chrome can subscribe in the browser',()=>{
 const ua=Object.getOwnPropertyDescriptor(Navigator.prototype,'userAgent');
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false})));
 Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'});expect(pushSupport()).toBe('ios-install');
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})));expect(pushSupport()).toBe('ok');  // added to the Home Screen
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false})));
 Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140'});expect(pushSupport()).toBe('ok');
 if(ua)Object.defineProperty(navigator,'userAgent',ua);
});
