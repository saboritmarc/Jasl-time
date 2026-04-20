var SUPABASE_URL = ‘https://fywkafpfcnqynvjdedfj.supabase.co’;
var SUPABASE_KEY = ‘eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5d2thZnBmY25xeW52amRlZGZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODY1MjQsImV4cCI6MjA4ODY2MjUyNH0.G5UDh7jrjlHkjoEMMsqPipzzIWTkvOEsbgdhd61vJiQ’;

var state = { worker:null, todaySummary:null, historyMonth:new Date(), adminMonth:new Date(), allWorkers:[], settings:{}, selectedCardWorker:null };

function hdrs() {
return { ‘Content-Type’:‘application/json’, ‘apikey’:SUPABASE_KEY, ‘Authorization’:‘Bearer ‘+SUPABASE_KEY, ‘Prefer’:‘return=representation’ };
}
async function dbGet(table,params){ params=params||’’; var r=await fetch(SUPABASE_URL+’/rest/v1/’+table+’?’+params,{headers:hdrs()}); if(!r.ok)throw await r.json(); return r.json(); }
async function dbPost(table,body){ var r=await fetch(SUPABASE_URL+’/rest/v1/’+table,{method:‘POST’,headers:hdrs(),body:JSON.stringify(body)}); if(!r.ok)throw await r.json(); return r.json(); }
async function dbPatch(table,params,body){ var r=await fetch(SUPABASE_URL+’/rest/v1/’+table+’?’+params,{method:‘PATCH’,headers:hdrs(),body:JSON.stringify(body)}); if(!r.ok)throw await r.json(); return r.json(); }
async function rpc(fn,body){ body=body||{}; var r=await fetch(SUPABASE_URL+’/rest/v1/rpc/’+fn,{method:‘POST’,headers:hdrs(),body:JSON.stringify(body)}); if(!r.ok)throw await r.json(); return r.json(); }

function showPage(pageId){ document.querySelectorAll(’.page’).forEach(function(p){p.classList.remove(‘active’);p.style.display=‘none’;}); var page=document.getElementById(‘page-’+pageId); if(page){page.style.display=‘flex’;page.classList.add(‘active’);} }

function showAdminPage(name){ var pm={workers:‘workers’,‘all-records’:‘all-records’,‘all-perms’:‘all-perms’,‘all-balances’:‘all-balances’,exports:‘exports’,cards:‘cards’,settings:‘settings’}; showPage(pm[name]||name); if(name===‘workers’)loadWorkers(); if(name===‘all-records’)loadAllRecords(); if(name===‘all-perms’){loadAllPerms();loadPendingPermsCount();} if(name===‘all-balances’)loadAllBalances(); if(name===‘exports’)loadExportWorkers(); if(name===‘cards’)loadCardsWorkers(); if(name===‘settings’){ loadSettings(); loadComputeSettings(); }
if(name===‘access-logs’){ loadAccessLogs(); } }

