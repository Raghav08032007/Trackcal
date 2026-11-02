/** A short burst of colour for a real achievement. Decorative only, and hidden when motion is reduced. */
const COLORS=['#6d4ae8','#f5a524','#e5484d','#3fbf8f','#4aa8e8'];
export function Celebration(){
 return <div className="celebration" aria-hidden="true">{Array.from({length:18},(_,index)=><i key={index} style={{'--angle':`${index*20}deg`,'--far':`${70+index%4*24}px`,'--delay':`${index%3*40}ms`,background:COLORS[index%COLORS.length]} as React.CSSProperties}/>)}</div>;
}
