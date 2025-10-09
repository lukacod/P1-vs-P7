// app_pose.js — V2.1 with pose-based auto-align (uses TensorFlow.js pose-detection)
// Note: this relies on the pose-detection library via CDN included in index.html.
// If CDN scripts fail to load offline, auto-align will not work; everything else remains client-side.

const p1file = document.getElementById('p1file');
const p7file = document.getElementById('p7file');
const p1img = document.getElementById('p1img');
const p7img = document.getElementById('p7img');
const p1wrap = document.getElementById('p1wrap');
const p7wrap = document.getElementById('p7wrap');
const viewer = document.getElementById('viewer');
const opacity = document.getElementById('opacity');
const blend = document.getElementById('blend');
const zoomP1 = document.getElementById('zoomP1');
const zoomP7 = document.getElementById('zoomP7');
const reset = document.getElementById('reset');
const flip = document.getElementById('flip');
const swap = document.getElementById('swap');
const showGuides = document.getElementById('showGuides');
const showGrid = document.getElementById('showGrid');
const compare = document.getElementById('compare');
const annotationLayer = document.getElementById('annotationLayer');
const outCanvas = document.getElementById('outCanvas');
const mergeBtn = document.getElementById('mergeBtn');
const saveBtn = document.getElementById('saveBtn');
const studentInput = document.getElementById('student');
const saveLocal = document.getElementById('saveLocal');
const loadLocal = document.getElementById('loadLocal');
const angleVal = document.getElementById('angleVal');
const notes = document.getElementById('notes');
const autoAlignBtn = document.getElementById('autoAlign');

let detector = null;

let state = {
  p1: {imgEl: p1img, wrap: p1wrap, scale:1, x:0, y:0, flip:false},
  p7: {imgEl: p7img, wrap: p7wrap, scale:1, x:0, y:0, flip:false},
  annotations: [],
  tool: null,
  points: []
};

function fileToImage(file, imgEl, cb){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => { imgEl.src = e.target.result; imgEl.onload = () => cb && cb(); };
  reader.readAsDataURL(file);
}

p1file.addEventListener('change', e => fileToImage(e.target.files[0], p1img, fitToViewer));
p7file.addEventListener('change', e => fileToImage(e.target.files[0], p7img, fitToViewer));

function fitToViewer(){
  // center and reset transforms when images loaded
  ['p1','p7'].forEach(k => {
    const s = state[k];
    s.scale = 1;
    s.x = (viewer.clientWidth - (s.imgEl.naturalWidth))/2;
    s.y = (viewer.clientHeight - (s.imgEl.naturalHeight))/2;
    updateTransform(k);
  });
  drawGuides();
}

