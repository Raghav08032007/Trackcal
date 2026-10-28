'use client';
import Link from 'next/link';import {usePathname} from 'next/navigation';import {PageCompanion} from './feature-companion';
/** Page utilities only: no global navigation bar or scrolling route strip. */
export function StudioNavigation(){const path=usePathname();if(path==='/'||['/login','/signup','/forgot-password','/reset-password','/verify-email'].includes(path))return null;return <div className="page-utilities"><Link href="/" className="destination-button">← All features</Link><PageCompanion/><Link href="/guide" className="destination-button">Guided test drive ↗</Link></div>;}
