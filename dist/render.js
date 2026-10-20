(function (root) {
  'use strict';
  const {Scenery,PALETTES}=root.CombatScenery||(typeof require==='function'?require('./scenery.js'):null);
  const ElementVisuals=root.CombatElementVisuals||(typeof require==='function'?require('./element-visuals.js'):null);
  const CameraAPI=root.CombatCamera||(typeof require==='function'?require('./camera.js'):null);
  const Wrestling=root.CombatWrestling||(typeof require==='function'?require('./wrestling.js'):null);
  const RigAPI=root.CombatRig||(typeof require==='function'?require('./rig.js'):null);
  const MotionAPI=root.CombatMotion||(typeof require==='function'?require('./motion.js'):null);
  const Character=root.CombatCharacter||(typeof require==='function'?require('./character.js'):null);
  const C = root.CombatLab.clamp;
  const V=RigAPI.V;
  const {mul,model,rigBasis,oriented,solveArm,solveLeg,between,bezier,jointBasis}=RigAPI;
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
  }
  function lookAt(eye, at) {
    const z = V.unit(V.sub(eye, at)), x = V.unit(V.cross([0,1,0], z)), y = V.cross(z, x);
    return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1]);
  }
  function quaternionBasis(q){
    const [x,y,z,w]=q;return new Float32Array([1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,0,0,0,1]);
  }
  const geometryCache=new Map();
  function geometry(kind) {
    if(geometryCache.has(kind))return geometryCache.get(kind);
    const p = [], n = [];
    const tri = (a,b,c,na,nb=na,nc=na) => { p.push(...a,...b,...c); n.push(...na,...nb,...nc); };
    if (kind === 'cube') {
      const faces = [
        [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[0,0,1]],
        [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[0,0,-1]],
        [[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[1,0,0]],
        [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-1,0,0]],
        [[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5],[0,1,0]],
        [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[0,-1,0]]
      ];
      for (const [a,b,c,d,no] of faces) { tri(a,b,c,no); tri(a,c,d,no); }
    } else if(kind==='rock'){
      const N=14,R=9,at=(i,j)=>{const a=i/N*Math.PI*2,b=j/R*Math.PI,rough=.83+.10*Math.sin(a*3+b*5)+.07*Math.cos(a*5-b*3);return [Math.cos(a)*Math.sin(b)*rough,Math.cos(b)*(.87+.09*Math.cos(a*4)*Math.sin(b)),Math.sin(a)*Math.sin(b)*rough];};
      const face=(a,b,c)=>{let normal=V.unit(V.cross(V.sub(b,a),V.sub(c,a)));if(V.dot(normal,a)<0)normal=normal.map(v=>-v);tri(a,b,c,normal);};
      for(let i=0;i<N;i++)for(let j=0;j<R;j++){const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1);if(j>0)face(a,b,c);if(j<R-1)face(a,c,d);}
    } else if (kind === 'sphere'||kind==='round'||kind==='balloonShirt'||kind==='balloonPants'||kind==='head'||kind==='glove'||kind==='shoe') {
      const detailed=kind!=='sphere',N=kind==='head'?56:kind==='glove'||kind==='shoe'?40:detailed?40:14,R=kind==='head'?40:kind==='glove'||kind==='shoe'?28:detailed?28:9,start=kind==='balloonPants'?17:0,end=kind==='balloonShirt'?17:R;
      const at = (i,j) => {const a=i/N*Math.PI*2,b=j/R*Math.PI,q=[Math.cos(a)*Math.sin(b),Math.cos(b),Math.sin(a)*Math.sin(b)];
        if(kind==='head'){q[0]*=.75+.25*C((q[1]+.55)/.9,0,1);q[2]*=q[2]>0?1-.13*Math.max(0,-q[1]):.97;const brow=Math.exp(-Math.pow((q[1]-.18)/.18,2));if(q[2]>.35)q[2]+=.08*brow;}
        if(kind==='glove'){q[0]*=.77+.23*C(q[1]+.7,0,1);q[2]*=q[2]>0?.86:1;}
        if(kind==='shoe'){q[1]=Math.max(-.63,q[1]);q[0]*=.87+.13*C(q[2]+.4,0,1);q[2]=q[2]*(q[2]>0?1.10:.79)+.12;}
        return q;};
      const custom=['head','glove','shoe'].includes(kind),normal=(i,j)=>{if(!custom)return at(i,j);const a=V.sub(at(i+.001,j),at(i-.001,j)),b=V.sub(at(i,j+.001),at(i,j-.001)),n=V.cross(a,b);return Math.hypot(...n)>1e-9?V.unit(n):V.unit(at(i,j));};
      for(let i=0;i<N;i++) for(let j=start;j<end;j++) {
        const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1),na=normal(i,j),nb=normal(i+1,j),nc=normal(i+1,j+1),nd=normal(i,j+1);tri(a,b,c,na,nb,nc);tri(a,c,d,na,nc,nd);
      }
    } else if(kind.startsWith('skin')){
      const lean=kind.endsWith('Lean'),leg=kind.includes('Leg'),sleeve=kind.includes('Sleeve'),N=lean?14:36,R=lean?20:48,start=sleeve?0:kind.includes('Arm')?.34:0,end=sleeve?.34:1;
      const profile=t=>{if(leg)return [.70+.30*Math.exp(-Math.pow((t-.2)/.22,2))-.25*t,.76+.23*Math.exp(-Math.pow((t-.70)/.14,2))-.30*t];return [.74+.25*Math.exp(-Math.pow((t-.22)/.18,2))-.25*t,.73+.21*Math.exp(-Math.pow((t-.66)/.19,2))-.24*t];};
      const at=(i,j)=>{const t=start+(end-start)*j/R,a=i/N*Math.PI*2,[x,z]=profile(t);return [Math.cos(a)*x,t,Math.sin(a)*z];};
      const normal=(i,j)=>{const d=V.sub(at(i+.01,j),at(i-.01,j)),e=V.sub(at(i,j+.01),at(i,j-.01));return V.unit(V.cross(e,d));};
      for(let i=0;i<N;i++)for(let j=0;j<R;j++){const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1);tri(a,b,c,normal(i,j),normal(i+1,j),normal(i+1,j+1));tri(a,c,d,normal(i,j),normal(i+1,j+1),normal(i,j+1));}
    } else if(['body','limb','tube','upperarm','forearm','thigh','calf'].includes(kind)){
      const N=kind==='body'?64:kind==='tube'?32:48,R=kind==='body'?40:kind==='tube'?32:28;
      const profile=t=>{
        if(kind==='tube')return [1,1];
        if(kind==='limb'){const r=.63+.37*Math.pow(Math.sin(Math.PI*t),.65);return [r,r];}
        if(kind==='upperarm'){const r=.69+.31*Math.exp(-Math.pow((t-.36)/.38,2))-.12*t;return [r,r*.91];}
        if(kind==='forearm'){const r=.61+.36*Math.exp(-Math.pow((t-.25)/.35,2))-.18*t;return [r,r*.83];}
        if(kind==='thigh'){const r=.70+.39*Math.exp(-Math.pow((t-.32)/.43,2))-.16*t;return [r,r*.9];}
        if(kind==='calf'){const r=.60+.43*Math.exp(-Math.pow((t-.37)/.29,2))-.17*t;return [r*.87,r];}
        const width=.225+.12*Math.exp(-Math.pow((t-.73)/.19,2))-.125*Math.pow(t,9)-.025*Math.exp(-Math.pow((t-.25)/.17,2)),depth=.145+.062*Math.exp(-Math.pow((t-.66)/.29,2));
        return [width,depth];
      };
      const vertex=(i,j)=>{const t=j/R,a=i/N*Math.PI*2,[rx,rz]=profile(t);return [Math.cos(a)*rx,t,Math.sin(a)*rz];};
      const normal=(i,j)=>{const t=j/R,a=i/N*Math.PI*2,[rx,rz]=profile(t),before=profile(C(t-.002,0,1)),after=profile(C(t+.002,0,1)),drx=(after[0]-before[0])/.004,drz=(after[1]-before[1])/.004;return V.unit([Math.cos(a)/rx,-drx*Math.cos(a)**2/rx-drz*Math.sin(a)**2/rz,Math.sin(a)/rz]);};
      for(let i=0;i<N;i++)for(let j=0;j<R;j++){
        const a=vertex(i,j),b=vertex(i+1,j),c=vertex(i+1,j+1),d=vertex(i,j+1),na=normal(i,j),nb=normal(i+1,j),nc=normal(i+1,j+1),nd=normal(i,j+1);
        tri(a,b,c,na,nb,nc);tri(a,c,d,na,nc,nd);
      }
      if(kind!=='tube')for(let i=0;i<N;i++){tri([0,0,0],vertex(i+1,0),vertex(i,0),[0,-1,0]);tri([0,1,0],vertex(i, R),vertex(i+1,R),[0,1,0]);}
    } else if (kind === 'cylinder') {
      const N=28;
      for(let i=0;i<N;i++) {
        const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2,na=[Math.cos(a),0,Math.sin(a)],nb=[Math.cos(b),0,Math.sin(b)];
        const q=[na[0],0,na[2]],r=[nb[0],0,nb[2]],s=[nb[0],1,nb[2]],t=[na[0],1,na[2]];
        tri(q,r,s,na,nb,nb);tri(q,s,t,na,nb,na);tri([0,1,0],t,s,[0,1,0]);tri([0,0,0],r,q,[0,-1,0]);
      }
    } else if(kind==='cone'){
      const N=24;for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2,q=[Math.cos(a),0,Math.sin(a)],r=[Math.cos(b),0,Math.sin(b)],tip=[0,1,0];tri(q,r,tip,V.unit([q[0],1,q[2]]),V.unit([r[0],1,r[2]]),V.unit([Math.cos((a+b)/2),1,Math.sin((a+b)/2)]));tri([0,0,0],r,q,[0,-1,0]);}
    } else if(kind==='torus'){
      const N=28,R=12,at=(i,j)=>{const a=i/N*Math.PI*2,b=j/R*Math.PI*2,r=.75+.25*Math.cos(b);return {p:[Math.cos(a)*r,Math.sin(b),Math.sin(a)*r],n:V.unit([Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)])};};
      for(let i=0;i<N;i++)for(let j=0;j<R;j++){const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1);tri(a.p,b.p,c.p,a.n,b.n,c.n);tri(a.p,c.p,d.p,a.n,c.n,d.n);}
    } else if (kind === 'ring'||kind==='windRing') {
      const N=72,inner=kind==='windRing'?.96:.996,outer=kind==='windRing'?1.04:1.004;
      for(let i=0;i<N;i++) {
        const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2;
        const q=[Math.cos(a)*inner,0,Math.sin(a)*inner],r=[Math.cos(b)*inner,0,Math.sin(b)*inner],s=[Math.cos(b)*outer,0,Math.sin(b)*outer],t=[Math.cos(a)*outer,0,Math.sin(a)*outer];
        tri(q,r,s,[0,1,0]);tri(q,s,t,[0,1,0]);
      }
    }
    const result={p:new Float32Array(p),n:new Float32Array(n)};geometryCache.set(kind,result);return result;
  }
  const COLORS = {
    floor:[.105,.20,.163], mat:[.18,.29,.232], grid:[.24,.35,.276], dark:[.075,.125,.105],
    yellow:[.88,.96,.39], cream:[.91,.91,.76], teal:[.30,.69,.61], red:[.96,.40,.31]
  };
  class Renderer {
    constructor(canvas, overlay, world) {
      this.canvas=canvas; this.overlay=overlay; this.world=world; this.ctx=overlay.getContext('2d');
      this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'low-power'});
      if(!this.gl) throw new Error('WebGL is unavailable');
      this.yaw=.43; this.zoom=8.15;this.cameraTilt=0; this.focusScale=1; this.at=[0,.75,0]; this.eye=[0,0,0];this.detail='full';this.scenery=new Scenery(this);
      this.impact=true;this.floaters=[];this.ripples=[];this.poseMemory={};this.footMemory={};this.elasticMemory={};this.trails=Object.fromEntries(this.world.fighters().map(f=>[f.id,[]]));this.draws=0;
      this.fx=new (root.CombatEffects||(typeof require==='function'?require('./fx.js'):null)).CombatFX(this);
      this.elementParticles=new (root.CombatElementParticles||(typeof require==='function'?require('./element-particles.js'):null)).ElementParticles(this);
      this.motion=new MotionAPI.Motion(world);this.camera=new CameraAPI.ActionCamera();
      this.ragdolls=Object.fromEntries(this.world.fighters().map(f=>[f.id,new root.CombatPhysics.Ragdoll()]));
      const gl=this.gl;
      const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uModel;uniform mat4 uVP;uniform mat3 uNormal;uniform float uSkin;uniform vec2 uBend;uniform float uTwist;uniform float uRadius;uniform vec3 uCurve0;uniform vec3 uCurve1;uniform vec3 uCurve2;uniform vec3 uCurve3;varying vec3 vNormal;varying vec3 vWorld;mat3 frame(vec3 right,vec3 axis){vec3 y=normalize(axis);vec3 ref=right-y*dot(right,y);if(length(ref)<.0001){vec3 fallback=abs(y.y)<.9?vec3(0,1,0):vec3(1,0,0);ref=fallback-y*dot(fallback,y);}vec3 x=normalize(ref);return mat3(x,y,cross(x,y));}void main(){vec3 p=aPosition;vec3 n=aNormal;vec4 world;if(uSkin>2.5){vec3 d0=uCurve1-uCurve0;vec3 d1=uCurve2-uCurve1;mat3 b0=frame(uCurve3,d0);mat3 b1=frame(uCurve3,d1);float w=smoothstep(.32,.68,p.y);float volume=min(1.38,inversesqrt(max(.35,1.0-(1.0-dot(normalize(d0),normalize(d1)))*2.0*w*(1.0-w))));vec3 radial=vec3(p.x*uRadius*volume,0,p.z*uRadius*volume);vec3 p0=uCurve0+b0*(radial+vec3(0,p.y*2.0*length(d0),0));vec3 p1=uCurve1+b1*(radial+vec3(0,(p.y-.5)*2.0*length(d1),0));vec3 weighted=mix(p0,p1,w);vec3 y0=normalize(d0);vec3 y1=normalize(d1);mat3 skinFrame=frame(uCurve3,normalize(mix(y0,y1,w)));float jointVolume=1.0+.10*(1.0-dot(y0,y1))*w*(1.0-w);vec3 surface=skinFrame*vec3(p.x*uRadius*jointVolume,0,p.z*uRadius*jointVolume);weighted+=surface-mix(b0*radial,b1*radial,w);world=vec4(weighted,1.0);vec3 skinNormal=normalize(vec3(n.x,n.y*uRadius/(2.0*mix(length(d0),length(d1),w)),n.z));vNormal=normalize(skinFrame*skinNormal);}else if(uSkin>1.5){float t=p.y;float s=1.0-t;vec3 center=s*s*s*uCurve0+3.0*s*s*t*uCurve1+3.0*s*t*t*uCurve2+t*t*t*uCurve3;vec3 tangent=normalize(3.0*s*s*(uCurve1-uCurve0)+6.0*s*t*(uCurve2-uCurve1)+3.0*t*t*(uCurve3-uCurve2));vec3 side=normalize(cross(abs(tangent.y)>.98?vec3(1,0,0):vec3(0,1,0),tangent));vec3 up=cross(tangent,side);float radius=uRadius*(1.0-.22*t);world=vec4(center+(side*p.x+up*p.z)*radius,1.0);vNormal=normalize(side*n.x+up*n.z);}else{if(uSkin>.5){float t=clamp(p.y,0.0,1.0);float a=uTwist*t;float c=cos(a);float s=sin(a);p.xz=mat2(c,-s,s,c)*p.xz;n.xz=mat2(c,-s,s,c)*n.xz;float q=1.0-t;vec3 center=q*q*q*uCurve0+3.0*q*q*t*uCurve1+3.0*q*t*t*uCurve2+t*t*t*uCurve3;vec3 tangent=normalize(3.0*q*q*(uCurve1-uCurve0)+6.0*q*t*(uCurve2-uCurve1)+3.0*t*t*(uCurve3-uCurve2));vec3 bx=normalize(vec3(1.0,0.0,0.0)-tangent*tangent.x);vec3 bz=cross(bx,tangent);p=center+bx*p.x+bz*p.z;n=normalize(bx*n.x+tangent*n.y+bz*n.z);}world=uModel*vec4(p,1.0);vNormal=normalize(uNormal*n);}vWorld=world.xyz;gl_Position=uVP*world;}`;
      const fragment=`precision mediump float;uniform vec4 uColor;uniform float uGlow;uniform vec3 uEye;uniform vec3 uFog;uniform vec3 uAmbient;uniform vec4 uFire0;uniform vec4 uFire1;uniform vec4 uFire2;varying vec3 vNormal;varying vec3 vWorld;float heat(vec4 light){vec3 delta=light.xyz-vWorld;return light.w/(1.+dot(delta,delta)*1.8);}void main(){vec3 N=normalize(vNormal);float d=max(0.0,dot(N,normalize(vec3(-.4,.85,.55))));vec3 lit=uColor.rgb*(uAmbient+vec3(.50,.48,.41)*d);float rim=pow(1.0-max(0.0,dot(N,normalize(uEye-vWorld))),3.0);lit+=uColor.rgb*rim*.12;float warm=min(.70,heat(uFire0)+heat(uFire1)+heat(uFire2));lit+=uColor.rgb*vec3(1.,.34,.055)*warm;lit=mix(lit,uColor.rgb,uGlow);float fog=smoothstep(15.0,38.0,distance(vWorld,uEye));gl_FragColor=vec4(mix(lit,uFog,fog*.68),uColor.a);}`;
      const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
      this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
      gl.useProgram(this.program);
      this.u={};for(const k of ['uModel','uVP','uNormal','uColor','uGlow','uEye','uFog','uAmbient','uFire0','uFire1','uFire2','uSkin','uBend','uTwist','uRadius','uCurve0','uCurve1','uCurve2','uCurve3'])this.u[k]=gl.getUniformLocation(this.program,k);
      this.aP=gl.getAttribLocation(this.program,'aPosition');this.aN=gl.getAttribLocation(this.program,'aNormal');
      this.meshes={};
      for(const kind of ['cube','rock','sphere','round','head','glove','shoe','balloonShirt','balloonPants','cylinder','ring','windRing','body','limb','upperarm','forearm','thigh','calf','skinSleeve','skinArm','skinLeg','skinSleeveLean','skinArmLean','skinLegLean','tube','cone','torus']) {
        const geo=geometry(kind),pb=gl.createBuffer(),nb=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,geo.p,gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,geo.n,gl.STATIC_DRAW);
        this.meshes[kind]={p:pb,n:nb,count:geo.p.length/3};
      }
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      this.resize();
    }
    resize() {
      const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(root.devicePixelRatio||1,this.detail==='lean'?1.2:1.8);
      this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);
      this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);
      this.overlay.width=this.canvas.width;this.overlay.height=this.canvas.height;this.dpr=dpr;
    }
    setDetail(value){this.detail=value==='lean'?'lean':'full';this.resize();}
    aimAt(clientX,clientY){const b=this.canvas.getBoundingClientRect(),x=(clientX-b.left)/b.width*2-1,y=1-(clientY-b.top)/b.height*2,forward=V.unit(V.sub(this.at,this.eye)),right=V.unit(V.cross(forward,[0,1,0])),up=V.cross(right,forward),t=Math.tan((this.cameraFrame?.fov||.65)*.5),dir=V.unit(forward.map((v,i)=>v+right[i]*x*t*b.width/b.height+up[i]*y*t));if(dir[1]>=-.001)return null;const distance=-this.eye[1]/dir[1];if(distance<0||distance>80)return null;return [this.eye[0]+dir[0]*distance,0,this.eye[2]+dir[2]*distance];}

    draw(kind,m,color,alpha=1,glow=0,deform=null) {
      if(this.detail==='lean'&&kind.startsWith('skin'))kind+='Lean';
      if(this.detail==='lean'&&this.drawingActor){if(['round','head','glove','shoe'].includes(kind))kind='sphere';if(['limb','upperarm','forearm','thigh','calf'].includes(kind))kind='cylinder';}
      const gl=this.gl,mesh=this.meshes[kind];this.draws++;
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.p);gl.enableVertexAttribArray(this.aP);gl.vertexAttribPointer(this.aP,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.n);gl.enableVertexAttribArray(this.aN);gl.vertexAttribPointer(this.aN,3,gl.FLOAT,false,0,0);
      const sx=m[0]*m[0]+m[1]*m[1]+m[2]*m[2],sy=m[4]*m[4]+m[5]*m[5]+m[6]*m[6],sz=m[8]*m[8]+m[9]*m[9]+m[10]*m[10];
      gl.uniformMatrix4fv(this.u.uModel,false,m);gl.uniformMatrix3fv(this.u.uNormal,false,new Float32Array([m[0]/sx,m[1]/sx,m[2]/sx,m[4]/sy,m[5]/sy,m[6]/sy,m[8]/sz,m[9]/sz,m[10]/sz]));
      gl.uniform4f(this.u.uColor,color[0],color[1],color[2],alpha);gl.uniform1f(this.u.uGlow,glow);
      gl.uniform1f(this.u.uSkin,kind.startsWith('skin')?3:kind==='tube'?2:kind==='body'?1:0);
      gl.uniform2f(this.u.uBend,deform?.bend?.[0]||0,deform?.bend?.[1]||0);gl.uniform1f(this.u.uTwist,deform?.twist||0);
      if(kind.startsWith('skin')){gl.uniform1f(this.u.uRadius,deform.radius);for(let i=0;i<4;i++)gl.uniform3fv(this.u['uCurve'+i],new Float32Array(deform.joints[i]));}
      if(kind==='tube'){gl.uniform1f(this.u.uRadius,deform.radius);for(let i=0;i<4;i++)gl.uniform3fv(this.u['uCurve'+i],new Float32Array(deform.curve[i]));}
      if(kind==='body'){const spine=deform?.spine||[[0,0,0],[0,.33,0],[0,.67,0],[0,1,0]];for(let i=0;i<4;i++)gl.uniform3fv(this.u['uCurve'+i],new Float32Array(spine[i]));}
      gl.depthMask(alpha>=.99);gl.drawArrays(gl.TRIANGLES,0,mesh.count);gl.depthMask(true);
    }
    shape(kind,pos,scale,color,angle=0,alpha=1,glow=0) {this.draw(kind,model(pos,scale,angle),color,alpha,glow);}
    bone(a,b,r,color,kind='limb') {this.draw(typeof kind==='string'?kind:'limb',between(a,b,r),color);}
    skin(kind,a,b,c,right,radius,color){this.draw(kind,model([0,0,0],[1,1,1]),color,1,0,{joints:[a,b,c,right],radius});}
    curve(curve,radius,color,alpha=1,glow=.06){this.draw('tube',model([0,0,0],[1,1,1]),color,alpha,glow,{curve,radius});}
    project(p) {
      const m=this.vp,x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];
      if(w<=0)return null;
      return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w*this.width*.5+this.width*.5,(-((m[1]*x+m[5]*y+m[9]*z+m[13])/w)*.5+.5)*this.height];
    }
    environment() { this.scenery.draw(); }
    prop(p){
      let rot=root.CombatYard.rotation(p),center=[p.x,p.y,p.z];
      if(p.heldBy&&this.rigs[p.heldBy]){
        const rig=this.rigs[p.heldBy],holder=this.world.getFighter(p.heldBy),hand=rig.pts.handR;center=hand.map((v,i)=>v+rot[i]*(p.hx+.04)+rot[3+i]*.04);
        if(p.type==='blaster')center=hand.map((v,i)=>v+rot[3+i]*.13+rot[6+i]*.06);
        if(p.gear||holder.action?.move.weapon){const frame=root.CombatContact.weaponFrame(holder,rig,p);rot=frame.rot;center=frame.center;}
      }
      const matrix=new Float32Array([rot[0],rot[1],rot[2],0,rot[3],rot[4],rot[5],0,rot[6],rot[7],rot[8],0,...center,1]);
      const alpha=p.life===undefined?1:C(p.life,0,1),wood=p.color,dark=[.25,.24,.17],metal=[.15,.24,.22];
      const D=(kind,pos,scale,color,opacity=alpha)=>this.draw(kind,mul(matrix,model(pos,scale)),color,opacity);
      if(p.type==='car'){
        D('cube',[0,-.28,0],[1.88,1.10,3.70],wood);D('cube',[0,.25,-.12],[1.88,1.20,1.68],wood);
        D('cube',[0,.87,-.12],[1.90,.06,1.75],[.18,.29,.30]);
        for(const x of [-.947,.947]){D('cube',[x,.48,-.12],[.022,.52,1.35],[.11,.21,.25]);D('cube',[x,.48,-.12],[.028,.55,.065],wood);D('cube',[x,.10,-.12],[.04,.045,1.45],[.56,.64,.60]);for(const z of [-.53,.32])D('cube',[x,.18,z],[.04,.045,.20],metal);}
        D('cube',[0,.48,.73],[1.65,.51,.025],[.11,.21,.25]);D('cube',[0,.48,-.97],[1.65,.50,.025],[.11,.21,.25]);
        for(const x of [-.58,.58]){D('cube',[x,-.05,1.86],[.46,.19,.04],[.98,.91,.66]);D('cube',[x,-.05,-1.86],[.47,.15,.04],[.79,.24,.16]);}
        for(const z of [-1.6,1.6])D('cube',[0,-.60,z],[1.94,.13,.22],[.16,.21,.22]);
        for(const x of [-.95,.95])for(const z of [-1.22,1.22]){D('sphere',[x,-.52,z],[.14,.33,.33],[.08,.11,.12]);D('sphere',[x*1.11,-.52,z],[.025,.17,.17],[.50,.57,.55]);}
        D('cube',[0,-.05,1.18],[.12,.015,.80],[.46,.59,.56]);
      }else if(p.type==='barrier'){
        D('cube',[0,-.48,0],[2.26,.46,.54],wood);D('cube',[0,.13,0],[2.26,.94,.40],wood);D('cube',[0,.68,0],[2.30,.06,.44],[.72,.71,.62]);
        for(const x of [-.82,-.27,.28,.83])D('cube',[x,.27,.207],[.28,.17,.012],[.94,.64,.25]);
      }else if(p.type==='planter'){
        D('cube',[0,0,0],[1.56,1.34,1.00],wood);D('cube',[0,.65,0],[1.64,.10,1.08],[.64,.66,.56]);D('cube',[0,.72,0],[1.36,.04,.80],[.23,.23,.16]);
        for(const x of [-.45,0,.45]){D('sphere',[x,.90,0],[.31,.32,.32],[.25,.39,.23]);D('sphere',[x,.99,-.10],[.20,.21,.20],[.39,.51,.28]);}
      }else if(p.type==='earthplatform'){
        D('cube',[0,-.02,0],[p.hx*1.94,p.hy*1.96,p.hz*1.94],[.37,.33,.26]);D('cube',[0,p.hy-.025,0],[p.hx*1.92,.05,p.hz*1.92],[.62,.56,.43]);
        for(let i=0;i<(this.detail==='lean'?4:8);i++){const a=i*Math.PI/4,x=Math.cos(a)*p.hx*.8,z=Math.sin(a)*p.hz*.8;D('rock',[x,-.01,z],[.31,Math.max(.07,p.hy*.9),.31],[.47+i%2*.08,.42+i%2*.06,.31]);}for(const z of [-.36,.24])D('cube',[0,p.hy+.002,z],[1.84,.006,.016],[.39,.35,.27]);
      }else if(p.type==='earthridge'){for(let i=0;i<3;i++)D('rock',[(i-1)*.17,0,0],[.19,.23,.23],[.57-i*.035,.48-i*.025,.34]);
      }else if(p.type==='earthwall'){
        D('cube',[0,-.04,0],[2.12,1.32,.46],[.35,.30,.23]);
        for(let i=0;i<7;i++){const x=-.88+i*.294;D('rock',[x,.42+(i%3)*.04,0],[.31,.34,.30],[.56-i%2*.07,.48-i%2*.06,.35],1);for(const side of [-1,1])D('rock',[x,-.20+(i%2)*.14,side*.19],[.25,.39,.12],[.48+i%2*.07,.40+i%2*.06,.29],1);}
        for(let i=0;i<5;i++)D('rock',[-.95+i*.46,-.66,.08],[.31,.13,.37],[.40,.34,.25]);
      }else if(p.type==='chair'){
        for(const x of [-.26,.26])for(const z of [-.25,.25])D('cube',[x,-.28,z],[.075,.48,.075],dark);
        D('cube',[0,-.01,0],[.68,.08,.65],wood);
        for(const x of [-.27,.27])D('cube',[x,.25,-.28],[.07,.54,.07],dark);
        for(const y of [.16,.32,.48])D('cube',[0,y,-.28],[.60,.085,.075],wood);
      }else if(p.type==='table'){
        D('cube',[0,.39,0],[1.86,.10,1.16],wood);
        for(const x of [-.78,.78])for(const z of [-.44,.44])D('cube',[x,-.04,z],[.12,.80,.12],dark);
        for(const z of [-.42,-.21,0,.21,.42])D('cube',[0,.445,z],[1.80,.008,.013],[.40,.29,.19]);
      }else if(p.type==='bench'){
        for(const z of [-.20,0,.20])D('cube',[0,.28,z],[2.16,.10,.17],wood);
        for(const x of [-.78,.78]){D('cube',[x,-.08,0],[.13,.55,.52],dark);D('cube',[x,-.28,0],[.32,.09,.60],dark);}
      }else if(p.type==='divider'){
        for(const x of [-.84,.84])D('cube',[x,0,0],[.12,1.16,.17],dark);
        for(const y of [-.42,-.21,0,.21,.42])D('cube',[0,y,0],[1.78,.15,.14],wood);
        for(const x of [-.84,.84])D('cube',[x,-.50,0],[.26,.08,.62],dark);
      }else if(p.type==='cone'){
        D('cube',[0,-.33,0],[.44,.06,.44],dark);D('cone',[0,-.3,0],[.19,.66,.19],wood);
        D('cylinder',[0,-.02,0],[.12,.11,.12],[.83,.86,.72]);
      }else if(p.type==='tyre'){
        D('torus',[0,0,0],[.36,.09,.36],wood);D('torus',[0,.008,0],[.29,.086,.29],[.15,.20,.18]);
      }else if(p.type==='bag'){
        D('cylinder',[0,-.43,0],[.27,.86,.27],wood);D('sphere',[0,-.43,0],[.27,.08,.27],wood);D('sphere',[0,.43,0],[.27,.08,.27],wood);
        for(const y of [-.25,.22])D('cylinder',[0,y,0],[.278,.075,.278],dark);
        D('cube',[0,.04,.27],[.12,.20,.015],[.85,.85,.63]);
        this.bone([p.x,p.y+p.hy*.9,p.z],p.anchor,.014,dark);this.shape('cylinder',[p.anchor[0],p.anchor[1],p.anchor[2]],[.11,.04,.11],dark);
        const side=p.anchor[0]<0?-6.8:6.8;this.bone(p.anchor,[side,p.anchor[1],p.anchor[2]],.055,dark);this.bone([side,0,p.anchor[2]],[side,p.anchor[1],p.anchor[2]],.065,dark);
      }else if(p.type==='baton'){
        D('cube',[0,0,0],[.12,.12,.94],wood);for(const z of [-.32,-.23,-.14])D('cube',[0,0,z],[.14,.14,.025],metal);D('sphere',[0,0,.45],[.075,.075,.075],[.78,.88,.62]);
      }else if(p.type==='staff'){
        D('cube',[0,0,0],[.105,.105,1.72],wood);D('cube',[0,0,0],[.14,.14,.34],metal);for(const z of [-.78,.78])D('sphere',[0,0,z],[.09,.09,.13],[.75,.85,.63]);
      }else if(p.type==='blaster'){
        D('cube',[0,.02,.02],[.25,.20,.48],wood);D('cube',[0,-.14,-.09],[.12,.22,.15],metal);D('cube',[0,.035,.28],[.13,.13,.18],[.77,.85,.67]);D('cube',[0,.04,.375],[.07,.07,.012],[.55,.92,.96]);D('cube',[0,.15,-.04],[.07,.06,.15],metal);for(const x of [-.131,.131])D('cube',[x,.04,0],[.012,.06,.23],p.ammo?[.73,.92,.54]:[.84,.48,.31]);
      }else if(p.type==='cart'){
        D('cube',[0,-.02,0],[1.38,.12,.90],wood);for(const x of [-.54,.54])for(const z of [-.33,.33])D('sphere',[x,-.23,z],[.14,.14,.10],dark);
        for(const x of [-.60,.60])D('cube',[x,.20,-.34],[.07,.46,.07],metal);D('cube',[0,.39,-.34],[1.25,.07,.07],metal);for(const x of [-.4,0,.4])D('cube',[x,.047,0],[.035,.012,.80],[.60,.66,.56]);
      }else if(p.type==='glass'){
        D('cube',[0,0,0],[1.6,1.6,.035],[.57,.83,.84],.28);for(const x of [-.81,.81])D('cube',[x,0,0],[.065,1.72,.11],metal);for(const y of [-.83,.83])D('cube',[0,y,0],[1.66,.06,.11],metal);D('cube',[-.2,.13,.024],[.015,1.1,.008],[.81,.94,.91],.65);D('cube',[.24,.2,.023],[.022,.70,.008],[.81,.94,.91],.5);for(const x of [-.7,.7])D('cube',[x,-.82,0],[.30,.06,.4],dark);
      }else if(p.type==='bumper'){
        D('cube',[0,0,-.08],[1.74,.96,.22],metal);for(const x of [-.57,0,.57])D('sphere',[x,0,.11],[.30,.42,.15],wood);for(const x of [-.72,.72])D('cube',[x,0,.19],[.06,.62,.025],[.84,.87,.65]);
      }else if(p.type==='crate'){
        D('cube',[0,0,0],[.79,.79,.79],wood);
        for(const z of [-.405,.405])for(const x of [-.28,.28])D('cube',[x,0,z],[.07,.80,.035],dark);
        for(const x of [-.405,.405])for(const y of [-.25,0,.25])D('cube',[x,y,0],[.025,.025,.80],[.44,.32,.20]);
      }else if(p.type==='barrel'){
        D('cylinder',[0,-.48,0],[.36,.96,.36],wood);
        for(const y of [-.30,.25])D('cylinder',[0,y,0],[.375,.055,.375],metal);
        D('cylinder',[0,.46,0],[.355,.025,.355],metal);
        D('cube',[0,.08,.355],[.19,.18,.015],[.70,.73,.46]);
      }else D('cube',[0,0,0],[p.hx*2,p.hy*2,p.hz*2],wood);
      if(!p.heldBy&&p.type!=='debris')this.shape('sphere',[p.x,.018,p.z],[Math.max(p.hx,p.hz)*1.2,.012,Math.max(p.hx,p.hz)],[.07,.11,.08],0,.18);
    }
    animationRig(){this.humanoid??=new RigAPI.Humanoid(this.world);Object.assign(this.humanoid,{motion:this.motion,ragdolls:this.ragdolls,footMemory:this.footMemory,elasticMemory:this.elasticMemory,rigs:this.rigs});return this.humanoid;}
    pose(f){return this.animationRig().pose(f);}
    buildRig(f){return this.animationRig().buildRig(f);}
    balloonRig(f,rig){
      const b=f.balloon,t=b.amount,e=t*t*(3-2*t),sign=b.quat[3]<0?-1:1,q=b.quat.map((v,i)=>v*sign*e+(i===3?1-e:0)),len=Math.hypot(...q)||1;
      const sy=1-b.squash,sx=1/Math.sqrt(sy),basis=mul(model([0,0,0],[sx,sy,sx]),mul(quaternionBasis(q.map(v=>v/len)),rigBasis(b.facing,0)));
      const radius=.12+.80*e,center=[f.x,f.y+1.28+(.92*sy-1.28)*e,f.z];
      const transform=p=>center.map((v,i)=>v+basis[i]*p[0]+basis[4+i]*p[1]+basis[8+i]*p[2]);
      const local={hipL:[-.33,-.37,-.12],hipR:[.33,-.37,-.12],kneeL:[-.53,-.50,.18],kneeR:[.53,-.50,.18],footL:[-.48,-.55,.52],footR:[.48,-.55,.52],shoulderL:[-.65,.30,.10],shoulderR:[.65,.30,.10],elbowL:[-.74,.05,.32],elbowR:[.74,.05,.32],handL:[-.78,.28,.40],handR:[.78,.28,.40],head:[0,.74,.43],torso:[0,.21,0],pelvis:[0,-.37,-.03],chest:[0,.24,0],neck:[0,.53,.35]};
      const normal={...rig.pts,pelvis:rig.trans([0,.99,0]),chest:rig.trans([0,1.49,0]),neck:rig.trans([0,1.79,0])},oldTrans=rig.trans;
      for(const [key,pos] of Object.entries(local)){const target=transform(pos),from=normal[key];rig.pts[key]=from.map((v,i)=>v+(target[i]-v)*e);rig.pts[key][1]=Math.max(key==='head'?.20:key.startsWith('hand')?.14:.095,rig.pts[key][1]);}
      rig.elastic={};rig.rootBasis=basis;rig.basis=basis;
      const up=V.sub(rig.pts.neck,rig.pts.pelvis),height=Math.hypot(...up);
      rig.bodyModel=oriented(rig.pts.pelvis,[1-e*.8,height*(1-e*.6),1-e*.8],basis);rig.bodyDeform={bend:[0,0],twist:0};
      rig.trans=p=>{
        const target=p[1]>1.75?rig.pts.head.map((v,i)=>v+basis[i]*p[0]+basis[4+i]*(p[1]-1.99)+basis[8+i]*(p[2]+.005)):transform([p[0],(p[1]-1.35)*.7,.925+p[2]-.184]);
        return oldTrans(p).map((v,i)=>v+(target[i]-v)*e);
      };
      rig.balloon={amount:e,center,radius,basis,transform};
    }
    physicalRig(f,rig,solved=null){
      if(f.balloon){this.balloonRig(f,rig);this.ragdolls[f.id].balloon=true;return;}
      if(this.ragdolls[f.id].balloon)this.ragdolls[f.id]=new root.CombatPhysics.Ragdoll();
      const pts=solved||(this.world.contacts?.poseTime===this.world.time?rig.pts:this.ragdolls[f.id].step(rig.pts,f,this.world.time,rig.elastic,this.world.yard,rig.planted)),pelvis=pts.pelvis;
      const hipRight=V.sub(pts.hipR,pts.hipL),shoulderRight=V.sub(pts.shoulderR,pts.shoulderL),up=V.sub(pts.neck,pelvis);
      const basis=jointBasis(hipRight,up),headRight=this.ragdolls[f.id].mode==='active'?shoulderRight.map((v,i)=>v*.32+hipRight[i]*.68):shoulderRight,headBasis=jointBasis(headRight,V.sub(pts.head,pts.neck));
      rig.pts=pts;rig.rootBasis=basis;rig.basis=headBasis;
      const height=Math.hypot(...up),local=p=>[V.dot(p,[basis[0],basis[1],basis[2]]),V.dot(p,[basis[4],basis[5],basis[6]]),V.dot(p,[basis[8],basis[9],basis[10]])];
      const chest=local(V.sub(pts.chest,pelvis)),torso=local(V.sub(pts.torso,pelvis)),shoulder=local(V.unit(shoulderRight));
      rig.bodyModel=oriented(pelvis,[1,height,1],basis);rig.bodyDeform={bend:[chest[0]*.3,chest[2]*.3],twist:Math.atan2(-shoulder[2],shoulder[0]),spine:[[0,0,0],[C(torso[0]*1.8,-.18,.18),.34,C(torso[2]*1.8,-.18,.18)],[C(chest[0]*1.8,-.18,.18),.70,C(chest[2]*1.8,-.18,.18)],[0,1,0]]};
      rig.trans=q=>{
        if(q[1]>1.75){const offset=[q[0],q[1]-1.99,q[2]+.005];return pts.head.map((v,i)=>v+headBasis[i]*offset[0]+headBasis[4+i]*offset[1]+headBasis[8+i]*offset[2]);}
        const t=(q[1]-.99)/.80,center=pelvis.map((v,i)=>v+up[i]*t);
        return center.map((v,i)=>v+basis[i]*q[0]+basis[8+i]*q[2]);
      };
      for(const [key,limb] of Object.entries(rig.elastic)){
        const legs=key.startsWith('leg'),side=legs?key.slice(3):key,base=pts[legs?'hip'+side:'shoulder'+side],shift=V.sub(base,limb.curve[0]);
        limb.curve[0]=base;limb.curve[1]=limb.curve[1].map((v,i)=>v+shift[i]);
        pts[legs?'foot'+side:'hand'+side]=limb.fold?limb.fold[3]:limb.curve[3];pts[legs?'knee'+side:'elbow'+side]=limb.fold?limb.curve[3]:bezier(limb.curve,.46);
      }
    }
    connectArms(f,rig,other){return this.animationRig().connectArms(f,rig,other);}
    stretchLimbs(f,rig,other){return this.animationRig().stretchLimbs(f,rig,other);}
    objectArms(f,rig){return this.animationRig().objectArms(f,rig);}
    weaponGrip(f,rig){return this.animationRig().weaponGrip(f,rig);}
    fighter(f) {
      const rig=this.rigs[f.id],{p,pts,trans,angle,basis}=rig,player=f.id==='player',accent=player?(Character.look?.accent||COLORS.yellow):f.accent||COLORS.red,bulk=f.bulk||1;
      let shirt=player?(Character.look?.shirt||[.79,.83,.71]):f.shirt||[.63,.29,.235];const pants=player?(Character.look?.pants||[.16,.23,.21]):[.17,.19,.175],coat=this.world?.infusion?.active(f);if(coat){const color=ElementVisuals.COLORS[coat.element],blend=.38*Math.min(1,(this.world.time-coat.at)/.18,(coat.until-this.world.time)/.25);shirt=shirt.map((v,i)=>v+(color[i]-v)*blend);}
      const skin=Character.palette(f).skin,dark=[.075,.10,.095];
      this.drawingActor=true;
      const part=(kind,position,scale,color,glow=0)=>this.draw(kind==='sphere'?'round':kind,oriented(position,scale,basis),color,1,glow);
      const balloon=rig.balloon,spread=balloon?.amount||0;
      this.shape('sphere',[f.x,.026,f.z],[.58+f.y*.1+spread*.42,.013,.40+f.y*.1+spread*.55],[.025,.065,.048],0,.38/(1+f.y*.2));
      this.shape('ring',[f.x,.027,f.z],[.63+spread*.40,1,.63+spread*.40],accent,0,player?.38:f===this.world.enemy?.85:.28,.6);
      if(f.dodge&&this.impact){
        const d=f.dodge;for(let i=1;i<4;i++){
          const x=f.x-d.x*.23*i,z=f.z-d.z*.23*i;
          this.shape('sphere',[x,1.21-p.drop,z],[.28,.39,.19],accent,angle,.09/i,.6);
          this.shape('sphere',[x,1.9-p.drop,z],[.15,.19,.15],accent,angle,.09/i,.6);
        }
      }
      if(balloon){
        const {center,radius,basis,transform}=balloon,matrix=oriented(center,[radius,radius,radius],basis);
        this.draw('balloonShirt',matrix,shirt,1,.04);this.draw('balloonPants',matrix,pants);
        if(balloon.amount>.35)this.draw('round',oriented(transform([0,.12,-.925]),[.18*balloon.amount,.035,.018],basis),accent,1,.10);
        if(this.impact&&this.world.time<f.balloon.boostUntil){const speed=Math.hypot(f.vx,f.vz)||1;for(let i=1;i<=3;i++)this.shape('ring',[f.x-f.vx/speed*i*.28,.032,f.z-f.vz/speed*i*.28],[radius*(1+i*.1),1,radius*(1+i*.1)],accent,0,.20/i,.6);}
        if(this.impact&&f.balloon.chargedUntil>this.world.time){for(let i=0;i<3;i++){const a=this.world.time*5+i*2.09;this.shape('sphere',[center[0]+Math.cos(a)*radius,center[1]+Math.sin(a*1.7)*radius*.65,center[2]+Math.sin(a)*radius],[.07,.07,.07],[.58,.88,1],0,.9,1);}this.draw('windRing',oriented(center,[radius*1.08,1,radius*1.08],basis),[.58,.88,1],.45,1);}
      }
      if(!balloon||balloon.amount<.98){const body=new Float32Array(rig.bodyModel);for(const i of [0,1,2,8,9,10])body[i]*=bulk;this.draw('body',body,shirt,1,0,rig.bodyDeform);}
      this.draw('round',oriented(pts.pelvis,[.24*bulk,.16,.185*bulk],rig.rootBasis),pants);
      for(const side of ['L','R']){const elastic=rig.elastic['leg'+side];if(elastic){this.curve(elastic.curve,elastic.radius,pants);if(elastic.fold)this.curve(elastic.fold,elastic.radius*.86,pants);}else{this.skin('skinLeg',pts['hip'+side],pts['knee'+side],pts['foot'+side],[rig.rootBasis[0],rig.rootBasis[1],rig.rootBasis[2]],.132*bulk,pants);}}
      for(const side of ['L','R'])Character.shoes(this,f,rig,side,dark);
      for(const side of ['L','R']){
        const sh=pts['shoulder'+side],el=pts['elbow'+side],ha=pts['hand'+side];
        this.shape('round',sh,[.12,.125,.12],shirt);
        const elastic=rig.elastic[side];if(elastic)this.curve(elastic.curve,elastic.radius,skin);else{const right=[rig.rootBasis[0],rig.rootBasis[1],rig.rootBasis[2]];this.skin('skinSleeve',sh,el,ha,right,.112*bulk,shirt);this.skin('skinArm',sh,el,ha,right,.112*bulk,skin);}
        const b=(elastic?.bulge||1)*Math.sqrt(bulk);Character.hand(this,f,rig,side,accent,skin,bulk);
        const cuff=ha.map((value,i)=>value+(el[i]-value)*.14);this.bone(cuff,ha,.079*b,player?[.80,.84,.71]:[.45,.25,.2]);
      }
      this.bone(pts.neck,pts.head,.078,skin);
      if(this.detail!=='lean'){this.bone(pts.shoulderL,pts.neck,.045,shirt);this.bone(pts.shoulderR,pts.neck,.045,shirt);}
      part('head',pts.head,[.172,.21,.17],skin);
      Character.face(this,f,rig,skin);Character.dress(this,f,rig,shirt,pants,accent);
      if(f.guard){this.shape('ring',[f.x,.032,f.z],[.79,1,.79],COLORS.teal,0,.65,.5);}
      if(this.impact&&f.action){
        const a=f.action,pose=a.move.pose,kick=/kick|slam|knee|sweep/.test(pose);
        const hand=kick?pts[pose==='sweep'?'footL':'footR']:pts[/jab|hook|backfist/.test(pose)?'handL':'handR'];
        if(a.t<a.move.duration*.72&&a.t>.025){const trail=this.trails[f.id];trail.push({pos:hand,life:.13});if(trail.length>9)trail.shift();}
      }
      if(f.id!=='player'&&f.action&&f.action.t<f.action.move.startup&&!this.world.over){
        this.shape('sphere',[f.x,f.y+2.44,f.z],[.052,.052,.052],COLORS.red,0,1,1);
      }
      this.drawingActor=false;
    }
    notify(event) {
      this.fx.notify(event);
      if(event.type==='reset'){this.floaters=[];this.ripples=[];this.poseMemory={};this.footMemory={};this.elasticMemory={};this.motion=new MotionAPI.Motion(this.world);this.camera.reset();this.trails=Object.fromEntries(this.world.fighters().map(f=>[f.id,[]]));this.ragdolls=Object.fromEntries(this.world.fighters().map(f=>[f.id,new root.CombatPhysics.Ragdoll()]));return;}
      const target=this.world.getFighter(event.target)||(event.type==='hurt'?this.world.player:this.world.enemy);
      if(event.type==='hit'||event.type==='hurt')this.floaters.push({pos:event.contact?.point?.map((v,i)=>v+(i===1?.22:0))||[target.x,(target.visual?.height??target.y+1)+.8,target.z],text:event.damage.toString(),life:.8,max:.8,hurt:event.type==='hurt'});
      if(event.type==='throwImpact')this.ripples.push({x:target.x,z:target.z,life:.48});
      if(event.type==='balloonInflate'){if(this.elasticMemory!==this.world.contacts?.performance.elasticMemory)this.elasticMemory.player=null;this.poseMemory.player=null;if(this.motion!==this.world.contacts?.performance.motion)delete this.motion.states.player;this.trails.player=[];}
      if(event.type==='balloonExit'){this.poseMemory.player=null;if(this.footMemory!==this.world.contacts?.performance.footMemory)this.footMemory.player=null;if(this.motion!==this.world.contacts?.performance.motion)delete this.motion.states.player;}
      if(event.type==='envHit')this.floaters.push({pos:[this.world.getFighter(event.target).x,this.world.getFighter(event.target).y+1.6,this.world.getFighter(event.target).z],text:String(event.damage),life:.8,max:.8,hurt:event.target==='player'});
      if(event.type==='balloonSlam')this.ripples.push({x:event.x,z:event.z,life:.48,radius:event.radius});
      if(event.type==='balloonBounce'&&event.speed>3.5)this.ripples.push({x:event.x,z:event.z,life:.28});
      if(event.type==='springLaunch'||event.type==='springProp'||event.type==='ventLaunch'||event.type==='ventProp'||event.type==='bumperBounce')this.ripples.push({x:event.x,z:event.z,life:.40,radius:1.15});
      if(event.type==='land'){const f=this.world.getFighter(event.by);this.ripples.push({x:f.x,z:f.z,life:.35});}
    }
    frame(dt) {
      const world=this.world,gl=this.gl;this.draws=0;
      const fighters=world.fighters(),shared=world.contacts?.poseTime===world.time;
      if(shared){this.ragdolls=world.contacts.dolls;this.motion=world.contacts.performance.motion;this.footMemory=world.contacts.performance.footMemory;this.elasticMemory=world.contacts.performance.elasticMemory;}
      for(const f of fighters){this.ragdolls[f.id]??=new root.CombatPhysics.Ragdoll();this.trails[f.id]??=[];}
      this.rigs=shared?Object.fromEntries(fighters.map(f=>{const rig=world.contacts.poses[f.id];return [f.id,{...rig,pts:Object.fromEntries(Object.entries(rig.pts).map(([key,p])=>[key,p.slice()])),elastic:JSON.parse(JSON.stringify(rig.elastic))}];})):Object.fromEntries(fighters.map(f=>[f.id,this.buildRig(f)]));
      if(!shared){
        for(const f of fighters)this.connectArms(f,this.rigs[f.id],world.targetFor(f));
        for(const f of fighters)this.stretchLimbs(f,this.rigs[f.id],world.targetFor(f));
        for(const f of fighters)this.objectArms(f,this.rigs[f.id]);
        for(const f of fighters)this.motion.plant(f,this.rigs[f.id],solveLeg);
      }
      for(const f of fighters)this.physicalRig(f,this.rigs[f.id]);
      if(!shared){for(const f of fighters)this.connectArms(f,this.rigs[f.id],world.targetFor(f));for(const f of fighters)this.animationRig().attackAim(f,this.rigs[f.id]);for(const f of fighters)this.weaponGrip(f,this.rigs[f.id]);}
      const visible=fighters.filter(f=>!f.ko||f===world.player||f.y>.12||world.time-(f.lastHitAt??-10)<1);
      this.camera.safe.top=this.height<300?.48:.62;this.camera.safe.bottom=this.height<300?.70:.76;
      const framing=this.camera.update(CameraAPI.actionPoints(visible,this.rigs),{dt,aspect:this.width/this.height,yaw:this.yaw,zoom:this.zoom,air:Math.max(...visible.map(f=>f.y)),paired:!!world.grapple,tilt:this.cameraTilt,shake:this.impact?world.shake:0,time:world.time});
      this.at=framing.at;this.eye=framing.eye;this.cameraFrame=framing;
      this.vp=mul(perspective(framing.fov,this.width/this.height,.08,160),lookAt(this.eye,this.at));
      const palette=PALETTES[world.arenaId]||PALETTES.courtyard;
      gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(...palette.fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.u.uVP,false,this.vp);gl.uniform3fv(this.u.uEye,new Float32Array(this.eye));
      gl.uniform3fv(this.u.uFog,new Float32Array(palette.fog));gl.uniform3fv(this.u.uAmbient,new Float32Array(palette.ambient));
      const fireLights=[];for(const f of fighters)if(world.infusion.active(f)?.element==='fire'||world.infusion.status(f,'burn'))fireLights.push([f.x,f.y+1.1,f.z,.85]);for(const c of world.elements.channels)fireLights.push([...c.from,1.2]);for(const b of world.elements.bolts)if(b.kind==='fire'||b.kind==='plasma')fireLights.push([...b.pos,.6]);for(const p of world.yard.props)if(p.burning&&!p.broken)fireLights.push([p.x,p.y+p.hy,p.z,.75]);for(const z of world.elements.zones)if(z.kind==='fire'||z.kind==='lava')fireLights.push([z.x,z.y+.25,z.z,.65]);fireLights.sort((a,b)=>Math.hypot(a[0]-this.at[0],a[2]-this.at[2])-Math.hypot(b[0]-this.at[0],b[2]-this.at[2]));for(let i=0;i<3;i++){const light=fireLights[i]||[0,0,0,0];gl.uniform4f(this.u['uFire'+i],...light);}
      this.environment();
      root.CombatBoss?.draw(this);root.CombatJournal?.draw(this);
      const mobility=world.player.mobility,anchor=mobility?.anchor||mobility?.candidate;
      if(anchor&&!world.over&&!world.player.balloon){const pulse=.09+Math.sin(world.time*6)*.018;this.shape('sphere',anchor.point,[pulse,pulse,pulse],mobility.anchor?[1,.9,.45]:[.57,.91,.89],0,.85,.8);this.shape('ring',[anchor.point[0],.04,anchor.point[2]],[.3,1,.3],[.57,.91,.89],0,.36,.6);}
      const redirectAge=world.time-(mobility?.redirectAt??-10);if(redirectAge>=0&&redirectAge<.35){const f=world.player,r=.3+redirectAge*2.3;this.shape('windRing',[f.x,f.y+.3,f.z],[r,1,r],[.59,.90,.94],0,(1-redirectAge/.35)*.7,.9);}
      for(const f of fighters)this.fighter(f);
      if(this.impact){
        for(const trace of world.lightning.traces){const alpha=C(trace.life/.10,0,1),delta=V.sub(trace.to,trace.from);let from=trace.from;for(let i=1;i<=7;i++){const t=i/7,jitter=i===7?0:Math.sin(trace.seed*3.7+i*8.1)*.12,to=trace.from.map((v,k)=>v+delta[k]*t+(k===1?jitter: k===0?jitter*.6:-jitter*.4));this.draw('cylinder',between(from,to,.018),[.62,.85,1],alpha,1);from=to;}}
        for(const f of fighters)if(f.action?.move.lightning&&!f.action.hit){const charge=C(f.action.t/f.action.move.startup,0,1),rig=this.rigs[f.id];for(const side of ['L','R'])this.shape('sphere',rig.pts['hand'+side],[.06+charge*.065,.06+charge*.065,.06+charge*.065],[.65,.9,1],0,.65,1);}
      }
      for(const wave of world.wind.waves){
        const t=1-wave.life/wave.max,alpha=(1-t)*.58,color=[.59,.90,.94];
        if(['updraft','downburst','vacuum','cyclone','spiral'].includes(wave.mode))for(let i=0;i<4;i++){
          const rise=wave.mode==='downburst'?1-t:wave.mode==='vacuum'?.2:t,y=.12+rise*2.4+i*.23,r=wave.radius*(wave.mode==='vacuum'?1-t*.75:.6+t*.35)-i*.12;
          this.shape('windRing',[wave.cx,y,wave.cz],[r,1,r],color,0,alpha,.9);
        }else{
          const basis=[wave.dz,0,-wave.dx,0,wave.dx,0,wave.dz,0,0,1,0,0,0,0,0,1];
          for(let i=0;i<3;i++){const d=.4+t*4.7-i*.28,r=.35+d*.16;this.draw('windRing',oriented([wave.x+wave.dx*d,wave.y+1.1,wave.z+wave.dz*d],[r,1,r],basis),color,alpha/(1+i*.3),.9);}
        }
      }
      for(const field of world.wind.fields){
        const fade=Math.min(1,field.life/.25);for(let i=0;i<6;i++){const phase=world.time*7+i*1.05,r=.35+field.radius*(i/7),height=.18+(i/6)*1.6;this.shape('windRing',[field.cx+Math.cos(phase)*r*.15,height,field.cz+Math.sin(phase)*r*.15],[r,1,r],[.56,.88,.94],0,fade*.26,.85);}
      }
      for(const p of world.yard.props)if(!p.broken)this.prop(p);
      ElementVisuals.draw(this,world);
      const aim=world.power.aim;if(aim.active&&aim.point){const p=aim.point,color=[.62,.91,.88];this.shape('windRing',[p[0],p[1]+.04,p[2]],[.34,1,.34],color,0,.8,.9);this.bone([p[0]-.12,p[1]+.05,p[2]],[p[0]+.12,p[1]+.05,p[2]],.008,color,'cylinder');this.bone([p[0],p[1]+.05,p[2]-.12],[p[0],p[1]+.05,p[2]+.12],.008,color,'cylinder');}
      if(world.player.action?.move.controlledThrow){const f=world.player,d=world.elementPhysics.throwDirection(f);this.bone([f.x,f.y+.08,f.z],[f.x+d[0]*1.45,f.y+.08,f.z+d[1]*1.45],.018,ElementVisuals.COLORS[f.action.move.throwElement]||COLORS.yellow,'cylinder');}

      if(this.impact){
        for(const p of world.flow.pulses){const q=1-p.life/p.max,r=.2+q*p.radius;for(const y of [0,.18])this.shape('windRing',[p.x,.06+y,p.z],[r,1,r],[.58,.88,1],0,(1-q)*.7,1);}
        for(const f of fighters){if(f.ko)continue;if(world.flow.broken(f))this.shape('ring',[f.x,.045,f.z],[.65,1,.65],[1,.71,.32],0,.6,.9);else if((f.balance||0)>65)this.shape('ring',[f.x,.04,f.z],[.5,1,.5],[1,.71,.32],0,.2,.7);
          if(world.flow.marked(f,'shock')||world.flow.marked(f,'coil')){const rig=this.rigs[f.id],keys=['shoulderL','handR','hipL'],phase=Math.floor(world.time*9)%3;for(let i=0;i<2;i++){const p=rig.pts[keys[(phase+i)%3]];this.shape('sphere',p,[.043,.043,.043],[.59,.88,1],0,.7,1);}}
        }
      }
      for(const bolt of world.arsenal.bolts){const color=bolt.charged?[.55,.93,1]:[.96,.88,.45],tail=bolt.pos.map((v,i)=>v-bolt.velocity[i]*.012);this.bone(tail,bolt.pos,bolt.charged?.042:.025,color,1,1);this.shape('sphere',bolt.pos,[.065,.065,.065],color,0,1,1);}
      for(const r of this.ripples){r.life-=dt;const size=.3+(1-r.life/.48)*(r.radius||1.8);if(this.impact)this.shape('ring',[r.x,.035,r.z],[size,1,size],COLORS.cream,0,C(r.life/.48,0,1)*.65,.8);}this.ripples=this.ripples.filter(r=>r.life>0);
      if(this.impact)for(const p of world.particles){this.shape('sphere',[p.x,p.y,p.z],[p.size,p.size,p.size],p.color,0,C(p.life/.15,0,1),.8);}
      this.elementParticles.flush();
      const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
      this.fx.frame(dt);
      root.CombatStudio?.drawRadar(this);
      if(world.power.aim.active&&world.power.aim.point){const p=this.project(world.power.aim.point);if(p){const x=C(p[0],18,this.width-18),y=C(p[1],70,this.height-24);ctx.strokeStyle='#b7f0e7';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();ctx.font='bold 8px Arial';ctx.fillStyle='#d5f3ea';ctx.textAlign='center';ctx.fillText('AIM',x,y-14);}}

      if(world.yard.held(world.player)?.type==='blaster'&&!world.over){const p=this.project([world.enemy.x,world.enemy.y+1.25,world.enemy.z]);if(p){ctx.strokeStyle='#d5edb8';ctx.lineWidth=1.5;ctx.globalAlpha=.6;for(let i=0;i<4;i++){const a=i*Math.PI/2+.2;ctx.beginPath();ctx.arc(p[0],p[1],15,a,a+.9);ctx.stroke();}ctx.globalAlpha=1;}}
      for(const {id} of fighters){
        const list=this.trails[id];for(const p of list)p.life-=dt;this.trails[id]=list.filter(p=>p.life>0);
        if(this.impact&&list.length>1){ctx.lineCap='round';ctx.lineJoin='round';
          for(let i=1;i<list.length;i++){const a=this.project(list[i-1].pos),b=this.project(list[i].pos);if(!a||!b)continue;ctx.strokeStyle=id==='player'?`rgba(226,241,155,${C(list[i].life/.13,0,1)*.34})`:`rgba(246,156,120,${C(list[i].life/.13,0,1)*.27})`;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
        }
      }
      if(world.isGroup())for(const enemy of world.enemies){
        const pos=this.project([enemy.x,enemy.y+2.65,enemy.z]);if(!pos)continue;const active=enemy===world.enemy;
        ctx.globalAlpha=enemy.ko?.4:1;ctx.fillStyle=active?'#e8f2b1':'#d9e2d2';ctx.textAlign='center';ctx.font=(active?'bold ':'')+'9px Arial';ctx.fillText((active?'› ':'')+enemy.name+(enemy.ko?' · DOWN':''),pos[0],pos[1]);
        ctx.fillStyle='#20382b';ctx.fillRect(pos[0]-25,pos[1]+5,50,3);ctx.fillStyle=active?'#dfed99':'#b4c5a4';ctx.fillRect(pos[0]-25,pos[1]+5,50*enemy.health/enemy.maxHealth,3);
      }ctx.globalAlpha=1;
      for(const f of this.floaters){f.life-=dt;const pos=[f.pos[0],f.pos[1]+(.8-f.life)*.7,f.pos[2]],p=this.project(pos);if(!p)continue;
        ctx.globalAlpha=C(f.life/.18,0,1);ctx.font='bold 17px Arial';ctx.textAlign='center';ctx.fillStyle=f.hurt?'#f3a490':'#edf586';ctx.shadowColor='#142e21';ctx.shadowBlur=6;ctx.fillText(f.text,p[0],p[1]);ctx.shadowBlur=0;
      }ctx.globalAlpha=1;this.floaters=this.floaters.filter(f=>f.life>0);
      const grad=ctx.createRadialGradient(this.width/2,this.height/2,this.height*.35,this.width/2,this.height/2,this.width*.72);grad.addColorStop(0,'transparent');grad.addColorStop(1,'rgba(8,26,17,.23)');ctx.fillStyle=grad;ctx.fillRect(0,0,this.width,this.height);
    }
  }
  root.CombatRenderer={Renderer,mul,perspective,lookAt,model,between,geometry,rigBasis,solveArm,solveLeg,bezier,jointBasis,quaternionBasis};
})(typeof window!=='undefined'?window:globalThis);
