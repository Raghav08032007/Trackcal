import {JointAnalyzer} from './analyzers';
import type {Landmark} from './types';
export class BicepCurlAnalyzer extends JointAnalyzer{
 groups=[[11,13,15,23],[12,14,16,24]];joint=[[11,13,15],[12,14,16]];
 protected suitable(p:Landmark[],side:number){const [shoulder,elbow,,hip]=this.groups[side];return p[shoulder].y<p[hip].y&&Math.abs(p[shoulder].x-p[elbow].x)<.25;}
}
