import {BarcodeFormat,BinaryBitmap,DecodeHintType,GlobalHistogramBinarizer,HybridBinarizer,MultiFormatOneDReader,QRCodeReader,RGBLuminanceSource} from '@zxing/library';
/** Reads product barcodes from blurry webcam frames: enlarged crop, stronger bar edges, two binarizers. Nothing leaves the device. */
const hints=new Map<DecodeHintType,unknown>([[DecodeHintType.TRY_HARDER,true],[DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.UPC_A,BarcodeFormat.UPC_E]]]);
const EDGE=.35,DARK=45;

/** GS1 check digit for EAN-8, UPC-A, EAN-13 and GTIN-14. A misread almost never passes this. */
export function validGtin(code:string){
 if(!/^(\d{8}|\d{12,14})$/.test(code)||/^(\d)\1+$/.test(code))return false;
 const digits=[...code].map(Number),check=digits.pop() as number;
 return (10-digits.reverse().reduce((sum,value,i)=>sum+value*(i%2?1:3),0)%10)%10===check;
}
/** The product number in anything a pack code can hold: plain digits, a GS1 Digital Link URL, or (01) element strings. Null when it holds none. */
export function productCode(text:string){
 const value=text.trim(),found=/^\d{8,14}$/.test(value)?value:value.match(/\/01\/(\d{8,14})(?:[/?#]|$)/)?.[1]??value.match(/^(?:\(01\)|\u001d?01)(\d{14})/)?.[1];
 if(!found||!validGtin(found))return null;
 return found.length===14&&found[0]==='0'?found.slice(1):found;
}
/** A QR code's text, from one grayscale frame. */
export function decodeQr(gray:Uint8ClampedArray,width:number,height:number){
 try{return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray,width,height)))).getText();}catch{return null;}
}
export function toGray(rgba:Uint8ClampedArray,width:number,height:number){
 const gray=new Uint8ClampedArray(width*height);
 for(let i=0;i<gray.length;i++)gray[i]=(rgba[i*4]*306+rgba[i*4+1]*601+rgba[i*4+2]*117)>>10;
 return gray;
}
/** Bars run top to bottom, so averaging rows into bands removes camera noise and leaves the bars alone. */
function bandAverage(gray:Uint8ClampedArray,width:number,height:number,bands:number){
 const out=new Uint8ClampedArray(gray.length),size=Math.floor(height/bands);
 for(let band=0;band<bands;band++){
  const top=band*size,bottom=band===bands-1?height:top+size;
  for(let x=0;x<width;x++){let sum=0;for(let y=top;y<top+size;y++)sum+=gray[y*width+x];const value=sum/size;for(let y=top;y<bottom;y++)out[y*width+x]=value;}
 }
 return out;
}
/** Subtracts a sideways blur from each row: lens blur spreads bars sideways, so this pulls them apart again. */
export function sharpen(gray:Uint8ClampedArray,width:number,height:number,radius:number,amount:number,passes=1){
 let current=Float64Array.from(gray);
 for(let pass=0;pass<passes;pass++){
  const next=new Float64Array(current.length);
  for(let y=0;y<height;y++){
   const row=y*width;let sum=0;
   for(let x=-radius;x<=radius;x++)sum+=current[row+Math.max(0,x)];
   for(let x=0;x<width;x++){next[row+x]=current[row+x]+amount*(current[row+x]-sum/(2*radius+1));sum+=current[row+Math.min(width-1,x+radius+1)]-current[row+Math.max(0,x-radius)];}
  }
  current=next;
 }
 const out=new Uint8ClampedArray(gray.length);
 for(let y=0;y<height;y++){
  const row=y*width;let low=Infinity,high=-Infinity;
  for(let x=0;x<width;x++){low=Math.min(low,current[row+x]);high=Math.max(high,current[row+x]);}
  for(let x=0;x<width;x++)out[row+x]=(current[row+x]-low)*255/(high-low||1);
 }
 return out;
}
function attempt(reader:MultiFormatOneDReader,gray:Uint8ClampedArray,width:number,height:number,Binarizer:typeof HybridBinarizer|typeof GlobalHistogramBinarizer){
 try{const code=reader.decode(new BinaryBitmap(new Binarizer(new RGBLuminanceSource(gray,width,height))),hints).getText().trim();return validGtin(code)?code:null;}
 catch{return null;}finally{reader.reset();}
}
/** Band count, radius as a share of the width, amount and passes. These rescued the most blurred test barcodes (tests/barcode-frame.test.ts). */
const RECIPES=[[1,190,2,1],[4,190,2,2],[4,190,4,1],[1,140,2,1]] as const;
/** Blur can turn bars into a different code that still passes its check digit, and that would log the wrong product.
 *  So every method reads the frame, and a code needs two votes and no rival with as many. Null rather than take the risk. */
export function decodeGray(gray:Uint8ClampedArray,width:number,height:number){
 const reader=new MultiFormatOneDReader(hints),votes=new Map<string,number>();
 const vote=(code:string|null)=>{if(code)votes.set(code,(votes.get(code)??0)+1);};
 for(const Binarizer of [HybridBinarizer,GlobalHistogramBinarizer])vote(attempt(reader,gray,width,height,Binarizer));
 for(const [bands,share,amount,passes] of RECIPES){
  const clean=bands>1?bandAverage(gray,width,height,bands):gray;
  vote(attempt(reader,sharpen(clean,width,height,Math.max(1,Math.round(width/share)),amount,passes),width,height,GlobalHistogramBinarizer));
 }
 const [first,second]=[...votes].sort((a,b)=>b[1]-a[1]);
 return first&&first[1]>=2&&first[1]>(second?.[1]??0)?first[0]:null;
}
/** What to tell the person when a frame can't be read: how bright it is, and how steep its strongest edge is. */
export function frameAdvice(gray:Uint8ClampedArray,width:number,height:number){
 const line=new Float64Array(width);let total=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){line[x]+=gray[y*width+x]/height;total+=gray[y*width+x];}
 let low=255,high=0,edge=0;
 for(let x=4;x<width;x++){low=Math.min(low,line[x]);high=Math.max(high,line[x]);edge=Math.max(edge,Math.abs(line[x]-line[x-4]));}
 if(total/gray.length<DARK)return 'Too dark: move to brighter light.';
 return edge/(high-low||1)<EDGE?'Hold a barcode inside the box. If it is there, move it further back and keep it still.':'';
}
