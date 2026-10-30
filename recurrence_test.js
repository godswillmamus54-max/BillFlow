
'use strict';

// Standalone recurrence test — uses fictional data only.
// This file does not access BillFlow or browser storage.

function dateOnly(value) {
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateString(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function addRecurrence(value, frequency) {
  const d = dateOnly(value);
  if (!d) return '';

  if (frequency === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7);
    return dateString(d);
  }

  if (frequency === 'yearly') {
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    if (d.getUTCMonth() !== month) d.setUTCDate(0);
    if (d.getUTCDate() > day) d.setUTCDate(day);
    return dateString(d);
  }

  if (frequency === 'monthly') {
    const day = d.getUTCDate();
    const targetMonth = d.getUTCMonth() + 1;
    d.setUTCDate(1);
    d.setUTCMonth(targetMonth);
    const last = new Date(Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      0
    )).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return dateString(d);
  }

  return '';
}

function runRecurrenceTest(master, today, makeId, makeNumber) {
  const generated = [];
  let next = master.nextRecurringDate;
  let guard = 0;

  while (next && next <= today && guard++ < 24) {
    const occurrence = {
      ...master,
      id: makeId(),
      number: makeNumber(),
      issueDate: next,
      dueDate: master.dueDate,
      recurring: 'none',
      recurringSourceId: master.id,
      payments: [],
      nextRecurringDate: undefined
    };

    generated.push(occurrence);
    next = addRecurrence(next, master.recurring);
  }

  master.nextRecurringDate = next;
  return generated;
}

// Fictional test invoice.
const master = {
  id: 'TEST-MASTER-001',
  number: 'BF-2026-9000',
  type: 'Invoice',
  issueDate: '2026-09-20',
  dueDate: '2026-09-27',
  customer: 'Recurrence Test Customer',
  items: [{ description: 'Test service', qty: 1, price: 100 }],
  taxRate: 0,
  discount: 0,
  recurring: 'weekly',
  nextRecurringDate: '2026-09-20',
  payments: [{ amount: 100, date: '2026-09-20' }]
};

const today = '2026-10-11';
let idCounter = 0;
let numberCounter = 0;

const makeId = () => `TEST-GENERATED-${++idCounter}`;
const makeNumber = () => `TEST-INV-${++numberCounter}`;

const originalTemplate = JSON.stringify(master);

const firstRun = runRecurrenceTest(master, today, makeId, makeNumber);
const firstNextDate = master.nextRecurringDate;
const secondRun = runRecurrenceTest(master, today, makeId, makeNumber);

const expectedDates = [
  '2026-09-20',
  '2026-09-27',
  '2026-10-04',
  '2026-10-11'
];

const results = {
  firstRunGeneratedFour: firstRun.length === 4,
  expectedDatesMatch: JSON.stringify(firstRun.map(x => x.issueDate)) === JSON.stringify(expectedDates),
  nextDateAdvanced: firstNextDate === '2026-10-18',
  secondRunGeneratedNone: secondRun.length === 0,
  generatedPaymentHistoriesEmpty: firstRun.every(x => x.payments.length === 0),
  sourceLinksCorrect: firstRun.every(x => x.recurringSourceId === 'TEST-MASTER-001'),
  templatePaymentsPreserved: master.payments.length === 1,
  templateIdentityPreserved: master.id === 'TEST-MASTER-001',
  templateNumberPreserved: master.number === 'BF-2026-9000',
  templateRecurringSettingsPreserved: master.recurring === 'weekly',
  templateIssueDatePreserved: master.issueDate === '2026-09-20',
  templateNextDateAdvanced: master.nextRecurringDate === '2026-10-18',
  templateOtherFieldsPreserved: (() => {
    const before = JSON.parse(originalTemplate);
    return master.customer === before.customer &&
      JSON.stringify(master.items) === JSON.stringify(before.items);
  })()
};

console.table(results);
console.log({
  firstRunDates: firstRun.map(x => x.issueDate),
  firstRunCount: firstRun.length,
  secondRunCount: secondRun.length,
  nextScheduledDate: master.nextRecurringDate,
  allChecksPassed: Object.values(results).every(Boolean)
});

const longOverdueMaster = {
  id: 'TEST-LONG-OVERDUE',
  number: 'TEST-LONG-OVERDUE',
  issueDate: '2020-01-01',
  dueDate: '2020-01-08',
  recurring: 'weekly',
  nextRecurringDate: '2020-01-01',
  payments: []
};

let longId = 0;
let longNumber = 0;

const longRun = runRecurrenceTest(
  longOverdueMaster,
  '2026-10-11',
  () => `LONG-ID-${++longId}`,
  () => `LONG-INV-${++longNumber}`
);

console.log({
  catchUpRunGenerated: longRun.length,
  nextScheduledDate: longOverdueMaster.nextRecurringDate,
  stillOverdue:
    longOverdueMaster.nextRecurringDate <= '2026-10-11',
  expectedLimit: 24
});

