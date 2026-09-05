
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => '¥' + Number(n||0).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const dayKey = d => `${monthKey(d)}-${String(d.getDate()).padStart(2,'0')}`;
const icons = {餐饮:'🍜',交通:'🚕',购物:'🛍️',娱乐:'🎮',生活:'🏠',学习:'📚',医疗:'💊',其他:'•••',工资:'💰',兼职:'💼',奖学金:'🎓',红包:'🧧'};
const expenseCats=['餐饮','交通','购物','娱乐','生活','学习','医疗','其他'];
const incomeCats=['工资','兼职','奖学金','红包','其他'];
let appState={type:'支出',category:'餐饮',ledgerFilter:'全部',statsType:'支出',records:[],budget:3000};

class AmiDB{
  constructor(){this.db=null}
  open(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('ami-ledger-db',1);
      req.onupgradeneeded=e=>{
        const db=e.target.result;
        if(!db.objectStoreNames.contains('records')) db.createObjectStore('records',{keyPath:'id'});
        if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings',{keyPath:'key'});
      };
      req.onsuccess=e=>{this.db=e.target.result;resolve(this)};
      req.onerror=()=>reject(req.error);
    })
  }
  store(name,mode='readonly'){return this.db.transaction(name,mode).objectStore(name)}
  all(){return new Promise((res,rej)=>{const r=this.store('records').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
  put(rec){return new Promise((res,rej)=>{const r=this.store('records','readwrite').put(rec);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
  del(id){return new Promise((res,rej)=>{const r=this.store('records','readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
  clear(){return new Promise((res,rej)=>{const r=this.store('records','readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
  getSetting(key){return new Promise((res,rej)=>{const r=this.store('settings').get(key);r.onsuccess=()=>res(r.result?.value);r.onerror=()=>rej(r.error)})}
  setSetting(key,value){return new Promise((res,rej)=>{const r=this.store('settings','readwrite').put({key,value});r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
}
const db=new AmiDB();

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function nowLocalInput(){
  const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  return d.toISOString().slice(0,16);
}
function currentMonthRecords(type=null){
  const mk=monthKey(new Date());
  return appState.records.filter(r=>monthKey(new Date(r.date))===mk && (!type||r.type===type));
}
function renderHome(){
  const month=currentMonthRecords();
  const expense=month.filter(r=>r.type==='支出').reduce((a,b)=>a+b.amount,0);
  const income=month.filter(r=>r.type==='收入').reduce((a,b)=>a+b.amount,0);
  const today=dayKey(new Date());
  const todayExp=appState.records.filter(r=>r.type==='支出'&&dayKey(new Date(r.date))===today).reduce((a,b)=>a+b.amount,0);
  $('#monthExpense').textContent=fmt(expense);
  $('#monthIncome').textContent='本月收入 '+fmt(income);
  $('#todayExpense').textContent=fmt(todayExp);
  $('#monthBalance').textContent=fmt(income-expense);
  $('#monthLabel').textContent=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long'}).format(new Date());
  $('#budgetText').textContent=`${fmt(expense)} / ${fmt(appState.budget)}`;
  const ratio=appState.budget>0?Math.min(expense/appState.budget,1):0;
  $('#budgetBar').style.width=(ratio*100)+'%';
  $('#budgetHint').textContent=expense<=appState.budget?`还可使用 ${fmt(appState.budget-expense)}`:`本月已超预算 ${fmt(expense-appState.budget)}`;
  const sorted=[...appState.records].sort((a,b)=>new Date(b.date)-new Date(a.date));
  $('#recordCount').textContent=`${sorted.length} 笔`;
  renderTxnList($('#recentList'),sorted.slice(0,6),false);
}
function txnHtml(r,canDelete){
  const sign=r.type==='支出'?'-':'+';
  const dt=new Date(r.date);
  const sub=(r.note||r.payment||'') ;
  const safe=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  return `<div class="txn" data-id="${r.id}">
    <div class="txn-icon">${icons[r.category]||'•'}</div>
    <div class="txn-main"><b>${safe(r.category)}</b><small>${safe(sub)}</small></div>
    <div class="txn-value"><b>${sign}${fmt(r.amount)}</b><small>${dt.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})} ${dt.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</small></div>
    ${canDelete?'<button class="delete-mini" aria-label="删除">×</button>':''}
  </div>`;
}
function renderTxnList(el,records,canDelete=true){
  el.innerHTML=records.length?records.map(r=>txnHtml(r,canDelete)).join(''):'<div class="empty">还没有账单</div>';
  if(canDelete) el.querySelectorAll('.delete-mini').forEach(btn=>btn.onclick=async e=>{
    e.stopPropagation(); const id=e.target.closest('.txn').dataset.id;
    if(confirm('删除这笔账单？')){await db.del(id);await reload();toast('已删除')}
  });
}
function renderLedger(){
  const q=$('#searchInput').value.trim().toLowerCase();
  let arr=[...appState.records].filter(r=>appState.ledgerFilter==='全部'||r.type===appState.ledgerFilter);
  if(q) arr=arr.filter(r=>[r.category,r.note,r.payment].some(v=>String(v||'').toLowerCase().includes(q)));
  arr.sort((a,b)=>new Date(b.date)-new Date(a.date));
  renderTxnList($('#ledgerList'),arr,true);
}
function renderCategories(){
  const cats=appState.type==='支出'?expenseCats:incomeCats;
  if(!cats.includes(appState.category)) appState.category=cats[0];
  $('#categoryGrid').innerHTML=cats.map(c=>`<button class="cat-btn ${c===appState.category?'active':''}" data-cat="${c}"><span>${icons[c]||'•'}</span><small>${c}</small></button>`).join('');
  $$('.cat-btn').forEach(b=>b.onclick=()=>{appState.category=b.dataset.cat;renderCategories()});
}
function setupNav(){
  $$('.tabbar button').forEach(b=>b.onclick=()=>showPage(b.dataset.nav));
}
function showPage(page){
  $$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===page));
  $$('.tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));
  const titles={home:'ami记账',ledger:'账单',add:'记一笔',stats:'统计',settings:'设置'};
  $('#pageTitle').textContent=titles[page];
  window.scrollTo({top:0,behavior:'instant'});
  if(page==='stats') setTimeout(renderStats,30);
  if(page==='ledger') renderLedger();
}
function niceCanvas(canvas){
  const ratio=window.devicePixelRatio||1, rect=canvas.getBoundingClientRect();
  const cssH=parseInt(canvas.getAttribute('height'));
  canvas.width=Math.max(1,rect.width*ratio); canvas.height=cssH*ratio;
  canvas.style.height=cssH+'px';
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);return {ctx,w:rect.width,h:cssH};
}
function renderStats(){
  const arr=currentMonthRecords(appState.statsType);
  const total=arr.reduce((a,b)=>a+b.amount,0);
  $('#statsLabel').textContent='本月'+appState.statsType;$('#statsTotal').textContent=fmt(total);
  renderDaily(arr);renderCategoryChart(arr);
}
function renderDaily(arr){
  const {ctx,w,h}=niceCanvas($('#dailyCanvas'));ctx.clearRect(0,0,w,h);
  const by={};arr.forEach(r=>{const k=dayKey(new Date(r.date));by[k]=(by[k]||0)+r.amount});
  const keys=Object.keys(by).sort(); if(!keys.length){ctx.fillStyle='#8a909e';ctx.font='13px -apple-system';ctx.fillText('本月暂无数据',12,h/2);return}
  const max=Math.max(...keys.map(k=>by[k]),1), pad=20, gap=6, bw=Math.max(8,(w-pad*2)/keys.length-gap);
  keys.forEach((k,i)=>{const x=pad+i*((w-pad*2)/keys.length)+gap/2;const bh=(by[k]/max)*(h-50);ctx.fillStyle='#8d93a2';ctx.fillRect(x,h-25-bh,bw,bh)});
  ctx.fillStyle='#8a909e';ctx.font='10px -apple-system';ctx.fillText(keys[0].slice(8)+'日',pad,h-7);if(keys.length>1)ctx.fillText(keys.at(-1).slice(8)+'日',w-pad-22,h-7);
}
function renderCategoryChart(arr){
  const {ctx,w,h}=niceCanvas($('#categoryCanvas'));ctx.clearRect(0,0,w,h);
  const by={};arr.forEach(r=>by[r.category]=(by[r.category]||0)+r.amount);
  const entries=Object.entries(by).sort((a,b)=>b[1]-a[1]);const total=entries.reduce((s,e)=>s+e[1],0);
  if(!entries.length){ctx.fillStyle='#8a909e';ctx.font='13px -apple-system';ctx.fillText('本月暂无数据',12,h/2);$('#categoryLegend').innerHTML='';return}
  const cx=w/2,cy=h/2,r=Math.min(w,h)*.34,inner=r*.58;
  const colors=['#181c25','#596171','#8a93a2','#aeb4bf','#d1d5dc','#747b89','#989eaa','#c0c5cf'];
  let start=-Math.PI/2;
  entries.forEach(([cat,val],i)=>{const a=val/total*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,r,start,start+a);ctx.arc(cx,cy,inner,start+a,start,true);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();start+=a});
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--text');ctx.textAlign='center';ctx.font='700 16px -apple-system';ctx.fillText(fmt(total),cx,cy+5);ctx.textAlign='start';
  $('#categoryLegend').innerHTML=entries.map(([c,v])=>`<div><span>${c}</span><b>${Math.round(v/total*100)}%</b></div>`).join('');
}
async function saveRecord(){
  let raw=$('#amountInput').value.replace(',','.');const amount=Number(raw);
  if(!amount||amount<=0)return toast('请输入正确金额');
  const rec={id:crypto.randomUUID(),type:appState.type,amount,category:appState.category,payment:$('#paymentSelect').value,note:$('#noteInput').value.trim(),date:new Date($('#dateInput').value).toISOString()};
  await db.put(rec);$('#amountInput').value='';$('#noteInput').value='';$('#dateInput').value=nowLocalInput();await reload();toast('保存成功');showPage('home');
}
function csvEscape(v){return `"${String(v??'').replaceAll('"','""')}"`}
function download(name,text,type){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),800);
}
function exportCSV(){
  const rows=[['类型','金额','分类','支付方式','备注','日期'],...appState.records.map(r=>[r.type,r.amount.toFixed(2),r.category,r.payment,r.note,r.date])];
  download(`ami记账-${new Date().toISOString().slice(0,10)}.csv`,rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv;charset=utf-8');
}
function exportJSON(){
  download(`ami记账完整备份-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({version:1,budget:appState.budget,records:appState.records},null,2),'application/json');
}
async function importJSON(file){
  try{
    const data=JSON.parse(await file.text());if(!Array.isArray(data.records))throw new Error();
    for(const r of data.records) await db.put(r);
    if(Number.isFinite(Number(data.budget))){appState.budget=Number(data.budget);await db.setSetting('budget',appState.budget)}
    await reload();toast('备份已导入');
  }catch{alert('这个 JSON 备份无法识别')}
}
async function reload(){
  appState.records=await db.all();
  appState.budget=Number(await db.getSetting('budget')??3000);
  $('#budgetInput').value=appState.budget;
  renderHome();renderLedger();renderStats();
}
async function init(){
  await db.open();
  $('#dateInput').value=nowLocalInput();
  setupNav();renderCategories();
  $$('#typeSwitch button').forEach(b=>b.onclick=()=>{appState.type=b.dataset.type;$$('#typeSwitch button').forEach(x=>x.classList.toggle('active',x===b));appState.category=appState.type==='支出'?'餐饮':'工资';renderCategories()});
  $$('#ledgerFilter button').forEach(b=>b.onclick=()=>{appState.ledgerFilter=b.dataset.filter;$$('#ledgerFilter button').forEach(x=>x.classList.toggle('active',x===b));renderLedger()});
  $$('#statsType button').forEach(b=>b.onclick=()=>{appState.statsType=b.dataset.type;$$('#statsType button').forEach(x=>x.classList.toggle('active',x===b));renderStats()});
  $('#searchInput').oninput=renderLedger;$('#saveBtn').onclick=saveRecord;
  $('#saveBudgetBtn').onclick=async()=>{const v=Number($('#budgetInput').value.replace(',','.'));if(v<0||!Number.isFinite(v))return toast('预算金额不正确');appState.budget=v;await db.setSetting('budget',v);renderHome();toast('预算已保存')};
  $('#exportBtn').onclick=exportCSV;$('#backupJsonBtn').onclick=exportJSON;
  $('#importInput').onchange=e=>e.target.files[0]&&importJSON(e.target.files[0]);
  $('#clearBtn').onclick=async()=>{if(confirm('确定清空所有账单？此操作无法撤销。')){await db.clear();await reload();toast('已清空')}};
  $('#themeBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('ami-theme',document.body.classList.contains('dark')?'dark':'light');setTimeout(renderStats,30)};
  if(localStorage.getItem('ami-theme')==='dark')document.body.classList.add('dark');
  await reload();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}
init();