// transform helpers
function updateTransform(key){
  const s = state[key];
  const el = s.wrap;
  el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale}) ${s.flip? 'scaleX(-1)': ''}`;
  if(key==='p7') p7wrap.style.opacity = opacity.value/100;
  p7img.style.mixBlendMode = blend.value;
}

zoomP1.addEventListener('input', e => { state.p1.scale = e.target.value/100; updateTransform('p1'); });
zoomP7.addEventListener('input', e => { state.p7.scale = e.target.value/100; updateTransform('p7'); });
opacity.addEventListener('input', e => { p7wrap.style.opacity = e.target.value/100; });
blend.addEventListener('change', e => { p7img.style.mixBlendMode = e.target.value; });

reset.addEventListener('click', () => {
  ['p1','p7'].forEach(k => { state[k].scale = 1; state[k].x = 0; state[k].y = 0; state[k].flip=false; updateTransform(k); });
});

flip.addEventListener('click', () => { state.p7.flip = !state.p7.flip; updateTransform('p7'); });
swap.addEventListener('click', ()=>{
  // swap sources
  const tmp = p1img.src; p1img.src = p7img.src; p7img.src = tmp;
  fitToViewer();
});

// drag handlers for each wrap (mouse + touch)
function makeDraggable(key){
  const wrap = state[key].wrap;
  let dragging=false, lastX=0,lastY=0;
  wrap.addEventListener('pointerdown', e => { dragging=true; lastX=e.clientX; lastY=e.clientY; wrap.setPointerCapture(e.pointerId); });
  window.addEventListener('pointermove', e => {
    if(!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    state[key].x += dx; state[key].y += dy; updateTransform(key);
  });
  window.addEventListener('pointerup', e => { dragging=false; });
}
makeDraggable('p1'); makeDraggable('p7');

// compare slider: mask overlay width
compare.addEventListener('input', e => {
  const pct = e.target.value/100;
  p7wrap.style.clipPath = `inset(0 ${100-pct}% 0 0)`;
});

// guides and grid
function drawGuides(){
  const svg = annotationLayer;
  svg.innerHTML = '';
  const w = viewer.clientWidth, h = viewer.clientHeight;
  if(showGrid.checked){
    for(let x=0;x<=w;x+=w/12){
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',x); line.setAttribute('y1',0); line.setAttribute('x2',x); line.setAttribute('y2',h);
      line.setAttribute('stroke','#ffffff22'); line.setAttribute('stroke-width',1);
      svg.appendChild(line);
    }
    for(let y=0;y<=h;y+=h/12){
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',0); line.setAttribute('y1',y); line.setAttribute('x2',w); line.setAttribute('y2',y);
      line.setAttribute('stroke','#ffffff22'); line.setAttribute('stroke-width',1);
      svg.appendChild(line);
    }
  }
  if(showGuides.checked){
    const cx = w/2;
    const mid = document.createElementNS('http://www.w3.org/2000/svg','line');
    mid.setAttribute('x1',cx); mid.setAttribute('y1',0); mid.setAttribute('x2',cx); mid.setAttribute('y2',h);
    mid.setAttribute('stroke','#fffb'); mid.setAttribute('stroke-width',2);
    svg.appendChild(mid);
    const hline = document.createElementNS('http://www.w3.org/2000/svg','line');
    hline.setAttribute('x1',0); hline.setAttribute('y1',h/2); hline.setAttribute('x2',w); hline.setAttribute('y2',h/2);
    hline.setAttribute('stroke','#fffb'); hline.setAttribute('stroke-width',2);
    svg.appendChild(hline);
  }
}
showGuides.addEventListener('change', drawGuides);
showGrid.addEventListener('change', drawGuides);
window.addEventListener('resize', drawGuides);

// simple annotation tools (SVG)
let currentTool = null;
document.getElementById('lineTool').addEventListener('click', ()=> selectTool('line'));
document.getElementById('angleTool').addEventListener('click', ()=> selectTool('angle'));
document.getElementById('textTool').addEventListener('click', ()=> selectTool('text'));
document.getElementById('clearAnno').addEventListener('click', ()=> { state.annotations=[]; renderAnnotations(); angleVal.textContent='—'; notes.textContent='No annotations'; });

function selectTool(t){
  currentTool = t; state.points = []; annotationLayer.style.pointerEvents = 'auto';
  notes.textContent = `Selected tool: ${t}`;
}

annotationLayer.addEventListener('pointerdown', e => {
  if(!currentTool) return;
  const rect = annotationLayer.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  state.points.push({x,y});
  if(currentTool==='text'){
    const txt = prompt('Text annotation:');
    if(txt){
      state.annotations.push({type:'text',x,y,text:txt});
      renderAnnotations();
    }
    state.points = [];
    return;
  }
  if(currentTool==='line' && state.points.length===2){
    state.annotations.push({type:'line',a:state.points[0],b:state.points[1]});
    state.points = []; renderAnnotations();
  }
  if(currentTool==='angle' && state.points.length===3){
    const [A,B,C] = state.points; // angle at B between BA and BC
    const ang = calcAngle(A,B,C);
    state.annotations.push({type:'angle',A,B,C,angle:ang});
    angleVal.textContent = ang.toFixed(1)+'°';
    state.points = []; renderAnnotations();
  }
});

function renderAnnotations(){
  const svg = annotationLayer; svg.innerHTML = '';
  drawGuides(); // keep guides
  state.annotations.forEach(a => {
    if(a.type==='line'){
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',a.a.x); line.setAttribute('y1',a.a.y); line.setAttribute('x2',a.b.x); line.setAttribute('y2',a.b.y);
      line.setAttribute('stroke','red'); line.setAttribute('stroke-width',3); svg.appendChild(line);
    }else if(a.type==='text'){
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x',a.x); t.setAttribute('y',a.y); t.setAttribute('fill','yellow'); t.setAttribute('font-size',18); t.textContent=a.text; svg.appendChild(t);
    }else if(a.type==='angle'){
      const l1 = document.createElementNS('http://www.w3.org/2000/svg','line');
      l1.setAttribute('x1',a.B.x); l1.setAttribute('y1',a.B.y); l1.setAttribute('x2',a.A.x); l1.setAttribute('y2',a.A.y);
      l1.setAttribute('stroke','lime'); l1.setAttribute('stroke-width',3); svg.appendChild(l1);
      const l2 = document.createElementNS('http://www.w3.org/2000/svg','line');
      l2.setAttribute('x1',a.B.x); l2.setAttribute('y1',a.B.y); l2.setAttribute('x2',a.C.x); l2.setAttribute('y2',a.C.y);
      l2.setAttribute('stroke','lime'); l2.setAttribute('stroke-width',3); svg.appendChild(l2);
      const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
      txt.setAttribute('x',a.B.x+8); txt.setAttribute('y',a.B.y-8); txt.setAttribute('fill','lime'); txt.setAttribute('font-size',16);
      txt.textContent = a.angle.toFixed(1)+'°'; svg.appendChild(txt);
    }
  });
  notes.textContent = state.annotations.length + ' annotations';
}

function calcAngle(A,B,C){
  // angle at B between BA and BC
  const v1 = {x:A.x-B.x, y:A.y-B.y}; const v2 = {x:C.x-B.x, y:C.y-B.y};
  const dot = v1.x*v2.x + v1.y*v2.y;
  const mag1 = Math.hypot(v1.x,v1.y), mag2 = Math.hypot(v2.x,v2.y);
  const cos = Math.max(-1, Math.min(1, dot/(mag1*mag2)));
  return Math.acos(cos)*180/Math.PI;
}

// merge to canvas and download
mergeBtn.addEventListener('click', async ()=>{
  const canvas = outCanvas;
  canvas.width = viewer.clientWidth; canvas.height = viewer.clientHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // draw p1
  await drawElementToCanvas(ctx, state.p1);
  // draw p7 with opacity and blend - simple approach: draw then apply globalAlpha
  ctx.globalAlpha = parseFloat(p7wrap.style.opacity || (opacity.value/100));
  ctx.drawImage(state.p7.imgEl, state.p7.x, state.p7.y, state.p7.imgEl.naturalWidth*state.p7.scale, state.p7.imgEl.naturalHeight*state.p7.scale);
  ctx.globalAlpha = 1;
  // draw annotations as SVG image
  const svgData = new XMLSerializer().serializeToString(annotationLayer);
  const svgBlob = new Blob([svgData], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.src = url;
  await img.decode();
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  URL.revokeObjectURL(url);
  alert('Merged into preview canvas. Press "Download Result" to save PNG.');
});

saveBtn.addEventListener('click', ()=>{
  const canvas = outCanvas;
  if(!canvas.width){ alert('No merged image yet. Click "Merge to Image" first.'); return; }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${studentInput.value||'swing'}_overlay.png`;
  a.click();
});