function switchTab(tab){ var tabs=[‘home’,‘history’,‘perms’,‘balance’,‘profile’]; document.querySelectorAll(’#worker-nav .nav-item’).forEach(function(el,i){el.classList.toggle(‘active’,tabs[i]===tab);}); var sp={home:‘worker-home’,history:‘history’,perms:‘perms’,balance:‘balance’,profile:‘profile’}; showPage(sp[tab]||‘worker-home’); var nav=document.getElementById(‘worker-nav’); var page=document.getElementById(‘page-’+(sp[tab]||‘worker-home’)); if(page)page.appendChild(nav); if(tab===‘history’)loadMonthHistory(); if(tab===‘perms’)loadMyPerms(); if(tab===‘balance’)loadMyBalance(); if(tab===‘profile’)loadProfile(); }

var clockInterval;
function startClock(){ clearInterval(clockInterval); function tick(){ var now=new Date(); document.getElementById(‘clock-time’).textContent=now.toLocaleTimeString(‘ca’,{hour:‘2-digit’,minute:‘2-digit’,second:‘2-digit’}); document.getElementById(‘clock-date’).textContent=now.toLocaleDateString(‘ca’,{weekday:‘long’,day:‘numeric’,month:‘long’,year:‘numeric’}); } tick(); clockInterval=setInterval(tick,1000); }

async function doLogin(){
var code=document.getElementById(‘login-code’).value.trim(); if(!code)return;
var btn=document.getElementById(‘login-btn’); btn.innerHTML=’<span class="loader"></span>’; btn.disabled=true;
document.getElementById(‘login-error’).classList.remove(‘show’);
try{
var worker;
try{ var res=await rpc(‘login_by_code’,{p_employee_code:code});
var raw=Array.isArray(res)?res[0]:res;
if(raw&&raw.worker_id){
worker={id:raw.worker_id,display_name:raw.display_name,role:raw.role,photo_path:raw.photo_path,employee_code:code,daily_theoretical_minutes:480};
} else {
worker=raw;
} }catch(e1){ var rows=await dbGet(‘workers’,‘employee_code=eq.’+encodeURIComponent(code)+’&is_active=eq.true&select=*’); worker=rows[0]||null; }
if(!worker||!worker.id){
var errMsg=‘Codi no trobat. Comprova que el codi sigui correcte.’;
throw new Error(errMsg);
}
state.worker=worker; afterLogin();
}catch(e){ var err=document.getElementById(‘login-error’); err.textContent=e.message||‘Error autenticacio’; err.classList.add(‘show’); }
finally{ btn.innerHTML=‘Entrar’; btn.disabled=false; }
}

async function afterLogin(){
var w=state.worker;
document.getElementById(‘home-name’).textContent=w.display_name||w.employee_code;
document.getElementById(‘home-code’).textContent=‘Codi: ‘+w.employee_code;
document.getElementById(‘profile-name’).textContent=w.display_name||w.employee_code;
document.getElementById(‘profile-code’).textContent=‘Codi: ‘+w.employee_code;
if(w.photo_path){ var url=SUPABASE_URL+’/storage/v1/object/public/worker-photos/’+w.photo_path; document.getElementById(‘home-avatar’).innerHTML=’<img src="'+url+'">’; document.getElementById(‘profile-avatar’).innerHTML=’<img src="'+url+'">’; }
if(w.role===‘ADMIN’||w.role===‘admin’||w.role===‘Admin’){
// Si login per codi (no QR) -> demanar contrasenya
if(!state._loginByQR){
var adminPwd = null;
try {
var pwdRow = await dbGet(‘app_settings’,‘setting_key=eq.admin_password&select=setting_value’);
adminPwd = pwdRow[0] ? pwdRow[0].setting_value : null;
} catch(e){}
if(adminPwd){
var entered = window.prompt(‘Contrasenya admin:’,’’);
if(entered !== adminPwd){
var errEl = document.getElementById(‘login-error’);
if(errEl){ errEl.textContent=‘Contrasenya incorrecta.’; errEl.classList.add(‘show’); }
state.worker = null;
return;
}
}
}
var adminLoginMethod = state._loginByQR ? ‘QR’ : ‘CODE’;
state._loginByQR = false;
logAccess(w.id, adminLoginMethod);
showPage(‘admin-home’); loadAdminStats(); loadWorkersForAdmin(); loadPendingPermsCount(); return;
}
var loginMethod = state._loginByQR ? ‘QR’ : ‘CODE’;
logAccess(w.id, loginMethod);
showPage(‘worker-home’); startClock(); await loadTodaySummary();
}

function generateQRSVG(text, container, size){
// Usar Google Charts API per generar QR (no usa eval)
var img = document.createElement(‘img’);
img.src = ‘https://chart.googleapis.com/chart?cht=qr&chs=’ + size + ‘x’ + size + ‘&chl=’ + encodeURIComponent(text) + ‘&choe=UTF-8’;
img.style.width = size + ‘px’;
img.style.height = size + ‘px’;
img.style.borderRadius = ‘8px’;
img.onerror = function(){
container.innerHTML = ‘<div style="width:' + size + 'px;height:' + size + 'px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:12px;text-align:center;padding:16px;font-family:monospace">’ + text + ‘</div>’;
};
container.appendChild(img);
}

function doLogout(){ state.worker=null; state.todaySummary=null; state._loginByQR=false; clearInterval(clockInterval); document.getElementById(‘login-code’).value=’’; showPage(‘splash’);

// – Gestio offline –
window.addEventListener(‘online’,  function(){ showToast(‘Connexio restaurada’,‘success’); });
window.addEventListener(‘offline’, function(){ showToast(‘Sense connexio a Internet’,‘error’); });

// – Timeout de sessio (30 min d inactivitat) –
var _sessionTimer = null;
var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minuts

function resetSessionTimer(){
clearTimeout(_sessionTimer);
if(!state.worker) return;
_sessionTimer = setTimeout(function(){
if(state.worker){
showToast(‘Sessio expirada per inactivitat’,‘error’);
setTimeout(doLogout, 2000);
}
}, SESSION_TIMEOUT);
}

document.addEventListener(‘touchstart’, resetSessionTimer);
document.addEventListener(‘click’, resetSessionTimer);
document.addEventListener(‘keypress’, resetSessionTimer); }

async function logAccess(workerId, method){
try{
await dbPost(‘access_logs’,{
worker_id: parseInt(workerId),
access_method: method,
user_agent: navigator.userAgent.substring(0,200)
});
}catch(e){ console.warn(‘logAccess failed:’, e); }
}

async function loadTodaySummary(){
if(!state.worker)return;
var today=new Date().toISOString().split(‘T’)[0];
try{
var summary;
try{ var raw=await rpc(‘get_today_summary’,{p_worker_id:parseInt(state.worker.id)}); summary=Array.isArray(raw)?raw[0]:raw; }
catch(e1){ var rows=await dbGet(‘daily_records’,‘worker_id=eq.’+state.worker.id+’&work_date=eq.’+today+’&select=*’); summary=rows[0]||{status:‘NOT_STARTED’,worked_minutes:0,theoretical_minutes:state.worker.daily_theoretical_minutes||480,balance_minutes:0}; }
state.todaySummary=summary; renderTodaySummary(summary);
}catch(e){ showToast(‘Error carregant resum del dia’,‘error’); }
}

function renderTodaySummary(s){
var status=(s&&s.status)?s.status:‘NOT_STARTED’;
var sm={NOT_STARTED:{label:‘No iniciat’,cls:‘tag-gray’},IN_PROGRESS:{label:‘En curs’,cls:‘tag-green’},PAUSED:{label:‘En pausa’,cls:‘tag-yellow’},ON_PAUSE:{label:‘En pausa’,cls:‘tag-yellow’},FINISHED:{label:‘Finalitzat’,cls:‘tag-purple’},COMPLETED:{label:‘Finalitzat’,cls:‘tag-purple’},INCIDENCE:{label:‘Incidencia’,cls:‘tag-red’},INCIDENT:{label:‘Incidencia’,cls:‘tag-red’}};
var st=sm[status]||sm[‘NOT_STARTED’];
document.getElementById(‘clock-status-tag’).innerHTML=’<span class="tag '+st.cls+'">’+st.label+’</span>’;
document.getElementById(‘stat-worked’).textContent=minsToHM(s&&s.worked_minutes?s.worked_minutes:0);
document.getElementById(‘stat-theoretical’).textContent=minsToHM(s&&s.theoretical_minutes?s.theoretical_minutes:480);
var bal=s&&s.balance_minutes?s.balance_minutes:0;
var balEl=document.getElementById(‘stat-balance’);
balEl.textContent=(bal>=0?’+’:’’)+minsToHM(bal);
balEl.style.color=bal>=0?‘var(–accent)’:‘var(–warn)’;
document.getElementById(‘btn-start’).disabled=!(status===‘NOT_STARTED’||status===‘FINISHED’||status===‘COMPLETED’);
document.getElementById(‘btn-pause’).disabled=status!==‘IN_PROGRESS’;
document.getElementById(‘btn-resume’).disabled=!(status===‘PAUSED’||status===‘ON_PAUSE’);
document.getElementById(‘btn-end’).disabled=!(status===‘IN_PROGRESS’||status===‘PAUSED’||status===‘ON_PAUSE’);
}

async function doClockAction(action){
var am={start:‘clock_start’,pause:‘clock_pause’,resume:‘clock_resume’,end:‘clock_end’};
var lm={start:‘Jornada iniciada’,pause:‘Pausa registrada’,resume:‘Jornada represa’,end:‘Jornada finalitzada’};
try{
try{
var rpcRes=await rpc(am[action],{p_worker_id:parseInt(state.worker.id)});
var rpcData=Array.isArray(rpcRes)?rpcRes[0]:rpcRes;
if(rpcData&&rpcData.new_status&&state.todaySummary){
state.todaySummary.status=rpcData.new_status;
state.todaySummary.worked_minutes=rpcData.worked_minutes||state.todaySummary.worked_minutes||0;
state.todaySummary.balance_minutes=rpcData.balance_minutes||state.todaySummary.balance_minutes||0;
renderTodaySummary(state.todaySummary);
}
}
catch(e1){
var etm={start:‘START’,pause:‘PAUSE_START’,resume:‘PAUSE_END’,end:‘END’};
var today=new Date().toISOString().split(‘T’)[0];
var pauseNum=null;
if(action===‘pause’||action===‘resume’){ var ents=await dbGet(‘time_entries’,‘worker_id=eq.’+state.worker.id+’&entry_date=eq.’+today+’&is_active=eq.true&select=pause_number&order=entry_datetime.asc’); var pauses=ents.filter(function(e){return e.pause_number!==null;}); pauseNum=action===‘pause’?(pauses.length+1):(pauses.length>0?pauses[pauses.length-1].pause_number:1); }
await dbPost(‘time_entries’,{worker_id:state.worker.id,entry_date:today,entry_datetime:new Date().toISOString(),entry_type:etm[action],pause_number:pauseNum,source_method:(state._loginByQR?‘QR’:‘CODE’),is_active:true});
try{ await rpc(‘recalculate_daily_record’,{p_worker_id:parseInt(state.worker.id),p_work_date:today}); }catch(e2){}
}
showToast(lm[action],‘success’); await loadTodaySummary();
}catch(e){ showToast((e&&e.message)?e.message:‘Error en el fitxatge’,‘error’); }
}

async function loadMonthHistory(){
var m=state.historyMonth; var y=m.getFullYear(),mo=m.getMonth()+1;
document.getElementById(‘history-month-title’).textContent=m.toLocaleDateString(‘ca’,{month:‘long’,year:‘numeric’});
var moS=String(mo).padStart(2,‘0’); var start=y+’-’+moS+’-01’; var end=y+’-’+moS+’-31’;
var el=document.getElementById(‘history-list’); el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var rows;
try{ var rawmh=await rpc(‘get_month_history’,{p_worker_id:parseInt(state.worker.id),p_year:y,p_month:mo});
if(Array.isArray(rawmh)&&rawmh.length>0&&Array.isArray(rawmh[0])) rows=rawmh[0];
else rows=rawmh; }
catch(e1){ rows=await dbGet(‘daily_records’,‘worker_id=eq.’+state.worker.id+’&work_date=gte.’+start+’&work_date=lte.’+end+’&order=work_date.asc&select=id,worker_id,work_date,status,worked_minutes,theoretical_minutes,balance_minutes,has_incidence,day_type’); }
if(!rows||!rows.length){el.innerHTML=’<div class="empty-state" style="padding:40px 20px">📅<br><br>Cap registre per a aquest mes.<br><span style="font-size:12px;color:var(--text3)">Els registres apareixeran aqui despres de fitxar.</span></div>’;return;}
el.innerHTML=rows.map(function(r){
var bal=r.balance_minutes||0;
var balCls=bal>=0?‘balance-pos’:‘balance-neg’;
var dayIcon=’’;
if(r.day_type===‘VACATION’||r.status===‘VACATION’) dayIcon=’🏖 ‘;
else if(r.day_type===‘SICK_LEAVE’||r.status===‘SICK_LEAVE’) dayIcon=’🏥 ‘;
else if(r.day_type===‘HOLIDAY’||r.status===‘HOLIDAY’) dayIcon=’📅 ‘;
else if(r.day_type===‘PAID_LEAVE’) dayIcon=’📋 ‘;
var editedBadge=r.is_edited?’<span style="font-size:9px;background:#FFF3CD;color:#856404;padding:1px 5px;border-radius:4px;margin-left:4px;font-weight:700;">EDITAT</span>’:’’;
return ‘<div class="history-row" data-date="'+r.work_date+'" onclick="loadDayDetail(this.dataset.date)">’+’<div class="history-date">’+formatDate(r.work_date)+’</div>’+
‘<div class="history-info">’+
‘<div class="history-hours">’+dayIcon+minsToHM(r.worked_minutes||0)+’ / ‘+minsToHM(r.theoretical_minutes||0)+’</div>’+
‘<div class="history-status">’+dayStatusTag(r.status)+(r.has_incidence?’ ⚠’:’’)+’’+editedBadge+’</div>’+
‘</div>’+
‘<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">’+
‘<div class="history-balance '+balCls+'">’+(bal>=0?’+’:’’)+minsToHM(bal)+’</div>’+
‘<div style="font-size:10px;color:var(--text3);">›</div>’+
‘</div></div>’; }).join(’’);
}catch(e){el.innerHTML=’<div class="empty-state">Error carregant historial</div>’;}
}

function changeMonth(dir){ var m=state.historyMonth; state.historyMonth=new Date(m.getFullYear(),m.getMonth()+dir,1); loadMonthHistory(); }

async function loadDayDetail(date){
document.getElementById(‘day-detail-title’).textContent=formatDateLong(date);
document.getElementById(‘day-summary-cards’).innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
document.getElementById(‘day-timeline’).innerHTML=’’;
showPage(‘day-detail’);
try{
var entries,record;
try{
var detail=await rpc(‘get_day_detail’,{p_worker_id:parseInt(state.worker.id),p_work_date:date});
var detailData=Array.isArray(detail)?detail[0]:detail;
if(detailData&&(detailData.entries||detailData.record)){
entries=detailData.entries||[];
record=detailData.record||{};
} else {
throw new Error(‘format unexpected’);
}
}
catch(e1){
entries=await dbGet(‘time_entries’,‘worker_id=eq.’+state.worker.id+’&entry_date=eq.’+date+’&is_active=eq.true&order=entry_datetime.asc&select=*’);
var recs=await dbGet(‘daily_records’,‘worker_id=eq.’+state.worker.id+’&work_date=eq.’+date+’&select=*’);
record=recs[0]||{};
}
var bal=record.balance_minutes||0;
document.getElementById(‘day-summary-cards’).innerHTML=’<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px"><div class="stat-box"><div class="stat-val">’+minsToHM(record.worked_minutes||0)+’</div><div class="stat-lbl">Treballat</div></div><div class="stat-box"><div class="stat-val" style="color:'+(bal>=0?'var(--accent)':'var(--warn)')+'">’+( bal>=0?’+’:’’)+minsToHM(bal)+’</div><div class="stat-lbl">Saldo</div></div></div>’+(record.status?’<div>’+dayStatusTag(record.status)+’</div>’:’’);
var tl=document.getElementById(‘day-timeline’);
if(!entries.length){tl.innerHTML=’<div class="empty-state">Cap entrada per a aquest dia</div>’;return;}
var typeL={START:‘Inici de jornada’,END:‘Final de jornada’,PAUSE_START:‘Inici pausa’,PAUSE_END:‘Fi pausa’};
tl.innerHTML=entries.map(function(e,idx){
var t=new Date(e.entry_datetime).toLocaleTimeString(‘ca’,{hour:‘2-digit’,minute:‘2-digit’});
var dc=e.entry_type===‘START’?‘start’:(e.entry_type===‘END’?‘end’:‘pause’);
var lbl=(typeL[e.entry_type]||e.entry_type)+(e.pause_number?’ ‘+e.pause_number:’’);
var durHtml=’’;
if(idx>0){
var prev=new Date(entries[idx-1].entry_datetime);
var curr=new Date(e.entry_datetime);
var diffMin=Math.round((curr-prev)/60000);
if(diffMin>0) durHtml=’<div style="font-size:11px;color:var(--text3);margin-left:2px;">+’+diffMin+‘min</div>’;
}
return ‘<div class="timeline-item"><div class="timeline-dot '+dc+'"></div><div class="timeline-time">’+t+durHtml+’</div><div class="timeline-type">’+lbl+’</div></div>’;
}).join(’’);
}catch(e){document.getElementById(‘day-summary-cards’).innerHTML=’<div class="empty-state">Error carregant detall</div>’;}
}

async function loadMyPerms(){
var el=document.getElementById(‘perms-list’); el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var rows;
try{rows=await rpc(‘get_worker_day_statuses’,{p_worker_id:parseInt(state.worker.id)});}catch(e1){rows=await dbGet(‘day_status’,‘worker_id=eq.’+state.worker.id+’&is_active=eq.true&order=start_date.desc&select=id,day_type,start_date,end_date,compute_mode,comment,approval_status,admin_note,is_active’);}
if(!rows||!rows.length){el.innerHTML=’<div class="empty-state" style="padding:40px 20px">🛡<br><br>Cap permis registrat.<br><span style="font-size:12px;color:var(--text3)">Toca + Nou per afegir una sol.licitud.</span></div>’;return;}
el.innerHTML=rows.map(function(p){
var cc=p.compute_mode===‘THEORETICAL_HOURS’?‘tag-green’:‘tag-gray’;
var cl=p.compute_mode===‘THEORETICAL_HOURS’?‘Compta’:‘No compta’;
var ch=p.comment?’<div style="color:var(--text2);font-size:12px;margin-top:6px">📝 ‘+p.comment+’</div>’:’’;
var approvalMap={
PENDING:  ‘<span class="tag tag-yellow">⏳ Pendent aprovació</span>’,
APPROVED: ‘<span class="tag tag-green">✓ Aprovada</span>’,
REJECTED: ‘<span class="tag tag-red">✗ Rebutjada</span>’,
CHANGE_REQUESTED: ‘<span class="tag tag-yellow">⚠ Canvi sol.licitat</span>’
};
var approvalTag = approvalMap[p.approval_status||‘APPROVED’]||approvalMap[‘APPROVED’];
var adminNote = (p.admin_note&&(p.approval_status===‘REJECTED’||p.approval_status===‘CHANGE_REQUESTED’))?
‘<div style="background:var(--warn-lt);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--warn);margin-top:6px;">💬 Admin: ‘+p.admin_note+’</div>’:’’;
var actions = ‘’;
if(p.approval_status===‘PENDING’||p.approval_status===‘CHANGE_REQUESTED’){
actions=’<div style="display:flex;gap:8px;margin-top:8px">’+
‘<button class="btn btn-ghost" style="padding:5px 12px;font-size:12px" onclick="editMyPerm(this.dataset.id)" data-id="'+p.id+'">✏ Editar</button>’+
‘<button class="btn btn-danger" style="padding:5px 12px;font-size:12px;background:var(--warn-lt);color:var(--warn);border:1px solid var(--warn)" onclick="deleteMyPerm(this.dataset.id)" data-id="'+p.id+'">🗑 Eliminar</button>’+
‘</div>’;
}
return ‘<div class="perm-row">’+
‘<div class="card-row">’+
‘<span style="font-weight:700;font-size:14px">’+permTypeLabel(p.day_type)+’</span>’+
approvalTag+
‘</div>’+
‘<div class="perm-dates">’+formatDateLong(p.start_date)+’ -> ‘+formatDateLong(p.end_date)+’</div>’+
‘<div style="margin-top:4px"><span class="tag '+cc+'" style="font-size:10px">’+cl+’ per al saldo</span></div>’+
adminNote+ch+actions+
‘</div>’;
}).join(’’);
}catch(e){el.innerHTML=’<div class="empty-state">Error carregant permisos</div>’;}
}

