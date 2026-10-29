import {it,expect,vi,afterEach} from 'vitest';
import {PoseDetectionService,cameraError,BUDGET_MS} from '@/lib/pose/detection-service';
afterEach(()=>vi.unstubAllGlobals());
function setup(){const stop=vi.fn(),track={stop,onended:null},stream={getTracks:()=>[track]};const media=vi.fn().mockResolvedValue(stream);Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:media},configurable:true});vi.stubGlobal('isSecureContext',true);vi.stubGlobal('createImageBitmap',vi.fn());const terminate=vi.fn();class WorkerMock{onmessage:((e:unknown)=>void)|null=null;onerror=null;postMessage(){queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));}terminate=terminate;}vi.stubGlobal('Worker',WorkerMock);const v=document.createElement('video');Object.defineProperty(v,'play',{value:vi.fn().mockResolvedValue(undefined),configurable:true});Object.defineProperty(v,'pause',{value:vi.fn()});return {v,stop,media,terminate,track};}
it('requests camera only explicitly, never audio; stop releases worker, stream and video',async()=>{const {v,stop,media,terminate}=setup(),r=vi.fn();const s=new PoseDetectionService(vi.fn(),vi.fn());expect(media).not.toHaveBeenCalled();const granted=vi.fn();await s.start(v,'','user',r,granted);expect(granted).toHaveBeenCalledOnce();expect(r).toHaveBeenCalledOnce();expect(media.mock.calls[0][0].audio).toBe(false);s.stop(v);expect(stop).toHaveBeenCalledOnce();expect(terminate).toHaveBeenCalledOnce();expect(v.srcObject).toBeNull();});
it('releases a camera permission result that arrives after navigation',async()=>{const {v,stop,media}=setup();let grant:(v:unknown)=>void=()=>{};media.mockImplementation(()=>new Promise(resolve=>{grant=resolve;}));const s=new PoseDetectionService(vi.fn(),vi.fn());const started=s.start(v,'','environment',vi.fn());s.stop(v);grant({getTracks:()=>[{stop}]});await started;expect(stop).toHaveBeenCalled();expect(v.srcObject).toBeNull();});
it('permission denial creates no worker and leaves no stream',async()=>{const {v,media,terminate}=setup();media.mockRejectedValue(new DOMException('Denied','NotAllowedError'));const s=new PoseDetectionService(vi.fn(),vi.fn());await expect(s.start(v,'','user',vi.fn())).rejects.toThrow('Camera permission was denied');expect(terminate).not.toHaveBeenCalled();expect(v.srcObject).toBeNull();});
it('playback failure releases the granted camera',async()=>{const {v,stop}=setup();Object.defineProperty(v,'play',{value:vi.fn().mockRejectedValue(Error('Playback blocked')),configurable:true});await expect(new PoseDetectionService(vi.fn(),vi.fn()).start(v,'','user',vi.fn())).rejects.toThrow();expect(stop).toHaveBeenCalled();});
it('model initialization error releases both worker and granted camera',async()=>{const {v,stop}=setup(),terminate=vi.fn(),error=vi.fn();class BrokenWorker{onmessage:((e:unknown)=>void)|null=null;onerror=null;postMessage(){queueMicrotask(()=>this.onmessage?.({data:{type:'error',message:'Synthetic model unavailable'}}));}terminate=terminate;}vi.stubGlobal('Worker',BrokenWorker);await expect(new PoseDetectionService(vi.fn(),error).start(v,'','user',vi.fn())).rejects.toThrow('Synthetic model unavailable');expect(stop).toHaveBeenCalledOnce();expect(terminate).toHaveBeenCalledOnce();expect(v.srcObject).toBeNull();expect(error).toHaveBeenCalled();});

it('explains denied, missing and busy cameras in plain words',()=>{
 expect(cameraError(new DOMException('x','NotAllowedError')).message).toMatch(/permission was denied/);
 expect(cameraError(new DOMException('x','NotFoundError')).message).toMatch(/No camera was found/);
 expect(cameraError(new DOMException('x','NotReadableError')).message).toMatch(/used by another app/);
 expect(cameraError(new DOMException('x','OverconstrainedError')).message).toMatch(/not available/);
});
it('steps the frame rate down when inference is over budget and reports low performance',async()=>{
 const {v}=setup();let worker:{onmessage:((e:unknown)=>void)|null}|null=null;const Real=(globalThis as unknown as {Worker:new()=>{onmessage:((e:unknown)=>void)|null}}).Worker;
 vi.stubGlobal('Worker',class extends (Real as unknown as {new():object}){constructor(){super();worker=this as unknown as {onmessage:null};}});
 const stats=vi.fn(),s=new PoseDetectionService(vi.fn(),vi.fn(),stats);await s.start(v,'','user',vi.fn());
 expect(stats).toHaveBeenLastCalledWith(expect.objectContaining({fps:24,lowPerformance:false}));
 for(let i=0;i<15;i++)worker!.onmessage!({data:{type:'pose',ms:BUDGET_MS+20,landmarks:[],timestamp:i,width:640,height:480}});
 expect(stats).toHaveBeenLastCalledWith(expect.objectContaining({fps:15,lowPerformance:true}));
 for(let i=0;i<15;i++)worker!.onmessage!({data:{type:'pose',ms:BUDGET_MS+20,landmarks:[],timestamp:100+i,width:640,height:480}});
 expect(stats).toHaveBeenLastCalledWith(expect.objectContaining({fps:10,lowPerformance:true}));
 s.stop(v);
});
