import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({decode:vi.fn(),image:vi.fn(),stop:vi.fn(),callback:null as null|((result:{getText:()=>string}|null,error:unknown,controls:{stop:()=>void})=>void)}));
vi.mock('@zxing/browser',()=>({BrowserMultiFormatOneDReader:class {scan=mock.decode;decodeFromImageUrl=mock.image;}}));
import { BarcodeCamera } from '../src/components/barcode-camera';
afterEach(()=>vi.restoreAllMocks());
beforeEach(()=>{mock.stop.mockReset();mock.image.mockReset();mock.decode.mockReset();mock.callback=null;mock.decode.mockImplementation((_video,callback)=>{mock.callback=callback;return {stop:mock.stop};});Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getVideoTracks:()=>[],getTracks:()=>[{stop:mock.stop}]}),enumerateDevices:vi.fn().mockResolvedValue([{kind:'videoinput',deviceId:'camera-two',label:'External camera'}])}});vi.spyOn(HTMLMediaElement.prototype,'play').mockImplementation(function(this:HTMLMediaElement){this.dispatchEvent(new Event('playing'));return Promise.resolve();});});
it('requests high resolution, supports camera selection and delivers a valid detection only once',async()=>{
 const onCode=vi.fn();render(<BarcodeCamera onCode={onCode}/>);fireEvent.click(screen.getByRole('button',{name:'Scan barcode with camera'}));
 await screen.findByText('Camera ready. Place the full barcode inside the guide.');
 expect(vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls[0][0]?.video).toMatchObject({width:{ideal:1920}});
 fireEvent.change(screen.getByLabelText('Barcode camera'),{target:{value:'camera-two'}});
 await waitFor(()=>expect(mock.decode).toHaveBeenCalledTimes(2));expect(vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls[1][0]?.video).toMatchObject({deviceId:{exact:'camera-two'}});
 mock.callback?.({getText:()=> 'not-a-product'},null,{stop:mock.stop});expect(onCode).not.toHaveBeenCalled();
 mock.callback?.({getText:()=> '3017620422003'},null,{stop:mock.stop});mock.callback?.({getText:()=> '3017620422003'},null,{stop:mock.stop});
 await waitFor(()=>expect(onCode).toHaveBeenCalledExactlyOnceWith('3017620422003'));
 expect(mock.stop).toHaveBeenCalled();
});
it('decodes a photo locally and releases its object URL',async()=>{
 mock.image.mockResolvedValue({getText:()=> '3017620422003'});const onCode=vi.fn();render(<BarcodeCamera onCode={onCode}/>);
 fireEvent.change(screen.getByLabelText('Upload barcode photo'),{target:{files:[new File(['fixture'],'barcode.png',{type:'image/png'})]}});
 await waitFor(()=>expect(onCode).toHaveBeenCalledExactlyOnceWith('3017620422003'));expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
});
it('reports unreadable photos and permission denial without inventing a product',async()=>{
 mock.image.mockRejectedValue(new Error('Not found'));const onCode=vi.fn();render(<BarcodeCamera onCode={onCode}/>);
 fireEvent.change(screen.getByLabelText('Upload barcode photo'),{target:{files:[new File(['fixture'],'barcode.png',{type:'image/png'})]}});
 expect((await screen.findByRole('alert')).textContent).toContain('No readable product barcode');expect(onCode).not.toHaveBeenCalled();
 const denied=new Error('Denied');denied.name='NotAllowedError';vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(denied);fireEvent.click(screen.getByRole('button',{name:'Scan barcode with camera'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Camera permission denied'));
});
it('releases the camera on unmount and rejects oversized or unsupported photos',async()=>{
 const view=render(<BarcodeCamera onCode={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Upload barcode photo'),{target:{files:[new File(['svg'],'barcode.svg',{type:'image/svg+xml'})]}});
 expect(screen.getByRole('alert').textContent).toContain('smaller than 10 MB');expect(mock.image).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Scan barcode with camera'}));await screen.findByText('Camera ready. Place the full barcode inside the guide.');view.unmount();expect(mock.stop).toHaveBeenCalled();
});

it('offers a user-gesture playback recovery instead of falsely reporting ready',async()=>{
 vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('Autoplay blocked'));
 render(<BarcodeCamera onCode={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Scan barcode with camera'}));
 await screen.findByText('Camera connected. Tap Show camera preview to start playback.');expect(mock.decode).not.toHaveBeenCalled();
 expect(screen.queryByText('Camera ready. Place the full barcode inside the guide.')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Show camera preview'}));await screen.findByText('Camera ready. Place the full barcode inside the guide.');expect(mock.decode).toHaveBeenCalledOnce();
});
it('does not let a late cancelled camera detach the replacement stream',async()=>{
 let firstResolve!:(value:MediaStream)=>void;
 const staleStop=vi.fn(),newStop=vi.fn();
 const nextStream={getVideoTracks:()=>[],getTracks:()=>[{stop:newStop}]} as unknown as MediaStream;
 vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(()=>new Promise(resolve=>{firstResolve=resolve;})).mockResolvedValueOnce(nextStream);
 render(<BarcodeCamera onCode={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Scan barcode with camera'}));
 await waitFor(()=>expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1));fireEvent.click(screen.getByRole('button',{name:'Stop camera'}));fireEvent.click(screen.getByRole('button',{name:'Scan barcode with camera'}));
 await screen.findByText('Camera ready. Place the full barcode inside the guide.');firstResolve({getTracks:()=>[{stop:staleStop}]} as unknown as MediaStream);
 await waitFor(()=>expect(staleStop).toHaveBeenCalled());expect((screen.getByLabelText('Barcode camera preview') as HTMLVideoElement).srcObject).toBe(nextStream);expect(newStop).not.toHaveBeenCalled();
});
