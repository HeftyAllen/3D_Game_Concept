/* Read-only elemental presentation, attached to the authoritative contact rig. */
(function(root){
  'use strict';
  const COLORS={fire:[1,.43,.055],water:[.24,.75,.94],earth:[.62,.52,.36],lightning:[.58,.82,1],plasma:[.94,.48,1],lava:[1,.28,.045],mud:[.43,.34,.21],chargedwater:[.49,.87,1],steam:[.84,.94,.93],wind:[.68,.91,.96]};
  const C=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),frac=x=>x-Math.floor(x),TAU=Math.PI*2;
  function sprite(r,kind,p,size,color,alpha=1,seed=0,angle=0,ground=false,phase=0){r.elementParticles?.add(kind,p,size,color,alpha,seed,angle,ground,phase);}
  function ring(r,p,size,color,alpha=.7,phase=.4){sprite(r,'ripple',p,[size*2.3,size*2.3],color,alpha,17,0,true,phase);}
  function arc(r,a,b,color,seed=0){let prev=a;for(let i=1;i<=4;i++){const t=i/4,p=mix(a,b,t);if(i<4){p[0]+=Math.sin(seed+i*2.1)*.06;p[1]+=Math.cos(seed+i*1.9)*.07;p[2]+=Math.sin(seed+i)*.05;}r.bone(prev,p,.012,color,'cylinder');prev=p;}sprite(r,'glow',a,[.25,.25],color,.5,seed);}
  function flame(r,p,width,height,time,seed=0,alpha=1,smoke=false){const lean=r.detail==='lean',count=lean?3:6;
    sprite(r,'glow',[p[0],p[1]+height*.18,p[2]],[width*4,height*1.3],COLORS.fire,alpha*.28,seed);
    for(let n=0;n<count;n++){const age=frac(time*1.8+n/count+seed*.137),a=n*2.4+seed,fade=Math.sin(age*Math.PI),point=[p[0]+Math.cos(a+time)*width*.40*(.4+age),p[1]+age*height*.65,p[2]+Math.sin(a+time)*width*.40*(.4+age)];sprite(r,'flame',point,[width*(1.15-age*.5),height*(.8+age*.3)],COLORS.fire,alpha*fade*.78,seed+n*7,.09*Math.sin(time*3+n));}
    for(let i=0;i<(lean?2:4);i++){const age=frac(time*.95+i*.271+seed*.09),a=i*2.4+seed;sprite(r,'ember',[p[0]+Math.cos(a)*width*(.2+age),p[1]+height*(.25+age*1.6),p[2]+Math.sin(a)*width*age],[.024*(1-age)+.008,.045*(1-age)+.01],[1,.67,.20],alpha*(1-age),seed+i);}
    if(smoke)for(let i=0;i<(lean?1:2);i++){const age=frac(time*.55+i*.5+seed*.03);sprite(r,'smoke',[p[0]+Math.sin(seed+age*3)*width,p[1]+height*(.8+age),p[2]+Math.cos(seed+age*3)*width],[width*(1+age*1.9),height*(.5+age*.8)],[.24,.25,.24],alpha*Math.sin(age*Math.PI)*.22,seed+i,time*.12);}
  }
  function droplet(r,p,size,alpha,seed,angle=0){sprite(r,'drop',p,[size,size*1.65],COLORS.water,alpha,seed,angle);}
  function rock(r,p,size,seed=0,alpha=1){const c=seed%3*.035;r.shape('rock',p,[size*.86,size*(.90+(seed%3)*.22),size*.75],[.55+c,.46+c,.33+c],seed,alpha,.04);}
  function stream(r,from,to,width,alpha,time,seed=0){r.curve([from,mix(from,to,.33),mix(from,to,.67),to],width,COLORS.water,alpha*.56,.65);r.curve([from,mix(from,to,.33),mix(from,to,.67),to],width*.30,[.72,.96,1],alpha*.6,.9);const count=r.detail==='lean'?4:8;
    for(let i=0;i<count;i++){const t=frac(time*2.5+i/count),p=mix(from,to,t),a=i*2.4+time*2;p[0]+=Math.cos(a)*width*1.5;p[2]+=Math.sin(a)*width*1.5;droplet(r,p,width*(.5+t*.3),alpha*.75,seed+i);}
  }
  function draw(r,w){const E=w.elements,I=w.infusion,lean=r.detail==='lean',time=w.time;r.elementParticles?.begin();
    for(const f of w.fighters()){
      const rig=r.rigs[f.id];if(!rig)continue;const coat=I.active(f),action=f.action,cast=action?.move.elementFamily?.toLowerCase(),tag=action?.move.elementTag,element=tag||(action&&!action.hit&&COLORS[cast]?cast:null)||(f.id==='player'&&w.power?.charge?w.power.charge.element:null)||coat?.element,color=COLORS[element],keys=['handL','handR','footL','footR'];
      if(element&&color){for(const [i,key]of keys.entries()){const p=rig.pts[key],strength=tag||coat?1:.6;
          if(element==='fire')flame(r,[p[0],p[1]-.07,p[2]],.19,.47,time,i+f.impactId*.01,strength);
          if(element==='earth')for(let n=0;n<3;n++){const a=n*TAU/3+i;rock(r,[p[0]+Math.cos(a)*.10,p[1]+.015,p[2]+Math.sin(a)*.10],.10,i*3+n);}
          if(element==='water'){r.shape('sphere',p,[.14,.15,.14],color,0,.17,.65);for(let n=0;n<(lean?2:4);n++){const a=time*5+i+n*TAU/4;droplet(r,[p[0]+Math.cos(a)*.15,p[1]+Math.sin(a*.7)*.09,p[2]+Math.sin(a)*.15],.045,.8,n+i);}}
          if(element==='lightning')arc(r,p,rig.pts[i<2?i?'elbowR':'elbowL':i===2?'kneeL':'kneeR'],color,time*13+i);
        }
        if(coat){const p=rig.pts.torso;
          if(coat.element==='fire'){for(let n=0;n<(lean?3:5);n++){const a=n*2.4+time*.55;flame(r,[p[0]+Math.cos(a)*.25,p[1]-.48+(n%3)*.20,p[2]+Math.sin(a)*.23],.21,.62,time,n+7,.62);}sprite(r,'glow',p,[1.2,1.65],color,.20);}
          if(coat.element==='lightning'){arc(r,rig.pts.shoulderL,rig.pts.shoulderR,color,time*11);arc(r,rig.pts.hipL,rig.pts.shoulderR,color,time*9+1);}
          if(coat.element==='earth')for(const [i,key]of ['shoulderL','shoulderR','torso'].entries()){const q=rig.pts[key];rock(r,[q[0],q[1],q[2]+.04],i===2?.26:.19,i);}
          if(coat.element==='water')for(let n=0;n<(lean?6:12);n++){const a=time*3+n*TAU/6,y=p[1]-.42+(n%6)*.15;droplet(r,[p[0]+Math.cos(a)*.34,y,p[2]+Math.sin(a)*.27],.045,.65,n);if(n%3===0)sprite(r,'foam',[p[0]+Math.cos(a)*.34,y,p[2]+Math.sin(a)*.27],[.09,.07],[.79,.97,1],.45,n);}
        }
      }
      if(I.status(f,'wet'))for(let i=0;i<(lean?2:5);i++){const p=rig.pts[i%2?'shoulderL':'shoulderR'],age=frac(time*1.1+i*.27);droplet(r,[p[0]+Math.sin(i*3)*.16,p[1]-age*.9,p[2]+.08],.027,.7,i);}
      if(I.status(f,'burn')){const p=rig.pts.torso;for(let i=0;i<(lean?2:3);i++){const a=time*.6+i*2.1;flame(r,[p[0]+Math.cos(a)*.22,p[1]-.34,p[2]+Math.sin(a)*.2],.16,.49,time,i+20,.7,true);}}
      if(I.status(f,'mud'))sprite(r,'pool',[f.x,.032,f.z],[1.05,1.05],COLORS.mud,.75,12,0,true);
      if(f.aquaBubble){const p=rig.pts.torso;r.shape('round',p,[.62,.86,.62],COLORS.water,0,.10,.7);for(let i=0;i<(lean?5:10);i++){const a=i*2.4+time*2,lat=Math.sin(i*1.7)*.65;droplet(r,[p[0]+Math.cos(a)*.60*Math.cos(lat),p[1]+Math.sin(lat)*.86,p[2]+Math.sin(a)*.60*Math.cos(lat)],.045,.85,i);}sprite(r,'glow',p,[1.1,1.6],COLORS.water,.13);}
    }
    for(const b of E.bolts){const color=COLORS[b.kind]||COLORS.fire,tail=b.pos.map((v,i)=>v-b.velocity[i]*(b.kind==='water'?.10:.055));
      if(b.kind==='earth'){rock(r,b.pos,b.radius*1.5,time*3+b.seed);for(let i=0;i<(lean?2:4);i++){const p=mix(b.pos,tail,i/4);sprite(r,'dust',p,[.24+i*.06,.24+i*.06],COLORS.earth,.22*(1-i/4),b.seed+i);}}
      else if(b.kind==='water'){stream(r,tail,b.pos,b.radius*.65,.9,time,b.seed);droplet(r,b.pos,b.radius*2.4,.95,b.seed);sprite(r,'foam',b.pos,[b.radius*1.3,b.radius*1.3],[.8,.98,1],.65,b.seed);}
      else if(b.kind==='plasma'){sprite(r,'glow',b.pos,[.8,.8],color,.65,b.seed);r.bone(tail,b.pos,.035,[.9,.88,1],'cylinder');arc(r,tail,b.pos,COLORS.lightning,time*10);}
      else {for(let i=0;i<(lean?3:6);i++){const p=mix(b.pos,tail,i/(lean?3:6));flame(r,[p[0],p[1]-.1,p[2]],.24*(1-i*.07),.46,time,b.seed+i,.9*(1-i*.1));}sprite(r,'glow',b.pos,[.7,.7],COLORS.fire,.6,b.seed);}
    }
    for(const prop of w.yard.props)if(prop.burning&&!prop.broken){for(let i=0;i<(lean?2:4);i++){const a=i*2.4;flame(r,[prop.x+Math.cos(a)*prop.hx*.55,prop.y+prop.hy*.50,prop.z+Math.sin(a)*prop.hz*.55],.24,.65+prop.hy*.25,time,i+prop.burning.until,.85,true);}}
    for(const flow of w.elementPhysics?.flows||[]){const a=C(flow.life/.35);for(let i=0;i<(lean?8:16);i++){const u=frac(time*1.8+i/(lean?8:16)),distance=u*flow.reach,side=Math.sin(i*2.4+time*3)*(.30+distance*.08),p=[flow.x+flow.dx*distance+flow.dz*side,flow.y+.075+Math.sin(u*Math.PI)*.035,flow.z+flow.dz*distance-flow.dx*side];sprite(r,'pool',p,[.95+distance*.10,.75],COLORS.water,a*.45,i,Math.atan2(flow.dx,flow.dz),true);sprite(r,'foam',p,[.17,.06],[.8,.97,1],a*.55,i);}for(const side of [-.23,.23]){const from=[flow.x+flow.dz*side,flow.y+.10,flow.z-flow.dx*side],to=[from[0]+flow.dx*flow.reach,flow.y+.10,from[2]+flow.dz*flow.reach];r.curve([from,mix(from,to,.3).map((v,i)=>v+(i===1?.03:0)),mix(from,to,.7),to],.04,COLORS.water,a*.30,.7);}}
    for(const c of E.channels||[]){const count=lean?12:24,alpha=C(c.life/.12);for(let i=0;i<count;i++){const u=frac(time*2.2+i/count),d=u*c.reach,width=.12+d*.12,a=i*2.4+time*3,point=[c.from[0]+c.dx*d+Math.cos(a)*width*.45,c.from[1]+Math.sin(a)*width*.35,c.from[2]+c.dz*d+Math.sin(a)*width*.45];sprite(r,'flame',point,[width*1.8,.45+u*.7],COLORS.fire,alpha*(1-u*.65)*.85,c.seed+i,.2*Math.sin(a));if(i%4===0)sprite(r,'ember',[point[0],point[1]+u*.2,point[2]],[.035,.075],[1,.75,.28],alpha*(1-u),i);}sprite(r,'glow',c.from,[.7,.7],COLORS.fire,alpha*.6);}
    for(const z of E.zones){const kind=z.kind||'fire',a=C(z.life/.45),p=[z.x,z.y+.028,z.z];
      if(['water','mud','chargedwater'].includes(kind)){sprite(r,'pool',p,[z.radius*2.3,z.radius*2.3],COLORS[kind]||COLORS.water,a*.85,z.at*7,0,true);if(kind!=='mud')ring(r,[z.x,z.y+.035,z.z],z.radius*(.65+frac(time*.5+z.at)*.45),[.60,.91,.97],a*.5,frac(time*.5+z.at));if(kind==='chargedwater')arc(r,[z.x-.3,z.y+.05,z.z],[z.x+.3,z.y+.05,z.z+Math.sin(time*7)*.3],COLORS.lightning,time*7);continue;}
      if(kind==='lava')sprite(r,'magma',p,[z.radius*2.3,z.radius*2.3],COLORS.lava,a,z.at,0,true);
      else sprite(r,'glow',p,[z.radius*2.8,z.radius*2.8],[1,.22,.025],a*.33,0,0,true);
      for(let i=0;i<(lean?2:4);i++){const angle=i*2.4+z.at;flame(r,[z.x+Math.cos(angle)*z.radius*.47,z.y+.075,z.z+Math.sin(angle)*z.radius*.47],kind==='lava'?.19:.22,kind==='lava'?.38:.65,time,i+z.at,a*.85,true);}
    }
    for(const p of E.effects){const t=1-p.life/p.max,a=C(p.life/.17),earth=['earth','spikes','quake','vault','tell','ridge','magnet'].includes(p.kind)||p.kind==='coat'&&p.element==='earth',water=['splash','spout','watertell','lash','riptide','undertow','thundertide','typhoon'].includes(p.kind)||p.kind==='coat'&&p.element==='water',steam=['steam','steamRelease'].includes(p.kind),color=COLORS[p.element]||COLORS[p.kind]||(earth?COLORS.earth:water?COLORS.water:steam?COLORS.steam:COLORS.fire),seed=p.seed||0;
      if(p.kind==='tell'||p.kind==='watertell'){ring(r,[p.x,.031,p.z],p.radius,color,a*.8,t);continue;}
      if(p.kind==='lash'&&p.from&&p.to){const from=p.from,to=p.to,side=Math.sin(t*Math.PI)*.8,curve=[from,mix(from,to,.3).map((v,i)=>v+(i===0?side:i===1?.5:0)),mix(from,to,.7).map((v,i)=>v+(i===0?side:i===1?.25:0)),to];r.curve(curve,.065,color,a*.56,.65);r.curve(curve,.018,[.75,.97,1],a*.75,.9);for(let i=0;i<(lean?5:10);i++){const u=i/10,q=from.map((v,k)=>v+(to[k]-v)*u+(k===1?Math.sin(u*Math.PI)*.35:0));droplet(r,q,.045,a*.75,seed+i);}continue;}
      if(p.kind==='spout'){for(let i=0;i<(lean?12:24);i++){const u=i/(lean?12:24),angle=time*9+u*TAU*2.5,size=.53-u*.25,point=[p.x+Math.cos(angle)*size,p.y+.12+u*1.9,p.z+Math.sin(angle)*size];droplet(r,point,.09-u*.025,a*.8,i);if(i%3===0)sprite(r,'foam',point,[.18,.20],[.8,.97,1],a*.55,i);}sprite(r,'pool',[p.x,.033,p.z],[1.4,1.4],COLORS.water,a*.7,seed,0,true);continue;}
      if(p.kind==='ridge'){const grow=Math.sin(Math.PI*C(t/.9)),height=.3+grow*.65;for(let i=0;i<3;i++){const side=(i-1)*.27;rock(r,[p.x+side*(p.dz||1),height*.35-.1,p.z-side*(p.dx||0)],.22+grow*.16,seed+i,a);}for(let i=0;i<(lean?3:6);i++){const angle=i*2.4+seed;sprite(r,'dust',[p.x+Math.cos(angle)*t*.55,.12+t*.35,p.z+Math.sin(angle)*t*.55],[.3+t*.5,.3+t*.4],COLORS.earth,a*.36,i);}continue;}
      const size=p.radius*(.22+t*.8);ring(r,[p.x,p.y+.033,p.z],p.kind==='undertow'?p.radius*(1-t*.8):size,color,a*(earth?.4:.5),t);
      if(earth){for(let i=0;i<(lean?6:12);i++){const angle=i*2.4+seed,dist=(.1+t*.7)*p.radius,y=Math.max(.04,Math.sin(t*Math.PI)*(.3+(i%3)*.32)),point=[p.x+Math.cos(angle)*dist,p.y+y,p.z+Math.sin(angle)*dist];rock(r,point,.10+(i%3)*.045,seed+i+time*.7,a);sprite(r,'dust',[point[0],p.y+.10+t*.45,point[2]],[.42+t*.6,.30+t*.5],COLORS.earth,a*.33,i);}}
      else if(water){for(let i=0;i<(lean?10:20);i++){const angle=i*2.399+seed,dist=p.kind==='undertow'?p.radius*(1-t*.85):(.1+t*.9)*p.radius,y=Math.max(.035,t*(1-t)*(1.3+(i%4)*.6)),point=[p.x+Math.cos(angle)*dist,p.y+y,p.z+Math.sin(angle)*dist];droplet(r,point,.045+(i%3)*.018,a*.9,i,Math.sin(angle)*.5);if(i%3===0)sprite(r,'foam',point,[.15+t*.14,.09+t*.08],[.8,.98,1],a*.65,i);}}
      else if(steam){for(let i=0;i<(lean?5:10);i++){const angle=i*2.4+seed;sprite(r,'smoke',[p.x+Math.cos(angle)*size*.5,p.y+.3+t*1.3+(i%3)*.2,p.z+Math.sin(angle)*size*.5],[.55+t*.8,.6+t*.8],COLORS.steam,a*.29,i,time*.1);}}
      else{for(let i=0;i<(lean?4:7);i++){const angle=i*2.4+seed;flame(r,[p.x+Math.cos(angle)*size*.6,p.y+.06+Math.sin(t*Math.PI)*.25,p.z+Math.sin(angle)*size*.6],.20+t*.13,.6+t*.35,time,seed+i,a*.8,true);}sprite(r,'glow',[p.x,p.y+.25,p.z],[size*2+.3,size*1.5+.3],color,a*.35,seed);}
    }
    for(const field of I.fields){const color=field.kind==='firestorm'?COLORS.fire:field.kind==='magnet'?COLORS.lightning:COLORS.water,a=C(field.life/.25),count=lean?12:24;for(let i=0;i<count;i++){const u=i/count,angle=time*7+u*TAU*3,height=u*1.8,size=field.radius*(.3+u*.45),p=[field.x+Math.cos(angle)*size,height,field.z+Math.sin(angle)*size];
        if(field.kind==='magnet'){if(i%4===0){rock(r,p,.11,i,a);sprite(r,'glow',p,[.4,.4],COLORS.lightning,a*.45,i);}if(i%6===0)arc(r,p,[field.x,.2,field.z],color,time*8+i);}
        else if(field.kind==='firestorm')sprite(r,'flame',p,[.30,.72],color,a*.66,i,Math.sin(angle)*.24);
        else{droplet(r,p,.10,a*.8,i);if(i%3===0)sprite(r,'foam',p,[.26,.20],[.8,.97,1],a*.6,i);}}
      ring(r,[field.x,.035,field.z],field.radius*.85,color,a*.5,frac(time));}
    for(const line of I.traces)arc(r,line.from,line.to,COLORS[line.color]||COLORS.lightning,line.seed+time*5);
  }
  root.CombatElementVisuals={draw,COLORS};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatElementVisuals;
})(typeof window!=='undefined'?window:globalThis);
