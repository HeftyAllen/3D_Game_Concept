/* One attachment model for paired root motion and the final hand IK. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>scale(a,1/(Math.hypot(...a)||1)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const release=(type,q)=>['pickup','mount'].includes(type)?1:1-smooth((q-.76)/.20);
  function frame(pts){const pelvis=pts.pelvis||mix(pts.hipL,pts.hipR,.5),chest=pts.chest||mix(pts.shoulderL,pts.shoulderR,.5),up=unit(sub(chest,pelvis)),right=unit(sub(pts.hipR,pts.hipL)),forward=unit(cross(right,up));return {pelvis,chest,up,right,forward};}
  function anchor(pts,spec){const f=frame(pts);let p=spec.joint?pts[spec.joint]:add(f.pelvis,scale(f.up,spec.height||0));p=add(p,scale(f.right,spec.side||0));return add(p,scale(f.forward,spec.front||0));}
  function grips(type,grip='front'){
    const front=grip==='rear'?-.12:.12,match=grip==='rear'?1:-1;
    if(type==='doubleleg')return {L:{joint:match===1?'kneeL':'kneeR',front:.06},R:{joint:match===1?'kneeR':'kneeL',front:.06}};
    if(type==='bodyslam')return {L:{height:.43,side:-match*.21,front},R:{height:-.20,side:match*.18,front}};
    if(['hip','shoulder','sweep'].includes(type))return {L:{height:.55,side:-match*.26,front:.07},R:{height:type==='sweep'?.49:.18,side:type==='sweep'?match*.22:0,front}};
    if(type==='pickup')return {L:{height:.38,side:-match*.24,front},R:{height:.18,side:match*.22,front}};
    if(!type&&grip==='front')return {L:{height:.74,side:.16,front:.10},R:{height:.55,side:-.27,front:.10}};
    return {L:{height:.10,side:-match*.22,front},R:{height:.10,side:match*.22,front}};
  }
  function sampleRig(s,owner){
    const x=s[owner?1:6],z=s[owner?2:7],h=s[owner?3:8],pitch=s[owner?4:9],yaw=s[owner?5:10],cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const trans=p=>{const y=p[1]*cp-p[2]*sp,forward=p[1]*sp+p[2]*cp;return [x+p[0]*cy+forward*sy,h+y,z-p[0]*sy+forward*cy];};
    return {pelvis:trans([0,0,0]),chest:trans([0,.60,0]),head:trans([0,.99,0]),hipL:trans([-.15,0,0]),hipR:trans([.15,0,0]),shoulderL:trans([-.34,.60,0]),shoulderR:trans([.34,.60,0]),kneeL:trans([-.20,-.43,.14]),kneeR:trans([.20,-.43,.10])};
  }
  function closest(a,b,p){const d=sub(b,a),t=clamp(dot(sub(p,a),d)/(dot(d,d)||1),0,1);return add(a,scale(d,t));}
  function segmentPair(a,b,c,d){let p=closest(a,b,c),q=closest(c,d,p);for(let i=0;i<4;i++){p=closest(a,b,q);q=closest(c,d,p);}return [p,q];}
  function solveSample(type,s,q,grip,bulk={owner:1,target:1}){
    if(['elastic','pickup','mount'].includes(type))return s;
    const result=s.slice();
    // Offset the carried body onto a shoulder/hip instead of through the holder's spine.
    const carry={german:.36,vertical:.27,bodyslam:.25,shoulder:.10}[type]||0;result[6]+=carry*Math.sin(Math.PI*q)**2;
    const attach=release(type,q)*smooth(q/.12),spec=grips(type,grip);
    const move=(v,amount)=>{result[6]+=v[0]*amount;result[8]=Math.max(.24,result[8]+v[1]*amount);result[7]+=v[2]*amount;};
    for(let iteration=0;iteration<12;iteration++){
      let a=sampleRig(result,true),b=sampleRig(result,false);
      for(const side of ['L','R']){const shoulder=a['shoulder'+side],goal=anchor(b,spec[side]),d=sub(goal,shoulder),length=Math.hypot(...d);if(length>.75)move(d,-(length-.75)/length*attach*.55);}
      // Contact wins over the muscle drive; hands may release, torsos cannot pass through each other.
      for(let contact=0;contact<4;contact++){
        a=sampleRig(result,true);b=sampleRig(result,false);
        const volume=clamp((bulk.owner+bulk.target)*.5,.85,1.3),[p,r]=segmentPair(a.pelvis,a.chest,b.pelvis,b.chest),contacts=[[p,r,.37*volume],[a.head,closest(b.pelvis,b.chest,a.head),.36*volume],[closest(a.pelvis,a.chest,b.head),b.head,.36*volume],[a.head,b.head,.42]], [from,to,min]=contacts[contact];
        const d=sub(to,from),length=Math.hypot(...d);if(length<min){const n=length>.001?scale(d,1/length):[1,0,0];move(n,(min-length)*smooth(q/.08)*.9);}
      }
    }
    return result;
  }
  const API={frame,anchor,grips,release,sampleRig,solveSample,segmentPair};root.CombatWrestling=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
