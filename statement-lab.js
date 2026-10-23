/* Trial balance and Profit & Loss learning screens built from the Tally case model. */
(() => {
  const M = window.LedgerlyTally;
  if (!M) return;
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let statementCase = M.generateCase(true);

  const accountReasons = {
    cash: 'Cash is an asset with a debit balance because the business holds it.',
    bank: 'The business bank balance is an asset, so it appears on the debit side.',
    customer: 'A customer receivable is an asset: the customer owes the business.',
    furniture: 'Furniture is a fixed asset owned by the business.',
    prepaidInsurance: 'Unused insurance is a future benefit, so it remains an asset.',
    purchases: 'Purchases are a trading cost and carry a debit balance before closing.',
    purchaseReturns: 'Purchase returns reduce the purchase cost, so the balance is a credit.',
    sales: 'Sales are income and carry a credit balance.',
    salesReturns: 'Sales returns reduce sales income, so the balance is a debit.',
    supplier: 'The supplier is a payable: the business owes them, so it is a credit balance.',
    capital: 'Owner’s capital is equity introduced into the business, so it is a credit.',
    loan: 'A business loan is a liability repayable to the lender.',
    salaryPayable: 'Unpaid salary is a current liability and therefore a credit balance.',
    drawings: 'Drawings reduce owner’s equity and carry a debit balance.',
    rent: 'Rent is an expense consumed during the period, so it is debited.',
    salary: 'Salary is an expense for the period, so it is debited.',
    depreciation: 'Depreciation is an expense, so it carries a debit balance.',
    insurance: 'Insurance consumed during the period is an expense.',
    interestIncome: 'Interest earned is other income and carries a credit balance.',
    accumulatedDepreciation: 'Accumulated depreciation is a contra-asset with a credit balance.'
  };

  function accountName(id) { return statementCase.accounts.find(account => account.id === id)?.name || id; }
  function setText(id, value) { const element = $(id); if (element) element.textContent = value; }

  function renderTrialBalance() {
    const books = M.calculateBooks(statementCase);
    const rows = statementCase.accounts.filter(account => books.balances[account.id]);
    setText('#trialBalanceCompany', statementCase.company);
    setText('#trialBalanceAsOf', `Trial balance as at ${statementCase.asOf} · ${rows.length} closing accounts · INR`);
    setText('#trialBalanceDebitTotal', money(books.trialDebit));
    setText('#trialBalanceCreditTotal', money(books.trialCredit));
    setText('#trialBalanceDebitFooter', money(books.trialDebit));
    setText('#trialBalanceCreditFooter', money(books.trialCredit));
    const valid = Math.round(books.trialDebit * 100) === Math.round(books.trialCredit * 100);
    const validNode = $('#trialBalanceValid');
    validNode.textContent = valid ? '✓ Balanced' : 'Check totals';
    validNode.classList.toggle('error', !valid);
    $('#trialBalanceRows').replaceChildren(...rows.map(account => {
      const balance = books.balances[account.id];
      const row = document.createElement('tr');
      row.dataset.account = account.id;
      row.tabIndex = 0;
      const name = document.createElement('td');
      name.textContent = account.name;
      const debit = document.createElement('td');
      debit.textContent = balance > 0 ? money(balance) : '—';
      const credit = document.createElement('td');
      credit.textContent = balance < 0 ? money(Math.abs(balance)) : '—';
      row.append(name, debit, credit);
      const explain = () => {
        $$('#trialBalanceRows tr').forEach(item => item.classList.toggle('selected', item === row));
        setText('#trialBalanceExplanation', `${accountName(account.id)} has a ${balance > 0 ? 'debit' : 'credit'} balance of ${money(Math.abs(balance))}. ${accountReasons[account.id] || 'Its closing ledger balance is brought into the trial balance.'}`);
      };
      row.addEventListener('click', explain);
      row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); explain(); } });
      return row;
    }));
    setText('#trialBalanceExplanation', 'Select an account row to see why its balance sits on the debit or credit side.');
    setText('#trialBalanceQuizFeedback', 'Choose one answer to test the checkpoint.');
    $$('#trialBalanceQuiz button').forEach(button => button.classList.remove('correct', 'incorrect'));
  }

  function renderProfitLoss() {
    const books = M.calculateBooks(statementCase);
    const resultLabel = books.profit >= 0 ? `Profit ${money(books.profit)}` : `Loss ${money(Math.abs(books.profit))}`;
    setText('#pnlCompany', statementCase.company);
    setText('#pnlAsOf', `Profit & Loss for ${statementCase.period} · INR`);
    setText('#pnlGrossProfit', money(books.grossProfit));
    setText('#pnlExpenses', money(books.expenses));
    setText('#pnlOtherIncome', money(books.otherIncome));
    setText('#pnlNetResult', resultLabel);
    setText('#pnlGrossProfitFooter', money(books.grossProfit));
    setText('#pnlNetResultFooter', resultLabel);
    setText('#pnlSales', money(books.netSales));
    setText('#pnlCogs', money(books.costOfGoodsSold));
    setText('#pnlRent', money(books.balances.rent));
    setText('#pnlSalary', money(books.balances.salary));
    setText('#pnlDepreciation', money(books.balances.depreciation));
    setText('#pnlInsurance', money(books.balances.insurance));
    setText('#pnlInterest', money(books.otherIncome));
    setText('#pnlFormulaResult', resultLabel);
    setText('#pnlExplanationTitle', `${resultLabel} flows into owner’s equity.`);
    setText('#pnlExplanation', `Net sales of ${money(books.netSales)} less cost of goods sold of ${money(books.costOfGoodsSold)} gives gross profit of ${money(books.grossProfit)}. After ${money(books.expenses)} of operating expenses and ${money(books.otherIncome)} of other income, the business has ${resultLabel.toLowerCase()}.`);
    $('#pnlFormulaRows').replaceChildren(...[
      ['Net sales', books.netSales], ['Less: cost of goods sold', -books.costOfGoodsSold], ['Gross profit', books.grossProfit],
      ['Less: operating expenses', -books.expenses], ['Add: other income', books.otherIncome], [resultLabel, books.profit]
    ].map(([label, amount], index) => {
      const row = document.createElement('div');
      if (index === 2 || index === 5) row.className = 'profit-final';
      const title = document.createElement('span');
      title.textContent = label;
      const value = document.createElement('strong');
      value.textContent = `${amount < 0 ? '− ' : ''}${money(Math.abs(amount))}`;
      row.append(title, value);
      return row;
    }));
    setText('#pnlQuizFeedback', 'Choose the account that is consumed during the period.');
    $$('#pnlQuiz button').forEach(button => button.classList.remove('correct', 'incorrect'));
  }

  function renderStatements() {
    renderTrialBalance();
    renderProfitLoss();
  }

  $('#trialBalanceRandomize').addEventListener('click', () => { statementCase = M.generateCase(true); renderStatements(); showToast('New trial balance generated from a balanced sample business.'); });
  $('#pnlRandomize').addEventListener('click', () => { statementCase = M.generateCase(true); renderStatements(); showToast('New Profit & Loss statement generated from a balanced sample business.'); });
  $$('#trialBalanceQuiz button').forEach(button => button.addEventListener('click', () => {
    const correct = button.dataset.trialAnswer === 'credit';
    $$('#trialBalanceQuiz button').forEach(item => { item.classList.remove('correct', 'incorrect'); if (item.dataset.trialAnswer === 'credit') item.classList.add('correct'); });
    if (!correct) button.classList.add('incorrect');
    setText('#trialBalanceQuizFeedback', `${correct ? 'Correct.' : 'Not quite.'} Credit balances are recorded in the Credit column. Assets, expenses and drawings normally sit on the debit side.`);
    if (correct) completeMilestone('trial-balance');
  }));
  $$('#pnlQuiz button').forEach(button => button.addEventListener('click', () => {
    const correct = button.dataset.pnlAnswer === 'rent';
    $$('#pnlQuiz button').forEach(item => { item.classList.remove('correct', 'incorrect'); if (item.dataset.pnlAnswer === 'rent') item.classList.add('correct'); });
    if (!correct) button.classList.add('incorrect');
    setText('#pnlQuizFeedback', `${correct ? 'Correct.' : 'Not quite.'} Office rent is an expense consumed during the period, so it belongs in Profit & Loss. Capital and loan balances belong on the balance sheet.`);
    if (correct) completeMilestone('profit-loss');
  }));
  renderStatements();
})();