function openModal(type){
var box=document.getElementById(‘modal-box’);
if(type===‘new-perm’){
// Carreguem la config de còmput per cada tipus - async block
(async function(){
var computeDefaults = {};
try {
var cfgRows = await dbGet(‘app_settings’, ‘setting_key=like.compute_mode_*&select=setting_key,setting_value’);
cfgRows.forEach(function(r){ computeDefaults[r.setting_key.replace(‘compute_mode_’,’’)] = r.setting_value; });
} catch(e) {
computeDefaults = { VACATION:‘THEORETICAL_HOURS’, SICK_LEAVE:‘THEORETICAL_HOURS’, SICK_DAY:‘THEORETICAL_HOURS’, PAID_LEAVE:‘THEORETICAL_HOURS’, HOLIDAY:‘ZERO_HOURS’ };
}
var maxSickDays = 3;
try {
var sdRow = await dbGet(‘app_settings’, ‘setting_key=eq.max_sick_days_year&select=setting_value’);
if(sdRow[0]) maxSickDays = parseInt(sdRow[0].setting_value)||3;
} catch(e){}

```
function getComputeInfo(type){
  var mode = computeDefaults[type]||'THEORETICAL_HOURS';
  if(mode==='THEORETICAL_HOURS') return '<span style="color:var(--success);font-weight:700;">&#10003; Compta com a jornada treballada</span>';
  return '<span style="color:var(--text2);">No compta per al saldo</span>';
}
function getSickDayInfo(){
  return '<div style="background:var(--accent-lt);border:1px solid var(--accent);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--text2);margin-bottom:12px;">&#128203; M&agrave;xim <strong>'+maxSickDays+' dies per any</strong> sense justificant m&egrave;dic. L\'admin configura aquest l&iacute;mit.</div>';
}

box.innerHTML=
  '<div class="modal-title">Nou perm&iacute;s</div>'+
  '<div class="input-group">'+
    '<label class="input-label">Tipus de perm&iacute;s</label>'+
    '<select id="perm-type" class="input" onchange="updatePermComputeInfo()">'+
      '<option value="SICK_LEAVE">&#127973; Baixa m&egrave;dica (amb justificant)</option>'+
      '<option value="SICK_DAY">&#129298; Malaltia domicili&agrave;ria (sense justificant)</option>'+
      '<option value="PAID_LEAVE">&#128203; Perm&iacute;s legal retribu&iuml;t</option>'+
      '<option value="HOLIDAY">&#128197; Festiu</option>'+
    '</select>'+
  '</div>'+
  '<div id="perm-compute-info" style="margin-bottom:12px;font-size:13px;">'+getComputeInfo('SICK_LEAVE')+'</div>'+
  '<div id="perm-sick-day-info" style="display:none">'+getSickDayInfo()+'</div>'+
  '<div class="flex-gap">'+
    '<div class="input-group" style="flex:1"><label class="input-label">Inici</label><input type="date" id="perm-start" class="input"></div>'+
    '<div class="input-group" style="flex:1"><label class="input-label">Fi</label><input type="date" id="perm-end" class="input"></div>'+
  '</div>'+
  '<div class="input-group">'+
    '<label class="input-label">Comentari (opcional)</label>'+
    '<textarea id="perm-comment" class="input" placeholder="Descripci&oacute;..."></textarea>'+
  '</div>'+
  '<div class="modal-actions">'+
    '<button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancel.lar</button>'+
    '<button class="btn btn-primary" style="flex:1" onclick="savePerm()">Guardar</button>'+
  '</div>';

window._computeDefaults = computeDefaults;
window._maxSickDays = maxSickDays;
window.updatePermComputeInfo = function(){
  var type = document.getElementById('perm-type').value;
  var infoEl = document.getElementById('perm-compute-info');
  var sickEl = document.getElementById('perm-sick-day-info');
  if(infoEl) infoEl.innerHTML = getComputeInfo(type);
  if(sickEl) sickEl.style.display = (type==='SICK_DAY')?'block':'none';
};
})(); // end async IIFE
```

}else if(type===‘qr-view’){
box.innerHTML=’<div class="modal-title" style="text-align:center">El meu QR</div><div class="qr-wrap"><div id="qr-render"></div><div style="text-align:center;color:var(--text2);font-size:13px">’+(state.worker.qr_token||state.worker.employee_code)+’</div></div><button class="btn btn-ghost btn-full" onclick="closeModal()">Tancar</button>’;
document.getElementById(‘modal-overlay’).classList.add(‘open’);
setTimeout(function(){
var token = state.worker.qr_token||state.worker.employee_code||’’;
var el = document.getElementById(‘qr-render’);
el.innerHTML = ‘’;
// Generar QR SVG manualment sense llibreries externes (compatible Lockdown)
generateQRSVG(token, el, 200);
},100);
return;
}
document.getElementById(‘modal-overlay’).classList.add(‘open’);
}

async function savePerm(){
var type=document.getElementById(‘perm-type’).value; var start=document.getElementById(‘perm-start’).value; var end=document.getElementById(‘perm-end’).value; var comment=document.getElementById(‘perm-comment’).value;
if(!start||!end){showToast(‘Dates obligatories’,‘error’);return;}
if(end<start){showToast(‘La data de fi no pot ser anterior a l'inici’,‘error’);return;}
var today=new Date().toISOString().split(‘T’)[0];
if(start<today&&type!==‘SICK_LEAVE’){showToast(‘No pots registrar permisos en dates passades’,‘error’);return;}
try{
var computeMode = (window._computeDefaults&&window.*computeDefaults[type])||‘THEORETICAL_HOURS’;
// Comprovar si requereix aprovació
var requiresApproval = false;
try {
var reqRow = await dbGet(‘app_settings’,’setting_key=eq.requires_approval*’+type+’&select=setting_value’);
requiresApproval = reqRow[0] && reqRow[0].setting_value === ‘true’;
} catch(e){}
var approvalStatus = requiresApproval ? ‘PENDING’ : ‘APPROVED’;

```
try{
  await rpc('create_day_status',{p_worker_id:parseInt(state.worker.id),p_day_type:type,p_start_date:start,p_end_date:end,p_comment:comment,p_compute_mode:computeMode});
  // Update approval_status after creation
  var newPerms = await dbGet('day_status','worker_id=eq.'+state.worker.id+'&day_type=eq.'+type+'&start_date=eq.'+start+'&select=id&order=id.desc&limit=1');
  if(newPerms[0]) await dbPatch('day_status','id=eq.'+newPerms[0].id,{approval_status:approvalStatus});
}
catch(e1){
  await dbPost('day_status',{worker_id:state.worker.id,day_type:type,start_date:start,end_date:end,compute_mode:computeMode,comment:comment,is_active:true,approval_status:approvalStatus});
}
closeModal();
var msg = requiresApproval ? 'Sol.licitud enviada - pendent d\'aprovacio' : 'Permis creat';
showToast(msg,'success');
// Notificacio email si cal
if(requiresApproval){
  try{
    var emailRow=await dbGet('app_settings','setting_key=eq.admin_email&select=setting_value');
    var notifyRow=await dbGet('app_settings','setting_key=eq.notify_email_on_perm&select=setting_value');
    if(emailRow[0]&&notifyRow[0]&&notifyRow[0].setting_value==='true'){
      fetch(SUPABASE_URL+'/functions/v1/notify-perm-request',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPABASE_KEY},
        body:JSON.stringify({
          worker_name:state.worker.display_name||state.worker.employee_code,
          perm_type:type, start_date:start, end_date:end,
          admin_email:emailRow[0].setting_value
        })
      }).catch(function(){});
    }
  }catch(e){}
}
loadMyPerms();
```

}catch(e){showToast((e&&e.message)?e.message:‘Error creant permis’,‘error’);}
}

function closeModal(){document.getElementById(‘modal-overlay’).classList.remove(‘open’);}

async function deleteMyPerm(id){
if(!confirm(‘Segur que vols eliminar aquesta sol.licitud?’)) return;
try{
await dbPatch(‘day_status’,‘id=eq.’+id,{is_active:false});
showToast(‘Sol.licitud eliminada’,‘success’);
loadMyPerms();
}catch(e){showToast(‘Error eliminant’,‘error’);}
}

async function editMyPerm(id){
var rows = await dbGet(‘day_status’,‘id=eq.’+id+’&select=*’);
var p = rows[0]; if(!p) return;
var box = document.getElementById(‘modal-box’);
box.innerHTML=
‘<div class="modal-title">Editar sol.licitud</div>’+
‘<div class="input-group"><label class="input-label">Comentari / justificació</label>’+
‘<textarea id="edit-perm-comment" class="input" style="min-height:80px">’+( p.comment||’’)+’</textarea></div>’+
‘<div class="flex-gap">’+
‘<div class="input-group" style="flex:1"><label class="input-label">Inici</label><input type="date" id="edit-perm-start" class="input" value="'+p.start_date+'"></div>’+
‘<div class="input-group" style="flex:1"><label class="input-label">Fi</label><input type="date" id="edit-perm-end" class="input" value="'+p.end_date+'"></div>’+
‘</div>’+
‘<div class="modal-actions">’+
‘<button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancel.lar</button>’+
‘<button class="btn btn-primary" style="flex:1" onclick="saveEditPerm(this.dataset.id)" data-id="'+id+'">Guardar</button>’+
‘</div>’;
document.getElementById(‘modal-overlay’).classList.add(‘open’);
}

async function saveEditPerm(id){
var comment = document.getElementById(‘edit-perm-comment’).value;
var start = document.getElementById(‘edit-perm-start’).value;
var end = document.getElementById(‘edit-perm-end’).value;
if(!start||!end){showToast(‘Dates obligatories’,‘error’);return;}
if(end<start){showToast(‘La data de fi no pot ser anterior a l'inici’,‘error’);return;}
var today=new Date().toISOString().split(‘T’)[0];
if(start<today&&type!==‘SICK_LEAVE’){showToast(‘No pots registrar permisos en dates passades’,‘error’);return;}
try{
await dbPatch(‘day_status’,‘id=eq.’+id,{comment:comment,start_date:start,end_date:end,approval_status:‘PENDING’});
closeModal();
showToast(‘Sol.licitud actualitzada - pendent d'aprovacio’,‘success’);
loadMyPerms();
}catch(e){showToast(‘Error actualitzant’,‘error’);}
}
function closeModalOutside(e){if(e.target===document.getElementById(‘modal-overlay’))closeModal();}

async function loadMyBalance(){
var el=document.getElementById(‘balance-content’);
el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var data;
try{ var rawbal=await rpc(‘get_worker_balance’,{p_worker_id:parseInt(state.worker.id)}); data=Array.isArray(rawbal)?rawbal[0]:rawbal; }
catch(e1){
var now=new Date(); var yr=now.getFullYear();
var moS=String(now.getMonth()+1).padStart(2,‘0’);
var rows=await dbGet(‘daily_records’,‘worker_id=eq.’+state.worker.id+’&work_date=gte.’+yr+’-01-01&select=balance_minutes,worked_minutes,theoretical_minutes,work_date,status&order=work_date.asc’);
var total=rows.reduce(function(a,r){return a+(r.balance_minutes||0);},0);
var month=rows.filter(function(r){return r.work_date.startsWith(yr+’-’+moS);}).reduce(function(a,r){return a+(r.balance_minutes||0);},0);
var totalWorked=rows.reduce(function(a,r){return a+(r.worked_minutes||0);},0);
var totalTheoretical=rows.reduce(function(a,r){return a+(r.theoretical_minutes||0);},0);
// Agrupar per mes per al grafic
var byMonth={};
rows.forEach(function(r){
var m=r.work_date.substring(0,7);
if(!byMonth[m]) byMonth[m]={bal:0,worked:0,theoretical:0};
byMonth[m].bal+=(r.balance_minutes||0);
byMonth[m].worked+=(r.worked_minutes||0);
byMonth[m].theoretical+=(r.theoretical_minutes||0);
});
data={annual_balance:total,monthly_balance:month,total_worked:totalWorked,total_theoretical:totalTheoretical,by_month:byMonth};
}
var ab=data.annual_balance||0;
var mb=data.monthly_balance||0;
var tw=data.total_worked||0;
var tt=data.total_theoretical||0;
var byMonth=data.by_month||{};
var monthNames=[‘Gen’,‘Feb’,‘Mar’,‘Abr’,‘Mai’,‘Jun’,‘Jul’,‘Ago’,‘Set’,‘Oct’,‘Nov’,‘Des’];

```
// Calcular grafic de barres
var yr=new Date().getFullYear();
var months=[];
for(var m=1;m<=12;m++){
  var key=yr+'-'+String(m).padStart(2,'0');
  months.push({key:key,label:monthNames[m-1],bal:(byMonth[key]&&byMonth[key].bal)||0});
}
var maxAbs=Math.max.apply(null,months.map(function(m){return Math.abs(m.bal);}));
if(maxAbs===0) maxAbs=480;

var chartBars=months.map(function(m){
  var pct=Math.round(Math.abs(m.bal)/maxAbs*100);
  var isPos=m.bal>=0;
  var color=isPos?'var(--success)':'var(--warn)';
  var sign=isPos?'+':'';
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">'+
    '<div style="font-size:9px;color:var(--text3);font-weight:600">'+sign+minsToHM(m.bal)+'</div>'+
    '<div style="width:100%;background:var(--surface2);border-radius:4px;height:80px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden">'+
      '<div style="width:70%;background:'+color+';border-radius:3px 3px 0 0;height:'+pct+'%;min-height:2px;transition:height .3s"></div>'+
    '</div>'+
    '<div style="font-size:9px;color:var(--text2);font-weight:700">'+m.label+'</div>'+
  '</div>';
}).join('');

el.innerHTML=
  // Resum anual i mensual
  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">'+
    '<div class="card" style="text-align:center">'+
      '<div class="stat-lbl">Saldo mensual</div>'+
      '<div style="font-family:var(--mono);font-size:32px;font-weight:800;margin-top:8px;color:'+(mb>=0?'var(--success)':'var(--warn)')+'">'+( mb>=0?'+':'')+minsToHM(mb)+'</div>'+
    '</div>'+
    '<div class="card" style="text-align:center">'+
      '<div class="stat-lbl">Saldo anual</div>'+
      '<div style="font-family:var(--mono);font-size:32px;font-weight:800;margin-top:8px;color:'+(ab>=0?'var(--success)':'var(--warn)')+'">'+( ab>=0?'+':'')+minsToHM(ab)+'</div>'+
    '</div>'+
  '</div>'+
  // Progress treballat vs teorico
  '<div class="card" style="margin-bottom:20px">'+
    '<div class="section-title" style="margin-top:0">Hores treballades vs teoriques</div>'+
    '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">'+
      '<span>Treballades: <strong>'+minsToHM(tw)+'h</strong></span>'+
      '<span>Teoriques: <strong>'+minsToHM(tt)+'h</strong></span>'+
    '</div>'+
    '<div style="background:var(--surface2);border-radius:6px;height:10px;overflow:hidden">'+
      '<div style="height:100%;background:var(--accent);border-radius:6px;width:'+Math.min(100,tt>0?Math.round(tw/tt*100):0)+'%;transition:width .5s"></div>'+
    '</div>'+
    '<div style="text-align:right;font-size:12px;color:var(--text2);margin-top:4px">'+( tt>0?Math.round(tw/tt*100):0)+'%</div>'+
  '</div>'+
  // Grafic mensual
  '<div class="card">'+
    '<div class="section-title" style="margin-top:0">Saldo mensual '+yr+'</div>'+
    '<div style="display:flex;gap:4px;align-items:flex-end;padding:8px 0">'+chartBars+'</div>'+
    '<div style="display:flex;gap:16px;font-size:11px;margin-top:8px">'+
      '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--success);border-radius:2px;display:inline-block"></span>Positiu</span>'+
      '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--warn);border-radius:2px;display:inline-block"></span>Negatiu</span>'+
    '</div>'+
  '</div>';
```

}catch(e){el.innerHTML=’<div class="empty-state">Error carregant saldo</div>’;}
}

async function uploadPhoto(event){
var file=event.target.files[0]; if(!file||!state.worker)return;
var ext=file.name.split(’.’).pop(); var path=state.worker.id+’.’+ext;
try{
var r=await fetch(SUPABASE_URL+’/storage/v1/object/worker-photos/’+path,{method:‘POST’,headers:{‘apikey’:SUPABASE_KEY,‘Authorization’:‘Bearer ‘+SUPABASE_KEY,‘Content-Type’:file.type,‘x-upsert’:‘true’},body:file});
if(!r.ok)throw new Error(‘Error pujant foto’);
await dbPatch(‘workers’,‘id=eq.’+state.worker.id,{photo_path:path}); state.worker.photo_path=path;
var url=SUPABASE_URL+’/storage/v1/object/public/worker-photos/’+path;
document.getElementById(‘profile-avatar’).innerHTML=’<img src="'+url+'">’;
document.getElementById(‘home-avatar’).innerHTML=’<img src="'+url+'">’;
showToast(‘Foto actualitzada’,‘success’);
}catch(e){showToast(e.message||‘Error’,‘error’);}
}

async function loadPendingPermsCount(){
try{
var pending = await dbGet(‘day_status’,‘approval_status=eq.PENDING&is_active=eq.true&select=id’);
var count = pending.length;
var badge = document.getElementById(‘pending-perms-badge’);
if(badge){
badge.textContent = count > 0 ? count : ‘’;
badge.style.display = count > 0 ? ‘flex’ : ‘none’;
}
// Mostrar avís al dashboard
var alertEl = document.getElementById(‘admin-perms-alert’);
if(alertEl){
if(count > 0){
var pendingText = count + (count>1?’ permisos pendents’:’ permis pendent’) + ’ d'aprovacio’;
alertEl.innerHTML = ‘<div style="background:var(--accent-lt);border:1px solid var(--accent);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="showAdminPage(this.dataset.page)" data-page="all-perms">’+
‘<div><div style="font-weight:700;color:var(--accent)">’+pendingText+’</div>’+
‘<div style="font-size:12px;color:var(--text2);margin-top:2px">Toca per revisar-los</div></div>’+
‘<div style="font-size:20px">›</div>’+
‘</div>’;
alertEl.style.display=‘block’;
} else {
alertEl.style.display=‘none’;
}
}
}catch(e){}
}

async function loadAdminStats(){
var el=document.getElementById(‘admin-stats’);
try{
var data;
try{ var raw3=await rpc(‘get_admin_dashboard_summary’,{}); data=Array.isArray(raw3)?raw3[0]:raw3; }
catch(e1){ var today=new Date().toISOString().split(‘T’)[0]; var ws=await dbGet(‘workers’,‘is_active=eq.true&select=id’); var ip=await dbGet(‘daily_records’,‘work_date=eq.’+today+’&status=eq.IN_PROGRESS&select=id’); var inc=await dbGet(‘daily_records’,‘work_date=eq.’+today+’&has_incidence=eq.true&select=id’); var fin=await dbGet(‘daily_records’,‘work_date=eq.’+today+’&status=eq.FINISHED&select=id’); data={total_workers:ws.length,in_progress_today:ip.length,incidences_today:inc.length,finished_today:fin.length}; }
el.innerHTML=’<div class="admin-stat"><div class="admin-stat-val">’+(data.total_workers||0)+’</div><div class="admin-stat-lbl">Treballadors actius</div></div><div class="admin-stat"><div class="admin-stat-val" style="color:var(--accent)">’+(data.in_progress_today||0)+’</div><div class="admin-stat-lbl">En curs avui</div></div><div class="admin-stat"><div class="admin-stat-val" style="color:var(--warn)">’+(data.incidences_today||0)+’</div><div class="admin-stat-lbl">Incidencies</div></div><div class="admin-stat"><div class="admin-stat-val" style="color:var(--accent2)">’+(data.finished_today||0)+’</div><div class="admin-stat-lbl">Finalitzats</div></div>’;
}catch(e){el.innerHTML=’<div style="color:var(--text2);font-size:13px">Error estadistiques</div>’;}
}

async function loadWorkersForAdmin(){ try{state.allWorkers=await dbGet(‘workers’,‘is_active=eq.true&order=display_name.asc&select=*’);}catch(e){} }

function workerAvatar(w){ return w.photo_path?’<img src="'+SUPABASE_URL+'/storage/v1/object/public/worker-photos/'+w.photo_path+'">’:’👤’; }

async function loadWorkers(){
var el=document.getElementById(‘workers-list’); el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var rows=state.allWorkers.length?state.allWorkers:await dbGet(‘workers’,‘order=display_name.asc&select=*’);
if(!rows.length){el.innerHTML=’<div class="empty-state">Cap treballador</div>’;return;}
el.innerHTML=rows.map(function(w){ var tc=w.is_active?‘tag-green’:‘tag-gray’; var tl=w.is_active?‘Actiu’:‘Inactiu’; return ‘<div class="worker-item"><div class="worker-avatar-sm">’+workerAvatar(w)+’</div><div style="flex:1"><div style="font-weight:700;font-size:14px">’+(w.display_name||w.employee_code)+’</div><div style="color:var(--text2);font-size:12px">’+w.employee_code+’ · ‘+w.role+’</div></div><span class="tag '+tc+'">’+tl+’</span></div>’; }).join(’’);
}catch(e){el.innerHTML=’<div class="empty-state">Error carregant treballadors</div>’;}
}

async function loadAllRecords(){
var m=state.adminMonth; var y=m.getFullYear(),mo=m.getMonth()+1;
document.getElementById(‘admin-month-title’).textContent=m.toLocaleDateString(‘ca’,{month:‘long’,year:‘numeric’});
var moS=String(mo).padStart(2,‘0’); var start=y+’-’+moS+’-01’; var end=y+’-’+moS+’-31’;
var el=document.getElementById(‘all-records-list’); el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var rows;
try{rows=await rpc(‘get_all_daily_records’,{p_year:y,p_month:mo});}catch(e1){rows=await dbGet(‘daily_records’,‘work_date=gte.’+start+’&work_date=lte.’+end+’&order=work_date.desc&select=*,workers(display_name,employee_code)’);}
if(!rows||!rows.length){el.innerHTML=’<div class="empty-state" style="padding:40px 20px">📅<br><br>Cap registre per a aquest mes.<br><span style="font-size:12px;color:var(--text3)">Els registres apareixeran aqui despres de fitxar.</span></div>’;return;}
el.innerHTML=rows.map(function(r){ var name=(r.workers&&r.workers.display_name)?r.workers.display_name:r.worker_id; var bal=r.balance_minutes||0; var bc=bal>=0?‘balance-pos’:‘balance-neg’; return ‘<div class="history-row"><div class="history-date" style="width:80px;font-size:11px">’+formatDate(r.work_date)+’</div><div class="history-info"><div class="history-hours" style="font-size:13px">’+name+’</div><div class="history-status">’+dayStatusTag(r.status)+’ ‘+minsToHM(r.worked_minutes||0)+’</div></div><div class="history-balance '+bc+'">’+(bal>=0?’+’:’’)+minsToHM(bal)+’</div></div>’; }).join(’’);
}catch(e){el.innerHTML=’<div class="empty-state">Error</div>’;}
}

function changeAdminMonth(dir){ var m=state.adminMonth; state.adminMonth=new Date(m.getFullYear(),m.getMonth()+dir,1); loadAllRecords(); }

async function loadAllPerms(){
var el=document.getElementById(‘all-perms-list’); el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var rows;
try{rows=await rpc(‘get_all_day_statuses’,{});}catch(e1){rows=await dbGet(‘day_status’,‘is_active=eq.true&order=approval_status.asc,start_date.desc&select=*,workers(display_name,employee_code)’);}
if(!rows||!rows.length){el.innerHTML=’<div class="empty-state">Cap permis</div>’;return;}
el.innerHTML=rows.map(function(p){
var name2=(p.workers&&p.workers.display_name)?p.workers.display_name:p.worker_id;
var aStatus=p.approval_status||‘APPROVED’;
var approvalColors={PENDING:‘tag-yellow’,APPROVED:‘tag-green’,REJECTED:‘tag-red’,CHANGE_REQUESTED:‘tag-yellow’};
var approvalLabels={PENDING:‘Pendent’,APPROVED:‘Aprovada’,REJECTED:‘Rebutjada’,CHANGE_REQUESTED:‘Canvi sol.licitat’};
var approvalTag=’<span class="tag '+( approvalColors[aStatus]||'tag-gray')+'">’+( approvalLabels[aStatus]||aStatus)+’</span>’;
var isPending=(aStatus===‘PENDING’);
var adminActions=isPending?
‘<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">’+
‘<button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="approveAdminPerm(this.dataset.id,this.dataset.status)" data-status="APPROVED" data-id="'+p.id+'">Aprovar</button>’+
‘<button class="btn btn-ghost" style="padding:5px 12px;font-size:12px" onclick="requestAdminPermChange(this.dataset.id)" data-id="'+p.id+'">Sol.licitar canvi</button>’+
‘<button class="btn btn-ghost" style="padding:5px 12px;font-size:12px;color:var(--warn);border-color:var(--warn)" onclick="approveAdminPerm(this.dataset.id,this.dataset.status)" data-status="REJECTED" data-id="'+p.id+'">Rebutjar</button>’+
‘</div>’:
‘<div style="margin-top:6px"><button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="togglePermCompute(this.dataset.id,this.dataset.mode)" data-id="'+p.id+'" data-mode="'+p.compute_mode+'">Canviar comput</button></div>’;
var noteHtml=(p.admin_note&&(aStatus===‘REJECTED’||aStatus===‘CHANGE_REQUESTED’))?
‘<div style="background:var(--warn-lt);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--warn);margin-top:6px;">Admin: ‘+p.admin_note+’</div>’:’’;
return ‘<div class="perm-row">’+
‘<div class="card-row">’+
‘<div><span style="font-weight:700;font-size:14px">’+name2+’</span>’+
‘<div style="font-size:12px;color:var(--text2);margin-top:1px">’+permTypeLabel(p.day_type)+’</div></div>’+
approvalTag+
‘</div>’+
‘<div class="perm-dates">’+p.start_date+’ - ‘+p.end_date+’</div>’+
(p.comment?’<div style="font-size:12px;color:var(--text2);margin-top:4px">’+p.comment+’</div>’:’’)+
noteHtml+adminActions+
‘</div>’;
}).join(’’);
}catch(e){el.innerHTML=’<div class="empty-state">Error</div>’;}
}

async function approveAdminPerm(id, newStatus){
try{
await dbPatch(‘day_status’,‘id=eq.’+id,{
approval_status: newStatus,
approved_by_worker_id: state.worker ? state.worker.id : null,
approved_at: new Date().toISOString()
});
var msg = newStatus===‘APPROVED’?‘Permis aprovat’:newStatus===‘REJECTED’?‘Permis rebutjat’:‘Actualitzat’;
showToast(msg,‘success’);
loadAllPerms();
}catch(e){showToast(‘Error’,‘error’);}
}

async function requestAdminPermChange(id){
var note = window.prompt(‘Indica el motiu o el canvi necessari:’,’’);
if(note===null) return;
try{
await dbPatch(‘day_status’,‘id=eq.’+id,{
approval_status:‘CHANGE_REQUESTED’,
admin_note: note||‘Canvi necessari’
});
showToast(‘Canvi sol.licitat al treballador’,‘success’);
loadAllPerms();
}catch(e){showToast(‘Error’,‘error’);}
}

async function togglePermCompute(id,current){ var next=current===‘THEORETICAL_HOURS’?‘ZERO_HOURS’:‘THEORETICAL_HOURS’; try{ try{await rpc(‘set_day_status_compute_mode’,{p_id:id,p_compute_mode:next});}catch(e1){await dbPatch(‘day_status’,‘id=eq.’+id,{compute_mode:next});} showToast(‘Comput actualitzat’,‘success’); loadAllPerms(); }catch(e){showToast(‘Error’,‘error’);} }

async function loadAllBalances(){
var el=document.getElementById(‘all-balances-list’); el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var rows;
try{rows=await rpc(‘get_all_balances’,{});}
catch(e1){ var workers=await dbGet(‘workers’,‘is_active=eq.true&select=id,display_name,employee_code’); var now=new Date(); rows=await Promise.all(workers.map(async function(w){ var recs=await dbGet(‘daily_records’,‘worker_id=eq.’+w.id+’&work_date=gte.’+now.getFullYear()+’-01-01&select=balance_minutes’); return Object.assign({},w,{annual_balance:recs.reduce(function(a,r){return a+(r.balance_minutes||0);},0)}); })); }
if(!rows||!rows.length){el.innerHTML=’<div class="empty-state">Sense dades</div>’;return;}
var totalBal=rows.reduce(function(a,w){return a+(w.annual_balance||0);},0);
var posCount=rows.filter(function(w){return (w.annual_balance||0)>=0;}).length;
var negCount=rows.length-posCount;
var summaryHtml=’<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">’+
‘<div class="stat-box"><div class="stat-val" style="color:'+(totalBal>=0?'var(--success)':'var(--warn)')+'">’+(totalBal>=0?’+’:’’)+minsToHM(totalBal)+’</div><div class="stat-lbl">Saldo total empresa</div></div>’+
‘<div class="stat-box"><div class="stat-val" style="color:var(--success)">’+posCount+’</div><div class="stat-lbl">En positiu</div></div>’+
‘<div class="stat-box"><div class="stat-val" style="color:var(--warn)">’+negCount+’</div><div class="stat-lbl">En negatiu</div></div>’+
‘</div>’;
el.innerHTML=summaryHtml+rows.map(function(w){ var b=w.annual_balance||0; var bc=b>=0?‘var(–success)’:‘var(–warn)’; return ‘<div class="history-row"><div style="flex:1"><div style="font-weight:700;font-size:14px">’+(w.display_name||w.employee_code)+’</div><div style="color:var(--text2);font-size:12px">’+(w.employee_code||’’)+’</div></div><div style="font-family:var(--mono);font-size:16px;font-weight:500;color:'+bc+'">’+(b>=0?’+’:’’)+minsToHM(b)+’</div></div>’; }).join(’’);
}catch(e){el.innerHTML=’<div class="empty-state">Error</div>’;}
}

async function adminClockAction(action){
// Seleccionar worker per fitxar
var workers = state.allWorkers.length ? state.allWorkers : await dbGet(‘workers’,‘is_active=eq.true&order=display_name.asc&select=*’);
var box = document.getElementById(‘modal-box’);
var opts = workers.map(function(w){
return ‘<option value="'+w.id+'">’+( w.display_name||w.employee_code)+’</option>’;
}).join(’’);
var actionLabels={start:‘Iniciar jornada’,pause:‘Pausar jornada’,resume:‘Reprendre jornada’,end:‘Finalitzar jornada’};
box.innerHTML=
‘<div class="modal-title">’+( actionLabels[action]||action)+’</div>’+
‘<div class="input-group"><label class="input-label">Treballador</label>’+
‘<select id="admin-clock-worker" class="input">’+opts+’</select></div>’+
‘<div class="modal-actions">’+
‘<button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancel.lar</button>’+
‘<button class="btn btn-primary" style="flex:1" onclick="doAdminClockAction(this.dataset.action)" data-action="'+action+'">Confirmar</button>’+
‘</div>’;
document.getElementById(‘modal-overlay’).classList.add(‘open’);
}

async function doAdminClockAction(action){
var workerId = parseInt(document.getElementById(‘admin-clock-worker’).value);
var actionMap={start:‘clock_start’,pause:‘clock_pause’,resume:‘clock_resume’,end:‘clock_end’};
var labelMap={start:‘Jornada iniciada’,pause:‘Pausa registrada’,resume:‘Jornada represa’,end:‘Jornada finalitzada’};
try{
try{
await rpc(actionMap[action],{p_worker_id:workerId});
}catch(e1){
var etm={start:‘START’,pause:‘PAUSE_START’,resume:‘PAUSE_END’,end:‘END’};
var today=new Date().toISOString().split(‘T’)[0];
await dbPost(‘time_entries’,{worker_id:workerId,entry_date:today,entry_datetime:new Date().toISOString(),entry_type:etm[action],source_method:‘CODE’,is_active:true});
try{ await rpc(‘recalculate_daily_record’,{p_worker_id:workerId,p_work_date:today}); }catch(e2){}
}
closeModal();
showToast(labelMap[action],‘success’);
loadAdminStats();
}catch(e){showToast((e&&e.message)?e.message:‘Error en el fitxatge’,‘error’);}
}

async function loadExportWorkers(){
var sel=document.getElementById(‘export-worker-select’);
var ws=state.allWorkers.length?state.allWorkers:await dbGet(‘workers’,‘is_active=eq.true&select=*’).catch(function(){return[];});
var opts=’<option value="">Selecciona treballador</option>’;
ws.forEach(function(w){ opts+=’<option value="'+w.id+'">’+(w.display_name||w.employee_code)+’</option>’; });
sel.innerHTML=opts;
}

async function callExport(type){
try{
if(type===‘individual’){
var wId=document.getElementById(‘export-worker-select’).value;
var month=parseInt(document.getElementById(‘export-month’).value);
var year=parseInt(document.getElementById(‘export-year’).value);
if(!wId){ showToast(‘Selecciona un treballador’,‘error’); return; }
showToast(‘Generant Excel…’,‘success’);
await generateWorkerExcel(wId, month, year);
} else {
showToast(‘Generant ZIP…’,‘success’);
await generateAllWorkersExcel();
}
}catch(e){ showToast(’Error: ’+(e.message||‘desconegut’),‘error’); }
}

async function generateWorkerExcel(workerId, month, year){
// Carregar worker info
var workers = state.allWorkers.length ? state.allWorkers : await dbGet(‘workers’,‘is_active=eq.true&select=*’);
var worker = workers.find(function(w){ return String(w.id)===String(workerId); });
if(!worker) throw new Error(‘Treballador no trobat’);

var moS = String(month).padStart(2,‘0’);
var startDate = year+’-’+moS+’-01’;
var endDate = year+’-’+moS+’-31’;

// Carregar registres del mes
var records = await dbGet(‘daily_records’,
‘worker_id=eq.’+workerId+’&work_date=gte.’+startDate+’&work_date=lte.’+endDate+
‘&order=work_date.asc&select=*’);

// Carregar time_entries del mes per tenir hores exactes
var entries = await dbGet(‘time_entries’,
‘worker_id=eq.’+workerId+’&entry_date=gte.’+startDate+’&entry_date=lte.’+endDate+
‘&is_active=eq.true&order=entry_datetime.asc&select=*’);

// Agrupar entries per dia
var entriesByDay = {};
entries.forEach(function(e){
var d = e.entry_date;
if(!entriesByDay[d]) entriesByDay[d] = [];
entriesByDay[d].push(e);
});

// Construir dades de la fulla
var monthNames = [‘Gener’,‘Febrer’,‘Marc’,‘Abril’,‘Maig’,‘Juny’,‘Juliol’,‘Agost’,‘Setembre’,‘Octubre’,‘Novembre’,‘Desembre’];
var rows = [];

// Capçalera
rows.push([‘JASL Time - Registre de jornada’]);
rows.push([‘Treballador:’, worker.display_name||worker.employee_code]);
rows.push([‘Codi:’, worker.employee_code]);
rows.push([‘Mes:’, monthNames[month-1]+’ ’+year]);
rows.push([]);
rows.push([‘Data’,‘Dia’,‘Entrada’,‘Sortida’,‘Pauses’,‘H. Treballades’,‘H. Teoriques’,‘Saldo’,‘Estat’]);

// Dies del mes
var daysInMonth = new Date(year, month, 0).getDate();
var dayNames = [‘Dg’,‘Dl’,‘Dt’,‘Dc’,‘Dj’,‘Dv’,‘Ds’];
var totalWorked = 0, totalTheoretical = 0, totalBalance = 0;

for(var d=1; d<=daysInMonth; d++){
var dateStr = year+’-’+moS+’-’+String(d).padStart(2,‘0’);
var dayOfWeek = new Date(dateStr+‘T12:00:00’).getDay();
var dayName = dayNames[dayOfWeek];
var rec = records.find(function(r){ return r.work_date===dateStr; });
var dayEntries = entriesByDay[dateStr]||[];

```
var startEntry = dayEntries.find(function(e){ return e.entry_type==='START'; });
var endEntry = dayEntries.filter(function(e){ return e.entry_type==='END'; }).pop();
var pauseCount = dayEntries.filter(function(e){ return e.entry_type==='PAUSE_START'; }).length;

var startTime = startEntry ? new Date(startEntry.entry_datetime).toLocaleTimeString('ca',{hour:'2-digit',minute:'2-digit'}) : '';
var endTime = endEntry ? new Date(endEntry.entry_datetime).toLocaleTimeString('ca',{hour:'2-digit',minute:'2-digit'}) : '';
var worked = rec ? (rec.worked_minutes||0) : 0;
var theoretical = rec ? (rec.theoretical_minutes||480) : (dayOfWeek===0||dayOfWeek===6?0:480);
var balance = rec ? (rec.balance_minutes||0) : (dayOfWeek===0||dayOfWeek===6?0:-theoretical);
var status = rec ? (rec.status||'-') : (dayOfWeek===0||dayOfWeek===6?'Cap de setmana':'-');

if(dayOfWeek!==0 && dayOfWeek!==6){
  totalWorked += worked;
  totalTheoretical += theoretical;
  totalBalance += balance;
}

rows.push([
  dateStr, dayName,
  startTime, endTime,
  pauseCount>0?pauseCount:'',
  worked>0 ? minsToHM(worked) : '',
  dayOfWeek===0||dayOfWeek===6?'':minsToHM(theoretical),
  dayOfWeek===0||dayOfWeek===6?'':(balance>=0?'+':'')+minsToHM(balance),
  status
]);
```

}

// Totals
rows.push([]);
rows.push([‘TOTALS’,’’,’’,’’,’’,minsToHM(totalWorked),minsToHM(totalTheoretical),(totalBalance>=0?’+’:’’)+minsToHM(totalBalance),’’]);

// Generar Excel amb SheetJS
if(typeof XLSX === ‘undefined’){ showToast(‘Carregant SheetJS…’,‘success’); await loadSheetJS(); }
var wb = XLSX.utils.book_new();
var ws = XLSX.utils.aoa_to_sheet(rows);

// Amplades de columna
ws[’!cols’] = [{wch:12},{wch:4},{wch:8},{wch:8},{wch:7},{wch:12},{wch:12},{wch:10},{wch:14}];

XLSX.utils.book_append_sheet(wb, ws, monthNames[month-1]);
var fileName = ‘JASL_Time_’+( worker.display_name||worker.employee_code)+’*’+year+’*’+moS+’.xlsx’;
XLSX.writeFile(wb, fileName);
showToast(‘Excel descarregat!’,‘success’);
}

async function generateAllWorkersExcel(){
var workers = state.allWorkers.length ? state.allWorkers : await dbGet(‘workers’,‘is_active=eq.true&select=*&order=display_name.asc’);
var month = parseInt(document.getElementById(‘export-month’).value)||new Date().getMonth()+1;
var year = parseInt(document.getElementById(‘export-year’).value)||new Date().getFullYear();

if(typeof XLSX === ‘undefined’){ showToast(‘Carregant SheetJS…’,‘success’); await loadSheetJS(); }
var wb = XLSX.utils.book_new();
var monthNames = [‘Gener’,‘Febrer’,‘Marc’,‘Abril’,‘Maig’,‘Juny’,‘Juliol’,‘Agost’,‘Setembre’,‘Octubre’,‘Novembre’,‘Desembre’];

for(var i=0; i<workers.length; i++){
var w = workers[i];
var moS = String(month).padStart(2,‘0’);
var records = await dbGet(‘daily_records’,
‘worker_id=eq.’+w.id+’&work_date=gte.’+year+’-’+moS+’-01&work_date=lte.’+year+’-’+moS+’-31’+
‘&order=work_date.asc&select=*’);

```
var sheetRows = [['Data','Treballat','Teoriques','Saldo','Estat']];
records.forEach(function(r){
  sheetRows.push([r.work_date, minsToHM(r.worked_minutes||0), minsToHM(r.theoretical_minutes||480), (r.balance_minutes>=0?'+':'')+minsToHM(r.balance_minutes||0), r.status||'-']);
});

var ws = XLSX.utils.aoa_to_sheet(sheetRows);
var sheetName = (w.display_name||w.employee_code).substring(0,30);
XLSX.utils.book_append_sheet(wb, ws, sheetName);
```

}

XLSX.writeFile(wb, ‘JASL_Time_Tots_’+year+’_’+String(month).padStart(2,‘0’)+’.xlsx’);
showToast(‘Excel global descarregat!’,‘success’);
}

function loadSheetJS(){
return new Promise(function(resolve, reject){
var script = document.createElement(‘script’);
script.src = ‘https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js’;
script.onload = resolve;
script.onerror = reject;
document.head.appendChild(script);
});
}

async function loadCardsWorkers(){
var el=document.getElementById(‘cards-workers-list’);
var ws=state.allWorkers.length?state.allWorkers:await dbGet(‘workers’,‘is_active=eq.true&select=*’).catch(function(){return[];});
var html=’’;
ws.forEach(function(w){
html+=’<div class="worker-item" onclick="state.selectedCardWorker='+JSON.stringify(w.id)+';this.querySelector('+JSON.stringify('input')+').checked=!this.querySelector('+JSON.stringify('input')+').checked" style="user-select:none" id="cw-'+w.id+'">’;
html+=’<div class="worker-avatar-sm">’+workerAvatar(w)+’</div>’;
html+=’<div style="flex:1"><div style="font-weight:700;font-size:14px">’+(w.display_name||w.employee_code)+’</div></div>’;
html+=’<input type="checkbox" style="accent-color:var(--accent);width:18px;height:18px" onclick="event.stopPropagation()"></div>’;
});
el.innerHTML=html;
}

async function loadJsPDF(){
if(window.jspdf) return;
await new Promise(function(resolve, reject){
var s=document.createElement(‘script’);
s.src=‘https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js’; // defer-loaded
s.onload=resolve; s.onerror=reject;
document.head.appendChild(s);
});
if(typeof QRCode === ‘undefined’){
await new Promise(function(resolve, reject){
var s=document.createElement(‘script’);
s.src=‘https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js’;
s.onload=resolve; s.onerror=reject;
document.head.appendChild(s);
});
}
}

async function generateQRDataURL(text){
return new Promise(function(resolve){
// Usar Google Charts API - compatible amb Lockdown (no eval)
var url = ‘https://chart.googleapis.com/chart?cht=qr&chs=120x120&chl=’ + encodeURIComponent(text) + ‘&choe=UTF-8’;
resolve(url);
});
}

async function generateWorkerCardPDF(worker){
var doc = new window.jspdf.jsPDF({unit:‘mm’,format:[85.6,54],orientation:‘landscape’});

// Fons blanc
doc.setFillColor(255,255,255);
doc.rect(0,0,85.6,54,‘F’);

// Banda blava lateral esquerra
doc.setFillColor(30,144,232);
doc.rect(0,0,8,54,‘F’);

// Text JASL Time vertical a la banda
doc.setTextColor(255,255,255);
doc.setFontSize(5);
doc.setFont(‘helvetica’,‘bold’);
doc.text(‘JASL TIME’,4,48,{angle:90});

// Foto si n’hi ha
var photoX = 12;
if(worker.photo_path){
try{
var photoUrl=SUPABASE_URL+’/storage/v1/object/public/worker-photos/’+worker.photo_path;
var photoResp=await fetch(photoUrl);
var blob=await photoResp.blob();
var photoData=await new Promise(function(r){ var fr=new FileReader(); fr.onload=function(){r(fr.result);}; fr.readAsDataURL(blob); });
doc.addImage(photoData,‘JPEG’,photoX,6,22,22);
photoX = 38;
}catch(e){ photoX = 12; }
}

// Nom
doc.setTextColor(44,62,80);
doc.setFontSize(9);
doc.setFont(‘helvetica’,‘bold’);
var name = worker.display_name||worker.employee_code;
var nameParts = name.split(’ ‘);
if(nameParts.length>1){
doc.text(nameParts.slice(0,-1).join(’ ’), photoX, 12);
doc.setFontSize(11);
doc.text(nameParts[nameParts.length-1], photoX, 19);
} else {
doc.text(name, photoX, 15);
}

// Linia separadora
doc.setDrawColor(220,220,220);
doc.line(photoX, 22, 72, 22);

// Codi
doc.setFontSize(7);
doc.setFont(‘helvetica’,‘normal’);
doc.setTextColor(107,122,141);
doc.text(‘CODI EMPLEAT’, photoX, 27);
doc.setFontSize(10);
doc.setFont(‘courier’,‘bold’);
doc.setTextColor(30,144,232);
doc.text(worker.employee_code, photoX, 33);

// Empresa
doc.setFontSize(6);
doc.setFont(‘helvetica’,‘normal’);
doc.setTextColor(107,122,141);
doc.text(‘Jurislab Advocats’, photoX, 40);

// QR
var qrToken = worker.qr_token||worker.employee_code;
var qrUrl = await generateQRDataURL(qrToken);
if(qrUrl){
doc.addImage(qrUrl,‘PNG’,68,6,14,14);
}

// Linia inferior decorativa
doc.setFillColor(30,144,232);
doc.rect(8,50,77.6,1,‘F’);

return doc;
}

async function generateCards(all){
showToast(‘Generant targetes…’,‘success’);
try{
await loadJsPDF();
var workers = state.allWorkers.length ? state.allWorkers : await dbGet(‘workers’,‘is_active=eq.true&select=*&order=display_name.asc’);

```
if(all){
  // Generar PDF multi-p&agrave;gina amb totes les targetes
  var firstDoc = null;
  for(var i=0; i<workers.length; i++){
    var doc = await generateWorkerCardPDF(workers[i]);
    if(i===0){
      firstDoc = doc;
    } else {
      firstDoc.addPage([85.6,54],'landscape');
      var pageData = doc.output('arraybuffer');
      // Afegir contingut de la pagina
      var tmpDoc = await generateWorkerCardPDF(workers[i]);
      var pages = tmpDoc.internal.pages;
      // Copiar la pagina al doc principal
      firstDoc.setPage(i+1);
      // Re-generar a la nova pagina del doc principal
      var d2 = firstDoc;
      // Banda blava
      d2.setFillColor(30,144,232); d2.rect(0,0,8,54,'F');
      d2.setTextColor(255,255,255); d2.setFontSize(5); d2.setFont('helvetica','bold');
      d2.text('JASL TIME',4,48,{angle:90});
      // Nom
      d2.setTextColor(44,62,80); d2.setFontSize(9); d2.setFont('helvetica','bold');
      var n=workers[i].display_name||workers[i].employee_code;
      d2.text(n.substring(0,22),12,15);
      d2.setFontSize(7); d2.setFont('helvetica','normal'); d2.setTextColor(107,122,141);
      d2.text('CODI EMPLEAT',12,27);
      d2.setFontSize(10); d2.setFont('courier','bold'); d2.setTextColor(30,144,232);
      d2.text(workers[i].employee_code,12,33);
      d2.setFontSize(6); d2.setFont('helvetica','normal'); d2.setTextColor(107,122,141);
      d2.text('Jurislab Advocats',12,40);
      var qrUrl2=await generateQRDataURL(workers[i].qr_token||workers[i].employee_code);
      if(qrUrl2) d2.addImage(qrUrl2,'PNG',68,6,14,14);
      d2.setFillColor(30,144,232); d2.rect(8,50,77.6,1,'F');
    }
  }
  if(firstDoc) firstDoc.save('JASL_Time_Targetes_Totes.pdf');
} else {
  // Targeta individual
  var wId = state.selectedCardWorker;
  var wks = state.allWorkers.length ? state.allWorkers : await dbGet('workers','is_active=eq.true&select=*');
  var w = wks.find(function(x){ return String(x.id)===String(wId); });
  if(!w){ showToast('Selecciona un treballador','error'); return; }
  var doc = await generateWorkerCardPDF(w);
  doc.save('JASL_Time_Targeta_'+(w.display_name||w.employee_code)+'.pdf');
}
showToast('PDF descarregat!','success');
```

}catch(e){
console.error(‘generateCards error:’,e);
showToast(‘Error generant targetes: ‘+(e.message||’’),‘error’);
}
}

async function loadComputeSettings(){
var el=document.getElementById(‘settings-list’);
if(!el) return;
el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var rows=await dbGet(‘app_settings’,‘select=setting_key,setting_value&order=setting_key.asc’);
if(!rows||!rows.length){el.innerHTML=’<div class="empty-state">Cap configuració</div>’;return;}
var typeLabels={
compute_mode_VACATION:‘Vacances - còmput’,
compute_mode_SICK_LEAVE:‘Baixa mèdica - còmput’,
compute_mode_SICK_DAY:‘Malaltia domiciliària - còmput’,
compute_mode_PAID_LEAVE:‘Permís legal - còmput’,
compute_mode_HOLIDAY:‘Festiu - còmput’,
max_sick_days_year:‘Màx. dies malaltia/any’
};
state.settings={};
rows.forEach(function(r){state.settings[r.setting_key]=r.setting_value;});
el.innerHTML=rows.map(function(r){
var label=typeLabels[r.setting_key]||r.setting_key;
var isCompute=r.setting_key.startsWith(‘compute_mode_’);
var isNum=r.setting_key===‘max_sick_days_year’;
var control;
if(isCompute){
var sel=’<select id="setting-'+r.setting_key+'" class="input" style="width:180px;padding:8px 12px;font-size:13px;">’;
sel+=’<option value=“THEORETICAL_HOURS”’+(r.setting_value===‘THEORETICAL_HOURS’?’ selected’:’’)+’>Compta (jornada teòrica)</option>’;
sel+=’<option value=“ZERO_HOURS”’+(r.setting_value===‘ZERO_HOURS’?’ selected’:’’)+’>No compta (zero hores)</option>’;
sel+=’</select>’;
control=sel;
} else {
control=’<input class=“input” type=”’+(isNum?‘number’:‘text’)+’” style=“width:180px;padding:8px 12px;font-size:13px;” id=“setting-’+r.setting_key+’” value=”’+(r.setting_value||’’)+’”’+(isNum?’ min=“0” max=“365”’:’’)+’ >’;
}
return ‘<div class="setting-row"><div><div class="setting-label">’+label+’</div></div>’+control+’</div>’;
}).join(’’);
}catch(e){el.innerHTML=’<div class="empty-state">Error carregant configuració</div>’;}
}

async function loadSettings(){
var el=document.getElementById(‘settings-list’); el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var rows;
try{rows=await rpc(‘get_app_settings’,{});}catch(e1){rows=await dbGet(‘app_settings’,‘select=*’);}
if(!rows||!rows.length){el.innerHTML=’<div class="empty-state">Cap configuracio disponible</div>’;return;}
state.settings={};
rows.forEach(function(r){state.settings[r.setting_key]=r.setting_value;});
el.innerHTML=rows.map(function(r){ return ‘<div class="setting-row"><div><div class="setting-label">’+r.setting_key+’</div></div><input class="input" style="width:160px;padding:8px 12px;font-size:13px" id="setting-'+r.setting_key+'" value="'+(r.setting_value||'')+'"></div>’; }).join(’’);
}catch(e){el.innerHTML=’<div class="empty-state">Error carregant configuracio</div>’;}
}

