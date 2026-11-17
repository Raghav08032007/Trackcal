import { t } from "@/lib/i18n";
import { useEffect,useRef,useState } from "react";
import type { IScannerControls } from "@zxing/browser";
async function reader(){
  const [{BrowserMultiFormatOneDReader},{DecodeHintType,BarcodeFormat}]=await Promise.all([import('@zxing/browser'),import('@zxing/library')]);
  const hints=new Map();hints.set(DecodeHintType.TRY_HARDER,true);hints.set(DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.UPC_A,BarcodeFormat.UPC_E,BarcodeFormat.ITF,BarcodeFormat.CODE_128]);
  return new BrowserMultiFormatOneDReader(hints,{delayBetweenScanAttempts:180,delayBetweenScanSuccess:500});
}
/** The area inside the on-screen guide, enlarged. Only the barcode strip, so a face in the shot is never processed or sent. */
function guideCanvas(preview:HTMLVideoElement){
 const {videoWidth:width,videoHeight:height}=preview;if(!width||!height)return null;
 const canvas=document.createElement('canvas');canvas.width=Math.min(1400,Math.round(width*.82*2));canvas.height=240;
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null;
 context.imageSmoothingQuality='high';context.drawImage(preview,width*.09,height*.32,width*.82,height*.38,0,0,canvas.width,canvas.height);
 return canvas;
}
/** A second try on an uploaded photo, with the same clean-up as the live camera. */
async function rescuePhoto(file:File){
 const bitmap=await createImageBitmap(file),scale=Math.min(1,1400/bitmap.width),canvas=document.createElement('canvas');
 canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null;
 context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const {decodeFast,decodeGray,decodeQr,productCode,toGray}=await import('@/lib/barcode-frame');
 const image=context.getImageData(0,0,canvas.width,canvas.height),quick=await decodeFast(image);if(quick)return quick;
 const gray=toGray(image.data,canvas.width,canvas.height),qr=decodeQr(gray,canvas.width,canvas.height);
 return (qr&&productCode(qr))||decodeGray(gray,canvas.width,canvas.height);
}
export function BarcodeCamera({onCode}:{onCode:(code:string)=>void}){
  const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null),callback=useRef(onCode),request=useRef(0);
  const [active,setActive]=useState(false),[device,setDevice]=useState(''),[devices,setDevices]=useState<MediaDeviceInfo[]>([]),[error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[help,setHelp]=useState(false);
  const resumeScan=useRef<(()=>void)|null>(null);
  const [playing,setPlaying]=useState(false);
  const [zoom,setZoom]=useState<{min:number;max:number;step:number;value:number}|null>(null);
  const [advice,setAdvice]=useState('');
  const guideFrame=useRef<HTMLCanvasElement|null>(null);
  useEffect(()=>{callback.current=onCode;},[onCode]);
  useEffect(()=>()=>{request.current++;},[]);
  useEffect(()=>{
    if(!active)return;
    let cancelled=false,found=false;const preview=video.current;
    let ownedStream:MediaStream|null=null,ownedControls:IScannerControls|null=null,begin:(()=>void)|null=null,enhanced:ReturnType<typeof setInterval>|undefined;
    const timer=setTimeout(()=>{if(!cancelled&&!found)setHelp(true);},10000);
    const hide=()=>{if(document.hidden&&ownedStream)setActive(false);};document.addEventListener('visibilitychange',hide);
    void (async()=>{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error(t("Camera API unavailable"));
      const scan=await reader();
      if(cancelled||!preview)return;
      const stream=await navigator.mediaDevices.getUserMedia({video:{...(device?{deviceId:{exact:device}}:{facingMode:{ideal:'environment'}}),width:{ideal:1920},height:{ideal:1080}},audio:false});
      ownedStream=stream;
      if(cancelled){stream.getTracks().forEach(track=>track.stop());return;}
      preview.srcObject=stream;
      begin=()=>{
        if(cancelled||ownedControls)return;
        let plainCandidate='';
        const finish=(code:string)=>{found=true;clearInterval(enhanced);ownedControls?.stop();setActive(false);setAdvice('');setStatus(t("Barcode detected: {code}. Looking up product nutrition…", { code }));callback.current(code);};
        ownedControls=scan.scan(preview,(result,_error,current)=>{
          if(!result||found||cancelled)return;const code=result.getText().trim();if(!/^\d{8,14}$/.test(code))return;
          /* A blurred frame can misread: the same code must come back on a second frame. */
          if(code!==plainCandidate){plainCandidate=code;return;}
          current.stop();finish(code);
        });controls.current=ownedControls;
        /* The plain reader only sees raw frames. This enlarges the guide area and rescues what a webcam leaves blurry. */
        let working=false,candidate='',tick=0;
        enhanced=setInterval(()=>{
          if(working||found||cancelled)return;const frame=guideCanvas(preview);if(!frame)return;guideFrame.current=frame;
          working=true;
          void (async()=>{
            const {decodeFast,decodeGray,decodeQr,frameAdvice,productCode,toGray,validGtin}=await import('@/lib/barcode-frame');
            const native=(window as unknown as {BarcodeDetector?:new(o:object)=>{detect(c:HTMLCanvasElement):Promise<{rawValue:string}[]>}}).BarcodeDetector;
            const seen=native?await new native({formats:['ean_13','ean_8','upc_a','upc_e','qr_code']}).detect(frame).catch(()=>[]):[];
            if(found||cancelled)return;
            const nativeCode=seen.map(row=>productCode(row.rawValue)).find(value=>value&&validGtin(value));if(nativeCode){finish(nativeCode);return;}
            const pixels=frame.getContext('2d',{willReadFrequently:true})?.getImageData(0,0,frame.width,frame.height);if(!pixels)return;
            const quick=await decodeFast(pixels);if(found||cancelled)return;if(quick){finish(quick);return;}
            /* The slow rescue only on every third frame, so the camera stays smooth. */
            if(++tick%3)return;
            const gray=toGray(pixels.data,frame.width,frame.height),qr=decodeQr(gray,frame.width,frame.height),qrCode=qr?productCode(qr):null;
            if(qrCode){finish(qrCode);return;}
            if(qr)setAdvice(t("This QR code has no product number. Scan the barcode instead."));
            const code=decodeGray(gray,frame.width,frame.height);
            /* Two frames in a row must agree before a sharpened read is trusted. */
            if(code&&code===candidate)finish(code);candidate=code||'';
            if(!code&&!qr)setAdvice(frameAdvice(gray,frame.width,frame.height));
          })().catch(()=>{}).finally(()=>{working=false;});
        },350);
      };resumeScan.current=begin;
      try{await preview.play();begin();}catch{if(!cancelled)setStatus(t("Camera connected. Tap Show camera preview to start playback."));}
      if(cancelled)return;
      const track=stream.getVideoTracks()[0];
      if(track?.getCapabilities){const caps=track.getCapabilities() as MediaTrackCapabilities&{focusMode?:string[];zoom?:{min:number;max:number;step?:number}};
        if(caps.focusMode?.includes('continuous'))void track.applyConstraints({advanced:[{focusMode:'continuous'} as MediaTrackConstraintSet]}).catch(()=>{});
        if(caps.zoom&&caps.zoom.max>caps.zoom.min)setZoom({...caps.zoom,step:caps.zoom.step||.1,value:(track.getSettings() as MediaTrackSettings&{zoom?:number}).zoom??caps.zoom.min});
      }
      if(navigator.mediaDevices?.enumerateDevices){const all=await navigator.mediaDevices.enumerateDevices().catch(()=>[]);if(!cancelled)setDevices(all.filter(item=>item.kind==='videoinput'));}
    })().catch(reason=>{if(!cancelled){const name=reason instanceof Error?reason.name:'';setError(name==='NotAllowedError'?t("Camera permission denied. Allow access in your browser, then retry."):name==='NotReadableError'?t("The camera is busy or unavailable. Close other camera apps or tabs, then retry."):t("Camera could not start. Retry or use a barcode photo. Camera access requires localhost or HTTPS."));setActive(false);}});
    return()=>{cancelled=true;clearInterval(enhanced);clearTimeout(timer);document.removeEventListener('visibilitychange',hide);ownedControls?.stop();if(resumeScan.current===begin)resumeScan.current=null;if(controls.current===ownedControls)controls.current=null;ownedStream?.getTracks().forEach(track=>track.stop());if(preview&&preview.srcObject===ownedStream)preview.srcObject=null;};
  },[active,device]);
  async function showPreview(){
    const preview=video.current;if(!preview)return;
    try{await preview.play();resumeScan.current?.();setError('');}catch{setError(t("Preview playback is blocked. Retry the camera or open this localhost page in Chrome or Edge."));}
  }
  async function photo(file:File|undefined){
    if(!file)return;setActive(false);setError('');setHelp(false);
    if(!/^image\/(jpeg|png|webp|bmp)$/.test(file.type)||file.size>10*1024*1024){setError(t("Choose a JPG, PNG, WebP or BMP barcode photo smaller than 10 MB."));return;}
    const id=++request.current;setBusy(true);setStatus(t("Reading barcode photo on this device…"));const url=URL.createObjectURL(file);
    try{const scan=await reader();const result=await scan.decodeFromImageUrl(url);if(id!==request.current)return;const code=result.getText().trim();if(!/^\d{8,14}$/.test(code))throw new Error(t("Unsupported code"));setStatus(t("Barcode detected: {code}. Looking up product nutrition…", { code }));callback.current(code);}
    catch{
      const rescued=await rescuePhoto(file).catch(()=>null);
      if(rescued&&id===request.current){setStatus(t("Barcode detected: {rescued}. Looking up product nutrition…", { rescued }));callback.current(rescued);return;}
      if(id===request.current){setStatus('');setError(t("No readable product barcode found. Crop closely around the full barcode, avoid glare, or type the printed digits below."));}}
    finally{URL.revokeObjectURL(url);if(id===request.current)setBusy(false);}
  }
  /** One deliberate photo: the strip in the guide, then the whole frame, then the printed digits. */
  async function takePhoto(){
    const preview=video.current;if(!preview||busy)return;
    const strip=guideCanvas(preview);if(!strip){setError(t("The camera is not ready yet. Try again in a moment."));return;}
    guideFrame.current=strip;setError('');setStatus(t("Reading your photo…"));
    const {decodeFast,decodeGray,decodeQr,productCode,toGray}=await import('@/lib/barcode-frame');
    const read=async(canvas:HTMLCanvasElement)=>{const pixels=canvas.getContext('2d',{willReadFrequently:true})?.getImageData(0,0,canvas.width,canvas.height);if(!pixels)return null;const quick=await decodeFast(pixels);if(quick)return quick;const gray=toGray(pixels.data,canvas.width,canvas.height),qr=decodeQr(gray,canvas.width,canvas.height);return (qr&&productCode(qr))||decodeGray(gray,canvas.width,canvas.height);};
    const whole=document.createElement('canvas');whole.width=preview.videoWidth;whole.height=preview.videoHeight;whole.getContext('2d',{willReadFrequently:true})?.drawImage(preview,0,0);
    const code=await read(whole)||await read(strip);
    if(code){setActive(false);setStatus(t("Barcode detected: {code}. Looking up product nutrition…", { code }));callback.current(code);return;}
    await readDigits(true);
  }
  async function readDigits(fromPhoto=false){
    const frame=guideFrame.current;if(!frame||busy)return;
    const id=++request.current;setBusy(true);setError('');setStatus(t("Reading the printed digits…"));
    try{
      const response=await fetch('/api/barcode/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:frame.toDataURL('image/jpeg',.9)}),signal:AbortSignal.timeout(30000)});
      const data=await response.json();if(id!==request.current)return;
      if(!response.ok)throw new Error(fromPhoto?t("Could not read that photo. Hold the barcode inside the box about 25 cm from the camera and try again, or type the digits below."):data.error||t("Could not read the digits."));
      setActive(false);setStatus(t("Barcode detected: {code}. Looking up product nutrition…", { code: data.code }));callback.current(data.code);
    }catch(reason){if(id===request.current){setStatus('');setError(reason instanceof Error?reason.message:t("Could not read the digits."));}}
    finally{if(id===request.current)setBusy(false);}
  }
  async function zoomTo(value:number){const track=(video.current?.srcObject as MediaStream|null)?.getVideoTracks()[0];if(!track||!zoom)return;try{await track.applyConstraints({advanced:[{zoom:value} as MediaTrackConstraintSet]});setZoom({...zoom,value});}catch{setError(t("Zoom unavailable on this camera. Adjust your distance from the product."));}}
  return <section className="barcode-capture" aria-label={t("Product barcode capture")}><div className="barcode-capture-actions"><button disabled={busy} onClick={()=>{setError('');setHelp(false);setZoom(null);setPlaying(false);setStatus(active?t("Camera stopped."):t("Opening camera…"));setActive(value=>!value);}}>{active?t("Stop camera"):t("Scan barcode with camera")}</button><label className="barcode-photo-action">{busy?t("Reading photo…"):t("Upload barcode photo")}<input aria-label={t("Upload barcode photo")} type="file" accept="image/jpeg,image/png,image/webp,image/bmp" disabled={busy} onChange={event=>{void photo(event.target.files?.[0]);event.target.value='';}}/></label></div>
  {active&&<><label className="barcode-camera-choice">{t("Camera")}<select aria-label={t("Barcode camera")} value={device} onChange={event=>{setDevice(event.target.value);setZoom(null);setHelp(false);setPlaying(false);}}><option value="">{t("Automatic / rear camera preferred")}</option>{devices.map((item,index)=><option key={item.deviceId} value={item.deviceId}>{item.label||t("Camera {n}", { n: index+1 })}</option>)}</select></label><div className="barcode-preview"><video ref={video} autoPlay muted playsInline aria-label={t("Barcode camera preview")} onPlaying={()=>{setPlaying(true);setStatus(t("Camera ready. Place the full barcode inside the guide."));}} onPause={()=>setPlaying(false)} onError={()=>{setPlaying(false);setError(t("The preview could not play. Tap Show camera preview or restart the camera."));}}/>{playing?<div className="barcode-scan-guide" aria-hidden="true"/>:<div className="barcode-preview-start"><strong>{t("Waiting for camera preview")}</strong><span>{t("Allow camera access if your browser asks.")}</span><button onClick={()=>void showPreview()}>{t("Show camera preview")}</button></div>}<span className="barcode-preview-tip">{advice||t("Hold it about 25 cm back. It can look small; the app enlarges it.")}</span></div><div className="barcode-photo-row"><button type="button" disabled={busy||!playing} onClick={()=>void takePhoto()}>{busy?t("Reading…"):t("Take photo of barcode")}</button><small>{t("Read on this device first. If that fails, only the strip inside the box goes to the AI to read the digits.")}</small></div>{zoom&&<label className="barcode-zoom">{t("Camera zoom")}<input type="range" aria-label={t("Barcode camera zoom")} min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.value} onChange={event=>void zoomTo(Number(event.target.value))}/></label>}</>}
  {status&&<p role="status" className="barcode-capture-status">{status}</p>}{error&&<p role="alert" className="barcode-capture-error">{error}</p>}<div className="barcode-scan-tips"><strong>{help?t("Not detecting yet? Try this:"):t("For a clear scan")}</strong><p>{t("Use good light without glare. Laptop cameras can't focus up close, so hold the label about 25 cm back and keep it still. For a bottle, rotate it so the barcode faces the camera directly.")}</p>{help&&<p>{t("Try another camera, upload a barcode photo from your phone, or type the digits below.")}</p>}</div><small>{t("Photos are decoded on this device; only the barcode number is sent for lookup. Detect → look up → review nutrition → choose grams → save. Some products are absent or incomplete in Open Food Facts.")}</small></section>;
}
