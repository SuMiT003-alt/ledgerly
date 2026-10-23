/* GST tools: browser-only preparation workflows with explicit official-portal handoffs. */
(() => {
  const GST = window.LedgerlyGST;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
  const number = value => Math.round((Number(value) || 0) * 100) / 100;
  const today = new Date().toISOString().slice(0, 10);
  const state = { activeTool: 'calculator', reconciliationFilter: 'all', returnForm: 'GSTR-3B' };
  const indiaStates = [
    ['Andaman and Nicobar Islands', '35'], ['Andhra Pradesh', '37'], ['Arunachal Pradesh', '12'], ['Assam', '18'], ['Bihar', '10'],
    ['Chandigarh', '04'], ['Chhattisgarh', '22'], ['Dadra and Nagar Haveli and Daman and Diu', '26'], ['Delhi', '07'], ['Goa', '30'],
    ['Gujarat', '24'], ['Haryana', '06'], ['Himachal Pradesh', '02'], ['Jammu and Kashmir', '01'], ['Jharkhand', '20'], ['Karnataka', '29'],
    ['Kerala', '32'], ['Ladakh', '38'], ['Lakshadweep', '31'], ['Madhya Pradesh', '23'], ['Maharashtra', '27'], ['Manipur', '14'],
    ['Meghalaya', '17'], ['Mizoram', '15'], ['Nagaland', '13'], ['Odisha', '21'], ['Puducherry', '34'], ['Punjab', '03'], ['Rajasthan', '08'],
    ['Sikkim', '11'], ['Tamil Nadu', '33'], ['Telangana', '36'], ['Tripura', '16'], ['Uttar Pradesh', '09'], ['Uttarakhand', '05'], ['West Bengal', '19']
  ];

  function toast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function download(name, content, type = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
  }

  function parseCsvLine(line) {
    const cells = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === ',' && !quoted) { cells.push(value.trim()); value = ''; }
      else value += character;
    }
    cells.push(value.trim());
    return cells;
  }

  function csvContent(rows) {
    return '\uFEFF' + rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  }

  function calculatorMarkup() {
    return `<div class="gst-tool-heading"><div><span class="section-kicker">01 / CALCULATE GST</span><h3>Know the tax before you post.</h3><p>Choose the supply scenario, enter the amount, and use this working paper to see the exact ledger split.</p></div><span class="gst-prep-badge">PREPARATION TOOL</span></div>
      <div class="gst-calculator-grid"><form class="gst-form-card" id="gstCalcForm"><div class="gst-form-section"><span class="gst-form-label">Supply details</span><div class="gst-choice-grid" role="group" aria-label="Supply scenario"><button type="button" class="gst-choice active" data-calc-scenario="intra"><b>Intra-state</b><small>CGST + SGST</small></button><button type="button" class="gst-choice" data-calc-scenario="inter"><b>Inter-state</b><small>IGST</small></button><button type="button" class="gst-choice" data-calc-scenario="none"><b>Exempt / nil</b><small>No GST</small></button></div><div class="gst-field-grid"><label><span class="field-label">Transaction type</span><select id="gstCalcKind"><option value="sale">Sales / output GST</option><option value="purchase">Purchase / input GST</option></select></label><label><span class="field-label">Taxable amount / invoice total</span><input id="gstCalcAmount" type="number" min="0" step="0.01" value="10000" /></label><label><span class="field-label">GST rate (%) <i class="gst-config-dot">master</i></span><input id="gstCalcRate" list="gstRateOptions" type="number" min="0" max="100" step="0.01" value="18" /><datalist id="gstRateOptions">${GST.config.rateMaster.map(rate => `<option value="${rate}">`).join('')}</datalist></label></div><div class="gst-switch-row"><label class="gst-switch"><input id="gstCalcInclusive" type="checkbox" /><span></span><b>Amount includes GST</b></label><label><span class="field-label">Discount (₹)</span><input id="gstCalcDiscount" type="number" min="0" step="0.01" value="0" /></label><label><span class="field-label">Discount timing</span><select id="gstCalcDiscountMode"><option value="before">Before GST</option><option value="after">After GST</option></select></label></div></div><div class="gst-calc-note"><span>i</span><p><strong>Configurable masters:</strong> rates and rounding rules are examples for this practice workspace. Update them from Admin → GST rate master when connecting a live data source.</p></div></form><div class="gst-calc-result" id="gstCalcResult"></div></div>`;
  }

  function renderCalculator() {
    const panel = $('[data-gst-tool-panel="calculator"]');
    panel.innerHTML = calculatorMarkup();
    $$('[data-calc-scenario]', panel).forEach(button => button.addEventListener('click', () => {
      $$('[data-calc-scenario]', panel).forEach(item => item.classList.toggle('active', item === button));
      renderCalcResult();
    }));
    ['gstCalcKind', 'gstCalcAmount', 'gstCalcRate', 'gstCalcInclusive', 'gstCalcDiscount', 'gstCalcDiscountMode'].forEach(id => {
      document.getElementById(id).addEventListener('input', renderCalcResult);
      document.getElementById(id).addEventListener('change', renderCalcResult);
    });
    renderCalcResult();
  }

  function calcValues() {
    const scenario = $('[data-calc-scenario].active')?.dataset.calcScenario || 'intra';
    const amount = Math.max(0, number($('#gstCalcAmount').value));
    const rate = Math.max(0, number($('#gstCalcRate').value));
    const discount = Math.min(amount, Math.max(0, number($('#gstCalcDiscount').value)));
    const inclusive = $('#gstCalcInclusive').checked;
    const discountMode = $('#gstCalcDiscountMode').value;
    let taxable;
    let total;
    if (inclusive) {
      const grossForTax = discountMode === 'before' ? Math.max(0, amount - discount) : amount;
      taxable = rate ? grossForTax / (1 + rate / 100) : grossForTax;
      const result = GST.calculate({ scenario, rate, taxable, kind: $('#gstCalcKind').value });
      total = discountMode === 'after' ? Math.max(0, result.total - discount) : result.total;
      return { ...result, taxable: number(taxable), total: number(total), discount, inclusive, discountMode, entered: amount };
    }
    taxable = discountMode === 'before' ? Math.max(0, amount - discount) : amount;
    const result = GST.calculate({ scenario, rate, taxable, kind: $('#gstCalcKind').value });
    total = discountMode === 'after' ? Math.max(0, result.total - discount) : result.total;
    return { ...result, taxable: number(taxable), total: number(total), discount, inclusive, discountMode, entered: amount };
  }

  function renderCalcResult() {
    const result = calcValues();
    const taxRows = result.scenario === 'intra'
      ? `<div><span>CGST <small>${number(result.rate / 2)}%</small></span><strong>${money(result.cgst)}</strong></div><div><span>SGST <small>${number(result.rate / 2)}%</small></span><strong>${money(result.sgst)}</strong></div>`
      : result.scenario === 'inter'
        ? `<div><span>IGST <small>${result.rate}%</small></span><strong>${money(result.igst)}</strong></div>`
        : `<div><span>GST treatment</span><strong class="gst-muted-result">No GST</strong></div>`;
    $('#gstCalcResult').innerHTML = `<div class="gst-result-top"><div><span class="section-kicker">WORKING PAPER</span><h4>${result.scenario === 'intra' ? 'Intra-state supply' : result.scenario === 'inter' ? 'Inter-state supply' : 'Exempt / nil-rated'}</h4></div><span class="gst-result-pill ${result.scenario}">${result.details.shortLabel}</span></div><div class="gst-total-highlight"><span>Invoice value</span><strong>${money(result.total)}</strong><small>${result.inclusive ? 'Inclusive calculation' : 'Exclusive calculation'} · ${result.kind === 'purchase' ? 'input tax view' : 'output tax view'}</small></div><div class="gst-result-lines"><div><span>Entered amount</span><strong>${money(result.entered)}</strong></div>${result.discount ? `<div><span>Discount ${result.discountMode === 'before' ? 'before tax' : 'after tax'}</span><strong>− ${money(result.discount)}</strong></div>` : ''}<div><span>Taxable value</span><strong>${money(result.taxable)}</strong></div>${taxRows}<div class="gst-result-total"><span>Total GST</span><strong>${money(result.taxTotal)}</strong></div></div><div class="gst-accounting-preview"><span class="section-kicker">LEDGER PREVIEW</span><p>${result.kind === 'purchase' ? `<b>Dr</b> Purchases / expense ${money(result.taxable)}${result.taxTotal ? ` + input tax ${money(result.taxTotal)}` : ''}<br /><b>Cr</b> Supplier / cash ${money(result.total)}` : `<b>Dr</b> Customer / cash ${money(result.total)}<br /><b>Cr</b> Sales ${money(result.taxable)}${result.taxTotal ? ` + output tax ${money(result.taxTotal)}` : ''}`}</p></div><div class="gst-result-disclaimer">Calculation is an estimate for preparation. Confirm rate, place of supply, eligibility and rounding under current law.</div>`;
  }

  function invoiceMarkup() {
    return `<div class="gst-tool-heading"><div><span class="section-kicker">02 / INVOICE STUDIO</span><h3>A source document your return can trust.</h3><p>Build a professional sample invoice. Save or export the working paper after reviewing place of supply and tax treatment.</p></div><span class="gst-prep-badge">NO PORTAL SUBMISSION</span></div><div class="gst-invoice-grid"><form class="gst-form-card gst-invoice-form" id="gstInvoiceForm"><div class="gst-form-section"><span class="gst-form-label">Invoice details</span><div class="gst-field-grid"><label><span class="field-label">Invoice number</span><input id="invoiceNumber" value="INV-2026-014" /></label><label><span class="field-label">Invoice date</span><input id="invoiceDate" type="date" value="${today}" /></label><label><span class="field-label">Place of supply</span><select id="invoiceScenario"><option value="intra">Maharashtra · intra-state</option><option value="inter">Karnataka · inter-state</option></select></label></div></div><div class="gst-form-section"><span class="gst-form-label">Seller</span><div class="gst-field-grid"><label><span class="field-label">Business / legal name</span><input id="invoiceSeller" value="Aranya Studio Private Limited" /></label><label><span class="field-label">Seller GSTIN</span><input id="invoiceSellerGstin" value="27AABCA1234F1Z5" /></label><label><span class="field-label">State</span><input id="invoiceSellerState" value="Maharashtra" /></label></div></div><div class="gst-form-section"><span class="gst-form-label">Buyer</span><div class="gst-field-grid"><label><span class="field-label">Customer name</span><input id="invoiceBuyer" value="Riya Services" /></label><label><span class="field-label">Buyer GSTIN</span><input id="invoiceBuyerGstin" value="27AABCR8821Q1ZK" /></label><label><span class="field-label">Buyer state</span><input id="invoiceBuyerState" value="Maharashtra" /></label></div></div><div class="gst-form-section"><span class="gst-form-label">Line item</span><div class="gst-field-grid invoice-item-fields"><label class="wide-field"><span class="field-label">Description</span><input id="invoiceDescription" value="Brand identity and design services" /></label><label><span class="field-label">HSN / SAC</span><input id="invoiceHsn" value="998391" /></label><label><span class="field-label">Qty</span><input id="invoiceQty" type="number" min="0" step="0.01" value="1" /></label><label><span class="field-label">Rate (₹)</span><input id="invoiceRate" type="number" min="0" step="0.01" value="50000" /></label><label><span class="field-label">GST rate (%)</span><input id="invoiceTaxRate" list="invoiceRateOptions" type="number" min="0" max="100" step="0.01" value="18" /><datalist id="invoiceRateOptions">${GST.config.rateMaster.map(rate => `<option value="${rate}">`).join('')}</datalist></label></div></div><div class="gst-invoice-actions"><button class="button button-primary" type="button" id="invoiceSave">Save working paper <span>✓</span></button><button class="outline-button" type="button" id="invoicePrint">Print / PDF <span>↗</span></button><button class="outline-button" type="button" id="invoicePostWork">Post to Work <span>→</span></button></div></form><article class="gst-invoice-preview" id="gstInvoicePreview"></article></div>`;
  }

  function invoiceValues() {
    const taxable = number(Math.max(0, Number($('#invoiceQty').value) || 0) * Math.max(0, Number($('#invoiceRate').value) || 0));
    const scenario = $('#invoiceScenario').value;
    const result = GST.calculate({ scenario, taxable, rate: Number($('#invoiceTaxRate').value) || 0, kind: 'sale' });
    return { ...result, seller: $('#invoiceSeller').value, sellerGstin: $('#invoiceSellerGstin').value, sellerState: $('#invoiceSellerState').value, buyer: $('#invoiceBuyer').value, buyerGstin: $('#invoiceBuyerGstin').value, buyerState: $('#invoiceBuyerState').value, number: $('#invoiceNumber').value, date: $('#invoiceDate').value, description: $('#invoiceDescription').value, hsn: $('#invoiceHsn').value, qty: $('#invoiceQty').value, ratePerUnit: $('#invoiceRate').value };
  }

  function renderInvoice() {
    const result = invoiceValues();
    const dateLabel = result.date ? new Date(`${result.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const taxes = result.scenario === 'intra' ? `<span>CGST (${number(result.rate / 2)}%) <b>${money(result.cgst)}</b></span><span>SGST (${number(result.rate / 2)}%) <b>${money(result.sgst)}</b></span>` : `<span>IGST (${result.rate}%) <b>${money(result.igst)}</b></span>`;
    $('#gstInvoicePreview').innerHTML = `<div class="invoice-preview-head"><div><span class="gst-doc-label">TAX INVOICE</span><h4>${result.seller || 'Business name'}</h4><p>GSTIN: ${result.sellerGstin || 'Add seller GSTIN'}<br />${result.sellerState || 'State'} · India</p></div><div class="invoice-preview-meta"><b>${result.number || 'Invoice number'}</b><span>Date ${dateLabel}</span><span>Place of supply: ${result.scenario === 'intra' ? 'Same state' : 'Inter-state'}</span></div></div><div class="invoice-parties"><div><span>Bill from</span><strong>${result.seller || '—'}</strong><small>${result.sellerGstin || '—'}</small></div><div><span>Bill to</span><strong>${result.buyer || '—'}</strong><small>${result.buyerGstin || 'Unregistered customer'}</small></div></div><div class="invoice-line-table"><div class="invoice-line-head"><span>Description</span><span>HSN/SAC</span><span>Qty</span><span>Rate</span><span>Taxable</span></div><div class="invoice-line"><span>${result.description || 'Service / product'}</span><span>${result.hsn || '—'}</span><span>${result.qty}</span><span>${money(result.ratePerUnit)}</span><b>${money(result.taxable)}</b></div></div><div class="invoice-total-area"><div><span class="section-kicker">TAX BREAKUP</span>${taxes}</div><div class="invoice-grand-total"><span>Total invoice value</span><strong>${money(result.total)}</strong><small>Taxable ${money(result.taxable)} · GST ${money(result.taxTotal)}</small></div></div><div class="invoice-preview-footer"><span>Reverse charge: No</span><span>Payment terms: 30 days</span><span>Preparation preview · verify before issue</span></div>`;
  }

  function renderInvoicePanel() {
    const panel = $('[data-gst-tool-panel="invoice"]');
    panel.innerHTML = invoiceMarkup();
    $$('#gstInvoiceForm input, #gstInvoiceForm select').forEach(input => input.addEventListener('input', renderInvoice));
    $$('#gstInvoiceForm select').forEach(input => input.addEventListener('change', renderInvoice));
    $('#invoiceSave').addEventListener('click', () => { try { localStorage.setItem('ledgerly-gst-invoice', JSON.stringify(invoiceValues())); toast('Invoice working paper saved on this browser.'); } catch { toast('Browser storage is unavailable. Print or export this invoice instead.'); } });
    $('#invoicePrint').addEventListener('click', () => window.print());
    $('#invoicePostWork').addEventListener('click', postInvoiceToWork);
    renderInvoice();
  }

  function postInvoiceToWork() {
    const work = window.LedgerlyWork;
    if (!work) { toast('Work mode is unavailable. Start the current Ledgerly server and try again.'); return; }
    const invoice = invoiceValues();
    const active = work.activeCompany();
    const gstinState = GST.stateFromGSTIN(invoice.buyerGstin);
    let customer = active.customers.find(item => item.gstin && item.gstin === invoice.buyerGstin) || active.customers.find(item => item.name.toLowerCase() === invoice.buyer.toLowerCase());
    if (!customer) customer = work.addMaster('customer', { name: invoice.buyer || 'Invoice customer', legalName: invoice.buyer || 'Invoice customer', tradeName: invoice.buyer || 'Invoice customer', gstin: invoice.buyerGstin, state: invoice.buyerState || active.state, stateCode: gstinState || active.stateCode, terms: 30, openingBalance: 0, type: invoice.buyerGstin ? 'B2B' : 'B2C' });
    const product = active.products[0];
    const created = work.createTransaction({ type: 'sale', documentNumber: invoice.number, date: invoice.date, partyId: customer.id, placeOfSupplyStateCode: gstinState || active.stateCode, category: invoice.buyerGstin ? 'B2B' : 'B2C', status: 'Posted', source: 'Invoice Studio', items: [{ productId: product?.id, description: invoice.description, hsnSac: invoice.hsn, unit: 'service', quantity: Number(invoice.qty), rate: Number(invoice.ratePerUnit), discount: 0, gstRate: invoice.rate }] });
    toast(`${created.documentNumber} posted to Work — accounting, GST and return links created.`);
    window.showLedgerlyWorkspace?.('work');
    window.setTimeout(() => window.openLedgerlyWorkTransaction?.(created.id), 80);
  }

  const reconciliationRows = [
    { gstin: '29AABCR8821Q1ZK', invoice: 'PUR-221', date: '19 Apr 2026', taxable: 40000, tax: 7200, status: 'matched', note: 'Tax and invoice number agree' },
    { gstin: '27AABCP1029G1ZA', invoice: 'PUR-218', date: '17 Apr 2026', taxable: 18500, tax: 3330, status: 'partial', note: 'Taxable value differs by ₹500' },
    { gstin: '24AADCO4412L1ZP', invoice: 'PUR-204', date: '12 Apr 2026', taxable: 12000, tax: 2160, status: 'missing', note: 'Not found in GSTR-2B' },
    { gstin: '29AABCK9922P1ZL', invoice: 'PUR-201', date: '08 Apr 2026', taxable: 8700, tax: 1566, status: 'extra', note: 'Appears in 2B, not in purchase register' },
    { gstin: '27AAECS7321C1ZD', invoice: 'PUR-198', date: '04 Apr 2026', taxable: 25000, tax: 4500, status: 'mismatch', note: 'Supplier GSTIN needs review' },
    { gstin: '29AABCR8821Q1ZK', invoice: 'PUR-190', date: '02 Apr 2026', taxable: 9400, tax: 1692, status: 'matched', note: 'Matched on GSTIN, number, date and tax' }
  ];
  const reconcileLabels = { matched: 'Matched', partial: 'Partial', missing: 'Missing', extra: 'Extra', mismatch: 'Mismatch' };

  function reconciliationMarkup() {
    return `<div class="gst-tool-heading"><div><span class="section-kicker">03 / RECONCILIATION DESK</span><h3>Find the difference before it finds you.</h3><p>Demo data shows the review pattern: GSTIN, invoice number, date, taxable value and tax amount. Import a CSV to add your own practice rows.</p></div><span class="gst-prep-badge">GSTR-2B WORKING</span></div><div class="gst-recon-summary"><div><strong>6</strong><span>register rows</span></div><div class="summary-good"><strong>2</strong><span>matched</span></div><div class="summary-warn"><strong>2</strong><span>need review</span></div><div class="summary-bad"><strong>2</strong><span>missing / extra</span></div><div class="gst-recon-actions"><label class="outline-button gst-file-button">Import CSV <input id="gstReconFile" type="file" accept=".csv,text/csv" hidden /></label><button class="outline-button" id="gstReconExport" type="button">Export report <span>↓</span></button></div></div><div class="gst-status-filters" role="group" aria-label="Filter reconciliation status">${['all', 'matched', 'partial', 'missing', 'extra', 'mismatch'].map(status => `<button type="button" class="${status === 'all' ? 'active' : ''}" data-recon-filter="${status}">${status === 'all' ? 'All rows' : reconcileLabels[status]}</button>`).join('')}</div><div class="gst-table-wrap"><table class="gst-data-table"><thead><tr><th>Supplier GSTIN</th><th>Invoice</th><th>Date</th><th>Taxable value</th><th>GST amount</th><th>Finding</th></tr></thead><tbody id="gstReconBody"></tbody></table></div><div class="gst-recon-footer"><span><i class="status-dot"></i> Matching is a preparation check, not confirmation of portal acceptance.</span><strong id="gstReconFootnote">Filter rows to focus your review.</strong></div>`;
  }

  function renderReconRows() {
    const rows = state.reconciliationFilter === 'all' ? reconciliationRows : reconciliationRows.filter(row => row.status === state.reconciliationFilter);
    $('#gstReconBody').innerHTML = rows.map(row => `<tr><td><strong>${row.gstin}</strong></td><td>${row.invoice}</td><td>${row.date}</td><td>${money(row.taxable)}</td><td>${money(row.tax)}</td><td><span class="recon-status ${row.status}"><i></i>${reconcileLabels[row.status]}</span><small>${row.note}</small></td></tr>`).join('') || '<tr><td colspan="6" class="gst-empty-row">No rows in this view.</td></tr>';
    $('#gstReconFootnote').textContent = `${rows.length} row${rows.length === 1 ? '' : 's'} shown · export the filtered view for review.`;
    $$('[data-recon-filter]').forEach(button => button.classList.toggle('active', button.dataset.reconFilter === state.reconciliationFilter));
  }

  function parseReconCsv(text) {
    const lines = text.trim().split(/\r?\n/).slice(1);
    lines.forEach(line => {
      const cells = parseCsvLine(line);
      if (cells.length < 5 || !cells[0] || !cells[1]) return;
      reconciliationRows.push({ gstin: cells[0], invoice: cells[1], date: cells[2] || 'Imported', taxable: number(cells[3]), tax: number(cells[4]), status: 'partial', note: 'Imported for review — match against GSTR-2B' });
    });
  }

  function renderReconciliationPanel() {
    const panel = $('[data-gst-tool-panel="reconciliation"]');
    panel.innerHTML = reconciliationMarkup();
    $$('[data-recon-filter]').forEach(button => button.addEventListener('click', () => { state.reconciliationFilter = button.dataset.reconFilter; renderReconRows(); }));
    $('#gstReconExport').addEventListener('click', () => { const rows = state.reconciliationFilter === 'all' ? reconciliationRows : reconciliationRows.filter(row => row.status === state.reconciliationFilter); download('ledgerly-reconciliation.csv', csvContent([['GSTIN', 'Invoice', 'Date', 'Taxable value', 'GST amount', 'Status'], ...rows.map(row => [row.gstin, row.invoice, row.date, row.taxable, row.tax, reconcileLabels[row.status]])])); toast('Reconciliation report exported.'); });
    $('#gstReconFile').addEventListener('change', event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { parseReconCsv(String(reader.result)); renderReconRows(); toast(`${file.name} imported for review.`); }; reader.readAsText(file); });
    renderReconRows();
  }

  const returnData = {
    'GSTR-1': { label: 'Outward supplies', period: 'April 2026', taxable: 840000, tax: 151200, rows: [['B2B invoices', '14', '₹ 5,42,000', '₹ 97,560'], ['B2C / other supplies', '32', '₹ 2,18,000', '₹ 39,240'], ['Credit / debit notes', '3', '− ₹ 20,000', '− ₹ 3,600'], ['HSN summary', '6 codes', 'Ready', '—']] },
    'GSTR-3B': { label: 'Summary return', period: 'April 2026', taxable: 840000, tax: 151200, rows: [['Outward taxable supplies', '₹ 8,40,000', '₹ 1,51,200', 'Tax liability'], ['Eligible ITC', '₹ 5,72,000', '₹ 1,03,000', '2B matched'], ['ITC reversal', '₹ 18,000', '₹ 3,240', 'Review blocked credit'], ['Net cash payable', '—', '₹ 51,440', 'Before interest / fee']] },
    'GSTR-9': { label: 'Annual return', period: 'FY 2025–26', taxable: 10240000, tax: 1843200, rows: [['Sales reconciliation', '12 months', '₹ 10,240,000', 'In progress'], ['Purchase / ITC bridge', '12 months', '₹ 1,352,000', 'Review 4 rows'], ['HSN summary', '18 codes', 'Ready', '—'], ['Additional liability', '—', '₹ 0', 'Pending final review']] },
    'CMP-08': { label: 'Composition payment', period: 'Q1 FY 2026–27', taxable: 320000, tax: 3200, rows: [['Quarter turnover', '₹ 3,20,000', '₹ 3,200', 'Illustrative 1%'], ['Tax payable', '—', '₹ 3,200', 'Before interest / fee'], ['Invoices', 'Composition bill', 'No ITC', 'Check restrictions'], ['Annual return', 'GSTR-4', 'Applicable', 'At year end']] }
  };

  function returnMarkup() {
    return `<div class="gst-tool-heading"><div><span class="section-kicker">04 / RETURN PREP</span><h3>Review the return, then take it to the portal.</h3><p>Create a clear summary from your books. Ledgerly records preparation status; it does not submit or claim a filed return.</p></div><span class="gst-prep-badge">PORTAL HANDOFF</span></div><div class="gst-return-toolbar"><div class="return-tabs" role="tablist">${Object.keys(returnData).map((form, index) => `<button type="button" class="${index === 1 ? 'active' : ''}" data-return-form="${form}">${form}<small>${returnData[form].label}</small></button>`).join('')}</div><label><span class="field-label">Financial year / period</span><select id="returnPeriod"><option>April 2026</option><option>March 2026</option><option>FY 2025–26</option><option>Q1 FY 2026–27</option></select></label></div><div class="gst-return-layout"><article class="gst-return-summary" id="gstReturnSummary"></article><aside class="gst-checklist-card"><span class="section-kicker">PRE-FILING CHECKLIST</span><h4 id="returnChecklistTitle">GSTR-3B is ready when these are ticked.</h4><label><input type="checkbox" class="return-check" /> Sales register reviewed</label><label><input type="checkbox" class="return-check" /> Purchase / GSTR-2B reconciled</label><label><input type="checkbox" class="return-check" /> ITC eligibility reviewed</label><label><input type="checkbox" class="return-check" /> Cash and credit ledger checked</label><label><input type="checkbox" class="return-check" /> Interest / late fee considered</label><div class="return-readiness" id="returnReadiness">0 / 5 checks complete</div><a class="button button-primary" href="https://www.gst.gov.in/" target="_blank" rel="noopener noreferrer">Open official portal <span>↗</span></a><small>Complete the final submission and record ARN there. No login, OTP or portal password is stored here.</small></aside></div><div class="gst-return-footer"><span>✓ Preparation summary can be exported to share with your accountant.</span><button class="outline-button" id="returnExport" type="button">Export summary <span>↓</span></button></div>`;
  }

  function renderReturnSummary() {
    const data = returnData[state.returnForm];
    const moneyOrText = value => typeof value === 'number' ? money(value) : value;
    $('#gstReturnSummary').innerHTML = `<div class="return-summary-head"><div><span class="section-kicker">${state.returnForm} · ${data.period}</span><h4>${data.label}</h4></div><span class="return-draft-pill">DRAFT / PREPARATION</span></div><div class="return-kpi-row"><div><span>Taxable value</span><strong>${money(data.taxable)}</strong></div><div><span>Tax / payable</span><strong>${money(data.tax)}</strong></div><div><span>Data confidence</span><strong class="confidence-good">Review</strong></div></div><div class="return-detail-table"><div class="return-detail-row return-detail-header"><span>Section</span><span>Count / basis</span><span>Taxable / value</span><span>Tax / note</span></div>${data.rows.map(row => `<div class="return-detail-row"><strong>${row[0]}</strong><span>${row[1]}</span><span>${moneyOrText(row[2])}</span><span>${row[3]}</span></div>`).join('')}</div><div class="return-legal-note"><span>i</span><p>Applicability is profile-dependent. Confirm the form, period, tables, due date and final values against the current GST portal.</p></div>`;
    $('#returnChecklistTitle').textContent = `${state.returnForm} is ready when these are ticked.`;
  }

  function renderReturnsPanel() {
    const panel = $('[data-gst-tool-panel="returns"]');
    panel.innerHTML = returnMarkup();
    $$('[data-return-form]').forEach(button => button.addEventListener('click', () => { state.returnForm = button.dataset.returnForm; $$('[data-return-form]').forEach(item => item.classList.toggle('active', item === button)); renderReturnSummary(); }));
    $$('.return-check').forEach(input => input.addEventListener('change', () => { const checked = $$('.return-check').filter(item => item.checked).length; $('#returnReadiness').textContent = `${checked} / 5 checks complete`; $('#returnReadiness').classList.toggle('ready', checked === 5); }));
    $('#returnExport').addEventListener('click', () => { const data = returnData[state.returnForm]; download(`${state.returnForm.toLowerCase()}-preparation-summary.csv`, csvContent([['Form', 'Period', 'Taxable value', 'Tax / payable'], [state.returnForm, data.period, data.taxable, data.tax]])); toast(`${state.returnForm} summary exported.`); });
    renderReturnSummary();
  }

  function registrationMarkup() {
    return `<div class="gst-tool-heading"><div><span class="section-kicker">05 / REGISTRATION DESK</span><h3>Start with an eligibility conversation.</h3><p>A guided assessment for practice. Thresholds and special cases are configurable and must be verified under current GST law.</p></div><span class="gst-prep-badge">REG-01 GUIDE</span></div><div class="gst-registration-grid"><form class="gst-form-card" id="gstRegistrationForm"><div class="gst-form-section"><span class="gst-form-label">Business snapshot</span><div class="gst-field-grid"><label><span class="field-label">Constitution</span><select id="regConstitution"><option>Proprietorship</option><option>Partnership / LLP</option><option>Private limited company</option><option>Other</option></select></label><label><span class="field-label">State</span><select id="regState"><option>Maharashtra</option><option>Karnataka</option><option>Delhi</option><option>Gujarat</option></select></label><label><span class="field-label">Estimated annual turnover (₹)</span><input id="regTurnover" type="number" min="0" step="1000" value="2800000" /></label></div><div class="gst-toggle-list"><label><input id="regInterstate" type="checkbox" checked /><span><b>Interstate supplies</b><small>Goods or services cross a state boundary</small></span></label><label><input id="regEcommerce" type="checkbox" /><span><b>E-commerce / marketplace</b><small>Sell or collect through an e-commerce operator</small></span></label><label><input id="regVoluntary" type="checkbox" /><span><b>Voluntary registration</b><small>Register even if not clearly required</small></span></label></div></div><div class="gst-assessment-note"><span>⚖</span><p>Final legal applicability depends on current thresholds, nature of supply, special-category states, notifications and facts. Use this as a conversation starter with your CA or tax professional.</p></div></form><article class="gst-registration-result" id="gstRegistrationResult"></article></div><div class="gst-registration-lower"><article class="gst-doc-checklist"><div class="gst-tool-subhead"><div><span class="section-kicker">DOCUMENT PLAN</span><h4>REG-01 checklist for a proprietorship</h4></div><span>4 / 8 ready</span></div><div class="doc-progress"><span style="width:50%"></span></div><div class="doc-check-grid"><label><input type="checkbox" checked /><span>PAN of proprietor</span><b>Ready</b></label><label><input type="checkbox" checked /><span>Aadhaar / photo</span><b>Ready</b></label><label><input type="checkbox" /><span>Address proof / electricity bill</span><b>Pending</b></label><label><input type="checkbox" /><span>Rent agreement / consent letter</span><b>Pending</b></label><label><input type="checkbox" checked /><span>Bank account proof</span><b>Ready</b></label><label><input type="checkbox" /><span>Authorised signatory letter</span><b>Pending</b></label><label><input type="checkbox" checked /><span>Business constitution proof</span><b>Ready</b></label><label><input type="checkbox" /><span>Photograph / additional docs</span><b>Pending</b></label></div></article><article class="gst-guide-card"><span class="section-kicker">PORTAL WALKTHROUGH</span><h4>What happens after you decide?</h4><ol><li><b>01</b><span>Create account, select Taxpayer, state and district.</span></li><li><b>02</b><span>Enter PAN, legal name, email and mobile; verify OTP and generate TRN.</span></li><li><b>03</b><span>Complete REG-01, upload documents and finish applicable Aadhaar authentication.</span></li><li><b>04</b><span>Submit, note ARN, track status and respond to clarification if received.</span></li><li><b>05</b><span>Record GSTIN issuance and save the registration evidence in Documents.</span></li></ol><a href="https://www.gst.gov.in/" target="_blank" rel="noopener noreferrer">Continue on official GST portal <span>↗</span></a></article></div>`;
  }

  function renderRegistration() {
    const constitution = $('#regConstitution').value;
    const stateName = $('#regState').value;
    const turnover = number($('#regTurnover').value);
    const interstate = $('#regInterstate').checked;
    const ecommerce = $('#regEcommerce').checked;
    const voluntary = $('#regVoluntary').checked;
    const trigger = voluntary ? 'Voluntary registration selected' : ecommerce ? 'E-commerce involvement needs a careful applicability review' : interstate ? 'Interstate supply flagged for review' : turnover >= 4000000 ? 'Turnover is above this demo threshold' : 'Turnover is below this demo threshold';
    const tone = voluntary || ecommerce || interstate || turnover >= 4000000 ? 'review' : 'possible';
    $('#gstRegistrationResult').innerHTML = `<div class="registration-result-top"><span class="registration-ring ${tone}">${tone === 'review' ? '!' : '✓'}</span><div><span class="section-kicker">INDICATIVE ASSESSMENT</span><h4>${tone === 'review' ? 'Registration needs review' : 'Threshold may not be crossed'}</h4></div></div><div class="registration-trigger"><span>Why this is showing</span><strong>${trigger}</strong></div><div class="registration-facts"><div><span>Turnover entered</span><b>${money(turnover)}</b></div><div><span>Demo threshold</span><b>₹ 40 lakh</b></div><div><span>Next sensible action</span><b>${tone === 'review' ? 'Prepare facts + documents' : 'Check voluntary / exception cases'}</b></div></div><div class="registration-steps"><span class="section-kicker">RECOMMENDED NEXT STEPS</span><ol><li>Confirm the nature and location of supplies.</li><li>Check current threshold and special-category rules.</li><li>Discuss composition eligibility and restrictions.</li><li>Prepare the document checklist before opening REG-01.</li></ol></div><p class="gst-result-disclaimer">This is an indicative learning assessment, not a legal opinion or registration confirmation.</p>`;
    const facts = $('#gstRegistrationResult .registration-facts');
    facts?.insertAdjacentHTML('afterbegin', `<div><span>Business profile</span><b>${constitution} · ${stateName}</b></div>`);
  }

  function renderRegistrationPanel() {
    const panel = $('[data-gst-tool-panel="registration"]');
    panel.innerHTML = registrationMarkup();
    $('#regState').replaceChildren(...indiaStates.map(([name, code]) => new Option(`${name} · ${code}`, name)));
    $('#regState').value = 'Maharashtra';
    ['regConstitution', 'regState', 'regTurnover', 'regInterstate', 'regEcommerce', 'regVoluntary'].forEach(id => { document.getElementById(id).addEventListener('input', renderRegistration); document.getElementById(id).addEventListener('change', renderRegistration); });
    renderRegistration();
  }

  function complianceMarkup() {
    const deadlines = [['GSTR-1', '11 May 2026', 'Outward supply details', 'due'], ['GSTR-2B', '14 May 2026', 'Reconcile ITC statement', 'soon'], ['GSTR-3B', '20 May 2026', 'Summary return + payment', 'due'], ['E-invoice review', 'Before dispatch', 'Applicability depends on profile', 'ongoing']];
    return `<div class="gst-tool-heading"><div><span class="section-kicker">06 / COMPLIANCE DESK</span><h3>See the work before the deadline.</h3><p>A compact operating view for liabilities, ledgers, reminders and notices. Dates shown here are illustrative and configurable.</p></div><span class="gst-prep-badge">DEMO COMPANY · APR 2026</span></div><div class="gst-compliance-overview"><div class="compliance-kpi"><span>Tax liability</span><strong>₹ 1,51,200</strong><small>April working</small></div><div class="compliance-kpi good"><span>ITC available</span><strong>₹ 1,03,000</strong><small>2B matched + review</small></div><div class="compliance-kpi warning"><span>Net payable</span><strong>₹ 51,440</strong><small>Before interest / fee</small></div><div class="compliance-kpi"><span>Open notices</span><strong>1</strong><small>Response due 28 May</small></div></div><div class="gst-compliance-grid"><article class="gst-deadline-card"><div class="gst-tool-subhead"><div><span class="section-kicker">COMPLIANCE CALENDAR</span><h4>Next actions</h4></div><button type="button" class="tiny-link" id="addReminder">+ Add reminder</button></div><div class="gst-deadline-list">${deadlines.map(item => `<div class="gst-deadline-item"><span class="deadline-marker ${item[3]}"></span><div><strong>${item[0]}</strong><small>${item[2]}</small></div><b>${item[1]}</b><button type="button" aria-label="Mark ${item[0]} complete" class="deadline-check">○</button></div>`).join('')}</div><p class="gst-config-note">Due dates are configuration data. Verify the current due date on the official portal before relying on a reminder.</p></article><article class="gst-ledger-card"><span class="section-kicker">LEDGER SNAPSHOT</span><h4>What can be offset?</h4><div class="ledger-balance-row"><span><i class="ledger-icon cash">₹</i>Electronic cash ledger</span><strong>₹ 24,800</strong></div><div class="ledger-balance-row"><span><i class="ledger-icon credit">↗</i>Electronic credit ledger</span><strong>₹ 1,03,000</strong></div><div class="ledger-balance-row"><span><i class="ledger-icon liability">!</i>Liability ledger</span><strong>₹ 1,51,200</strong></div><div class="ledger-offset"><span>Illustrative net payable</span><strong>₹ 51,440</strong><small>Interest, late fee and utilisation order need separate review.</small></div><a class="tiny-link" href="#gst-learning" data-open-learning="gst-learning">Learn how ledgers connect <span>↗</span></a></article></div><div class="gst-notice-strip"><div class="notice-icon">!</div><div><span class="section-kicker">NOTICE CENTER</span><h4>ASMT-10 · clarification response</h4><p>Difference in reported outward supplies · response due 28 May 2026 · assigned to Meera Shah</p></div><span class="notice-state">Response required</span><button type="button" id="noticeAction" class="outline-button">Open action list <span>→</span></button></div><div class="gst-compliance-portal"><div><span class="section-kicker">OFFICIAL HANDOFF</span><h4>When you are ready to file</h4><p>Review the checklist, open the government portal, complete authentication and record the ARN or challan back here. Ledgerly never stores GST portal passwords or OTPs.</p></div><a class="button button-primary" href="https://www.gst.gov.in/" target="_blank" rel="noopener noreferrer">Go to GST portal <span>↗</span></a></div>`;
  }

  function renderCompliancePanel() {
    const panel = $('[data-gst-tool-panel="compliance"]');
    panel.innerHTML = complianceMarkup();
    $$('.deadline-check', panel).forEach(button => button.addEventListener('click', () => { button.textContent = button.textContent === '✓' ? '○' : '✓'; button.closest('.gst-deadline-item').classList.toggle('complete', button.textContent === '✓'); }));
    $('#addReminder').addEventListener('click', () => toast('Reminder saved for this browser — connect a calendar service for team notifications.'));
    $('#noticeAction').addEventListener('click', () => toast('Notice action list opened — assign owner, upload evidence, draft response, record submission.'));
    $('[data-open-learning]', panel).addEventListener('click', event => { event.preventDefault(); window.showLedgerlyWorkspace?.('learn'); window.location.hash = 'gst-learning'; });
  }

  function initLearningDesk() {
    const select = $('#gstNextSelect');
    const steps = $('#gstNextSteps');
    const title = $('#gstNextTitle');
    const text = $('#gstNextText');
    if (!select || !steps) return;
    const routes = {
      register: { title: 'Check the facts before you register.', text: 'Start with constitution, state, turnover and special triggers. Then prepare the REG-01 document plan.', steps: ['Confirm business constitution, PAN and principal place of business.', 'Review threshold, interstate, e-commerce and composition questions.', 'Collect address, identity, bank and authorisation documents.', 'Continue on the official portal and record TRN / ARN.'] },
      invoice: { title: 'Create the source document first.', text: 'A clean invoice makes accounting, GSTR-1 and customer reconciliation easier.', steps: ['Confirm seller GSTIN and the buyer registration details.', 'Choose place of supply and CGST + SGST or IGST treatment.', 'Add HSN/SAC, taxable value, rate, invoice number and date.', 'Save the PDF and link it to the accounting entry.'] },
      gstr3b: { title: 'Prepare GSTR-3B in a review order.', text: 'Bring the sales summary, eligible ITC and payment ledgers together before the portal step.', steps: ['Select GSTIN, financial year and return period.', 'Review outward supply and RCM liability.', 'Reconcile GSTR-2B and calculate eligible net ITC.', 'Review interest / fee, generate summary, then file on the official portal.'] },
      reconcile: { title: 'Reconcile the evidence, not just the total.', text: 'A matching total can still hide a wrong GSTIN or invoice. Work row by row.', steps: ['Import purchase register and GSTR-2B data.', 'Match GSTIN, invoice number, date, taxable value and tax.', 'Resolve missing, extra, partial and mismatch rows.', 'Lock the reviewed ITC working paper for the return.'] },
      notice: { title: 'Treat a notice as a tracked workflow.', text: 'Read the issue, assign an owner and preserve every response document and deadline.', steps: ['Record notice number, form, issue, due date and response date.', 'Collect books, invoices, returns and prior correspondence.', 'Draft and review the response with your tax professional.', 'Submit through the prescribed channel and record acknowledgement.'] }
    };
    function renderAssistant() {
      const route = routes[select.value];
      title.textContent = route.title;
      text.textContent = route.text;
      steps.innerHTML = route.steps.map(step => `<li>${step}</li>`).join('');
    }
    select.addEventListener('change', renderAssistant);
    renderAssistant();
    const glossary = {
      gstin: 'GSTIN is the 15-character registration number for a registered taxpayer. Validate the structure and legal name before using it on an invoice.',
      itc: 'Input tax credit is tax paid on eligible business purchases that may be used against output liability, subject to current rules and evidence.',
      arn: 'ARN is the application reference number generated after a GST application is submitted. It helps track the application status.',
      rcm: 'Under reverse charge, the recipient pays tax in specified cases. Identify the liability, pay it and separately review ITC eligibility.',
      '2b': 'GSTR-2B is a static, period-wise ITC statement used as an important reconciliation source. It still needs review against books and eligibility rules.'
    };
    $$('[data-glossary]').forEach(button => button.addEventListener('click', () => { $$('[data-glossary]').forEach(item => item.classList.toggle('active', item === button)); $('#gstGlossaryNote').textContent = glossary[button.dataset.glossary]; }));
  }

  function activate(tool) {
    const valid = ['calculator', 'invoice', 'reconciliation', 'returns', 'registration', 'compliance', 'coach', 'entry', 'shortcuts'];
    state.activeTool = valid.includes(tool) ? tool : 'calculator';
    const tab = $(`#toolsTallyTabs [data-tally-tab="${state.activeTool}"]`);
    $$('.gst-tool-panel').forEach(panel => { panel.hidden = panel.dataset.gstToolPanel !== state.activeTool; });
    if (tab && !['coach', 'entry', 'shortcuts'].includes(state.activeTool)) {
      $$('#toolsTallyTabs [data-tally-tab]').forEach(item => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; });
      $('.tools-card-note').textContent = state.activeTool === 'compliance' ? 'Illustrative dates · verify before relying' : 'Prepare here · file on the official portal';
    }
    $$('.tool-launch-card').forEach(card => card.classList.toggle('active', card.dataset.toolLaunch === state.activeTool));
    const titles = { calculator: 'GST calculator', invoice: 'Invoice studio', reconciliation: 'Reconciliation desk', returns: 'Return preparation', registration: 'Registration desk', compliance: 'Compliance desk', coach: 'Document coach', entry: 'Tally entry trainer', shortcuts: 'Shortcut desk' };
    $('#toolsSelectedTitle').textContent = titles[state.activeTool] || 'GST tools';
  }

  function init() {
    if (!document.getElementById('toolsWorkspace')) return;
    initLearningDesk();
    renderCalculator();
    renderInvoicePanel();
    renderReconciliationPanel();
    renderReturnsPanel();
    renderRegistrationPanel();
    renderCompliancePanel();
    $$('#toolsTallyTabs [data-tally-tab]').forEach(button => button.addEventListener('click', () => activate(button.dataset.tallyTab)));
    $$('.tool-launch-card').forEach(card => card.addEventListener('click', () => { if (!['coach', 'entry', 'shortcuts'].includes(card.dataset.toolLaunch)) activate(card.dataset.toolLaunch); }));
    $$('[data-open-gst-tool]').forEach(button => button.addEventListener('click', () => window.openLedgerlyTool(button.dataset.openGstTool)));
    window.openLedgerlyTool = tool => { window.showLedgerlyWorkspace?.('tools'); window.setTimeout(() => activate(tool), 40); };
    activate('calculator');
  }

  init();
})();