function collectDates(startDate, frequency, today, limit = 24) {
  const dates = [];
  let next = startDate;

  for (let guard = 0; next && next <= today && guard < limit; guard++) {
    dates.push(next);
    next = addRecurrence(next, frequency);
  }

  return { dates, next };
}

const monthlyTest = collectDates(
  '2026-01-31',
  'monthly',
  '2026-05-31'
);

const yearlyTest = collectDates(
  '2024-02-29',
  'yearly',
  '2028-02-29'
);

console.log('MONTHLY MONTH-END TEST');
console.table(monthlyTest.dates.map(date => ({ issueDate: date })));
console.log({
  nextDate: monthlyTest.next,
  expectedDates: [
    '2026-01-31',
    '2026-02-28',
    '2026-03-28',
    '2026-04-28',
    '2026-05-28'
  ],
  datesMatch:
    JSON.stringify(monthlyTest.dates) ===
    JSON.stringify([
      '2026-01-31',
      '2026-02-28',
      '2026-03-28',
      '2026-04-28',
      '2026-05-28'
    ])
});

console.log('YEARLY LEAP-DAY TEST');
console.table(yearlyTest.dates.map(date => ({ issueDate: date })));
console.log({
  nextDate: yearlyTest.next,
  expectedDates: [
    '2024-02-29',
    '2025-02-28',
    '2026-02-28',
    '2027-02-28',
    '2028-02-28'
  ],
  datesMatch:
    JSON.stringify(yearlyTest.dates) ===
    JSON.stringify([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-28'
    ])
});

console.log('DUE-DATE OFFSET TEST');

// Original invoice: 20 September, due 10 days later.
const dueDateMaster = {
  issueDate: '2026-09-20',
  dueDate: '2026-09-30',
  recurring: 'weekly',
  nextRecurringDate: '2026-09-20'
};

const dueDateRun = collectDates(
  dueDateMaster.nextRecurringDate,
  dueDateMaster.recurring,
  '2026-10-11'
);

