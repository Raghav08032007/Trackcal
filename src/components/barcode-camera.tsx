"use client";
import { useEffect,useRef,useState } from "react";
import type { IScannerControls } from "@zxing/browser";
async function reader(){
  const [{BrowserMultiFormatOneDReader},{DecodeHintType,BarcodeFormat}]=await Promise.all([import('@zxing/browser'),import('@zxing/library')]);
  const hints=new Map();hints.set(DecodeHintType.TRY_HARDER,true);hints.set(DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.UPC_A,BarcodeFormat.UPC_E,BarcodeFormat.ITF,BarcodeFormat.CODE_128]);
  return new BrowserMultiFormatOneDReader(hints,{delayBetweenScanAttempts:180,delayBetweenScanSuccess:500});
}
export function BarcodeCamera({onCode}:{onCode:(code:string)=>void}){
  const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null),callback=useRef(onCode),request=useRef(0);
  const [active,setActive]=useState(false),[device,setDevice]=useState(''),[devices,setDevices]=useState<MediaDeviceInfo[]>([]),[error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[help,setHelp]=useState(false);
  const resumeScan=useRef<(()=>void)|null>(null);
  const [playing,setPlaying]=useState(false);
  const [zoom,setZoom]=useState<{min:number;max:number;step:number;value:number}|null>(null);
  useEffect(()=>{callback.current=onCode;},[onCode]);
  useEffect(()=>()=>{request.current++;},[]);
  useEffect(()=>{
    if(!active)return;
    let cancelled=false,found=false;const preview=video.current;
    let ownedStream:MediaStream|null=null,ownedControls:IScannerControls|null=null,begin:(()=>void)|null=null;
    const timer=setTimeout(()=>{if(!cancelled&&!found)setHelp(true);},10000);
    const hide=()=>{if(document.hidden&&ownedStream)setActive(false);};document.addEventListener('visibilitychange',hide);
    void (async()=>{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera API unavailable');
      const scan=await reader();
      if(cancelled||!preview)return;
      const stream=await navigator.mediaDevices.getUserMedia({video:{...(device?{deviceId:{exact:device}}:{facingMode:{ideal:'environment'}}),width:{ideal:1920},height:{ideal:1080}},audio:false});
      ownedStream=stream;
      if(cancelled){stream.getTracks().forEach(track=>track.stop());return;}
      preview.srcObject=stream;
      begin=()=>{
        if(cancelled||ownedControls)return;
        ownedControls=scan.scan(preview,(result,_error,current)=>{
          if(!result||found||cancelled)return;const code=result.getText().trim();if(!/^\d{8,14}$/.test(code))return;
          found=true;current.stop();setActive(false);setStatus(`Barcode detected: ${code}. Looking up product nutrition…`);callback.current(code);
        });controls.current=ownedControls;
      };resumeScan.current=begin;
      try{await preview.play();begin();}catch{if(!cancelled)setStatus('Camera connected. Tap Show camera preview to start playback.');}
      if(cancelled)return;
      const track=stream.getVideoTracks()[0];
      if(track?.getCapabilities){const caps=track.getCapabilities() as MediaTrackCapabilities&{focusMode?:string[];zoom?:{min:number;max:number;step?:number}};
        if(caps.focusMode?.includes('continuous'))void track.applyConstraints({advanced:[{focusMode:'continuous'} as MediaTrackConstraintSet]}).catch(()=>{});
        if(caps.zoom&&caps.zoom.max>caps.zoom.min)setZoom({...caps.zoom,step:caps.zoom.step||.1,value:(track.getSettings() as MediaTrackSettings&{zoom?:number}).zoom??caps.zoom.min});
      }
      if(navigator.mediaDevices?.enumerateDevices){const all=await navigator.mediaDevices.enumerateDevices().catch(()=>[]);if(!cancelled)setDevices(all.filter(item=>item.kind==='videoinput'));}
    })().catch(reason=>{if(!cancelled){const name=reason instanceof Error?reason.name:'';setError(name==='NotAllowedError'?'Camera permission denied. Allow access in your browser, then retry.':name==='NotReadableError'?'The camera is busy or unavailable. Close other camera apps or tabs, then retry.':'Camera could not start. Retry or use a barcode photo. Camera access requires localhost or HTTPS.');setActive(false);}});
    return()=>{cancelled=true;clearTimeout(timer);document.removeEventListener('visibilitychange',hide);ownedControls?.stop();if(resumeScan.current===begin)resumeScan.current=null;if(controls.current===ownedControls)controls.current=null;ownedStream?.getTracks().forEach(track=>track.stop());if(preview&&preview.srcObject===ownedStream)preview.srcObject=null;};
  },[active,device]);
  async function showPreview(){
    const preview=video.current;if(!preview)return;
    try{await preview.play();resumeScan.current?.();setError('');}catch{setError('Preview playback is blocked. Retry the camera or open this localhost page in Chrome or Edge.');}
  }
  async function photo(file:File|undefined){
    if(!file)return;setActive(false);setError('');setHelp(false);
    if(!/^image\/(jpeg|png|webp|bmp)$/.test(file.type)||file.size>10*1024*1024){setError('Choose a JPG, PNG, WebP or BMP barcode photo smaller than 10 MB.');return;}
    const id=++request.current;setBusy(true);setStatus('Reading barcode photo on this device…');const url=URL.createObjectURL(file);
    try{const scan=await reader();const result=await scan.decodeFromImageUrl(url);if(id!==request.current)return;const code=result.getText().trim();if(!/^\d{8,14}$/.test(code))throw new Error('Unsupported code');setStatus(`Barcode detected: ${code}. Looking up product nutrition…`);callback.current(code);}
    catch{if(id===request.current){setStatus('');setError('No readable product barcode found. Crop closely around the full barcode, avoid glare, or type the printed digits below.');}}
    finally{URL.revokeObjectURL(url);if(id===request.current)setBusy(false);}
  }
  async function zoomTo(value:number){const track=(video.current?.srcObject as MediaStream|null)?.getVideoTracks()[0];if(!track||!zoom)return;try{await track.applyConstraints({advanced:[{zoom:value} as MediaTrackConstraintSet]});setZoom({...zoom,value});}catch{setError('Zoom unavailable on this camera. Adjust your distance from the product.');}}
  return <section className="barcode-capture" aria-label="Product barcode capture"><div className="barcode-capture-actions"><button disabled={busy} onClick={()=>{setError('');setHelp(false);setZoom(null);setPlaying(false);setStatus(active?'Camera stopped.':'Opening camera…');setActive(value=>!value);}}>{active?'Stop camera':'Scan barcode with camera'}</button><label className="barcode-photo-action">{busy?'Reading photo…':'Upload barcode photo'}<input aria-label="Upload barcode photo" type="file" accept="image/jpeg,image/png,image/webp,image/bmp" disabled={busy} onChange={event=>{void photo(event.target.files?.[0]);event.target.value='';}}/></label></div>
  {active&&<><label className="barcode-camera-choice">Camera<select aria-label="Barcode camera" value={device} onChange={event=>{setDevice(event.target.value);setZoom(null);setHelp(false);setPlaying(false);}}><option value="">Automatic / rear camera preferred</option>{devices.map((item,index)=><option key={item.deviceId} value={item.deviceId}>{item.label||`Camera ${index+1}`}</option>)}</select></label><div className="barcode-preview"><video ref={video} autoPlay muted playsInline aria-label="Barcode camera preview" onPlaying={()=>{setPlaying(true);setStatus('Camera ready. Place the full barcode inside the guide.');}} onPause={()=>setPlaying(false)} onError={()=>{setPlaying(false);setError('The preview could not play. Tap Show camera preview or restart the camera.');}}/>{playing?<div className="barcode-scan-guide" aria-hidden="true"/>:<div className="barcode-preview-start"><strong>Waiting for camera preview</strong><span>Allow camera access if your browser asks.</span><button onClick={()=>void showPreview()}>Show camera preview</button></div>}<span className="barcode-preview-tip">Keep all bars and both white margins visible</span></div>{zoom&&<label className="barcode-zoom">Camera zoom<input type="range" aria-label="Barcode camera zoom" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.value} onChange={event=>void zoomTo(Number(event.target.value))}/></label>}</>}
  {status&&<p role="status" className="barcode-capture-status">{status}</p>}{error&&<p role="alert" className="barcode-capture-error">{error}</p>}<div className="barcode-scan-tips"><strong>{help?'Not detecting yet? Try this:':'For a clear scan'}</strong><p>Use good light without glare. Hold the label still and slowly adjust the distance until the bars look sharp. For a bottle, rotate it so the barcode faces the camera directly.</p>{help&&<p>Try another camera, upload a close-up barcode photo, or type the digits below.</p>}</div><small>Photos are decoded on this device; only the barcode number is sent for lookup. Detect → look up → review nutrition → choose grams → save. Some products are absent or incomplete in Open Food Facts.</small></section>;
}