async function drawElementToCanvas(ctx, elementState){
  if(!elementState.imgEl.src) return;
  // draw underlying image using its transforms
  ctx.drawImage(elementState.imgEl, elementState.x, elementState.y, elementState.imgEl.naturalWidth*elementState.scale, elementState.imgEl.naturalHeight*elementState.scale);
}

// local save / load (simple)
saveLocal.addEventListener('click', ()=>{
  const data = {
    student: studentInput.value,
    p1: p1img.src||null,
    p7: p7img.src||null,
    annotations: state.annotations
  };
  localStorage.setItem('gsv2_last', JSON.stringify(data));
  alert('Saved locally in browser storage.');
});
loadLocal.addEventListener('click', ()=>{
  const raw = localStorage.getItem('gsv2_last');
  if(!raw) { alert('No saved data'); return; }
  const data = JSON.parse(raw);
  if(data.p1) p1img.src = data.p1;
  if(data.p7) p7img.src = data.p7;
  state.annotations = data.annotations || [];
  studentInput.value = data.student || '';
  fitToViewer();
  renderAnnotations();
});

// ===================
// Pose detection + Auto-align
// ===================
async function ensureDetector(){
  if(detector) return detector;
  if(!window.poseDetection || !window.tf){
    alert('Pose libraries not loaded. Auto-align unavailable.');
    return null;
  }
  // create MoveNet or BlazePose detector (prefer MoveNet)
  try{
    const model = poseDetection.SupportedModels.MoveNet;
    detector = await poseDetection.createDetector(model, {modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING});
  }catch(err){
    try{
      const model = poseDetection.SupportedModels.BlazePose;
      detector = await poseDetection.createDetector(model, {runtime:'mediapipe',solutionPath:'https://cdn.jsdelivr.net/npm/@mediapipe/pose'});
    }catch(e){
      console.error('Detector init failed', e);
      alert('Failed to initialize pose detector.');
      return null;
    }
  }
  return detector;
}

function keypointsToPoint(kp, name){
  const part = kp.find(p=>p.name===name || p.part===name);
  if(!part) return null;
  // some APIs use .x/.y normalized, others use .x/.y in pixels; try both
  if(part.x!=null && part.y!=null) return {x: part.x, y: part.y};
  if(part.x?.value!=null) return {x: part.x.value, y: part.y.value};
 return null;
}