const dueDateResults = dueDateRun.dates.map(issueDate => ({
  issueDate,
  dueDate: (() => {
    const d = new Date(`${issueDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 10);
    return d.toISOString().slice(0, 10);
  })()
}));

console.table(dueDateResults);

console.log({
  expectedFirstDueDate: '2026-09-30',
  actualFirstDueDate: dueDateResults[0]?.dueDate,
  tenDayOffsetPreserved: dueDateResults.every(row => {
    const issue = new Date(`${row.issueDate}T00:00:00Z`);
    const due = new Date(`${row.dueDate}T00:00:00Z`);
    return (due - issue) / 86400000 === 10;
  })
});

console.log('INVOICE NUMBER UNIQUENESS TEST');

const existingNumbers = new Set([
  'BF-2026-0001',
  'BF-2026-0002',
  'BF-2026-0004'
]);

function testNextNumber(year, numbers) {
  const nums = [...numbers].map(number => {
    const match = String(number).match(/^BF-(\d{4})-(\d+)$/);
    return match && Number(match[1]) === year
      ? Number(match[2])
      : 0;
  });

  return `BF-${year}-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`;
}

const nextNumber = testNextNumber(2026, existingNumbers);
existingNumbers.add(nextNumber);

console.log({
  generatedNumber: nextNumber,
  expectedNumber: 'BF-2026-0005',
  unique: existingNumbers.size === 4 && ![
    'BF-2026-0001',
    'BF-2026-0002',
    'BF-2026-0004'
  ].includes(nextNumber)
});

console.log('\n=== PRODUCTION RECURRENCE FUNCTION TESTS ===');

const fs = require('fs');
const vm = require('vm');

const productionSource = fs.readFileSync('./app.js', 'utf8');

function extractFunction(name, nextName) {
  const start = productionSource.indexOf(`function ${name}(`);

  if (start === -1) {
    throw new Error(`Could not find ${name}() in app.js`);
  }

  const end = nextName
    ? productionSource.indexOf(`function ${nextName}(`, start)
    : -1;

  if (end === -1) {
    throw new Error(`Could not find the end boundary for ${name}()`);
  }

  return productionSource.slice(start, end).trim();
}

function runProductionTest({ saveSucceeds = true } = {}) {
  const original = {
    profile: { currency: 'NGN' },
    customers: [],
    docs: [{
      id: 'MASTER-1',
      number: 'BF-2026-0001',
      type: 'Invoice',
      issueDate: '2026-09-20',
      dueDate: '2026-09-30',
      recurring: 'weekly',
      nextRecurringDate: '2026-09-20',
      recurringSourceId: undefined,
      customer: 'Fictional Test Customer',
      contact: '',
      customerEmail: '',
      items: [{ description: 'Test item', qty: 1, price: 100 }],
      taxRate: 0,
      discount: 0,
      payments: [{ amount: 20, date: '2026-09-25' }],
      createdAt: '2026-09-20T00:00:00.000Z'
    }]
  };

  const originalStorage = JSON.stringify(original);
  const storage = {
    value: originalStorage,
    getItem() { return this.value; },
    setItem(key, value) { this.value = value; },
    removeItem() { this.value = null; }
  };

  const sandbox = {
    db: JSON.parse(originalStorage),
    DB_KEY: 'billflow_v02_data',
    localStorage: storage,
    today: () => '2026-10-11',
    id: (() => {
      let n = 0;
      return () => `TEST-ID-${++n}`;
    })(),
    saveDB: () => {
      if (!saveSucceeds) return false;
      storage.value = JSON.stringify(sandbox.db);
      return true;
    },
    render: () => {},
    upsertCustomer: function (doc) {
      const customer = this.db.customers.find(
        c => c.name.toLowerCase() === doc.customer.toLowerCase()
      );

      if (customer) {
        customer.docs = this.db.docs.filter(
          d => d.customer.toLowerCase() === doc.customer.toLowerCase()
        ).length;
      } else {
        this.db.customers.push({
          name: doc.customer,
          contact: doc.contact,
          email: doc.customerEmail,
          docs: this.db.docs.filter(
            d => d.customer.toLowerCase() === doc.customer.toLowerCase()
          ).length
        });
      }
    },
    console: { warn() {}, error() {}, log() {} },
    Date,
    Math,
    JSON,
    String,
    Number,
    Array,
    Object
  };

  // Load the actual date and numbering helpers from app.js.
  const helpers = [
    extractFunction('dateOnly', 'dateString'),
    extractFunction('dateString', 'addRecurrence'),
    extractFunction('addRecurrence', 'updateRecurringPreview'),
    extractFunction('nextDocumentNumber', 'daysBetween'),
    extractFunction('daysBetween', 'processRecurringInvoices'),
    extractFunction('processRecurringInvoices', 'esc')
  ].join('\n');

  // Evaluate only these functions; never execute app.js itself.
  vm.runInNewContext(helpers, sandbox);

  // The customer updater must use the isolated database.
  sandbox.upsertCustomer = function (doc) {
    const customer = sandbox.db.customers.find(
      c => c.name.toLowerCase() === doc.customer.toLowerCase()
    );

    if (customer) {
      customer.docs = sandbox.db.docs.filter(
        d => d.customer.toLowerCase() === doc.customer.toLowerCase()
      ).length;
    } else {
      sandbox.db.customers.push({
        name: doc.customer,
        contact: doc.contact,
        email: doc.customerEmail,
        docs: sandbox.db.docs.filter(
          d => d.customer.toLowerCase() === doc.customer.toLowerCase()
        ).length
      });
    }
  };

  const generated = sandbox.processRecurringInvoices();

  return {
    generated,
    db: sandbox.db,
    originalStorage,
    finalStorage: storage.value,
    original
  };
}

const successfulRun = runProductionTest();
const generatedDocs = successfulRun.db.docs.filter(
  d => d.recurringSourceId === 'MASTER-1'
);

const productionChecks = {
  generatedFourOccurrences: successfulRun.generated === 4,
  expectedDates: JSON.stringify(
    generatedDocs.map(d => d.issueDate).sort()
  ) === JSON.stringify([
    '2026-09-20',
    '2026-09-27',
    '2026-10-04',
    '2026-10-11'
  ]),
  dueDateOffsetPreserved: generatedDocs.every(d => {
    const issue = new Date(`${d.issueDate}T00:00:00Z`);
    const due = new Date(`${d.dueDate}T00:00:00Z`);
    return (due - issue) / 86400000 === 10;
  }),
  generatedPaymentHistoriesEmpty: generatedDocs.every(
    d => Array.isArray(d.payments) && d.payments.length === 0
  ),
  originalPaymentsPreserved: JSON.stringify(
    successfulRun.db.docs.find(d => d.id === 'MASTER-1').payments
  ) === JSON.stringify(successfulRun.original.docs[0].payments),
  originalTemplatePreserved: successfulRun.db.docs.some(
    d => d.id === 'MASTER-1' &&
      d.number === 'BF-2026-0001' &&
      d.nextRecurringDate === '2026-10-18'
  )
};

console.table(productionChecks);
console.log(
  'PRODUCTION CHECKS:',
  Object.values(productionChecks).every(Boolean)
    ? 'ALL PASSED'
    : 'FAILED'
);

const failedSaveRun = runProductionTest({ saveSucceeds: false });

console.log('SAVE FAILURE ROLLBACK:', {
  generatedCountReturnedZero: failedSaveRun.generated === 0,
  databaseRestored:
    JSON.stringify(failedSaveRun.db) ===
    JSON.stringify(failedSaveRun.original),
  storageUnchanged:
    failedSaveRun.finalStorage === failedSaveRun.originalStorage
});
