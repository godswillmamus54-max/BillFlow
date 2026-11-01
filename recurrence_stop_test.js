'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const start = source.indexOf('function stopRecurringInvoice(');
const end = source.indexOf("$('detailBody').addEventListener", start);
if (start < 0 || end < 0) throw new Error('Could not locate production stop function');
const fn = source.slice(start, end);
function run({confirmed=true, saveSucceeds=true}={}) {
  const master = {id:'MASTER-1', number:'BF-2026-0004', customer:'AJ', recurring:'weekly', nextRecurringDate:'2026-11-08', payments:[{amount:12000,date:'2026-10-11'}]};
  const generated = {id:'GEN-1', number:'BF-2026-0007', customer:'AJ', recurring:'none', recurringSourceId:'MASTER-1', payments:[]};
  const sandbox = {
    db:{docs:[master,generated]},
    findDoc(id){return sandbox.db.docs.find(d=>d.id===id)},
    confirm(){return confirmed},
    saveDB(){return saveSucceeds},
    render(){}, toast(){}, openDetail(){}, JSON, Date
  };
  vm.createContext(sandbox);
  vm.runInContext(fn, sandbox);
  sandbox.stopRecurringInvoice('MASTER-1');
  return sandbox.db.docs;
}
const stopped = run();
const failedSave = run({saveSucceeds:false});
const cancelled = run({confirmed:false});
const checks = {
  masterRecurrenceDisabled: stopped[0].recurring === 'none',
  nextDateRemoved: !Object.hasOwn(stopped[0], 'nextRecurringDate'),
  originalFrequencyRecorded: stopped[0].recurringStoppedFrom === 'weekly',
  stopTimestampRecorded: typeof stopped[0].recurringStoppedAt === 'string',
  masterPaymentsPreserved: stopped[0].payments.length === 1 && stopped[0].payments[0].amount === 12000,
  generatedInvoicePreserved: stopped.some(d=>d.id==='GEN-1'),
  generatedInvoiceNotModified: stopped[1].recurringSourceId === 'MASTER-1',
  failedSaveRollsBack: failedSave[0].recurring === 'weekly' && failedSave[0].nextRecurringDate === '2026-11-08' && !failedSave[0].recurringStoppedAt,
  cancelLeavesRecordUnchanged: cancelled[0].recurring === 'weekly' && cancelled[0].nextRecurringDate === '2026-11-08'
};
console.log(checks);
console.log(Object.values(checks).every(Boolean) ? 'ALL STOP-FEATURE CHECKS PASSED' : 'STOP-FEATURE CHECKS FAILED');
if (!Object.values(checks).every(Boolean)) process.exit(1);
