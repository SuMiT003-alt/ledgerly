const ruleData = {
  personal: {
    pill: 'PERSONAL ACCOUNT', count: '01 / 03', emblem: 'P',
    title: 'Debit the receiver.<br><em>Credit the giver.</em>',
    description: 'If a person or organisation receives value, debit them. If they give value, credit them.',
    example: 'Paid Riya ₹5,000 against her outstanding balance', answer: 'Riya A/c', side: 'Dr'
  },
  real: {
    pill: 'REAL ACCOUNT', count: '02 / 03', emblem: 'R',
    title: 'Debit what comes in.<br><em>Credit what goes out.</em>',
    description: 'Real accounts represent assets. Debit the asset entering the business and credit the asset leaving it.',
    example: 'Bought a laptop for cash ₹40,000', answer: 'Laptop A/c', side: 'Dr'
  },
  nominal: {
    pill: 'NOMINAL ACCOUNT', count: '03 / 03', emblem: 'N',
    title: 'Debit all expenses.<br><em>Credit all income.</em>',
    description: 'Nominal accounts measure performance. Expenses and losses are debited; incomes and gains are credited.',
    example: 'Received commission income ₹2,000', answer: 'Commission A/c', side: 'Cr'
  }
};

const transactionData = {
  capital: {
    title: 'Capital introduced in cash',
    logic: 'Cash comes into the business, so Cash A/c is debited. Capital is the source, so it is credited.',
    type: 'Receipt transaction · 2 accounts',
    voucher: 'Receipt voucher · F6',
    voucherDescription: 'Cash introduced by the owner is a receipt. Debit Cash and credit Capital.',
    rows: [['Cash A/c', '1', '50,000', ''], ['To Capital A/c', '', '', '50,000'], ['', '', '', '']],
    narration: 'Being cash introduced as capital.'
  },
  rent: {
    title: 'Office rent paid in cash',
    logic: 'Rent is an expense, so debit it. Cash goes out of the business, so credit Cash A/c.',
    type: 'Payment transaction · 2 accounts',
    voucher: 'Payment voucher · F5',
    voucherDescription: 'Rent paid in cash is a payment. Debit Rent and credit Cash.',
    rows: [['Rent A/c', '2', '8,000', ''], ['To Cash A/c', '', '', '8,000'], ['', '', '', '']],
    narration: 'Being office rent paid in cash.'
  },
  sales: {
    title: 'Goods sold for cash',
    logic: 'Cash comes in, so debit Cash A/c. Sales is income, so credit Sales A/c.',
    type: 'Sales transaction · 2 accounts',
    voucher: 'Sales voucher · F8',
    voucherDescription: 'Use a Sales voucher for goods sold, including cash sales. Select Cash as the party account; a Receipt voucher records collection against an existing invoice.',
    rows: [['Cash A/c', '3', '12,000', ''], ['To Sales A/c', '', '', '12,000'], ['', '', '', '']],
    narration: 'Being goods sold for cash.'
  },
  creditPurchase: {
    title: 'Goods bought on credit',
    logic: 'Purchases are debited as the cost of goods bought for resale. Karan supplies the goods on credit, so credit his personal account.',
    type: 'Purchase transaction · 2 accounts',
    voucher: 'Purchase voucher · F9',
    voucherDescription: 'Use a Purchase voucher for goods bought on credit. Select Karan as the supplier and Purchases as the purchase ledger.',
    rows: [['Purchases A/c', '4', '15,000', ''], ['To Karan A/c', '', '', '15,000'], ['', '', '', '']],
    narration: 'Being goods purchased from Karan on credit.'
  },
  drawings: {
    title: 'Cash withdrawn for personal use',
    logic: 'Drawings reduce the owner’s capital, so debit Drawings A/c. Cash leaves the business, so credit Cash A/c.',
    type: 'Payment transaction · 2 accounts',
    voucher: 'Payment voucher · F5',
    voucherDescription: 'Cash withdrawn by the owner is a payment. Debit Drawings and credit Cash.',
    rows: [['Drawings A/c', '5', '3,000', ''], ['To Cash A/c', '', '', '3,000'], ['', '', '', '']],
    narration: 'Being cash withdrawn for personal use.'
  }
};

