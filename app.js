(function(){"use strict";
var $=function(i){return document.getElementById(i)};
/* ---------- DATA (prices must match netlify/functions/create-checkout.mjs) ---------- */
var STYLES=[{id:'tee',name:'Classic tee',desc:'100% cotton',price:24},{id:'heavy',name:'Heavyweight',desc:'Boxy fit',price:29},
 {id:'longsleeve',name:'Long sleeve',desc:'Soft cotton',price:32},{id:'hoodie',name:'Hoodie',desc:'Fleece lined',price:46}];
var COLORS=[{id:'white',name:'White',hex:'#f7f7f5'},{id:'black',name:'Black',hex:'#1d1d1f'},{id:'navy',name:'Navy',hex:'#1f2a44'},
 {id:'grey',name:'Heather grey',hex:'#b9b8b4'},{id:'red',name:'Red',hex:'#c8323a'},{id:'royal',name:'Royal blue',hex:'#2a52be'},
 {id:'forest',name:'Forest green',hex:'#2f5236'},{id:'maroon',name:'Maroon',hex:'#6b1f2a'},{id:'sand',name:'Sand',hex:'#d8c7a1'},
 {id:'pink',name:'Light pink',hex:'#f4c6cf'},{id:'gold',name:'Gold',hex:'#e7a92b'},{id:'purple',name:'Purple',hex:'#5b3a8c'}];
var SIZES=[['xs',0],['s',0],['m',0],['l',0],['xl',0],['2xl',3],['3xl',3],['4xl',5]];

/* ---------- WHAT'S IN STOCK (change these lists when your stock changes) ---------- */
/* Anything NOT in these lists is greyed out and can't be picked. */
var STYLES_IN_STOCK=['tee'];                      // add 'heavy', 'longsleeve' or 'hoodie' when you have them
var COLORS_IN_STOCK=['black','red','white'];      // add colour ids from the COLORS list above
var SIZES_IN_STOCK=['xs','s','m','l','xl','2xl','3xl','4xl'];  // remove a size if you run out
function inStock(list,id){return list.indexOf(id)>-1}

var BACK_PRINT=6;
var FONTS=['Inter','Anton','Bebas Neue','Oswald','Graduate','Bungee','Permanent Marker','Pacifico','Lobster','Dancing Script','Playfair Display'];
var TEXT_COLORS=['#ffffff','#111111','#e8483c','#f2b705','#2a52be','#2f8f4e','#7b3fa0','#ff7ab6','#c0c0c0','#d4af37'];
var CLIPS=['★','♥','⚡','👑','🔥','⚽','🏀','🏈','⚾','🎂','🎉','🌸','🦋','🐾','🎵','✝','☮','♛','✈','☀'];
/* print area, in canvas coords (600x680) */
var AREA={front:{x:190,y:185,w:220,h:290},back:{x:180,y:170,w:240,h:320}};

var state={style:'tee',color:'white',size:'m',qty:1,mixed:false,mix:{},view:'front',sel:null,els:{front:[],back:[]}};
var cart=[];try{cart=JSON.parse(localStorage.getItem('ct73cart'))||[]}catch(e){}
/* drop any saved cart items that are no longer in stock */
cart=cart.filter(function(i){return inStock(STYLES_IN_STOCK,i.style)&&inStock(COLORS_IN_STOCK,i.color)&&itemLines(i).every(function(l){return inStock(SIZES_IN_STOCK,l.size)})});
var history=[],future=[],uid=1;

/* ---------- REALISTIC GARMENT DRAWING ---------- */
function shade(hex,amt){var n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;
 function f(c){return Math.max(0,Math.min(255,Math.round(amt<0?c*(1+amt):c+(255-c)*amt)))}
 return 'rgb('+f(r)+','+f(g)+','+f(b)+')'}
function bodyPath(style,view){
 var p=new Path2D(),hood=style==='hoodie',long=style==='longsleeve'||hood,boxy=style==='heavy';
 var sw=boxy?8:0, nk=view==='front'?(hood?60:52):34;
 p.moveTo(225,70);
 p.bezierCurveTo(250,70+nk,350,70+nk,375,70);           // neckline
 p.lineTo(460+sw,105);                                  // right shoulder
 if(long){p.lineTo(520,330);p.lineTo(545,560);p.lineTo(500,572);p.lineTo(468,350);p.lineTo(450,230);}
 else{p.lineTo(545,215);p.lineTo(478,262);}
 p.lineTo(455+sw,250);p.bezierCurveTo(458+sw,400,462+sw,520,465+sw,625);
 p.bezierCurveTo(360,640,240,640,135-sw,625);
 p.bezierCurveTo(138-sw,520,142-sw,400,145-sw,250);
 if(long){p.lineTo(150,230);p.lineTo(132,350);p.lineTo(100,572);p.lineTo(55,560);p.lineTo(80,330);}
 else{p.lineTo(122,262);p.lineTo(55,215);}
 p.lineTo(140-sw,105);p.closePath();return p}
function drawGarment(ctx,style,colorHex,view){
 ctx.clearRect(0,0,600,680);
 var body=bodyPath(style,view);
 ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=24;ctx.shadowOffsetY=10;ctx.fillStyle=colorHex;ctx.fill(body);ctx.restore();
 ctx.save();ctx.clip(body);
 var g=ctx.createLinearGradient(0,0,600,0);   // side shading for a 3D look
 g.addColorStop(0,'rgba(0,0,0,.22)');g.addColorStop(.18,'rgba(0,0,0,0)');g.addColorStop(.5,'rgba(255,255,255,.07)');
 g.addColorStop(.82,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.22)');ctx.fillStyle=g;ctx.fillRect(0,0,600,680);
 var v=ctx.createLinearGradient(0,60,0,640);v.addColorStop(0,'rgba(255,255,255,.08)');v.addColorStop(1,'rgba(0,0,0,.12)');ctx.fillStyle=v;ctx.fillRect(0,0,600,680);
 // fabric folds
 ctx.filter='blur(6px)';ctx.lineCap='round';
 [[200,300,180,600,.10],[410,320,425,610,.10],[260,520,300,630,.07],[340,500,380,630,.06],[150,240,200,290,.12],[450,240,400,290,.12]].forEach(function(f){
  ctx.strokeStyle='rgba(0,0,0,'+f[4]+')';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(f[0],f[1]);ctx.quadraticCurveTo((f[0]+f[2])/2+15,(f[1]+f[3])/2,f[2],f[3]);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(f[0]+14,f[1]);ctx.quadraticCurveTo((f[0]+f[2])/2+29,(f[1]+f[3])/2,f[2]+14,f[3]);ctx.stroke();});
 ctx.filter='none';
 // seams and hems
 ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=1.2;ctx.setLineDash([3,3]);
 ctx.beginPath();ctx.moveTo(130,612);ctx.bezierCurveTo(240,627,360,627,470,612);ctx.stroke();
 ctx.beginPath();ctx.moveTo(145,250);ctx.lineTo(140,105);ctx.moveTo(455,250);ctx.lineTo(460,105);ctx.stroke();ctx.setLineDash([]);
 ctx.restore();
 // collar / hood
 if(style==='hoodie'){
  var hood=new Path2D();hood.moveTo(222,72);hood.bezierCurveTo(200,-5,400,-5,378,72);
  if(view==='front')hood.bezierCurveTo(350,130,250,130,222,72);else hood.bezierCurveTo(360,150,240,150,222,72);
  ctx.fillStyle=shade(colorHex,-.08);ctx.fill(hood);ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=2;ctx.stroke(hood);
  if(view==='front'){ctx.fillStyle=shade(colorHex,-.35);ctx.beginPath();ctx.ellipse(300,88,58,24,0,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle=shade(colorHex,.5);ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(280,112);ctx.lineTo(276,200);ctx.moveTo(320,112);ctx.lineTo(324,200);ctx.stroke();
   var pk=new Path2D();pk.moveTo(205,470);pk.lineTo(395,470);pk.lineTo(420,580);pk.lineTo(180,580);pk.closePath();
   ctx.fillStyle='rgba(0,0,0,.05)';ctx.fill(pk);ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=1.5;ctx.stroke(pk);}
 } else {
  var nk=view==='front'?52:34;
  ctx.strokeStyle=shade(colorHex,-.18);ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(225,72);ctx.bezierCurveTo(250,72+nk,350,72+nk,375,72);ctx.stroke();
  ctx.fillStyle=shade(colorHex,-.3);ctx.beginPath();ctx.moveTo(225,70);ctx.bezierCurveTo(250,70+nk-6,350,70+nk-6,375,70);ctx.bezierCurveTo(340,62,260,62,225,70);ctx.fill();
 }
}/* ---------- TEXT RENDERING (same function for screen and print file) ---------- */
function textCanvas(el,px){
 var fs=px,font=(el.italic?'italic ':'')+(el.bold?'800 ':'400 ')+fs+'px "'+el.font+'"';
 var c=document.createElement('canvas'),x=c.getContext('2d');x.font=font;
 var w=Math.max(1,x.measureText(el.text).width),sw=el.strokeW*fs/40,pad=sw+fs*.2,curve=el.curve/100;
 if(Math.abs(curve)<.02){
  c.width=w+pad*2;c.height=fs*1.35+pad*2;x=c.getContext('2d');x.font=font;x.textBaseline='middle';x.lineJoin='round';
  if(sw>0){x.lineWidth=sw*2;x.strokeStyle=el.stroke;x.strokeText(el.text,pad,c.height/2)}
  x.fillStyle=el.color;x.fillText(el.text,pad,c.height/2);return c}
 var ang=Math.abs(curve)*Math.PI*1.2,R=w/ang,h=R*(1-Math.cos(ang/2))+fs*1.4+pad*2;
 c.width=Math.max(w,2*R*Math.sin(ang/2))+fs+pad*2;c.height=h;x=c.getContext('2d');x.font=font;x.textBaseline='middle';x.lineJoin='round';
 var cx=c.width/2,cy=curve>0?R+fs*.7+pad:h-R-fs*.7-pad,a=-ang/2;
 for(var i=0;i<el.text.length;i++){var ch=el.text[i],cw=x.measureText(ch).width,t=a+cw/2/R;
  x.save();if(curve>0){x.translate(cx+R*Math.sin(t),cy-R*Math.cos(t));x.rotate(t)}else{x.translate(cx+R*Math.sin(t),cy+R*Math.cos(t));x.rotate(-t)}
  if(sw>0){x.lineWidth=sw*2;x.strokeStyle=el.stroke;x.strokeText(ch,-cw/2,0)}x.fillStyle=el.color;x.fillText(ch,-cw/2,0);x.restore();a+=cw/R}
 return c}

/* ---------- ELEMENTS ---------- */
function els(){return state.els[state.view]}
function selEl(){return els().filter(function(e){return e.id===state.sel})[0]}
function snapshot(){history.push(JSON.stringify(state.els));if(history.length>50)history.shift();future=[]}
function restore(s){state.els=JSON.parse(s);state.sel=null;renderEls();syncPanels();update()}
function areaPx(){var st=$('stage').getBoundingClientRect(),k=st.width/600,a=AREA[state.view];return{k:k,x:a.x*k,y:a.y*k,w:a.w*k,h:a.h*k}}
function addEl(o){snapshot();o.id=uid++;o.x=o.x||.5;o.y=o.y||.4;o.rot=0;els().push(o);state.sel=o.id;renderEls();syncPanels();update()}
function renderEls(){
 var A=areaPx(),pa=$('printArea');pa.style.left=A.x+'px';pa.style.top=A.y+'px';pa.style.width=A.w+'px';pa.style.height=A.h+'px';pa.innerHTML='';
 els().forEach(function(e){
  var d=document.createElement('div');d.className='el'+(e.id===state.sel?' sel':'');
  var img=new Image();
  if(e.type==='text'){var c=textCanvas(e,120);img.src=c.toDataURL();e.ar=c.height/c.width}else img.src=e.src;
  var w=e.size*A.w;d.style.width=w+'px';
  d.style.left=(e.x*A.w-w/2)+'px';d.style.top=(e.y*A.h-w*e.ar/2)+'px';d.style.transform='rotate('+e.rot+'deg)';
  d.appendChild(img);
  if(e.id===state.sel){var h=document.createElement('div');h.className='handle';d.appendChild(h);var r=document.createElement('div');r.className='rhandle';d.appendChild(r);bindHandle(h,e,'size');bindHandle(r,e,'rot')}
  bindDrag(d,e);pa.appendChild(d)});
}
function bindDrag(d,e){d.addEventListener('pointerdown',function(ev){
 if(ev.target.classList.contains('handle')||ev.target.classList.contains('rhandle'))return;
 ev.preventDefault();if(state.sel!==e.id){state.sel=e.id;renderEls();syncPanels()}
 snapshot();var A=areaPx(),sx=ev.clientX,sy=ev.clientY,ox=e.x,oy=e.y;
 function mv(m){e.x=Math.max(0,Math.min(1,ox+(m.clientX-sx)/A.w));e.y=Math.max(0,Math.min(1,oy+(m.clientY-sy)/A.h));
  if(Math.abs(e.x-.5)<.02)e.x=.5;renderEls()}   // snaps to centre line
 function up(){removeEventListener('pointermove',mv);removeEventListener('pointerup',up);update()}
 addEventListener('pointermove',mv);addEventListener('pointerup',up)})}
function bindHandle(h,e,mode){h.addEventListener('pointerdown',function(ev){ev.preventDefault();ev.stopPropagation();snapshot();
 var A=areaPx(),r=$('printArea').getBoundingClientRect(),cx=r.left+e.x*A.w,cy=r.top+e.y*A.h,d0=Math.hypot(ev.clientX-cx,ev.clientY-cy),s0=e.size;
 function mv(m){if(mode==='size'){e.size=Math.max(.08,Math.min(2,s0*Math.hypot(m.clientX-cx,m.clientY-cy)/d0))}
  else{var a=Math.atan2(m.clientY-cy,m.clientX-cx)*180/Math.PI+90;if(Math.abs(a)<4)a=0;e.rot=Math.round(a>180?a-360:a)}
  syncPanels();renderEls()}
 function up(){removeEventListener('pointermove',mv);removeEventListener('pointerup',up);update()}
 addEventListener('pointermove',mv);addEventListener('pointerup',up)})}
function syncPanels(){var e=selEl();$('layerPanel').classList.toggle('hidden',!e);$('textEdit').classList.toggle('hidden',!(e&&e.type==='text'));
 if(!e)return;$('sizeRange').value=Math.round(e.size*100);$('rotRange').value=e.rot;
 if(e.type==='text'){$('textInput').value=e.text;$('fontSel').value=e.font;$('strokeColor').value=e.stroke;$('strokeW').value=e.strokeW;$('curve').value=e.curve;
  $('addText').textContent='Add another text'}}

/* ---------- IMAGE UPLOAD ---------- */
function handleFile(f){
 if(!/^image\//.test(f.type)){toast('Please choose an image file');return}
 if(f.size>15*1024*1024){toast('That file is over 15 MB');return}
 var rd=new FileReader();rd.onload=function(){var im=new Image();im.onload=function(){
  // keep up to 2400px for print quality
  var s=Math.min(1,2400/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s)||800;c.height=Math.round(im.height*s)||800;
  c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  var inches=12*(AREA[state.view].w/240)*.8,dpi=Math.round(c.width/inches);
  $('dpiNote').textContent=dpi<150?'Heads up: this image is low resolution ('+c.width+'px wide) and may print blurry at full size.':'Image looks good for printing.';
  $('dpiNote').className='hint'+(dpi<150?' warn':'');
  addEl({type:'img',src:c.toDataURL('image/png'),ar:c.height/c.width,size:.8})};im.src=rd.result};rd.readAsDataURL(f)}
/* ---------- READY-MADE TEMPLATES ---------- */
/* Each template has a few boxes for the customer to fill in, then builds the text for the shirt.
   x / y = position inside the print box (0 to 1), size = width compared with the print box. */
function ordinal(n){n=String(n).trim();var d=parseInt(n,10);if(isNaN(d))return n;var t=d%100,u=d%10;
 return d+((t>10&&t<14)?'TH':u===1?'ST':u===2?'ND':u===3?'RD':'TH')}
function tplColors(){var light=state.color==='white'||state.color==='sand'||state.color==='pink';
 return{main:light?'#111111':'#ffffff',accent:state.color==='red'?'#f2b705':'#e8483c'}}
function T(text,font,size,y,o){o=o||{};return{type:'text',text:String(text),font:font,color:o.color,stroke:o.stroke||'#000000',strokeW:o.strokeW||0,
 curve:o.curve||0,bold:false,italic:false,size:size,x:.5,y:y}}
var TEMPLATES=[
 {id:'birthday',name:'Birthday',icon:'🎂',
  fields:[{k:'name',label:'Name',def:'Jayden'},{k:'age',label:'Age',def:'5'}],
  build:function(v,c){return{front:[
   T(v.name.toUpperCase()+"'S",'Bebas Neue',.75,.2,{color:c.main}),
   T(ordinal(v.age),'Anton',.55,.48,{color:c.accent}),
   T('Birthday','Pacifico',.8,.78,{color:c.main})],back:[]}}},
 {id:'reunion',name:'Family reunion',icon:'👨‍👩‍👧‍👦',
  fields:[{k:'family',label:'Family name',def:'Johnson'},{k:'year',label:'Year',def:String(new Date().getFullYear())},{k:'place',label:'Place (optional)',def:''}],
  build:function(v,c){var f=[
   T('THE '+v.family.toUpperCase(),'Graduate',.9,.2,{color:c.main,curve:30}),
   T('FAMILY REUNION','Bebas Neue',.95,.48,{color:c.accent}),
   T(v.year,'Anton',.4,.7,{color:c.main})];
   if(v.place.trim())f.push(T(v.place,'Inter',.6,.9,{color:c.main}));return{front:f,back:[]}}},
 {id:'team',name:'Sports team',icon:'🏆',note:'Prints on the front and back.',
  fields:[{k:'team',label:'Team name',def:'Tigers'},{k:'name',label:'Player name',def:'Smith'},{k:'number',label:'Number',def:'23'}],
  build:function(v,c){return{
   front:[T(v.team.toUpperCase(),'Graduate',.9,.25,{color:c.main,curve:25}),
          T(v.number,'Anton',.45,.65,{color:c.accent,stroke:c.main,strokeW:3})],
   back:[T(v.name.toUpperCase(),'Graduate',.75,.14,{color:c.main,curve:15}),
         T(v.number,'Anton',.75,.55,{color:c.accent,stroke:c.main,strokeW:3})]}}},
 {id:'memorial',name:'Memorial',icon:'🕊️',note:'Tip: add their photo in the Upload art tab.',
  fields:[{k:'name',label:'Name',def:'Mary Johnson'},{k:'years',label:'Years',def:'1950 - '+new Date().getFullYear()},{k:'msg',label:'Message',def:'Forever in our hearts'}],
  build:function(v,c){var f=[
   T('In Loving Memory','Dancing Script',.85,.12,{color:c.main}),
   T(v.name,'Playfair Display',.9,.72,{color:c.main}),
   T(v.years,'Inter',.5,.83,{color:c.main})];
   if(v.msg.trim())f.push(T(v.msg,'Dancing Script',.8,.94,{color:c.accent}));return{front:f,back:[]}}},
 {id:'grad',name:'Graduation',icon:'🎓',
  fields:[{k:'name',label:'Name',def:'Alex'},{k:'school',label:'School',def:'Lincoln High'},{k:'year',label:'Year',def:String(new Date().getFullYear())}],
  build:function(v,c){return{front:[
   T('CLASS OF','Bebas Neue',.6,.15,{color:c.main}),
   T(v.year,'Anton',.65,.4,{color:c.accent}),
   T(v.name,'Permanent Marker',.75,.68,{color:c.main}),
   T(v.school.toUpperCase(),'Oswald',.7,.88,{color:c.main})],back:[]}}}
];
var curTpl=null;
function showTplForm(t){curTpl=t;
 document.querySelectorAll('#tplGrid button').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-t')===t.id)});
 $('tplForm').innerHTML='<h4>'+t.icon+' '+t.name+'</h4>'+t.fields.map(function(f){
   return '<label>'+f.label+'</label><input data-k="'+f.k+'" maxlength="40" value="'+f.def.replace(/"/g,'&quot;')+'">'}).join('')+
  (t.note?'<p class="hint">'+t.note+'</p>':'')+
  '<button class="btn accent block" id="tplApply" type="button">Put it on my shirt</button>'+
  '<p class="hint">This replaces anything already on the shirt. You can still move or change the text afterwards.</p>';
 $('tplForm').classList.remove('hidden');
 $('tplApply').onclick=applyTemplate}
function applyTemplate(){if(!curTpl)return;var v={};
 document.querySelectorAll('#tplForm input').forEach(function(i){var f=curTpl.fields.filter(function(x){return x.k===i.getAttribute('data-k')})[0];
  v[i.getAttribute('data-k')]=i.value.trim()||(f.label.indexOf('optional')>-1?'':f.def)});
 var d=curTpl.build(v,tplColors());snapshot();
 ['front','back'].forEach(function(side){d[side].forEach(function(e){e.id=uid++;e.rot=0})});
 state.els={front:d.front,back:d.back};state.sel=null;
 var fonts={};d.front.concat(d.back).forEach(function(e){fonts[e.font]=1});
 setView('front');
 Promise.all(Object.keys(fonts).map(function(f){return document.fonts.load('400 40px "'+f+'"')})).then(function(){renderEls();update()});
 toast(d.back.length?'Template added to the front and back. Tap any text to change it.':'Template added. Tap any text to change it.')}

            /* ---------- PRODUCT OPTIONS + PRICE ---------- */
function find(a,id){return a.filter(function(x){return x.id===id})[0]}
function build(){
 // look for options that aren't in stock
 var css=document.createElement('style');
 css.textContent='.opt.unavailable,.sw.unavailable{opacity:.4;cursor:not-allowed}'+
  '.sw.unavailable{position:relative;overflow:hidden}'+
  '.sw.unavailable::after{content:"";position:absolute;left:50%;top:-20%;height:140%;width:2px;background:#777;transform:translateX(-50%) rotate(45deg)}'+
  '.opt .soon{display:block;font-size:10px;font-weight:600;margin-top:2px}'+
  '.stock-note{margin:6px 0 0;font-size:12px;opacity:.75}';
 document.head.appendChild(css);

 $('styleOpts').innerHTML=STYLES.map(function(s){var ok=inStock(STYLES_IN_STOCK,s.id);
  return '<button class="opt'+(ok?'':' unavailable')+'" data-v="'+s.id+'"'+(ok?'':' disabled title="Not available at the moment"')+'>'+s.name+
   (ok?'<small>'+s.desc+' &middot; $'+s.price+'</small>':'<span class="soon">Not available at the moment</span>')+'</button>'}).join('');
 $('colorOpts').innerHTML=COLORS.map(function(c){var ok=inStock(COLORS_IN_STOCK,c.id);
  return '<button class="sw'+(ok?'':' unavailable')+'" title="'+c.name+(ok?'':' (coming soon)')+'" data-v="'+c.id+'" style="background:'+c.hex+'"'+(ok?'':' disabled')+'></button>'}).join('');
 if(COLORS_IN_STOCK.length<COLORS.length)$('colorOpts').insertAdjacentHTML('afterend','<p class="stock-note">Greyed-out colours are coming soon.</p>');
 $('sizeOpts').innerHTML=SIZES.map(function(s){var ok=inStock(SIZES_IN_STOCK,s[0]);
  return '<button class="opt'+(ok?'':' unavailable')+'" data-v="'+s[0]+'"'+(ok?'':' disabled title="Sold out"')+'>'+s[0].toUpperCase()+
   (ok?(s[1]?'<small>+$'+s[1]+'</small>':''):'<span class="soon">Sold out</span>')+'</button>'}).join('');
 // group order: different sizes for one design
 css.textContent+='.mix-toggle{display:flex;align-items:center;gap:8px;margin:10px 0 4px;font-weight:600;cursor:pointer}'+
  '.mix-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin:6px 0 4px}.mix-grid.hidden{display:none}'+
  '.mix-row{display:flex;align-items:center;gap:4px}.mix-row span{width:34px;font-weight:600}'+
  '.mix-row input{width:44px;text-align:center}.mix-row button{width:28px;height:28px;cursor:pointer}'+
  '.mix-total{font-size:13px;margin:4px 0 0;font-weight:600}';
 $('sizeOpts').insertAdjacentHTML('afterend','<label class="mix-toggle"><input type="checkbox" id="mixToggle"> Group order: different sizes</label>'+
  '<div class="mix-grid hidden" id="mixGrid">'+SIZES.filter(function(z){return inStock(SIZES_IN_STOCK,z[0])}).map(function(z){
   return '<div class="mix-row"><span>'+z[0].toUpperCase()+'</span><button type="button" data-s="'+z[0]+'" data-d="-1">-</button>'+
    '<input type="number" min="0" max="500" value="0" data-s="'+z[0]+'"><button type="button" data-s="'+z[0]+'" data-d="1">+</button></div>'}).join('')+
  '</div><p class="mix-total hidden" id="mixTotal"></p>');
 $('mixToggle').addEventListener('change',function(){state.mixed=this.checked;
  if(state.mixed&&!totalQty(lines())){state.mix={};state.mix[state.size]=state.qty;syncMix()}
  $('mixGrid').classList.toggle('hidden',!state.mixed);$('mixTotal').classList.toggle('hidden',!state.mixed);
  $('sizeOpts').classList.toggle('hidden',state.mixed);$('qty').parentNode.classList.toggle('hidden',state.mixed);
  $('qty').parentNode.previousElementSibling.classList.toggle('hidden',state.mixed);update()});
 $('mixGrid').addEventListener('click',function(ev){var b=ev.target.closest('button[data-d]');if(!b)return;var z=b.getAttribute('data-s');
  state.mix[z]=Math.max(0,Math.min(500,(state.mix[z]||0)+parseInt(b.getAttribute('data-d'))));syncMix();update()});
 $('mixGrid').addEventListener('input',function(ev){var z=ev.target.getAttribute('data-s');if(!z)return;
  state.mix[z]=Math.max(0,Math.min(500,parseInt(ev.target.value)||0));update()});
 // Share button under Add to cart
 css.textContent+='.share-btn{margin-top:8px}.share-box{margin-top:8px;display:flex;gap:6px}.share-box.hidden{display:none}.share-box input{flex:1;min-width:0;font-size:12px}';
 $('addCart').insertAdjacentHTML('afterend','<button class="btn block share-btn" id="shareBtn" type="button">Share this design</button>'+
  '<div class="share-box hidden" id="shareBox"><input id="shareLink" readonly><button class="btn sm" id="copyShare" type="button">Copy</button></div>');
 $('shareBtn').onclick=shareDesign;$('copyShare').onclick=copyShare;
 // Templates tab
 css.textContent+='.tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-bottom:12px}'+
  '.tpl-grid button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;border:1px solid rgba(0,0,0,.15);border-radius:12px;background:transparent;color:inherit;cursor:pointer;font-weight:600;font-size:13px}'+
  '.tpl-grid button span{font-size:28px;line-height:1}.tpl-grid button.active{border-color:#e8483c;box-shadow:0 0 0 2px #e8483c inset}'+
  '#tplForm h4{margin:0 0 6px}#tplForm input{width:100%;box-sizing:border-box}';
 var tb=document.createElement('button');tb.setAttribute('data-tab','templates');tb.textContent='Templates';
 var tabs=document.querySelector('.tabs');tabs.insertBefore(tb,tabs.children[1]);
 $('tab-clipart').insertAdjacentHTML('afterend','<div class="tab hidden" id="tab-templates"><p class="hint">Pick a ready-made design, type your details, and you\'re done.</p>'+
  '<div class="tpl-grid" id="tplGrid">'+TEMPLATES.map(function(t){return '<button type="button" data-t="'+t.id+'"><span>'+t.icon+'</span>'+t.name+'</button>'}).join('')+'</div>'+
  '<div id="tplForm" class="hidden"></div></div>');
 $('tplGrid').addEventListener('click',function(ev){var b=ev.target.closest('[data-t]');if(!b)return;
  showTplForm(TEMPLATES.filter(function(t){return t.id===b.getAttribute('data-t')})[0])});
 $('fontSel').innerHTML=FONTS.map(function(f){return '<option style="font-family:\''+f+'\'">'+f+'</option>'}).join('');
 $('textColors').innerHTML=TEXT_COLORS.map(function(c){return '<button class="sw" data-v="'+c+'" style="background:'+c+'"></button>'}).join('');
 $('clipGrid').innerHTML=CLIPS.map(function(c){return '<button>'+c+'</button>'}).join('');
 [['styleOpts','style'],['colorOpts','color'],['sizeOpts','size']].forEach(function(p){
  $(p[0]).addEventListener('click',function(ev){var b=ev.target.closest('[data-v]');
   if(!b||b.disabled||b.classList.contains('unavailable'))return;   // can't pick out-of-stock options
   state[p[1]]=b.getAttribute('data-v');update()})});
}
function unitFor(size){var s=find(STYLES,state.style).price,up=SIZES.filter(function(z){return z[0]===size})[0][1];
 return s+up+(state.els.front.length&&state.els.back.length?BACK_PRINT:0)}
function unitPrice(){return unitFor(state.size)}
/* the sizes being ordered right now: one size, or a group breakdown */
function lines(){
 if(!state.mixed)return[{size:state.size,qty:state.qty,unit:unitFor(state.size)}];
 return SIZES.filter(function(z){return (state.mix[z[0]]||0)>0}).map(function(z){return{size:z[0],qty:state.mix[z[0]],unit:unitFor(z[0])}})}
function totalQty(L){return L.reduce(function(s,l){return s+l.qty},0)}
function syncMix(){document.querySelectorAll('#mixGrid input').forEach(function(i){i.value=state.mix[i.getAttribute('data-s')]||0})}
function sizeText(L){return L.map(function(l){return l.size.toUpperCase()+' &times; '+l.qty}).join(', ')}
function disc(q){return q>=12?.2:q>=6?.1:0}
function update(){
 drawGarment($('shirtCanvas').getContext('2d'),state.style,find(COLORS,state.color).hex,state.view);
 document.querySelectorAll('#styleOpts .opt,#sizeOpts .opt,#colorOpts .sw').forEach(function(b){
  var v=b.getAttribute('data-v');b.classList.toggle('active',v===state.style||v===state.color||v===state.size)});
 $('colorName').textContent=find(COLORS,state.color).name;
 var L=lines(),q=totalQty(L),sub=L.reduce(function(s,l){return s+l.unit*l.qty},0),d=disc(q),t=sub*(1-d);
 if(state.mixed)$('mixTotal').textContent='Total shirts: '+q+(q>=12?' (20% off)':q>=6?' (10% off)':q?' - order 6+ to save 10%':'');
 $('sumLines').innerHTML='<div><span>'+find(STYLES,state.style).name+', '+find(COLORS,state.color).name+'</span></div>'+
  (L.length?L.map(function(l){return '<div><span>'+l.size.toUpperCase()+': $'+l.unit.toFixed(2)+' &times; '+l.qty+'</span><span>$'+(l.unit*l.qty).toFixed(2)+'</span></div>'}).join(''):'<div><span>Pick at least one size</span></div>')+
  (state.els.front.length&&state.els.back.length?'<div><span>Front + back print</span><span>incl. $'+BACK_PRINT+'</span></div>':'')+
  (d?'<div><span>Bulk discount '+d*100+'%</span><span>-$'+(sub*d).toFixed(2)+'</span></div>':'');
 $('sumTotal').textContent='$'+t.toFixed(2);
 var hasDesign=!!(state.els.front.length||state.els.back.length);
 $('addCart').disabled=!hasDesign||!q;
 $('addCart').textContent=!hasDesign?'Add a design first':!q?'Pick at least one size':'Add to cart';
}

/* ---------- EXPORT: print file (transparent PNG) + mockup ---------- */
function drawEls(ctx,list,area,k){list.forEach(function(e){
 var src=e.type==='text'?textCanvas(e,Math.round(160*k)):(function(){var i=new Image();i.src=e.src;return i})();
 var w=e.size*area.w*k,h=w*e.ar;ctx.save();ctx.translate((area.x+e.x*area.w)*k,(area.y+e.y*area.h)*k);ctx.rotate(e.rot*Math.PI/180);
 ctx.drawImage(src,-w/2,-h/2,w,h);ctx.restore()})}
function exportSide(view,style,color){
 var list=state.els[view];if(!list.length)return null;var a=AREA[view],k=1800/a.w;
 var pf=document.createElement('canvas');pf.width=a.w*k;pf.height=a.h*k;
 drawEls(pf.getContext('2d'),list,{x:0,y:0,w:a.w,h:a.h},k);
 var mk=document.createElement('canvas');mk.width=600;mk.height=680;var mc=mk.getContext('2d');
 drawGarment(mc,style,find(COLORS,color).hex,view);drawEls(mc,list,a,1);
 return{file:pf.toDataURL('image/png'),mock:mk.toDataURL('image/png')}}
function shrink(d,max){return new Promise(function(res){var i=new Image();i.onload=function(){var s=Math.min(1,max/i.width),c=document.createElement('canvas');
 c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/png'))};i.src=d})}

/* ---------- CART ---------- */
function saveCart(){try{localStorage.setItem('ct73cart',JSON.stringify(cart))}catch(e){toast('Cart is too big to save if you leave the page')}}
async function addToCart(){
 var L=lines();if(!totalQty(L)){toast('Pick at least one size');return}
 if(!inStock(STYLES_IN_STOCK,state.style)||!inStock(COLORS_IN_STOCK,state.color)||!L.every(function(l){return inStock(SIZES_IN_STOCK,l.size)})){toast('Sorry, that option is not available at the moment');return}
 await document.fonts.ready;
 var f=exportSide('front',state.style,state.color),b=exportSide('back',state.style,state.color);
 var texts=[].concat(state.els.front,state.els.back).filter(function(e){return e.type==='text'}).map(function(e){return '"'+e.text+'" ('+e.font+')'});
 var item={id:Date.now(),style:state.style,styleName:find(STYLES,state.style).name,color:state.color,colorName:find(COLORS,state.color).name,
  size:L.length>1?'mixed':L[0].size,qty:totalQty(L),lines:L,front:!!f,back:!!b,unit:L[0].unit,
  summary:'Print: '+(f&&b?'front + back':f?'front':'back')+(texts.length?'. Text: '+texts.join(', '):''),
  files:{front:f&&f.file,back:b&&b.file},mockups:{front:f&&await shrink(f.mock,500),back:b&&await shrink(b.mock,500)},thumb:await shrink((f||b).mock,160)};
 cart.push(item);saveCart();renderCart();openCart();toast('Added to cart')}
function itemLines(i){return i.lines&&i.lines.length?i.lines:[{size:i.size,qty:i.qty,unit:i.unit}]}
function itemTotal(i){var L=itemLines(i);return L.reduce(function(s,l){return s+l.unit*l.qty},0)*(1-disc(totalQty(L)))}
function renderCart(){
 $('cartCount').textContent=cart.reduce(function(s,i){return s+i.qty},0);
 $('cartItems').innerHTML=cart.length?cart.map(function(i){return '<div class="ci"><img src="'+i.thumb+'" alt=""><div><b>'+i.styleName+'</b><br>'+i.colorName+', '+sizeText(itemLines(i))+
  '<br>'+i.summary+'<br><b>$'+itemTotal(i).toFixed(2)+'</b><br><button data-id="'+i.id+'">Remove</button></div></div>'}).join(''):'<p class="hint">Your cart is empty.</p>';
 $('cartTotal').textContent='$'+cart.reduce(function(s,i){return s+itemTotal(i)},0).toFixed(2);$('toCheckout').disabled=!cart.length}
function openCart(){$('overlay').classList.add('show');$('drawer').classList.add('show')}
function closeCart(){$('overlay').classList.remove('show');$('drawer').classList.remove('show')}
function toast(m){var t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('show')},2500)}

/* ---------- SHARE A DESIGN ---------- */
async function shareDesign(){
 if(!state.els.front.length&&!state.els.back.length){toast('Add a design first');return}
 var btn=$('shareBtn');btn.disabled=true;btn.textContent='Making your link...';
 try{
  var els={};
  for(var side of ['front','back']){els[side]=[];
   for(var e of state.els[side]){var c=JSON.parse(JSON.stringify(e));delete c.id;
    if(c.type==='img')c.src=await shrink(c.src,1600);   // keeps the link small enough to save
    els[side].push(c)}}
  var r=await fetch('/api/design',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({style:state.style,color:state.color,els:els})});
  var d=await r.json();if(!r.ok||!d.id)throw new Error(d.error||'could not save');
  var link=location.origin+location.pathname+'?design='+d.id;
  $('shareLink').value=link;$('shareBox').classList.remove('hidden');
  if(navigator.share){try{await navigator.share({title:'My CustomTshirt73 design',text:'What do you think of this shirt?',url:link});return}catch(x){}}
  copyShare();
 }catch(err){toast('Sorry, the link could not be made: '+err.message)}
 finally{btn.disabled=false;btn.textContent='Share this design'}}
function copyShare(){var i=$('shareLink');i.select();
 (navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).then(function(){toast('Link copied - paste it in a text or message')},
  function(){try{document.execCommand('copy');toast('Link copied')}catch(e){toast('Copy the link from the box')}})}
async function loadSharedDesign(){
 var id=new URLSearchParams(location.search).get('design');if(!id)return;
 try{var r=await fetch('/api/design?id='+encodeURIComponent(id));var d=await r.json();if(!r.ok)throw new Error(d.error);
  if(inStock(STYLES_IN_STOCK,d.style)&&find(STYLES,d.style))state.style=d.style;
  if(inStock(COLORS_IN_STOCK,d.color)&&find(COLORS,d.color))state.color=d.color;
  ['front','back'].forEach(function(side){(d.els[side]||[]).forEach(function(e){e.id=uid++})});
  state.els={front:d.els.front||[],back:d.els.back||[]};state.sel=null;
  var fonts={};state.els.front.concat(state.els.back).forEach(function(e){if(e.type==='text')fonts[e.font]=1});
  setView(state.els.front.length?'front':'back');
  await Promise.all(Object.keys(fonts).map(function(f){return document.fonts.load('400 40px "'+f+'"')}));renderEls();update();
  $('design').scrollIntoView({behavior:'smooth'});toast('Shared design loaded. Change anything you like, then add it to your cart.');
 }catch(e){toast('Sorry, that design link did not work')}}

/* ---------- CHECKOUT -> SQUARE ---------- */
async function submitOrder(ev){ev.preventDefault();var fd=new FormData($('coForm')),customer={};fd.forEach(function(v,k){customer[k]=String(v).trim()});
 $('payBtn').disabled=true;$('payBtn').textContent='Preparing secure checkout...';$('coMsg').textContent='';
 try{var r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({customer:customer,items:cart.map(function(i){return{style:i.style,styleName:i.styleName,colorName:i.colorName,size:i.size,qty:i.qty,lines:itemLines(i).map(function(l){return{size:l.size,qty:l.qty}}),front:i.front,back:i.back,summary:i.summary,files:i.files,mockups:i.mockups}})})});
  var d=await r.json();if(!r.ok||!d.url)throw new Error(d.error||'Checkout failed');location.href=d.url}
 catch(e){$('coMsg').textContent='Sorry, something went wrong: '+e.message+'. Please try again or email us.';$('payBtn').disabled=false;$('payBtn').textContent='Continue to secure payment'}}

/* ---------- INIT ---------- */
function setView(v){state.view=v;state.sel=null;$('vFront').classList.toggle('active',v==='front');$('vBack').classList.toggle('active',v==='back');syncPanels();update();renderEls()}
function editSel(fn){var e=selEl();if(!e)return;fn(e);renderEls();update()}
function init(){
 build();update();renderEls();renderCart();syncPanels();
 document.querySelectorAll('.tabs button').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('.tabs button').forEach(function(x){x.classList.toggle('active',x===b)});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('hidden',t.id!=='tab-'+b.getAttribute('data-tab'))})})});
 $('qMinus').onclick=function(){state.qty=Math.max(1,state.qty-1);$('qty').value=state.qty;update()};
 $('qPlus').onclick=function(){state.qty=Math.min(500,state.qty+1);$('qty').value=state.qty;update()};
 $('qty').oninput=function(){state.qty=Math.max(1,Math.min(500,parseInt(this.value)||1));update()};
 $('addText').onclick=function(){var t=$('textInput').value.trim()||'Your Name';
  addEl({type:'text',text:t,font:$('fontSel').value||'Anton',color:state.color==='white'||state.color==='sand'||state.color==='pink'?'#111111':'#ffffff',stroke:'#000000',strokeW:0,curve:0,bold:false,italic:false,size:.7});
  document.fonts.load('400 40px "'+selEl().font+'"').then(renderEls)};
 $('textInput').oninput=function(){var v=this.value;editSel(function(e){if(e.type==='text'&&v)e.text=v})};
 $('fontSel').onchange=function(){var f=this.value;document.fonts.load('400 40px "'+f+'"').then(function(){editSel(function(e){e.font=f})})};
 $('textColors').onclick=function(ev){var b=ev.target.closest('[data-v]');if(b)editSel(function(e){e.color=b.getAttribute('data-v')})};
 $('strokeColor').oninput=function(){var v=this.value;editSel(function(e){e.stroke=v})};
 $('strokeW').oninput=function(){var v=+this.value;editSel(function(e){e.strokeW=v})};
 $('curve').oninput=function(){var v=+this.value;editSel(function(e){e.curve=v})};
 $('boldBtn').onclick=function(){editSel(function(e){e.bold=!e.bold})};$('italicBtn').onclick=function(){editSel(function(e){e.italic=!e.italic})};
 $('clipGrid').onclick=function(ev){var b=ev.target.closest('button');if(!b)return;
  addEl({type:'text',text:b.textContent,font:'Inter',color:'#e8483c',stroke:'#000000',strokeW:0,curve:0,bold:false,italic:false,size:.35})};
 var dz=$('drop'),fi=$('fileIn');dz.onclick=function(){fi.click()};dz.onkeydown=function(e){if(e.key==='Enter')fi.click()};
 fi.onchange=function(){if(fi.files[0])handleFile(fi.files[0]);fi.value=''};
 ['dragover','dragenter'].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.add('drag')})});
 ['dragleave','drop'].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.remove('drag')})});
 dz.addEventListener('drop',function(e){var f=e.dataTransfer.files[0];if(f)handleFile(f)});
 $('sizeRange').oninput=function(){var v=+this.value/100;editSel(function(e){e.size=v})};
 $('rotRange').oninput=function(){var v=+this.value;editSel(function(e){e.rot=v})};
 $('centerBtn').onclick=function(){snapshot();editSel(function(e){e.x=.5})};
 $('delBtn').onclick=function(){snapshot();state.els[state.view]=els().filter(function(e){return e.id!==state.sel});state.sel=null;syncPanels();renderEls();update()};
 $('dupBtn').onclick=function(){var e=selEl();if(!e)return;var c=JSON.parse(JSON.stringify(e));c.x=Math.min(1,c.x+.05);c.y=Math.min(1,c.y+.05);addEl(c)};
 $('fwdBtn').onclick=function(){var a=els(),i=a.indexOf(selEl());if(i>-1&&i<a.length-1){snapshot();a.splice(i+1,0,a.splice(i,1)[0]);renderEls()}};
 $('backBtn2').onclick=function(){var a=els(),i=a.indexOf(selEl());if(i>0){snapshot();a.splice(i-1,0,a.splice(i,1)[0]);renderEls()}};
 $('undoBtn').onclick=function(){if(history.length){future.push(JSON.stringify(state.els));restore(history.pop())}};
 $('redoBtn').onclick=function(){if(future.length){history.push(JSON.stringify(state.els));restore(future.pop())}};
 document.addEventListener('keydown',function(e){if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  if((e.key==='Delete'||e.key==='Backspace')&&state.sel)$('delBtn').onclick();
  if((e.ctrlKey||e.metaKey)&&e.key==='z')$('undoBtn').onclick()});
 $('stage').addEventListener('pointerdown',function(e){if(e.target.id==='shirtCanvas'||e.target.id==='stage'||e.target.id==='printArea'){state.sel=null;renderEls();syncPanels()}});
 $('vFront').onclick=function(){setView('front')};$('vBack').onclick=function(){setView('back')};
 $('addCart').onclick=addToCart;$('cartOpen').onclick=openCart;$('cartClose').onclick=closeCart;$('overlay').onclick=closeCart;
 $('cartItems').onclick=function(ev){var id=ev.target.getAttribute('data-id');if(id){cart=cart.filter(function(i){return String(i.id)!==id});saveCart();renderCart()}};
 $('toCheckout').onclick=function(){if(cart.length){closeCart();$('checkout').classList.remove('hidden')}};
 $('coClose').onclick=function(){$('checkout').classList.add('hidden')};$('coForm').onsubmit=submitOrder;
 addEventListener('resize',renderEls);document.fonts.ready.then(renderEls);
 loadSharedDesign();
}
document.addEventListener('DOMContentLoaded',init);
})();