async function loadAccessLogs(){
var el = document.getElementById(‘access-logs-list’);
if(!el) return;
el.innerHTML=’<div class="empty-state"><span class="loader"></span></div>’;
try{
var logs = await dbGet(‘access_logs’,‘order=accessed_at.desc&limit=100&select=*,workers(display_name,employee_code)’);
if(!logs||!logs.length){ el.innerHTML=’<div class="empty-state">Cap registre d'accesos</div>’; return; }
el.innerHTML=logs.map(function(l){
var name=(l.workers&&l.workers.display_name)?l.workers.display_name:l.worker_id;
var dt=new Date(l.accessed_at);
var dateStr=dt.toLocaleDateString(‘ca’,{day:‘numeric’,month:‘short’,year:‘numeric’});
var timeStr=dt.toLocaleTimeString(‘ca’,{hour:‘2-digit’,minute:‘2-digit’});
var methodTag=l.access_method===‘QR’?
‘<span class="tag tag-purple" style="font-size:10px">QR</span>’:
‘<span class="tag tag-gray" style="font-size:10px">Codi</span>’;
return ‘<div class="history-row">’+
‘<div style="width:90px;flex-shrink:0"><div style="font-family:var(--mono);font-size:13px;font-weight:700">’+timeStr+’</div>’+
‘<div style="font-size:11px;color:var(--text2)">’+dateStr+’</div></div>’+
‘<div style="flex:1"><div style="font-weight:600;font-size:14px">’+name+’</div></div>’+
methodTag+
‘</div>’;
}).join(’’);
}catch(e){ el.innerHTML=’<div class="empty-state">Error carregant registre</div>’; }
}

async function saveSettings(){ try{ var rows=await dbGet(‘app_settings’,‘select=setting_key’); for(var i=0;i<rows.length;i++){var el=document.getElementById(‘setting-’+rows[i].setting_key); if(el)await dbPatch(‘app_settings’,‘setting_key=eq.’+rows[i].setting_key,{setting_value:el.value});} showToast(‘Configuracio guardada’,‘success’); }catch(e){showToast(‘Error guardant’,‘error’);} }

var qrStream=null;
async function startQRScan(){ showPage(‘qr-scan’); try{ qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:‘environment’}}); var video=document.getElementById(‘qr-video’); video.srcObject=qrStream; await video.play(); document.getElementById(‘qr-scan-hint’).textContent=’’; if(‘BarcodeDetector’ in window){ var bd=new BarcodeDetector({formats:[‘qr_code’]}); var iv=setInterval(async function(){try{var codes=await bd.detect(video);if(codes.length){clearInterval(iv);stopQR();await loginByQR(codes[0].rawValue);}}catch(e){}},500); }else{document.getElementById(‘qr-scan-hint’).textContent=‘BarcodeDetector no disponible’;} }catch(e){document.getElementById(‘qr-scan-hint’).textContent=‘No accedit a la camera’;} }