const ledgerData = {
  cash: {
    title: 'Cash A/c', balance: '₹ 39,000 Dr', footer: '3 transactions · asset account',
    rows: [['01 Apr', 'To Capital A/c', 'Receipt', '50,000', '—', '50,000 Dr'], ['04 Apr', 'By Rent A/c', 'Payment', '—', '8,000', '42,000 Dr'], ['06 Apr', 'By Drawings A/c', 'Payment', '—', '3,000', '39,000 Dr']],
  },
  capital: {
    title: 'Capital A/c', balance: '₹ 50,000 Cr', footer: '1 transaction · equity account',
    rows: [['01 Apr', 'By Cash A/c', 'Receipt', '—', '50,000', '50,000 Cr']],
  },
  rent: {
    title: 'Rent A/c', balance: '₹ 8,000 Dr', footer: '1 transaction · expense account',
    rows: [['04 Apr', 'To Cash A/c', 'Payment', '8,000', '—', '8,000 Dr']],
  }
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Keep the page usable when storage is disabled. */ }
}

const learningModules = [
  { id: 'overview', label: 'Start here', goal: 'Choose a topic or follow the guided route.', milestones: [] },
  { id: 'rules', label: 'Golden rules', goal: 'Understand why an account is debited or credited, then try the mini-lab.', milestones: ['rules', 'lab'] },
  { id: 'journal', label: 'Journal entries', goal: 'Read a transaction, choose the two accounts, and build a balanced entry.', milestones: ['journal', 'builder'] },
  { id: 'ledgers', label: 'Ledgers', goal: 'See how journal postings build each account’s running balance.', milestones: ['ledgers'] },
  { id: 'trial-balance', label: 'Trial balance', goal: 'Bring every ledger balance together and confirm that total debits equal total credits.', milestones: ['trial-balance'] },
  { id: 'profit-loss', label: 'Profit & Loss', goal: 'Separate trading result, operating expenses and other income to find the period profit or loss.', milestones: ['profit-loss'] },
  { id: 'balance-sheet', label: 'Balance sheet', goal: 'Trace balances back to transactions and classify assets, liabilities, and equity.', milestones: ['balance-sheet'] },
  { id: 'tally', label: 'Tally Prime', goal: 'Choose the right voucher, practise its shortcut, and post a business case.', milestones: ['tally'] },
  { id: 'gst-learning', label: 'GST essentials', goal: 'Follow the connected GST lifecycle from registration through reconciliation, return preparation, payment and filing.', milestones: ['gst-learning'] },
  { id: 'practice', label: 'Practice', goal: 'Check your understanding with 10 random questions and a personal answer review.', milestones: ['quiz'] }
];
let activeModule = 'overview';

const milestones = [
  { id: 'rules', label: 'Explore all three rules', hint: 'Explore the three golden rules.' },
  { id: 'lab', label: 'Complete the debit/credit lab', hint: 'Try the debit/credit mini-lab.' },
  { id: 'journal', label: 'Explore a journal example', hint: 'Choose a journal transaction.' },
  { id: 'builder', label: 'Build a correct entry', hint: 'Build and check your own entry.' },
  { id: 'ledgers', label: 'Explore the three ledgers', hint: 'Follow Cash, Capital, and Rent.' },
  { id: 'trial-balance', label: 'Check a trial balance', hint: 'Confirm total debits equal total credits.' },
  { id: 'profit-loss', label: 'Read a Profit & Loss statement', hint: 'Find gross profit, expenses and net result.' },
  { id: 'balance-sheet', label: 'Classify a balance sheet', hint: 'Place all 15 statement accounts.' },
  { id: 'tally', label: 'Post a complete Tally case', hint: 'Post the 20 Tally case documents.' },
  { id: 'gst-learning', label: 'Explore the GST lifecycle', hint: 'Follow the GST essentials route.' },
  { id: 'quiz', label: 'Finish a practice session', hint: 'Finish a 10-question session.' }
];

let savedProgress = {};
try { savedProgress = JSON.parse(readStorage('ledgerly-progress')) || {}; } catch {}
const completed = new Set(Array.isArray(savedProgress.completed)
  ? savedProgress.completed.filter(id => milestones.some(milestone => milestone.id === id)) : []);
const viewedRules = new Set(Array.isArray(savedProgress.viewedRules)
  ? savedProgress.viewedRules.filter(id => Object.hasOwn(ruleData, id)) : []);
