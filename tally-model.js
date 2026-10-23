/* Pure accounting model shared by the voucher trainer and financial statements. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.LedgerlyTally = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const vouchers = [
    { id: 'sales', name: 'Sales', key: 'F8', icon: '↗', use: 'Record a sale — cash or credit.', avoid: 'Collecting an invoice already recorded? Use Receipt, so sales are not counted twice.', debit: 'Cash / Bank or customer', credit: 'Sales', steps: ['Open Vouchers → F8 (Sales).', 'Use Ctrl+H to choose Item Invoice for stock items or Accounting Invoice for ledger-based sales.', 'Choose Cash for a cash sale, or the customer for a credit sale. Enter the sales ledger or stock item, quantity and rate.', 'Check invoice details and save with Ctrl+A.'] },
    { id: 'purchase', name: 'Purchase', key: 'F9', icon: '↙', use: 'Record goods bought for resale — cash or credit.', avoid: 'Paying a supplier invoice already recorded? Use Payment rather than creating another purchase.', debit: 'Purchases', credit: 'Cash / Bank or supplier', steps: ['Open Vouchers → F9 (Purchase).', 'Enter the supplier invoice number and date. Choose the supplier, or Cash for a direct cash purchase.', 'Select Item Invoice or Accounting Invoice using Ctrl+H. Enter the purchase ledger or item and amount.', 'Review the invoice and save with Ctrl+A.'] },
    { id: 'receipt', name: 'Receipt', key: 'F6', icon: '↓', use: 'Money received: customer collections, capital, loans, or other receipts.', avoid: 'A new cash sale belongs in Sales. Receiving money is not always earning income.', debit: 'Cash / Bank', credit: 'Customer, Capital, Loan or Income', steps: ['Open Vouchers → F6 (Receipt).', 'Use Ctrl+H to choose Single Entry or Double Entry, as appropriate.', 'Select the receiving Cash/Bank ledger and the source ledger. For invoice collection, allocate against the existing reference.', 'Enter the amount and narration, then Ctrl+A to save.'] },
    { id: 'payment', name: 'Payment', key: 'F5', icon: '↑', use: 'Money paid: expenses, supplier settlements, assets, or drawings.', avoid: 'A transfer between your own cash/bank accounts belongs in Contra. A personal withdrawal belongs in Drawings, not Salary.', debit: 'Expense, supplier, asset or Drawings', credit: 'Cash / Bank', steps: ['Open Vouchers → F5 (Payment).', 'Choose the paying Cash/Bank ledger and the expense, supplier, asset or drawings ledger.', 'For an existing supplier bill, allocate the payment against that bill; do not record purchases again.', 'Check the amount and narration, then save with Ctrl+A.'] },
    { id: 'contra', name: 'Contra', key: 'F4', icon: '↔', use: 'Move business money between Cash and Bank, or between two banks.', avoid: 'Customer receipts, supplier payments and personal drawings are not internal cash/bank transfers.', debit: 'Receiving Cash / Bank', credit: 'Giving Cash / Bank', steps: ['Open Vouchers → F4 (Contra).', 'Select the account receiving the money and the account giving the money.', 'Enter the transfer amount and relevant bank details.', 'Review and save with Ctrl+A. No income or expense is created.'] },
    { id: 'journal', name: 'Journal', key: 'F7', icon: '≡', use: 'Non-cash adjustments: accruals, depreciation, or reclassification.', avoid: 'Use the purpose-built voucher for routine sales, purchases, receipts and payments.', debit: 'Account increased/decreased by the adjustment', credit: 'Corresponding adjustment account', steps: ['Open Vouchers → F7 (Journal).', 'Select the debit ledger and enter its amount.', 'Select the credit ledger and enter an equal amount. Add more lines when the entry is compound.', 'Explain the adjustment in the narration and save with Ctrl+A.'] },
    { id: 'debit-note', name: 'Debit Note', key: 'Alt+F5', icon: 'D−', use: 'Usually a purchase return or a reduction in the supplier payable.', avoid: 'Debit Note is not another name for a cash payment. Here, the supplier is debited because the business owes less.', debit: 'Supplier', credit: 'Purchase Returns', steps: ['Open Vouchers → Alt+F5 (Debit Note), or F10 → Accounting Vouchers → Debit Note.', 'Select the supplier and the original purchase reference where applicable.', 'Enter the returned stock item or purchase-return ledger and the amount.', 'Check that the supplier balance falls, then Ctrl+A to save.'] },
    { id: 'credit-note', name: 'Credit Note', key: 'Alt+F6', icon: 'C−', use: 'Usually a sales return or a reduction in the customer receivable.', avoid: 'Credit Note is not another name for a cash receipt. Here, the customer is credited because they owe less.', debit: 'Sales Returns', credit: 'Customer', steps: ['Open Vouchers → Alt+F6 (Credit Note), or F10 → Accounting Vouchers → Credit Note.', 'Select the customer and the original sales reference where applicable.', 'Enter the returned stock item or sales-return ledger and the amount.', 'Check that the customer balance falls, then Ctrl+A to save.'] }
  ];

  const accountTemplates = [
    ['cash', 'Cash', 'Cash-in-Hand'], ['bank', 'Business Bank', 'Bank Accounts'],
    ['capital', "Owner's Capital", 'Capital Account'], ['purchases', 'Purchases', 'Purchase Accounts'],
    ['purchaseReturns', 'Purchase Returns', 'Purchase Accounts'], ['sales', 'Sales', 'Sales Accounts'],
    ['salesReturns', 'Sales Returns', 'Sales Accounts'], ['customer', 'Riya Services', 'Sundry Debtors'],
    ['supplier', 'Orbit Paper Traders', 'Sundry Creditors'], ['furniture', 'Office Furniture', 'Fixed Assets'],
    ['accumulatedDepreciation', 'Accumulated Depreciation', 'Fixed Assets'], ['rent', 'Office Rent', 'Indirect Expenses'],
    ['salary', 'Office Salaries', 'Indirect Expenses'], ['salaryPayable', 'Salaries Payable', 'Current Liabilities'],
    ['drawings', 'Drawings', 'Capital Account'], ['loan', 'Business Loan', 'Loans (Liability)'],
    ['prepaidInsurance', 'Prepaid Insurance', 'Current Assets'], ['insurance', 'Insurance Expense', 'Indirect Expenses'],
    ['depreciation', 'Depreciation Expense', 'Indirect Expenses'], ['interestIncome', 'Interest Income', 'Indirect Incomes']
  ];
  const variants = [
    ['Aarav Office Supplies', 'Riya Services', 'Orbit Paper Traders'],
    ['Mira Stationery House', 'Neel Consultancy', 'Vertex Paper Co.'],
    ['Summit Paper Mart', 'Kavya Design Studio', 'Northstar Supplies'],
    ['Bright Desk Traders', 'Arjun Associates', 'Metro Paper Distributors']
  ];
  const base = { capital: 200000, cost: 400, price: 650, furniture: 30000, rent: 5000, salary: 6000, accruedSalary: 2000, loan: 50000, drawings: 3000, insurance: 6000, depreciation: 1000, interest: 500, customerReceipt: 20000, supplierPayment: 15000, cashBuffer: 0 };

  function generateCase(randomized = false, rng = Math.random) {
    const pick = (min, max, step = 1) => min + Math.floor(rng() * ((max - min) / step + 1)) * step;
    let values = { ...base };
    if (randomized) {
      const cost = pick(250, 600, 50);
      const price = cost + pick(150, 450, 50);
      const furniture = pick(20000, 40000, 5000);
      values = {
        capital: pick(180000, 300000, 10000), cost, price, furniture,
        rent: pick(4000, 8000, 1000), salary: pick(5000, 8000, 1000), accruedSalary: pick(1000, 3000, 500),
        loan: pick(30000, 70000, 10000), drawings: pick(2000, 6000, 1000),
        insurance: pick(6000, 10800, 1200), depreciation: Math.round(furniture * .02 / 100) * 100,
        interest: pick(300, 900, 100), customerReceipt: Math.floor(55 * price / 2 / 100) * 100,
        supplierPayment: Math.floor(90 * cost / 2 / 500) * 500, cashBuffer: 10000
      };
    }
    const [company, customer, supplier] = variants[randomized ? pick(0, variants.length - 1) : 0];
    const accounts = accountTemplates.map(([id, name, group]) => ({ id, name: id === 'customer' ? customer : id === 'supplier' ? supplier : name, group }));
    const cashPurchase = 50 * values.cost;
    const transfer = cashPurchase + values.cashBuffer;
    const transactions = [];
    function add(day, voucher, debit, credit, amount, title, story, reference, reason, stockDelta = 0) {
      transactions.push({
        id: `TX${String(transactions.length + 1).padStart(2, '0')}`, date: `2026-04-${String(day).padStart(2, '0')}`,
        voucher, debit, credit, amount, title, story, reference, reason, stockDelta
      });
    }
    add(1, 'receipt', 'bank', 'capital', values.capital, 'Start with capital', 'The owner introduces personal funds into the business bank account.', 'CAP-001', 'Bank increases; capital increases. This is investment, not sales income.');
    add(2, 'contra', 'cash', 'bank', transfer, 'Bring cash to the shop', 'Withdraw money from the business bank for office cash and a cash purchase.', 'ATM-002', 'Cash increases and Bank decreases. The funds remain inside the business.');
    add(3, 'payment', 'furniture', 'bank', values.furniture, 'Set up the office', 'Buy office furniture and pay immediately by bank. Record this direct asset payment; no separate supplier invoice has been entered.', 'BANK-003', 'Office Furniture is an asset coming in; Bank decreases. This is not trading-goods Purchases.');
    add(4, 'purchase', 'purchases', 'supplier', 100 * values.cost, 'Buy stock on credit', `Buy 100 A4 paper reams from ${supplier} at ₹${values.cost} per ream, payable later.`, 'PUR-004', 'Debit Purchases under the periodic inventory approach; credit the supplier payable.', 100);
    add(5, 'purchase', 'purchases', 'cash', cashPurchase, 'Top up stock with cash', `Buy another 50 A4 paper reams at ₹${values.cost} each and pay cash immediately.`, 'PUR-005', 'Record the purchase itself in a Purchase voucher, even when it is a cash purchase.', 50);
    add(6, 'sales', 'customer', 'sales', 60 * values.price, 'Make a credit sale', `Sell 60 A4 paper reams to ${customer} at ₹${values.price} each on credit.`, 'INV-006', 'Debit the customer receivable; credit Sales. No cash is received at this point.', -60);
    add(7, 'sales', 'cash', 'sales', 30 * values.price, 'Serve a walk-in customer', `Sell 30 A4 paper reams for cash at ₹${values.price} each.`, 'INV-007', 'Debit Cash and credit Sales. Use Sales rather than Receipt to record a new cash sale.', -30);
    add(8, 'credit-note', 'salesReturns', 'customer', 5 * values.price, 'A customer returns goods', `${customer} returns 5 reams from INV-006, at the original selling price. The goods are resalable.`, 'CN-008 / INV-006', 'Debit Sales Returns and credit the customer. Their receivable falls and the returned stock comes back.', 5);
    add(9, 'debit-note', 'supplier', 'purchaseReturns', 10 * values.cost, 'Return stock to the supplier', `Return 10 reams from PUR-004 to ${supplier} at the original purchase price.`, 'DN-009 / PUR-004', 'Debit the supplier to reduce the payable; credit Purchase Returns to reduce net purchases.', -10);
    add(10, 'receipt', 'bank', 'customer', values.customerReceipt, 'Collect part of an invoice', `${customer} pays part of the remaining INV-006 balance into the business bank account.`, 'REC-010 / INV-006', 'Debit Bank and credit the customer. Allocate against the invoice; do not record Sales again.');
    add(11, 'payment', 'supplier', 'bank', values.supplierPayment, 'Pay part of the supplier bill', `Pay ${supplier} by bank against the remaining PUR-004 balance.`, 'PAY-011 / PUR-004', 'Debit the supplier to reduce the existing payable; credit Bank. Do not record Purchases again.');
    add(12, 'payment', 'rent', 'bank', values.rent, 'Pay this month’s office rent', 'Pay the rent for April from the business bank account.', 'RENT-012', 'Debit the current-period rent expense and credit Bank.');
    add(13, 'payment', 'salary', 'cash', values.salary, 'Pay office salaries', 'Pay part of April office salaries in cash.', 'SAL-013', 'Debit Office Salaries, an expense; credit Cash.');
    add(14, 'receipt', 'bank', 'loan', values.loan, 'Receive a business loan', 'A lender deposits a business loan into the bank account.', 'LOAN-014', 'Debit Bank and credit Business Loan, a liability. Loan proceeds are not income.');
    add(15, 'payment', 'drawings', 'cash', values.drawings, 'An owner’s personal withdrawal', 'The owner takes business cash for personal household spending.', 'DRAW-015', 'Debit Drawings and credit Cash. Personal withdrawals reduce equity rather than operating profit.');
    add(25, 'journal', 'salary', 'salaryPayable', values.accruedSalary, 'Accrue unpaid salaries', 'Recognise the rest of April salaries that employees have earned but have not yet been paid.', 'ADJ-016', 'Debit salary expense and credit Salaries Payable. There is no cash payment in this adjustment.');
    add(28, 'journal', 'depreciation', 'accumulatedDepreciation', values.depreciation, 'Record monthly depreciation', 'Record the given April depreciation on office furniture using an accumulated-depreciation account.', 'ADJ-017', 'Debit Depreciation Expense and credit Accumulated Depreciation, a contra-asset. No cash moves.');
    add(29, 'payment', 'prepaidInsurance', 'bank', values.insurance, 'Pay annual insurance', 'Pay for 12 months of business insurance starting in April. Record the full payment initially as a prepaid asset.', 'INS-018', 'Debit Prepaid Insurance for the future benefit; credit Bank. Expense only the coverage consumed.');
    add(30, 'journal', 'insurance', 'prepaidInsurance', values.insurance / 12, 'Expense one month of insurance', 'Recognise one month of the prepaid annual insurance as April expense.', 'ADJ-019', 'Debit Insurance Expense and credit Prepaid Insurance. This reduces the future benefit without another payment.');
    add(30, 'receipt', 'bank', 'interestIncome', values.interest, 'Receive bank interest', 'Interest earned is credited into the business bank account.', 'INT-020', 'Debit Bank and credit Interest Income. This receipt is income, unlike capital and loan receipts.');
    return { id: `${company.replaceAll(' ', '-').toLowerCase()}-${Date.now()}-${Math.floor(rng() * 1e9)}`, company, customer, supplier, accounts, transactions, values, stockItem: 'Premium A4 paper reams', period: 'April 2026', asOf: '30 April 2026' };
  }

  function calculateBooks(caseData, count = caseData.transactions.length) {
    const balances = Object.fromEntries(caseData.accounts.map(account => [account.id, 0]));
    const transactions = caseData.transactions.slice(0, count);
    transactions.forEach(transaction => {
      balances[transaction.debit] += transaction.amount;
      balances[transaction.credit] -= transaction.amount;
    });
    const stockUnits = transactions.reduce((total, transaction) => total + transaction.stockDelta, 0);
    const closingStock = stockUnits * caseData.values.cost;
    const netPurchases = balances.purchases + balances.purchaseReturns;
    const netSales = 0 - balances.sales - balances.salesReturns;
    const costOfGoodsSold = netPurchases - closingStock;
    const grossProfit = netSales - costOfGoodsSold;
    const expenses = balances.rent + balances.salary + balances.depreciation + balances.insurance;
    const otherIncome = 0 - balances.interestIncome;
    const profit = grossProfit - expenses + otherIncome;
    const assets = balances.cash + balances.bank + balances.customer + balances.furniture + balances.accumulatedDepreciation + balances.prepaidInsurance + closingStock;
    const liabilities = 0 - balances.supplier - balances.loan - balances.salaryPayable;
    const equity = 0 - balances.capital - balances.drawings + profit;
    const trialDebit = Object.values(balances).reduce((total, value) => total + Math.max(value, 0), 0);
    const trialCredit = Object.values(balances).reduce((total, value) => total + Math.max(-value, 0), 0);
    return { balances, stockUnits, closingStock, netPurchases, netSales, costOfGoodsSold, grossProfit, expenses, otherIncome, profit, assets, liabilities, equity, trialDebit, trialCredit };
  }

  function classificationItems(caseData) {
    const { balances: b, closingStock, profit, netSales } = calculateBooks(caseData);
    return [
      { id: 'bank', name: 'Business Bank', amount: b.bank, group: 'current-asset', why: 'A positive bank balance is a current asset. Tally group: Bank Accounts.' },
      { id: 'cash', name: 'Cash in hand', amount: b.cash, group: 'current-asset', why: 'Physical cash is a current asset. Tally group: Cash-in-Hand.' },
      { id: 'customer', name: `Receivable · ${caseData.customer}`, amount: b.customer, group: 'current-asset', why: 'Money still owed by a customer is a current asset. Tally group: Sundry Debtors.' },
      { id: 'stock', name: 'Closing inventory', amount: closingStock, group: 'current-asset', why: 'Unsold goods are inventory, a current asset. Their cost becomes an expense when sold.' },
      { id: 'furniture', name: 'Furniture, net of depreciation', amount: b.furniture + b.accumulatedDepreciation, group: 'fixed-asset', why: 'Furniture used in the business is a fixed asset. Accumulated depreciation reduces its carrying value.' },
      { id: 'prepaidInsurance', name: 'Prepaid insurance', amount: b.prepaidInsurance, group: 'current-asset', why: 'Unconsumed insurance is a future benefit, so it remains an asset rather than April expense.' },
      { id: 'supplier', name: `Payable · ${caseData.supplier}`, amount: -b.supplier, group: 'liability', why: 'The unpaid supplier balance is an obligation. Tally group: Sundry Creditors.' },
      { id: 'loan', name: 'Business loan', amount: -b.loan, group: 'liability', why: 'Loan principal is repayable and is a liability. It is not sales income.' },
      { id: 'salaryPayable', name: 'Salaries payable', amount: -b.salaryPayable, group: 'liability', why: 'Salary already incurred but unpaid creates a current liability.' },
      { id: 'capital', name: "Owner's capital", amount: -b.capital, group: 'equity', why: "The owner's investment is equity. Tally group: Capital Account." },
      { id: 'drawings', name: 'Drawings · deduct from capital', amount: -b.drawings, group: 'equity', why: 'Personal drawings reduce equity. They are not a business expense in the profit and loss account.' },
      { id: 'profit', name: profit >= 0 ? 'Current-period profit' : 'Current-period loss', amount: profit, group: 'equity', why: 'Profit increases equity; a loss reduces it. Income and expenses reach the balance sheet through this net result.' },
      { id: 'sales-pnl', name: 'Net sales income', amount: netSales, group: 'profit-loss', why: 'Sales are income in Profit & Loss. Do not add sales directly to the balance sheet after profit has already been included.' },
      { id: 'rent-pnl', name: 'April office rent expense', amount: b.rent, group: 'profit-loss', why: 'Rent consumed in April is an expense in Profit & Loss. Its unpaid portion, if any, would be a separate liability.' },
      { id: 'salary-pnl', name: 'April salary expense', amount: b.salary, group: 'profit-loss', why: 'Salary expense includes paid and accrued salary. Salary payable is a separate balance-sheet liability.' }
    ];
  }

  const classificationGroups = [
    ['current-asset', 'Current asset'], ['fixed-asset', 'Fixed asset'], ['liability', 'Liability'],
    ['equity', 'Capital / equity'], ['profit-loss', 'Profit & Loss']
  ];
  return { vouchers, generateCase, calculateBooks, classificationItems, classificationGroups };
});
