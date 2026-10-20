/* Shared humanoid skeleton: render poses and contact traces use this same articulated rig. */
(function(root){
  'use strict';
  const MotionAPI=root.CombatMotion||(typeof require==='function'?require('./motion.js'):null);
  const Wrestling=root.CombatWrestling||(typeof require==='function'?require('./wrestling.js'):null);
  const Clips=root.CombatClips||(typeof require==='function'?require('./clips.js'):null);
  const C=(v,a,b)=>Math.max(a,Math.min(b,v));
  const V = {
    sub: (a, b) => a.map((v, i) => v - b[i]),
    cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
    dot: (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
    unit(a) { const l = Math.hypot(...a) || 1; return a.map(v => v/l); }
  };
  function mul(a, b) {
    const o = new Float32Array(16);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      o[j*4+i] = a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3];
    }
    return o;
  }
  function model(pos, scale, angle = 0) {
    const co = Math.cos(angle), si = Math.sin(angle);
    return new Float32Array([co*scale[0],0,-si*scale[0],0,0,scale[1],0,0,si*scale[2],0,co*scale[2],0,...pos,1]);
  }
  function rigBasis(yaw,pitch) {
    const c=Math.cos(pitch),s=Math.sin(pitch);
    return mul(model([0,0,0],[1,1,1],yaw),new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]));
  }
  function oriented(pos,scale,basis) {
    const m=new Float32Array(basis);
    for(let j=0;j<3;j++)for(let i=0;i<3;i++)m[j*4+i]*=scale[j];
    m[12]=pos[0];m[13]=pos[1];m[14]=pos[2];return m;
  }
  function solveArm(shoulder,goal,hint) {
    const delta=V.sub(goal,shoulder),len=Math.hypot(...delta),direction=V.unit(delta),reach=C(len,.16,.79);
    const hand=shoulder.map((v,i)=>v+direction[i]*reach);
    const mid=shoulder.map((v,i)=>v+direction[i]*reach*.50);
    let bend=V.sub(hint,mid),along=V.dot(bend,direction);bend=bend.map((v,i)=>v-direction[i]*along);
    bend=V.unit(bend);const depth=Math.sqrt(Math.max(.003,.41*.41-reach*reach*.25));
    return {hand,elbow:mid.map((v,i)=>v+bend[i]*depth)};
  }
  function jointBasis(right,up){
    const y=Math.hypot(...up)>1e-7?V.unit(up):[0,1,0];let projection=V.dot(right,y),side=right.map((v,i)=>v-y[i]*projection);
    if(Math.hypot(...side)<1e-6){const ref=Math.abs(y[1])<.9?[0,1,0]:[1,0,0];projection=V.dot(ref,y);side=ref.map((v,i)=>v-y[i]*projection);}
    const x=V.unit(side),z=V.unit(V.cross(x,y));return new Float32Array([...x,0,...y,0,...z,0,0,0,0,1]);
  }
  function between(a, b, radius) {
    const v = V.sub(b, a), length = Math.hypot(...v), y = V.unit(v);
    const x = V.unit(Math.abs(y[1]) > .99 ? [1,0,0] : V.cross([0,1,0], y)), z = V.cross(x, y);
    return new Float32Array([x[0]*radius,x[1]*radius,x[2]*radius,0,...y.map(c=>c*length),0,...z.map(c=>c*radius),0,...a,1]);
  }
  function bezier(points,t){const u=1-t;return points[0].map((v,i)=>u*u*u*v+3*u*u*t*points[1][i]+3*u*t*t*points[2][i]+t*t*t*points[3][i]);}
  function solveLeg(hip,foot,hint){
    const d=V.sub(foot,hip),length=C(Math.hypot(...d),.17,.97),axis=V.unit(d),mid=hip.map((v,i)=>v+axis[i]*length*.5);
    let bend=V.sub(hint,mid),along=V.dot(bend,axis);bend=V.unit(bend.map((v,i)=>v-axis[i]*along));
    const depth=Math.sqrt(Math.max(.002,.49*.49-length*length*.25));
    return {knee:mid.map((v,i)=>v+bend[i]*depth),foot:hip.map((v,i)=>v+axis[i]*length)};
  }
  const lerpVector=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const Skin={
    weight(t){const u=C((t-.32)/.36,0,1);return u*u*(3-2*u);},
    vertex(q,joints,radius=1){
      const [a,b,c,right]=joints,d0=V.sub(b,a),d1=V.sub(c,b),y0=V.unit(d0),y1=V.unit(d1),w=this.weight(q[1]),tangent=V.unit(lerpVector(y0,y1,w)),basis=jointBasis(right,tangent),bulge=1+.10*(1-V.dot(y0,y1))*w*(1-w);
      const p0=a.map((v,i)=>v+y0[i]*q[1]*2*Math.hypot(...d0)),p1=b.map((v,i)=>v+y1[i]*(q[1]-.5)*2*Math.hypot(...d1)),center=lerpVector(p0,p1,w);
      return center.map((v,i)=>v+(basis[i]*q[0]+basis[8+i]*q[2])*radius*bulge);

    }
  };
  class Humanoid{
    constructor(world,options={}){this.world=world;this.pure=!!options.pure;this.motion=options.motion||new MotionAPI.Motion(world);this.ragdolls=options.ragdolls||{};this.footMemory=options.footMemory||{};this.elasticMemory=options.elasticMemory||{};this.rigs={};}
    pose(f) {
      const s=Math.sin(f.walk),c=Math.cos(f.walk),moving=f.moving>0;
      const p={hipL:[-.15,.99,0],hipR:[.15,.99,-.05],kneeL:[-.2,.57,.11],kneeR:[.2,.56,-.18],footL:[-.2,.09,.26],footR:[.23,.09,-.34],
        shoulderL:[-.34,1.6,0],shoulderR:[.34,1.6,0],elbowL:[-.40,1.31,.1],elbowR:[.41,1.31,-.07],handL:[-.23,1.67,.41],handR:[.25,1.60,.34],
        head:[0,1.99,-.005],torso:[0,1.35,-.035],spine:[0,0],tilt:0,twist:0,drop:-Math.sin(this.world.time*2.1+(f.id==='player'?0:1.8))*.012};
      const rest=JSON.parse(JSON.stringify(p));
      this.ragdolls[f.id]??={mode:'active',recovery:1};
      if(!this.pure)this.motion.locomotion(f,p);
      if(f.id!=='player'&&!f.action&&!f.held&&!f.down){const style=f.style||this.world.opponentStyle;if(style==='boxer'){p.handL=[-.20,1.84,.40];p.handR=[.20,1.81,.38];p.drop+=.035;p.tilt=.035;}if(style==='wrestler'){p.handL=[-.32,1.39,.46];p.handR=[.32,1.37,.46];p.drop+=.09;p.tilt=.12;}if(style==='elastic'){p.handL[1]-=.12;p.handR[1]-=.10;p.spine[1]=-.04;}}
      if(f.guard){p.handL=[-.16,1.86,.46];p.handR=[.15,1.85,.45];p.elbowL=[-.30,1.42,.23];p.elbowR=[.30,1.42,.22];p.drop=.07;}
      if(f.dodge){const q=Math.sin(C(f.dodge.t/(f.dodge.duration||.38),0,1)*Math.PI),side=f.dodge.x*Math.cos(f.angle)-f.dodge.z*Math.sin(f.angle),kind=f.dodge.kind;p.drop=(kind==='slip'?.46:kind==='backstep'?.12:.24)*q;p.tilt=(kind==='backstep'?-.20:.25)*q;p.spine[0]+=.23*side*q;p.handL[1]-=.18*q;p.handR[1]-=.18*q;p.footL[0]+=.14*side*q;p.footR[0]+=.14*side*q;}
      if(f.y>.1&&!f.mobility?.support&&!f.elementSupport){p.kneeL=[-.23,.64,.35];p.footL=[-.28,.23,.18];p.kneeR=[.24,.63,-.1];p.footR=[.25,.24,-.39];}
      const mobility=f.mobility;
      if(mobility&&!f.held&&!f.down&&!f.ko&&!f.visual?.pair){
        const duck=mobility.crouch;
        if(duck>.001){p.drop+=.50*duck;p.head[1]-=.18*duck;p.head[2]+=.12*duck;p.spine[1]+=.16*duck;p.tilt+=.16*duck;p.kneeL[2]+=.25*duck;p.kneeR[2]+=.28*duck;p.handL[1]-=.17*duck;p.handR[1]-=.13*duck;p.handL[2]+=.08*duck;p.handR[2]+=.08*duck;}
        if(mobility.voluntary&&f.y>.1&&!f.action){const rise=C(f.vy/6,-1,1),wind=Math.max(0,1-(this.world.time-(mobility.redirectAt??-10))/.32);p.kneeL[2]+=.14*Math.max(0,rise);p.footR[2]-=.18*Math.max(0,rise);p.handL[0]-=.16*wind;p.handR[0]+=.16*wind;p.handL[1]+=.13*wind;p.handR[1]+=.13*wind;p.tilt=-.07*rise;}
        const age=this.world.time-mobility.landAt,span=mobility.landKind==='tech'?.28:.24,land=age>=0&&age<span?Math.sin(age/span*Math.PI):0;
        if(land&&!f.action){p.drop+=(mobility.landKind==='tech'?.34:.19)*land;p.tilt+=.12*land;p.kneeL[2]+=.21*land;p.kneeR[2]+=.18*land;p.handL[2]+=.12*land;p.handR[2]+=.12*land;}
      }
      const v=f.visual;
      if(f.id==='player'&&!f.action&&!f.down&&!f.held&&!f.ko){const charge=this.world.power?.charge;if(charge){const load=C((this.world.time-charge.at)/.7,0,1);p.drop+=.07*load;p.tilt-=.04*load;p.handL=[-.23,1.48+load*.12,.50];p.handR=[.23,1.48+load*.12,.50];p.twist-=.08*load;}if(this.world.elementPhysics?.surf){p.drop+=.20;p.tilt=.14;p.kneeL[2]+=.18;p.kneeR[2]+=.12;p.handL=[-.61,1.40,.18];p.handR=[.59,1.48,-.08];p.spine[0]=.05;}}
      if(v?.role==='holder'&&!v.pair&&!v.mounted){
        p.handL=[-.27,v.grip==='front'?1.76:1.13,.70];p.handR=[.27,v.grip==='front'?1.76:1.13,.70];
        p.elbowL=[-.43,1.4,.24];p.elbowR=[.43,1.4,.24];p.drop=.025;p.twist=0;
      }
      if(v?.role==='held'){
        p.handL=[-.24,1.6,.3];p.handR=[.24,1.6,.3];p.elbowL=[-.42,1.37,.22];p.elbowR=[.42,1.37,.22];p.tilt=0;p.twist=0;p.drop=0;
        if(v.pair){const fold=MotionAPI.smooth((v.phase-.10)/.30)*(1-MotionAPI.smooth((v.phase-.80)/.18));for(const [key,goal] of Object.entries({kneeL:[-.23,.62,.23],kneeR:[.23,.64,.2],footL:[-.25,.22,.12],footR:[.25,.20,.06]}))p[key]=p[key].map((x,i)=>x+(goal[i]-x)*fold);}
        if(v.pair==='doubleleg'||v.pair==='sweep'){p.handL=[-.38,1.9,.05];p.handR=[.38,1.9,.05];}
        if(v.pair){const load=Math.sin(v.phase*Math.PI);p.spine[1]=-.12*load;p.kneeL[2]+=.16*load;p.kneeR[2]+=.12*load;p.footL[1]+=.12*load;p.footR[1]+=.14*load;p.head[2]-=.05*load;}
      }
      if(v?.role==='grounded'||(!v&&(f.down>0||f.ko))){
        p.kneeL=[-.23,.62,.12];p.kneeR=[.23,.63,.09];p.footL=[-.25,.18,.10];p.footR=[.25,.18,.05];
        p.handL=[-.30,1.35,.12];p.handR=[.30,1.35,.12];p.tilt=p.twist=p.drop=0;
      }
      if(v?.mounted){
        p.kneeL=[-.4,.57,.26];p.kneeR=[.4,.57,.26];p.footL=[-.43,.42,.5];p.footR=[.43,.42,.5];
        p.handL=[-.22,1.54,.35];p.handR=[.22,1.5,.35];p.drop=0;
      }
      if(f.action){
        const a=f.action,m=a.move,t=a.t;
        const ease=x=>{x=C(x,0,1);return x*x*(3-2*x);};
        const activeEnd=m.startup+.065;
        const e=MotionAPI.envelope(t,m.startup,m.duration);
        const phase=C(t/m.duration,0,1),v=m.pose;
        const mix=(key,goal)=>{p[key]=p[key].map((x,i)=>x+(goal[i]-x)*e);};
        if(m.element){
          if(v==='earthRaise'||v==='earthLift'){mix('handL',[-.34,1.04+e*.72,.74]);mix('handR',[.34,1.04+e*.72,.74]);p.drop=.17*(1-e);p.tilt=-.10*e;}
          if(v==='earthQuake'){mix('handR',[.25,1.12-.62*e,.62]);mix('handL',[-.30,1.22-.45*e,.55]);p.drop=.34*e;p.tilt=.24*e;}
          if(v==='fireCast'){mix('handR',[.12,1.55,.96]);mix('elbowR',[.26,1.37,.50]);p.twist=-.22*e;}
          if(v==='flameSweep'){mix('handL',[-.45,1.56,.85]);mix('handR',[.55-e*.65,1.5,.87]);p.twist=.36-.72*e;}
          if(v==='fireBurst'){mix('handL',[-.64,1.58,.55]);mix('handR',[.64,1.58,.55]);p.drop=.16*e;p.spine[1]=.12*e;}
        }
        if(v==='waterCast'){mix('handR',[.08,1.60,.96]);mix('elbowR',[.26,1.38,.48]);p.twist=-.20*e;}
        if(v==='tideLash'){mix('handR',[.55-e*.90,1.55,.55+e*.36]);mix('handL',[-.35,1.66,.48]);p.twist=.30-.60*e;p.spine[1]=.10*e;}
        if(v==='waterSpout'){mix('handL',[-.48,1.14+e*.75,.72]);mix('handR',[.48,1.14+e*.75,.72]);p.drop=.12*(1-e);p.tilt=-.08*e;}
        if(v==='hydroCast'){mix('handL',[-.13,1.38,.30+e*.65]);mix('handR',[.13,1.38,.30+e*.65]);p.tilt=.15*e;p.drop=.10*(1-e);}
        if(v==='riptideSweep'){mix('handR',[.55-e*1.1,1.06,.68]);mix('handL',[-.40,1.30,.38]);p.twist=.35-.7*e;p.drop=.22*e;}
        if(v==='boulderCast'){mix('handR',[.45,1.8,.10+e*.85]);mix('handL',[-.4,1.54,.38]);p.twist=-.38*e;p.spine[1]=.12*e;}
        if(v==='ridgeStomp'){const stomp=ease(t/Math.max(.05,m.startup));mix('kneeR',[.25,.82-stomp*.2,.48]);mix('footR',[.26,.45*(1-stomp),.57]);mix('handR',[.32,1.35-e*.48,.55]);mix('handL',[-.42,1.62,.30]);p.drop=.19*e;p.tilt=.12*e;p.twist=-.14*e;}
        if(v==='dragonBreath'){const sustain=t>m.startup&&t<m.duration-.12?1:e;p.handL=p.handL.map((x,i)=>x+([-.15,1.51,.78][i]-x)*sustain);p.handR=p.handR.map((x,i)=>x+([.15,1.51,.78][i]-x)*sustain);p.drop=.14*sustain;p.tilt=.13*sustain;p.spine[1]=.06*sustain;}
        if(v==='undertowPull'){mix('handL',[-.65+e*.4,1.13,.85-e*.62]);mix('handR',[.65-e*.4,1.13,.85-e*.62]);p.drop=.20*e;p.tilt=-.15*e;p.twist=.16*Math.sin(phase*Math.PI*2);}
        if(v==='stoneVault'){mix('handL',[-.45,1.12+e*.60,.26]);mix('handR',[.45,1.12+e*.60,.26]);p.drop=.30*(1-e);p.tilt=-.08*e;}
        if(v==='flareRush'||v==='tideStep'){mix('handL',[-.35,1.30,-.24]);mix('handR',[.35,1.30,-.20]);p.drop=.25*e;p.tilt=.28*e;p.spine[1]=.08*e;}
        if(m.element==='fusion'){
          const ground=v==='lavaRelease'||v==='mudRelease';mix('handL',[-.35-(v==='stormRelease'?.3*e:0),ground?1.25-.6*e:1.50,.25+e*.7]);mix('handR',[.35+(v==='typhoonRelease'?.3*e:0),ground?1.25-.6*e:1.50,.25+e*.7]);p.drop=(ground?.30:.12)*e;p.tilt=.16*e;
          if(v==='plasmaRelease'){mix('handR',[.08,1.64,1.05]);mix('handL',[-.13,1.55,.60]);p.twist=-.25*e;}
          if(v==='magnetRelease'){mix('handL',[-.65,1.58,.70-.5*e]);mix('handR',[.65,1.58,.70-.5*e]);p.tilt=-.12*e;}
        }
        if(v==='arcCast'){mix('handR',[.04,1.65,1.0]);mix('elbowR',[.22,1.43,.55]);p.twist=-.25*e;p.spine[1]=.08*e;}
        if(v==='voltageLift'){mix('handL',[-.22,1.08+e*1.0,.76]);mix('handR',[.22,1.08+e*1.0,.76]);p.drop=.12*(1-e);p.tilt=-.08*e;}
        if(v==='thunderclap'){mix('handL',[-.75*(1-e)-.10,1.85,.65]);mix('handR',[.75*(1-e)+.10,1.85,.65]);p.drop=.12*e;p.twist=.13*e;p.spine[1]=.10*e;}
        if(v==='vacuum'){mix('handL',[-.46,1.47,.82-.48*e]);mix('handR',[.46,1.47,.82-.48*e]);mix('elbowL',[-.56,1.33,.27]);mix('elbowR',[.56,1.33,.27]);p.tilt=-.13*e;p.drop=.10*e;}
        if(v==='windDash'){mix('handR',[.02,1.54,1.05]);mix('handL',[-.34,1.71,.42]);p.tilt=.28*e;p.twist=-.31*e;mix('footL',[-.27,.12,-.40]);mix('kneeR',[.24,.71,.45]);}
        if(v==='cyclone'){const spin=Math.sin(phase*Math.PI*2)*.44;mix('handL',[-.5-spin,1.53+e*.28,.62]);mix('handR',[.5+spin,1.53+e*.28,.62]);p.twist=.5*Math.sin(phase*Math.PI*2);p.spine[0]=.06*Math.sin(phase*Math.PI*2);p.drop=.08*(1-e);}
        if(v==='gale'){mix('handL',[-.42,1.46,.48]);mix('handR',[.03,1.58,1.03]);mix('elbowR',[.24,1.35,.54]);p.twist=-.38*e;p.tilt=.15*e;p.spine[1]=.08*e;}
        if(v==='updraft'){mix('handL',[-.25,1.15+e*.92,.78]);mix('handR',[.25,1.15+e*.92,.78]);mix('elbowL',[-.37,1.40,.42]);mix('elbowR',[.37,1.40,.42]);p.drop=.13*(1-e);p.tilt=-.08*e;p.spine[1]=-.07*e;}
        if(v==='downburst'){mix('handL',[-.32,2.20-e*.98,.88]);mix('handR',[.32,2.20-e*.98,.88]);p.drop=.16*e;p.tilt=.27*e;p.spine[1]=.1*e;}
        if(v==='windKick'){mix('kneeR',[.52,.99,.34]);mix('footR',[.14,1.55,1.0]);mix('handL',[-.6,1.7,.15]);mix('handR',[.48,1.75,-.12]);p.twist=-1.5*e;p.tilt=-.16*e;p.drop=-.18*e;}
        if(v==='elasticAxe'){mix('kneeL',[-.20,1.48,.55]);mix('footL',[-.12,1.94-e*.7,.75]);p.tilt=-.18*e;p.twist=.28*e;}
        if(v==='jab'){mix('elbowL',[-.15,1.57,.56]);mix('handL',[-.04,1.63,1.04]);p.twist=.15*e;p.tilt=.07*e;}
        if(v==='cross'||v==='airpunch'){mix('elbowR',[.22,1.50,.56]);mix('handR',[.02,1.65,1.05]);p.twist=-.30*e;p.tilt=.1*e;}
        if(v==='palm'){mix('elbowR',[.22,1.45,.51]);mix('handR',[.03,1.65,1.0]);p.twist=-.35*e;p.tilt=.10*e;}
        if(v==='shovel'){mix('elbowL',[-.42,1.06,.40]);mix('handL',[.06,1.16,.85]);p.twist=.38*e;p.drop=.10*e;}
        if(v==='leadupper'||v==='airlift'){mix('elbowL',[-.30,1.39,.45]);mix('handL',[.03,1.05+e*1.1,.72]);p.twist=.34*e;p.drop=.07*(1-e);}
        if(v==='ridgehand'){mix('elbowL',[-.55,1.54,.42]);mix('handL',[.25,1.67,.90]);p.twist=.45*e;p.spine[0]=.06*e;}
        if(v==='doublepalm'){mix('handL',[-.20,1.48,.99]);mix('handR',[.20,1.48,.99]);mix('elbowL',[-.29,1.33,.47]);mix('elbowR',[.29,1.33,.47]);p.tilt=.20*e;}
        if(v==='hook'||v==='airhook'){mix('elbowL',[-.52,1.56,.52]);mix('handL',[.24,1.66,.86]);p.twist=.50*e;}
        if(v==='body'){mix('elbowR',[.39,1.13,.48]);mix('handR',[-.12,1.09,.86]);p.twist=-.36*e;p.drop=.15*e;}
        if(v==='elbow'){mix('elbowR',[.12,1.69,.9]);mix('handR',[-.17,1.74,.47]);p.twist=-.48*e;p.tilt=.1*e;}
        if(v==='overhand'||v==='hammer'){mix('elbowR',[.32,1.94,.35]);mix('handR',[.05,1.52+(1-e)*.75,.95]);p.tilt=.23*e;p.twist=-.33*e;}
        if(v==='uppercut'){mix('elbowR',[.32,1.45,.52]);mix('handR',[-.07,.85+e*1.35,.73]);p.twist=-.45*e;p.drop=.09*(1-e);}
        if(v==='frontkick'||v==='sidekick'){mix('kneeR',[.10,1.08,.70]);mix('footR',[.08,1.14,1.39]);p.tilt=-.25*e;p.twist=-.17*e;}
        if(v==='lowkick'){mix('kneeR',[.41,.62,.5]);mix('footR',[-.12,.42,1.27]);p.twist=-.33*e;p.tilt=-.06*e;}
        if(v==='leadkick'){mix('kneeL',[-.12,.99,.59]);mix('footL',[-.04,1.04,1.22]);p.twist=.23*e;p.tilt=-.15*e;}
        if(v==='oblique'){mix('kneeR',[.22,.75,.6]);mix('footR',[.08,.54,1.18]);p.twist=-.20*e;p.tilt=-.09*e;}
        if(v==='questionkick'){const arc=Math.sin(C(t/m.startup,0,1)*Math.PI);mix('kneeR',[.22,1.16,.64]);mix('footR',[-.22,1.65,.98]);p.footR[0]+=.35*arc;p.twist=-.42*e;p.tilt=-.24*e;}
        if(v==='wheelkick'||v==='airspin'){mix('kneeR',[.20,1.28,.50]);mix('footR',[-.17,1.77,1.10]);p.twist=Math.PI*2*ease(t/m.startup);p.tilt=-.27*e;p.drop=-.11*Math.sin(phase*Math.PI);}
        if(v==='jumpkick'){mix('kneeL',[-.18,1.15,.45]);mix('footL',[-.19,.56,.30]);mix('kneeR',[.15,1.32,.64]);mix('footR',[-.16,1.53,1.16]);p.twist=-.40*e;p.drop=-.24*Math.sin(phase*Math.PI);}
        if(v==='roundhouse'||v==='airkick'){mix('kneeR',[.42,1.18,.52]);mix('footR',[-.28,1.52,1.27]);p.twist=-.50*e;p.tilt=-.2*e;}
        if(v==='hookkick'){mix('kneeR',[.35,1.12,.48]);mix('footR',[-.30,1.55,1.18]);p.twist=-.55*e;p.spine[0]=-.07*e;p.tilt=-.16*e;}
        if(v==='axekick'){mix('kneeR',[.12,1.4,.48]);mix('footR',[.08,1.2+(1-e)*.8,1.2]);p.tilt=-.20*e;p.spine[0]=-.06*e;}
        if(v==='spinkick'){mix('kneeR',[.12,1.1,.66]);mix('footR',[.03,1.72,1.39]);p.twist=Math.PI*2*ease(t/m.startup);p.tilt=-.28*e;p.drop=-.16*Math.sin(phase*Math.PI);}
        if(v==='backfist'){mix('elbowL',[-.25,1.56,.55]);mix('handL',[.16,1.62,.98]);p.twist=Math.PI*2*ease(t/m.startup);}
        if(v==='knee'||v==='airknee'){mix('kneeR',[.07,1.37,.85]);mix('footR',[.13,.86,.30]);p.tilt=-.08*e;mix('handL',[-.28,1.97,.4]);}
        if(v==='kneelead'){mix('kneeL',[-.06,1.37,.76]);mix('footL',[-.12,.84,.27]);p.twist=.20*e;p.spine[0]=.04*e;}
        if(v==='slam'){mix('kneeR',[.25,1.43,.55]);mix('footR',[.12,.66,1.45]);p.tilt=.23*e;p.twist=-.3*e;}
        if(v==='clinch'){mix('handL',[-.27,1.76,.95]);mix('handR',[.28,1.78,.95]);mix('elbowL',[-.40,1.64,.45]);mix('elbowR',[.41,1.64,.45]);p.tilt=.1*e;}
        if(v==='throw'){mix('handL',[-.26,1.4,.75]);mix('handR',[.24,1.48,.70]);p.twist=2.4*e;p.drop=.20*e;p.tilt=.25*e;}
        if(v==='sweep'){mix('kneeL',[-.27,.48,.4]);mix('footL',[.05,.13,1.18]);p.drop=.3*e;p.twist=.30*e;}
        if(v==='groundpunch'||v==='groundelbow'||v==='groundhammer'){
          p.drop=f.visual?.mounted?.47*e:.68*e;if(v==='groundelbow')p.drop+=.11*e;p.tilt=.42*e;p.spine[1]+=.30*e;p.twist=v==='groundelbow'?-.25*e:0;
          mix('elbowR',[.28,1.03,.45]);mix('handR',[.06,.65,.87]);
          mix('handL',[-.21,1.23,.42]);
        }
        if(v==='stomp'){mix('kneeR',[.17,.96,.65]);mix('footR',[.06,.20,1.04]);p.tilt=-.08*e;}
        if(v==='upkick'){mix('kneeR',[.18,.8,.6]);mix('footR',[.05,.35+e*1.4,1.08]);p.tilt=-.18*e;}
        if(a.move.throwType||a.move.pickup||a.move.mount){
          p.twist=0;p.tilt=0;p.drop=0;
          p.handL=[-.25,1.35,.55];p.handR=[.25,1.35,.55];
          const crouch=C(1-(f.visual?.height??1),0,.45);
          p.kneeL[1]+=crouch*.6;p.kneeR[1]+=crouch*.6;p.footL[1]+=crouch;p.footR[1]+=crouch;
          if(a.move.throwType==='doubleleg'){p.handL=[-.28,.7,.8];p.handR=[.28,.7,.8];}
          const load=Math.sin(C(f.visual?.phase??phase,0,1)*Math.PI);p.spine[1]=.08*load;p.spine[0]=-.025*load;
        }
        if(a.move.elastic){
          p.twist=a.move.limb==='L'?.24*e:-.24*e;p.spine[1]=a.move.pull?-.10*e:.10*e;
          if(a.move.limb?.startsWith('leg')){p.spine[0]=-.08*e;p.tilt=-.16*e;mix(a.move.limb==='legL'?'kneeL':'kneeR',[.10,1.04,.55]);}
          if(a.move.curve==='hook'){p.twist=.46*e;p.spine[0]=.08*e;mix('elbowL',[-.55,1.51,.30]);}
          if(a.move.curve==='coil'){p.drop=.08*e;p.spine[1]=-.11*(1-e);mix('handL',[-.25,1.45,.52]);mix('handR',[.25,1.45,.52]);}
          if(a.move.pose==='elasticUpper'){p.drop=.10*(1-e);p.spine[1]=.10*e;mix('handR',[.07,.9+e*1.2,.65]);}
          if(a.move.pull){mix('handL',[-.3,1.72,.7]);mix('handR',[.3,1.72,.7]);p.tilt=-.10*e;}
        }
      }
      Clips.apply(p,rest,f);
      const carried=this.world.yard.held(f),objectMove=f.action?.move;
      if(f.action?.aimProp){const object=this.world.yard.props.find(p=>p.id===f.action.aimProp);if(object&&object.y+object.hy<1.3){const e=Math.sin(C(f.action.t/f.action.move.duration,0,1)*Math.PI);p.drop+=.22*e;p.tilt+=.15*e;}}
      if(carried){
        if(!objectMove?.weapon&&!objectMove?.propThrow){p.handR=carried.type==='blaster'?[.25,1.48,.60]:[.33,1.31,.57];p.elbowR=[.44,1.24,.20];}
      }
      if(f.action&&(objectMove.weapon||objectMove.propThrow||objectMove.propPickup)){
        const a=f.action,m=objectMove,phase=C(a.t/m.duration,0,1),e=a.t<=m.startup?Math.pow(C(a.t/m.startup,0,1),2):1-C((a.t-m.startup)/(m.duration-m.startup),0,1);
        if(m.weapon){const sign=m.pose==='weaponBack'||m.pose==='batonBack'?-1:1;p.handR=[.45*sign*(1-e)-.10*e,1.40+(m.pose==='weaponHeavy'?.36*(1-e):0),.48+.60*e];p.elbowR=[.36,1.30,.36];p.twist=-.55*e*sign;p.spine[1]=.12*e;p.handL=[-.23,1.78,.36];}
        if(m.propThrow){p.handR=[.27,1.5+.2*(1-e),.20+e*.85];p.elbowR=[.36,1.45,.35];p.twist=-.35*e;p.spine[1]=.12*e;}
        if(m.propPickup){p.drop=.48*e;p.tilt=.23*e;p.handR=[.30,1.30-.58*e,.55];p.elbowR=[.43,1.12,.30];p.handL=[-.3,1.5-.25*e,.30];}
        if(m.pose==='staffThrust'){p.handR=[.20,1.35,.45+e*.50];p.handL=[-.08,1.34,.38+e*.22];p.twist=-.15*e;p.tilt=.16*e;}
        if(m.pose==='staffSweep'){p.handR=[.55-e*.85,1.05,.65];p.handL=[.26-e*.7,1.17,.42];p.twist=-.75*e;p.drop=.12*e;}
        if(m.pose==='staffHeavy'){p.handR=[.20,1.75+(1-e)*.4,.55+e*.35];p.handL=[-.12,1.65+(1-e)*.35,.55];p.tilt=.24*e;}
        if(m.pose==='staffLift'){p.handR=[.2,1.05+e*.8,.7];p.handL=[-.14,1.1+e*.6,.5];p.twist=-.35*e;}
      }
      if(f.action?.move.ranged){const a=f.action,recoil=a.hit?Math.exp(-(a.t-a.move.startup)*25)*.14:0;p.handR=[.25,1.48+recoil,.68-recoil];p.elbowR=[.42,1.35,.26];p.handL=[.12,1.43,.60-recoil];p.elbowL=[-.24,1.30,.26];p.tilt=-recoil;p.twist=-.06;}
      if(f.action?.move.reload){const e=Math.sin(C(f.action.t/f.action.move.duration,0,1)*Math.PI);p.handR=[.25,1.30,.4];p.handL=[-.2+e*.32,1.1+e*.15,.45];p.tilt=.09*e;}
      const recovering=this.ragdolls[f.id];
      if(!f.action&&!f.down&&!f.ko&&!f.held&&(recovering.mode==='fall'||recovering.recovery<1)){
        const t=recovering.mode==='fall'?0:recovering.recovery,e=t*t*(3-2*t);
        const brace=Math.sin(C(t/.55,0,1)*Math.PI),kneel=1-MotionAPI.smooth((t-.3)/.5);
        p.drop=.39*(1-e);p.tilt=.26*(1-e);p.spine[1]=.12*(1-e);p.kneeL[2]+=.19*kneel;p.footR[2]-=.12*kneel;
        for(const side of ['L','R']){const hand=p['hand'+side],goal=[side==='L'?-.40:.40,.53+brace*.06,.40];p['hand'+side]=goal.map((v,i)=>v+(hand[i]-v)*e);p['elbow'+side][1]-=.25*(1-e);}
      }
      if(f.action&&/knee/i.test(f.action.move.pose)){const m=f.action.move,e=MotionAPI.envelope(f.action.t,m.startup,m.duration),side=m.limb==='legL'||m.pose==='kneelead'?'L':'R';p['hip'+side][2]+=.13*e;p['hip'+(side==='L'?'R':'L')][2]+=.035*e;p.spine[1]+=.035*e;}
      if(f.cover&&!f.down&&!f.held&&!f.ko){
        const s=f.cover,e=s.exposure,side=s.peek==='left'?-1:s.peek==='right'?1:0,drop=C(2.24-s.top,.48,.95)*(s.peek==='up'?1-e:1-e*.85);
        p.drop=drop;p.tilt=.08;p.spine[1]+=.08*(1-e);p.kneeL[2]+=.28;p.kneeR[2]+=.28;
        const lean=.85*side*e;p.spine[0]+=lean*(s.t[0]*Math.cos(f.angle)-s.t[1]*Math.sin(f.angle));p.spine[1]+=lean*(s.t[0]*Math.sin(f.angle)+s.t[1]*Math.cos(f.angle));
        if(!f.action){p.handL=[-.25,1.53,.30];p.handR=[.25,1.55,.35];p.elbowL=[-.4,1.3,.2];p.elbowR=[.4,1.3,.2];}
      }
      this.motion.mechanics(f,p);p.spine[1]+=p.tilt*.20;
      if(!f.visual?.pair){p.footL[1]+=p.drop;p.footR[1]+=p.drop;p.kneeL[1]+=p.drop*.5;p.kneeR[1]+=p.drop*.5;}
      return this.pure?p:this.motion.blend(f,p);
    }
    buildRig(f) {
      const p=this.pose(f),fallen=(f.down>0||f.ko)&&!f.visual&&f.y-(f.elementSupport?.top||0)<.13;
      const fall=fallen?(f.ko?1:Math.min(C((this.world.time-f.downAt)/.2,0,1),C(f.down/.32,0,1))):0;
      const pitch=f.visual?.pitch??(fall*f.downPitch);let height=f.visual?.height??(f.y+1-fall*.76);
      const wholeSpin=/spinkick|backfist|wheelkick|airspin/.test(f.action?.move.pose||'')?p.twist:p.twist*.1;
      const angle=f.angle+wholeSpin,basis=rigBasis(angle,pitch),shapeBasis=mul(basis,rigBasis(p.twist-wholeSpin,Math.atan2(p.spine[1]*2,.70)));
      const trans=q=>{
        const t=C((q[1]-.98)/.70,0,1),yaw=(p.twist-wholeSpin)*t,c=Math.cos(yaw),s=Math.sin(yaw);
        const x=q[0]*c+q[2]*s+p.spine[0]*t*t,z=q[2]*c-q[0]*s+p.spine[1]*t*t,y=q[1]-1-p.drop;
        return [f.x+basis[0]*x+basis[4]*y+basis[8]*z,height+basis[1]*x+basis[5]*y+basis[9]*z,f.z+basis[2]*x+basis[6]*y+basis[10]*z];
      };
      const pts={};for(const key of ['hipL','hipR','kneeL','kneeR','footL','footR','shoulderL','shoulderR','elbowL','elbowR','handL','handR','head','torso'])pts[key]=trans(p[key]);
      if(f.visual?.pair||f.visual?.role==='grounded'||fallen){
        const lift=Math.max(0,.18-pts.head[1],.24-pts.torso[1]);height+=lift;for(const point of Object.values(pts))point[1]+=lift;
      }
      if((!f.held||f.visual?.pair==='pickup')&&f.y<.08){pts.footL[1]=Math.max(.075,pts.footL[1]);pts.footR[1]=Math.max(.075,pts.footR[1]);}
      let feet=this.footMemory[f.id];const motion=this.world.grapple?.owner===f?this.world.grapple.motion:null;
      if(!feet)feet=this.footMemory[f.id]={motion:null,lastL:pts.footL,lastR:pts.footR};
      if(motion!==feet.motion){feet.fromL=feet.lastL;feet.fromR=feet.lastR;feet.motion=motion;}
      if(!this.pure&&motion&&!['pickup','mount','elastic'].includes(f.visual?.pair)){
        const q=f.visual?.phase??1,w=1-C((q-.10)/.36,0,1);
        for(const side of ['L','R']){if(f.visual?.pair==='sweep'&&side==='L')continue;const from=feet['from'+side];pts['foot'+side]=pts['foot'+side].map((value,i)=>value*(1-w)+from[i]*w);}
      }
      for(const side of ['L','R']){
        const leg=solveLeg(pts['hip'+side],pts['foot'+side],pts['knee'+side]);pts['knee'+side]=leg.knee;pts['foot'+side]=leg.foot;
      }
      for(const side of ['L','R']){const arm=solveArm(pts['shoulder'+side],pts['hand'+side],pts['elbow'+side]);pts['hand'+side]=arm.hand;pts['elbow'+side]=arm.elbow;}
      feet.lastL=pts.footL;feet.lastR=pts.footR;
      const rig={p,trans,pts,basis:shapeBasis,rootBasis:basis,angle,height,torsoTwist:p.twist-wholeSpin,elastic:{}};
      return rig;
    }
    rememberContactPose(f,rig){
      const state=this.motion.states[f.id];if(!state?.last||this.ragdolls[f.id]?.mode!=='active')return;
      const basis=rig.rootBasis,p=rig.p,previous=state.publishedLocal,dt=this.world.time-(state.publishedAt??this.world.time),published={};
      for(const key of ['hipL','hipR','kneeL','kneeR','footL','footR','shoulderL','shoulderR','elbowL','elbowR','handL','handR','head','torso']){
        const d=V.sub(rig.pts[key],[f.x,rig.height,f.z]),y=V.dot(d,[basis[4],basis[5],basis[6]])+1+p.drop,t=C((y-.98)/.70,0,1),yaw=rig.torsoTwist*t,c=Math.cos(yaw),s=Math.sin(yaw),x=V.dot(d,[basis[0],basis[1],basis[2]])-p.spine[0]*t*t,z=V.dot(d,[basis[8],basis[9],basis[10]])-p.spine[1]*t*t,local=[x*c-z*s,y,z*c+x*s];
        state.last[key]=local;published[key]=local;if(previous?.[key]&&dt>0)state.vel[key]=local.map((v,i)=>C((v-previous[key][i])/dt,-5,5));
      }
      state.publishedLocal=published;state.publishedAt=this.world.time;
    }
    attackAim(f,rig){
      const a=f.action,aim=a?.contactAim,m=a?.move;if(!aim||m.elastic||m.elasticProp||m.pull||m.throwType||m.pickup||m.mount)return;
      const transitionKey=aim.kind==='foot'||aim.kind==='knee'?'leg'+aim.side:aim.side;if(rig.elastic[transitionKey]&&!m.elastic)return;
      const phase=C(a.t/m.startup,0,1),e=a.t<=m.startup?MotionAPI.smooth(phase):1-MotionAPI.smooth((a.t-m.startup-.035)/Math.max(.04,m.duration-m.startup-.035));
      const side=aim.side,pts=rig.pts,key=aim.joint,partner=aim.anchor&&this.world.getFighter(a.targetId),goal=partner?aim.anchor.map((v,i)=>v+[partner.x,partner.y,partner.z][i]):aim.point;
      if(m.capture&&this.world.grapple?.owner===f)return;
      if(m.capture){for(const side of ['L','R']){const lateral=(side==='L'?-.17:.17),q=goal.map((v,i)=>v+(i===0?Math.cos(f.angle)*lateral:i===2?-Math.sin(f.angle)*lateral:0)),desired=pts['hand'+side].map((v,i)=>v+(q[i]-v)*e),arm=solveArm(pts['shoulder'+side],desired,pts['elbow'+side]);pts['hand'+side]=arm.hand;pts['elbow'+side]=arm.elbow;}return;}
      if(aim.kind==='knee'){
        const hip=pts['hip'+side],d=V.sub(goal,hip),length=Math.hypot(...d)||1,desired=hip.map((v,i)=>v+d[i]*Math.min(.49,length)/length),offset=V.sub(desired,pts[key]);
        const lower=V.unit(V.sub(pts['foot'+side],pts[key])),blend=pts[key].map((v,i)=>v+offset[i]*e),upper=V.unit(V.sub(blend,hip));pts[key]=hip.map((v,i)=>v+upper[i]*.49);pts['foot'+side]=pts[key].map((v,i)=>v+lower[i]*.49);return;
      }
      if(aim.kind==='elbow'){const sh=pts['shoulder'+side],d=V.sub(goal,sh),length=Math.hypot(...d)||1,desired=sh.map((v,i)=>v+d[i]*Math.min(.41,length)/length),offset=V.sub(desired,pts[key]);const lower=V.unit(V.sub(pts['hand'+side],pts[key])),blend=pts[key].map((v,i)=>v+offset[i]*e),upper=V.unit(V.sub(blend,sh));pts[key]=sh.map((v,i)=>v+upper[i]*.41);pts['hand'+side]=pts[key].map((v,i)=>v+lower[i]*.41);return;}
      // The aim is captured on input. It never follows a sidestepping opponent.
      const desired=pts[key].map((v,i)=>v+(goal[i]-v)*e);
      if(aim.kind==='foot'){const leg=solveLeg(pts['hip'+side],desired,pts['knee'+side]);pts[key]=leg.foot;pts['knee'+side]=leg.knee;}
      else{const arm=solveArm(pts['shoulder'+side],desired,pts['elbow'+side]);pts[key]=arm.hand;pts['elbow'+side]=arm.elbow;}
    }
    connectArms(f,rig,other) {
      const g=this.world.grapple,v=f.visual;if(!v||!g)return;
      // Pair partners are explicit; the selected combat target can change after an enemy grabs.
      const partner=g.owner===f?g.target:g.owner,otherRig=this.rigs[partner.id],pts=rig.pts;if(!otherRig)return;
      const spec=Wrestling.grips(v.pair,v.grip),previous=Wrestling.grips(v.pair?null:v.pair,g.gripFrom||v.grip),regrip=v.pair?MotionAPI.smooth(v.phase/.18):MotionAPI.smooth((this.world.time-(g.gripAt??-10))/.24),weight=v.pair?Wrestling.release(v.pair,v.phase):1;
      rig.gripGoals={};
      for(const side of ['L','R']){
        let goal=null;
        if(g.owner===f&&v.role==='holder'){
          if(v.pair==='elastic')continue;
          const strike=f.action?.move.heldStrike,limb=f.action?.move.limb||'R';
          if(strike&&(limb===side||limb==='both')&&f.action.t<f.action.move.cancel+.04)continue;
          const from=Wrestling.anchor(otherRig.pts,previous[side]),to=Wrestling.anchor(otherRig.pts,spec[side]);goal=to.map((value,i)=>from[i]+(value-from[i])*regrip);rig.gripGoals[side]=goal;
        }else if(g.target===f&&v.role==='held'&&!v.pair&&v.grip!=='rear'){
          goal=Wrestling.anchor(otherRig.pts,{height:.52,side:side==='L'?.33:-.33,front:.04});
        }
        if(goal&&!v.pair&&g.entryHands?.[f.id]){const blend=MotionAPI.smooth((this.world.time-(g.entryAt??-10))/.18),from=g.entryHands[f.id][side];goal=from.map((x,i)=>x+(goal[i]-x)*blend);if(g.owner===f)rig.gripGoals[side]=goal;}
        if(goal){const key='hand'+side,desired=pts[key].map((x,i)=>x+(goal[i]-x)*weight),arm=solveArm(pts['shoulder'+side],desired,pts['elbow'+side]);pts[key]=arm.hand;pts['elbow'+side]=arm.elbow;}
      }
    }
    stretchLimbs(f,rig,other){
      const a=f.action,m=a?.move||{startup:1,duration:1,range:1.8},tether=this.world.tether?.owner===f,active=m.elastic||tether;
      const heldKey=this.world.yard.held(f)?.id||(this.world.yard.retrieve?.owner===f?this.world.yard.retrieve.prop.id:'');
      const state=(a?a.id+':'+a.chain:'idle')+':'+!!tether+':'+heldKey+':'+(f.mobility?.anchor?.id||'');
      let memory=this.elasticMemory[f.id];
      if(!memory)memory=this.elasticMemory[f.id]={state,last:{},from:null,at:this.world.time};
      if(memory.state!==state){memory.from=memory.last;memory.state=state;memory.at=this.world.time;}
      const target=this.rigs[other.id];
      const phase=a?C(a.t/m.startup,0,1):1;
      let e=a?(a.t<=m.startup?phase*phase*(3-2*phase):1-Math.pow(C((a.t-m.startup)/(m.duration-m.startup),0,1),.8)):1;
      if(tether||m.throwType==='elastic')e=1;
      if(m.throwType==='elastic'&&(f.visual?.phase??0)>.79)e=1-C(((f.visual?.phase??0)-.79)/.16,0,1);
      const legs=!!m.limb?.startsWith('leg'),sides=m.pull||m.throwType==='elastic'||m.limb==='both'?['L','R']:[m.limb==='L'||m.limb==='legL'?'L':'R'];
      for(const side of active?sides:[]){
        const joint=legs?'hip'+side:'shoulder'+side,end=legs?'foot'+side:'hand'+side,base=rig.pts[joint],ordinary=rig.pts[end];
        let goal=m.throwType==='elastic'?target.trans([side==='L'?-.23:.23,1.04,.05]):m.pull?target.trans([side==='L'?.20:-.20,1.72,.1]):target.trans([m.limb==='both'?(side==='L'?-.17:.17):0,m.ground?1.32:m.zone==='leg'?.65:m.zone==='body'?1.26:m.launch?1.92:1.55,.15]);
        if(m.ground&&this.ragdolls[other.id]?.nodes?.torso)goal=this.ragdolls[other.id].nodes.torso.p.slice();
        if(a.contactAim&&!tether&&!m.throwType)goal=a.contactAim.point.map((v,i)=>v+(m.limb==='both'?(i===0?(side==='L'?-.13:.13):0):0));
        const dx=goal[0]-f.x,dz=goal[2]-f.z,d=Math.hypot(dx,dz),range=m.range;
        if(d>range){goal=[f.x+dx*range/d,goal[1],f.z+dz*range/d];}
        const hand=ordinary.map((value,i)=>value+(goal[i]-value)*e),span=Math.hypot(...V.sub(hand,base)),bow=(legs?.50:.18)*e*Math.sin(C(a.t/m.duration,0,1)*Math.PI);
        const p1=base.map((value,i)=>value+(hand[i]-value)*.25+(i===1?bow:i===0?.08*e:0));
        const p2=base.map((value,i)=>value+(hand[i]-value)*.73+(i===1?bow:0));
        const lateral=[Math.cos(f.angle),0,-Math.sin(f.angle)],sign=side==='L'?-1:1,beat=C(a.t/m.duration,0,1);
        if(m.curve==='hook'||m.curve==='round'||m.curve==='sweep'){
          const arc=(m.curve==='hook'?.75:m.curve==='round'?.95:.65)*e;
          for(let i=0;i<3;i++){p1[i]+=lateral[i]*sign*arc;p2[i]+=lateral[i]*sign*arc*.65;}
          if(m.curve==='sweep'){p1[1]=base[1]+(hand[1]-base[1])*.45-.25*e;p2[1]=Math.max(.13,hand[1]-.15*e);}
        }
        if(m.curve==='coil'){
          const wave=Math.sin(beat*Math.PI*3)*.30*e;
          for(let i=0;i<3;i++){p1[i]+=lateral[i]*sign*(.35*e+wave);p2[i]-=lateral[i]*sign*(.25*e+wave);}
          p1[1]+=.2*e;p2[1]-=.12*e;
        }
        if(m.curve==='knee'){p1[1]+=.4*e;p2[1]+=.25*e;}
        if(m.curve==='axe'){p1[1]+=.85*e;p2[1]+=1.15*e;}
        if(m.pose==='elasticUpper'){p1[1]-=.32*e;p2[1]-=.18*e;}
        const curve=[base,p1,p2,hand],radius=(legs?.10:.083)/Math.sqrt(Math.max(1,span/(legs?.9:.8)));
        rig.elastic[legs?'leg'+side:side]={curve,radius:Math.max(legs?.062:.047,radius),bulge:m.pose==='elasticSlam'?1+e*.5:1};
        if(m.curve==='knee'&&legs){const knee=hand,foot=knee.map((v,i)=>v+(i===1?-.32:i===0?-Math.sin(f.angle)*.28:-Math.cos(f.angle)*.28)),fold=[knee,knee.map((v,i)=>v+(i===1?-.13:0)),foot.map((v,i)=>v+(i===1?.08:0)),foot];rig.elastic['leg'+side].fold=fold;rig.pts['knee'+side]=knee;rig.pts[end]=foot;}else{rig.pts[end]=hand;rig.pts[legs?'knee'+side:'elbow'+side]=bezier(curve,.46);}
      }
      if(memory.from){
        const t=C((this.world.time-memory.at)/.10,0,1),blend=t*t*(3-2*t);
        for(const [key,old] of Object.entries(memory.from)){
          const legs=key.startsWith('leg'),side=legs?key.slice(3):key,base=rig.pts[legs?'hip'+side:'shoulder'+side],goal=rig.pts[legs?'foot'+side:'hand'+side];
          const desired=rig.elastic[key]||{curve:[base,base.map((v,i)=>v+(goal[i]-v)*.25),base.map((v,i)=>v+(goal[i]-v)*.73),goal],radius:legs?.09:.075,bulge:1};
          if(blend<1){
            const curve=old.curve.map((p,j)=>p.map((v,i)=>v+(desired.curve[j][i]-v)*blend));
            const attachment=V.sub(base,curve[0]);curve[0]=base;curve[1]=curve[1].map((v,i)=>v+attachment[i]);
            rig.elastic[key]={curve,radius:old.radius+(desired.radius-old.radius)*blend,bulge:old.bulge+(desired.bulge-old.bulge)*blend};
            if(old.fold){const end=desired.fold?.[3]||desired.curve[3];rig.elastic[key].fold=old.fold.map((p,j)=>p.map((v,i)=>v+((desired.fold?.[j]||end)[i]-v)*blend));rig.elastic[key].fold[0]=curve[3];}
            rig.pts[legs?'foot'+side:'hand'+side]=rig.elastic[key].fold?rig.elastic[key].fold[3]:curve[3];rig.pts[legs?'knee'+side:'elbow'+side]=rig.elastic[key].fold?curve[3]:bezier(curve,.46);
          }
        }
        if(t>=1)memory.from=null;
      }
      const mobility=f.mobility,anchor=mobility?.anchor,retract=mobility?.retract;
      if((anchor||retract)&&!f.action&&!f.held&&!f.balloon){
        const point=(anchor||retract).point,age=this.world.time-(anchor||retract).at,e=anchor?MotionAPI.smooth(age/.12):1-MotionAPI.smooth(age/.20),base=rig.pts.shoulderR,ordinary=rig.pts.handR,end=ordinary.map((v,i)=>v+(point[i]-v)*e),span=Math.hypot(...V.sub(end,base)),bow=Math.min(.42,span*.06)*(1-e*.5);
        const curve=[base,base.map((v,i)=>v+(end[i]-v)*.28+(i===1?-bow:0)),base.map((v,i)=>v+(end[i]-v)*.75+(i===1?-bow*.5:0)),end];
        rig.elastic.R={curve,radius:Math.max(.035,.085/Math.sqrt(Math.max(1,span/.8))),bulge:1};rig.pts.handR=end;rig.pts.elbowR=bezier(curve,.46);
      }
      memory.last=rig.elastic;
    }
    objectArms(f,rig){
      const a=f.action;if(!a)return;
      const m=a.move,p=m.propFetch?this.world.yard.props.find(p=>p.id===a.propId):this.world.yard.held(f);
      if(m.propPickup&&!a.hit){const object=this.world.yard.props.find(p=>p.id===a.propId);if(object){const arm=solveArm(rig.pts.shoulderR,[object.x,object.y+.06,object.z],rig.pts.elbowR);rig.pts.handR=arm.hand;rig.pts.elbowR=arm.elbow;}return;}
      if(!p||(!m.elasticProp)||m.propFetch&&p.heldBy)return;
      const rot=root.CombatYard.rotation(p),goal=m.elasticProp&&a.contactAim?a.contactAim.point.slice():[p.x,p.y,p.z].map((v,i)=>v-rot[i]*(p.hx+.04)-rot[3+i]*.04),base=rig.pts.shoulderR;
      const e=m.propFetch&&!this.world.yard.retrieve?C(a.t/m.startup,0,1):m.elasticProp?MotionAPI.envelope(a.t,m.startup,m.duration):1,hand=rig.pts.handR.map((v,i)=>v+(goal[i]-v)*e);
      const curve=[base,base.map((v,i)=>v+(hand[i]-v)*.28+(i===1?.20:0)),base.map((v,i)=>v+(hand[i]-v)*.75+(i===1?.13:0)),hand];
      if(m.propFetch){const bend=this.world.yard.retrieve?.bend||this.world.yard.bendAround(f,p),weight=C((Math.hypot(...V.sub(hand,base))-.85)/1.6,0,1);for(const index of [1,2]){curve[index][0]+=bend[0]*weight*1.15;curve[index][2]+=bend[1]*weight*1.15;}}
      rig.elastic.R={curve,radius:Math.max(.047,.08/Math.sqrt(Math.max(1,Math.hypot(...V.sub(hand,base))/.8))),bulge:1};rig.pts.handR=hand;rig.pts.elbowR=bezier(curve,.46);
    }
    weaponGrip(f,rig){
      const p=this.world.yard.held(f),m=f.action?.move;if(p?.type!=='staff'||f.held||f.down>0||m&&(m.elasticProp||!m.weapon))return;
      const frame=root.CombatContact?.weaponFrame(f,rig,p),rot=frame?.rot||root.CombatYard.rotation(p),axis=[rot[6],rot[7],rot[8]],center=frame?.center||rig.pts.handR.map((v,i)=>v+rot[i]*(p.hx+.04)+rot[3+i]*.04),shoulder=rig.pts.shoulderL;
      const along=C(V.dot(V.sub(shoulder,center),axis),-.70,-.15),goal=center.map((v,i)=>v+axis[i]*along),arm=solveArm(shoulder,goal,rig.pts.elbowL);rig.pts.handL=arm.hand;rig.pts.elbowL=arm.elbow;
    }
  }
  root.CombatRig={Humanoid,Skin,V,C,mul,model,rigBasis,jointBasis,oriented,solveArm,solveLeg,between,bezier};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatRig;
})(typeof window!=='undefined'?window:globalThis);