function computeTransformFromKeypoints(kp1, kp2){
  // use shoulders as primary anchors; fallback to hips if absent
  const left1 = keypointsToPoint(kp1, 'left_shoulder') || keypointsToPoint(kp1,'leftShoulder') || keypointsToPoint(kp1,'left_shoulder');
  const right1 = keypointsToPoint(kp1, 'right_shoulder') || keypointsToPoint(kp1,'rightShoulder');
  const left2 = keypointsToPoint(kp2, 'left_shoulder') || keypointsToPoint(kp2,'leftShoulder');
  const right2 = keypointsToPoint(kp2, 'right_shoulder') || keypointsToPoint(kp2,'rightShoulder');
  if(!left1 || !right1 || !left2 || !right2){
    return null;
  }
  // if coordinates are normalized (0..1), convert to image pixels
  function toPixels(pt, img){ if(pt.x<=1 && pt.y<=1){ return {x: pt.x*img.naturalWidth, y: pt.y*img.naturalHeight}; } return pt; }

  const p1L = toPixels(left1, p1img), p1R = toPixels(right1, p1img);
  const p2L = toPixels(left2, p7img), p2R = toPixels(right2, p7img);

  // midpoints
  const mid1 = {x: (p1L.x+p1R.x)/2, y: (p1L.y+p1R.y)/2};
  const mid2 = {x: (p2L.x+p2R.x)/2, y: (p2L.y+p2R.y)/2};

  // shoulder distances (for scale)
  const d1 = Math.hypot(p1R.x-p1L.x, p1R.y-p1L.y);
  const d2 = Math.hypot(p2R.x-p2L.x, p2R.y-p2L.y);
  const scale = d1 / d2;

  // rotation: angle of shoulders
  const ang1 = Math.atan2(p1R.y-p1L.y, p1R.x-p1L.x);
  const ang2 = Math.atan2(p2R.y-p2L.y, p2R.x-p2L.x);
  const rot = ang1 - ang2; // rotate p7 by this

  return {scale, rot, mid1, mid2};
}

async function autoAlign(){
  if(!p1img.src || !p7img.src){
    alert('Please load both P-1 and P-7 images first.');
    return;
  }
  const det = await ensureDetector();
  if(!det) return;
  notes.textContent = 'Detecting pose...';
  try{
    const poses1 = await det.estimatePoses(p1img);
    const poses2 = await det.estimatePoses(p7img);
    if(!poses1.length || !poses2.length){ alert('No poses detected in one or both images. Try clearer full-body photos.'); notes.textContent='Pose not found'; return; }
    const kp1 = poses1[0].keypoints || poses1[0];
    const kp2 = poses2[0].keypoints || poses2[0];
    const t = computeTransformFromKeypoints(kp1,kp2);
    if(!t){ alert('Keypoints insufficient for auto-align.'); notes.textContent='Insufficient keypoints'; return; }
    // Apply transform to state.p7 so that p7 aligns to p1
    // Steps: scale, rotate around mid2 -> then translate mid2->mid1
    // Approximate: set p7.scale = p7.scale * t.scale, then compute rotation in CSS by applying transform to wrap (CSS can't easily rotate+scale centers without complex math), so we'll compute new x,y offsets to approximate.
    const prevScale = state.p7.scale;
    state.p7.scale = state.p7.scale * t.scale;
    // compute pixel positions of midpoints in viewer coordinates
    // note: keypoints were relative to image pixel coordinates; we must map to current viewer positions.
    const p7imgPixelsMid = { x: t.mid2.x * state.p7.scale + state.p7.x, y: t.mid2.y * state.p7.scale + state.p7.y };
    const desiredMid = { x: t.mid1.x * state.p1.scale + state.p1.x, y: t.mid1.y * state.p1.scale + state.p1.y };
    // translate so midpoints match
    state.p7.x += (desiredMid.x - p7imgPixelsMid.x);
    state.p7.y += (desiredMid.y - p7imgPixelsMid.y);
    updateTransform('p7');
    notes.textContent = 'Auto-align applied (scale + translate). For rotation correction, use Flip or manual rotate via annotations.';
  }catch(err){
    console.error(err);
    alert('Auto-align failed: '+err.message);
    notes.textContent = 'Auto-align error';
  }
}

autoAlignBtn.addEventListener('click', autoAlign);

// helper to get approximate image-natural coords in viewer
// (Several simplifications made — this is an approximation to give good results quickly.)
function toViewerPoint(imgPt, imgEl, stateObj){
  return { x: imgPt.x*stateObj.scale + stateObj.x, y: imgPt.y*stateObj.scale + stateObj.y };
}

// initial drawGuides
drawGuides();
