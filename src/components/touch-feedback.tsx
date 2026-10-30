import { useEffect } from "react";

export function TouchFeedback(){
  useEffect(()=>{
    const pending=new Map<HTMLElement,ReturnType<typeof setTimeout>>();
    let surface:HTMLElement|null=null,frame=0;
    let pointer={x:0,y:0};
    const selector='.studio-character-stage,.daily-target-panel,.daily-companion-panel,.companion-stage,.play-card,.play-game-main,.wellness-card-grid>article,.social-post,.community-card,.premium-plan,.destination-card,.photo-card';
    const calm=()=>document.documentElement.dataset.motion==='reduced'||window.matchMedia('(prefers-reduced-motion: reduce)').matches||!!document.querySelector('.play-calm,.daily-focus-calm,.journey-calm');
    function reset(){if(surface){surface.style.removeProperty('--surface-rx');surface.style.removeProperty('--surface-ry');surface.style.removeProperty('--surface-light-x');surface.style.removeProperty('--surface-light-y');delete surface.dataset.depthActive;surface=null;}}
    function move(event:PointerEvent){
      if(event.pointerType!=='mouse'||calm()){reset();return;}
      const target=event.target instanceof Element?event.target.closest<HTMLElement>(selector):null;
      if(!target||target.contains(document.activeElement)&&document.activeElement?.matches('input,textarea,select')){reset();return;}
      if(surface!==target){reset();surface=target;}
      pointer={x:event.clientX,y:event.clientY};
      if(frame)return;
      frame=requestAnimationFrame(()=>{frame=0;if(!surface)return;const rect=surface.getBoundingClientRect();if(!rect.width||!rect.height)return;
        const x=Math.max(-.5,Math.min(.5,(pointer.x-rect.left)/rect.width-.5)),y=Math.max(-.5,Math.min(.5,(pointer.y-rect.top)/rect.height-.5));
        surface.style.setProperty('--surface-rx',`${-y*5}deg`);surface.style.setProperty('--surface-ry',`${x*6}deg`);
        surface.style.setProperty('--surface-light-x',`${(x+.5)*100}%`);surface.style.setProperty('--surface-light-y',`${(y+.5)*100}%`);surface.dataset.depthActive='true';
      });
    }
    const leave=()=>reset();
    function down(event:PointerEvent){
      if(calm())return;
      const target=event.target instanceof Element?event.target.closest<HTMLElement>('button:not(:disabled),a[href]'):null;
      if(!target)return;
      const rect=target.getBoundingClientRect();
      target.style.setProperty('--touch-x',`${event.clientX-rect.left}px`);target.style.setProperty('--touch-y',`${event.clientY-rect.top}px`);
      target.dataset.touchFeedback='true';clearTimeout(pending.get(target));pending.set(target,setTimeout(()=>{delete target.dataset.touchFeedback;pending.delete(target);},500));
    }
    document.addEventListener('pointerdown',down,{passive:true});
    document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);window.addEventListener('blur',leave);document.addEventListener('focusin',leave);
    return()=>{document.removeEventListener('pointerdown',down);document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);window.removeEventListener('blur',leave);document.removeEventListener('focusin',leave);cancelAnimationFrame(frame);reset();for(const [target,timer] of pending){clearTimeout(timer);delete target.dataset.touchFeedback;}};
  },[]);
  return null;
}
