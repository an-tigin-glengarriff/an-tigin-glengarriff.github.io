/* rehost.expert — interactions. PLACEHOLDER: set the real contact address before launch. */
var CONTACT_EMAIL = 'hello@example.com';
(function(){
  var top=document.querySelector('.top');
  function onScroll(){top.classList.toggle('scrolled',window.scrollY>8);}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  // reveal on scroll
  var rv=document.querySelectorAll('.rv,.stat');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px',threshold:.08});
    rv.forEach(function(el){io.observe(el);});
  } else rv.forEach(function(el){el.classList.add('in');});

  // count-up stats
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nums=document.querySelectorAll('[data-count]');
  if(!reduce&&'IntersectionObserver' in window){
    var co=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;co.unobserve(e.target);var el=e.target,to=+el.dataset.count,t0=null;
      function step(t){if(!t0)t0=t;var p=Math.min(1,(t-t0)/1200);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step);}
      el.textContent='0';requestAnimationFrame(step);});},{threshold:.4});
    nums.forEach(function(n){co.observe(n);});
  }

  // chat bubbles appear one by one
  var chat=document.getElementById('chat');
  if(chat){var bubs=chat.querySelectorAll('.bub');
    function play(){bubs.forEach(function(b,i){setTimeout(function(){b.classList.add('in');if(!reduce&&i>0)chat.scrollTo({top:b.offsetTop-60,behavior:'smooth'});},reduce?0:400+i*1100);});}
    if('IntersectionObserver' in window&&!reduce){var po=new IntersectionObserver(function(es){if(es[0].isIntersecting){play();po.disconnect();}},{threshold:.3});po.observe(chat);}else play();}

  // tabs (food / drink)
  var tabs=[].slice.call(document.querySelectorAll('[role=tab]'));
  function sel(t){tabs.forEach(function(x){var on=x===t;x.setAttribute('aria-selected',on);x.tabIndex=on?0:-1;var p=document.getElementById(x.getAttribute('aria-controls'));p.hidden=!on;if(on)p.querySelectorAll('.rv').forEach(function(r){r.classList.add('in');});});}
  tabs.forEach(function(t,i){t.addEventListener('click',function(){sel(t);});t.addEventListener('keydown',function(e){var k=e.key,j=null;if(k==='ArrowRight')j=(i+1)%tabs.length;if(k==='ArrowLeft')j=(i-1+tabs.length)%tabs.length;if(j!==null){e.preventDefault();sel(tabs[j]);tabs[j].focus();}});});

  // ---- shared contact details: selection panel + Get in touch (one validation, one saved copy) ----
  var g=function(id){return document.getElementById(id);};
  var CKEYS=['name','biz','email','phone','site'],CKEY='rehost-contact-v1',cd={};
  try{var raw=JSON.parse(localStorage.getItem(CKEY)||'{}')||{};CKEYS.forEach(function(k){cd[k]=raw[k]||raw['f-'+k]||'';});if(!cd.site)cd.site=localStorage.getItem('rehost-site-v1')||'';}catch(e){CKEYS.forEach(function(k){cd[k]=cd[k]||'';});}
  function saveCd(){try{localStorage.setItem(CKEY,JSON.stringify(cd));}catch(e){}}
  var EMPTY={name:'Please enter your name.',biz:'Please enter your business name.',email:'Please enter your email address.',phone:'Please enter your phone number.',site:'Please enter your website address.'};
  function fieldError(k,v){v=(v||'').trim();
    if(!v)return EMPTY[k];
    if(k==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))return 'Please enter a valid email address, like you@yourbusiness.ie.';
    if(k==='phone'&&(v.replace(/\D/g,'').length<7||/[^\d\s()+.\-]/.test(v)))return 'Please enter a valid phone number, like 087 123 4567.';
    if(k==='site'&&(/\s/.test(v)||!/[a-z0-9-]\.[a-z]{2,}/i.test(v)))return 'Please enter a website address, like yourbusiness.ie.';
    return '';}
  function contactLines(v){return ['Name: '+v.name,'Business: '+v.biz,'Email: '+v.email,'Phone: '+v.phone,'Website: '+v.site];}
  var groups=[];
  function ContactGroup(pre,msgId,onChange){
    var grp={pre:pre,onChange:onChange};
    grp.show=function(k,msg){var el=g(pre+k),er=g(pre+k+'-err');if(!el)return;if(msg){el.setAttribute('aria-invalid','true');er.textContent=msg;er.hidden=false;}else{el.removeAttribute('aria-invalid');er.textContent='';er.hidden=true;}};
    grp.values=function(){var v={};CKEYS.forEach(function(k){v[k]=g(pre+k).value.trim();});return v;};
    grp.allOk=function(){return CKEYS.every(function(k){return !fieldError(k,g(pre+k).value);});};
    grp.validate=function(){var first=null;CKEYS.forEach(function(k){var m=fieldError(k,g(pre+k).value);grp.show(k,m);if(m&&!first)first=k;});
      var fm=g(msgId);if(first){fm.textContent='Please fill in all the required fields before sending.';fm.hidden=false;g(pre+first).focus();}else{fm.hidden=true;fm.textContent='';}
      return !first;};
    grp.tidy=function(k){var el=g(pre+k);if(el.getAttribute('aria-invalid')&&!fieldError(k,el.value))grp.show(k,'');if(!g(msgId).hidden&&grp.allOk())g(msgId).hidden=true;};
    CKEYS.forEach(function(k){var el=g(pre+k);el.value=cd[k]||'';
      el.addEventListener('input',function(){cd[k]=el.value;saveCd();
        groups.forEach(function(o){if(o!==grp){var x=g(o.pre+k);if(x.value!==el.value)x.value=el.value;o.tidy(k);}if(o.onChange)o.onChange();});
        grp.tidy(k);});
      el.addEventListener('blur',function(){if(el.getAttribute('aria-invalid'))grp.show(k,fieldError(k,el.value));});});
    groups.push(grp);return grp;}
  // Get in touch form
  if(g('c-form')){
    var cgrp,contactMailto=function(){var v=cgrp.values();var L=['Hello,',''].concat(contactLines(v),['','I\u2019d like a website check and a chat about what my business needs.','','Thanks']);
      return 'mailto:'+CONTACT_EMAIL+'?subject='+encodeURIComponent('Website check'+(v.biz?' \u2013 '+v.biz:''))+'&body='+encodeURIComponent(L.join('\n'));};
    cgrp=ContactGroup('c-','c-msg',function(){g('c-send').href=contactMailto();});
    g('c-send').href=contactMailto();
    g('c-send').addEventListener('click',function(e){if(!cgrp.validate()){e.preventDefault();return;}this.href=contactMailto();});
    g('c-form').addEventListener('submit',function(e){e.preventDefault();if(cgrp.validate())window.location.href=contactMailto();});
  }

  // services picker
  var rows=[].slice.call(document.querySelectorAll('.svc'));
  document.querySelectorAll('[data-contact]').forEach(function(a){a.href='mailto:'+CONTACT_EMAIL+'?subject='+encodeURIComponent(a.getAttribute('data-subject')||'Website check');});
  if(!rows.length||!document.getElementById('send'))return;
  var KEY='rehost-picks-v2',state={};
  try{state=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){state={};}
  rows.forEach(function(r){var i=r.dataset.i;if(state[i]){var inp=r.querySelector('input[value='+state[i]+']');if(inp){inp.checked=true;r.dataset.v=state[i];}}
    r.addEventListener('change',function(e){state[i]=e.target.value;r.dataset.v=e.target.value;save();render();});});
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
  var $=function(id){return document.getElementById(id);};
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  function pick(v){return rows.filter(function(r){return state[r.dataset.i]===v;});}
  function nm(r){return r.dataset.name.replace(/&amp;/g,'&');}
  function suggest(yes){
    var names=yes.map(nm),has=function(a){return a.some(function(x){return names.indexOf(x)>-1;});};
    if(!names.length)return null;
    var pkg=has(['Instagram','Facebook','Email inbox management','WhatsApp morning summary','Posts','X (Twitter)','TikTok','Google reviews','Other review sites'])?'Full service':has(['Area pages with maps','News and events page','Listings and directories','Live bookings or availability calendar'])?'Growth':'Essentials';
    var add=names.filter(function(x){return /ordering automation|SEO|AI consultation/.test(x);});
    if(add.length===names.length)pkg=null;
    return {pkg:pkg,add:add};
  }
  function render(){
    var y=pick('yes'),m=pick('maybe'),n=pick('no'),left=rows.length-y.length-m.length-n.length;
    $('c-yes').textContent=y.length;$('c-maybe').textContent=m.length;$('c-no').textContent=n.length;$('c-left').textContent=left;
    var tot=rows.length,mt=document.querySelector('.meter');
    mt.querySelector('.y').style.width=(y.length/tot*100)+'%';mt.querySelector('.m').style.width=(m.length/tot*100)+'%';mt.querySelector('.n').style.width=(n.length/tot*100)+'%';
    $('sum-sub').textContent=(y.length+m.length+n.length)?(left?left+' still to decide.':'All '+tot+' decided. Nice one.'):'Nothing picked yet. Choose Yes, Maybe or No for each service.';
    var h='';
    if(y.length)h+='<h4>Yes</h4><ul>'+y.map(function(r){return '<li>'+esc(nm(r))+'</li>';}).join('')+'</ul>';
    if(m.length)h+='<h4>Maybe</h4><ul>'+m.map(function(r){return '<li>'+esc(nm(r))+'</li>';}).join('')+'</ul>';
    $('chosen').innerHTML=h||'<p class="empty">Your Yes and Maybe picks will appear here.</p>';
    var s=suggest(y),sg=$('suggest');
    if(s){sg.hidden=false;sg.innerHTML=(s.pkg?'Closest package: <b>'+s.pkg+'</b>'+(s.add.length?' + '+s.add.length+' extra'+(s.add.length>1?'s':''):''):'<b>'+esc(s.add.join(', '))+'</b> on its own, or with any package')+'. <a href="#packages" style="color:#5eead4">See packages</a>';}else sg.hidden=true;
    $('send').href=mailto();
  }
  function mailto(){
    var v=function(id){return $(id).value.trim();},name=v('f-name'),biz=v('f-biz'),email=v('f-email'),phone=v('f-phone'),site=v('f-site');
    var L=[];L.push('Hello,','','Here are the services I\u2019m interested in.','');
    L.push.apply(L,contactLines({name:name,biz:biz,email:email,phone:phone,site:site}));L.push('');
    var groups={};rows.forEach(function(r){(groups[r.dataset.area]=groups[r.dataset.area]||[]).push(r);});
    ['yes','maybe','no'].forEach(function(v){var list=pick(v);if(!list.length)return;L.push((v==='yes'?'YES':v==='maybe'?'MAYBE':'NO')+' ('+list.length+')');list.forEach(function(r){L.push('- '+nm(r)+' ['+r.dataset.area+']');});L.push('');});
    var undec=rows.filter(function(r){return !state[r.dataset.i];});
    if(undec.length){L.push('NOT DECIDED ('+undec.length+')');undec.forEach(function(r){L.push('- '+nm(r));});L.push('');}
    var s=suggest(pick('yes'));if(s)L.push(s.pkg?'Closest package: '+s.pkg+(s.add.length?' + '+s.add.join(', '):''):'Extras only: '+s.add.join(', '),'');
    L.push('Thanks');
    var subj='Services selection'+(biz?' \u2013 '+biz:'');
    return 'mailto:'+CONTACT_EMAIL+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(L.join('\n'));
  }
  var pgrp=ContactGroup('f-','form-msg',function(){$('send').href=mailto();});
  $('send').addEventListener('click',function(e){if(!pgrp.validate()){e.preventDefault();return;}this.href=mailto();});
  $('sel-form').addEventListener('submit',function(e){e.preventDefault();if(pgrp.validate())window.location.href=mailto();});
  $('reset').addEventListener('click',function(){state={};save();rows.forEach(function(r){delete r.dataset.v;r.querySelectorAll('input').forEach(function(i){i.checked=false;});});render();});
  render();
})();