function stopQR(){ if(qrStream){qrStream.getTracks().forEach(function(t){t.stop();});qrStream=null;} }

async function loginByQR(token){ try{ var worker; try{worker=await rpc(‘login_by_qr’,{p_qr_token:token});}catch(e1){var rows=await dbGet(‘workers’,‘qr_token=eq.’+encodeURIComponent(token)+’&is_active=eq.true&select=*’);worker=rows[0];} if(!worker||!worker.id)throw new Error(‘QR no valid’); state._loginByQR=true; state.worker=worker; afterLogin(); }catch(e){showToast(e.message||‘QR no reconegut’,‘error’);showPage(‘splash’);

// – Gestio offline –
window.addEventListener(‘online’,  function(){ showToast(‘Connexio restaurada’,‘success’); });
window.addEventListener(‘offline’, function(){ showToast(‘Sense connexio a Internet’,‘error’); });

// – Timeout de sessio (30 min d inactivitat) –
var _sessionTimer = null;
var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minuts

function resetSessionTimer(){
clearTimeout(_sessionTimer);
if(!state.worker) return;
_sessionTimer = setTimeout(function(){
if(state.worker){
showToast(‘Sessio expirada per inactivitat’,‘error’);
setTimeout(doLogout, 2000);
}
}, SESSION_TIMEOUT);
}

document.addEventListener(‘touchstart’, resetSessionTimer);
document.addEventListener(‘click’, resetSessionTimer);
document.addEventListener(‘keypress’, resetSessionTimer);} }

