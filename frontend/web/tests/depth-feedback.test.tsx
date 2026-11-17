import { render,screen,fireEvent,act } from '@testing-library/react';
import { beforeEach,it,expect,vi } from 'vitest';
import { TouchFeedback } from '../src/components/touch-feedback';
beforeEach(()=>{vi.stubGlobal('PointerEvent',MouseEvent);vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false})));});
function move(target:Element,type='mouse',x=100,y=0){const event=new MouseEvent('pointermove',{bubbles:true,clientX:x,clientY:y});Object.defineProperty(event,'pointerType',{value:type});fireEvent(target,event);}
it('tilts only designated surfaces, bounds the rotation and resets on keyboard focus',async()=>{
 let callback:FrameRequestCallback=()=>{};vi.stubGlobal('requestAnimationFrame',vi.fn(value=>{callback=value;return 1;}));vi.stubGlobal('cancelAnimationFrame',vi.fn());
 render(<><TouchFeedback/><section className="daily-target-panel" data-testid="surface"><button>Action</button><input aria-label="Goal"/></section><video data-testid="camera"/></>);
 const surface=screen.getByTestId('surface');vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:100,height:100} as DOMRect);
 move(surface,'mouse',200,-20);act(()=>callback(0));expect(surface.style.getPropertyValue('--surface-ry')).toBe('3deg');expect(surface.style.getPropertyValue('--surface-rx')).toBe('2.5deg');
 fireEvent.focusIn(screen.getByLabelText('Goal'));expect(surface.dataset.depthActive).toBeUndefined();
 move(screen.getByTestId('camera'));act(()=>callback(0));expect(screen.getByTestId('camera').getAttribute('style')).toBeNull();
});
it('does not tilt on touch, reduced motion or calm mode and cleans up pending work',()=>{
 const frame=vi.fn(()=>1);vi.stubGlobal('requestAnimationFrame',frame);vi.stubGlobal('cancelAnimationFrame',vi.fn());
 const view=render(<><TouchFeedback/><section className="daily-target-panel" data-testid="surface"/></>);const surface=screen.getByTestId('surface');
 move(surface,'touch');expect(frame).not.toHaveBeenCalled();
 vi.mocked(window.matchMedia).mockReturnValue({matches:true} as MediaQueryList);move(surface);expect(frame).not.toHaveBeenCalled();
 vi.mocked(window.matchMedia).mockReturnValue({matches:false} as MediaQueryList);surface.classList.add('daily-focus-calm');move(surface);expect(frame).not.toHaveBeenCalled();view.unmount();expect(cancelAnimationFrame).toHaveBeenCalled();
});
