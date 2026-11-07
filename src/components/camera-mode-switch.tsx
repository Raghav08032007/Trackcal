import Link from '@/lib/navigation';

/** The camera does two things: counts reps, or times a hold. One switch, one page. */
export function CameraModeSwitch({mode}:{mode:'reps'|'hold'}){
 return <nav className="camera-mode-switch" aria-label="Camera mode">
  <Link href="/workouts/camera" aria-current={mode==='reps'?'page':undefined}><strong>Count reps</strong><small>Squats, push-ups, curls…</small></Link>
  <Link href="/workouts/camera?mode=hold" aria-current={mode==='hold'?'page':undefined}><strong>Time a hold</strong><small>Plank, balance, stretches</small></Link>
 </nav>;
}
