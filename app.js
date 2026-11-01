'use strict';
const $ = id => document.getElementById(id);
const DB_KEY='billflow_v02_data';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
let db=loadDB(), editingId=null, activeId=null, deferredInstall=null;
function loadDB(){try{return JSON.parse(localStorage.getItem(DB_KEY))||{profile:{currency:'NGN'},docs:[],customers:[]}}catch{return{profile:{currency:'NGN'},docs:[],customers:[]}}}
function saveDB(){try{localStorage.setItem(DB_KEY,JSON.stringify(db));$('storageStatus').innerHTML='<i></i> Saved on this device';render();return true}catch(err){console.error('BillFlow save failed:',err);$('storageStatus').textContent='Could not save — export a backup or free browser storage';toast('Could not save data. Export a backup and check browser storage.');return false}}
function id(){return 'BF-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase()}
function money(n){const c=db.profile.currency||'NGN';try{return new Intl.NumberFormat('en-NG',{style:'currency',currency:c,maximumFractionDigits:2}).format(Number(n)||0)}catch{return `${c} ${(Number(n)||0).toFixed(2)}`}}
function fmtDate(d){if(!d)return '—';const x=new Date(`${d}T00:00:00`);return Number.isNaN(x.getTime())?d:x.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}

function dateOnly(value){const d=new Date(`${value}T00:00:00Z`);return Number.isNaN(d.getTime())?null:d}
function dateString(d){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`}
function addRecurrence(value,frequency){
 const d=dateOnly(value);if(!d)return '';
 if(frequency==='weekly'){d.setUTCDate(d.getUTCDate()+7);return dateString(d)}
 if(frequency==='yearly'){const month=d.getUTCMonth(),day=d.getUTCDate();d.setUTCFullYear(d.getUTCFullYear()+1);if(d.getUTCMonth()!==month)d.setUTCDate(0);if(d.getUTCDate()>day)d.setUTCDate(day);return dateString(d)}
 if(frequency==='monthly'){const day=d.getUTCDate(),targetMonth=d.getUTCMonth()+1;d.setUTCDate(1);d.setUTCMonth(targetMonth);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return dateString(d)}
 return '';
}

function updateRecurringPreview() {
 const recurring = $('recurring');
 const issueDateField = $('issueDate');
 const docType = $('docType');

 if (!recurring || !issueDateField || !docType) {
  console.error('BillFlow: Required recurring fields are missing.');
  return;
 }

 let preview = $('recurringPreview');

 // Create the preview automatically if it does not exist.
 if (!preview) {
  preview = document.createElement('div');
  preview.id = 'recurringPreview';
  preview.setAttribute('role', 'status');
  preview.setAttribute('aria-live', 'polite');

  preview.style.cssText =
   'width:100%;box-sizing:border-box;margin:10px 0;' +
   'padding:14px 16px;border:1px solid #b9dfcb;' +
   'border-radius:12px;background:#edf8f1;color:#175c40;' +
   'font-size:14px;line-height:1.6;';

  const field = recurring.closest('label') || recurring.parentElement;
  field.insertAdjacentElement('afterend', preview);
 }

 const frequency = recurring.value;
 const issueDate = issueDateField.value;

 if (
  docType.value !== 'Invoice' ||
  !['weekly', 'monthly', 'yearly'].includes(frequency)
 ) {
  preview.hidden = true;
  preview.textContent = '';
  return;
 }

 const next = addRecurrence(issueDate, frequency);

 if (!next) {
  preview.hidden = true;
  preview.textContent = '';
  return;
 }

 preview.hidden = false;
 preview.textContent =
  `Next scheduled invoice: ${fmtDate(next)}. ` +
  'Recurring invoices are generated when BillFlow is opened.';
}

function nextDocumentNumber(){
 const year=new Date().getFullYear();
 const nums=(db.docs||[]).map(d=>{const m=String(d.number||'').match(/^BF-(\d{4})-(\d+)$/);return m&&Number(m[1])===year?Number(m[2]):0});
 return `BF-${year}-${String(Math.max(0,...nums)+1).padStart(4,'0')}`;
}
function daysBetween(a,b){const da=dateOnly(a),dbb=dateOnly(b);return da&&dbb?Math.round((dbb-da)/86400000):0}

function processRecurringInvoices() {
  const MAX_CATCH_UP = 24;
  let generated = 0;
  let changed = false;
  const current = today();

  // Preserve the original database in case saving fails.
  const originalDb = JSON.stringify(db);
  const originalStorage = localStorage.getItem(DB_KEY);

  // Iterate only over the original documents, not newly generated invoices.
  const originalDocs = [...(db.docs || [])];

  for (const master of originalDocs) {
    if (
      master.type !== 'Invoice' ||
      !['weekly', 'monthly', 'yearly'].includes(master.recurring) ||
      master.recurringSourceId
    ) {
      continue;
    }

    let next = master.nextRecurringDate;

    if (!next) {
      next = addRecurrence(
        master.issueDate || current,
        master.recurring
      );
      changed = true;
    }

    let guard = 0;

    while (next && next <= current && guard++ < MAX_CATCH_UP) {
      const dueOffset = daysBetween(
        master.issueDate,
        master.dueDate
      );

      const issueDate = next;
      const issue = dateOnly(issueDate);

      if (!issue) {
        console.error(
          'BillFlow: Invalid recurring issue date for',
          master.number
        );
        break;
      }

      const dueDate =
        master.dueDate && dueOffset >= 0
          ? dateString(
              new Date(issue.getTime() + dueOffset * 86400000)
            )
          : '';

      const occurrence = {
        ...master,
        id: id(),
        number: nextDocumentNumber(),
        issueDate,
        dueDate,
        recurring: 'none',
        recurringSourceId: master.id,
        recurringGeneratedAt: new Date().toISOString(),
        nextRecurringDate: undefined,
        payments: [],
        createdAt: new Date().toISOString()
      };

      db.docs.unshift(occurrence);
      upsertCustomer(occurrence);

      generated++;
      next = addRecurrence(next, master.recurring);
      changed = true;
    }

    if (guard >= MAX_CATCH_UP && next && next <= current) {
      console.warn(
        'BillFlow: Recurrence catch-up limit reached for',
        master.number,
        '— more overdue occurrences remain.'
      );
    }

    master.nextRecurringDate = next;
  }

  if (changed && !saveDB()) {
    // Restore the in-memory database.
    db = JSON.parse(originalDb);

    // Restore saved storage if possible.
    try {
      if (originalStorage === null) {
        localStorage.removeItem(DB_KEY);
      } else {
        localStorage.setItem(DB_KEY, originalStorage);
      }
    } catch (restoreError) {
      console.error(
        'BillFlow: Storage rollback failed:',
        restoreError
      );
    }

    try {
      render();
    } catch (renderError) {
      console.error(
        'BillFlow: Could not redraw after rollback:',
        renderError
      );
    }

    console.error(
      'BillFlow: Recurring invoice changes were rolled back.'
    );

    return 0;
  }

  return generated;
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function totals(doc){const subtotal=(doc.items||[]).reduce((a,x)=>a+(Number(x.qty)||0)*(Number(x.price)||0),0);const tax=subtotal*(Number(doc.taxRate)||0)/100;const discount=Number(doc.discount)||0;const total=Math.max(0,subtotal+tax-discount);const paid=(doc.payments||[]).reduce((a,p)=>a+(Number(p.amount)||0),0);return{subtotal,tax,discount,total,paid,due:Math.max(0,total-paid)}}
function validateBackup(data){if(!data||typeof data!=='object'||!data.profile||typeof data.profile!=='object'||!Array.isArray(data.docs)||!Array.isArray(data.customers))return false;for(const d of data.docs){if(!d||typeof d!=='object'||typeof d.id!=='string'||typeof d.number!=='string'||!['Invoice','Quote','Receipt'].includes(d.type)||typeof d.customer!=='string'||!Array.isArray(d.items)||!Array.isArray(d.payments))return false;for(const item of d.items){if(!item||typeof item.description!=='string'||!Number.isFinite(Number(item.qty))||Number(item.qty)<=0||!Number.isFinite(Number(item.price))||Number(item.price)<0)return false}for(const payment of d.payments){if(!payment||!Number.isFinite(Number(payment.amount))||Number(payment.amount)<=0||typeof payment.date!=='string')return false}if(!Number.isFinite(Number(d.taxRate||0))||Number(d.taxRate||0)<0||Number(d.taxRate||0)>100||!Number.isFinite(Number(d.discount||0))||Number(d.discount||0)<0)return false}return true}
function status(doc){if(doc.type==='Quote')return 'quote';const t=totals(doc);if(t.due<=0.005)return 'paid';if(doc.dueDate&&doc.dueDate<today())return 'overdue';if(t.paid>0)return 'partial';return 'unpaid'}
function statusLabel(s){return({paid:'Paid',unpaid:'Unpaid',partial:'Part-paid',overdue:'Overdue',quote:'Quote'})[s]||s}
function render(){const docs=db.docs||[];const valid=docs.filter(d=>d.type!=='Quote');$('totalBilled').textContent=money(valid.reduce((a,d)=>a+totals(d).total,0));$('totalPaid').textContent=money(valid.reduce((a,d)=>a+totals(d).paid,0));$('totalDue').textContent=money(valid.reduce((a,d)=>a+totals(d).due,0));$('docCount').textContent=docs.length;$('customerCount').textContent=(db.customers||[]).length;
 const q=($('search')?.value||'').toLowerCase(),f=$('statusFilter')?.value||'all';const filtered=[...docs].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).filter(d=>{const s=status(d);return(!q||`${d.number} ${d.customer} ${d.type}`.toLowerCase().includes(q))&&(f==='all'||s===f)});const host=$('documents');
 if(!filtered.length){host.innerHTML=docs.length?'<div class="empty-state"><div class="empty-icon">⌕</div><h3>No matching documents</h3><p>Try a different search or status filter.</p></div>':'<div class="empty-state"><div class="empty-icon">▤</div><h3>Your next invoice starts here</h3><p>Create your first document to keep your business organized.</p><button class="btn btn-primary" id="emptyNew">Create first document</button></div>';const b=$('emptyNew');if(b)b.onclick=openNew;}
 else host.innerHTML=filtered.map(d=>{const t=totals(d),s=status(d);return `<article class="doc-row"><div class="doc-main"><div class="doc-icon">${d.type==='Receipt'?'✓':d.type==='Quote'?'≋':'▤'}</div><div style="min-width:0"><div class="doc-title">${esc(d.customer||'Customer')}</div><div class="doc-sub">${esc(d.number)} · ${esc(d.type)} · ${fmtDate(d.issueDate)}</div><div style="margin-top:7px"><span class="badge badge-${s}">${statusLabel(s)}</span>${d.recurring&&d.recurring!=='none'?` <span class="badge badge-quote">↻ ${esc(d.recurring)}</span>`:''}${d.recurring&&d.recurring!=='none'&&d.nextRecurringDate?`<div class="doc-sub" style="margin-top:5px">Next invoice: ${fmtDate(d.nextRecurringDate)}</div>`:''}</div></div></div><div class="doc-right"><div class="doc-amount">${money(t.total)}</div><div class="doc-sub">${s==='quote'?'Quote':t.due>0?`${money(t.due)} due`:'Settled'}</div><div class="doc-actions"><button class="link-button" data-action="view" data-id="${esc(d.id)}">Open</button><button class="link-button" data-action="share" data-id="${esc(d.id)}">Share</button></div></div></article>`}).join('');
 renderCustomers();renderReminders();}

function renderCustomers() {
  const customers = db.customers || [];
  const list = $('customersList');
  const emptyMessage = $('customerSearchEmpty');
  const searchInput = $('customerSearch');

  const query = (searchInput?.value || '').trim().toLowerCase();

  if (customers.length === 0) {
    list.innerHTML =
      '<p class="muted small">Customers appear here when you create documents.</p>';

    if (emptyMessage) emptyMessage.hidden = true;
    return;
  }

  const filtered = customers.filter(c => {
    const name = c.name || '';
    const contact = c.contact || '';
    const email = c.email || '';

    return `${name} ${contact} ${email}`
      .toLowerCase()
      .includes(query);
  });

  list.innerHTML = filtered.length
    ? filtered.map(c => `
        <div class="customer-row">
          <div class="customer-meta">
            <span class="avatar">${esc(
              (c.name || '?').trim().charAt(0).toUpperCase()
            )}</span>
            <div>
              <strong>${esc(c.name || 'Unnamed customer')}</strong>
              <small>${esc(
                c.contact || c.email || 'No contact saved'
              )}</small>
            </div>
          </div>
          <span class="customer-total">${c.docs || 0} doc${c.docs === 1 ? '' : 's'}</span>
        </div>
      `).join('')
    : '';

  if (emptyMessage) {
    emptyMessage.hidden = filtered.length > 0;
  }
}
function renderReminders(){const list=(db.docs||[]).filter(d=>d.type!=='Quote'&&totals(d).due>0.005).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')).slice(0,5);$('reminderList').innerHTML=list.length?list.map(d=>`<div class="reminder-row"><div><strong>${esc(d.customer)}</strong><small>${d.dueDate&&d.dueDate<today()?'Overdue':`Due ${fmtDate(d.dueDate)}`} · ${money(totals(d).due)}</small></div><button class="link-button" data-action="remind" data-id="${esc(d.id)}">Prepare</button></div>`).join(''):'<p class="muted small">No outstanding invoices yet.</p>'}
function syncProfile(){const p=db.profile||{};for(const [key,id] of Object.entries({name:'bizName',phone:'bizPhone',email:'bizEmail',address:'bizAddress',currency:'currency',paymentDetails:'paymentDetails'}))if($(id))$(id).value=p[key]|| (key==='currency'?'NGN':'')}
$('profileForm').addEventListener('submit',e=>{e.preventDefault();db.profile={name:$('bizName').value.trim(),phone:$('bizPhone').value.trim(),email:$('bizEmail').value.trim(),address:$('bizAddress').value.trim(),currency:$('currency').value,paymentDetails:$('paymentDetails').value.trim()};saveDB();toast('Business profile saved.');});
function openNew(){editingId=null;$('docForm').reset();$('dialogTitle').textContent='Create document';$('issueDate').value=today();$('dueDate').value='';$('taxRate').value='0';$('discount').value='0';$('amountPaid').value='0';$('recurring').value='none';$('items').innerHTML='';addItem();updateRecurringPreview();$('docDialog').showModal();calcPreview()}
function addItem(item={description:'',qty:1,price:0}){const row=document.createElement('div');row.className='item-row';row.innerHTML=`<input aria-label="Item description" class="item-desc" placeholder="Product or service" value="${esc(item.description)}" required><input aria-label="Quantity" class="item-qty" type="number" min="0.01" step="0.01" value="${Number(item.qty)||1}" required><input aria-label="Unit price" class="item-price" type="number" min="0" step="0.01" value="${Number(item.price)||0}" required><button type="button" class="remove-item" aria-label="Remove line">×</button>`;$('items').appendChild(row);row.querySelectorAll('input').forEach(i=>i.addEventListener('input',calcPreview));row.querySelector('.remove-item').onclick=()=>{if($('items').children.length>1)row.remove();calcPreview()};calcPreview()}
function currentItems(){return [...$('items').querySelectorAll('.item-row')].map(r=>({description:r.querySelector('.item-desc').value.trim(),qty:Number(r.querySelector('.item-qty').value),price:Number(r.querySelector('.item-price').value)}))}
function calcValues(items,rate,discount){const subtotal=items.reduce((a,x)=>a+(Number(x.qty)||0)*(Number(x.price)||0),0),tax=subtotal*(Number(rate)||0)/100,disc=Number(discount)||0;return{subtotal,tax,discount:disc,total:Math.max(0,subtotal+tax-disc)}}
function calcPreview(){const t=calcValues(currentItems(),$('taxRate').value,$('discount').value);$('subtotal').textContent=money(t.subtotal);$('taxAmount').textContent=money(t.tax);$('discountAmount').textContent=money(t.discount);$('previewTotal').textContent=money(t.total)}
$('newDoc').onclick=openNew;$('emptyNew')?.addEventListener('click',openNew);$('addItem').onclick=()=>addItem();$('recurring').addEventListener('change',updateRecurringPreview);$('issueDate').addEventListener('change',updateRecurringPreview);$('docType').addEventListener('change',updateRecurringPreview);$('closeDialog').onclick=$('cancelDoc').onclick=()=>$('docDialog').close();['taxRate','discount','amountPaid','currency'].forEach(id=>$(id).addEventListener('input',calcPreview));$('search').addEventListener('input',render);$('customerSearch').addEventListener('input', renderCustomers);$('statusFilter').addEventListener('change',render);
$('docForm').addEventListener('submit',e=>{e.preventDefault();const items=currentItems();if(!items.length||items.some(i=>!i.description||i.qty<=0||i.price<0)){toast('Check each line item and try again.');return}const taxRate=Number($('taxRate').value),discount=Number($('discount').value),amountPaid=Number($('amountPaid').value||0);if(!Number.isFinite(taxRate)||taxRate<0||taxRate>100||!Number.isFinite(discount)||discount<0||!Number.isFinite(amountPaid)||amountPaid<0){toast('Tax, discount, and initial payment must be valid non-negative amounts; tax cannot exceed 100%.');return}const vals=calcValues(items,taxRate,discount);if(discount>vals.subtotal+vals.tax+0.005){toast('Discount cannot exceed the subtotal plus tax.');return}if(!editingId&&amountPaid>vals.total+0.005){toast('Initial payment cannot exceed the invoice total.');return}if($('dueDate').value&&$('issueDate').value&&$('dueDate').value<$('issueDate').value){toast('Due date cannot be earlier than the issue date.');return}const doc={id:editingId||id(),number:editingId?(db.docs.find(d=>d.id===editingId)?.number||`BF-${Date.now()}`):nextDocumentNumber(),type:$('docType').value,issueDate:$('issueDate').value,dueDate:$('dueDate').value,customer:$('customer').value.trim(),contact:$('contact').value.trim(),customerEmail:$('customerEmail').value.trim(),items,taxRate,discount,notes:$('notes').value.trim(),recurring:$('docType').value==='Invoice'? $('recurring').value:'none',nextRecurringDate:(!editingId&&$('docType').value==='Invoice'&&['weekly','monthly','yearly'].includes($('recurring').value))?addRecurrence($('issueDate').value,$('recurring').value):undefined,payments:[],createdAt:new Date().toISOString()};if(editingId){const old=db.docs.find(d=>d.id===editingId);doc.payments=old?.payments||[];doc.createdAt=old?.createdAt||doc.createdAt;doc.nextRecurringDate=old?.nextRecurringDate||doc.nextRecurringDate;doc.recurringSourceId=old?.recurringSourceId;db.docs=db.docs.map(d=>d.id===editingId?doc:d)}else{const initialPaid=amountPaid;if(initialPaid>0)doc.payments.push({id:id(),amount:initialPaid,date:doc.issueDate,method:'Initial payment'});db.docs.unshift(doc)}upsertCustomer(doc);saveDB();$('docDialog').close();toast('Document saved.');openDetail(doc.id)});
function upsertCustomer(d){let c=(db.customers||[]).find(x=>x.name.toLowerCase()===d.customer.toLowerCase());if(!c){c={name:d.customer,contact:d.contact,email:d.customerEmail,docs:0};db.customers.push(c)}c.contact=d.contact||c.contact;c.email=d.customerEmail||c.email;c.docs=(db.docs||[]).filter(x=>x.customer.toLowerCase()===d.customer.toLowerCase()).length}
function findDoc(id){return db.docs.find(d=>d.id===id)}
function docText(d){const t=totals(d),p=db.profile||{};return `${d.type.toUpperCase()} ${d.number}\n${p.name||'Your business'}${p.phone?' · '+p.phone:''}\nCustomer: ${d.customer}${d.contact?' · '+d.contact:''}\nIssue date: ${fmtDate(d.issueDate)}${d.dueDate?'\nDue date: '+fmtDate(d.dueDate):''}\n\n${d.items.map(i=>`${i.description} — ${i.qty} × ${money(i.price)} = ${money(i.qty*i.price)}`).join('\n')}\n\nTotal: ${money(t.total)}\nPaid: ${money(t.paid)}\nBalance: ${money(t.due)}${p.paymentDetails?'\nPayment details: '+p.paymentDetails:''}${d.notes?'\n\n'+d.notes:''}`}
function openDetail(id){const d=findDoc(id);if(!d)return;activeId=id;const t=totals(d),p=db.profile||{},s=status(d);$('detailTitle').textContent=`${d.type} · ${d.number}`;$('detailBody').innerHTML=`<div class="detail-summary"><div style="display:flex;justify-content:space-between;gap:10px"><div><div class="muted small">BILLED TO</div><h3>${esc(d.customer)}</h3><div class="muted small">${esc(d.contact||d.customerEmail||'')}</div></div><div style="text-align:right"><span class="badge badge-${s}">${statusLabel(s)}</span><div class="muted small" style="margin-top:8px">Issued ${fmtDate(d.issueDate)}</div><div class="muted small">Due ${fmtDate(d.dueDate)}</div>${d.recurring&&d.recurring!=='none'?`<div class="muted small" style="margin-top:5px">Repeats ${esc(d.recurring)}${d.nextRecurringDate?` · Next invoice ${fmtDate(d.nextRecurringDate)}`:' · Next date not set'}</div>`:''}</div></div><hr style="border:0;border-top:1px solid #e9efea;margin:16px 0"><strong>${esc(p.name||'Your business')}</strong><div class="muted small">${esc(p.phone||'')} ${p.email?'· '+esc(p.email):''}</div>${p.address?`<div class="muted small">${esc(p.address)}</div>`:''}</div><table class="detail-table"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${d.items.map(i=>`<tr><td>${esc(i.description)}<div class="muted small">${money(i.price)} each</div></td><td>${i.qty}</td><td>${money(i.qty*i.price)}</td></tr>`).join('')}</tbody></table><div class="totals-box"><div><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div><div><span>Tax (${d.taxRate||0}%)</span><strong>${money(t.tax)}</strong></div><div><span>Discount</span><strong>${money(t.discount)}</strong></div><div class="grand-total"><span>Total</span><strong>${money(t.total)}</strong></div><div><span>Paid</span><strong>${money(t.paid)}</strong></div><div><span>Balance due</span><strong>${money(t.due)}</strong></div></div>${p.paymentDetails?`<p class="small"><strong>Payment details:</strong> ${esc(p.paymentDetails)}</p>`:''}${d.notes?`<p class="detail-note">${esc(d.notes)}</p>`:''}${d.payments?.length?`<h3 style="font:800 13px Manrope;margin-top:20px">Payment history</h3>${d.payments.map(x=>`<div class="customer-row"><span>${fmtDate(x.date)} · ${esc(x.method||'Payment')}</span><strong>${money(x.amount)}</strong></div>`).join('')}`:''}`;if(d.recurring&&['weekly','monthly','yearly'].includes(d.recurring)&&!d.recurringSourceId){const recurrencePanel=document.createElement('section');recurrencePanel.className='detail-note';recurrencePanel.style.marginTop='18px';recurrencePanel.innerHTML=`<strong>Recurring billing</strong><p class="small">This invoice generates future invoices ${esc(d.recurring)}.</p><button type="button" class="btn btn-secondary" data-stop-recurring="${esc(d.id)}">Stop future invoices</button>`;$('detailBody').appendChild(recurrencePanel)}else if(d.recurringStoppedAt){const stopped=document.createElement('p');stopped.className='detail-note small';stopped.style.marginTop='18px';stopped.textContent=`Recurring billing stopped on ${fmtDate(d.recurringStoppedAt.slice(0,10))}. Existing invoices and payments were retained.`;$('detailBody').appendChild(stopped)}$('markPaid').textContent=t.due>0.005?'Record payment':'Fully paid';$('markPaid').disabled=t.due<=0.005;$('detailDialog').showModal()}
function stopRecurringInvoice(docId){const doc=findDoc(docId);if(!doc||doc.recurringSourceId||!['weekly','monthly','yearly'].includes(doc.recurring))return;const confirmed=confirm(`Stop future recurring invoices for ${doc.customer} (${doc.number})? Existing invoices and payment records will be kept.`);if(!confirmed)return;const index=db.docs.findIndex(d=>d.id===docId);const previous=JSON.parse(JSON.stringify(doc));doc.recurringStoppedFrom=doc.recurring;doc.recurringStoppedAt=new Date().toISOString();doc.recurring='none';delete doc.nextRecurringDate;if(!saveDB()){db.docs[index]=previous;render();return}toast('Future recurring invoices stopped. Existing records were preserved.');openDetail(docId)}$('detailBody').addEventListener('click',e=>{const button=e.target.closest('[data-stop-recurring]');if(button)stopRecurringInvoice(button.dataset.stopRecurring)});$('closeDetail').onclick=()=>$('detailDialog').close();$('documents').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const d=findDoc(b.dataset.id);if(!d)return;if(b.dataset.action==='view')openDetail(d.id);if(b.dataset.action==='share')shareDoc(d);});
function openCustomerProfile(customerName) {
  const customer = (db.customers || []).find(
    c => (c.name || '').toLowerCase() === customerName.toLowerCase()
  );

  if (!customer) return;

  const docs = (db.docs || []).filter(
    d => (d.customer || '').toLowerCase() === customerName.toLowerCase()
  );

  const billed = docs
    .filter(d => d.type !== 'Quote')
    .reduce((sum, d) => sum + totals(d).total, 0);

  const paid = docs
    .filter(d => d.type !== 'Quote')
    .reduce((sum, d) => sum + totals(d).paid, 0);

  const outstanding = docs
    .filter(d => d.type !== 'Quote')
    .reduce((sum, d) => sum + totals(d).due, 0);

  $('customerProfileName').textContent = customer.name || 'Customer';

  $('customerProfileBody').innerHTML = `
    <div class="detail-summary">
      <p><strong>Phone:</strong> ${esc(customer.contact || 'Not provided')}</p>
      <p><strong>Email:</strong> ${esc(customer.email || 'Not provided')}</p>
      <p><strong>Total documents:</strong> ${docs.length}</p>
      <hr>
      <p><strong>Total billed:</strong> ${money(billed)}</p>
      <p><strong>Total paid:</strong> ${money(paid)}</p>
      <p><strong>Outstanding:</strong> ${money(outstanding)}</p>
    </div>

    <button
      type="button"
      class="btn btn-secondary"
      data-customer-edit
    >Edit contact details</button>

    <form id="customerEditForm" class="form-stack" hidden>
      <label>
        Phone / WhatsApp
        <input
          id="customerEditContact"
          type="tel"
          value="${esc(customer.contact || '')}"
        >
      </label>

      <label>
        Email
        <input
          id="customerEditEmail"
          type="email"
          value="${esc(customer.email || '')}"
        >
      </label>

      <div class="modal-actions">
        <button
          type="button"
          class="btn btn-secondary"
          data-customer-edit-cancel
        >Cancel</button>

        <button type="submit" class="btn btn-primary">
          Save contact details
        </button>
      </div>
    </form>

    <h3>Customer documents</h3>

    ${
      docs.length
        ? docs.map(d => {
            const t = totals(d);

            return `
              <div class="customer-row">
                <div>
                  <strong>${esc(d.number)}</strong>
                  <small>${esc(d.type)} · ${fmtDate(d.issueDate)}</small>
                  <small>${esc(statusLabel(status(d)))}</small>
                </div>

                <div style="text-align:right">
                  <strong>${money(t.total)}</strong>
                  <br>
                  <button
                    type="button"
                    class="link-button"
                    data-customer-doc="${esc(d.id)}"
                  >Open</button>
                </div>
              </div>
            `;
          }).join('')
        : '<p class="muted small">No documents found for this customer.</p>'
    }
  `;

  $('customerDialog').showModal();
}

$('customersList').addEventListener('click', e => {
  const row = e.target.closest('.customer-row');
  if (!row) return;

  const name = row.querySelector('.customer-meta strong')?.textContent;
  if (name) openCustomerProfile(name);
});

$('closeCustomerDialog').onclick = () => {
  $('customerDialog').close();
};

$('customerProfileBody').addEventListener('click', e => {
  const editButton = e.target.closest('[data-customer-edit]');

  if (editButton) {
    const form = $('customerEditForm');

    if (form) {
      form.hidden = false;
      $('customerEditContact').focus();
    }

    return;
  }

  const cancelButton = e.target.closest('[data-customer-edit-cancel]');

  if (cancelButton) {
    const form = $('customerEditForm');
    if (form) form.hidden = true;
    return;
  }

  const button = e.target.closest('[data-customer-doc]');
  if (!button) return;

  const doc = findDoc(button.dataset.customerDoc);
  if (!doc) return;

  $('customerDialog').close();
  openDetail(doc.id);
});

$('customerProfileBody').addEventListener('submit', e => {
  if (e.target.id !== 'customerEditForm') return;

  e.preventDefault();

  const profileName = $('customerProfileName').textContent;

  const customer = (db.customers || []).find(
    c => (c.name || '').toLowerCase() === profileName.toLowerCase()
  );

  if (!customer) {
    toast('Could not find this customer. Close and reopen the profile.');
    return;
  }

  const previousContact = customer.contact || '';
  const previousEmail = customer.email || '';

  customer.contact = $('customerEditContact').value.trim();
  customer.email = $('customerEditEmail').value.trim();

  if (!saveDB()) {
    customer.contact = previousContact;
    customer.email = previousEmail;
    return;
  }

  toast('Customer contact details saved.');
  openCustomerProfile(customer.name);
});
$('reminderList').addEventListener('click',e=>{const b=e.target.closest('[data-action="remind"]');if(b){const d=findDoc(b.dataset.id);if(d)prepareReminder(d)}});
function shareDoc(d){const text=docText(d),phone=(d.contact||'').replace(/\D/g,'');if(phone&&confirm('Open WhatsApp with the document summary?')){window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener')}else if(navigator.share){navigator.share({title:`${d.type} ${d.number}`,text}).catch(()=>{})}else{copyText(text)}}
$('shareWhatsApp').onclick=()=>{const d=findDoc(activeId);if(d){const phone=(d.contact||'').replace(/\D/g,'');const url=phone?`https://wa.me/${phone}?text=${encodeURIComponent(docText(d))}`:`https://wa.me/?text=${encodeURIComponent(docText(d))}`;window.open(url,'_blank','noopener')}};
function prepareReminder(d){const t=totals(d),p=db.profile||{};const message=`Hello ${d.customer}, this is a friendly reminder that ${d.number} has an outstanding balance of ${money(t.due)}${d.dueDate?`, due ${fmtDate(d.dueDate)}`:''}. ${p.name||'Our business'}${p.paymentDetails?' Payment details: '+p.paymentDetails:''} Please let us know if you have already made the payment. Thank you.`;if(d.contact){window.open(`https://wa.me/${d.contact.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`,'_blank','noopener')}else if(d.customerEmail){window.location.href=`mailto:${encodeURIComponent(d.customerEmail)}?subject=${encodeURIComponent('Payment reminder '+d.number)}&body=${encodeURIComponent(message)}`}else copyText(message)}
$('emailReminder').onclick=()=>{const d=findDoc(activeId);if(d)prepareReminder(d)};
$('markPaid').onclick=()=>{const d=findDoc(activeId);if(!d)return;$('paymentContext').textContent=`${d.number} · ${d.customer} · Remaining ${money(totals(d).due)}`;$('paymentAmount').value=totals(d).due.toFixed(2);$('paymentAmount').max=totals(d).due;$('paymentDate').value=today();$('paymentMethod').value='';$('paymentDialog').showModal()};$('closePayment').onclick=$('cancelPayment').onclick=()=>$('paymentDialog').close();$('paymentForm').addEventListener('submit',e=>{e.preventDefault();const d=findDoc(activeId),amount=Number($('paymentAmount').value);if(!d||!Number.isFinite(amount)||amount<=0||amount>totals(d).due+0.005||!$('paymentDate').value){toast('Enter a valid payment amount up to the outstanding balance and a valid date.');return}d.payments=d.payments||[];d.payments.push({id:id(),amount,date:$('paymentDate').value,method:$('paymentMethod').value.trim()||'Payment'});saveDB();$('paymentDialog').close();$('detailDialog').close();toast('Payment recorded.');openDetail(d.id)});
$('printDoc').onclick=()=>{const d=findDoc(activeId);if(!d)return;const t=totals(d),p=db.profile||{};const w=window.open('','_blank','width=850,height=900');if(!w){toast('Allow pop-ups to print or save as PDF.');return}w.document.write(`<!doctype html><html><head><title>${esc(d.type)} ${esc(d.number)}</title><style>body{font:14px Arial;color:#1b3027;max-width:800px;margin:40px auto;padding:0 24px}header{display:flex;justify-content:space-between;border-bottom:2px solid #1b7656;padding-bottom:20px}h1{font-size:28px}h2{font-size:18px}small,.muted{color:#65776d}table{width:100%;border-collapse:collapse;margin:30px 0}th,td{text-align:left;border-bottom:1px solid #ddd;padding:12px 8px}td:last-child,th:last-child{text-align:right}.totals{margin-left:auto;width:280px}.totals p{display:flex;justify-content:space-between}.total{font-size:20px;font-weight:bold;border-top:2px solid #ddd;padding-top:12px}footer{margin-top:45px;color:#64766c;border-top:1px solid #ddd;padding-top:15px}@media print{button{display:none}}</style></head><body><header><div><h1>${esc(p.name||'Your business')}</h1><p>${esc(p.phone||'')} ${esc(p.email||'')}<br>${esc(p.address||'')}</p></div><div><h1>${esc(d.type.toUpperCase())}</h1><strong>${esc(d.number)}</strong><p>Issued: ${fmtDate(d.issueDate)}<br>Due: ${fmtDate(d.dueDate)}</p></div></header><h2>Bill to: ${esc(d.customer)}</h2><p>${esc(d.contact||'')} ${esc(d.customerEmail||'')}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${d.items.map(i=>`<tr><td>${esc(i.description)}</td><td>${esc(i.qty)}</td><td>${money(i.price)}</td><td>${money(Number(i.qty)*Number(i.price))}</td></tr>`).join('')}</tbody></table><div class="totals"><p><span>Subtotal</span><strong>${money(t.subtotal)}</strong></p><p><span>Tax</span><strong>${money(t.tax)}</strong></p><p><span>Discount</span><strong>${money(t.discount)}</strong></p><p class="total"><span>Total</span><strong>${money(t.total)}</strong></p><p><span>Paid</span><strong>${money(t.paid)}</strong></p><p><span>Balance due</span><strong>${money(t.due)}</strong></p></div><p>${esc(d.notes||'')}</p><p><strong>Payment details:</strong> ${esc(p.paymentDetails||'Please contact us for payment options.')}</p><footer>Thank you for your business.</footer><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()};
function copyText(text){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast('Document summary copied.')).catch(()=>prompt('Copy this text:',text));else prompt('Copy this text:',text)}
$('exportData').onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`billflow-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);toast('Backup exported.')};
$('importData').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  const previousDb = db;
  const previousStorage = localStorage.getItem(DB_KEY);

  try {
    const data = JSON.parse(await file.text());

    if (!validateBackup(data)) {
      throw Error('invalid');
    }

    if (!confirm('Import this backup and replace the current BillFlow data?')) {
      return;
    }

    db = {
      profile: { currency: 'NGN', ...data.profile },
      docs: data.docs,
      customers: data.customers
    };

    if (!saveDB()) {
      db = previousDb;

      try {
        if (previousStorage === null) {
          localStorage.removeItem(DB_KEY);
        } else {
          localStorage.setItem(DB_KEY, previousStorage);
        }
      } catch (restoreError) {
        console.error('BillFlow storage rollback failed:', restoreError);
      }

      render();
      syncProfile();
      throw Error('storage');
    }

    syncProfile();
    toast('Backup imported.');
  } catch (err) {
    if (err.message === 'storage') {
      toast('Could not save the backup. Previous data was restored where possible.');
    } else if (err.message !== 'cancelled') {
      toast('That backup file is invalid or could not be read.');
    }
  } finally {
    e.target.value = '';
  }
});
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600)}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').hidden=false});$('installBtn').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').hidden=true};
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
const recurringGenerated=processRecurringInvoices();syncProfile();render();updateRecurringPreview();if(recurringGenerated)toast(`${recurringGenerated} recurring invoice${recurringGenerated===1?'':'s'} generated.`);
