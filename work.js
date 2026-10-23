/* Work mode UI: company operations, connected GST outputs and audit-ready traces. */
(() => {
  const M = window.LedgerlyWork;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  if (!M) {
    const content = $('#workContent');
    if (content) content.innerHTML = '<div class="work-empty work-recovery"><span class="section-kicker">WORK MODE UNAVAILABLE</span><h3>The Work data model did not load.</h3><p>Refresh Ledgerly once to reload the connected business workspace. The guide above explains the workflow when it is ready.</p></div>';
    return;
  }
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const dateLabel = value => { if (!value) return '—'; const date = new Date(`${value}T12:00:00Z`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  let activeView = 'overview';
  let search = '';

  function toast(message) { if (typeof window.showToast === 'function') window.showToast(message); }
  function handleAddTransactionClick(event) { if (event?.__ledgerlyWorkHandled) return; if (event) event.__ledgerlyWorkHandled = true; openTransactionDialog(); }
  function company() { return M.activeCompany(); }
  function summary() { return M.summaryFor(company()); }
  function button(label, attributes = '', className = 'work-row-action') { return `<button type="button" class="${className}" ${attributes}>${label}</button>`; }
  function statusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    const tone = ['matched', 'paid', 'settled', 'ready', 'exact match', 'included', 'active', 'verified'].some(value => normalized.includes(value)) ? '' : ['missing', 'ineligible', 'response required', 'high'].some(value => normalized.includes(value)) ? 'bad' : ['partial', 'partly', 'pending', 'unpaid', 'review', 'draft'].some(value => normalized.includes(value)) ? 'warn' : 'neutral';
    return `<span class="work-status ${tone}">${esc(status || 'Review')}</span>`;
  }

  function renderCompanyHeader() {
    const active = company();
    const gstin = M.activeGstin(active);
    $('#workCompanySelect').replaceChildren(...M.getState().companies.map(item => new Option(item.tradeName || item.name, item.id)));
    $('#workCompanySelect').value = active.id;
    $('#workCompanyName').textContent = active.tradeName || active.name;
    $('#workCompanyGstin').textContent = `${gstin?.gstin || 'GSTIN not added'} · ${gstin?.state || active.state}`;
    $('#workCompanyPeriod').textContent = `${active.financialYear} · ${active.registrationType}${active.composition ? ' · Composition' : ''}`;
    $('#workFinancialYear').value = active.financialYear;
  }

  function renderKpis() {
    const data = summary();
    const gstin = M.activeGstin(company());
    const cards = [
      ['GSTIN', gstin?.gstin || 'Not added', `${gstin?.state || company().state} · ${gstin?.status || 'Review'}`, ''],
      ['Tax liability', money(data.liability), `${data.outputTax ? money(data.outputTax) : 'No'} output tax`, 'warn'],
      ['Eligible ITC', money(data.matchedITC), `${money(data.pendingITC)} pending review`, 'good'],
      ['Cash ledger', money(data.cashLedger), 'Illustrative balance', 'teal'],
      ['Credit ledger', money(data.creditLedger), 'Matched ITC available', 'good'],
      ['Next deadline', 'GSTR-3B', M.config.dueDates['GSTR-3B'], 'warn'],
      ['Open notices', String(data.openNotices), data.openNotices ? 'Response required' : 'No open notices', data.openNotices ? 'warn' : 'good']
    ];
    return cards.map(card => `<div class="work-kpi ${card[3]}"><span>${esc(card[0])}</span><strong>${esc(card[1])}</strong><small>${esc(card[2])}</small></div>`).join('');
  }

  function renderChart() {
    const active = company();
    const periodTransactions = active.transactions.filter(transaction => transaction.financialYear === active.financialYear);
    const sales = periodTransactions.filter(transaction => ['sale', 'credit_note'].includes(transaction.type));
    const purchases = periodTransactions.filter(transaction => ['purchase', 'debit_note', 'expense'].includes(transaction.type));
    const values = [
      ['Nov', 52, 34], ['Dec', 68, 48], ['Jan', 42, 35], ['Feb', 74, 51], ['Mar', 88, 61], ['Apr', Math.min(100, 38 + sales.length * 9), Math.min(91, 25 + purchases.length * 10)]
    ];
    return `<div class="work-chart">${values.map(([label, sale, purchase]) => `<div class="work-chart-column"><div class="work-bar-stack"><i class="work-bar sales" style="height:${sale}%" title="Sales ${sale}"></i><i class="work-bar purchases" style="height:${purchase}%" title="Purchases ${purchase}"></i></div><label>${label}</label></div>`).join('')}</div><div class="work-chart-legend"><span><i class="sales-dot"></i>Sales</span><span><i class="purchase-dot"></i>Purchases</span><span>₹ lakh scale · illustrative monthly view</span></div>`;
  }

  function renderExceptions(limit = 5) {
    const issues = M.getExceptions(company()).slice(0, limit);
    if (!issues.length) return '<div class="work-empty"><h3>Nothing urgent today.</h3><p>Your current demo company has no open exceptions. Keep the monthly evidence trail up to date.</p></div>';
    return `<div class="work-action-list">${issues.map(issue => `<div class="work-action-item ${issue.severity === 'medium' ? 'medium' : ''}"><i></i><div><strong>${esc(issue.label)}</strong><small>${esc(issue.detail)}</small></div>${button('Review', `data-work-detail="${esc(issue.recordId)}"`)}</div>`).join('')}</div>`;
  }

  function assistantAnswer(question) {
    const data = summary();
    const issues = M.getExceptions(company());
    if (question === 'itc') return `Matched ITC is ${money(data.matchedITC)}. Another ${money(data.pendingITC)} is pending because purchase rows are partial, missing in 2B or still under eligibility review.`;
    if (question === 'liability') return `Your illustrative GSTR-3B liability is ${money(data.netPayable)}: output tax ${money(data.outputTax)} plus RCM where applicable, less matched ITC ${money(data.creditLedger)}. Interest and late fee are not included.`;
    if (question === 'unreconciled') return `${issues.filter(issue => /2B|ITC|difference/i.test(issue.label)).map(issue => issue.label).join('; ') || 'No unreconciled purchase issue is open in this period.'}`;
    if (question === 'month') return `Complete ${data.openTasks} month-end items: reconcile GSTR-2B, review GSTR-3B/payment and record the final ARN or reference after the official step.`;
    return `${issues.length} control${issues.length === 1 ? '' : 's'} need attention: ${issues.slice(0, 3).map(issue => issue.label).join('; ') || 'nothing urgent today.'}`;
  }

  function renderAssistant() {
    return `<article class="work-card work-assistant-card"><div class="work-card-heading"><div><span class="section-kicker">LEDGERLY ASSISTANT / DATA-AWARE</span><h3>Ask what the books are saying.</h3></div><span>Explainable answers</span></div><div class="work-assistant-row"><select id="workAssistantQuestion"><option value="attention">What needs attention today?</option><option value="itc">Why is my ITC lower this month?</option><option value="unreconciled">Show me unreconciled purchases.</option><option value="liability">Why is my GSTR-3B liability higher?</option><option value="month">Give me my month-end checklist.</option></select><button type="button" class="button button-primary" id="workAskAssistant">Explain <span>→</span></button></div><p class="work-assistant-answer" id="workAssistantAnswer">${esc(assistantAnswer('attention'))}</p><small class="work-assistant-note">Answers use this active company’s Ledgerly data. They do not invent transactions or provide a legal conclusion.</small></article>`;
  }

  function renderWorkHome() {
    const active = company();
    const latest = active.transactions.find(transaction => transaction.financialYear === active.financialYear);
    const health = M.getHealth(active);
    return `<div class="work-command-strip"><div><span class="section-kicker">WORKSPACE / ${esc(active.financialYear)}</span><h2>Good morning, your books are in view.</h2><p>Pick up the next business action or follow a transaction from source document to compliance record.</p></div><div class="work-command-actions"><button type="button" class="work-quick-action primary" data-work-quick="sale"><span>＋</span><b>New sale</b><small>Invoice + GST</small></button><button type="button" class="work-quick-action" data-work-quick="purchase"><span>＋</span><b>New purchase</b><small>Supplier + ITC</small></button><button type="button" class="work-quick-action" data-work-quick="expense"><span>＋</span><b>Add expense</b><small>Books + GST</small></button></div></div><div class="work-kpi-grid">${renderKpis()}</div><div class="work-dashboard-grid"><article class="work-card work-pulse-card"><div class="work-card-heading"><div><span class="section-kicker">BUSINESS PULSE</span><h3>Sales, purchases and GST movement</h3></div><span>${esc(active.financialYear)}</span></div>${renderChart()}<div class="work-pulse-footer"><span><b>${summary().salesCount}</b> sales</span><span><b>${summary().purchaseCount}</b> purchases</span><span><b>${summary().matchedCount}</b> matched in 2B</span></div></article><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">ACTION REQUIRED</span><h3>What needs attention today?</h3></div><span>${summary().exceptions.length} open</span></div>${renderExceptions()}</article></div>${renderAssistant()}<div class="work-focus-grid"><article class="work-focus-card focus-health"><div class="work-focus-score"><strong>${health.score}</strong><small>/100</small></div><div><span class="section-kicker">GST HEALTH SCORE</span><h3>${health.score >= 80 ? 'Steady control, keep the trail moving.' : 'A few controls need attention.'}</h3><p>Based on registration, returns, reconciliation, payment, notices, documents and deadlines.</p></div><button type="button" data-work-view="compliance">Open controls <span>→</span></button></article><article class="work-focus-card focus-follow"><div><span class="section-kicker">SIGNATURE WORKFLOW</span><h3>Follow one transaction</h3><p>${latest ? `${esc(latest.documentNumber)} is ready to trace through books, GST, returns and audit.` : 'Create a transaction to see its complete lifecycle.'}</p></div>${latest ? button('Follow latest', `data-work-detail="${esc(latest.id)}"`, 'button button-primary') : button('Create first transaction', 'data-work-quick="sale"', 'button button-primary')}</article></div><div class="work-section-heading"><div><span class="section-kicker">RECENT ACTIVITY</span><h2>Connected transactions</h2></div>${button('View all', 'data-work-view="transactions"', 'outline-button')}</div>${renderTransactionsTable(filteredTransactions().slice(0, 5))}`;
  }

  function renderWorkTransactions() {
    const active = company();
    return `<div class="work-section-heading"><div><span class="section-kicker">TRANSACTION REGISTER</span><h2>Enter once. Reuse everywhere.</h2><p>Every saved row creates an accounting entry and feeds the GST, reconciliation and compliance views for ${esc(active.tradeName)}.</p></div>${button('New transaction', 'data-work-quick="sale"', 'button button-primary')}</div><div class="work-register-controls"><label><span class="field-label">Type</span><select id="workTypeFilter"><option value="all">All transaction types</option><option value="sale">Sales invoices</option><option value="purchase">Purchase invoices</option><option value="expense">Expenses</option><option value="credit_note">Credit notes</option><option value="debit_note">Debit notes</option></select></label><label><span class="field-label">Status</span><select id="workStatusFilter"><option value="all">All statuses</option><option value="Unpaid">Unpaid</option><option value="Paid">Paid</option><option value="matched">Matched in 2B</option><option value="partial">Needs review</option></select></label><span class="work-register-count" id="workRegisterCount"></span></div><div id="workFilteredTransactions"></div>`;
  }

  function renderFilteredTransactions() {
    const type = $('#workTypeFilter')?.value || 'all';
    const status = $('#workStatusFilter')?.value || 'all';
    let rows = filteredTransactions();
    if (type !== 'all') rows = rows.filter(transaction => transaction.type === type);
    if (status !== 'all') rows = rows.filter(transaction => transaction.paymentStatus === status || transaction.reconciliationStatus === status);
    const target = $('#workFilteredTransactions');
    if (target) target.innerHTML = renderTransactionsTable(rows);
    const count = $('#workRegisterCount');
    if (count) count.textContent = `${rows.length} row${rows.length === 1 ? '' : 's'} in ${company().financialYear}`;
    if (target) {
      $$('[data-work-detail]', target).forEach(item => item.addEventListener('click', () => openDetail(item.dataset.workDetail)));
    }
  }

  function renderOverview() {
    const data = summary();
    const health = M.getHealth(company());
    const latest = company().transactions.find(transaction => transaction.financialYear === company().financialYear);
    return `<div class="work-kpi-grid">${renderKpis()}</div><div class="work-dashboard-grid"><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">BUSINESS PULSE</span><h3>Sales, purchases and GST movement</h3></div><span>${esc(company().financialYear)}</span></div>${renderChart()}</article><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">ACTION REQUIRED</span><h3>What needs attention today?</h3></div><span>${data.exceptions.length} open</span></div>${renderExceptions()}</article></div>${renderAssistant()}<div class="work-health-strip"><div class="work-health-score">${health.score}<small>/100</small></div><div><span class="section-kicker">GST HEALTH SCORE</span><h3>${health.score >= 80 ? 'Your books are on a steady path.' : 'A few controls need attention.'}</h3><p>Registration, invoice correctness, returns, reconciliation, payment, notices, documents and deadlines are evaluated from this company’s current working data.</p></div>${button('Open health details', 'data-work-view="compliance"', 'button button-primary')}</div><div class="work-lifecycle-banner"><div><span class="section-kicker">SIGNATURE FEATURE</span><h3>Follow one transaction all the way through.</h3><p>${latest ? `${esc(latest.documentNumber)} is ready to trace from source document to accounting, GST, return and audit trail.` : 'Create a transaction to see its complete lifecycle.'}</p></div><div class="work-lifecycle-chain"><b>Invoice</b><span>→</span><b>Books</b><span>→</span><b>GST</b><span>→</span><b>Return</b><span>→</span><b>Audit</b></div>${latest ? button('Follow latest', `data-work-detail="${esc(latest.id)}"`, 'button button-primary') : ''}</div><div class="work-section-heading"><div><span class="section-kicker">RECENT ACTIVITY</span><h2>Connected transactions</h2></div>${button('View all transactions', 'data-work-view="transactions"', 'outline-button')}</div>${renderTransactionsTable(filteredTransactions().slice(0, 5))}`;
  }

  function filteredTransactions() {
    const term = search.trim().toLowerCase();
    const items = company().transactions.filter(transaction => transaction.financialYear === company().financialYear);
    if (!term) return items;
    return items.filter(transaction => [transaction.documentNumber, transaction.partyName, transaction.partyGSTIN, transaction.type, transaction.category, transaction.placeOfSupply].join(' ').toLowerCase().includes(term));
  }

  function transactionTypeLabel(type) { return ({ sale: 'Sales invoice', purchase: 'Purchase invoice', credit_note: 'Credit note', debit_note: 'Debit note', expense: 'Expense bill' })[type] || type; }

  function renderTransactionsTable(transactions) {
    if (!transactions.length) return '<div class="work-empty"><h3>No connected transactions found.</h3><p>Use Add transaction or clear the search to continue.</p></div>';
    return `<div class="work-card work-table-card"><div class="work-table-head"><h3>Transaction register</h3><span>${transactions.length} shown · generated accounting and GST fields</span></div><div class="work-table-wrap"><table class="work-table"><thead><tr><th>Date</th><th>Document</th><th>Party / GSTIN</th><th>Type</th><th class="money">Taxable</th><th class="money">GST</th><th>Status</th><th>Trace</th></tr></thead><tbody>${transactions.map(transaction => `<tr><td>${dateLabel(transaction.date)}</td><td><strong>${esc(transaction.documentNumber)}</strong><small>${esc(transaction.placeOfSupply)} · ${esc(transaction.category)}</small></td><td><strong>${esc(transaction.partyName || '—')}</strong><small>${esc(transaction.partyGSTIN || 'Unregistered')}</small></td><td>${esc(transactionTypeLabel(transaction.type))}</td><td class="money">${money(transaction.tax.taxable)}</td><td class="money">${money(transaction.tax.taxTotal)}</td><td>${statusLabel(transaction.status === 'Posted' ? transaction.paymentStatus : transaction.status)}</td><td>${button('Follow', `data-work-detail="${esc(transaction.id)}"`)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function renderTransactions() {
    return `<div class="work-section-heading"><div><span class="section-kicker">TRANSACTION REGISTER</span><h2>Enter once. Reuse everywhere.</h2><p>Sales, purchases, expenses and notes drive the connected books, GST and compliance views for ${esc(company().tradeName)}.</p></div>${button('Add transaction', 'data-work-add-transaction="true"', 'button button-primary')}</div>${renderTransactionsTable(filteredTransactions())}`;
  }

  function reportMonthLabel(value) {
    const date = new Date(`${value}-01T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function renderReports() {
    const reports = M.getOperationalReports(company());
    const cash = reports.cash;
    const balanceRows = (rows, empty) => rows.length ? rows.map(row => `<tr><td><strong>${esc(row.party)}</strong><small>${esc(row.documents.slice(0, 2).join(', '))}${row.documents.length > 2 ? '…' : ''}</small></td><td>${statusLabel(row.status)}<small>${esc(row.age)}</small></td><td class="money">${money(row.invoices)}</td><td class="money">${money(row.settled)}</td><td class="money"><strong>${money(row.balance)}</strong></td></tr>`).join('') : `<tr><td colspan="5"><div class="work-empty"><p>${empty}</p></div></td></tr>`;
    const monthlyRows = reports.monthly.length ? reports.monthly.map(row => `<tr><td><strong>${esc(reportMonthLabel(row.month))}</strong></td><td class="money">${money(row.sales)}</td><td class="money">${money(row.purchases)}</td><td class="money">${money(row.cashIn)}</td><td class="money">${money(row.cashOut)}</td><td class="money"><strong>${money(row.net)}</strong></td></tr>`).join('') : '<tr><td colspan="6">No transactions in this financial year.</td></tr>';
    return `<div class="work-section-heading"><div><span class="section-kicker">REPORTS / CONTROL VIEW</span><h2>Know what is owed and what is moving.</h2><p>Receivables, payables and cash movement are derived from the active company’s connected transactions as at ${dateLabel(reports.asOf)}.</p></div><div>${button('Export reports', 'data-work-export-reports="true"', 'outline-button')}</div></div><div class="work-summary-cards work-report-summary"><div class="work-mini-card warn"><span>Receivables</span><strong>${money(reports.totals.receivables)}</strong><small>Customer balances due</small></div><div class="work-mini-card warn"><span>Payables</span><strong>${money(reports.totals.payables)}</strong><small>Supplier balances due</small></div><div class="work-mini-card good"><span>Cash in</span><strong>${money(cash.inflow)}</strong><small>Based on payment status</small></div><div class="work-mini-card"><span>Closing cash</span><strong>${money(cash.closing)}</strong><small>Opening ${money(cash.opening)}</small></div></div><div class="work-reports-grid"><article class="work-card work-table-card"><div class="work-table-head"><h3>Receivables ageing</h3><span>Follow up customers</span></div><div class="work-table-wrap"><table class="work-table work-report-table"><thead><tr><th>Customer / documents</th><th>Age</th><th class="money">Invoiced</th><th class="money">Settled</th><th class="money">Due</th></tr></thead><tbody>${balanceRows(reports.receivables, 'No customer balances are open.')}</tbody></table></div></article><article class="work-card work-table-card"><div class="work-table-head"><h3>Payables ageing</h3><span>Plan supplier payments</span></div><div class="work-table-wrap"><table class="work-table work-report-table"><thead><tr><th>Supplier / documents</th><th>Age</th><th class="money">Billed</th><th class="money">Paid</th><th class="money">Due</th></tr></thead><tbody>${balanceRows(reports.payables, 'No supplier balances are open.')}</tbody></table></div></article></div><article class="work-card work-table-card work-cashflow-card"><div class="work-table-head"><h3>Cash-flow pulse</h3><span>Receipts less payments</span></div><div class="work-table-wrap"><table class="work-table work-report-table"><thead><tr><th>Month</th><th class="money">Sales billed</th><th class="money">Purchases billed</th><th class="money">Cash in</th><th class="money">Cash out</th><th class="money">Net movement</th></tr></thead><tbody>${monthlyRows}</tbody></table></div><div class="work-cashflow-footer"><span>Closing cash</span><strong>${money(cash.closing)}</strong><span class="${cash.movement >= 0 ? 'positive' : 'negative'}">${cash.movement >= 0 ? '▲' : '▼'} ${money(Math.abs(cash.movement))} net movement</span></div></article>`;
  }

  function renderSimulation() {
    const simulation = M.getMonthEndSimulation(company());
    const caseData = simulation.caseData;
    const completion = Math.round(simulation.completed / simulation.tasks.length * 100);
    const statementTotal = rows => money(rows.reduce((total, row) => total + Number(row[1] || 0), 0));
    const sourceRows = caseData.sourceTransactions.map(entry => `<tr><td>${dateLabel(entry.date)}</td><td><strong>${esc(entry.document)}</strong><small>${esc(entry.title)}</small></td><td>${esc(entry.story)}</td><td class="money">${money(entry.amount)}</td></tr>`).join('');
    const adjustmentRows = caseData.adjustments.map(entry => `<tr><td>${esc(entry.document)}</td><td><strong>${esc(entry.debit)}</strong><small>Dr</small></td><td><strong>${esc(entry.credit)}</strong><small>Cr</small></td><td class="money">${money(entry.amount)}</td></tr>`).join('');
    const trialRows = caseData.trialBalance.map(row => `<tr><td>${esc(row.account)}</td><td class="money">${row.debit ? money(row.debit) : '—'}</td><td class="money">${row.credit ? money(row.credit) : '—'}</td></tr>`).join('');
    const statementRows = (rows, type) => rows.map(row => `<div class="work-statement-row"><span>${esc(row[0])}<small>${esc(row[2])}</small></span><strong class="${type === 'liability' ? 'liability' : ''}">${money(row[1])}</strong></div>`).join('');
    return `<div class="work-simulation-hero"><div><span class="section-kicker">MONTH-END LAB / ${esc(caseData.period.toUpperCase())}</span><h2>Close a real month.<br /><em>Make the controls agree.</em></h2><p>Work through source documents, closing adjustments, profit and the final statement tie-out for ${esc(caseData.company)}.</p></div><div class="work-simulation-score"><strong>${simulation.completed}</strong><span>/ ${simulation.tasks.length} steps complete</span><div><i style="width:${completion}%"></i></div><small>${simulation.attempts} attempt${simulation.attempts === 1 ? '' : 's'}</small></div></div><div class="work-case-summary"><div><span>Net sales</span><strong>${money(caseData.netSales)}</strong><small>Sales less returns</small></div><div><span>Closing stock</span><strong>${money(caseData.closingStock)}</strong><small>Physical count at ${dateLabel(caseData.asOf)}</small></div><div><span>Net result</span><strong>${money(caseData.profit)}</strong><small>Transferred to equity</small></div><div><span>Trial balance</span><strong>${money(caseData.trialDebit)}</strong><small>Debit = credit</small></div></div><div class="work-simulation-reference"><details><summary>Inspect the source documents <strong>${caseData.sourceTransactions.length} entries</strong></summary><div class="work-table-wrap"><table class="work-table"><thead><tr><th>Date</th><th>Document</th><th>Business story</th><th class="money">Amount</th></tr></thead><tbody>${sourceRows}</tbody></table></div></details><details><summary>Review the closing adjustments <strong>${caseData.adjustments.length} journal entries</strong></summary><div class="work-table-wrap"><table class="work-table"><thead><tr><th>Reference</th><th>Debit</th><th>Credit</th><th class="money">Amount</th></tr></thead><tbody>${adjustmentRows}</tbody></table></div></details></div><div class="work-section-heading"><div><span class="section-kicker">CONNECTED CASE</span><h2>${simulation.tasks.length} decisions before filing.</h2><p>Read the prompt, choose an answer, and use the explanation to connect the report back to the books.</p></div>${button('Restart lab', 'data-simulation-reset="true"', 'outline-button')}</div><div class="work-simulation-grid">${simulation.tasks.map((task, index) => `<article class="work-simulation-task ${task.completed ? 'complete' : ''}"><div class="work-simulation-task-top"><span>0${index + 1}</span>${task.completed ? '<b>Complete ✓</b>' : '<b>Decision</b>'}</div><h3>${esc(task.label)}</h3><p>${esc(task.prompt)}</p><div class="work-simulation-options">${task.options.map((option, optionIndex) => `<button type="button" data-simulation-task="${esc(task.id)}" data-simulation-answer="${optionIndex}" ${task.completed ? 'disabled' : ''}><span>${String.fromCharCode(65 + optionIndex)}</span>${esc(option)}</button>`).join('')}</div>${task.completed ? `<div class="work-simulation-feedback good"><strong>Why it works</strong><p>${esc(task.explanation)}</p></div>` : ''}</article>`).join('')}</div><div class="work-statement-grid"><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">PROFIT &amp; LOSS / ${esc(caseData.period)}</span><h3>Find the result</h3></div><span>${money(caseData.profit)} profit</span></div><div class="work-statement-row"><span>Net sales<small>Outward sales after returns</small></span><strong>${money(caseData.netSales)}</strong></div><div class="work-statement-row"><span>Less: cost of goods sold<small>Net purchases less closing stock</small></span><strong>${money(caseData.costOfGoodsSold)}</strong></div><div class="work-statement-total"><span>Gross profit</span><strong>${money(caseData.grossProfit)}</strong></div><div class="work-statement-row"><span>Operating expenses<small>Rent, salary, depreciation and insurance</small></span><strong>${money(caseData.operatingExpenses)}</strong></div><div class="work-statement-row"><span>Other income<small>Bank interest</small></span><strong>${money(caseData.otherIncome)}</strong></div><div class="work-statement-total grand"><span>Net result</span><strong>${money(caseData.profit)}</strong></div></article><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">BALANCE SHEET / ${esc(caseData.asOf)}</span><h3>See where it lands</h3></div><span>${statementTotal(caseData.assets)} assets</span></div><div class="work-statement-group"><span class="work-statement-group-title">Assets</span>${statementRows(caseData.assets, 'asset')}<div class="work-statement-total"><span>Total assets</span><strong>${statementTotal(caseData.assets)}</strong></div></div><div class="work-statement-group"><span class="work-statement-group-title">Liabilities &amp; equity</span>${statementRows([...caseData.liabilities, ...caseData.equity], 'liability')}<div class="work-statement-total"><span>Total liabilities + equity</span><strong>${money(caseData.liabilities.concat(caseData.equity).reduce((total, row) => total + Number(row[1] || 0), 0))}</strong></div></div></article></div><article class="work-card work-trial-card"><div class="work-table-head"><h3>Trial balance checkpoint</h3><span>Debit ${money(caseData.trialDebit)} = Credit ${money(caseData.trialCredit)}</span></div><div class="work-table-wrap"><table class="work-table"><thead><tr><th>Account</th><th class="money">Debit</th><th class="money">Credit</th></tr></thead><tbody>${trialRows}</tbody><tfoot><tr><th>Total</th><th class="money">${money(caseData.trialDebit)}</th><th class="money">${money(caseData.trialCredit)}</th></tr></tfoot></table></div></article>`;
  }

  function appendSimulationFeedback(content) {
    const simulation = M.getMonthEndSimulation(company());
    simulation.tasks.filter(task => task.feedback && !task.completed).forEach(task => {
      const option = $$('[data-simulation-task]', content).find(item => item.dataset.simulationTask === task.id);
      const card = option?.closest('.work-simulation-task');
      if (!card) return;
      const feedback = document.createElement('div');
      feedback.className = `work-simulation-feedback ${task.feedback.correct ? 'good' : 'error'}`;
      const title = document.createElement('strong');
      title.textContent = task.feedback.correct ? 'Why it works' : 'Review this decision';
      const message = document.createElement('p');
      message.textContent = task.feedback.message;
      feedback.append(title, message);
      card.append(feedback);
    });
  }

  function masterCard(title, label, items, type, fields) {
    return `<article class="work-master-card"><span class="section-kicker">${esc(label)}</span><h3>${esc(title)}</h3><div class="work-master-list">${items.slice(0, 4).map(item => `<div class="work-master-row"><div><strong>${esc(item.name)}</strong><span>${esc(item.gstin || item.hsnSac || item.state || item.sku || '')}</span></div><b>${type === 'product' ? `${money(item.salesRate)} · ${item.gstRate}%` : type === 'customer' || type === 'supplier' ? esc(item.terms ? `${item.terms} days` : 'On account') : ''}</b></div>`).join('') || '<div class="work-empty"><p>No master data yet.</p></div>'}</div><button type="button" class="work-add-master" data-master-add="${type}" data-master-fields="${esc(fields)}">＋ Add ${esc(type)}</button></article>`;
  }

  function renderMasters() {
    const active = company();
    return `<div class="work-section-heading"><div><span class="section-kicker">MASTER DATA</span><h2>Build the clean source of truth.</h2><p>Customers, suppliers and products stay isolated inside ${esc(active.tradeName)} and feed every future transaction.</p></div>${button('Company profile', 'data-company-profile="true"', 'outline-button')}</div><div class="work-master-grid">${masterCard('Customers', 'CUSTOMER MASTER', active.customers, 'customer', 'name,state,stateCode,gstin')}${masterCard('Suppliers', 'SUPPLIER MASTER', active.suppliers, 'supplier', 'name,state,stateCode,gstin')}${masterCard('Products & services', 'PRODUCT / SERVICE MASTER', active.products, 'product', 'name,hsnSac,unit,salesRate,gstRate')}${masterCard('GSTINs & financial years', 'REGISTRATION MASTER', active.gstins.map(item => ({ name: item.gstin, gstin: item.state, state: item.status, hsnSac: active.financialYear })), 'gstin', '')}</div>`;
  }

  function renderLedgerCard(ledger) {
    return `<article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">LEDGER SNAPSHOT</span><h3>${esc(ledger.name)}</h3></div><span>${esc(ledger.side)}</span></div><div class="work-summary-cards"><div class="work-mini-card"><span>Debit</span><strong>${money(ledger.debit)}</strong></div><div class="work-mini-card"><span>Credit</span><strong>${money(ledger.credit)}</strong></div><div class="work-mini-card ${ledger.balance >= 0 ? 'good' : 'warn'}"><span>Balance</span><strong>${money(Math.abs(ledger.balance))}</strong><small>${ledger.side}</small></div></div><div class="work-table-wrap"><table class="work-table"><thead><tr><th>Date</th><th>Document</th><th class="money">Debit</th><th class="money">Credit</th></tr></thead><tbody>${ledger.entries.slice(-6).reverse().map(entry => `<tr><td>${dateLabel(entry.date)}</td><td>${esc(entry.documentNumber)}</td><td class="money">${money(entry.debit)}</td><td class="money">${money(entry.credit)}</td></tr>`).join('')}</tbody></table></div></article>`;
  }

  function renderGST() {
    const data = summary();
    const returns = M.getReturnSummary(company());
    const ledgers = M.getLedgers(company());
    const rcm = company().transactions.filter(transaction => transaction.financialYear === company().financialYear && transaction.rcm);
    const trialDebit = ledgers.reduce((total, ledger) => total + ledger.debit, 0);
    const trialCredit = ledgers.reduce((total, ledger) => total + ledger.credit, 0);
    return `<div class="work-summary-cards"><div class="work-mini-card"><span>Output GST</span><strong>${money(data.outputTax)}</strong><small>GSTR-1 / GSTR-3B</small></div><div class="work-mini-card good"><span>Matched ITC</span><strong>${money(data.matchedITC)}</strong><small>${data.matchedCount} exact matches</small></div><div class="work-mini-card warn"><span>Pending ITC</span><strong>${money(data.pendingITC)}</strong><small>Do not claim without review</small></div><div class="work-mini-card warn"><span>Net payable</span><strong>${money(data.netPayable)}</strong><small>Before interest / late fee</small></div></div><div class="work-return-grid"><article class="work-return-card"><span class="section-kicker">GSTR-1 / GENERATED FROM SALES</span><h3>Outward supplies working paper</h3><p>Each invoice below is classified from its customer GSTIN, category and place of supply.</p><div class="work-return-kpis"><div><span>B2B invoices</span><strong>${returns.gstr1.b2bCount}</strong></div><div><span>B2C invoices</span><strong>${returns.gstr1.b2cCount}</strong></div><div><span>Taxable value</span><strong>${money(returns.gstr1.taxable)}</strong></div></div><div class="work-return-list"><div class="work-return-line"><span>CGST</span><b>${money(returns.gstr1.cgst)}</b></div><div class="work-return-line"><span>SGST</span><b>${money(returns.gstr1.sgst)}</b></div><div class="work-return-line"><span>IGST</span><b>${money(returns.gstr1.igst)}</b></div><div class="work-return-line"><span>Credit / debit notes</span><b>${returns.gstr1.notes}</b></div></div>${button('Open transaction register', 'data-work-view="transactions"', 'button button-primary')}</article><article class="work-return-card"><span class="section-kicker">GSTR-3B / GENERATED FROM BOOKS</span><h3>Why is the liability this month?</h3><p>Output tax less eligible ITC, with RCM shown separately for review.</p><div class="work-return-kpis"><div><span>Outward tax</span><strong>${money(returns.gstr3b.outwardTax)}</strong></div><div><span>Eligible ITC</span><strong>${money(returns.gstr3b.eligibleITC)}</strong></div><div><span>RCM</span><strong>${money(returns.gstr3b.rcmTax)}</strong></div></div><div class="work-formula"><b>GSTR-3B net liability</b><br />Output GST ${money(returns.gstr3b.outwardTax)}<br />+ RCM liability ${money(returns.gstr3b.rcmTax)}<br />− matched ITC ${money(returns.gstr3b.eligibleITC)}<br /><b>= ${money(returns.gstr3b.netLiability)} before interest / fee</b></div>${button('Open return preparation', 'data-open-gst-tool="returns"', 'button button-primary')}</article></div><div class="work-compliance-grid"><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">PAYMENT CENTER</span><h3>Liability → credit → cash</h3></div><span>${money(data.netPayable)} cash need</span></div><div class="work-formula"><b>Liability</b> ${money(data.liability)}<br /><b>Less credit ledger</b> ${money(data.creditLedger)}<br /><b>Cash ledger available</b> ${money(data.cashLedger)}<br /><b>Illustrative balance after offset</b> ${money(Math.max(0, data.netPayable - data.cashLedger))}</div><p class="work-dialog-intro">Create a challan and complete payment on the official GST portal, then record the CIN/reference in the payment history.</p>${button('Open compliance desk', 'data-work-view="compliance"', 'button button-primary')}</article><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">ACCOUNTING CONTROL</span><h3>Trial balance from connected entries</h3></div><span>${ledgers.length} ledgers</span></div><div class="work-summary-cards"><div class="work-mini-card"><span>Total debits</span><strong>${money(trialDebit)}</strong></div><div class="work-mini-card"><span>Total credits</span><strong>${money(trialCredit)}</strong></div><div class="work-mini-card good"><span>Sales</span><strong>${money(data.salesValue)}</strong></div><div class="work-mini-card warn"><span>Purchases</span><strong>${money(data.purchaseValue)}</strong></div></div><div class="work-formula"><b>Simple P&amp;L view</b><br />Sales ${money(data.salesValue)} − purchases ${money(data.purchaseValue)}<br /><b>Indicative trading margin ${money(data.salesValue - data.purchaseValue)}</b><br />Review expenses, depreciation, inventory and accounting policies before relying on financial statements.</div></article></div><div class="work-section-heading"><div><span class="section-kicker">LEDGER CONTROL</span><h2>GST and accounting ledger impact</h2></div>${button('Open reconciliation', 'data-work-view="reconciliation"', 'outline-button')}</div><div class="work-ledger-grid">${ledgers.filter(ledger => /GST|Purchases|Sales|Customer|Supplier|RCM/.test(ledger.name)).slice(0, 6).map(renderLedgerCard).join('')}</div><div class="work-section-heading"><div><span class="section-kicker">RCM ENGINE</span><h2>Reverse charge transactions</h2></div><span class="section-kicker">${rcm.length} flagged</span></div><div class="work-card">${rcm.length ? `<div class="work-table-wrap"><table class="work-table"><thead><tr><th>Document</th><th>Supplier</th><th class="money">Taxable</th><th class="money">RCM tax</th><th>Next step</th></tr></thead><tbody>${rcm.map(transaction => `<tr><td>${esc(transaction.documentNumber)}</td><td>${esc(transaction.partyName)}</td><td class="money">${money(transaction.tax.taxable)}</td><td class="money">${money(transaction.tax.taxTotal)}</td><td>${statusLabel('Payment + ITC review')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="work-empty"><h3>No RCM transactions flagged.</h3><p>When a purchase is marked RCM, its liability and possible ITC appear here and in GSTR-3B.</p></div>'}</div>`;
  }

  function reconStatus(status) { return status === 'matched' ? 'Exact match' : status === 'partial' ? 'Partial / value difference' : status === 'missing' ? 'Missing in 2B' : status === 'extra' ? 'Exists in 2B' : status || 'Review'; }

  function renderReconciliation() {
    const rows = M.getReconciliation(company());
    const matched = rows.filter(row => row.status === 'matched').length;
    return `<div class="work-section-heading"><div><span class="section-kicker">GSTR-2B RECONCILIATION</span><h2>Make every ITC rupee explainable.</h2><p>Match supplier GSTIN, invoice number, date, taxable value and tax. Drill into the source transaction when a row needs a decision.</p></div><div>${button('Export CSV', 'data-work-export-reconciliation="true"', 'outline-button')} ${button('Import GSTR-2B', 'data-work-import-reconciliation="true"', 'button button-primary')}</div></div><input id="workReconFile" type="file" accept=".csv,text/csv" hidden /><div class="work-summary-cards"><div class="work-mini-card good"><span>Exact matches</span><strong>${matched}</strong><small>GSTIN + value + tax</small></div><div class="work-mini-card warn"><span>Review rows</span><strong>${rows.length - matched}</strong><small>Partial, missing or issue</small></div><div class="work-mini-card"><span>Eligible ITC in view</span><strong>${money(rows.filter(row => row.status === 'matched').reduce((total, row) => total + row.tax, 0))}</strong><small>Traceable to invoices</small></div><div class="work-mini-card warn"><span>ITC at risk</span><strong>${money(rows.filter(row => row.status !== 'matched').reduce((total, row) => total + row.tax, 0))}</strong><small>Review before GSTR-3B</small></div></div><div class="work-card work-table-card"><div class="work-table-head"><h3>Purchase ↔ GSTR-2B match register</h3><span>${rows.length} purchase invoices</span></div><div class="work-table-wrap"><table class="work-table"><thead><tr><th>Date</th><th>Supplier / GSTIN</th><th>Invoice</th><th class="money">Taxable</th><th class="money">GST</th><th>Finding</th><th>ITC</th><th>Trace</th></tr></thead><tbody>${rows.map(row => `<tr><td>${dateLabel(row.date)}</td><td><strong>${esc(row.supplier)}</strong><small>${esc(row.gstin)}</small></td><td>${esc(row.invoice)}</td><td class="money">${money(row.taxable)}</td><td class="money">${money(row.tax)}</td><td>${statusLabel(reconStatus(row.status))}<small>${esc(row.note)}</small></td><td>${statusLabel(row.itcStatus)}</td><td>${button('Follow', `data-work-detail="${esc(row.id)}"`)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function renderCompliance() {
    const active = company();
    const health = M.getHealth(active);
    const tasks = active.tasks;
    return `<div class="work-section-heading"><div><span class="section-kicker">COMPLIANCE CONTROL ROOM</span><h2>Close the month with evidence.</h2><p>Tasks, notices, exceptions and health controls are kept with the active company—not mixed across GSTINs.</p></div>${button('Open official GST portal', 'data-official-portal="true"', 'button button-primary')}</div><div class="work-compliance-grid"><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">GST HEALTH SCORE</span><h3>${health.score}/100 · ${health.score >= 80 ? 'Steady' : 'Needs review'}</h3></div><span>8 controls</span></div><div class="work-meter"><span style="width:${health.score}%"></span></div><div class="work-meter-label"><span>Current control coverage</span><b>${health.score}%</b></div><div class="work-action-list">${Object.entries(health.points).map(([key, value]) => `<div class="work-action-item ${value >= 12 ? 'good' : value >= 7 ? 'medium' : ''}"><i></i><div><strong>${esc(key.replace(/([A-Z])/g, ' $1'))}</strong><small>${value} points · ${value >= 12 ? 'under control' : 'needs evidence or review'}</small></div></div>`).join('')}</div></article><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">MONTH-END ASSISTANT</span><h3>April 2026 closing checklist</h3></div><span>${tasks.filter(task => task.done).length}/${tasks.length}</span></div><div class="work-task-list">${tasks.map(task => `<label class="work-task ${task.done ? 'done' : ''}"><input type="checkbox" data-work-task="${esc(task.id)}" ${task.done ? 'checked' : ''} /><span>${esc(task.label)}</span><small>${esc(task.group)}</small></label>`).join('')}</div></article></div><div class="work-section-heading"><div><span class="section-kicker">EXCEPTION CENTER</span><h2>Resolve before you file.</h2></div><span class="section-kicker">${M.getExceptions(active).length} open controls</span></div><div class="work-card">${renderExceptions(20)}</div><div class="work-section-heading"><div><span class="section-kicker">NOTICE CENTER</span><h2>Tracked correspondence</h2></div>${button('Add notice', 'data-add-notice="true"', 'outline-button')}</div><div class="work-card work-table-card"><div class="work-table-wrap"><table class="work-table"><thead><tr><th>Notice</th><th>Form / issue</th><th>Due date</th><th>Assigned</th><th>Status</th></tr></thead><tbody>${active.notices.map(notice => `<tr><td><strong>${esc(notice.number)}</strong><small>${dateLabel(notice.date)}</small></td><td>${esc(notice.form)}<small>${esc(notice.issue)}</small></td><td>${dateLabel(notice.dueDate)}</td><td>${esc(notice.assignedTo || 'Unassigned')}</td><td>${statusLabel(notice.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function renderExtendedCompliance() {
    const active = company();
    const documents = active.documents;
    return `<div class="work-section-heading"><div><span class="section-kicker">EXTENDED GST WORKFLOWS</span><h2>Prepare the edge cases without losing the trail.</h2><p>These cards keep e-invoice, e-way bill, refunds, amendments and cancellation visible while preserving the official-portal boundary.</p></div></div><div class="work-compliance-grid"><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">E-INVOICE + E-WAY BILL</span><h3>Validate before dispatch.</h3></div><span>Preparation only</span></div><div class="work-action-list"><div class="work-action-item medium"><i></i><div><strong>Applicability review</strong><small>Check turnover, transaction type, document series and current notification.</small></div>${button('Prepare', 'data-prep-action="e-invoice"')}</div><div class="work-action-item"><i></i><div><strong>Invoice data validation</strong><small>GSTIN, HSN/SAC, place of supply, tax breakup and transporter fields.</small></div>${button('Review', 'data-prep-action="e-way"')}</div><div class="work-action-item good"><i></i><div><strong>Official handoff</strong><small>IRN, QR and e-way bill status are only recorded after authorised confirmation.</small></div>${button('Open portal', 'data-official-portal="true"')}</div></div></article><article class="work-card"><div class="work-card-heading"><div><span class="section-kicker">REFUNDS + REGISTRATION CHANGES</span><h3>Keep applications accountable.</h3></div><span>Guided workflow</span></div><div class="work-action-list"><div class="work-action-item medium"><i></i><div><strong>Refund preparation</strong><small>Export / zero-rated, excess cash and inverted-duty evidence checklist.</small></div>${button('Start', 'data-prep-action="refund"')}</div><div class="work-action-item"><i></i><div><strong>Amendment / additional place</strong><small>Record requested field, supporting document, ARN and approval status.</small></div>${button('Open', 'data-prep-action="amendment"')}</div><div class="work-action-item"><i></i><div><strong>Cancellation / revocation</strong><small>Final return, liability settlement and revocation evidence remain linked.</small></div>${button('Plan', 'data-prep-action="cancellation"')}</div></div></article></div><div class="work-section-heading"><div><span class="section-kicker">DOCUMENT VAULT</span><h2>Evidence connected to this company.</h2></div>${button('Upload document', 'data-prep-action="document"', 'outline-button')}</div><div class="work-card work-table-card"><div class="work-table-wrap"><table class="work-table"><thead><tr><th>Document</th><th>Category</th><th>Linked record</th><th>Updated</th><th>Status</th></tr></thead><tbody>${documents.map(document => `<tr><td><strong>${esc(document.name)}</strong></td><td>${esc(document.category)}</td><td>${esc(document.recordId)}</td><td>${dateLabel(document.updatedAt)}</td><td>${statusLabel(document.status)}</td></tr>`).join('') || '<tr><td colspan="5">No documents uploaded yet.</td></tr>'}</tbody></table></div></div>`;
  }

  function renderAudit() {
    return `<div class="work-section-heading"><div><span class="section-kicker">AUDIT TRAIL</span><h2>Every important change has a source.</h2><p>Actions are local to the active company in this browser demo. A production deployment should persist this immutable log server-side.</p></div>${button('Export audit CSV', 'data-work-export-audit="true"', 'outline-button')}</div><div class="work-card"><div class="work-audit-list">${company().audit.slice(0, 40).map(entry => `<div class="work-audit-row"><time>${new Date(entry.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time><div><strong>${esc(entry.action)}</strong><small>${esc(entry.source)} · record ${esc(entry.recordId)}</small></div><span>${esc(entry.actor)}</span></div>`).join('')}</div></div>`;
  }

  function renderView() {
    const content = $('#workContent');
    const views = { overview: renderWorkHome, transactions: renderWorkTransactions, masters: renderMasters, gst: renderGST, reconciliation: renderReconciliation, reports: renderReports, simulation: renderSimulation, compliance: renderCompliance, audit: renderAudit };
    content.innerHTML = (views[activeView] || renderOverview)();
    if (activeView === 'simulation') appendSimulationFeedback(content);
    if (activeView === 'compliance') content.insertAdjacentHTML('beforeend', renderExtendedCompliance());
    if (activeView === 'reports') {
      const reports = M.getOperationalReports(company());
      const parties = [...reports.receivables.map(row => ({ ...row, kind: 'Customer receipt' })), ...reports.payables.map(row => ({ ...row, kind: 'Supplier payment' }))];
      content.insertAdjacentHTML('afterbegin', `<form class="work-settlement-strip" id="workSettlementForm"><div><span class="section-kicker">RECORD A SETTLEMENT</span><strong>Keep the cash report tied to actual receipts and payments.</strong></div><label><span class="field-label">Party</span><select id="workSettlementParty" required>${parties.map(row => `<option value="${esc(row.id)}">${esc(row.party)} · ${esc(row.kind)} · due ${money(row.balance)}</option>`).join('')}</select></label><label><span class="field-label">Amount (₹)</span><input id="workSettlementAmount" type="number" min="0.01" step="0.01" required placeholder="0.00" /></label><label><span class="field-label">Method</span><select id="workSettlementMethod"><option>Bank transfer</option><option>Cash</option><option>UPI</option><option>Cheque</option></select></label><button class="button button-primary" type="submit">Record <span>✓</span></button></form>`);
    }
    $$('[data-work-view]', content).forEach(item => item.addEventListener('click', () => { activeView = item.dataset.workView; render(); }));
    $$('[data-work-detail]', content).forEach(item => item.addEventListener('click', () => openDetail(item.dataset.workDetail)));
    $$('[data-open-gst-tool]', content).forEach(item => item.addEventListener('click', () => { window.showLedgerlyWorkspace?.('tools'); window.setTimeout(() => window.openLedgerlyTool?.(item.dataset.openGstTool), 80); }));
    $$('[data-master-add]', content).forEach(item => item.addEventListener('click', () => quickAddMaster(item.dataset.masterAdd)));
    $('[data-work-export-reconciliation]', content)?.addEventListener('click', exportReconciliation);
    $('[data-work-import-reconciliation]', content)?.addEventListener('click', () => $('#workReconFile').click());
    $('#workReconFile')?.addEventListener('change', importReconciliation);
    $('[data-work-export-reports]', content)?.addEventListener('click', exportOperationalReports);
    $('#workSettlementForm', content)?.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const result = M.recordSettlement($('#workSettlementParty', content).value, $('#workSettlementAmount', content).value, new Date().toISOString().slice(0, 10), $('#workSettlementMethod', content).value);
        render();
        toast(`${money(result.applied)} settlement recorded${result.unapplied ? ` · ${money(result.unapplied)} remains unapplied` : ''}.`);
      } catch (error) { toast(error.message || 'Could not record the settlement.'); }
    });
    $('[data-simulation-reset]', content)?.addEventListener('click', () => { M.resetSimulation(); render(); toast('Month-end lab restarted for this company.'); });
    $$('[data-simulation-task]', content).forEach(item => item.addEventListener('click', () => {
      const result = M.completeSimulationTask(item.dataset.simulationTask, item.dataset.simulationAnswer);
      toast(result.correct ? `Correct — ${result.message}` : result.message);
      render();
    }));
    $$('[data-official-portal]', content).forEach(item => item.addEventListener('click', () => window.open('https://www.gst.gov.in/', '_blank', 'noopener')));
    $$('[data-prep-action]', content).forEach(item => item.addEventListener('click', () => toast(`${item.dataset.prepAction} preparation opened — capture documents, review applicability, then continue through the official or authorised channel.`)));
    $$('[data-work-task]', content).forEach(item => item.addEventListener('change', () => { M.toggleTask(item.dataset.workTask); render(); }));
    $('[data-add-notice]', content)?.addEventListener('click', () => toast('Notice capture is ready for the next compliance record — attach the notice and assign an owner.'));
    $('#workAskAssistant', content)?.addEventListener('click', () => { $('#workAssistantAnswer', content).textContent = assistantAnswer($('#workAssistantQuestion', content).value); });
    if (activeView === 'transactions') {
      $('#workTypeFilter', content)?.addEventListener('change', renderFilteredTransactions);
      $('#workStatusFilter', content)?.addEventListener('change', renderFilteredTransactions);
      renderFilteredTransactions();
    }
    $$('[data-work-quick]', content).forEach(item => item.addEventListener('click', () => openTransactionDialog(item.dataset.workQuick)));
  }

  function render() {
    renderCompanyHeader();
    $$('.work-view-tabs button').forEach(button => button.classList.toggle('active', button.dataset.workView === activeView));
    renderView();
  }

  function renderRecoveryMessage(error) {
    console.error('Ledgerly Work mode could not render:', error);
    const content = $('#workContent');
    if (!content) return;
    content.innerHTML = '<div class="work-empty work-recovery"><span class="section-kicker">WORK MODE RECOVERY</span><h3>Your workspace needs its demo data refreshed.</h3><p>A saved browser record could not be read. Resetting the demo restores the sample company and opens Work normally.</p><button type="button" class="button button-primary" id="workRecoverDemo">Restore the Work demo <span>↻</span></button></div>';
    $('#workRecoverDemo')?.addEventListener('click', () => {
      M.reset();
      activeView = 'overview';
      search = '';
      $('#workSearch').value = '';
      renderSafely();
      toast('Work demo restored. You can now follow the guide above.');
    });
  }

  function renderSafely() {
    try {
      render();
      return true;
    } catch (error) {
      renderRecoveryMessage(error);
      return false;
    }
  }

  function fillTransactionForm() {
    const active = company();
    const type = $('#workTransactionType').value;
    const parties = ['purchase', 'expense', 'debit_note'].includes(type) ? active.suppliers : active.customers;
    $('#workParty').replaceChildren(...parties.map(item => new Option(`${item.name}${item.gstin ? ` · ${item.gstin}` : ''}`, item.id)));
    $('#workPlaceOfSupply').replaceChildren(...[...new Map([...[active.gstins.map(item => [item.stateCode, `${item.state} · ${item.stateCode}`])], ...active.customers.map(item => [item.stateCode, `${item.state} · ${item.stateCode}`]), ...active.suppliers.map(item => [item.stateCode, `${item.state} · ${item.stateCode}`])]).entries()].map(([value, label]) => new Option(label, value)));
    $('#workProduct').replaceChildren(...active.products.map(item => new Option(`${item.name} · ${item.hsnSac}`, item.id)));
    $('#workGstRate').replaceChildren(...M.config.taxRates.map(rate => new Option(`${rate}%`, rate)));
    $('#workGstRate').value = '18';
    const firstProduct = active.products[0];
    $('#workRate').value = type === 'purchase' || type === 'expense' ? firstProduct.purchaseRate || 0 : firstProduct.salesRate || 0;
    $('#workCategory').value = ['purchase', 'expense', 'debit_note'].includes(type) ? 'B2B' : 'B2B';
    $('#workReconStatus').value = type === 'purchase' ? 'partial' : 'not-applicable';
    $('#workRcm').checked = false;
    $('#workItcEligible').checked = type === 'purchase';
    renderFormPreview();
  }

  function renderFormPreview() {
    const quantity = Number($('#workQuantity').value) || 0;
    const rate = Number($('#workRate').value) || 0;
    const discount = Number($('#workDiscount').value) || 0;
    const taxable = Math.max(0, quantity * rate - discount);
    const gst = (taxable * (Number($('#workGstRate').value) || 0)) / 100;
    const place = $('#workPlaceOfSupply').selectedOptions[0]?.textContent || 'Choose place of supply';
    $('#workFormPreview').innerHTML = `<strong>Live posting preview</strong><br />Taxable ${money(taxable)} · GST ${money(gst)} · Total ${money(taxable + gst)}<br />${esc(place)} · ${$('#workRcm').checked ? 'RCM flagged' : 'forward charge'} · ${$('#workTransactionType').selectedOptions[0]?.textContent}`;
  }

  function openTransactionDialog(desiredType = 'sale') {
    const dialog = $('#workTransactionDialog');
    if (!dialog) { toast('Transaction form is unavailable. Refresh Ledgerly after restarting the server.'); return; }
    $('#workTransactionForm').reset();
    $('#workTransactionType').value = desiredType;
    $('#workTransactionDate').value = new Date().toISOString().slice(0, 10);
    $('#workDocumentNumber').value = `INV-${new Date().getFullYear()}-${String(company().transactions.length + 15).padStart(3, '0')}`;
    fillTransactionForm();
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } catch (error) {
      console.error('Ledgerly could not open the transaction dialog:', error);
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) { if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }

  function saveTransaction(event) {
    event.preventDefault();
    const type = $('#workTransactionType').value;
    const itcEligible = $('#workItcEligible').checked;
    try {
      const transaction = M.createTransaction({ type, documentNumber: $('#workDocumentNumber').value.trim(), date: $('#workTransactionDate').value, partyId: $('#workParty').value, placeOfSupplyStateCode: $('#workPlaceOfSupply').value, category: $('#workCategory').value, rcm: $('#workRcm').checked, reconciliationStatus: type === 'purchase' ? $('#workReconStatus').value : 'not-applicable', itcStatus: type === 'purchase' ? itcEligible ? 'Eligible · pending 2B' : 'Ineligible' : 'Not applicable', items: [{ productId: $('#workProduct').value, quantity: Number($('#workQuantity').value), rate: Number($('#workRate').value), discount: Number($('#workDiscount').value), gstRate: Number($('#workGstRate').value) }] });
      closeDialog($('#workTransactionDialog')); activeView = 'transactions'; search = ''; $('#workSearch').value = ''; render(); openDetail(transaction.id); toast(`${transaction.documentNumber} saved — accounting, GST and return links created.`);
    } catch (error) { $('#workFormError').textContent = error.message || 'Could not save this transaction. Check the required fields.'; }
  }

  function openDetail(id) {
    const record = M.getLifecycle(id, company());
    if (!record) { toast('That record is not available in the active company.'); return; }
    const transaction = record.transaction;
    $('#workTransactionDetail').innerHTML = `<div class="work-detail-card" role="dialog" aria-modal="true"><div class="work-detail-head"><div><span class="section-kicker">FOLLOW ONE TRANSACTION / ${esc(transaction.type.replace('_', ' ').toUpperCase())}</span><h2>${esc(transaction.documentNumber)}</h2><p>${dateLabel(transaction.date)} · ${esc(transaction.partyName)} · ${esc(transaction.partyGSTIN || 'Unregistered')} · ${esc(transaction.placeOfSupply)}</p></div><button type="button" class="work-detail-close" data-work-detail-close aria-label="Close transaction trace">×</button></div><div class="work-detail-summary"><div><span>Taxable value</span><strong>${money(transaction.tax.taxable)}</strong></div><div><span>GST</span><strong>${money(transaction.tax.taxTotal)}</strong></div><div><span>Total</span><strong>${money(transaction.tax.total)}</strong></div><div><span>Scenario</span><strong>${esc(transaction.tax.details.shortLabel)}</strong></div></div><span class="section-kicker">CONNECTED LIFECYCLE</span><div class="work-lifecycle-steps">${record.stages.map(stage => `<article class="work-lifecycle-step ${stage[2]}"><i></i><div><strong>${esc(stage[0])}</strong><span>${esc(stage[1])}</span><small>${esc(stage[3])}</small></div>${statusLabel(stage[2])}</article>`).join('')}</div><div class="work-detail-note">Ledgerly has prepared this chain from one saved transaction. Actual GST portal filing, payment, IRN, e-way bill and registration confirmation are only recorded after the user completes the official or authorised integration step.</div></div>`;
    $('#workTransactionDetail').hidden = false;
    $('[data-work-detail-close]', $('#workTransactionDetail')).addEventListener('click', () => { $('#workTransactionDetail').hidden = true; });
    $('#workTransactionDetail').addEventListener('click', event => { if (event.target === $('#workTransactionDetail')) $('#workTransactionDetail').hidden = true; }, { once: true });
  }

  function quickAddMaster(type) {
    if (type === 'gstin') {
      const value = window.prompt('New GSTIN');
      if (!value?.trim()) return;
      try { M.addGSTIN({ gstin: value.trim(), state: company().state, stateCode: company().stateCode }); render(); toast(`${value.trim().toUpperCase()} added to the GSTIN master.`); } catch (error) { toast(error.message); }
      return;
    }
    const name = window.prompt(`New ${type} name`);
    if (!name?.trim()) return;
    const active = company();
    if (type === 'product') M.addMaster('product', { name: name.trim(), sku: `SKU-${Date.now().toString().slice(-4)}`, hsnSac: '998399', unit: 'unit', purchaseRate: 0, salesRate: 0, gstRate: 18, cessRate: 0, category: 'Review', itcEligible: true });
    else M.addMaster(type, { name: name.trim(), legalName: name.trim(), tradeName: name.trim(), gstin: '', state: active.state, stateCode: active.stateCode, terms: 30, openingBalance: 0, type: type === 'customer' ? 'B2B' : '', itcRelevance: 'Review', rcm: false });
    render(); toast(`${name.trim()} added to the ${type} master.`);
  }

  function exportRows(name, rows) { const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 700); }
  function exportReconciliation() { const rows = M.getReconciliation(company()); exportRows(`${company().tradeName.replaceAll(' ', '-').toLowerCase()}-gstr-2b-reconciliation.csv`, [['Supplier GSTIN', 'Supplier', 'Invoice', 'Date', 'Taxable', 'GST', 'Status', 'ITC'], ...rows.map(row => [row.gstin, row.supplier, row.invoice, row.date, row.taxable, row.tax, reconStatus(row.status), row.itcStatus])]); toast('GSTR-2B reconciliation exported.'); }
  function exportOperationalReports() { const reports = M.getOperationalReports(company()); exportRows(`${company().tradeName.replaceAll(' ', '-').toLowerCase()}-operational-reports.csv`, [['Report', 'Party / Month', 'Age', 'Invoiced / Billed', 'Settled / Paid', 'Balance / Net'], ...reports.receivables.map(row => ['Receivable', row.party, row.age, row.invoices, row.settled, row.balance]), ...reports.payables.map(row => ['Payable', row.party, row.age, row.invoices, row.settled, row.balance]), ...reports.monthly.map(row => ['Cash flow', reportMonthLabel(row.month), '', row.cashIn, row.cashOut, row.net])]); toast('Receivables, payables and cash-flow report exported.'); }
  function parseCsvLine(line) { const cells = []; let value = ''; let quoted = false; for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; } else if (character === '"') quoted = !quoted; else if (character === ',' && !quoted) { cells.push(value.trim()); value = ''; } else value += character; } cells.push(value.trim()); return cells; }
  function importReconciliation(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const lines = String(reader.result).trim().split(/\r?\n/).slice(1); let imported = 0; lines.forEach(line => { const cells = parseCsvLine(line); if (cells.length < 5 || !cells[0] || !cells[1]) return; const active = company(); const externalGstin = cells[0].toUpperCase(); let supplier = active.suppliers.find(item => item.gstin === externalGstin); if (!supplier) supplier = M.addMaster('supplier', { name: `Imported supplier · ${externalGstin}`, legalName: `Imported supplier · ${externalGstin}`, tradeName: `Imported supplier · ${externalGstin}`, gstin: externalGstin, state: active.state, stateCode: externalGstin.slice(0, 2) || active.stateCode, terms: 30, openingBalance: 0, itcRelevance: 'Review', rcm: false }); const taxable = Number(cells[3]) || 0; const externalTax = Number(cells[4]) || 0; M.createTransaction({ type: 'purchase', documentNumber: cells[1], date: cells[2] || new Date().toISOString().slice(0, 10), partyId: supplier.id, placeOfSupplyStateCode: supplier.stateCode, reconciliationStatus: 'partial', itcStatus: 'Eligible · pending review', items: [{ productId: active.products[0].id, quantity: 1, rate: taxable, gstRate: taxable ? externalTax / taxable * 100 : 0 }] }); imported += 1; }); render(); toast(`${imported} row${imported === 1 ? '' : 's'} imported for reconciliation review.`); }; reader.readAsText(file); }
  function exportAudit() { exportRows(`${company().tradeName.replaceAll(' ', '-').toLowerCase()}-audit-trail.csv`, [['Time', 'Actor', 'Action', 'Source', 'Record ID', 'Old value', 'New value'], ...company().audit.map(entry => [entry.at, entry.actor, entry.action, entry.source, entry.recordId, entry.oldValue, entry.newValue])]); toast('Audit trail exported.'); }

  function addCompany(event) { event.preventDefault(); const stateOption = $('#workCompanyInputState').selectedOptions[0]; const name = $('#workCompanyInputName').value.trim(); if (!name) { $('#workCompanyError').textContent = 'Enter a business name.'; return; } const created = M.addCompany({ name, tradeName: $('#workCompanyInputTrade').value.trim() || name, state: stateOption.value, stateCode: stateOption.dataset.code, pan: $('#workCompanyInputPan').value.trim(), gstin: $('#workCompanyInputGstin').value.trim(), businessType: $('#workCompanyInputType').value }); closeDialog($('#workCompanyDialog')); activeView = 'overview'; render(); toast(`${created.tradeName} created and selected.`); }

  function init() {
    const businessType = $('#workCompanyInputType');
    if (businessType) {
      const seenTypes = new Set();
      [...businessType.options].forEach(option => {
        if (seenTypes.has(option.value)) option.remove();
        else seenTypes.add(option.value);
      });
    }
    renderSafely();
    $('#workCompanySelect').addEventListener('change', event => { M.setActiveCompany(event.target.value); activeView = 'overview'; search = ''; $('#workSearch').value = ''; render(); toast(`Switched to ${company().tradeName}.`); });
    $('#workFinancialYear').addEventListener('change', event => { company().financialYear = event.target.value; M.persist(); renderCompanyHeader(); toast(`Financial year changed to ${event.target.value}.`); });
    $$('.work-view-tabs button').forEach(button => button.addEventListener('click', () => { activeView = button.dataset.workView; render(); }));
    $('#workSearch').addEventListener('input', event => { search = event.target.value; if (activeView !== 'transactions') activeView = 'transactions'; render(); $('#workSearch').focus(); });
    $('#workFollowLatest').addEventListener('click', () => company().transactions[0] && openDetail(company().transactions[0].id));
    $('#workTransactionType').addEventListener('change', fillTransactionForm);
    ['workProduct', 'workQuantity', 'workRate', 'workDiscount', 'workGstRate', 'workPlaceOfSupply', 'workRcm'].forEach(id => document.getElementById(id).addEventListener('input', () => { if (id === 'workProduct') { const product = company().products.find(item => item.id === $('#workProduct').value); if (product) $('#workRate').value = ['purchase', 'expense'].includes($('#workTransactionType').value) ? product.purchaseRate : product.salesRate; $('#workGstRate').value = product?.gstRate || 18; } renderFormPreview(); }));
    $('#workTransactionForm').addEventListener('submit', saveTransaction);
    $('#workTransactionClose').addEventListener('click', () => closeDialog($('#workTransactionDialog')));
    $('#workTransactionCancel').addEventListener('click', () => closeDialog($('#workTransactionDialog')));
    $('#workAddCompany').addEventListener('click', () => { $('#workCompanyForm').reset(); if (typeof $('#workCompanyDialog').showModal === 'function') $('#workCompanyDialog').showModal(); else $('#workCompanyDialog').setAttribute('open', ''); });
    $('#workCompanyClose').addEventListener('click', () => closeDialog($('#workCompanyDialog')));
    $('#workCompanyCancel').addEventListener('click', () => closeDialog($('#workCompanyDialog')));
    $('#workCompanyForm').addEventListener('submit', addCompany);
    $('#workCompanySettings').addEventListener('click', () => { activeView = 'masters'; render(); toast('Company profile and GSTIN masters are shown below.'); });
    $('#workResetDemo').addEventListener('click', () => { if (!window.confirm('Reset Work mode to the seeded demo companies and transactions?')) return; M.reset(); activeView = 'overview'; search = ''; $('#workSearch').value = ''; render(); toast('Work demo data reset.'); });
    $('#workAddTransaction')?.addEventListener('click', handleAddTransactionClick);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-work-add-transaction]')) handleAddTransactionClick(event);
    });
    window.renderLedgerlyWork = render;
    $$('[data-work-guide-view]').forEach(item => item.addEventListener('click', () => { activeView = item.dataset.workGuideView; renderSafely(); }));
    $$('[data-work-guide-add]').forEach(item => item.addEventListener('click', () => openTransactionDialog(item.dataset.workGuideAdd)));
    window.openLedgerlyWork = () => { renderSafely(); $('#workWorkspace').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    window.openLedgerlyWorkTransaction = id => { activeView = 'transactions'; if (renderSafely()) openDetail(id); };
    window.LedgerlyWorkSearch = term => { search = term; activeView = 'transactions'; renderSafely(); return filteredTransactions().length; };
  }
  init();
})();
