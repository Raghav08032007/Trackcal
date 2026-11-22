import {describe,expect,it} from 'vitest';
import {repLine,voiceScore} from '@/lib/workout-coach';

describe('repLine', () => {
  it('speaks up at halfway, two to go and the last one, like a coach', () => {
    expect(repLine(5, 10)).toBe('5, halfway there');
    expect(repLine(8, 10)).toBe('8, two more');
    expect(repLine(9, 10)).toBe('9, last one');
    expect(repLine(3, 10)).toBe('3');
    expect(repLine(10, 10)).toBe('10');
  });
  it('keeps short sets to plain numbers', () => {
    expect(repLine(1, 2)).toBe('1');
    expect(repLine(2, 3)).toBe('2, last one');
  });
});

describe('voiceScore', () => {
  it('prefers natural voices in the exact language, and never a voice for another language', () => {
    const robotic = {name: 'eSpeak Hindi', lang: 'hi-IN'};
    const natural = {name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN', localService: false};
    const english = {name: 'Google US English', lang: 'en-US'};
    expect(voiceScore(natural, 'hi-IN')).toBeGreaterThan(voiceScore(robotic, 'hi-IN'));
    expect(voiceScore(english, 'hi-IN')).toBeLessThan(0);
    expect(voiceScore({name: 'Google हिन्दी', lang: 'hi-IN'}, 'hi-IN')).toBeGreaterThan(voiceScore({name: 'Local Hindi', lang: 'hi'}, 'hi-IN'));
  });
});
