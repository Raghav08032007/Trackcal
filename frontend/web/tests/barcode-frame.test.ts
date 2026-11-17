// Real decoding of generated EAN-13 images, clean and blurred like a webcam out of focus.
import {describe,it,expect} from 'vitest';
import {BarcodeFormat,BinaryBitmap,DecodeHintType,HybridBinarizer,MultiFormatOneDReader,QRCodeDecoderErrorCorrectionLevel,QRCodeEncoder,RGBLuminanceSource} from '@zxing/library';
import {decodeGray,decodeQr,frameAdvice,productCode,validGtin} from '@/lib/barcode-frame';

const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G=L.map(c=>[...c].map(b=>b==='0'?'1':'0').reverse().join(''));
const R=L.map(c=>[...c].map(b=>b==='0'?'1':'0').join(''));
const PARITY=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
function modules(code:string){
 const d=[...code].map(Number),left=d.slice(1,7).map((n,i)=>(PARITY[d[0]][i]==='L'?L:G)[n]).join(''),right=d.slice(7).map(n=>R[n]).join('');
 return '0'.repeat(11)+'101'+left+'01010'+right+'101'+'0'.repeat(11);
}
function image(code:string,moduleWidth:number,height=120){
 const bits=modules(code),barcode=bits.length*moduleWidth,width=barcode*2,left=barcode/2,gray=new Uint8ClampedArray(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const k=Math.floor((x-left)/moduleWidth);gray[y*width+x]=x>=left&&bits[k]==='1'?40:215;}
 return {gray,width,height};
}
/** Three box blurs approximate the Gaussian blur of a lens out of focus. */
function blur({gray,width,height}:ReturnType<typeof image>,radius:number,noise=0){
 let rows=gray;
 for(let pass=0;pass<3;pass++){
  const out=new Uint8ClampedArray(rows.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let k=-radius;k<=radius;k++)sum+=rows[y*width+Math.min(width-1,Math.max(0,x+k))];out[y*width+x]=sum/(2*radius+1);}
  rows=out;
 }
 if(noise){let seed=7;for(let i=0;i<rows.length;i++){seed=seed*1103515245+12345&0x7fffffff;rows[i]+=(seed%(2*noise))-noise;}}
 return {gray:rows,width,height};
}
const plainZxing=({gray,width,height}:ReturnType<typeof image>)=>{
 const hints=new Map<DecodeHintType,unknown>([[DecodeHintType.TRY_HARDER,true],[DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.EAN_13]]]);
 try{return new MultiFormatOneDReader(hints).decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray,width,height))),hints).getText();}catch{return null;}
};
describe('check digits',()=>{
 it('accepts real codes',()=>{for(const code of ['3017620422003','96385074','036000291452'])expect(validGtin(code)).toBe(true);});
 it('refuses misreads and blanks',()=>{for(const code of ['3017620422004','000000000000','00260435515790','1234','','abcdefghijklm'])expect(validGtin(code)).toBe(false);});
});
describe('blurred barcodes',()=>{
 const code='3017620422003';
 it('reads a clean barcode',()=>{const a=image(code,4);expect(decodeGray(a.gray,a.width,a.height)).toBe(code);});
 for(const [moduleWidth,radius] of [[3,1],[4,2],[6,3],[6,4]] as const)it(`never returns a wrong code at blur ${radius}, ${moduleWidth} px a bar, with camera noise`,()=>{const a=blur(image(code,moduleWidth),radius,6);expect([code,null]).toContain(decodeGray(a.gray,a.width,a.height));});
 it('reads moderate blur',()=>{const a=blur(image(code,6),3,6);expect(decodeGray(a.gray,a.width,a.height)).toBe(code);});
 it('never returns a code from a hopeless frame',()=>{const a=blur(image(code,4),6,6);expect(decodeGray(a.gray,a.width,a.height)).toBeNull();});
 it('the plain decoder cannot read these on its own',()=>{const a=blur(image(code,4),2,6);expect(plainZxing(a)).toBeNull();});
});
describe('live advice',()=>{
 it('says when a frame is too blurry or too dark',()=>{
  const blurred=blur(image('3017620422003',4),8);expect(frameAdvice(blurred.gray,blurred.width,blurred.height)).toContain('further back');
  const sharp=image('3017620422003',4);expect(frameAdvice(sharp.gray,sharp.width,sharp.height)).toBe('');
  const dark=sharp.gray.map(v=>v/8);expect(frameAdvice(Uint8ClampedArray.from(dark),sharp.width,sharp.height)).toContain('dark');
 });
});
describe('QR codes on packs',()=>{
 function qrImage(text:string,scale=5){
  const matrix=QRCodeEncoder.encode(text,QRCodeDecoderErrorCorrectionLevel.M).getMatrix(),size=matrix.getWidth(),quiet=4*scale,width=size*scale+quiet*2,gray=new Uint8ClampedArray(width*width).fill(235);
  for(let y=0;y<size*scale;y++)for(let x=0;x<size*scale;x++)if(matrix.get(Math.floor(x/scale),Math.floor(y/scale))===1)gray[(y+quiet)*width+x+quiet]=25;
  return {gray,width};
 }
 it('reads a GS1 Digital Link QR into its product number',()=>{const q=qrImage('https://id.gs1.org/01/03017620422003/10/ABC');const text=decodeQr(q.gray,q.width,q.width);expect(text).toContain('/01/03017620422003');expect(productCode(text as string)).toBe('3017620422003');});
 it('understands every way a pack carries the number',()=>{expect(productCode('3017620422003')).toBe('3017620422003');expect(productCode('(01)03017620422003')).toBe('3017620422003');});
 it('a website QR is not a product, and a bad number is refused',()=>{expect(productCode('https://brand.example/offers')).toBeNull();expect(productCode('https://id.gs1.org/01/03017620422004')).toBeNull();});
});
