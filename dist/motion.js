/* Shared performance layer: planted support, body mechanics and inertial pose changes. */
(function(root){
  'use strict';
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
  const smooth=t=>{t=C(t,0,1);return t*t*t*(t*(t*6-15)+10);};
  function envelope(t,start,end){if(t<=start)return smooth(C((t/start-.15)/.85,0,1));return 1-smooth((t-start-.035)/Math.max(.02,end-start-.035));}
  class Motion{
    constructor(world){this.world=world;this.states={};}
    state(f){return this.states[f.id]??={x:f.x,z:f.z,time:this.world.time,yaw:f.angle,speed:0,phase:f.id==='player'?0:.65,plants:{},blend:null,last:null,vel:{},lastState:null};}
    locomotion(f,p){
      const s=this.state(f),dt=C(this.world.time-s.time,0,.05),dx=f.x-s.x,dz=f.z-s.z,speed=dt>0?Math.min(5.5,Math.hypot(dx,dz)/dt):s.speed;
      s.speed+=(speed-s.speed)*(1-Math.exp(-12*dt));s.phase+=Math.hypot(dx,dz)*Math.PI/.62;s.x=f.x;s.z=f.z;s.dt=dt;s.time=this.world.time;
      if(f.action||f.held||f.down>0||f.y>.1&&!f.mobility?.support&&!f.elementSupport||f.balloon||f.visual?.pair)return;
      const weight=C(s.speed/1.8,0,1),dir=Math.hypot(dx,dz)>.0001?[(dx*Math.cos(f.angle)-dz*Math.sin(f.angle))/Math.hypot(dx,dz),(dx*Math.sin(f.angle)+dz*Math.cos(f.angle))/Math.hypot(dx,dz)]:[0,1];
      const stride=Math.min(.44,.15+s.speed*.075)*weight;
      for(const side of ['L','R']){const phase=s.phase+(side==='L'?0:Math.PI),swing=Math.max(0,Math.sin(phase)),advance=Math.cos(phase)*stride;
        p['foot'+side][0]+=dir[0]*advance;p['foot'+side][2]+=dir[1]*advance;p['foot'+side][1]+=swing*.17*weight;
        p['knee'+side][0]+=dir[0]*advance*.6;p['knee'+side][2]+=dir[1]*advance*.55+swing*.10*weight;
        p['hand'+side][2]-=Math.cos(phase)*.07*weight;p['elbow'+side][2]-=Math.cos(phase)*.09*weight;
      }
      p.drop+=Math.abs(Math.sin(s.phase))*.038*weight;p.spine[0]+=Math.sin(s.phase)*.035*weight;p.spine[1]+=.055*weight;p.twist+=Math.sin(s.phase)*.11*weight;
      p.head[0]-=Math.sin(s.phase)*.014*weight;
      const lateral=dir[0]*weight,brake=C((s.speed-speed)*.015,-.035,.035);p.spine[0]-=lateral*.035;p.spine[1]+=brake;p.hipL[0]+=Math.sin(s.phase)*.012*weight;p.hipR[0]+=Math.sin(s.phase)*.012*weight;p.head[2]-=brake*.5;
    }
    mechanics(f,p){
      const a=f.action,m=a?.move,s=this.state(f);if(f.visual?.pair||f.held||f.down>0)return;
      if(a&&!m.ranged&&!m.reload&&!m.propPickup&&!m.propFetch){
        const beat=C(a.t/m.startup,0,1),windup=Math.sin(C(beat/.5,0,1)*Math.PI)*(beat<.5?1:0),hit=envelope(a.t,m.startup,m.duration),kick=/kick|knee|sweep|slam|Axe|Round/.test(m.pose),left=m.limb==='L'||m.limb==='legL'||/jab|hook|lead|shovel|ridge|backfist/i.test(m.pose),sign=left?-1:1;
        p.drop+=windup*(kick?.045:.035);p.spine[1]-=windup*.035;p.twist-=sign*windup*.10;
        if(!m.elastic&&!m.wind&&!m.grab&&!m.throwType){
          p.spine[0]+=sign*hit*(kick?.065:.045);p.hipL[2]+=hit*.025;p.hipR[2]-=hit*.025;
          const follow=a.t>m.startup?Math.sin(C((a.t-m.startup)/(m.duration-m.startup),0,1)*Math.PI):0;p.twist+=sign*follow*(kick?.055:.035);p.drop+=hit*(m.damage>=22?.020:.008);p.head[0]-=sign*hit*.012;
          const support=kick?(m.limb==='legL'||/leadkick|kneelead/.test(m.pose)?'R':'L'):left?'R':'L';
          p['knee'+support][1]-=.045*hit;p['knee'+support][2]+=.07*hit;
          if(!kick){p.head[2]-=hit*.035;p['hand'+(left?'R':'L')][1]+=.045*hit;}
          else{p['hand'+(support==='L'?'R':'L')][0]+=sign*.07*hit;}
        }
        if(m.throwType||m.grab)p.drop+=Math.sin(C(a.t/m.duration,0,1)*Math.PI)*.015;
      }
      if(f.impact&&!f.action&&f.stunned>0&&f.y<.12){
        const hit=f.impact,profile=root.CombatFlow.PROFILES[hit.profile||(hit.zone==='leg'?'leg':hit.zone==='body'?'body':'tap')],age=this.world.time-hit.at,t=C(age/profile.duration,0,1),w=Math.sin(Math.PI*Math.pow(t,.65))*(1-t),power=Math.min(1.25,hit.power/3)/Math.sqrt(f.mass||1),localX=hit.direction[0]*Math.cos(f.angle)-hit.direction[2]*Math.sin(f.angle),localZ=hit.direction[0]*Math.sin(f.angle)+hit.direction[2]*Math.cos(f.angle);
        const zone=hit.zone,head=zone==='head',leg=zone==='leg',strength=w*power;
        p.spine[0]+=localX*(leg?.17:profile.fold)*strength;p.spine[1]+=localZ*profile.fold*strength;p.twist+=hit.side*(head?.27:.15)*strength;p.drop+=(leg?.25:head?.035:.14)*strength;
        p.head[0]+=localX*(head?profile.whip:-.055)*strength;p.head[2]+=localZ*(head?profile.whip:-.08)*strength;
        if(leg){const side=hit.side<0?'L':'R';p['knee'+side][1]-=.17*strength;p['knee'+side][2]+=.24*strength;p['foot'+side][2]-=.12*strength;p['handL'][0]-=.10*strength;p['handR'][0]+=.10*strength;}
        if(hit.profile==='body'){p.handL[1]-=.20*strength;p.handR[1]-=.20*strength;p.elbowL[2]+=.14*strength;p.elbowR[2]+=.14*strength;}
        if(hit.profile==='electric'){const twitch=Math.sin(age*65)*strength*.035;p.handL[0]-=twitch;p.handR[0]+=twitch;p.drop+=Math.abs(twitch);}
      }
      if((f.balanceBreakUntil||0)>this.world.time&&!f.action){const sway=Math.sin(this.world.time*7)*.025;p.drop+=.17;p.spine[1]+=.16;p.spine[0]+=sway;p.kneeL[2]+=.13;p.kneeR[2]+=.10;p.handL[1]-=.18;p.handR[1]-=.13;}
      s.yaw=f.angle;
    }
    blend(f,p){
      const s=this.state(f),dt=s.dt||0,key=(f.action?f.action.id+':'+f.action.chain:'idle')+':'+(f.visual?.grip||'')+':'+!!f.visual?.pair+':'+!!f.visual?.mounted;
      if(!s.last){s.last=JSON.parse(JSON.stringify(p));s.lastState=key;return p;}
      if(key!==s.lastState){
        const offsets={},velocity={};for(const k of Object.keys(p)){offsets[k]=Array.isArray(p[k])?p[k].map((v,i)=>s.last[k][i]-v):k==='twist'?angle(s.last[k]-p[k]):s.last[k]-p[k];velocity[k]=s.vel[k]|| (Array.isArray(p[k])?p[k].map(()=>0):0);}
        s.blend={at:this.world.time,offsets,velocity,duration:f.visual?.pair?.10:f.recovery?.13:f.action?.connected?.075:.095};s.lastState=key;
      }
      if(s.blend){const b=s.blend,t=this.world.time-b.at,k=5/b.duration,decay=Math.exp(-k*t);
        if(t<b.duration*2.2)for(const field of Object.keys(p)){const off=b.offsets[field],v=b.velocity[field],apply=(value,o,d)=>value+(o+(C(d,-4,4)+k*o)*t)*decay;p[field]=Array.isArray(p[field])?p[field].map((x,i)=>apply(x,off[i],v[i]||0)):apply(p[field],off,v||0);}
        else s.blend=null;
      }
      if(dt>0)for(const k of Object.keys(p))s.vel[k]=Array.isArray(p[k])?p[k].map((v,i)=>C((v-s.last[k][i])/dt,-5,5)):C((k==='twist'?angle(p[k]-s.last[k]):p[k]-s.last[k])/dt,-6,6);
      s.last=JSON.parse(JSON.stringify(p));return p;
    }
    plant(f,rig,solveLeg){
      const s=this.state(f),m=f.action?.move,pair=f.visual?.pair,loaded=pair&&f.visual.role==='holder'&&!['pickup','mount'].includes(pair),disabled=f.y>.10&&!f.mobility?.support&&!f.elementSupport||f.held||f.down>0||f.ko||f.balloon||f.dodge||pair||f.visual?.mounted||f.visual?.role==='grounded'||m?.air||m?.elastic;
      const floor=f.elementSupport?.top??(f.mobility?.support?f.y:0);if(floor!==(s.floor||0)){for(const plant of Object.values(s.plants))plant.p[1]+=floor-(s.floor||0);s.floor=floor;}
      if(loaded){rig.planted=[];for(const side of ['L','R']){if(pair==='sweep'&&side==='L'&&f.visual.phase>.12&&f.visual.phase<.92){delete s.plants[side];continue;}const foot=rig.pts['foot'+side],hip=rig.pts['hip'+side];let plant=s.plants[side];if(!plant||Math.hypot(plant.p[0]-hip[0],plant.p[2]-hip[2])>.67||Math.abs(angle(f.angle-plant.yaw))>.62){const sign=side==='L'?-1:1;plant=s.plants[side]={p:[f.x+Math.cos(f.angle)*sign*.22+Math.sin(f.angle)*.10,(f.y||0)+.085,f.z-Math.sin(f.angle)*sign*.22+Math.cos(f.angle)*.10],yaw:f.angle,at:this.world.time};}const leg=solveLeg(hip,plant.p,rig.pts['knee'+side]);rig.pts['foot'+side]=leg.foot;rig.pts['knee'+side]=leg.knee;rig.planted.push('foot'+side);}return;}
      rig.planted=[];if(disabled){s.plants={};return;}
      const hit=f.impact,unsteady=!m&&hit?.zone==='leg'&&this.world.time-hit.at<.30,kick=m&&/kick|knee|sweep|slam|Axe|Round/.test(m.pose),strike=unsteady?(hit.side<0?'L':'R'):kick?(m.limb==='legL'||/leadkick|kneelead/.test(m.pose)?'L':'R'):null;
      for(const side of ['L','R']){
        const foot=rig.pts['foot'+side],hip=rig.pts['hip'+side],phase=s.phase+(side==='L'?0:Math.PI),stance=!f.moving||Math.sin(phase)<.02,free=strike===side;
        let plant=s.plants[side];if(free||!stance){delete s.plants[side];continue;}
        const gap=plant?Math.hypot(plant.p[0]-hip[0],plant.p[2]-hip[2]):0;
        if(!plant||gap>.60||Math.abs(angle(f.angle-plant.yaw))>.45){plant=s.plants[side]={p:[foot[0],Math.max(floor+.085,foot[1]),foot[2]],yaw:f.angle,at:this.world.time};}
        const lift=Math.max(0,Math.sin(C((this.world.time-plant.at)/.13,0,1)*Math.PI))*(gap>.45?.05:0),goal=[plant.p[0],plant.p[1]+lift,plant.p[2]],leg=solveLeg(hip,goal,rig.pts['knee'+side]);
        rig.pts['foot'+side]=leg.foot;rig.pts['knee'+side]=leg.knee;rig.planted.push('foot'+side);
      }
    }
    snapshot(id){const s=this.states[id];return s?{speed:s.speed,phase:s.phase,plants:Object.keys(s.plants),blending:!!s.blend}:null;}
  }
  root.CombatMotion={Motion,envelope,smooth};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatMotion;
})(typeof window!=='undefined'?window:globalThis);
