(() => {
  const app = document.querySelector('#app');
  const bankBtn = document.querySelector('#bankBtn');
  const STORAGE_KEY = 'apartment-exam-attempt-v1';
  let timerId = null;
  let state = null;

  const activeBank = () => QUESTION_BANK.filter(q => q.active && Number.isInteger(q.answerIndex));
  const archivedBank = () => QUESTION_BANK.filter(q => !q.active || !Number.isInteger(q.answerIndex));
  const cloneTpl = id => document.querySelector(id).content.cloneNode(true);
  const letters = ['A','B','C','D'];
  const shuffle = arr => {
    const a = [...arr];
    for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  };
  const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const fmt = sec => `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;

  function showStart(){
    clearInterval(timerId); state=null; app.innerHTML=''; app.append(cloneTpl('#startTpl'));
    const active = activeBank().length, archived = archivedBank().length;
    document.querySelector('#verifiedCount').textContent = `已核對可出題 ${active} 題`;
    document.querySelector('#archivedCount').textContent = `已排除／待修正 ${archived} 題`;
    const notice=document.querySelector('#devNotice');
    if(active < 100){
      notice.innerHTML=`目前是建置中的可操作版本：已完成 <b>${active}</b> 題答案核對；法規題均逐題對照現行法規。題庫未滿 100 題時會抽出全部已核對題目，達 100 題以上後自動改成每次隨機抽 100 題。`;
    } else notice.remove();
    document.querySelector('#startBtn').onclick=startExam;
  }

  function startExam(){
    const pool=shuffle(activeBank());
    const count=Math.min(100,pool.length);
    const ids=pool.slice(0,count).map(q=>q.id);
    state={ids,answers:{},index:0,endAt:Date.now()+3600*1000,submitted:false};
    save(); renderExam();
  }

  function save(){ if(state) localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
  function load(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null} }

  function renderExam(){
    clearInterval(timerId); app.innerHTML=''; app.append(cloneTpl('#examTpl'));
    document.querySelector('#prevBtn').onclick=()=>move(-1);
    document.querySelector('#nextBtn').onclick=()=>move(1);
    document.querySelector('#submitBtn').onclick=()=>{ if(confirm('確定要交卷嗎？')) submitExam(); };
    renderQuestion(); tick(); timerId=setInterval(tick,1000);
  }

  function tick(){
    if(!state || state.submitted) return;
    const left=Math.max(0,Math.ceil((state.endAt-Date.now())/1000));
    const timer=document.querySelector('#timer'); if(timer) timer.textContent=fmt(left);
    if(left<=0) submitExam();
  }

  function getQuestion(){ return QUESTION_BANK.find(q=>q.id===state.ids[state.index]); }
  function renderQuestion(){
    const q=getQuestion(), total=state.ids.length, answered=Object.keys(state.answers).length;
    document.querySelector('#progressText').textContent=`第 ${state.index+1}/${total} 題・已作答 ${answered}`;
    document.querySelector('#progressBar').style.width=`${((state.index+1)/total)*100}%`;
    const card=document.querySelector('#questionCard');
    card.innerHTML=`<div class="q-no">第 ${state.index+1} 題｜原題庫 ${esc(q.sourceNo)}</div><div class="q-title">${esc(q.stem)}</div><div class="options">${q.options.map((o,i)=>`<button class="option ${state.answers[q.id]===i?'selected':''}" data-i="${i}"><span class="option-letter">${letters[i]}.</span>${esc(o)}</button>`).join('')}</div>`;
    card.querySelectorAll('.option').forEach(btn=>btn.onclick=()=>{
      state.answers[q.id]=Number(btn.dataset.i); save(); renderQuestion();
    });
    document.querySelector('#prevBtn').disabled=state.index===0;
    document.querySelector('#nextBtn').textContent=state.index===total-1?'回到第 1 題':'下一題';
  }
  function move(delta){
    const total=state.ids.length;
    if(delta>0 && state.index===total-1) state.index=0; else state.index=Math.max(0,Math.min(total-1,state.index+delta));
    save(); renderQuestion(); window.scrollTo({top:0,behavior:'smooth'});
  }

  function submitExam(){
    if(!state || state.submitted) return;
    clearInterval(timerId); state.submitted=true; save(); renderResult();
  }
  function renderResult(){
    app.innerHTML=''; app.append(cloneTpl('#resultTpl'));
    const qs=state.ids.map(id=>QUESTION_BANK.find(q=>q.id===id));
    let correct=0, wrong=0, blank=0;
    const misses=[];
    qs.forEach(q=>{
      const a=state.answers[q.id];
      if(a===undefined){blank++;misses.push({q,a:null});}
      else if(a===q.answerIndex) correct++;
      else {wrong++;misses.push({q,a});}
    });
    const score=qs.length?Math.round(correct/qs.length*100):0;
    document.querySelector('#score').textContent=`${score} 分`;
    document.querySelector('#stats').innerHTML=`<span class="stat">答對 ${correct}</span><span class="stat">答錯 ${wrong}</span><span class="stat">未作答 ${blank}</span>`;
    const list=document.querySelector('#wrongList');
    if(!misses.length) list.innerHTML='<div class="card empty">本次沒有錯題。</div>';
    else list.innerHTML=misses.map(({q,a},idx)=>wrongHtml(q,a,idx+1)).join('');
    document.querySelector('#retryBtn').onclick=()=>{localStorage.removeItem(STORAGE_KEY);showStart();window.scrollTo(0,0)};
  }
  function wrongHtml(q,a,n){
    const yours=a===null?'未作答':`${letters[a]}. ${esc(q.options[a])}`;
    const right=`${letters[q.answerIndex]}. ${esc(q.options[q.answerIndex])}`;
    const laws=(q.legalBasis||[]).map(x=>x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.law)} ${esc(x.article)}</a>`:`<span>${esc(x.law)} ${esc(x.article)}</span>`).join('');
    return `<article class="wrong-card"><div class="q-no">錯題 ${n}｜原題庫 ${esc(q.sourceNo)}</div><h3>${esc(q.stem)}</h3><div class="answer-line bad"><b>你的答案：</b>${yours}</div><div class="answer-line good"><b>正確答案：</b>${right}</div><div class="explain"><b>解析：</b>${esc(q.explanation)}</div>${q.note?`<div class="note">${esc(q.note)}</div>`:''}<div class="law-links">${laws}</div></article>`;
  }

  function showBank(filter='all'){
    clearInterval(timerId); app.innerHTML=''; app.append(cloneTpl('#bankTpl'));
    document.querySelector('#backBtn').onclick=()=>{ const saved=load(); if(saved && !saved.submitted && saved.endAt>Date.now()){state=saved;renderExam()} else showStart(); };
    document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>showBank(b.dataset.filter));
    document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
    let rows=QUESTION_BANK;
    if(filter==='active') rows=activeBank();
    if(filter==='archived') rows=archivedBank();
    document.querySelector('#bankList').innerHTML=rows.map(q=>{
      const status=q.active&&Number.isInteger(q.answerIndex)?'<span class="badge good">已核對可出題</span>':'<span class="badge warn">排除正式出題</span>';
      const ans=Number.isInteger(q.answerIndex)?`${letters[q.answerIndex]}. ${esc(q.options[q.answerIndex])}`:'—';
      return `<article class="bank-card"><div class="bank-meta">${status}<span class="badge">原題 ${esc(q.sourceNo)}</span></div><h3>${esc(q.stem)}</h3><div class="muted">正確答案：${ans}</div>${q.note?`<div class="note">${esc(q.note)}</div>`:''}</article>`;
    }).join('');
  }

  bankBtn.onclick=()=>showBank('all');
  const saved=load();
  if(saved && saved.submitted){ state=saved; renderResult(); }
  else if(saved && saved.endAt>Date.now()){ state=saved; renderExam(); }
  else showStart();
})();
