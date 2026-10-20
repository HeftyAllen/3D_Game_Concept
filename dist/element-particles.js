/* Batched, depth-tested world particles. Procedural alpha replaces solid flame cones. */
(function(root){
  'use strict';
  const TYPES={flame:0,ember:1,smoke:2,drop:3,glow:4,dust:5,pool:6,magma:7,ripple:8,foam:9};
  const VERTEX=`attribute vec3 aPosition;attribute vec2 aUV;attribute vec2 aSize;attribute vec3 aMeta;attribute vec4 aColor;attribute vec2 aStyle;
uniform mat4 uVP;uniform vec3 uRight;uniform vec3 uUp;varying vec2 vUV;varying vec3 vMeta;varying vec4 vColor;
void main(){vec2 p=(aUV-.5)*aSize;float c=cos(aStyle.x),s=sin(aStyle.x);p=mat2(c,-s,s,c)*p;vec3 offset=aStyle.y>.5?vec3(p.x,0.,p.y):uRight*p.x+uUp*p.y;gl_Position=uVP*vec4(aPosition+offset,1.);vUV=aUV;vMeta=aMeta;vColor=aColor;}`;
  const FRAGMENT=`precision mediump float;uniform float uTime;varying vec2 vUV;varying vec3 vMeta;varying vec4 vColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return .58*noise(p)+.28*noise(p*2.03)+.14*noise(p*4.07);}
void main(){vec2 uv=vUV,p=uv*2.-1.;float kind=vMeta.x,seed=vMeta.y,t=uTime+seed*.173,alpha=0.;vec3 color=vColor.rgb;
if(kind<.5){
 float y=uv.y,n=fbm(vec2(p.x*3.+seed,y*5.-t*4.2));float sway=sin(y*7.-t*5.+seed)*.08*y+(n-.5)*.36*y;
 float width=mix(.72,.045,pow(y,.83));float edge=abs(p.x+sway)/max(.02,width);float body=1.-smoothstep(.66,1.08,edge);
 alpha=body*smoothstep(0.,.13,y)*(1.-smoothstep(.65,1.,y))*(.55+.45*n);
 float core=pow(max(0.,1.-edge),1.8)*(1.-y);color=mix(vec3(.86,.09,.015),color,smoothstep(.2,.8,n+.22));color=mix(color,vec3(1.,.91,.48),clamp(core*1.65,0.,1.));
}else if(kind<1.5){float d=length(p);alpha=pow(max(0.,1.-d),1.3);color=mix(color,vec3(1.,.97,.76),pow(max(0.,1.-d),4.));
}else if(kind<2.5||kind>4.5&&kind<5.5){float n=fbm(p*2.8+seed+vec2(t*.16,t*.22)),d=length(p);alpha=(1.-smoothstep(.35,.98,d))*(.30+.70*n);color*=.8+n*.35;
}else if(kind<3.5){float d=length(p*vec2(1.,.87));alpha=(1.-smoothstep(.68,1.,d))*.78;float rim=pow(clamp(d,0.,1.),3.);float glint=exp(-length((p-vec2(-.24,.3))*vec2(5.,7.)));color=mix(color*.6,color,rim);color+=vec3(.68,.87,1.)*glint;
}else if(kind<4.5){alpha=pow(max(0.,1.-length(p)),2.)*.65;
}else if(kind<7.5){float d=length(p),n=fbm(p*4.+seed+vec2(t*.28,-t*.24));float boundary=.86+.07*sin(atan(p.y,p.x)*7.+seed)+.05*n;alpha=(1.-smoothstep(boundary-.12,boundary,d));
 if(kind<6.5){float rip=pow(.5+.5*sin(d*29.-t*4.+n*3.),9.);color=mix(color*.31,color*.75,.5+.5*n);color+=vec3(.42,.74,.84)*rip*.5;alpha*=.50;float rim=smoothstep(boundary-.15,boundary-.06,d);color=mix(color,vec3(.69,.94,.95),rim*.65);}
 else{float veins=1.-smoothstep(.03,.15,abs(n-.5));color=mix(vec3(.12,.08,.06),mix(vec3(.95,.16,.015),vec3(1.,.77,.17),veins),.30+veins*.70);alpha*=.96;}
}else if(kind<8.5){float d=length(p),wave=.68+vMeta.z*.23;alpha=(1.-smoothstep(.012,.047,abs(d-wave)))*(1.-smoothstep(.93,1.,d));
}else{float d=length(p);alpha=(1.-smoothstep(.45,.98,d))*(.6+.4*noise(p*7.+seed));color=mix(color,vec3(.92,.99,1.),.6);}
alpha*=vColor.a;if(alpha<.008)discard;gl_FragColor=vec4(color,alpha);}`;
  class ElementParticles{
    constructor(renderer){this.r=renderer;this.items=[];this.count=0;this.lastCount=0;this.limit=1100;this.data=new Float32Array(this.limit*6*16);const gl=renderer.gl;
      const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
      this.buffer=gl.createBuffer();this.attributes=[['aPosition',3],['aUV',2],['aSize',2],['aMeta',3],['aColor',4],['aStyle',2]].map(([name,size])=>({location:gl.getAttribLocation(this.program,name),size}));this.u={};for(const key of ['uVP','uRight','uUp','uTime'])this.u[key]=gl.getUniformLocation(this.program,key);
    }
    begin(){this.items.length=0;this.count=0;}
    add(kind,pos,size,color,alpha=1,seed=0,angle=0,ground=false,phase=0){if(this.items.length>=(this.r.detail==='lean'?520:this.limit))return;this.items.push({type:TYPES[kind]??4,pos,size,color,alpha,seed,angle,ground,phase});this.count=this.items.length;}
    flush(){const r=this.r,gl=r.gl;this.lastCount=this.items.length;if(!this.items.length)return;const back=r.eye.map((v,i)=>v-r.at[i]),len=Math.hypot(back[0],back[2])||1,right=[back[2]/len,0,-back[0]/len],n=Math.hypot(...back)||1,z=back.map(v=>v/n),up=[z[1]*right[2],z[2]*right[0]-z[0]*right[2],-z[1]*right[0]];
      this.items.sort((a,b)=>b.pos.reduce((v,p,i)=>v+(p-r.eye[i])**2,0)-a.pos.reduce((v,p,i)=>v+(p-r.eye[i])**2,0));let k=0;const corners=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];
      for(const q of this.items)for(const uv of corners){this.data.set([...q.pos,...uv,...q.size,q.type,q.seed,q.phase,...q.color,q.alpha,q.angle,q.ground?1:0],k);k+=16;}
      gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.data.subarray(0,k),gl.DYNAMIC_DRAW);let offset=0;for(const a of this.attributes){gl.enableVertexAttribArray(a.location);gl.vertexAttribPointer(a.location,a.size,gl.FLOAT,false,64,offset*4);offset+=a.size;}
      gl.uniformMatrix4fv(this.u.uVP,false,r.vp);gl.uniform3fv(this.u.uRight,new Float32Array(right));gl.uniform3fv(this.u.uUp,new Float32Array(up));gl.uniform1f(this.u.uTime,r.world.time);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,this.items.length*6);r.draws++;gl.depthMask(true);
      for(const a of this.attributes)gl.disableVertexAttribArray(a.location);gl.useProgram(r.program);
    }
  }
  root.CombatElementParticles={ElementParticles,TYPES,VERTEX,FRAGMENT};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatElementParticles;
})(typeof window!=='undefined'?window:globalThis);
