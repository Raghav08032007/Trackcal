import {JointAnalyzer} from './analyzers';
import type {Landmark} from './types';
export class PushUpAnalyzer extends JointAnalyzer{
 groups=[[11,13,15,23,27],[12,14,16,24,28]];joint=[[11,13,15],[12,14,16]];
 protected suitable(p:Landmark[],side:number){const [shoulder,,, ,ankle]=this.groups[side];return Math.abs(p[shoulder].x-p[ankle].x)>Math.abs(p[shoulder].y-p[ankle].y)*1.3;}
}
