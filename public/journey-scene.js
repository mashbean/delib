// A projected 3D scene: two parallel circular planes, a perspective camera,
// source packets on the rings and people entering, leaving and changing modes.
// Canvas labels are backed by ordinary stage buttons in the page.
export function createJourneyScene(canvas, { onSelect, labels, reducedMotion }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { update() {}, reset() {}, setTilt() {}, destroy() {} };
  const camera = { yaw:-.3, tilt:34*Math.PI/180 };
  let width=0,height=0,scale=1,step=0,mode='hybrid',paused=reducedMotion,time=0,inView=false,raf=0,last=0,points=[],drag=null,moved=false;
  const colors={online:'#446b56',offline:'#80634f',data:'#b94429',people:'#254e3b'};
  const world=(angle,y,r=180)=>({x:Math.cos(angle)*r,y,z:Math.sin(angle)*r});
  function project(p) {
    const x=p.x*Math.cos(camera.yaw)-p.z*Math.sin(camera.yaw);
    const z=p.x*Math.sin(camera.yaw)+p.z*Math.cos(camera.yaw);
    const yy=p.y*Math.cos(camera.tilt)-z*Math.sin(camera.tilt);
    const zz=p.y*Math.sin(camera.tilt)+z*Math.cos(camera.tilt);
    const perspective=850/(850+zz);
    return {x:width/2+x*scale*perspective,y:height*.51+yy*scale*perspective,z:zz,s:perspective*scale};
  }
  function line(a,b,color,w=1,dash=[]) {ctx.beginPath();ctx.setLineDash(dash);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke();ctx.setLineDash([]);}
  function ring(y,r,color,fill) {
    ctx.beginPath();for(let j=0;j<=100;j++){const p=project(world(j/100*Math.PI*2,y,r));j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.stroke();
  }
  function person(p,alpha=1) {
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=alpha;const s=Math.max(.65,p.s);
    ctx.fillStyle=colors.people;ctx.beginPath();ctx.arc(0,-6*s,2.2*s,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=colors.people;ctx.lineWidth=1.5*s;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,-2*s);ctx.lineTo(0,4*s);ctx.moveTo(-3*s,0);ctx.lineTo(3*s,0);ctx.moveTo(0,4*s);ctx.lineTo(-2.7*s,8*s);ctx.moveTo(0,4*s);ctx.lineTo(2.7*s,8*s);ctx.stroke();ctx.restore();
  }
  function draw() {
    ctx.clearRect(0,0,width,height);points=[];
    // Baseline grid establishes depth without competing with the process.
    for(let i=-240;i<=240;i+=60){line(project({x:i,y:110,z:-240}),project({x:i,y:110,z:240}),'#ced7c755');line(project({x:-240,y:110,z:i}),project({x:240,y:110,z:i}),'#ced7c755');}
    const levels=mode==='online'?[-72]:mode==='offline'?[72]:[72,-72];
    if(mode==='hybrid') for(let i=0;i<8;i++){const a=i/8*Math.PI*2;line(project(world(a,72)),project(world(a,-72)),'#adbca77a',.8,[3,5]);}
    for(const y of levels){
      const online=y<0,color=online?colors.online:colors.offline;
      ring(y,214,online?'#adbca799':'#c6b9a699',online?'#eaf0e650':'#e9dfcf44');ring(y,180,color);ring(y,150,online?'#adbca750':'#c6b9a650');
      // Short tangents show direction, even when the animation is paused.
      for(let i=0;i<8;i++){const a=(i+.54)/8*Math.PI*2,p=project(world(a,y)),q=project(world(a+.05,y));const angle=Math.atan2(q.y-p.y,q.x-p.x);line(p,{x:p.x-5*Math.cos(angle-.55),y:p.y-5*Math.sin(angle-.55)},color);line(p,{x:p.x-5*Math.cos(angle+.55),y:p.y-5*Math.sin(angle+.55)},color);}
      for(let n=0;n<14;n++){const a=(time*.14+n/14*Math.PI*2+(online?0:.4))%(Math.PI*2),p=project(world(a,y));ctx.fillStyle=colors.data;ctx.beginPath();ctx.arc(p.x,p.y,2.2*p.s,0,Math.PI*2);ctx.fill();}
      for(let i=0;i<8;i++) points.push({...project(world(i/8*Math.PI*2,y)),i,online,color});
    }
    // People are distinct from orange data packets and traverse the third axis.
    for(let n=0;n<10;n++){
      const p=(time*.045+n*.117)%1,a=(n%8)/8*Math.PI*2;
      let y=mode==='online'?-72:mode==='offline'?72:(n%2?-72:72),r=180;
      if(mode==='hybrid'&&n%3===0) y=72-144*p;
      else {r=p<.35?265-(p/.35)*85:p>.7?180+(p-.7)/.3*85:180;}
      person(project(world(a+.12,y,r)),Math.min(1,p*8,(1-p)*8));
    }
    points.sort((a,b)=>b.z-a.z);
    for(const p of points){const selected=p.i===step,r=(selected?11:7)*Math.max(.75,p.s);ctx.shadowColor='#29452b20';ctx.shadowBlur=selected?14:0;ctx.fillStyle=selected?colors.data:'#f8f9f1';ctx.strokeStyle=selected?colors.data:p.color;ctx.lineWidth=selected?2:1.2;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=selected?'#ffffff':p.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.max(8,9*p.s)}px ui-monospace,monospace`;ctx.fillText(String(p.i+1).padStart(2,'0'),p.x,p.y+.4);
      // Labels always face the viewer, independent of camera orientation.
      if(p.online||mode==='offline'){ctx.font=`${selected?600:400} ${width<400?10:12}px system-ui,sans-serif`;const text=labels()[p.i],tw=ctx.measureText(text).width;const tx=p.x,ty=p.y-r-15;ctx.fillStyle='#edf1e8e8';ctx.fillRect(tx-tw/2-4,ty-8,tw+8,17);ctx.fillStyle=selected?colors.data:'#405447';ctx.fillText(text,tx,ty);}
    }
    ctx.font='10px ui-monospace,monospace';ctx.textAlign='left';ctx.textBaseline='middle';
    for(const y of levels){const p=project({x:0,y,z:0});ctx.fillStyle=y<0?colors.online:colors.offline;ctx.fillText(y<0?'ONLINE':'IN PERSON',15,p.y);}
    const center=project({x:0,y:0,z:0});ctx.fillStyle='#607860';ctx.textAlign='center';ctx.font='24px system-ui';ctx.fillText('⿻',center.x,center.y);
  }
  function tick(now){raf=0;if(!inView||document.hidden||paused)return;time+=Math.min((now-last)/1000,.05);last=now;draw();raf=requestAnimationFrame(tick);}
  function sync(){cancelAnimationFrame(raf);raf=0;if(inView&&!document.hidden&&!paused){last=performance.now();raf=requestAnimationFrame(tick);}draw();}
  const resize=new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);scale=Math.min(width/610,height/415);draw();});resize.observe(canvas);
  const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.05});observer.observe(canvas);
  document.addEventListener('visibilitychange',sync);
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw:camera.yaw};moved=false;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>4)moved=true;camera.yaw=drag.yaw+dx*.009;draw();});
  const release=e=>{if(!drag)return;if(!moved){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const hit=[...points].reverse().find(p=>Math.hypot(p.x-x,p.y-y)<22);if(hit)onSelect(hit.i);}drag=null;};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',()=>{drag=null;});
  return {update(state){step=state.step??step;mode=state.mode??mode;paused=state.paused??paused;sync();},setTilt(value){camera.tilt=value*Math.PI/180;draw();},reset(){if(window.gsap&&!reducedMotion)window.gsap.to(camera,{yaw:-.3,tilt:34*Math.PI/180,duration:.7,ease:'power2.out',onUpdate:draw});else{camera.yaw=-.3;camera.tilt=34*Math.PI/180;draw();}},destroy(){cancelAnimationFrame(raf);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',sync);}};
}