const viewedLedgers = new Set(Array.isArray(savedProgress.viewedLedgers)
  ? savedProgress.viewedLedgers.filter(id => Object.hasOwn(ledgerData, id)) : []);

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const today = dateKey(new Date());
const yesterdayDate = new Date();
yesterdayDate.setDate(yesterdayDate.getDate() - 1);
const previousStreak = Number.isInteger(savedProgress.streak) && savedProgress.streak > 0 ? savedProgress.streak : 0;
const streak = savedProgress.lastVisit === today ? Math.max(previousStreak, 1)
  : savedProgress.lastVisit === dateKey(yesterdayDate) ? previousStreak + 1 : 1;
$('#streakCount').textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;

function saveProgress() {
  writeStorage('ledgerly-progress', JSON.stringify({
    completed: [...completed], viewedRules: [...viewedRules], viewedLedgers: [...viewedLedgers],
    streak, lastVisit: today
  }));
}

function renderProgress() {
  $('#progressText').textContent = `${completed.size} / ${milestones.length}`;
  $('#progressBar').style.width = `${completed.size / milestones.length * 100}%`;
  $('#progressHint').textContent = milestones.find(milestone => !completed.has(milestone.id))?.hint || 'Path complete. Keep practising!';
  $('#progressMilestones').innerHTML = milestones.map(milestone =>
    `<li class="${completed.has(milestone.id) ? 'complete' : ''}"><span aria-hidden="true">${completed.has(milestone.id) ? '✓' : '○'}</span><a href="#${({ lab: 'miniLab', builder: 'entryBuilder', quiz: 'practice' })[milestone.id] || milestone.id}">${milestone.label}${completed.has(milestone.id) ? ' — done' : ''}<span aria-hidden="true"> ↗</span></a></li>`
  ).join('');
  renderLearningRoute();
  renderLearningDashboard();
}