function minsToHM(mins){ var abs=Math.abs(Math.round(mins)); var h=Math.floor(abs/60),mm=abs%60; return (mins<0?’-’:’’)+h+’:’+String(mm).padStart(2,‘0’); }
function formatDate(d){ if(!d)return ‘-’; var p=d.split(’-’); return p[2]+’/’+p[1]; }
function formatDateLong(d){ if(!d)return ‘-’; return new Date(d+‘T12:00:00’).toLocaleDateString(‘ca’,{weekday:‘long’,day:‘numeric’,month:‘long’,year:‘numeric’}); }
function dayStatusTag(status){ var map={NOT_STARTED:’<span class="tag tag-gray">No iniciat</span>’,IN_PROGRESS:’<span class="tag tag-green">En curs</span>’,PAUSED:’<span class="tag tag-yellow">En pausa</span>’,ON_PAUSE:’<span class="tag tag-yellow">En pausa</span>’,FINISHED:’<span class="tag tag-purple">Finalitzat</span>’,COMPLETED:’<span class="tag tag-purple">Finalitzat</span>’,INCIDENCE:’<span class="tag tag-red">Incidencia</span>’,INCIDENT:’<span class="tag tag-red">Incidencia</span>’,VACATION:’<span class="tag tag-purple">Vacances</span>’,SICK_LEAVE:’<span class="tag tag-red">Baixa mèdica</span>’,SICK_DAY:’<span class="tag tag-yellow">Malaltia domicili</span>’,PAID_LEAVE:’<span class="tag tag-yellow">Permis</span>’,HOLIDAY:’<span class="tag tag-gray">Festiu</span>’,OTHER:’<span class="tag tag-gray">Altres</span>’}; return map[status]||’<span class="tag tag-gray">’+status+’</span>’; }
function permTypeLabel(t){
var m={
VACATION:   ‘Vacances’,
SICK_LEAVE: ‘Baixa mèdica (amb justificant)’,
SICK_DAY:   ‘Malaltia domiciliària’,
PAID_LEAVE: ‘Permís legal retribuït’,
HOLIDAY:    ‘Festiu’,
OTHER:      ‘Altres’
};
return m[t]||t;
}
function showToast(msg,type){ type=type||‘success’; var el=document.getElementById(‘toast’); el.textContent=msg; el.className=’show ’+type; clearTimeout(el._t); el._t=setTimeout(function(){el.classList.remove(‘show’);},2800); }

showPage(‘splash’);

// – Gestio offline –
window.addEventListener(‘online’,  function(){ showToast(‘Connexio restaurada’,‘success’); });
window.addEventListener(‘offline’, function(){ showToast(‘Sense connexio a Internet’,‘error’); });

// – Timeout de sessio (30 min d inactivitat) –
var _sessionTimer = null;
var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minuts

function resetSessionTimer(){
clearTimeout(_sessionTimer);
if(!state.worker) return;
_sessionTimer = setTimeout(function(){
if(state.worker){
showToast(‘Sessio expirada per inactivitat’,‘error’);
setTimeout(doLogout, 2000);
}
}, SESSION_TIMEOUT);
}

document.addEventListener(‘touchstart’, resetSessionTimer);
document.addEventListener(‘click’, resetSessionTimer);
document.addEventListener(‘keypress’, resetSessionTimer);
