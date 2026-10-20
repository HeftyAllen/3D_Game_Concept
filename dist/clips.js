/* Authored whole-body key poses. Hermite interpolation carries momentum through impact. */
(function(root){
  'use strict';
  const C=(v,a,b)=>Math.max(a,Math.min(b,v));
  const straight={load:{handR:[.34,1.64,.15],elbowR:[.49,1.36,-.17],twist:.16,drop:.035},hit:{handR:[-.02,1.76,1.00],elbowR:[.24,1.58,.53],twist:-.30,tilt:.09,spine:[-.035,.055]},follow:{handR:[-.12,1.74,1.04],elbowR:[.16,1.58,.58],twist:-.38,tilt:.10}};
  const hook={load:{handL:[-.44,1.67,.13],elbowL:[-.60,1.44,.08],twist:-.23,drop:.045},hit:{handL:[.14,1.78,.88],elbowL:[-.46,1.65,.62],twist:.43,spine:[.045,.035]},follow:{handL:[.39,1.73,.70],elbowL:[-.10,1.64,.70],twist:.60,spine:[.07,.05]}};
  const upper={load:{handR:[.28,1.03,.20],elbowR:[.45,1.13,.10],drop:.16,twist:.20},hit:{handR:[-.03,1.94,.78],elbowR:[.27,1.48,.47],twist:-.34,drop:-.015,tilt:-.035},follow:{handR:[-.13,2.12,.67],elbowR:[.19,1.70,.50],twist:-.44,drop:-.025}};
  const front={load:{kneeR:[.14,.98,.54],footR:[.18,.50,.32],twist:.10,drop:.055},hit:{kneeR:[.12,1.10,.65],footR:[.06,1.18,1.27],twist:-.17,tilt:-.19,handL:[-.33,1.82,.42],handR:[.41,1.61,.19]},follow:{kneeR:[.12,1.16,.67],footR:[.04,1.28,1.34],twist:-.23,tilt:-.23}};
  const round={load:{kneeR:[.47,.94,.21],footR:[.57,.55,-.03],twist:.28,drop:.025},hit:{kneeR:[.41,1.20,.46],footR:[-.15,1.56,1.15],twist:-.45,tilt:-.17,handL:[-.46,1.78,.28],handR:[.56,1.61,-.12]},follow:{kneeR:[.23,1.21,.49],footR:[-.52,1.52,.88],twist:-.77,tilt:-.20}};
  const knee={load:{kneeR:[.20,.68,-.04],footR:[.23,.25,-.36],drop:.06,twist:.14},hit:{kneeR:[.07,1.35,.76],footR:[.18,.91,.30],twist:-.16,tilt:-.07,handL:[-.24,1.93,.55],handR:[.23,1.94,.52]},follow:{kneeR:[.03,1.43,.83],footR:[.19,1.0,.37],twist:-.22,tilt:-.10}};
  const elbow={load:{handR:[.42,1.81,.30],elbowR:[.52,1.58,.20],twist:.24,drop:.035},hit:{elbowR:[.02,1.73,.85],handR:[-.24,1.88,.48],twist:-.40,tilt:.08},follow:{elbowR:[-.14,1.73,.80],handR:[-.35,1.85,.40],twist:-.57,tilt:.11}};
  const axe={load:{kneeR:[.15,1.21,.41],footR:[.17,1.88,.46],twist:.16,tilt:-.14},hit:{kneeR:[.13,1.19,.61],footR:[.04,1.12,1.20],twist:-.20,tilt:-.13},follow:{kneeR:[.12,.97,.60],footR:[.04,.70,1.10],twist:-.28,tilt:.08}};
  const families={straight,hook,upper,front,round,knee,elbow,axe};
  function family(m){if(m.elastic||m.grab||m.ground||m.wind||m.lightning||m.weapon||m.ranged||m.reload||m.propPickup||m.propFetch||m.propThrow)return null;const v=m.pose;
    if(/knee/i.test(v))return 'knee';if(v==='elbow')return 'elbow';if(/axekick|slam/.test(v))return 'axe';if(/kick|oblique|sweep/.test(v))return /front|side|leadkick|oblique|lowkick/.test(v)?'front':'round';
    if(/upper|airlift/.test(v))return 'upper';if(/hook|ridge|shovel|backfist/.test(v))return 'hook';if(/jab|cross|airpunch|palm|body|overhand|hammer|doublepalm/.test(v))return 'straight';return null;
  }
  function apply(p,rest,f){const a=f.action,m=a?.move,name=m&&family(m);if(!name||f.visual?.pair||f.visual?.mounted)return;const clip=families[name],left=m.limb==='L'||m.limb==='legL'||/jab|lead|airlift|ridge|hook|shovel|backfist/.test(m.pose),mirror=left!==(name==='hook');
    const frames=[{},clip.load,clip.hit,clip.follow,{}],times=[0,m.startup*.32,m.startup,m.startup+.05,m.duration],keys=new Set(frames.flatMap(x=>Object.keys(x))),convert=(frame,k)=>{
      let source=k,sign=1;if(mirror){if(/[LR]$/.test(k))source=k.slice(0,-1)+(k.endsWith('L')?'R':'L');if(k==='twist')sign=-1;}
      if(frame[source]===undefined)return Array.isArray(rest[k])?rest[k].slice():rest[k];
      let v=frame[source];if(Array.isArray(v)){v=v.slice();if(mirror&&(source!==k||k==='spine'))v[0]*=-1;}
      else v*=sign;return v;
    };
    const mapped=new Set([...keys].map(k=>mirror&&/[LR]$/.test(k)?k.slice(0,-1)+(k.endsWith('L')?'R':'L'):k));keys.clear();for(const k of mapped)keys.add(k);
    const t=C(a.t,0,m.duration);let j=0;while(j<times.length-2&&t>times[j+1])j++;const dt=times[j+1]-times[j],u=C((t-times[j])/dt,0,1),h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u,h01=-2*u*u*u+3*u*u,h11=u*u*u-u*u;
    for(const k of keys){const values=frames.map(frame=>convert(frame,k)),scalar=(i)=>{const x=values.map(v=>Array.isArray(v)?v[i]:v),s0=j===0?0:(x[j+1]-x[j-1])/(times[j+1]-times[j-1]),s1=j===times.length-2?0:(x[j+2]-x[j])/(times[j+2]-times[j]);return h00*x[j]+h10*s0*dt+h01*x[j+1]+h11*s1*dt;};p[k]=Array.isArray(values[0])?values[0].map((_,i)=>scalar(i)):scalar(0);}
    const side=left?'L':'R',e=Math.sin(Math.PI*C(t/m.duration,0,1));
    if(/lowkick|oblique/.test(m.pose)){p['foot'+side][1]-=.65*e;p['knee'+side][1]-=.25*e;}
    if(m.zone==='body'||m.pose==='body'||m.pose==='shovel'){p['hand'+side][1]-=.42*e;p['elbow'+side][1]-=.22*e;p.drop+=.06*e;}
    if(m.air){p['foot'+(side==='L'?'R':'L')][1]+=.12*e;p.spine[0]+=(left?1:-1)*.05*e;}
    if(/spinkick|wheelkick|backfist|airspin/.test(m.pose))p.twist+=Math.PI*2*(t<=m.startup?(t/m.startup)**2*(3-2*t/m.startup):1);
  }
  root.CombatClips={apply,family,families};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatClips;
})(typeof window!=='undefined'?window:globalThis);
