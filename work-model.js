/* Local-first business model for Ledgerly Work mode. It is deliberately independent
   of the existing learning labs, while sharing the central GST engine. */
(function (root, factory) {
  const model = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.LedgerlyWork = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const STORAGE_KEY = 'ledgerly-work-v1';
  const moneyNumber = value => Math.round((Number(value) || 0) * 100) / 100;
  const now = () => new Date().toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));

  const config = {
    version: 1,
    financialYears: ['FY 2024–25', 'FY 2025–26', 'FY 2026–27'],
    taxRates: [0, 5, 12, 18, 28],
    returnForms: ['GSTR-1', 'GSTR-3B', 'GSTR-9', 'CMP-08'],
    dueDates: { 'GSTR-1': '11 May 2026', 'GSTR-2B': '14 May 2026', 'GSTR-3B': '20 May 2026' },
    source: 'Illustrative configuration. Verify current GST law, portal data and due dates before relying on it.'
  };

  const products = [
    { id: 'prod-paper', name: 'Premium A4 paper reams', sku: 'PAPER-A4', hsnSac: '4802', unit: 'ream', purchaseRate: 400, salesRate: 650, gstRate: 18, cessRate: 0, category: 'Goods', itcEligible: true },
    { id: 'prod-install', name: 'Installation and support', sku: 'SERV-001', hsnSac: '998719', unit: 'service', purchaseRate: 0, salesRate: 18000, gstRate: 18, cessRate: 0, category: 'Service', itcEligible: true },
    { id: 'prod-laptop', name: 'Business laptop', sku: 'TECH-LT', hsnSac: '8471', unit: 'unit', purchaseRate: 52000, salesRate: 68000, gstRate: 18, cessRate: 0, category: 'Goods', itcEligible: true }
  ];

  function gstin(stateCode, suffix) { return `${stateCode}${suffix}`; }

  function baseCompany({ id, name, tradeName, state, stateCode, gstinValue, type = 'Private limited company' }) {
    return {
      id, name, legalName: name, tradeName, pan: `${stateCode}AABCA1234F`, tan: '', businessType: type,
      activity: type.includes('Service') ? 'Professional and technical services' : 'Trading and distribution',
      state, stateCode, address: `Plot 18, ${state} Industrial Estate`, city: state === 'Maharashtra' ? 'Pune' : 'Bengaluru',
      email: 'accounts@example.in', phone: '+91 98765 43210', registrationType: 'Regular', composition: false,
      eCommerce: false, importExport: false, interstate: true, financialYear: 'FY 2026–27', activeGstinId: `${id}-gstin-1`,
      gstins: [{ id: `${id}-gstin-1`, gstin: gstinValue, state, stateCode, status: 'Active', taxpayerType: 'Regular', registrationDate: '2021-04-14', principalPlace: `Plot 18, ${state} Industrial Estate`, additionalPlaces: 1 }],
       customers: [], suppliers: [], products: clone(products), transactions: [], notices: [], documents: [], tasks: [], audit: [],
       simulation: { completed: [], attempts: 0, feedback: {} }
    };
  }

  function seedState() {
    const aarav = baseCompany({ id: 'company-aarav', name: 'Aarav Electronics Private Limited', tradeName: 'Aarav Electronics', state: 'Maharashtra', stateCode: '27', gstinValue: gstin('27', 'AABCA1234F1Z5') });
    const neel = baseCompany({ id: 'company-neel', name: 'Neel Advisory LLP', tradeName: 'Neel Advisory', state: 'Karnataka', stateCode: '29', gstinValue: gstin('29', 'AABCN3456L1ZK'), type: 'LLP' });
    const demo = baseCompany({ id: 'company-demo', name: 'Demo Company', tradeName: 'Demo Company', state: 'Delhi', stateCode: '07', gstinValue: gstin('07', 'AABCD7777E1ZQ'), type: 'Proprietorship' });
    [aarav, neel, demo].forEach(company => seedMasters(company));
    seedTransactions(aarav);
    seedTransactions(neel, true);
    seedCompliance(aarav);
    return { version: 1, activeCompanyId: aarav.id, activeView: 'overview', companies: [aarav, neel, demo] };
  }

  function seedMasters(company) {
    company.customers = [
      { id: `${company.id}-customer-riya`, name: 'Riya Services', legalName: 'Riya Services Private Limited', tradeName: 'Riya Services', gstin: company.stateCode === '27' ? '27AABCR8821Q1ZK' : '29AABCR8821Q1ZK', pan: 'AABCR8821Q', state: company.stateCode === '27' ? 'Maharashtra' : 'Karnataka', stateCode: company.stateCode === '27' ? '27' : '29', city: 'Pune', email: 'accounts@riyaservices.in', phone: '+91 98220 12345', terms: 30, openingBalance: 0, type: 'B2B' },
      { id: `${company.id}-customer-walkin`, name: 'Walk-in retail customer', legalName: '', tradeName: 'Walk-in retail customer', gstin: '', pan: '', state: company.state, stateCode: company.stateCode, city: company.city, email: '', phone: '', terms: 0, openingBalance: 0, type: 'B2C' }
    ];
    company.suppliers = [
      { id: `${company.id}-supplier-orbit`, name: 'Orbit Paper Traders', legalName: 'Orbit Paper Traders', tradeName: 'Orbit Paper Traders', gstin: company.stateCode === '27' ? '27AADCO4412L1ZP' : '29AADCO4412L1ZP', pan: 'AADCO4412L', state: company.stateCode === '27' ? 'Maharashtra' : 'Karnataka', stateCode: company.stateCode === '27' ? '27' : '29', city: 'Mumbai', email: 'billing@orbitpaper.in', phone: '+91 98190 56789', terms: 30, openingBalance: 0, itcRelevance: 'Eligible', rcm: false },
      { id: `${company.id}-supplier-cloud`, name: 'Cloudline Telecom', legalName: 'Cloudline Telecom Private Limited', tradeName: 'Cloudline Telecom', gstin: '29AAECC2233J1Z8', pan: 'AAECC2233J', state: 'Karnataka', stateCode: '29', city: 'Bengaluru', email: 'billing@cloudline.in', phone: '', terms: 15, openingBalance: 0, itcRelevance: 'Review', rcm: true }
    ];
  }

  function seedTransactions(company, serviceCompany = false) {
    const customer = company.customers[0];
    const supplier = company.suppliers[0];
    const serviceProduct = company.products.find(product => product.id === 'prod-install');
    const paper = company.products.find(product => product.id === 'prod-paper');
    const laptop = company.products.find(product => product.id === 'prod-laptop');
    const add = (input) => company.transactions.push(makeTransaction(company, input, { seed: true }));
    if (serviceCompany) {
      add({ type: 'sale', documentNumber: 'INV-NEEL-018', date: '2026-04-04', partyId: customer.id, placeOfSupply: 'Karnataka', items: [{ productId: serviceProduct.id, quantity: 3, rate: 18000, discount: 0 }], category: 'B2B' });
      add({ type: 'purchase', documentNumber: 'PUR-NEEL-021', date: '2026-04-08', partyId: supplier.id, placeOfSupply: 'Karnataka', items: [{ productId: serviceProduct.id, quantity: 1, rate: 12000, discount: 0 }], category: 'B2B', reconciliationStatus: 'matched' });
      return;
    }
     add({ type: 'sale', documentNumber: 'INV-104', date: '2026-04-02', dueDate: '2026-05-02', partyId: customer.id, placeOfSupply: 'Maharashtra', items: [{ productId: paper.id, quantity: 60, rate: 650, discount: 0 }], category: 'B2B', paymentStatus: 'Partly received', settledAmount: 23010, paymentDate: '2026-04-20', paymentMethod: 'Bank transfer' });
     add({ type: 'sale', documentNumber: 'INV-107', date: '2026-04-05', partyId: company.customers[1].id, placeOfSupply: 'Maharashtra', items: [{ productId: paper.id, quantity: 30, rate: 650, discount: 0 }], category: 'B2C', paymentStatus: 'Paid', settledAmount: 23010, paymentDate: '2026-04-05', paymentMethod: 'Cash' });
     add({ type: 'purchase', documentNumber: 'PUR-218', date: '2026-04-03', partyId: supplier.id, placeOfSupply: 'Maharashtra', items: [{ productId: paper.id, quantity: 100, rate: 400, discount: 0 }], category: 'B2B', reconciliationStatus: 'partial', settledAmount: 15000, paymentDate: '2026-04-21', paymentMethod: 'Bank transfer' });
     add({ type: 'purchase', documentNumber: 'PUR-221', date: '2026-04-06', partyId: supplier.id, placeOfSupply: 'Maharashtra', items: [{ productId: laptop.id, quantity: 1, rate: 52000, discount: 0 }], category: 'B2B', reconciliationStatus: 'matched', paymentStatus: 'Paid', settledAmount: 61360, paymentDate: '2026-04-06', paymentMethod: 'Bank transfer' });
    add({ type: 'purchase', documentNumber: 'PUR-204', date: '2026-04-10', partyId: company.suppliers[1].id, placeOfSupply: 'Karnataka', items: [{ productId: serviceProduct.id, quantity: 1, rate: 12000, discount: 0 }], category: 'B2B', reconciliationStatus: 'missing', rcm: true, itcStatus: 'Pending' });
    add({ type: 'credit_note', documentNumber: 'CN-009', date: '2026-04-12', partyId: customer.id, placeOfSupply: 'Maharashtra', originalDocument: 'INV-104', items: [{ productId: paper.id, quantity: 5, rate: 650, discount: 0 }], category: 'B2B' });
    add({ type: 'sale', documentNumber: 'INV-112', date: '2026-04-15', partyId: customer.id, placeOfSupply: 'Karnataka', items: [{ productId: laptop.id, quantity: 2, rate: 68000, discount: 5000 }], category: 'B2B', paymentStatus: 'Unpaid', reconciliationStatus: 'not-applicable' });
    add({ type: 'expense', documentNumber: 'EXP-041', date: '2026-04-18', partyId: supplier.id, placeOfSupply: 'Maharashtra', items: [{ productId: serviceProduct.id, quantity: 1, rate: 8000, discount: 0 }], category: 'Expense', reconciliationStatus: 'matched', itcStatus: 'Ineligible' });
    company.audit.unshift({ id: `audit-${company.id}-seed`, at: '2026-04-02T10:31:00.000Z', actor: 'System demo', action: 'Seeded April 2026 working company', source: 'Demo dataset', recordId: company.id, oldValue: '', newValue: '9 sample transactions' });
  }

  function seedCompliance(company) {
    company.notices = [{ id: 'notice-asmt-10', number: 'ASMT-10/2026/041', form: 'ASMT-10', date: '2026-05-15', issue: 'Difference in reported outward supplies', dueDate: '2026-05-28', responseDate: '', status: 'Response Required', assignedTo: 'Meera Shah', notes: 'Collect sales register and GSTR-1 working.' }];
    company.documents = [{ id: 'doc-reg', name: 'GST registration certificate', category: 'GST Registration', recordId: company.gstins[0].id, status: 'Verified', updatedAt: '2026-04-01' }, { id: 'doc-2b', name: 'GSTR-2B April 2026.xlsx', category: 'GSTR-2B', recordId: 'FY2026-04', status: 'Imported', updatedAt: '2026-05-14' }];
    company.tasks = [
      { id: 'task-sales', label: 'Sales entered and reviewed', group: 'Month-end closing', done: true },
      { id: 'task-purchases', label: 'Purchases entered and supplier balances checked', group: 'Month-end closing', done: true },
      { id: 'task-2b', label: 'GSTR-2B imported and ITC reconciled', group: 'Month-end closing', done: false },
      { id: 'task-gstr1', label: 'GSTR-1 preparation reviewed', group: 'Month-end closing', done: true },
      { id: 'task-gstr3b', label: 'GSTR-3B, liability and payment reviewed', group: 'Month-end closing', done: false },
      { id: 'task-filing', label: 'Record ARN / filing confirmation', group: 'Month-end closing', done: false }
    ];
  }

  function normalizeTransaction(transaction, company) {
    if (!transaction || typeof transaction !== 'object') return null;
    const fallbackProduct = company.products[0] || products[0];
    const items = Array.isArray(transaction.items) && transaction.items.length ? transaction.items : [{ productId: fallbackProduct.id, quantity: 1, rate: fallbackProduct.salesRate, gstRate: fallbackProduct.gstRate, discount: 0 }];
    const normalized = {
      ...transaction,
      companyId: company.id,
      financialYear: transaction.financialYear || company.financialYear,
      items,
      accounting: Array.isArray(transaction.accounting) ? transaction.accounting : [],
      tax: transaction.tax && typeof transaction.tax === 'object' ? transaction.tax : null,
      status: transaction.status || 'Posted',
      paymentStatus: transaction.paymentStatus || 'Unpaid',
      filingStatus: transaction.filingStatus || 'Not included',
      reconciliationStatus: transaction.reconciliationStatus || (transaction.type === 'purchase' ? 'Pending' : 'not-applicable'),
      itcStatus: transaction.itcStatus || (transaction.type === 'purchase' ? 'Eligible · pending 2B' : 'Not applicable'),
      createdAt: transaction.createdAt || now(),
       updatedAt: transaction.updatedAt || transaction.createdAt || now(),
       settledAmount: transaction.settledAmount !== null && transaction.settledAmount !== undefined && Number.isFinite(Number(transaction.settledAmount)) ? Number(transaction.settledAmount) : null,
       paymentDate: transaction.paymentDate || '', paymentMethod: transaction.paymentMethod || ''
    };
    const hasTaxData = tax => tax && typeof tax === 'object' && tax.details
      && ['taxable', 'cgst', 'sgst', 'igst', 'cess', 'taxTotal', 'total'].every(key => Number.isFinite(Number(tax[key])));
    if (!hasTaxData(normalized.tax)) {
      try {
        const rebuilt = makeTransaction(company, { ...normalized, id: normalized.id, items: normalized.items }, { seed: true });
        return {
          ...rebuilt,
          status: normalized.status,
          createdAt: normalized.createdAt,
          updatedAt: normalized.updatedAt,
          settledAmount: normalized.settledAmount,
          paymentDate: normalized.paymentDate,
          paymentMethod: normalized.paymentMethod
        };
      } catch {
        return {
          ...normalized,
          tax: { scenario: 'unknown', kind: normalized.type === 'purchase' ? 'purchase' : 'sale', taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, taxTotal: 0, total: 0, details: { shortLabel: 'Review tax details' } },
          accounting: []
        };
      }
    }
    if (!normalized.accounting.length) normalized.accounting = accountingFor(normalized);
    return normalized;
  }

  function normalizeCompany(company) {
    const normalized = {
      ...company,
      id: company?.id || `company-${Date.now()}`,
      name: company?.name || 'Ledgerly company',
      tradeName: company?.tradeName || company?.name || 'Ledgerly company',
      legalName: company?.legalName || company?.name || 'Ledgerly company',
      state: company?.state || 'Maharashtra',
      stateCode: company?.stateCode || '27',
      financialYear: company?.financialYear || 'FY 2026–27',
      registrationType: company?.registrationType || 'Regular',
      gstins: Array.isArray(company?.gstins) ? company.gstins : [],
      customers: Array.isArray(company?.customers) ? company.customers : [],
      suppliers: Array.isArray(company?.suppliers) ? company.suppliers : [],
      products: Array.isArray(company?.products) && company.products.length ? company.products : clone(products),
      transactions: Array.isArray(company?.transactions) ? company.transactions : [],
      notices: Array.isArray(company?.notices) ? company.notices : [],
      documents: Array.isArray(company?.documents) ? company.documents : [],
      tasks: Array.isArray(company?.tasks) ? company.tasks : [],
       audit: Array.isArray(company?.audit) ? company.audit : [],
       simulation: company?.simulation && typeof company.simulation === 'object' ? company.simulation : { completed: [], attempts: 0, feedback: {} }
    };
    if (!normalized.gstins.length) normalized.gstins = [{ id: `${normalized.id}-gstin-1`, gstin: `${normalized.stateCode}AABCL1234F1Z5`, state: normalized.state, stateCode: normalized.stateCode, status: 'Active', taxpayerType: 'Regular', registrationDate: '', principalPlace: normalized.address || '' }];
    normalized.activeGstinId = normalized.gstins.some(item => item.id === normalized.activeGstinId) ? normalized.activeGstinId : normalized.gstins[0].id;
    if (!normalized.customers.length || !normalized.suppliers.length) seedMasters(normalized);
    if (!normalized.tasks.length && normalized.transactions.length) seedCompliance(normalized);
    normalized.simulation = {
      completed: Array.isArray(normalized.simulation.completed) ? normalized.simulation.completed.filter(id => typeof id === 'string') : [],
       attempts: Number.isInteger(normalized.simulation.attempts) && normalized.simulation.attempts >= 0 ? normalized.simulation.attempts : 0,
       feedback: normalized.simulation.feedback && typeof normalized.simulation.feedback === 'object' ? normalized.simulation.feedback : {}
    };
    normalized.transactions = normalized.transactions.map(transaction => normalizeTransaction(transaction, normalized)).filter(Boolean);
    return normalized;
  }

  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored?.companies?.length) {
        const companies = stored.companies.map(normalizeCompany);
        const activeCompanyId = companies.some(company => company.id === stored.activeCompanyId) ? stored.activeCompanyId : companies[0].id;
        return { version: 1, activeCompanyId, activeView: stored.activeView || 'overview', companies };
      }
    } catch { /* Use the seeded workspace when browser storage is unavailable. */ }
    return seedState();
  }

  let state = read();

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* local-first fallback remains usable for this visit */ }
  }

  function activeCompany() { return state.companies.find(company => company.id === state.activeCompanyId) || state.companies[0]; }
  function companyById(id) { return state.companies.find(company => company.id === id) || activeCompany(); }
  function activeGstin(company = activeCompany()) { return company.gstins.find(gstinEntry => gstinEntry.id === company.activeGstinId) || company.gstins[0]; }
  function productById(company, id) { return company.products.find(product => product.id === id) || company.products[0]; }
  function partyById(company, id, type) { return (type === 'purchase' || type === 'expense' ? company.suppliers : company.customers).find(party => party.id === id); }
  function taxEngine() { return root.LedgerlyGST; }

  function inputLines(company, input) {
    const rawLines = Array.isArray(input.items) && input.items.length ? input.items : [{ productId: company.products[0].id, quantity: 1, rate: input.taxable || 0, discount: 0 }];
    return rawLines.map(line => {
      const product = productById(company, line.productId);
      return { ...line, productId: product.id, description: line.description || product.name, hsnSac: line.hsnSac || product.hsnSac, unit: line.unit || product.unit, quantity: Math.max(0, Number(line.quantity || 0)), rate: Math.max(0, Number(line.rate ?? product.salesRate ?? 0)), gstRate: Math.max(0, Number(line.gstRate ?? product.gstRate ?? 0)), cessRate: Math.max(0, Number(line.cessRate ?? product.cessRate ?? 0)), discount: Math.max(0, Number(line.discount || 0)) };
    });
  }

  function calculateTax(company, input, lines) {
    const registration = activeGstin(company);
    const party = partyById(company, input.partyId, input.type);
    const engine = taxEngine();
    const placeState = input.placeOfSupplyStateCode || party?.stateCode || (String(input.placeOfSupply || '').toLowerCase() === String(company.state || '').toLowerCase() ? company.stateCode : input.placeOfSupply || company.stateCode);
    if (engine?.calculateInvoice) return engine.calculateInvoice({ lines, supplierState: registration?.stateCode || company.stateCode, placeOfSupply: placeState, supplierGSTIN: registration?.gstin, recipientGSTIN: party?.gstin, kind: input.type === 'purchase' ? 'purchase' : 'sale', reverseCharge: Boolean(input.rcm) });
    return { scenario: 'unknown', lines, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, taxTotal: 0, total: 0, hasTax: false, details: { shortLabel: 'GST engine unavailable' } };
  }

  function multiplierFor(type) { return type === 'credit_note' || type === 'debit_note' || type === 'purchase_return' || type === 'sales_return' ? -1 : 1; }

  function accountingFor(transaction) {
    const sign = multiplierFor(transaction.type);
    const total = moneyNumber(transaction.tax.total * sign);
    const taxable = moneyNumber(transaction.tax.taxable * sign);
    const lines = [];
    const partyLabel = transaction.partyName || 'Counterparty';
    if (['sale'].includes(transaction.type)) {
      lines.push({ account: `Customer · ${partyLabel}`, debit: total, credit: 0, source: 'Invoice total' });
      lines.push({ account: 'Sales', debit: 0, credit: taxable, source: 'Taxable value' });
      if (transaction.tax.cgst) lines.push({ account: 'Output CGST', debit: 0, credit: moneyNumber(transaction.tax.cgst * sign), source: 'GST engine' });
      if (transaction.tax.sgst) lines.push({ account: 'Output SGST', debit: 0, credit: moneyNumber(transaction.tax.sgst * sign), source: 'GST engine' });
      if (transaction.tax.igst) lines.push({ account: 'Output IGST', debit: 0, credit: moneyNumber(transaction.tax.igst * sign), source: 'GST engine' });
      if (transaction.tax.cess) lines.push({ account: 'Output Cess', debit: 0, credit: moneyNumber(transaction.tax.cess * sign), source: 'GST engine' });
    } else if (['credit_note', 'sales_return'].includes(transaction.type)) {
      lines.push({ account: 'Sales Returns', debit: Math.abs(taxable), credit: 0, source: 'Taxable value' });
      if (transaction.tax.cgst) lines.push({ account: 'Output CGST', debit: Math.abs(transaction.tax.cgst), credit: 0, source: 'GST engine' });
      if (transaction.tax.sgst) lines.push({ account: 'Output SGST', debit: Math.abs(transaction.tax.sgst), credit: 0, source: 'GST engine' });
      if (transaction.tax.igst) lines.push({ account: 'Output IGST', debit: Math.abs(transaction.tax.igst), credit: 0, source: 'GST engine' });
      if (transaction.tax.cess) lines.push({ account: 'Output Cess', debit: Math.abs(transaction.tax.cess), credit: 0, source: 'GST engine' });
      lines.push({ account: `Customer · ${partyLabel}`, debit: 0, credit: Math.abs(total), source: 'Invoice total' });
    } else if (['purchase', 'expense'].includes(transaction.type)) {
      lines.push({ account: `Purchases / Expense`, debit: taxable, credit: 0, source: 'Taxable value' });
      if (transaction.tax.cgst) lines.push({ account: 'Input CGST', debit: moneyNumber(transaction.tax.cgst * sign), credit: 0, source: 'GST engine' });
      if (transaction.tax.sgst) lines.push({ account: 'Input SGST', debit: moneyNumber(transaction.tax.sgst * sign), credit: 0, source: 'GST engine' });
      if (transaction.tax.igst) lines.push({ account: 'Input IGST', debit: moneyNumber(transaction.tax.igst * sign), credit: 0, source: 'GST engine' });
      if (transaction.tax.cess) lines.push({ account: 'Input Cess', debit: moneyNumber(transaction.tax.cess * sign), credit: 0, source: 'GST engine' });
      lines.push({ account: `Supplier · ${partyLabel}`, debit: 0, credit: transaction.rcm ? taxable : total, source: transaction.rcm ? 'Taxable invoice value' : 'Invoice total' });
      if (transaction.rcm) lines.push({ account: 'RCM GST Liability', debit: 0, credit: moneyNumber(transaction.tax.taxTotal * sign), source: 'Reverse charge flag' });
    } else if (['debit_note', 'purchase_return'].includes(transaction.type)) {
      lines.push({ account: `Supplier · ${partyLabel}`, debit: Math.abs(total), credit: 0, source: 'Invoice total' });
      lines.push({ account: 'Purchase Returns', debit: 0, credit: Math.abs(taxable), source: 'Taxable value' });
      if (transaction.tax.cgst) lines.push({ account: 'Input CGST', debit: 0, credit: Math.abs(transaction.tax.cgst), source: 'GST engine' });
      if (transaction.tax.sgst) lines.push({ account: 'Input SGST', debit: 0, credit: Math.abs(transaction.tax.sgst), source: 'GST engine' });
      if (transaction.tax.igst) lines.push({ account: 'Input IGST', debit: 0, credit: Math.abs(transaction.tax.igst), source: 'GST engine' });
      if (transaction.tax.cess) lines.push({ account: 'Input Cess', debit: 0, credit: Math.abs(transaction.tax.cess), source: 'GST engine' });
    }
    return lines.filter(line => line.debit || line.credit);
  }

  function makeTransaction(company, input, { seed = false } = {}) {
    const party = partyById(company, input.partyId, input.type);
    const lines = inputLines(company, input);
    const tax = calculateTax(company, input, lines);
    const transaction = {
      id: input.id || `${input.type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      companyId: company.id, financialYear: input.financialYear || company.financialYear, gstinId: input.gstinId || company.activeGstinId,
      type: input.type || 'sale', documentNumber: input.documentNumber || `DOC-${String(company.transactions.length + 1).padStart(3, '0')}`,
      date: input.date || new Date().toISOString().slice(0, 10), dueDate: input.dueDate || '', placeOfSupply: input.placeOfSupply || party?.state || company.state,
      placeOfSupplyStateCode: input.placeOfSupplyStateCode || party?.stateCode || company.stateCode, partyId: input.partyId || '', partyName: party?.name || input.partyName || '', partyGSTIN: party?.gstin || input.partyGSTIN || '', partyState: party?.state || input.partyState || '',
       category: input.category || (party?.gstin ? 'B2B' : 'B2C'), originalDocument: input.originalDocument || '', rcm: Boolean(input.rcm), source: input.source || 'Ledgerly Work',
       status: input.status || 'Draft', paymentStatus: input.paymentStatus || 'Unpaid', filingStatus: input.filingStatus || 'Not included', reconciliationStatus: input.reconciliationStatus || (input.type === 'purchase' ? 'Pending' : 'not-applicable'),
       itcStatus: input.itcStatus || (input.type === 'purchase' ? 'Eligible · pending 2B' : 'Not applicable'), items: lines, tax, accounting: [], createdAt: input.createdAt || now(), updatedAt: now(), settledAmount: input.settledAmount !== null && input.settledAmount !== undefined && Number.isFinite(Number(input.settledAmount)) ? Math.max(0, Number(input.settledAmount)) : null, paymentDate: input.paymentDate || '', paymentMethod: input.paymentMethod || ''
    };
    transaction.accounting = accountingFor(transaction);
    if (!seed) transaction.status = 'Posted';
    return transaction;
  }

  function addAudit(company, action, recordId, oldValue = '', newValue = '', source = 'Ledgerly Work') {
    company.audit.unshift({ id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, at: now(), actor: 'Current user', action, source, recordId, oldValue: typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue), newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue) });
  }

  function createTransaction(input) {
    const company = activeCompany();
    const transaction = makeTransaction(company, input);
    company.transactions.unshift(transaction);
    addAudit(company, `${transaction.type} ${transaction.documentNumber} created`, transaction.id, '', transaction.tax.total, 'Transaction form');
    persist();
    return transaction;
  }

  function updateTransaction(id, changes) {
    const company = activeCompany();
    const index = company.transactions.findIndex(transaction => transaction.id === id);
    if (index < 0) throw new Error('Transaction not found.');
    const before = company.transactions[index];
    const updated = makeTransaction(company, { ...before, ...changes, id: before.id, items: changes.items || before.items }, { seed: true });
    company.transactions[index] = { ...updated, status: changes.status || before.status, createdAt: before.createdAt };
    addAudit(company, `${updated.documentNumber} updated`, id, before, company.transactions[index], 'Transaction form');
    persist();
    return company.transactions[index];
  }

  function toggleTask(taskId) {
    const company = activeCompany();
    const task = company.tasks.find(item => item.id === taskId);
    if (!task) return;
    task.done = !task.done;
    addAudit(company, task.done ? `Compliance task completed: ${task.label}` : `Compliance task reopened: ${task.label}`, task.id, !task.done, task.done, 'Month-end assistant');
    persist();
  }

  function addCompany(input) {
    const stateCode = String(input.stateCode || '27').padStart(2, '0').slice(0, 2);
    const id = `company-${Date.now()}`;
    const company = baseCompany({ id, name: input.name || 'New company', tradeName: input.tradeName || input.name || 'New company', state: input.state || 'Maharashtra', stateCode, gstinValue: input.gstin || `${stateCode}AABCN${String(Date.now()).slice(-4)}1Z5`, type: input.businessType || 'Proprietorship' });
    seedMasters(company);
    company.pan = input.pan || company.pan;
    company.email = input.email || company.email;
    state.companies.push(company);
    state.activeCompanyId = company.id;
    addAudit(company, 'Company created', company.id, '', company.name, 'Company setup');
    persist();
    return company;
  }

  function addMaster(type, input) {
    const company = activeCompany();
    const collection = type === 'customer' ? company.customers : type === 'supplier' ? company.suppliers : company.products;
    const item = { ...input, id: `${type}-${Date.now()}` };
    collection.unshift(item);
    addAudit(company, `${type} master created`, item.id, '', item.name, 'Master data');
    persist();
    return item;
  }

  function addGSTIN(input) {
    const company = activeCompany();
    const value = String(input.gstin || '').trim().toUpperCase();
    if (!value) throw new Error('GSTIN is required.');
    if (company.gstins.some(item => item.gstin === value)) throw new Error('This GSTIN already exists in the active company.');
    const item = { id: `gstin-${Date.now()}`, gstin: value, state: input.state || company.state, stateCode: input.stateCode || company.stateCode, status: 'Active', taxpayerType: input.taxpayerType || 'Regular', registrationDate: input.registrationDate || '', principalPlace: input.principalPlace || company.address, additionalPlaces: 0 };
    company.gstins.push(item);
    addAudit(company, 'GSTIN added', item.id, '', item.gstin, 'GSTIN master');
    persist();
    return item;
  }

  function summaryFor(company = activeCompany()) {
    const transactions = company.transactions.filter(transaction => transaction.financialYear === company.financialYear);
    const sales = transactions.filter(transaction => ['sale', 'credit_note', 'sales_return'].includes(transaction.type));
    const purchases = transactions.filter(transaction => ['purchase', 'debit_note', 'purchase_return', 'expense'].includes(transaction.type));
    const outputTax = moneyNumber(sales.reduce((total, transaction) => total + transaction.tax.taxTotal * multiplierFor(transaction.type), 0));
    const inputTax = moneyNumber(purchases.filter(transaction => transaction.type === 'purchase').reduce((total, transaction) => total + transaction.tax.taxTotal, 0));
    const matchedITC = moneyNumber(purchases.filter(transaction => transaction.type === 'purchase' && transaction.reconciliationStatus === 'matched' && transaction.itcStatus !== 'Ineligible').reduce((total, transaction) => total + transaction.tax.taxTotal, 0));
    const pendingITC = moneyNumber(purchases.filter(transaction => transaction.type === 'purchase' && ['partial', 'missing', 'Pending'].includes(transaction.reconciliationStatus) && transaction.itcStatus !== 'Ineligible').reduce((total, transaction) => total + transaction.tax.taxTotal, 0));
    const ineligibleITC = moneyNumber(purchases.filter(transaction => transaction.itcStatus === 'Ineligible').reduce((total, transaction) => total + transaction.tax.taxTotal, 0));
    const cashLedger = 24800;
    const creditLedger = matchedITC;
    const liability = outputTax + purchases.filter(transaction => transaction.rcm).reduce((total, transaction) => total + transaction.tax.taxTotal, 0);
    const netPayable = moneyNumber(Math.max(0, liability - creditLedger));
    const openNotices = company.notices.filter(notice => notice.status !== 'Closed').length;
    const openTasks = company.tasks.filter(task => !task.done).length;
    const exceptions = getExceptions(company);
    return { salesCount: sales.length, purchaseCount: purchases.length, salesValue: moneyNumber(sales.reduce((total, transaction) => total + transaction.tax.total * multiplierFor(transaction.type), 0)), purchaseValue: moneyNumber(purchases.reduce((total, transaction) => total + transaction.tax.total * multiplierFor(transaction.type), 0)), outputTax, inputTax, matchedITC, pendingITC, ineligibleITC, openingITC: 0, reversedITC: 0, utilisedITC: creditLedger, closingITC: creditLedger, cashLedger, creditLedger, liability: moneyNumber(liability), netPayable, openNotices, openTasks, exceptions, matchedCount: purchases.filter(transaction => transaction.reconciliationStatus === 'matched').length, purchaseRows: purchases.filter(transaction => transaction.type === 'purchase').length };
  }

  function getReturnSummary(company = activeCompany()) {
    const summary = summaryFor(company);
    const sales = company.transactions.filter(transaction => transaction.financialYear === company.financialYear && ['sale', 'credit_note', 'sales_return'].includes(transaction.type));
    const b2b = sales.filter(transaction => transaction.category === 'B2B');
    const b2c = sales.filter(transaction => transaction.category === 'B2C');
    const hsn = {};
    sales.forEach(transaction => (transaction.tax.lines || transaction.items).forEach(item => { const taxable = Number(item.taxable ?? (Number(item.quantity || 0) * Number(item.rate || item.ratePerUnit || 0))); const tax = Number(item.taxTotal || 0); hsn[item.hsnSac] ||= { code: item.hsnSac, description: item.description, quantity: 0, taxable: 0, tax: 0 }; hsn[item.hsnSac].quantity += Number(item.quantity || 0) * multiplierFor(transaction.type); hsn[item.hsnSac].taxable += taxable * multiplierFor(transaction.type); hsn[item.hsnSac].tax += tax * multiplierFor(transaction.type); }));
    const rcmTax = company.transactions.filter(transaction => transaction.financialYear === company.financialYear && transaction.rcm).reduce((total, transaction) => total + transaction.tax.taxTotal, 0);
    return { gstr1: { b2bCount: b2b.length, b2cCount: b2c.length, taxable: summary.salesValue, cgst: sales.reduce((total, transaction) => total + transaction.tax.cgst * multiplierFor(transaction.type), 0), sgst: sales.reduce((total, transaction) => total + transaction.tax.sgst * multiplierFor(transaction.type), 0), igst: sales.reduce((total, transaction) => total + transaction.tax.igst * multiplierFor(transaction.type), 0), notes: sales.filter(transaction => ['credit_note', 'debit_note'].includes(transaction.type)).length, hsn: Object.values(hsn) }, gstr3b: { outwardTaxable: summary.salesValue, outwardTax: summary.outputTax, exempt: 0, zeroRated: 0, rcmTax, eligibleITC: summary.matchedITC, pendingITC: summary.pendingITC, ineligibleITC: summary.ineligibleITC, netITC: moneyNumber(summary.matchedITC - summary.reversedITC), netLiability: summary.netPayable } };
  }

  function getLedgers(company = activeCompany()) {
    const ledgers = {};
    company.transactions.filter(transaction => transaction.financialYear === company.financialYear).forEach(transaction => transaction.accounting.forEach(line => {
      ledgers[line.account] ||= { name: line.account, debit: 0, credit: 0, entries: [] };
      ledgers[line.account].debit = moneyNumber(ledgers[line.account].debit + line.debit);
      ledgers[line.account].credit = moneyNumber(ledgers[line.account].credit + line.credit);
      ledgers[line.account].entries.push({ date: transaction.date, documentNumber: transaction.documentNumber, debit: line.debit, credit: line.credit, source: line.source });
    }));
    Object.values(ledgers).forEach(ledger => { ledger.balance = moneyNumber(ledger.debit - ledger.credit); ledger.side = ledger.balance >= 0 ? 'Dr' : 'Cr'; });
    return Object.values(ledgers).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }

  function settlementAmount(transaction) {
    if (transaction.settledAmount !== null && transaction.settledAmount !== undefined && Number.isFinite(Number(transaction.settledAmount))) return Math.min(transaction.tax.total, Math.max(0, Number(transaction.settledAmount)));
    if (transaction.paymentStatus === 'Paid') return transaction.tax.total;
    if (transaction.paymentStatus === 'Partly received' || transaction.paymentStatus === 'Partly paid') return transaction.tax.total * 0.5;
    return 0;
  }

  function paymentReceived(transaction) { return settlementAmount(transaction); }
  function paymentMade(transaction) { return settlementAmount(transaction); }

  function ageLabel(days) {
    if (days <= 0) return 'Current';
    if (days <= 30) return '1–30 days';
    if (days <= 60) return '31–60 days';
    return '60+ days';
  }

  function getOperationalReports(company = activeCompany()) {
    const transactions = company.transactions
      .filter(transaction => transaction.financialYear === company.financialYear)
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const asOf = transactions.reduce((latest, transaction) => transaction.date > latest ? transaction.date : latest, '2026-04-30');
    const asOfTime = new Date(`${asOf}T12:00:00Z`).getTime();
    const age = date => Math.max(0, Math.floor((asOfTime - new Date(`${date}T12:00:00Z`).getTime()) / 86400000));
    const receivableTransactions = transactions.filter(transaction => ['sale', 'credit_note', 'sales_return'].includes(transaction.type));
    const payableTransactions = transactions.filter(transaction => ['purchase', 'debit_note', 'purchase_return', 'expense'].includes(transaction.type));
    const groupBalances = (items, isReceivable) => {
      const groups = {};
      items.forEach(transaction => {
        const sign = multiplierFor(transaction.type);
        const invoiceValue = moneyNumber(transaction.tax.total * sign);
        const settled = moneyNumber((isReceivable ? paymentReceived(transaction) : paymentMade(transaction)) * sign);
        const key = transaction.partyId || transaction.partyName || 'unassigned';
        groups[key] ||= { id: key, party: transaction.partyName || 'Unassigned party', invoices: 0, settled: 0, balance: 0, oldestDate: transaction.date, documents: [] };
        groups[key].invoices = moneyNumber(groups[key].invoices + invoiceValue);
        groups[key].settled = moneyNumber(groups[key].settled + settled);
        groups[key].balance = moneyNumber(groups[key].invoices - groups[key].settled);
        if (transaction.date < groups[key].oldestDate) groups[key].oldestDate = transaction.date;
        groups[key].documents.push(transaction.documentNumber);
      });
      return Object.values(groups).map(row => ({ ...row, days: age(row.oldestDate), age: ageLabel(age(row.oldestDate)), status: row.balance <= 0 ? 'Settled' : row.settled ? 'Partly settled' : 'Open' }))
        .filter(row => row.invoices || row.balance).sort((a, b) => b.balance - a.balance);
    };
    const receivables = groupBalances(receivableTransactions, true);
    const payables = groupBalances(payableTransactions, false);
    const cashOpening = 24800;
    const cashIn = moneyNumber(receivableTransactions.reduce((total, transaction) => total + paymentReceived(transaction) * multiplierFor(transaction.type), 0));
    const cashOut = moneyNumber(payableTransactions.reduce((total, transaction) => total + paymentMade(transaction) * multiplierFor(transaction.type), 0));
    const monthlyMap = {};
    transactions.forEach(transaction => {
      const month = transaction.date.slice(0, 7);
      monthlyMap[month] ||= { month, sales: 0, purchases: 0, cashIn: 0, cashOut: 0 };
      const value = moneyNumber(transaction.tax.total * multiplierFor(transaction.type));
      if (['sale', 'credit_note', 'sales_return'].includes(transaction.type)) {
        monthlyMap[month].sales = moneyNumber(monthlyMap[month].sales + value);
        monthlyMap[month].cashIn = moneyNumber(monthlyMap[month].cashIn + paymentReceived(transaction) * multiplierFor(transaction.type));
      } else {
        monthlyMap[month].purchases = moneyNumber(monthlyMap[month].purchases + value);
        monthlyMap[month].cashOut = moneyNumber(monthlyMap[month].cashOut + paymentMade(transaction) * multiplierFor(transaction.type));
      }
    });
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).map(row => ({ ...row, net: moneyNumber(row.cashIn - row.cashOut) }));
    return {
      asOf,
      receivables,
      payables,
      monthly,
      cash: { opening: cashOpening, inflow: cashIn, outflow: cashOut, movement: moneyNumber(cashIn - cashOut), closing: moneyNumber(cashOpening + cashIn - cashOut) },
      totals: { receivables: moneyNumber(receivables.reduce((total, row) => total + Math.max(0, row.balance), 0)), payables: moneyNumber(payables.reduce((total, row) => total + Math.max(0, row.balance), 0)) }
    };
  }

  function recordSettlement(partyId, amount, paymentDate = new Date().toISOString().slice(0, 10), paymentMethod = 'Bank transfer') {
    const company = activeCompany();
    const requested = moneyNumber(Math.max(0, Number(amount) || 0));
    if (!requested) throw new Error('Enter a settlement amount greater than zero.');
    const reports = getOperationalReports(company);
    const outstanding = [...reports.receivables, ...reports.payables].find(row => row.id === partyId)?.balance || 0;
    const applicable = moneyNumber(Math.min(requested, Math.max(0, outstanding)));
    let remaining = applicable;
    if (!applicable) throw new Error('No open invoice balance was found for this party.');
    const transactions = company.transactions.filter(transaction => transaction.financialYear === company.financialYear && transaction.partyId === partyId && ['sale', 'purchase', 'expense'].includes(transaction.type)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let applied = 0;
    transactions.forEach(transaction => {
      const already = settlementAmount(transaction);
      const available = Math.max(0, transaction.tax.total - already);
      const allocation = Math.min(available, remaining);
      if (!allocation) return;
      transaction.settledAmount = moneyNumber(already + allocation);
      transaction.paymentDate = paymentDate;
      transaction.paymentMethod = paymentMethod;
      transaction.paymentStatus = transaction.settledAmount >= transaction.tax.total ? 'Paid' : transaction.type === 'sale' ? 'Partly received' : 'Partly paid';
      transaction.updatedAt = now();
      remaining = moneyNumber(remaining - allocation);
      applied = moneyNumber(applied + allocation);
      addAudit(company, `${transaction.documentNumber} settlement recorded`, transaction.id, '', allocation, 'Receivables / payables report');
    });
    if (!applied) throw new Error('No open invoice balance was found for this party.');
    persist();
    return { applied, unapplied: moneyNumber(requested - applied) };
  }

  function monthEndCase(company = activeCompany()) {
    const sourceTransactions = [
      { id: 'case-capital', date: '2026-04-01', document: 'CAP-001', title: 'Owner introduces capital', story: 'The owner deposits funds into the business bank account.', debit: 'Business Bank', credit: "Owner's Capital", amount: 120000 },
      { id: 'case-purchase-credit', date: '2026-04-02', document: 'PUR-002', title: 'Buy stock on credit', story: 'Buy 100 paper reams at ₹500 each from the supplier on credit.', debit: 'Purchases', credit: 'Orbit Paper Traders', amount: 50000 },
      { id: 'case-purchase-cash', date: '2026-04-03', document: 'PUR-003', title: 'Buy stock for cash', story: 'Buy another 40 paper reams at ₹500 each and pay from cash.', debit: 'Purchases', credit: 'Cash in hand', amount: 20000 },
      { id: 'case-credit-sale', date: '2026-04-06', document: 'INV-004', title: 'Make a credit sale', story: 'Sell 50 paper reams at ₹1,500 each to a business customer on credit.', debit: 'Riya Services', credit: 'Sales', amount: 75000 },
      { id: 'case-cash-sale', date: '2026-04-08', document: 'INV-005', title: 'Serve a walk-in customer', story: 'Sell 24 paper reams at ₹1,500 each for cash.', debit: 'Cash in hand', credit: 'Sales', amount: 36000 },
      { id: 'case-receipt', date: '2026-04-12', document: 'REC-006', title: 'Collect part of the invoice', story: 'The customer pays ₹30,000 into the business bank account.', debit: 'Business Bank', credit: 'Riya Services', amount: 30000 },
      { id: 'case-payment', date: '2026-04-14', document: 'PAY-007', title: 'Pay the supplier', story: 'Pay ₹20,000 against the existing purchase bill from the bank.', debit: 'Orbit Paper Traders', credit: 'Business Bank', amount: 20000 },
      { id: 'case-rent', date: '2026-04-18', document: 'RENT-008', title: 'Pay office rent', story: 'Pay April office rent from the business bank.', debit: 'Office Rent', credit: 'Business Bank', amount: 8000 },
      { id: 'case-salary', date: '2026-04-20', document: 'SAL-009', title: 'Pay salaries', story: 'Pay part of the month’s salaries in cash.', debit: 'Office Salaries', credit: 'Cash in hand', amount: 6000 },
      { id: 'case-furniture', date: '2026-04-22', document: 'AST-010', title: 'Buy office furniture', story: 'Purchase office furniture and pay immediately from the bank.', debit: 'Office Furniture', credit: 'Business Bank', amount: 24000 },
      { id: 'case-drawings', date: '2026-04-23', document: 'DRAW-011', title: 'Record owner drawings', story: 'The owner withdraws business cash for personal use.', debit: 'Drawings', credit: 'Cash in hand', amount: 5000 },
      { id: 'case-insurance', date: '2026-04-24', document: 'INS-012', title: 'Pay annual insurance', story: 'Pay ₹6,000 for 12 months of insurance beginning in April.', debit: 'Prepaid Insurance', credit: 'Business Bank', amount: 6000 },
      { id: 'case-interest', date: '2026-04-30', document: 'INT-013', title: 'Receive bank interest', story: 'The bank credits interest earned during April.', debit: 'Business Bank', credit: 'Interest Income', amount: 400 }
    ];
    const adjustments = [
      { id: 'case-adjust-salary', date: '2026-04-30', document: 'ADJ-014', title: 'Accrue unpaid salaries', story: 'Recognise ₹2,000 earned by staff but still unpaid at month-end.', debit: 'Office Salaries', credit: 'Salaries Payable', amount: 2000, voucher: 'Journal' },
      { id: 'case-adjust-depreciation', date: '2026-04-30', document: 'ADJ-015', title: 'Record depreciation', story: 'Record ₹1,000 April depreciation on office furniture.', debit: 'Depreciation Expense', credit: 'Accumulated Depreciation', amount: 1000, voucher: 'Journal' },
      { id: 'case-adjust-insurance', date: '2026-04-30', document: 'ADJ-016', title: 'Expense one month of insurance', story: 'Recognise one month of the prepaid annual insurance: ₹500.', debit: 'Insurance Expense', credit: 'Prepaid Insurance', amount: 500, voucher: 'Journal' }
    ];
    const entries = [...sourceTransactions, ...adjustments];
    const balances = {};
    entries.forEach(entry => {
      balances[entry.debit] = moneyNumber((balances[entry.debit] || 0) + entry.amount);
      balances[entry.credit] = moneyNumber((balances[entry.credit] || 0) - entry.amount);
    });
    const closingStock = 33000;
    const netSales = 111000;
    const netPurchases = 70000;
    const costOfGoodsSold = netPurchases - closingStock;
    const grossProfit = netSales - costOfGoodsSold;
    const operatingExpenses = 8000 + 8000 + 1000 + 500;
    const otherIncome = 400;
    const profit = grossProfit - operatingExpenses + otherIncome;
    const assets = [
      ['Business Bank', balances['Business Bank'], 'Current asset'], ['Cash in hand', balances['Cash in hand'], 'Current asset'], ['Riya Services receivable', balances['Riya Services'], 'Current asset'],
      ['Closing inventory', closingStock, 'Current asset'], ['Office Furniture, net', balances['Office Furniture'] + balances['Accumulated Depreciation'], 'Fixed asset'], ['Prepaid Insurance', balances['Prepaid Insurance'], 'Current asset']
    ];
    const liabilities = [['Orbit Paper Traders payable', -balances['Orbit Paper Traders'], 'Current liability'], ['Salaries Payable', -balances['Salaries Payable'], 'Current liability']];
    const equity = [["Owner's Capital", -balances["Owner's Capital"], 'Equity'], ['Drawings', -balances.Drawings, 'Equity deduction'], ['Current-period profit', profit, 'Equity']];
    const trialBalance = Object.entries(balances).map(([account, balance]) => ({ account, debit: balance > 0 ? balance : 0, credit: balance < 0 ? -balance : 0 })).filter(row => row.debit || row.credit);
    return { company: company.tradeName || company.name, period: 'April 2026', asOf: '2026-04-30', sourceTransactions, adjustments, closingStock, netSales, netPurchases, costOfGoodsSold, grossProfit, operatingExpenses, otherIncome, profit, balances, assets, liabilities, equity, trialBalance, trialDebit: moneyNumber(trialBalance.reduce((total, row) => total + row.debit, 0)), trialCredit: moneyNumber(trialBalance.reduce((total, row) => total + row.credit, 0)) };
  }

  function getMonthEndSimulation(company = activeCompany()) {
    const reports = getOperationalReports(company);
    const summary = summaryFor(company);
    const caseData = monthEndCase(company);
    const completed = new Set(company.simulation.completed);
    const tasks = [
      { id: 'source-trail', label: 'Read the source trail', prompt: 'Which document records the customer paying an existing invoice?', options: ['REC-006 · Receipt', 'INV-005 · Sales invoice', 'ADJ-014 · Journal'], answer: 0, explanation: 'A receipt records money collected against an existing receivable; it does not create another sale.' },
      { id: 'closing-adjustments', label: 'Choose the closing entry', prompt: 'How should unpaid April salaries of ₹2,000 be recorded?', options: ['Debit Office Salaries; credit Salaries Payable', 'Debit Salaries Payable; credit Office Salaries', 'Debit Cash; credit Office Salaries'], answer: 0, explanation: 'The expense belongs to April even though cash has not moved, so debit the expense and credit the liability.' },
      { id: 'closing-stock', label: 'Value the closing stock', prompt: `The count shows closing stock of ₹${caseData.closingStock.toLocaleString('en-IN')}. What does it do to April’s result?`, options: [`It reduces cost of goods sold to ₹${caseData.costOfGoodsSold.toLocaleString('en-IN')}`, 'It is treated as an operating expense', 'It is added to sales income'], answer: 0, explanation: 'Under the periodic inventory approach, closing stock is deducted from net purchases to calculate cost of goods sold and remains an asset.' },
      { id: 'profit-check', label: 'Find the period result', prompt: `Sales are ₹${caseData.netSales.toLocaleString('en-IN')}, COGS after closing stock is ₹${caseData.costOfGoodsSold.toLocaleString('en-IN')}, and operating expenses are ₹${caseData.operatingExpenses.toLocaleString('en-IN')}. What is the net result after ₹${caseData.otherIncome.toLocaleString('en-IN')} other income?`, options: [`Profit ₹${caseData.profit.toLocaleString('en-IN')}`, `Profit ₹${(caseData.profit + 10000).toLocaleString('en-IN')}`, `Loss ₹${caseData.profit.toLocaleString('en-IN')}`], answer: 0, explanation: `Gross profit is ₹${caseData.grossProfit.toLocaleString('en-IN')}; subtract operating expenses and add other income to reach a profit of ₹${caseData.profit.toLocaleString('en-IN')}.` },
      { id: 'trial-balance', label: 'Check the books', prompt: `The month-end trial balance shows Debit ₹${caseData.trialDebit.toLocaleString('en-IN')} and Credit ₹${caseData.trialCredit.toLocaleString('en-IN')}. What is the checkpoint result?`, options: ['Balanced — total debits equal total credits', 'Unbalanced — closing stock must be posted twice', 'Not applicable until the return is filed'], answer: caseData.trialDebit === caseData.trialCredit ? 0 : 1, explanation: caseData.trialDebit === caseData.trialCredit ? 'The source entries and closing adjustments balance. Closing stock is then used in the statement calculation.' : 'Trace the unequal accounting lines before closing the month.' },
      { id: 'balance-sheet', label: 'Tie the statements', prompt: `Total assets are ₹${moneyNumber(caseData.assets.reduce((total, row) => total + row[1], 0)).toLocaleString('en-IN')}. Which equation should agree?`, options: [`Assets = liabilities ₹${moneyNumber(caseData.liabilities.reduce((total, row) => total + row[1], 0))} + equity ₹${moneyNumber(caseData.equity.reduce((total, row) => total + row[1], 0))}`, 'Assets = sales + purchases', 'Assets = cash received only'], answer: 0, explanation: 'The balance sheet ties the assets to liabilities and equity; profit and drawings are carried into equity.' },
      { id: 'control-priority', label: 'Choose the handoff', prompt: `The Work company has ${reports.receivables.length} receivable group${reports.receivables.length === 1 ? '' : 's'} and ${summary.pendingITC ? moneyNumber(summary.pendingITC) : 'pending'} of purchase tax under review. What comes before the official filing handoff?`, options: ['Review ageing and reconcile ITC evidence', 'Delete unpaid invoices', 'Treat every pending amount as paid'], answer: 0, explanation: 'Month-end control means the open customer/supplier balances and tax evidence are reviewed before the official portal step.' }
    ];
    return { caseData, tasks: tasks.map(task => ({ ...task, completed: completed.has(task.id), feedback: company.simulation.feedback[task.id] || null })), completed: tasks.filter(task => completed.has(task.id)).length, attempts: company.simulation.attempts, cash: reports.cash, netPayable: summary.netPayable };
  }

  function completeSimulationTask(taskId, answer) {
    const company = activeCompany();
    const simulation = getMonthEndSimulation(company);
    const task = simulation.tasks.find(item => item.id === taskId);
    if (!task) return { correct: false, message: 'That simulation step is unavailable.' };
    company.simulation.attempts += 1;
    const correct = Number(answer) === task.answer;
    company.simulation.feedback[task.id] = { correct, message: correct ? task.explanation : `Not yet. ${task.explanation}` };
    if (correct && !company.simulation.completed.includes(task.id)) {
      company.simulation.completed.push(task.id);
      addAudit(company, `Month-end simulation step completed: ${task.label}`, task.id, '', task.options[task.answer], 'Month-end simulation');
    }
    persist();
    return { correct, task, completed: company.simulation.completed.length, message: correct ? task.explanation : `Not yet. ${task.explanation}` };
  }

  function resetSimulation() {
    const company = activeCompany();
    company.simulation = { completed: [], attempts: 0, feedback: {} };
    addAudit(company, 'Month-end simulation restarted', company.id, '', 'Fresh simulation', 'Month-end simulation');
    persist();
  }

  function getReconciliation(company = activeCompany()) {
    return company.transactions.filter(transaction => transaction.financialYear === company.financialYear && transaction.type === 'purchase').map(transaction => ({ id: transaction.id, invoice: transaction.documentNumber, date: transaction.date, gstin: transaction.partyGSTIN, supplier: transaction.partyName, taxable: transaction.tax.taxable, cgst: transaction.tax.cgst, sgst: transaction.tax.sgst, igst: transaction.tax.igst, tax: transaction.tax.taxTotal, status: transaction.reconciliationStatus, itcStatus: transaction.itcStatus, note: transaction.reconciliationStatus === 'matched' ? 'GSTIN, invoice, date and tax agree.' : transaction.reconciliationStatus === 'partial' ? 'Value difference needs review before ITC claim.' : transaction.reconciliationStatus === 'missing' ? 'Not found in imported GSTR-2B.' : 'Review source data.' }));
  }

  function getExceptions(company = activeCompany()) {
    const issues = [];
    getReconciliation(company).forEach(row => { if (row.status === 'missing') issues.push({ id: `missing-${row.id}`, severity: 'high', label: `${row.invoice} missing in 2B`, detail: `Supplier ${row.supplier} · ITC ${row.tax}`, type: 'Missing in 2B', recordId: row.id }); if (row.status === 'partial') issues.push({ id: `partial-${row.id}`, severity: 'medium', label: `${row.invoice} value difference`, detail: `Review taxable value and tax with ${row.supplier}.`, type: 'Value difference', recordId: row.id }); if (row.itcStatus === 'Ineligible') issues.push({ id: `itc-${row.id}`, severity: 'medium', label: `${row.invoice} ITC eligibility issue`, detail: 'Review business use and supporting documentation.', type: 'ITC eligibility', recordId: row.id }); });
    company.notices.filter(notice => notice.status !== 'Closed').forEach(notice => issues.push({ id: notice.id, severity: 'high', label: `${notice.form} response required`, detail: `${notice.number} · due ${notice.dueDate}`, type: 'Notice', recordId: notice.id }));
    if (company.tasks.some(task => !task.done)) issues.push({ id: 'task-gstr3b', severity: 'medium', label: 'Month-end closing is incomplete', detail: `${company.tasks.filter(task => !task.done).length} checklist items still open.`, type: 'Closing', recordId: 'month-end' });
    return issues;
  }

  function getHealth(company = activeCompany()) {
    const summary = summaryFor(company);
    const points = { registration: company.gstins.some(item => item.status === 'Active') ? 15 : 0, invoices: summary.salesCount + summary.purchaseCount ? 15 : 0, returns: company.tasks.find(task => task.id === 'task-gstr1')?.done ? 15 : 5, reconciliation: summary.purchaseRows ? Math.round(summary.matchedCount / summary.purchaseRows * 20) : 0, payment: summary.netPayable >= 0 ? 10 : 0, notices: summary.openNotices ? 2 : 10, documents: company.documents.length >= 2 ? 10 : 4, deadlines: summary.openTasks <= 2 ? 5 : 2 };
    return { score: Object.values(points).reduce((total, value) => total + value, 0), points, risks: summary.exceptions.slice(0, 4) };
  }

  function getLifecycle(transactionId, company = activeCompany()) {
    const transaction = company.transactions.find(item => item.id === transactionId);
    if (!transaction) return null;
    const isPurchase = ['purchase', 'debit_note', 'expense', 'purchase_return'].includes(transaction.type);
    const summary = summaryFor(company);
    const returnSummary = getReturnSummary(company);
    const taxText = transaction.tax.scenario === 'intra' ? `CGST ${transaction.tax.cgst} + SGST ${transaction.tax.sgst}` : transaction.tax.scenario === 'inter' ? `IGST ${transaction.tax.igst}` : 'No GST / review';
    const stages = isPurchase ? [
      ['Source document', `${transaction.documentNumber} · ${transaction.partyName}`, 'ready', 'Invoice saved in Work'],
      ['Accounting entry', `${transaction.items[0]?.description || 'Purchase'} Dr ${transaction.tax.taxable} · Supplier Cr ${transaction.tax.total}`, 'ready', 'Generated from the invoice'],
      ['Supplier ledger', `${transaction.partyName} · payable ${transaction.tax.total}`, 'ready', 'Posted to supplier control account'],
      ['Input GST', taxText, 'ready', 'Input tax calculated by shared GST engine'],
      ['GSTR-2B', transaction.reconciliationStatus === 'matched' ? 'Matched' : transaction.reconciliationStatus === 'missing' ? 'Missing in 2B' : 'Partial match', transaction.reconciliationStatus === 'matched' ? 'ready' : 'attention', 'Review the reconciliation evidence'],
      ['Eligible ITC', transaction.itcStatus, transaction.itcStatus === 'Ineligible' ? 'attention' : transaction.reconciliationStatus === 'matched' ? 'ready' : 'pending', 'Eligibility is traceable to this purchase'],
      ['GSTR-3B', `Eligible ITC contributes to ₹${returnSummary.gstr3b.netITC.toLocaleString('en-IN')} net ITC`, 'pending', 'Included in return working paper'],
      ['ITC utilisation', `Credit ledger ₹${summary.creditLedger.toLocaleString('en-IN')}`, 'pending', 'Utilisation order and payment require review']
    ] : [
      ['Source document', `${transaction.documentNumber} · ${transaction.partyName}`, 'ready', 'Invoice saved in Work'],
      ['Accounting entry', `${transaction.partyName} Dr ${transaction.tax.total} · Sales Cr ${transaction.tax.taxable}`, 'ready', 'Generated from the invoice'],
      ['Customer ledger', `${transaction.partyName} · ${transaction.paymentStatus}`, 'ready', 'Receivable is connected to this invoice'],
      ['GST calculation', taxText, 'ready', 'Place of supply drives the tax ledgers'],
      ['GSTR-1', `${transaction.category} · ${transaction.filingStatus}`, transaction.filingStatus === 'Included' ? 'ready' : 'pending', 'Invoice is classified from transaction data'],
      ['GSTR-3B', `Output tax contributes to ₹${returnSummary.gstr3b.outwardTax.toLocaleString('en-IN')} liability`, 'pending', 'Summary return working paper'],
      ['Tax liability', `Output GST ₹${transaction.tax.taxTotal.toLocaleString('en-IN')}`, 'pending', 'Included in the company liability'],
      ['Payment / filing', transaction.paymentStatus === 'Paid' ? 'Payment recorded' : 'Payment reference not recorded', transaction.paymentStatus === 'Paid' ? 'ready' : 'pending', 'Government confirmation is recorded only after the user adds it']
    ];
    stages.push(['Document vault', `${company.documents.filter(document => document.recordId === transaction.id).length} linked documents`, 'pending', 'Upload invoice, return or payment evidence'], ['Audit trail', `${company.audit.filter(item => item.recordId === transaction.id).length + 1} activity records`, 'ready', 'Changes remain traceable']);
    return { transaction, stages };
  }

  function setActiveCompany(companyId) { if (state.companies.some(company => company.id === companyId)) { state.activeCompanyId = companyId; persist(); } return activeCompany(); }
  function getState() { return state; }
  function reset() { state = seedState(); persist(); return state; }

  return { config, getState, activeCompany, companyById, activeGstin, summaryFor, getReturnSummary, getLedgers, getOperationalReports, recordSettlement, getMonthEndSimulation, completeSimulationTask, resetSimulation, getReconciliation, getExceptions, getHealth, getLifecycle, createTransaction, updateTransaction, toggleTask, addCompany, addMaster, addGSTIN, setActiveCompany, persist, reset };
});
