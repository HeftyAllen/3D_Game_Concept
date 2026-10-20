/* Fit the rendered action inside the playable area, including airborne bodies. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  class ActionCamera{
    constructor(){this.at=null;this.distance=0;this.elevation=.52;this.fov=.76;this.safe={x:.82,top:.62,bottom:.76};}
    reset(){this.at=null;this.distance=0;}
    update(points,{dt=1/60,aspect=1.5,yaw=.43,zoom=8.15,air=0,paired=false,tilt=0,shake=0,time=0}={}){
      if(!points.length)points=[[0,1,0]];
      const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))),target=min.map((v,i)=>(v+max[i])*.5);target[1]+=.08;
      const follow=1-Math.exp(-9*Math.min(.05,dt)),elevation=clamp((paired?.46:.52-clamp(air/4,0,1)*.12)+tilt,.27,.78);
      this.at=this.at?this.at.map((v,i)=>v+(target[i]-v)*follow):target;
      this.elevation+=(elevation-this.elevation)*(1-Math.exp(-5*Math.min(.05,dt)));
      const sy=Math.sin(yaw),cy=Math.cos(yaw),se=Math.sin(this.elevation),ce=Math.cos(this.elevation),back=[sy*ce,se,cy*ce],right=[cy,0,-sy],up=[-sy*se,ce,-cy*se],tan=Math.tan(this.fov/2);
      let needed=3;
      for(const p of points){const v=p.map((x,i)=>x-this.at[i]),x=dot(v,right),y=dot(v,up),z=dot(v,back);needed=Math.max(needed,z+.8,z+Math.abs(x)/(tan*Math.max(.2,aspect)*this.safe.x),z+Math.abs(y)/(tan*(y>0?this.safe.top:this.safe.bottom)));}
      // Pull back immediately when the frame needs room; ease back in after landing.
      const desired=Math.max(needed+.22,zoom*1.12*(paired?.94:1)),ease=1-Math.exp(-2.4*Math.min(.05,dt));
      this.distance=this.distance?Math.max(needed+.22,this.distance+(desired-this.distance)*ease):desired;
      const eye=this.at.map((v,i)=>v+back[i]*this.distance),amount=Math.min(.10,shake);
      eye[0]+=Math.sin(time*130)*amount;eye[1]+=Math.cos(time*115)*amount*.5;
      return {at:[...this.at],eye,fov:this.fov,distance:this.distance,elevation:this.elevation,safe:this.safe};
    }
  }
  function actionPoints(fighters,rigs){
    const points=[];
    const box=(p,r)=>{for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])points.push([p[0]+x*r,p[1]+y*r,p[2]+z*r]);};
    for(const f of fighters){const rig=rigs[f.id];if(!rig)continue;
      const lead=f.y>.2&&!f.held?[f.vx*.10,Math.max(0,Math.min(1.6,f.vy*.14)),f.vz*.10]:[0,0,0];
      for(const [key,p] of Object.entries(rig.pts)){const radius=key==='head'?.27:['chest','torso','shoulderL','shoulderR'].includes(key)?.29:.17;box(p,radius);if(lead.some(v=>Math.abs(v)>.05))box(p.map((v,i)=>v+lead[i]),radius);}
      for(const limb of Object.values(rig.elastic))for(const p of limb.curve)box(p,limb.radius||.13);
      if(rig.balloon)box(rig.balloon.center,rig.balloon.radius*1.12);
    }
    return points;
  }
  const API={ActionCamera,actionPoints};root.CombatCamera=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