function dashboardEscape(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

let livePracticeSnapshot = null;
function readPracticeSnapshot() {
  if (livePracticeSnapshot) return livePracticeSnapshot;
  try {
    const stored = JSON.parse(readStorage('ledgerly-practice-v1')) || {};
    return {
      history: Array.isArray(stored.history) ? stored.history.filter(record => record && Number.isInteger(record.score)) : [],
      mistakes: Array.isArray(stored.mistakes) ? stored.mistakes.filter(record => record && typeof record.question === 'string') : [],
      bestScore: Number.isInteger(stored.bestScore) ? stored.bestScore : null,
      sessionCount: Number.isInteger(stored.sessionCount) ? stored.sessionCount : 0,
      topicStats: stored.topicStats || {}
    };
  } catch {
    return { history: [], mistakes: [], bestScore: null, sessionCount: 0, topicStats: {} };
  }
}

function renderLearningDashboard() {
  if (!$('#dashboardProgress')) return;
  const practice = readPracticeSnapshot();
  const percent = Math.round(completed.size / milestones.length * 100);
  $('#dashboardProgress').textContent = `${percent}%`;
  $('#dashboardProgressDetail').textContent = `${completed.size} of ${milestones.length} milestones complete`;
  $('#dashboardProgressBar').style.width = `${percent}%`;
  $('#dashboardSessions').textContent = practice.sessionCount;
  $('#dashboardSessionDetail').textContent = practice.history.length ? `Last score ${practice.history[0].score} / 10` : 'No sessions yet';
  $('#dashboardBest').textContent = practice.bestScore ?? '—';
  $('#dashboardStreak').textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;
  $('#dashboardMistakeCount').textContent = `${practice.mistakes.length} saved`;

  const labels = { 'golden-rules': 'Golden rules', 'debit-credit': 'Debit & credit', 'journal-entries': 'Journal entries', ledgers: 'Ledgers & balances', 'tally-prime': 'Tally Prime', fundamentals: 'Accounting basics' };
  const links = { 'golden-rules': 'rules', 'debit-credit': 'miniLab', 'journal-entries': 'journal', ledgers: 'ledgers', 'tally-prime': 'tally', fundamentals: 'rules' };
  const topicRows = Object.entries(practice.topicStats || {}).filter(([topic, stats]) => labels[topic] && stats?.total > 0 && Number.isFinite(stats.correct))
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
  const answered = topicRows.reduce((total, [, stats]) => total + stats.total, 0);
  $('#dashboardTopicSummary').textContent = answered ? `${answered} answers analysed` : 'Complete a session to see this';
  $('#dashboardTopicList').innerHTML = topicRows.length ? topicRows.map(([topic, stats]) => {
    const average = Math.round(stats.correct / stats.total * 100);
    return `<div class="dashboard-topic-row"><div><a href="#${links[topic]}"><strong>${labels[topic]}</strong></a><small>${stats.correct} / ${stats.total} correct</small></div><div class="dashboard-topic-meter"><i style="width:${average}%"></i></div><b>${average}%</b></div>`;
  }).join('') : '<div class="dashboard-empty">Your topic scores will appear after your first practice session.</div>';
  const weakest = topicRows.find(([, stats]) => stats.correct / stats.total < .8);
  const nextLesson = learningModules.slice(1).find(lesson => lesson.milestones.some(id => !completed.has(id)));
  const next = weakest ? { href: links[weakest[0]], title: `Refresh ${labels[weakest[0]]}`, detail: `${Math.round(weakest[1].correct / weakest[1].total * 100)}% accuracy — review the lesson, then retry your mistakes.` }
    : nextLesson ? { href: nextLesson.id, title: `Next up: ${nextLesson.label}`, detail: nextLesson.goal }
      : { href: 'practice', title: 'Keep your confidence growing', detail: 'Your roadmap is complete. Try another mixed practice session.' };
  $('#dashboardRecommendation').innerHTML = `<div><span class="section-kicker">RECOMMENDED NEXT</span><strong>${dashboardEscape(next.title)}</strong><p>${dashboardEscape(next.detail)}</p></div><a class="button button-primary" href="#${next.href}">Continue <span>→</span></a>`;
  $('#dashboardMistakes').innerHTML = practice.mistakes.length ? practice.mistakes.slice(0, 4).map(mistake => `<article class="dashboard-mistake"><div><span>${dashboardEscape(mistake.topicLabel || 'Practice')}</span><strong>${dashboardEscape(mistake.question)}</strong></div><small>Your previous answer: ${dashboardEscape(mistake.selected || 'Review this question')}</small></article>`).join('') : '<div class="dashboard-empty">All clear. Missed questions will be saved here for another try.</div>';
}

window.addEventListener('ledgerly-practice-updated', event => { livePracticeSnapshot = event.detail; renderLearningDashboard(); });

function renderLearningRoute() {
  const lessons = learningModules.slice(1);
  const recommended = lessons.find(lesson => lesson.milestones.some(id => !completed.has(id))) || lessons[lessons.length - 1];
  $('#routeProgress').textContent = `${completed.size} / ${milestones.length}`;
  $('#routeProgressHint').textContent = completed.size === milestones.length ? 'Route complete. Keep practising!' : `Next up: ${recommended.label}`;
  $$('.route-card').forEach(card => {
    const lesson = lessons.find(item => item.id === card.dataset.routeSection);
    const count = lesson.milestones.filter(id => completed.has(id)).length;
    const done = count === lesson.milestones.length;
    card.classList.toggle('complete', done);
    card.classList.toggle('current', !done && lesson.id === recommended.id);
    $('.route-card-status', card).textContent = done ? 'Completed ✓' : count > 0 ? 'In progress' : lesson.id === recommended.id ? 'Recommended next' : 'Explore';
    card.setAttribute('aria-label', `${lesson.label}: ${$('.route-card-status', card).textContent}`);
    const tab = $(`.learning-tab[data-section="${lesson.id}"]`);
    tab.classList.toggle('complete', done);
    $('.tab-step', tab).textContent = done ? '✓' : String(learningModules.indexOf(lesson)).padStart(2, '0');
  });
  const savedId = readStorage('ledgerly-last-module');
  const resume = lessons.find(lesson => lesson.id === savedId) || recommended;
  $('#continueLearning').href = `#${resume.id}`;
  $('#continueLearning').innerHTML = `${savedId ? 'Continue' : 'Start'}: ${resume.label} <span>↗</span>`;
}

function completeMilestone(id) {
  if (completed.has(id)) return;
  completed.add(id);
  saveProgress();
  renderProgress();
  showToast(`${milestones.find(milestone => milestone.id === id).label} — complete!`);
}

function trackRule(key) {
  viewedRules.add(key);
  saveProgress();
  if (viewedRules.size === 3) completeMilestone('rules');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function renderRule(key) {
  const data = ruleData[key];
  $('#rulePill').textContent = data.pill;
  $('#ruleCount').textContent = data.count;
  $('#ruleEmblem').textContent = data.emblem;
  $('#ruleTitle').innerHTML = data.title;
  $('#ruleDescription').textContent = data.description;
  $('#ruleExample strong').textContent = data.example;
  $('#ruleExample .example-answer span').textContent = data.answer;
  $('#ruleExample .example-answer b').textContent = data.side;
  $('#ruleDetail').setAttribute('aria-labelledby', `tab-${key}`);
  $$('.rule-tab').forEach(tab => {
    const isActive = tab.dataset.rule === key;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
}

$$('.rule-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    renderRule(tab.dataset.rule);
    trackRule(tab.dataset.rule);
  });
  tab.addEventListener('keydown', event => {
    const tabs = $$('.rule-tab');
    const index = tabs.indexOf(tab);
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    tabs[nextIndex].click();
    tabs[nextIndex].focus();
  });
});
$('#ruleNext').addEventListener('click', () => {
  const keys = Object.keys(ruleData);
  const current = $('.rule-tab.active').dataset.rule;
  const next = keys[(keys.indexOf(current) + 1) % keys.length];
  renderRule(next);
  trackRule(next);
});

function renderJournal(key) {
  const data = transactionData[key];
  $('#journalEntryTitle').textContent = data.title;
  $('#logicSummary').textContent = data.logic;
  $('#entryType').textContent = data.type;
  $('#tallyVoucher').textContent = data.voucher;
  $('#tallyVoucherDescription').textContent = data.voucherDescription;
  const rows = data.rows.map((row, index) => {
    if (index === 2) return `<tr class="narration"><td colspan="4">${data.narration}</td></tr>`;
    return `<tr><td class="${index === 1 ? 'indent' : ''}">${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`;
  }).join('');
  $('#journalBody').innerHTML = rows;
}

$('#transactionSelect').addEventListener('change', event => {
  renderJournal(event.target.value);
  resetBuilder();
  completeMilestone('journal');
});

const builderAccounts = ['Capital A/c', 'Cash A/c', 'Drawings A/c', 'Karan A/c', 'Purchases A/c', 'Rent A/c', 'Sales A/c'];
const builderFields = ['#builderDebit', '#builderDebitAmount', '#builderCredit', '#builderCreditAmount'];

function resetBuilder() {
  $('#entryBuilder').reset();
  $('#entryBuilder').classList.remove('error', 'success');
  $('#builderStatus').textContent = 'Awaiting your entry';
  $('#builderFeedback').textContent = 'Use the transaction above. Matching totals are only half the story — the accounts matter too.';
}

['#builderDebit', '#builderCredit'].forEach(selector => {
  $(selector).innerHTML = '<option value="">Choose an account</option>' + builderAccounts.map(account => `<option>${account}</option>`).join('');
});

function builderAmounts() {
  // Work in paise, avoiding floating-point rounding when comparing amounts.
  return [Math.round(Number($('#builderDebitAmount').value) * 100), Math.round(Number($('#builderCreditAmount').value) * 100)];
}

builderFields.forEach(selector => $(selector).addEventListener('input', () => {
  $('#entryBuilder').classList.remove('error', 'success');
  const [debit, credit] = builderAmounts();
  $('#builderStatus').textContent = debit > 0 && credit > 0
    ? debit === credit ? 'Amounts balanced' : 'Amounts do not balance' : 'Awaiting your entry';
  $('#builderFeedback').textContent = 'Ready? Check your amounts and which accounts belong on each side.';
}));

$('#entryBuilder').addEventListener('submit', event => {
  event.preventDefault();
  const data = transactionData[$('#transactionSelect').value];
  const [debit, credit] = builderAmounts();
  const expectedAmount = Number(data.rows[0][2].replaceAll(',', '')) * 100;
  const expectedDebit = data.rows[0][0];
  const expectedCredit = data.rows[1][0].replace(/^To /, '');
  let message;
  let correct = false;
  if (debit !== credit) {
    message = 'The debit and credit totals differ. Every entry needs equal amounts on both sides.';
  } else if ($('#builderDebit').value !== expectedDebit || $('#builderCredit').value !== expectedCredit) {
    message = `The amounts balance, but check the accounts: debit ${expectedDebit} and credit ${expectedCredit}. ${data.logic}`;
  } else if (debit !== expectedAmount) {
    message = `The accounts are right. Match the transaction amount: ₹${data.rows[0][2]} on each side.`;
  } else {
    correct = true;
    message = `Correct! ${expectedDebit} Dr ₹${data.rows[0][2]} / ${expectedCredit} Cr ₹${data.rows[0][2]}. ${data.logic}`;
  }
  $('#entryBuilder').classList.toggle('success', correct);
  $('#entryBuilder').classList.toggle('error', !correct);
  $('#builderStatus').textContent = correct ? 'Correct & balanced ✓' : 'Try again';
  $('#builderFeedback').textContent = message;
  if (correct) {
    completeMilestone('journal');
    completeMilestone('builder');
  }
});

function renderLedger(key) {
  const data = ledgerData[key];
  $('#ledgerTitle').textContent = data.title;
  $('#ledgerBalance').textContent = data.balance;
  $('#ledgerFooterText').textContent = data.footer;
  $('#ledgerBody').innerHTML = data.rows.map(row => `<tr>${row.map((cell, index) => `<td class="${index === 5 ? 'balance-cell' : ''}">${cell}</td>`).join('')}</tr>`).join('');
  $$('.account-item').forEach(item => {
    const active = item.dataset.account === key;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
}

$$('.account-item').forEach(item => item.addEventListener('click', () => {
  renderLedger(item.dataset.account);
  viewedLedgers.add(item.dataset.account);
  saveProgress();
  if (viewedLedgers.size === 3) completeMilestone('ledgers');
}));

const labQuestions = [
  { prompt: 'Cash is received from a customer. Where does Cash A/c go?', side: 'Dr', reason: 'Cash comes in. For a real account, debit what comes in.' },
  { prompt: 'You pay monthly office rent. Where does Rent A/c go?', side: 'Dr', reason: 'Rent is an expense. For a nominal account, debit all expenses and losses.' },
  { prompt: 'You buy goods on credit from Riya. Where does Riya A/c go?', side: 'Cr', reason: 'Riya gives goods to the business. For a personal account, credit the giver.' },
  { prompt: 'The bank credits interest income to your account. Where does Interest Income A/c go?', side: 'Cr', reason: 'Interest earned is income. For a nominal account, credit all incomes and gains.' }
];
let labIndex = 0;
let labScore = 0;
let labSelection = null;
let labAnswered = false;
let labComplete = false;

function renderLab() {
  const question = labQuestions[labIndex];
  $('#labPrompt').textContent = question.prompt;
  $('#labProgressText').textContent = `${labIndex + 1} / ${labQuestions.length}`;
  $('#labProgressBar').style.width = `${(labIndex + 1) / labQuestions.length * 100}%`;
  $('#labOptions').innerHTML = ['Dr', 'Cr'].map(side => `<button class="lab-option" type="button" data-side="${side}" aria-pressed="false"><span>${side === 'Dr' ? 'LEFT SIDE' : 'RIGHT SIDE'}</span><strong>${side === 'Dr' ? 'Debit' : 'Credit'}</strong></button>`).join('');
  $('#labFeedback').textContent = '';
  $('#labFeedback').classList.remove('error');
  $('#labNext').innerHTML = 'Check answer <span>→</span>';
  $('#labNext').disabled = true;
  labSelection = null;
  labAnswered = false;
  $$('.lab-option').forEach(option => option.addEventListener('click', () => {
    labSelection = option.dataset.side;
    $$('.lab-option').forEach(button => {
      const selected = button === option;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('#labNext').disabled = false;
  }));
}

$('#labNext').addEventListener('click', () => {
  if (labComplete) {
    labIndex = 0;
    labScore = 0;
    labComplete = false;
    renderLab();
    return;
  }
  const question = labQuestions[labIndex];
  if (!labAnswered) {
    if (!labSelection) return;
    labAnswered = true;
    const correct = labSelection === question.side;
    if (correct) labScore += 1;
    $$('.lab-option').forEach(option => {
      option.disabled = true;
      option.classList.toggle('correct', option.dataset.side === question.side);
      option.classList.toggle('incorrect', option.dataset.side === labSelection && !correct);
    });
    $('#labFeedback').textContent = `${correct ? 'Correct!' : 'Not quite.'} ${question.reason}`;
    $('#labFeedback').classList.toggle('error', !correct);
    $('#labNext').innerHTML = labIndex < labQuestions.length - 1 ? 'Next scenario <span>→</span>' : 'See my result <span>✓</span>';
  } else if (labIndex < labQuestions.length - 1) {
    labIndex += 1;
    renderLab();
  } else {
    labComplete = true;
    $('#labPrompt').textContent = `You scored ${labScore} / ${labQuestions.length}. ${labScore === labQuestions.length ? 'You’ve got the sides sorted!' : 'Keep practising — each explanation makes the rules stick.'}`;
    $('#labOptions').innerHTML = '<div class="lab-result">Debit = left · Credit = right</div>';
    $('#labFeedback').textContent = 'Debit and credit describe sides of an entry. Whether they increase or decrease an account depends on the account type.';
    $('#labFeedback').classList.remove('error');
    $('#labNext').innerHTML = 'Practise again <span>↻</span>';
    completeMilestone('lab');
  }
});

function resolveLearningTarget(id) {
  const target = document.getElementById(id);
  const screen = target?.closest('[data-screen]');
  return screen ? { target, screen, module: learningModules.find(item => item.id === screen.dataset.screen) } : null;
}

function navigateLearning(id, { updateHistory = true, focusContent = true, scroll = true } = {}) {
  const resolved = resolveLearningTarget(id) || resolveLearningTarget('overview');
  const { target, screen, module } = resolved;
  activeModule = module.id;
  $$('[data-screen]').forEach(panel => { panel.hidden = panel !== screen; });
  $('#deskTools').open = false;
  setSearchOpen(false);
  const index = learningModules.indexOf(module);
  const home = index === 0;
  $('#currentModuleLabel').textContent = module.label;
  $('#moduleOrientation').hidden = home;
  $('#moduleNavigation').hidden = home;
   $('#moduleStep').textContent = `STEP ${String(index).padStart(2, '0')} OF ${String(learningModules.length - 1).padStart(2, '0')} / ${module.label.toUpperCase()}`;
  $('#modulePurpose').textContent = module.goal;
   $('#modulePosition').textContent = `${index} / ${learningModules.length - 1}`;
  const previous = learningModules[Math.max(0, index - 1)];
  const next = learningModules[index + 1] || learningModules[0];
  $('#previousModule').href = `#${previous.id}`;
  $('#previousModuleLabel').textContent = previous.label;
  $('#nextModule').href = `#${next.id}`;
  $('#nextModuleLabel').textContent = next.label;
  $('#nextModule small').textContent = index === learningModules.length - 1 ? 'BACK TO YOUR ROADMAP' : 'NEXT STEP';
  $$('.learning-tab').forEach(tab => {
    const selected = tab.dataset.section === module.id;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  if (!home) {
    writeStorage('ledgerly-last-module', module.id);
    if (module.id === 'rules') trackRule($('.rule-tab.active').dataset.rule);
    if (module.id === 'gst-learning') completeMilestone('gst-learning');
    if (module.id === 'trial-balance') completeMilestone('trial-balance');
    if (module.id === 'profit-loss') completeMilestone('profit-loss');
   if (module.id === 'ledgers') {
      viewedLedgers.add($('.account-item.active').dataset.account);
      saveProgress();
      if (viewedLedgers.size === 3) completeMilestone('ledgers');
    }
  }
  renderLearningRoute();
  document.title = `${module.label} — Ledgerly`;
  const hash = `#${target.id}`;
  if (updateHistory && window.location.hash !== hash) history.pushState(null, '', hash);
  const topTab = $(`.learning-tab[data-section="${module.id}"]`);
  const tabTrack = $('.learning-tabs-inner');
  const tabRect = topTab.getBoundingClientRect();
  const trackRect = tabTrack.getBoundingClientRect();
  if (tabRect.left < trackRect.left || tabRect.right > trackRect.right) {
    tabTrack.scrollTo({ left: topTab.offsetLeft - tabTrack.offsetLeft - (tabTrack.clientWidth - topTab.offsetWidth) / 2, behavior: 'smooth' });
  }
  if (scroll) {
    const primarySection = target.id === module.id;
    if (primarySection) window.scrollTo({ top: 0, behavior: 'instant' });
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (focusContent) {
    const heading = target.querySelector('h1, h2') || screen.querySelector('h1, h2');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
   const id = link.getAttribute('href').slice(1);
   if (!resolveLearningTarget(id)) return;
   event.preventDefault();
   if (document.body.dataset.workspace && document.body.dataset.workspace !== 'learn') window.showLedgerlyWorkspace?.('learn');
   navigateLearning(id, { focusContent: !link.classList.contains('learning-tab') });
});
$$('.learning-tab').forEach((tab, index, tabs) => {
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    navigateLearning(tabs[next].dataset.section, { focusContent: false });
    tabs[next].focus({ preventScroll: true });
  });
});
const restoreLearningRoute = () => navigateLearning(window.location.hash.slice(1) || 'overview', { updateHistory: false, focusContent: false });
window.addEventListener('hashchange', restoreLearningRoute);
window.addEventListener('popstate', restoreLearningRoute);
const sizeHeader = () => document.documentElement.style.setProperty('--workspace-header-height', `${$('#workspaceHeader').offsetHeight}px`);
new ResizeObserver(sizeHeader).observe($('#workspaceHeader'));
document.addEventListener('click', event => {
  if (!$('#deskTools').contains(event.target)) $('#deskTools').open = false;
  if (!$('#themePicker').contains(event.target)) $('#themePicker').open = false;
  if (!$('#modePicker').contains(event.target)) $('#modePicker').open = false;
});

function printPocketGuide() { $('#deskTools').open = false; window.print(); }
$('#printCardBtn').addEventListener('click', printPocketGuide);
$('#printReferenceBtn').addEventListener('click', printPocketGuide);
function setFocusMode(on) {
  $('#deskTools').open = false;
  document.body.classList.toggle('focus-mode', on);
  $('#focusBtn').setAttribute('aria-pressed', String(on));
  showToast(on ? 'Focus mode on' : 'Focus mode off');
}
$('#focusBtn').addEventListener('click', () => setFocusMode(!document.body.classList.contains('focus-mode')));
$('#focusExit').addEventListener('click', () => setFocusMode(false));

function setSearchOpen(open) {
  $('.topbar').classList.toggle('search-open', open);
  $('#mobileSearchButton').setAttribute('aria-expanded', String(open));
  sizeHeader();
}
$('#mobileSearchButton').addEventListener('click', () => {
  const open = !$('.topbar').classList.contains('search-open');
  setSearchOpen(open);
  if (open) $('#searchInput').focus();
});

$('#searchInput').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    const term = event.target.value.trim().toLowerCase();
    if (!term) return;
    if (typeof window.LedgerlyWorkSearch === 'function') {
      const workMatches = window.LedgerlyWorkSearch(term);
      if (workMatches > 0) {
        window.showLedgerlyWorkspace?.('work');
        showToast(`${workMatches} Work record${workMatches === 1 ? '' : 's'} found for “${event.target.value.trim()}”.`);
        return;
      }
    }
    const match = $$('.learning-screen > section[id]').filter(section => section.closest('[data-screen]').dataset.screen !== 'overview')
      .find(section => section.textContent.toLowerCase().includes(term));
    if (match) {
      navigateLearning(match.id);
      showToast(`Opened ${learningModules.find(module => module.id === activeModule).label} for “${event.target.value.trim()}”.`);
    } else {
      showToast('No lesson found — try “cash”, “ledger”, or “nominal”.');
    }
  }
});
window.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    setSearchOpen(true);
    $('#searchInput').focus();
  }
  if (event.key === 'Escape') {
    if ($('#themePicker').open) {
      $('#themePicker').open = false;
      $('#themeToggle').focus();
    } else if ($('#modePicker').open) {
      $('#modePicker').open = false;
      $('#modeToggle').focus();
    } else if ($('#deskTools').open) {
      $('#deskTools').open = false;
      $('#deskTools summary').focus();
    } else if ($('.topbar').classList.contains('search-open')) {
      setSearchOpen(false);
      $('#mobileSearchButton').focus();
    } else if (document.body.classList.contains('focus-mode')) {
      setFocusMode(false);
    }
  }
});

renderRule('personal');
renderJournal('capital');
renderLedger('cash');
renderLab();
renderProgress();
saveProgress();
restoreLearningRoute();
sizeHeader();
