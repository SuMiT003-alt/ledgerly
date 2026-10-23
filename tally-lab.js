(() => {
  const M = window.LedgerlyTally;
  const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const money = value => currency.format(value === 0 ? 0 : value);
  const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const voucher = id => M.vouchers.find(item => item.id === id);
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const shuffle = values => {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  let companyCase = M.generateCase();
  let postedCount = 0;
  let transactionIndex = 0;
  let selectedVoucher = null;
  let extraLedgers = [];
  let masterTarget = '#tallyDebit';
  let statementCase = M.generateCase(true);
  let classificationOrder = [];
  let answersShown = false;
  const currentTransaction = () => companyCase.transactions[transactionIndex];
  const account = id => [...companyCase.accounts, ...extraLedgers].find(item => item.id === id);
  const isPosted = () => transactionIndex < postedCount;

  function setTab(buttons, attribute, panels, selected) {
    buttons.forEach(button => {
      const active = button.dataset[attribute] === selected;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    Object.entries(panels).forEach(([key, selector]) => { $(selector).hidden = key !== selected; });
  }
  const tallyPanels = { guide: '#tallyGuidePanel', entry: '#tallyEntryPanel', coach: '#tallyCoachPanel', shortcuts: '#tallyShortcutsPanel' };
  const balancePanels = { learn: '#balanceLearnPanel', build: '#balanceBuildPanel' };
  function openTallyTab(tab) { setTab($$('[data-tally-tab]'), 'tallyTab', tallyPanels, tab); }
  function openBalanceTab(tab) { setTab($$('[data-balance-tab]'), 'balanceTab', balancePanels, tab); }
  function wireTabs(selector, open) {
    $$(selector).forEach((button, index, buttons) => {
      button.addEventListener('click', () => open(button.dataset.tallyTab || button.dataset.balanceTab));
      button.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        buttons[next].click();
        buttons[next].focus();
      });
    });
  }
  wireTabs('[data-tally-tab]', openTallyTab);
  wireTabs('[data-balance-tab]', openBalanceTab);

  function renderGuide(id) {
    const data = voucher(id);
    $('#guideVoucherTitle').textContent = data.name;
    $('#guideVoucherKey').textContent = data.key;
    $('#guideVoucherUse').textContent = data.use;
    $('#guideDebit').textContent = data.debit;
    $('#guideCredit').textContent = data.credit;
    $('#guideVoucherAvoid').textContent = data.avoid;
    $('#guideVoucherSteps').replaceChildren(...data.steps.map(step => node('li', '', step)));
    $$('#voucherGuideTabs button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.voucher === id)));
  }
  $('#voucherGuideTabs').replaceChildren(...M.vouchers.map(data => {
    const button = node('button', 'voucher-guide-card');
    button.type = 'button';
    button.dataset.voucher = data.id;
    button.setAttribute('aria-pressed', 'false');
    button.append(node('span', 'voucher-symbol', data.icon), node('strong', '', data.name), node('kbd', '', data.key));
    button.addEventListener('click', () => renderGuide(data.id));
    return button;
  }));
  $('#guideTry').addEventListener('click', () => {
    window.showLedgerlyWorkspace?.('tools');
    openTallyTab('entry');
    $('#tallyEntryPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function chooseVoucher(id) {
    selectedVoucher = id;
    $('#tallySelectedVoucher').textContent = id ? `${voucher(id).name} voucher · ${voucher(id).key}` : 'Choose a voucher';
    $$('#tallyVoucherRibbon button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.voucher === id)));
    renderModeHelp();
  }
  $('#tallyVoucherRibbon').replaceChildren(...M.vouchers.map(data => {
    const button = node('button', 'voucher-ribbon-button');
    button.type = 'button';
    button.dataset.voucher = data.id;
    button.setAttribute('aria-pressed', 'false');
    button.append(node('span', '', data.name), node('kbd', '', data.key));
    button.addEventListener('click', () => { if (!isPosted()) chooseVoucher(data.id); });
    return button;
  }));
  $('#tallyShortcutCards').replaceChildren(...M.vouchers.map(data => {
    const button = node('button', 'shortcut-card');
    button.type = 'button';
    button.append(node('kbd', '', data.key), node('strong', '', data.name), node('span', '', data.use));
    button.addEventListener('click', () => {
      openTallyTab('entry');
      $('#tallyKeyboardMode').checked = true;
      if (!isPosted()) chooseVoucher(data.id);
      $('#tallySimulator').focus({ preventScroll: true });
      $('#tallySimulator').scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`${data.key} → ${data.name}. Try its key inside the trainer.`);
    });
    return button;
  }));
  const utilityKeys = [
    ['F2', 'Change voucher date'], ['Ctrl+A', 'Accept / save a screen'], ['Ctrl+H', 'Change voucher mode / report view'],
    ['Alt+C', 'Create a master from a ledger field'], ['Alt+G', 'Go To a report or create master'], ['F10', 'Other vouchers'],
    ['Tab / Shift+Tab', 'Next / previous field'], ['F12', 'Screen-specific configuration']
  ];
  $('#tallyUtilityKeys').replaceChildren(...utilityKeys.map(([key, label]) => {
    const row = node('div');
    row.append(node('kbd', '', key), node('span', '', label));
    return row;
  }));

  function renderMasters() {
    $('#tallyMasters').replaceChildren(...[...companyCase.accounts, ...extraLedgers].map(ledger => {
      const row = node('div');
      row.append(node('strong', '', ledger.name), node('span', '', ledger.group));
      return row;
    }));
  }
  function ledgerOptions() {
    ['#tallyDebit', '#tallyCredit'].forEach(selector => {
      const selection = $(selector).value;
      $(selector).replaceChildren(new Option('Choose a ledger', ''), ...[...companyCase.accounts, ...extraLedgers].map(ledger => new Option(ledger.name, ledger.id)));
      $(selector).value = selection;
    });
  }
  function renderModeHelp() {
    const data = selectedVoucher ? voucher(selectedVoucher) : voucher(currentTransaction().voucher);
    $('#tallyModeHelp').textContent = ['sales', 'purchase', 'debit-note', 'credit-note'].includes(data.id)
      ? `${data.name}: in Tally, Ctrl+H selects Item Invoice for stock quantities/rates or Accounting Invoice for ledger amounts. This trainer exposes the underlying debit/credit entry. The source document gives the item quantity, rate and original reference.`
      : `${data.name}: ${data.steps[1]} This trainer uses the double-entry view so you can see both ledger effects.`;
  }
  function toggleModeHelp() {
    $('#tallyModeHelp').hidden = !$('#tallyModeHelp').hidden;
    $('#tallyModeButton').setAttribute('aria-expanded', String(!$('#tallyModeHelp').hidden));
    renderModeHelp();
  }
  $('#tallyModeButton').setAttribute('aria-controls', 'tallyModeHelp');
  $('#tallyModeButton').setAttribute('aria-expanded', 'false');
  $('#tallyModeButton').addEventListener('click', toggleModeHelp);

  function renderWorkedEntry() {
    const transaction = currentTransaction();
    const data = voucher(transaction.voucher);
    const entry = node('div', 'worked-entry');
    entry.append(node('strong', '', `${data.name} · ${data.key}`), node('p', '', `${account(transaction.debit).name} Dr ${money(transaction.amount)}`), node('p', '', `To ${account(transaction.credit).name} ${money(transaction.amount)}`));
    $('#tallyWorkedEntry').replaceChildren(entry);
    $('#tallyWorkedReason').textContent = transaction.reason;
    $('#tallyWorkedSteps').replaceChildren(...data.steps.map(step => node('li', '', step)));
  }
  function setFeedback(message, status = '') {
    $('#tallyFeedback').textContent = message;
    $('#tallyFeedback').className = `tally-feedback ${status}`;
  }
  function updateTotals() {
    const debit = Number($('#tallyDebitAmount').value) || 0;
    const credit = Number($('#tallyCreditAmount').value) || 0;
    $('#tallyDebitTotal').textContent = money(debit);
    $('#tallyCreditTotal').textContent = money(credit);
    $('#tallyDifference').textContent = debit > 0 && credit > 0
      ? debit === credit ? 'Amounts balanced ✓' : `Difference ${money(Math.abs(debit - credit))}`
      : 'Enter both amounts';
    $('#tallyDifference').classList.toggle('error', debit !== credit);
  }
  function fillExample() {
    const transaction = currentTransaction();
    chooseVoucher(transaction.voucher);
    $('#tallyDate').value = transaction.date;
    $('#tallyDebit').value = transaction.debit;
    $('#tallyCredit').value = transaction.credit;
    $('#tallyDebitAmount').value = transaction.amount;
    $('#tallyCreditAmount').value = transaction.amount;
    $('#tallyNarration').value = `${transaction.title} · ${transaction.reference}`;
    updateTotals();
  }
  $('#tallyFillExample').addEventListener('click', () => {
    if (isPosted()) return;
    fillExample();
    setFeedback('Worked example filled. Read the reason, then check and post to see its effect on the books.');
  });

  function renderDocument() {
    const transaction = currentTransaction();
    $('#tallyForm').reset();
    ledgerOptions();
    $('#tallyDate').value = transaction.date;
    $('#tallyTransaction').value = String(transactionIndex);
    $('#tallyDocumentDate').textContent = dateLabel(transaction.date);
    $('#tallyDocumentRef').textContent = transaction.reference;
    $('#tallyDocumentTitle').textContent = `${String(transactionIndex + 1).padStart(2, '0')} / ${transaction.title}`;
    $('#tallyDocumentStory').textContent = transaction.story;
    $('#tallyDocumentAmount').textContent = money(transaction.amount);
    $('#tallyWalkthrough').open = false;
    chooseVoucher(null);
    renderWorkedEntry();
    if (isPosted()) fillExample();
    $$('#tallyForm input, #tallyForm select, #tallyVoucherRibbon button').forEach(field => { field.disabled = isPosted(); });
    $('#tallyFillExample').disabled = isPosted();
    $('#tallyPost').disabled = isPosted();
    $('#tallyNext').disabled = !isPosted() || postedCount >= companyCase.transactions.length;
    $('#tallyNext').innerHTML = transactionIndex < postedCount - 1 ? 'Resume current document <span>→</span>' : 'Next document <span>→</span>';
    setFeedback(isPosted() ? 'Already posted in this case. Review the entry here; it will not be added twice.' : 'Choose the voucher first, then apply the debit and credit logic.', isPosted() ? 'success' : '');
    updateTotals();
  }

  function renderLiveBooks() {
    const books = M.calculateBooks(companyCase, postedCount);
    $('#tallyPostedCount').textContent = `${postedCount} / ${companyCase.transactions.length} posted`;
    $('#tallyCaseProgress').style.width = `${postedCount / companyCase.transactions.length * 100}%`;
    const stats = [
      ['Cash in hand', books.balances.cash], ['Business Bank', books.balances.bank],
      ['Customer receivable', books.balances.customer], ['Supplier payable', -books.balances.supplier]
    ];
    $('#tallyLiveStats').replaceChildren(...stats.map(([label, amount]) => {
      const card = node('div');
      card.append(node('span', '', label), node('strong', '', money(amount)));
      return card;
    }));
    $('#tallyTransaction').replaceChildren(...companyCase.transactions.map((transaction, index) => {
      const option = new Option(`${String(index + 1).padStart(2, '0')} · ${transaction.title}${index < postedCount ? ' ✓' : ''}`, index);
      option.disabled = index > postedCount;
      return option;
    }));
    $('#tallyTransaction').value = String(transactionIndex);
    $('#tallyDaybookCount').textContent = `${postedCount} vouchers · Dr ${money(books.trialDebit)} = Cr ${money(books.trialCredit)}`;
    $('#tallyDaybookEmpty').hidden = postedCount > 0;
    $('#tallyDaybookBody').replaceChildren(...companyCase.transactions.slice(0, postedCount).map((transaction, index) => {
      const row = node('tr');
      const dateCell = node('td');
      const inspect = node('button', 'tiny-link', dateLabel(transaction.date));
      inspect.type = 'button';
      inspect.setAttribute('aria-label', `Review posted voucher ${index + 1}: ${transaction.title}`);
      inspect.addEventListener('click', () => { transactionIndex = index; renderDocument(); $('#tallySimulator').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      dateCell.append(inspect);
      row.append(dateCell, node('td', '', voucher(transaction.voucher).name), node('td', '', account(transaction.debit).name), node('td', '', account(transaction.credit).name), node('td', 'lab-money', money(transaction.amount)));
      return row;
    }));
    const complete = postedCount === companyCase.transactions.length;
    $('#tallyToBalance').disabled = !complete;
    $('#tallyCompletionText').textContent = complete
      ? 'Month complete! Your vouchers balance. Now follow the closing stock, profit, assets and liabilities into the balance sheet.'
      : 'Complete all 20 documents to carry this company into the balance sheet lab.';
  }
  function initializeCompany(randomized = false) {
    companyCase = M.generateCase(randomized);
    postedCount = 0;
    transactionIndex = 0;
    extraLedgers = [];
    $('#tallyCompany').textContent = companyCase.company;
    renderMasters();
    renderLiveBooks();
    renderDocument();
  }
  $('#tallyNewCase').addEventListener('click', () => { initializeCompany(true); showToast('Fresh company, fresh transaction values. Start with document 01.'); });
  $('#tallyTransaction').addEventListener('change', event => {
    transactionIndex = Number(event.target.value);
    renderDocument();
  });
  $('#tallyNext').addEventListener('click', () => {
    if (postedCount >= companyCase.transactions.length) return;
    transactionIndex = postedCount;
    renderDocument();
    $('#tallySimulator').focus({ preventScroll: true });
  });
  $$('#tallyForm input, #tallyForm select').forEach(field => field.addEventListener('input', () => {
    if (!isPosted()) setFeedback('Ready? Check the voucher, accounts, date and source-document amount.');
    updateTotals();
  }));
  $('#tallyForm').addEventListener('submit', event => {
    event.preventDefault();
    if (isPosted() || transactionIndex !== postedCount) return;
    const transaction = currentTransaction();
    const debit = Number($('#tallyDebitAmount').value);
    const credit = Number($('#tallyCreditAmount').value);
    let error;
    if (selectedVoucher !== transaction.voucher) error = `Choose ${voucher(transaction.voucher).name} (${voucher(transaction.voucher).key}) for this document. ${voucher(transaction.voucher).use}`;
    else if ($('#tallyDate').value !== transaction.date) error = `Match the source date: ${dateLabel(transaction.date)}. Use F2 to change the voucher date in Tally.`;
    else if (debit !== credit) error = 'The debit and credit amounts must match. Equal amounts keep the voucher balanced.';
    else if ($('#tallyDebit').value !== transaction.debit || $('#tallyCredit').value !== transaction.credit) error = `Debit ${account(transaction.debit).name}; credit ${account(transaction.credit).name}. ${transaction.reason}`;
    else if (debit !== transaction.amount) error = `The ledgers are correct. Match the document amount: ${money(transaction.amount)} on each side.`;
    if (error) { setFeedback(error, 'error'); return; }
    postedCount += 1;
    renderLiveBooks();
    $$('#tallyForm input, #tallyForm select, #tallyVoucherRibbon button').forEach(field => { field.disabled = true; });
    $('#tallyPost').disabled = true;
    $('#tallyFillExample').disabled = true;
    $('#tallyNext').disabled = postedCount >= companyCase.transactions.length;
    setFeedback(`Posted ✓ ${transaction.reason} The live balances and Day Book have been updated.`, 'success');
    if (postedCount === companyCase.transactions.length) completeMilestone('tally');
  });

  // Practice ledger creation, contextual to the simulator's ledger fields.
  const masterGroups = [...new Set(companyCase.accounts.map(ledger => ledger.group))].sort();
  $('#tallyMasterGroup').replaceChildren(...masterGroups.map(group => new Option(group, group)));
  function openMaster(target) {
    if (isPosted()) return;
    masterTarget = target;
    $('#tallyMasterForm').reset();
    $('#tallyMasterFeedback').textContent = '';
    $('#tallyMasterDialog').showModal();
    $('#tallyMasterName').focus();
  }
  $('#tallyMasterClose').addEventListener('click', () => $('#tallyMasterDialog').close());
  $('#tallyMasterForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#tallyMasterName').value.trim();
    if (!name || [...companyCase.accounts, ...extraLedgers].some(ledger => ledger.name.toLowerCase() === name.toLowerCase())) {
      $('#tallyMasterFeedback').textContent = 'Enter a new, non-empty ledger name. This company already includes the listed case ledgers.';
      return;
    }
    const ledger = { id: `custom-${extraLedgers.length + 1}`, name, group: $('#tallyMasterGroup').value };
    extraLedgers.push(ledger);
    ledgerOptions();
    renderMasters();
    $(masterTarget).value = ledger.id;
    $('#tallyMasterDialog').close();
    $(masterTarget).focus();
    setFeedback(`Practice ledger “${name}” created under ${ledger.group}. Use the source document to choose the correct case ledger.`);
  });
  window.addEventListener('keydown', event => {
    if (!$('#tallyKeyboardMode').checked || event.repeat || event.metaKey || event.shiftKey) return;
    if ($('#tallyMasterDialog').open) {
      if (event.ctrlKey && event.key.toLowerCase() === 'a') { event.preventDefault(); $('#tallyMasterForm').requestSubmit(); }
      return;
    }
    if ($('#tallyEntryPanel').hidden || !$('#tallySimulator').contains(document.activeElement) || isPosted()) return;
    const key = event.key.toUpperCase();
    const voucherKey = `${event.altKey ? 'Alt+' : ''}${key}`;
    const selected = !event.ctrlKey && M.vouchers.find(item => item.key === voucherKey);
    if (selected) { event.preventDefault(); chooseVoucher(selected.id); }
    else if (!event.ctrlKey && !event.altKey && key === 'F2') { event.preventDefault(); $('#tallyDate').focus(); }
    else if (event.ctrlKey && !event.altKey && key === 'A') { event.preventDefault(); $('#tallyForm').requestSubmit(); }
    else if (event.ctrlKey && !event.altKey && key === 'H') { event.preventDefault(); toggleModeHelp(); }
    else if (event.altKey && !event.ctrlKey && key === 'C' && ['tallyDebit', 'tallyCredit'].includes(document.activeElement.id)) {
      event.preventDefault(); openMaster(`#${document.activeElement.id}`);
    }
  });

  // Financial statements are computed from the very same double-entry transactions.
  function statementRow(item) {
    const button = node('button', 'statement-account');
    button.type = 'button';
    button.dataset.account = item.id;
    button.append(node('span', '', item.name), node('strong', '', money(item.amount)), node('i', '', '↗'));
    button.addEventListener('click', () => explainAccount(item));
    return button;
  }
  function explainAccount(item) {
    const books = M.calculateBooks(statementCase);
    const currentAccounts = Object.fromEntries(statementCase.accounts.map(ledger => [ledger.id, ledger]));
    const keys = item.id === 'furniture' ? ['furniture', 'accumulatedDepreciation'] : [item.id];
    let transactions = statementCase.transactions.filter(transaction => keys.includes(transaction.debit) || keys.includes(transaction.credit));
    if (item.id === 'stock') transactions = statementCase.transactions.filter(transaction => transaction.stockDelta);
    if (item.id === 'profit') transactions = statementCase.transactions.filter(transaction => ['purchases', 'purchaseReturns', 'sales', 'salesReturns', 'rent', 'salary', 'depreciation', 'insurance', 'interestIncome'].some(id => id === transaction.debit || id === transaction.credit));
    const title = node('h4', '', `${item.name} · ${money(item.amount)}`);
    const description = node('p', '', item.why);
    const trace = node('ul', 'account-trace');
    transactions.forEach(transaction => {
      trace.append(node('li', '', `${dateLabel(transaction.date)} · ${voucher(transaction.voucher).name} · ${currentAccounts[transaction.debit].name} Dr / ${currentAccounts[transaction.credit].name} Cr · ${money(transaction.amount)}`));
    });
    const extra = item.id === 'stock' ? node('p', 'trace-note', `${books.stockUnits} unsold reams × ${money(statementCase.values.cost)} cost = ${money(books.closingStock)}. Goods sold are recognised through cost of goods sold.`)
      : item.id === 'profit' ? node('p', 'trace-note', `Net sales ${money(books.netSales)} − cost of goods sold ${money(books.costOfGoodsSold)} − operating expenses ${money(books.expenses)} + other income ${money(books.otherIncome)} = ${money(books.profit)}.`) : null;
    $('#balanceExplanation').replaceChildren(node('span', 'section-kicker', 'TRACE TO THE VOUCHERS'), title, description, trace, ...(extra ? [extra] : []));
    $$('.statement-account').forEach(button => button.classList.toggle('selected', button.dataset.account === item.id));
  }
  function renderStatement() {
    const books = M.calculateBooks(statementCase);
    const items = M.classificationItems(statementCase);
    $('#balanceCompany').textContent = statementCase.company;
    $('#balanceAsOf').textContent = `Balance sheet as at ${statementCase.asOf} · Completed 20-voucher case · INR`;
    $('#balanceTotalAssets').textContent = money(books.assets);
    $('#balanceTotalLiabilities').textContent = money(books.liabilities);
    $('#balanceTotalEquity').textContent = money(books.equity);
    const valid = books.assets === books.liabilities + books.equity;
    $('#balanceValid').textContent = valid ? '✓ Balanced' : 'Check totals';
    $('#balanceValid').classList.toggle('error', !valid);
    $('#balanceAssetRows').replaceChildren(
      node('h5', 'statement-group', 'Current assets'),
      ...items.filter(item => item.group === 'current-asset').map(statementRow),
      node('h5', 'statement-group', 'Fixed assets'),
      ...items.filter(item => item.group === 'fixed-asset').map(statementRow)
    );
    $('#balanceFundingRows').replaceChildren(
      node('h5', 'statement-group', 'Liabilities'),
      ...items.filter(item => item.group === 'liability').map(statementRow),
      node('h5', 'statement-group', 'Capital & current-period result'),
      ...items.filter(item => item.group === 'equity').map(statementRow)
    );
    $('#balanceAssetsFooter').textContent = money(books.assets);
    $('#balanceFundingFooter').textContent = money(books.liabilities + books.equity);
    $('#balanceExplanation').replaceChildren(node('span', 'section-kicker', 'FOLLOW THE MONEY'), node('p', '', 'Click any account to see its classification and the vouchers behind the balance. Drawings are shown as a deduction from equity; accumulated depreciation is deducted from furniture.'));
    $('#balanceProfitSummary').textContent = `${books.profit >= 0 ? 'Profit' : 'Loss'} ${money(Math.abs(books.profit))}`;
    const profitRows = [
      ['Net sales (sales less returns)', books.netSales], ['Less: cost of goods sold', -books.costOfGoodsSold],
      ['Gross profit', books.grossProfit], ['Less: office rent', -books.balances.rent],
      ['Less: salaries, including accrual', -books.balances.salary], ['Less: depreciation', -books.balances.depreciation],
      ['Less: insurance consumed', -books.balances.insurance], ['Add: interest earned', books.otherIncome],
      [books.profit >= 0 ? 'Net profit transferred to equity' : 'Net loss deducted from equity', books.profit]
    ];
    $('#balanceProfitRows').replaceChildren(...profitRows.map(([label, amount], index) => {
      const row = node('div', index === profitRows.length - 1 ? 'profit-final' : '');
      row.append(node('span', '', label), node('strong', '', money(amount)));
      return row;
    }));
    $('#balanceInventoryNote').textContent = `Opening stock is zero. Net purchases ${money(books.netPurchases)} − closing stock (${books.stockUnits} reams × ${money(statementCase.values.cost)}) ${money(books.closingStock)} = cost of goods sold ${money(books.costOfGoodsSold)}. Salary and rent expense are not added again as balance-sheet items.`;
    $('#balanceSourceRows').replaceChildren(...statementCase.transactions.map(transaction => {
      const row = node('tr');
      row.append(node('td', '', dateLabel(transaction.date)), node('td', '', voucher(transaction.voucher).name), node('td', '', transaction.story), node('td', 'lab-money', money(transaction.amount)));
      return row;
    }));
  }

  function renderClassification() {
    answersShown = false;
    classificationOrder = shuffle(M.classificationItems(statementCase));
    $('#balanceBuildScore').textContent = `0 / ${classificationOrder.length}`;
    $('#balanceBuildFeedback').textContent = 'Sort all 15 accounts, then check your work.';
    $('#balanceBuildFeedback').className = 'tally-feedback';
    $('#balanceShowAnswers').innerHTML = 'Show &amp; explain answers <span>↗</span>';
    $('#balanceClassification').replaceChildren(...classificationOrder.map(item => {
      const card = node('div', 'classification-card');
      card.dataset.item = item.id;
      const label = node('label');
      const select = node('select');
      select.id = `classify-${item.id}`;
      select.setAttribute('aria-label', `Classify ${item.name}`);
      select.append(new Option('Choose where it belongs', ''), ...M.classificationGroups.map(([id, name]) => new Option(name, id)));
      label.append(node('strong', '', item.name), node('span', 'classification-amount', money(item.amount)), select);
      const explanation = node('p', 'classification-explanation');
      explanation.hidden = true;
      select.addEventListener('change', () => { card.classList.remove('correct', 'incorrect'); explanation.hidden = true; });
      card.append(label, explanation);
      return card;
    }));
  }
  function checkClassifications(reveal = false) {
    let correct = 0;
    classificationOrder.forEach(item => {
      const card = $(`.classification-card[data-item="${item.id}"]`);
      const select = $('select', card);
      const explanation = $('.classification-explanation', card);
      if (reveal) select.value = item.group;
      const matches = select.value === item.group;
      if (matches) correct += 1;
      card.classList.toggle('correct', matches);
      card.classList.toggle('incorrect', !matches);
      explanation.textContent = `${matches ? '✓' : `Choose ${M.classificationGroups.find(([id]) => id === item.group)[1]}.`} ${item.why}`;
      explanation.hidden = false;
    });
    $('#balanceBuildScore').textContent = answersShown ? 'Worked solution' : `${correct} / ${classificationOrder.length}`;
    $('#balanceBuildFeedback').textContent = answersShown ? 'Worked answers are shown with reasons. Reset and try yourself to practise the classifications.'
      : correct === classificationOrder.length ? 'All 15 correct! The balance sheet shows assets, liabilities and equity. The individual income and expense accounts flow through Profit & Loss.'
      : `${correct} of 15 correct. Use each explanation to fix the remaining accounts and check again.`;
    $('#balanceBuildFeedback').className = `tally-feedback ${correct === classificationOrder.length ? 'success' : 'error'}`;
    if (correct === classificationOrder.length && !answersShown) completeMilestone('balance-sheet');
  }
  $('#balanceBuildForm').addEventListener('submit', event => { event.preventDefault(); checkClassifications(); });
  $('#balanceShowAnswers').addEventListener('click', () => {
    if (answersShown) { renderClassification(); return; }
    answersShown = true;
    checkClassifications(true);
    $('#balanceShowAnswers').innerHTML = 'Reset &amp; try yourself <span>↻</span>';
  });
  function setStatementCase(data) { statementCase = data; renderStatement(); renderClassification(); }
  $('#balanceRandomize').addEventListener('click', () => { setStatementCase(M.generateCase(true)); showToast('Fresh balance sheet generated from a new, balanced 20-voucher case.'); });
  $('#tallyToBalance').addEventListener('click', () => {
    if (postedCount !== companyCase.transactions.length) return;
    setStatementCase(companyCase);
    openBalanceTab('learn');
    navigateLearning('balance-sheet');
  });
  $('#balanceDownload').addEventListener('click', () => {
    const ledgers = Object.fromEntries(statementCase.accounts.map(ledger => [ledger.id, ledger]));
    const rows = [['Date', 'Voucher', 'Shortcut', 'Debit ledger', 'Debit group', 'Credit ledger', 'Credit group', 'Amount INR', 'Reference', 'Source description', 'Stock quantity change', 'Stock item', 'Unit cost INR']];
    statementCase.transactions.forEach(transaction => rows.push([
      transaction.date, voucher(transaction.voucher).name, voucher(transaction.voucher).key,
      ledgers[transaction.debit].name, ledgers[transaction.debit].group, ledgers[transaction.credit].name, ledgers[transaction.credit].group,
      transaction.amount, transaction.reference, transaction.story, transaction.stockDelta, statementCase.stockItem, statementCase.values.cost
    ]));
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = node('a');
    link.href = url;
    link.download = `${statementCase.company.replaceAll(' ', '-').toLowerCase()}-april-2026-case.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  renderGuide('sales');
  initializeCompany();
  setStatementCase(statementCase);
})();
