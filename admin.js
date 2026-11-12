(function(){
var $=function(i){return document.getElementById(i)};
var pw='',cur=null;
try{pw=sessionStorage.getItem('ct73admin')||''}catch(e){}
var esc=function(s){return String(s==null?'':s).replace(/[<>&"]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]})};
function show(id){['login','list','detail'].forEach(function(s){$(s).classList.toggle('hidden',s!==id)});$('logout').classList.toggle('hidden',id==='login')}
async function api(body){body.password=pw;var r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 var d=await r.json().catch(function(){return{error:'Server error'}});if(r.status===401){logout();throw new Error('Wrong password')}if(!r.ok)throw new Error(d.error||'Something went wrong');return d}
function when(iso){try{return new Date(iso).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch(e){return iso}}
function logout(){pw='';try{sessionStorage.removeItem('ct73admin')}catch(e){}show('login')}

async function loadList(){show('list');$('reqs').innerHTML='<p class="muted">Loading...</p>';
 try{var d=await api({action:'list'});
  $('reqs').innerHTML=d.requests.length?d.requests.map(function(r){
   return '<button class="card req" data-id="'+esc(r.id)+'"><div class="row"><b style="flex:1">'+esc(r.name)+'</b>'+
    '<span class="badge '+(r.status==='quoted'?'quoted':'')+'">'+(r.status==='quoted'?'Price sent $'+Number(r.quote.price).toFixed(2):'New')+'</span></div>'+
    '<div class="muted">'+esc(r.id)+' &middot; '+when(r.created)+(r.photoCount?' &middot; '+r.photoCount+' photo(s)':'')+'</div>'+
    '<div style="margin-top:6px">'+esc(r.idea).slice(0,160)+(r.idea.length>160?'...':'')+'</div></button>'}).join(''):'<p class="muted">No design requests yet.</p>'}
 catch(e){$('reqs').innerHTML='<p class="err">'+esc(e.message)+'</p>'}}

async function openReq(id){show('detail');$('info').innerHTML='<p class="muted">Loading...</p>';$('result').classList.add('hidden');$('quoteErr').textContent='';
 try{var r=await api({action:'get',id:id});cur=r;
  $('info').innerHTML='<h3>'+esc(r.name)+' <span class="muted">'+esc(r.id)+'</span></h3>'+
   '<div class="muted">'+when(r.created)+'</div>'+
   '<p><a href="mailto:'+esc(r.email)+'">'+esc(r.email)+'</a>'+(r.phone?' &middot; <a href="tel:'+esc(r.phone)+'">'+esc(r.phone)+'</a>':'')+'</p>'+
   '<p style="white-space:pre-wrap">'+esc(r.idea)+'</p>'+
   '<p><b>Shirt:</b> '+esc(r.style)+', '+esc(r.color)+'<br><b>How many / sizes:</b> '+(esc(r.sizes)||'not given')+'<br><b>Needed by:</b> '+(esc(r.needBy)||'not given')+'</p>'+
   (r.photos&&r.photos.length?'<div class="photos">'+r.photos.map(function(p,i){return '<a href="'+p+'" download="'+esc(r.id)+'-photo'+(i+1)+'.jpg" title="Download"><img src="'+p+'" alt="Photo '+(i+1)+'"></a>'}).join('')+'</div><p class="muted">Tap a photo to download it.</p>':'')+
   (r.quote?'<p><span class="badge quoted">Price sent $'+Number(r.quote.price).toFixed(2)+' on '+when(r.quote.at)+'</span></p><div class="link-row"><input readonly value="'+esc(r.quote.link)+'"><button class="btn" data-copy>Copy link</button></div>':'');
  $('price').value=r.quote?r.quote.price:'';
  $('msg').value=r.quote?r.quote.message:'Hi '+r.name.split(' ')[0]+',\n\nThanks for your idea! Here is the price for your custom shirt. Pay securely with the link below and we will start printing.\n\nCustomTshirt73';
  $('quoteBtn').textContent=r.quote?'Make a new link and send again':'Create payment link and send'}
 catch(e){$('info').innerHTML='<p class="err">'+esc(e.message)+'</p>'}}

function mailtoFor(d,price,msg){return 'mailto:'+encodeURIComponent(d.email)+'?subject='+encodeURIComponent('Your custom shirt price - '+cur.id)+
 '&body='+encodeURIComponent(msg+'\n\nPrice: $'+Number(price).toFixed(2)+'\nPay here: '+d.link+'\n\nQuestions? Call or text 220-204-0090.')}

$('loginForm').onsubmit=async function(ev){ev.preventDefault();$('loginErr').textContent='';$('loginBtn').disabled=true;pw=$('pw').value;
 try{await api({action:'list'});try{sessionStorage.setItem('ct73admin',pw)}catch(e){}$('pw').value='';loadList()}
 catch(e){$('loginErr').textContent=e.message;show('login')}finally{$('loginBtn').disabled=false}};
$('logout').onclick=logout;$('refresh').onclick=loadList;$('back').onclick=loadList;
$('reqs').onclick=function(ev){var b=ev.target.closest('[data-id]');if(b)openReq(b.getAttribute('data-id'))};
document.addEventListener('click',function(ev){var b=ev.target.closest('[data-copy]');if(!b)return;var i=b.parentNode.querySelector('input');i.select();
 (navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).then(function(){b.textContent='Copied'},function(){try{document.execCommand('copy');b.textContent='Copied'}catch(e){}})});
$('quoteForm').onsubmit=async function(ev){ev.preventDefault();if(!cur)return;$('quoteErr').textContent='';$('quoteBtn').disabled=true;$('quoteBtn').textContent='Working...';
 var price=$('price').value,msg=$('msg').value;
 try{var d=await api({action:'quote',id:cur.id,price:price,message:msg});
  var res=$('result');res.classList.remove('hidden');res.classList.toggle('warn',!d.emailed);
  res.innerHTML=(d.emailed?'<h3>Sent!</h3><p>'+esc(d.name)+' has been emailed the price and payment link. Square will tell you when they pay.</p>':
    '<h3>Payment link ready</h3><p>The site could not email the customer by itself yet, so send it from your Gmail: press the button below, check the message, and hit Send.</p>'+
    '<a class="btn accent" href="'+mailtoFor(d,price,msg)+'">Open email to '+esc(d.name)+'</a>')+
   '<div class="link-row"><input readonly value="'+esc(d.link)+'"><button class="btn" data-copy>Copy link</button></div>'+
   '<p class="muted">You can also paste this link into a text message.</p>';
  res.scrollIntoView({behavior:'smooth'});cur.quote={price:price,link:d.link,message:msg};$('quoteBtn').textContent='Make a new link and send again'}
 catch(e){$('quoteErr').textContent=e.message;$('quoteBtn').textContent=cur&&cur.quote?'Make a new link and send again':'Create payment link and send'}
 finally{$('quoteBtn').disabled=false}};

if(pw)loadList();else show('login');
})();
