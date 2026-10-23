/* Browser-only document classifier: readable source text stays local and remains editable for learning. */
(() => {
  const moneyFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  const money = value => moneyFormat.format(Number(value) || 0);
  const byId = id => document.getElementById(id);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const voucherById = id => window.LedgerlyTally?.vouchers.find(item => item.id === id);
  const GST = window.LedgerlyGST;
  const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const samples = {
    sales: {
      name: 'sales-invoice-INV-104.txt',
      text: 'TAX INVOICE\nInvoice No: INV-104\nDate: 18/04/2026\nCustomer: Riya Services\nDescription: Premium A4 paper reams, 60 units\nTotal amount: ₹42,000\nPayment terms: payable within 30 days.'
    },
    purchase: {
      name: 'purchase-bill-PUR-221.txt',
      text: 'PURCHASE BILL\nBill No: PUR-221\nDate: 19/04/2026\nSupplier: Orbit Paper Traders\nGoods received: Premium A4 paper reams, 100 units\nInvoice total ₹40,000\nTerms: credit purchase, payable later.'
    },
    receipt: {
      name: 'customer-receipt-REC-018.txt',
      text: 'RECEIPT\nReceipt No: REC-018\nDate: 20/04/2026\nReceived from: Riya Services\nAgainst invoice: INV-104\nAmount received: ₹20,000\nMode: Business bank transfer.'
    },
    payment: {
      name: 'rent-payment-PAY-042.txt',
      text: 'PAYMENT VOUCHER\nReference: PAY-042\nDate: 21/04/2026\nPaid office rent to Greenview Properties\nAmount paid: ₹8,000\nMode: Bank transfer.'
    },
    return: {
      name: 'customer-return-CN-009.txt',
      text: 'CREDIT NOTE\nCredit note no: CN-009\nDate: 22/04/2026\nCustomer: Riya Services\nGoods returned by customer from invoice INV-104\nSales return value: ₹3,500.'
    }
  };

  const catalog = [
    ['cash', 'Cash-in-Hand', 'Cash-in-Hand'], ['bank', 'Business Bank', 'Bank Accounts'],
    ['customer', 'Customer / Sundry Debtor', 'Sundry Debtors'], ['supplier', 'Supplier / Sundry Creditor', 'Sundry Creditors'],
    ['sales', 'Sales', 'Sales Accounts'], ['purchases', 'Purchases', 'Purchase Accounts'],
    ['salesReturns', 'Sales Returns', 'Sales Accounts'], ['purchaseReturns', 'Purchase Returns', 'Purchase Accounts'],
    ['capital', "Owner's Capital", 'Capital Account'], ['loan', 'Business Loan', 'Loans (Liability)'],
    ['rent', 'Office Rent', 'Indirect Expenses'], ['salary', 'Office Salaries', 'Indirect Expenses'],
    ['drawings', 'Drawings', 'Capital Account'], ['furniture', 'Office Furniture', 'Fixed Assets'],
    ['insurance', 'Insurance Expense', 'Indirect Expenses'], ['prepaidInsurance', 'Prepaid Insurance', 'Current Assets'],
    ['depreciation', 'Depreciation Expense', 'Indirect Expenses'], ['accumulatedDepreciation', 'Accumulated Depreciation', 'Fixed Assets'],
    ['salaryPayable', 'Salaries Payable', 'Current Liabilities'], ['interestIncome', 'Interest Income', 'Indirect Incomes'],
    ['otherIncome', 'Other Income', 'Indirect Incomes']
  ].map(([id, name, group]) => ({ id, name, group }));

  const state = { text: '', fileName: '', file: null, result: null, objectUrl: null };
  let ocrLoader;
  let mammothLoader;
  let pdfLoader;

  function normalized(text) {
    return String(text || '').replace(/[\u0000\u200B-\u200D\uFEFF]/g, ' ').replace(/\u00a0/g, ' ').replace(/_+/g, ' ').replace(/[ \t]+/g, ' ').replace(/\r/g, '').trim();
  }

  function has(text, ...terms) { return terms.some(term => text.includes(term)); }
  function firstMatch(text, regexes) {
    for (const regex of regexes) { const match = text.match(regex); if (match?.[1]) return match[1].trim(); }
    return '';
  }

  function parseAmount(text) {
    const currencyMatches = [...text.matchAll(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi)].map(match => match[1]);
    const priorityLabel = firstMatch(text, [
      /grand total\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /(?:total invoice amount|invoice total|total payable|amount due|total amount)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i
    ]);
    const labelled = firstMatch(text, [
      /(?:amount received|amount paid|total|value)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i
    ]);
    const raw = priorityLabel || currencyMatches.at(-1) || labelled || firstMatch(text, [/(?:amount|value)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i]);
    return raw ? Number(raw.replaceAll(',', '')) : 0;
  }

  function parseLabeledAmount(text, labels) {
    const labelPattern = labels.map(escapeRegExp).join('|');
    const raw = firstMatch(text, [new RegExp(`(?:${labelPattern})\\s*[:\\-]?\\s*(?:₹|rs\\.?|inr)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, 'i')]);
    return raw ? Number(raw.replaceAll(',', '')) : 0;
  }

  function parseRate(text, labels) {
    const labelPattern = labels.map(escapeRegExp).join('|');
    const raw = firstMatch(text, [new RegExp(`(?:${labelPattern})\\s*(?:rate|@|at|is)?\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)\\s*%`, 'i')]);
    return raw ? Number(raw) : 0;
  }

  function parseGst(text, voucherId, totalAmount) {
    const lower = text.toLowerCase();
    const detected = /\b(?:gst|cgst|sgst|igst|gstin|taxable value|taxable amount|place of supply|input tax|output tax)\b/i.test(text);
    const applies = ['sales', 'purchase', 'debit-note', 'credit-note'].includes(voucherId);
    const taxableHint = parseLabeledAmount(text, ['taxable value', 'taxable amount', 'assessable value', 'subtotal', 'net value']);
    const explicitTax = parseLabeledAmount(text, ['total gst', 'gst amount', 'tax amount', 'total tax']);
    const cgstRate = parseRate(text, ['cgst', 'central gst']);
    const sgstRate = parseRate(text, ['sgst', 'state gst']);
    const igstRate = parseRate(text, ['igst', 'integrated gst']);
    const genericRate = parseRate(text, ['gst', 'tax rate', 'gst rate']);
    let scenario = 'none';
    if (/(?:exempt|nil[- ]rated|no gst|without gst|non[- ]taxable|composition)/i.test(text)) scenario = 'none';
    else if (igstRate || /inter[- ]?state|different state|outside state|other state|place of supply.*different/i.test(lower)) scenario = 'inter';
    else if (cgstRate || sgstRate || /intra[- ]?state|same state|within state|local supply|place of supply.*same/i.test(lower)) scenario = 'intra';
    else if (detected) scenario = 'unknown';
    const rate = cgstRate && sgstRate ? cgstRate + sgstRate : igstRate || genericRate || cgstRate + sgstRate;
    const hasTotalLabel = /grand total|invoice total|total payable|amount due|total amount|net amount/i.test(text);
    let taxable = taxableHint || 0;
    if (!taxable) {
      taxable = rate && hasTotalLabel && totalAmount ? totalAmount / (1 + rate / 100) : totalAmount;
      if (explicitTax && totalAmount > explicitTax) taxable = totalAmount - explicitTax;
    }
    const effectiveRate = rate || (explicitTax && taxable ? explicitTax / taxable * 100 : 0);
    const kind = ['purchase', 'debit-note'].includes(voucherId) ? 'purchase' : 'sale';
    const calculated = GST.calculate({ scenario: applies ? scenario : 'none', rate: effectiveRate, taxable, kind });
    return { detected, applies, scenario: applies ? scenario : 'none', rate: effectiveRate, taxable, explicitTax, totalAmount, documentTotal: hasTotalLabel ? totalAmount : calculated.total, totalParsed: hasTotalLabel, kind, calculated };
  }

  function parseDate(text) {
    const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
    const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const toISO = (day, monthName, year) => {
      const month = months.indexOf(monthName.slice(0, 3).toLowerCase()) + 1;
      return month && Number(day) >= 1 && Number(day) <= 31 ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
    };
    const dayFirst = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s]+(20\d{2})\b/i);
    if (dayFirst) return toISO(dayFirst[1], dayFirst[2], dayFirst[3]);
    const monthFirst = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(20\d{2})\b/i);
    return monthFirst ? toISO(monthFirst[2], monthFirst[1], monthFirst[3]) : '';
  }

  function parseReference(text) {
    const clean = value => {
      const candidate = value.replace(/[.,;:]+$/, '').trim();
      return /^(?:date|amount|total|customer|supplier|vendor|gstin|number|no)$/i.test(candidate) ? '' : candidate;
    };
    const labelled = firstMatch(text, [
      /(?:invoice|bill|receipt|voucher|document|reference|ref|credit note|debit note)\s*(?:no\.?|number|#|id)\s*[:\-]?\s*#?([A-Z0-9][A-Z0-9./_-]{1,})/i,
      /(?:invoice|bill|receipt|voucher)\s*[:\-]\s*#?([A-Z0-9][A-Z0-9./_-]{1,})/i
    ]);
    const result = clean(labelled || firstMatch(text, [
      /\b((?:INV|PUR|REC|PAY|CN|DN|ADJ)[-/]?\d{2,})\b/i
    ]));
    return /^(?:\d{1,2}[-/.]){2}\d{2,4}$/.test(result) ? '' : result;
  }

  function parseParty(text, kind) {
    const labels = kind === 'supplier' ? '(?:supplier|vendor|seller|bought from|purchased from)' : kind === 'customer' ? '(?:customer|buyer|client|received from|sold to|billed to)' : '(?:customer|supplier|vendor|buyer|client|received from|paid to|sold to|bought from)';
    const value = firstMatch(text, [new RegExp(`${labels}\\s*[:\\-]\\s*([^\\n,.]+)`, 'i')]);
    return value.replace(/\s+(?:date|amount|invoice|bill|mode|terms)\s*$/i, '').trim();
  }

  function findScores(text, fileName) {
    const combined = `${text} ${fileName}`.toLowerCase();
    const scores = Object.fromEntries(['sales', 'purchase', 'receipt', 'payment', 'contra', 'journal', 'debit-note', 'credit-note'].map(id => [id, 0]));
    const add = (id, amount, ...terms) => { if (has(combined, ...terms)) scores[id] += amount; };
    add('debit-note', 9, 'debit note', 'purchase return', 'returned to supplier', 'return to vendor', 'goods returned to');
    add('credit-note', 9, 'credit note', 'sales return', 'customer return', 'returned by customer', 'goods returned by');
    add('contra', 9, 'contra', 'cash deposited', 'cash withdrawn from bank', 'bank to cash', 'cash to bank', 'own bank account', 'internal transfer');
    add('purchase', 8, 'purchase', 'bought', 'goods received', 'supplier invoice', 'purchase bill', 'vendor invoice', 'purchased from');
    add('sales', 8, 'sales invoice', 'tax invoice', 'sale bill', 'sales bill', 'sale voucher', 'sold', 'sale of', 'goods supplied', 'customer invoice');
    add('receipt', 8, 'receipt', 'received from', 'amount received', 'collected from', 'capital introduced', 'loan received', 'interest received');
    add('payment', 8, 'payment', 'paid', 'amount paid', 'rent paid', 'salary paid', 'settled supplier', 'expense voucher');
    add('journal', 8, 'journal', 'depreciation', 'accrual', 'adjustment', 'provision', 'write off', 'closing entry');
    if (has(combined, 'invoice', 'bill') && !has(combined, 'payment', 'receipt', 'return')) scores.sales += 2;
    if (has(combined, 'credit') && has(combined, 'payable', 'terms', 'later')) scores.purchase += 2;
    return scores;
  }

  function suggestLedgers(voucherId, text, party) {
    const lower = text.toLowerCase();
    const cash = has(lower, 'cash', 'cash payment', 'cash sale', 'cash received') && !has(lower, 'cashless');
    const bank = has(lower, 'bank', 'upi', 'neft', 'imps', 'transfer', 'cheque', 'online');
    const liquid = bank ? 'bank' : cash ? 'cash' : 'bank';
    let debit = 'cash'; let credit = 'sales';
    if (voucherId === 'sales') { debit = has(lower, 'credit sale', 'on credit', 'payable within', 'payment terms') ? 'customer' : liquid; credit = 'sales'; }
    if (voucherId === 'purchase') { debit = 'purchases'; credit = has(lower, 'credit purchase', 'payable later', 'on credit', 'terms') ? 'supplier' : liquid; }
    if (voucherId === 'receipt') {
      debit = liquid;
      credit = has(lower, 'capital', 'owner introduces', 'owner investment') ? 'capital' : has(lower, 'loan') ? 'loan' : has(lower, 'interest') ? 'interestIncome' : 'customer';
    }
    if (voucherId === 'payment') {
      credit = liquid;
      debit = has(lower, 'rent') ? 'rent' : has(lower, 'salary', 'wages') ? 'salary' : has(lower, 'drawing', 'personal', 'household', 'owner takes') ? 'drawings' : has(lower, 'furniture', 'laptop', 'equipment', 'asset') ? 'furniture' : has(lower, 'insurance') ? 'prepaidInsurance' : has(lower, 'supplier', 'vendor', 'bill settlement', 'invoice settlement') ? 'supplier' : 'rent';
    }
    if (voucherId === 'contra') { debit = has(lower, 'cash to bank', 'deposit', 'cash deposited') ? 'bank' : 'cash'; credit = debit === 'bank' ? 'cash' : 'bank'; }
    if (voucherId === 'debit-note') { debit = 'supplier'; credit = 'purchaseReturns'; }
    if (voucherId === 'credit-note') { debit = 'salesReturns'; credit = 'customer'; }
    if (voucherId === 'journal') {
      debit = has(lower, 'salary', 'accrual') ? 'salary' : has(lower, 'insurance') ? 'insurance' : has(lower, 'depreciation') ? 'depreciation' : 'otherIncome';
      credit = debit === 'salary' ? 'salaryPayable' : debit === 'insurance' ? 'prepaidInsurance' : debit === 'depreciation' ? 'accumulatedDepreciation' : 'otherIncome';
    }
    return { debit, credit, party };
  }

  function explain(voucherId, debitId, creditId, text, party) {
    const data = voucherById(voucherId);
    const debit = catalog.find(item => item.id === debitId)?.name || debitId;
    const credit = catalog.find(item => item.id === creditId)?.name || creditId;
    const partyLine = party ? ` The document names ${party}, so that party ledger is kept visible for allocation.` : '';
    const steps = [
      `${data.name} is selected because the source describes ${data.use.toLowerCase()}`,
      `${debit} is debited: it is the value received, expense incurred, asset added, or balance reduced on this side.`,
      `${credit} is credited: it is the value given, income recognised, liability created, or balance reduced on this side.${partyLine}`
    ];
    return { title: `${data.name} follows the document’s event`, text: `${data.use} The two sides must carry the same amount. ${data.avoid}`, steps };
  }

  function classify(text, fileName) {
    const source = normalized(text);
    const scores = findScores(source, fileName);
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let voucherId = ranked[0][1] ? ranked[0][0] : 'journal';
    const amount = parseAmount(source);
    const date = parseDate(source);
    const reference = parseReference(source);
    const partyKind = ['purchase', 'debit-note'].includes(voucherId) ? 'supplier' : ['sales', 'credit-note', 'receipt'].includes(voucherId) ? 'customer' : 'any';
    const party = parseParty(source, partyKind);
    const ledgers = suggestLedgers(voucherId, source, party);
    const gst = parseGst(source, voucherId, amount);
    const entryAmount = gst.detected && gst.applies && gst.scenario !== 'unknown' && gst.calculated.hasTax && !gst.totalParsed ? gst.documentTotal : amount;
    const strongest = ranked[0][1];
    const confidence = Math.max(42, Math.min(98, 48 + strongest * 4 + (amount ? 10 : 0) + (date ? 6 : 0) + (reference ? 5 : 0)));
    const signals = [
      [voucherId === 'journal' && strongest === 0 ? 'No type words' : `${voucherById(voucherId).name} language`, voucherId === 'journal' && strongest === 0 ? 'fallback' : 'found'],
      [entryAmount ? `Amount ${money(entryAmount)}` : 'Amount not found', entryAmount ? 'found' : 'missing'],
      [date ? `Date ${date}` : 'Date not found', date ? 'found' : 'missing'],
      [party ? `Party ${party}` : 'Party not found', party ? 'found' : 'missing'],
      [reference ? `Ref ${reference}` : 'Reference not found', reference ? 'found' : 'missing'],
      [gst.detected ? `GST ${gst.scenario === 'unknown' ? 'scenario needed' : gst.scenario}` : 'No GST clue', gst.detected ? 'found' : 'missing']
    ];
    return { voucherId, amount: entryAmount, date, reference, party, debitId: ledgers.debit, creditId: ledgers.credit, gst, confidence, signals, source, scores };
  }

  function setStatus(title, detail, mode = '') {
    const status = byId('coachStatus');
    status.className = `coach-status ${mode}`;
    status.querySelector('strong').textContent = title;
    status.querySelector('small').textContent = detail;
  }

  function updateCount() { byId('coachCharacterCount').textContent = `${byId('coachText').value.length.toLocaleString()} characters`; }

  function setFilePreview(file) {
    const preview = byId('coachFilePreview');
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
    preview.replaceChildren();
    if (!file) { preview.hidden = true; return; }
    const meta = document.createElement('div');
    const size = file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    meta.append(document.createElement('strong'), document.createElement('span'));
    meta.firstChild.textContent = file.name;
    meta.lastChild.textContent = `${file.type || 'document'} · ${size}`;
    if (file.type.startsWith('image/')) {
      state.objectUrl = URL.createObjectURL(file);
      const image = document.createElement('img'); image.src = state.objectUrl; image.alt = 'Uploaded document preview'; preview.append(image);
    } else {
      const icon = document.createElement('span'); icon.className = 'coach-upload-icon';
      const extension = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : '';
      icon.textContent = file.type === 'application/pdf' ? 'PDF' : ['DOC', 'DOCX'].includes(extension) ? extension : 'TXT'; preview.append(icon);
    }
    preview.append(meta); preview.hidden = false;
  }

  function loadOcr() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (ocrLoader) return ocrLoader;
    ocrLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR library did not load'));
      script.onerror = () => reject(new Error('OCR library could not load'));
      document.head.append(script);
    });
    return ocrLoader;
  }

  async function readImageText(file) {
    setStatus('Reading image…', 'Running OCR in your browser', 'busy');
    const ocr = await loadOcr();
    const result = await ocr.recognize(file, 'eng', {
      logger: message => {
        if (message.status === 'recognizing text' && Number.isFinite(message.progress)) setStatus('Reading image…', `${Math.round(message.progress * 100)}% text recognized`, 'busy');
      }
    });
    return result.data.text || '';
  }

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfLoader) return pdfLoader;
    pdfLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib) { reject(new Error('PDF reader did not load')); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('PDF reader could not load'));
      document.head.append(script);
    });
    return pdfLoader;
  }

  async function readPdfText(file) {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let extracted = '';
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      extracted += `${content.items.map(item => item.str || '').join(' ')}\n`;
    }
    return extracted.trim();
  }

  async function readPdfScanText(file) {
    const pdfjs = await loadPdfJs();
    const ocr = await loadOcr();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let extracted = '';
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      setStatus('Reading scanned PDF…', `Rendering page ${pageNumber} of ${pdf.numPages}`, 'busy');
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2.3, 1800 / baseViewport.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const result = await ocr.recognize(canvas, 'eng', {
        logger: message => {
          if (message.status === 'recognizing text' && Number.isFinite(message.progress)) setStatus('Reading scanned PDF…', `Page ${pageNumber}: ${Math.round(message.progress * 100)}% text recognized`, 'busy');
        }
      });
      extracted += `${result.data.text || ''}\n`;
    }
    return extracted.trim();
  }

  function loadMammoth() {
    if (window.mammoth) return Promise.resolve(window.mammoth);
    if (mammothLoader) return mammothLoader;
    mammothLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
      script.async = true;
      script.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error('Word reader did not load'));
      script.onerror = () => reject(new Error('Word reader could not load'));
      document.head.append(script);
    });
    return mammothLoader;
  }

  function zipUint16(bytes, offset) {
    return bytes[offset] | bytes[offset + 1] << 8;
  }

  function zipUint32(bytes, offset) {
    return (bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] << 24) >>> 0;
  }

  async function inflateDocxEntry(bytes, method) {
    if (method === 0) return bytes;
    if (method !== 8 || typeof DecompressionStream !== 'function') throw new Error('This browser cannot unpack compressed Word files locally');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readDocxLocally(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const searchStart = Math.max(0, bytes.length - 65557);
    let endOfCentralDirectory = -1;
    for (let offset = bytes.length - 22; offset >= searchStart; offset -= 1) {
      if (zipUint32(bytes, offset) === 0x06054b50) { endOfCentralDirectory = offset; break; }
    }
    if (endOfCentralDirectory < 0) throw new Error('Not a DOCX ZIP archive');
    const entryCount = zipUint16(bytes, endOfCentralDirectory + 10);
    const centralOffset = zipUint32(bytes, endOfCentralDirectory + 16);
    let offset = centralOffset;
    let documentBytes;
    for (let index = 0; index < entryCount && offset + 46 <= bytes.length; index += 1) {
      if (zipUint32(bytes, offset) !== 0x02014b50) break;
      const method = zipUint16(bytes, offset + 10);
      const compressedSize = zipUint32(bytes, offset + 20);
      const nameLength = zipUint16(bytes, offset + 28);
      const extraLength = zipUint16(bytes, offset + 30);
      const commentLength = zipUint16(bytes, offset + 32);
      const localOffset = zipUint32(bytes, offset + 42);
      const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      if (name === 'word/document.xml') {
        const localNameLength = zipUint16(bytes, localOffset + 26);
        const localExtraLength = zipUint16(bytes, localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        documentBytes = await inflateDocxEntry(bytes.slice(dataStart, dataStart + compressedSize), method);
        break;
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
    if (!documentBytes) throw new Error('Word document body was not found');
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(documentBytes), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Word document XML could not be read');
    let output = '';
    function walk(element) {
      const localName = element.localName || element.nodeName.split(':').pop();
      if (localName === 't' || localName === 'instrText') output += element.textContent || '';
      else if (localName === 'tab') output += '\t';
      else if (localName === 'br' || localName === 'cr') output += '\n';
      for (const child of element.children || []) walk(child);
      if (localName === 'p') output += '\n';
      if (localName === 'tc') output += '\t';
    }
    walk(xml.documentElement);
    return normalized(output).replace(/\n[ \t]+/g, '\n');
  }

  async function readWordText(file) {
    setStatus('Reading Word document…', 'Extracting paragraphs in your browser', 'busy');
    try {
      const localText = await readDocxLocally(file);
      if (localText) return localText;
    } catch (error) {
      console.info('Local DOCX extraction unavailable; trying Word reader fallback.', error);
    }
    const mammoth = await loadMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value || '';
  }

  async function readLegacyWordText(file) {
    setStatus('Reading Word document…', 'Looking for readable bill text', 'busy');
    const bytes = await file.arrayBuffer();
    const decoded = new TextDecoder('windows-1252').decode(bytes);
    return decoded.match(/[\x20-\x7E₹]{4,}/g)?.filter(part => /[A-Za-z]{2}/.test(part)).join('\n') || '';
  }

  function renderLedgerSelect(select, selected, party, side) {
    const items = catalog.map(item => ({ ...item }));
    if (party && ((side === 'debit' && ['sales', 'receipt', 'credit-note'].includes(state.result?.voucherId)) || (side === 'credit' && ['purchase', 'debit-note', 'receipt'].includes(state.result?.voucherId)))) {
      const id = side === 'debit' && state.result?.voucherId === 'sales' ? 'customer' : side === 'credit' && ['purchase', 'debit-note'].includes(state.result?.voucherId) ? 'supplier' : side === 'credit' ? 'customer' : side === 'debit' ? 'supplier' : '';
      const item = items.find(entry => entry.id === id); if (item) item.name = party;
    }
    select.replaceChildren(...items.map(item => new Option(item.name, item.id)));
    select.value = selected;
  }

  function renderGst(result) {
    const gst = result.gst;
    const calculated = GST.calculate({ scenario: gst.scenario, rate: gst.rate, taxable: gst.taxable, kind: gst.kind });
    gst.calculated = calculated;
    const pill = byId('coachGstPill');
    pill.className = `coach-gst-pill ${gst.scenario}`;
    pill.textContent = !gst.detected ? 'No GST detected' : !gst.applies ? 'Settlement · no new GST' : calculated.details.shortLabel;
    byId('coachGstScenario').value = gst.scenario;
    byId('coachGstRate').value = gst.rate ? gst.rate.toFixed(2).replace(/\.00$/, '') : '';
    byId('coachGstTaxable').textContent = money(calculated.taxable);
    byId('coachGstCgst').textContent = calculated.cgst ? money(calculated.cgst) : '—';
    byId('coachGstSgst').textContent = calculated.sgst ? money(calculated.sgst) : '—';
    byId('coachGstIgst').textContent = calculated.igst ? money(calculated.igst) : '—';
    byId('coachGstTotal').textContent = money(gst.totalParsed ? gst.totalAmount : calculated.total);
    let why;
    if (!gst.applies) why = 'This voucher settles or adjusts an existing balance. Do not record GST again on a receipt or payment; keep the tax on the original invoice.';
    else if (gst.scenario === 'unknown') why = 'GST words were found, but the document does not say whether the supplier and place of supply are in the same state. Choose the scenario before posting.';
    else if (gst.scenario === 'none') why = GST.scenarios.none.explanation;
    else why = `${GST.scenarios[gst.scenario].explanation} At ${calculated.rate}%, the tax shown below is added to the taxable value.`;
    byId('coachGstWhy').textContent = why;
    const lines = [];
    const purchase = ['purchase', 'debit-note'].includes(result.voucherId);
    const returnEntry = ['debit-note', 'credit-note'].includes(result.voucherId);
    if (!gst.applies || gst.scenario === 'none') {
      lines.push(['No CGST / SGST / IGST line is added for this document.', 'info', '']);
    } else if (gst.scenario === 'unknown') {
      lines.push(['Choose same state or different state to generate the tax ledgers.', 'prompt', '']);
    } else if (purchase && !returnEntry) {
      if (calculated.cgst) lines.push(['Input CGST', 'Dr', calculated.cgst]);
      if (calculated.sgst) lines.push(['Input SGST', 'Dr', calculated.sgst]);
      if (calculated.igst) lines.push(['Input IGST', 'Dr', calculated.igst]);
    } else if (purchase && returnEntry) {
      if (calculated.cgst) lines.push(['Input CGST reversal', 'Cr', calculated.cgst]);
      if (calculated.sgst) lines.push(['Input SGST reversal', 'Cr', calculated.sgst]);
      if (calculated.igst) lines.push(['Input IGST reversal', 'Cr', calculated.igst]);
    } else if (returnEntry) {
      if (calculated.cgst) lines.push(['Output CGST reversal', 'Dr', calculated.cgst]);
      if (calculated.sgst) lines.push(['Output SGST reversal', 'Dr', calculated.sgst]);
      if (calculated.igst) lines.push(['Output IGST reversal', 'Dr', calculated.igst]);
    } else {
      if (calculated.cgst) lines.push(['Output CGST', 'Cr', calculated.cgst]);
      if (calculated.sgst) lines.push(['Output SGST', 'Cr', calculated.sgst]);
      if (calculated.igst) lines.push(['Output IGST', 'Cr', calculated.igst]);
    }
    byId('coachGstLines').replaceChildren(...lines.map(([label, side, amount]) => {
      const row = document.createElement('div'); row.className = `coach-gst-line ${side.toLowerCase() || 'info'}`;
      row.append(document.createElement('span'), document.createElement('b'), document.createElement('strong'));
      row.firstChild.textContent = label; row.children[1].textContent = side; row.lastChild.textContent = amount ? money(amount) : '';
      return row;
    }));
  }

  function renderResult() {
    const result = state.result;
    if (!result) return;
    const data = voucherById(result.voucherId);
    byId('coachEmpty').hidden = true; byId('coachResult').hidden = false;
    byId('coachConfidenceLabel').textContent = result.confidence >= 80 ? 'High confidence' : result.confidence >= 62 ? 'Review suggested fields' : 'Low confidence · check the source';
    byId('coachConfidenceBar').style.width = `${result.confidence}%`;
    byId('coachConfidenceValue').textContent = `${result.confidence}%`;
    byId('coachExtractedText').textContent = result.source || 'No readable text was extracted. Use the quick-capture box to paste the visible invoice text.';
    byId('coachVoucherTitle').textContent = `${data.name} voucher · ${data.key}`;
    byId('coachVoucherSelect').replaceChildren(...window.LedgerlyTally.vouchers.map(item => new Option(`${item.name} · ${item.use}`, item.id)));
    byId('coachVoucherSelect').value = result.voucherId;
    renderLedgerSelect(byId('coachDebitSelect'), result.debitId, result.party, 'debit');
    renderLedgerSelect(byId('coachCreditSelect'), result.creditId, result.party, 'credit');
    const debit = catalog.find(item => item.id === result.debitId) || { name: result.debitId, group: 'Review ledger' };
    const credit = catalog.find(item => item.id === result.creditId) || { name: result.creditId, group: 'Review ledger' };
    byId('coachDebitGroup').textContent = `Tally group · ${debit.group}`;
    byId('coachCreditGroup').textContent = `Tally group · ${credit.group}`;
    byId('coachAmount').value = result.amount || '';
    byId('coachDate').value = result.date;
    byId('coachReference').value = result.reference;
    byId('coachDebitLine').textContent = `${debit.name} Dr`;
    byId('coachCreditLine').textContent = `${credit.name} Cr`;
    byId('coachEntryAmount').textContent = money(result.amount);
    byId('coachSignals').replaceChildren(...result.signals.map(([label, type]) => {
      const item = document.createElement('span'); item.className = `coach-signal ${type}`;
      const mark = document.createElement('strong'); mark.textContent = type === 'found' ? '✓ ' : '· ';
      item.append(mark, document.createTextNode(label)); return item;
    }));
    renderGst(result);
    const why = explain(result.voucherId, result.debitId, result.creditId, result.source, result.party);
    byId('coachWhyIcon').textContent = data.icon;
    byId('coachWhyTitle').textContent = why.title;
    byId('coachWhyText').textContent = why.text;
    byId('coachWhySteps').replaceChildren(...why.steps.map(step => { const item = document.createElement('li'); item.textContent = step; return item; }));
    setStatus('Analysis ready', `${data.name} · review the highlighted logic`, 'done');
  }

  function applyVoucherChange() {
    if (!state.result) return;
    const voucherId = byId('coachVoucherSelect').value;
    const ledgers = suggestLedgers(voucherId, state.result.source, state.result.party);
    const gst = parseGst(state.result.source, voucherId, state.result.amount);
    state.result = { ...state.result, voucherId, debitId: ledgers.debit, creditId: ledgers.credit, gst, confidence: Math.max(45, state.result.confidence - 4) };
    renderResult();
  }

  function updateEntryFromControls() {
    if (!state.result) return;
    state.result.debitId = byId('coachDebitSelect').value;
    state.result.creditId = byId('coachCreditSelect').value;
    state.result.amount = Number(byId('coachAmount').value) || 0;
    state.result.date = byId('coachDate').value;
    state.result.reference = byId('coachReference').value.trim();
    const debit = catalog.find(item => item.id === state.result.debitId) || { name: state.result.debitId, group: 'Review ledger' };
    const credit = catalog.find(item => item.id === state.result.creditId) || { name: state.result.creditId, group: 'Review ledger' };
    byId('coachDebitGroup').textContent = `Tally group · ${debit.group}`;
    byId('coachCreditGroup').textContent = `Tally group · ${credit.group}`;
    byId('coachDebitLine').textContent = `${debit.name} Dr`;
    byId('coachCreditLine').textContent = `${credit.name} Cr`;
    byId('coachEntryAmount').textContent = money(state.result.amount);
    byId('coachReviewNote').textContent = 'You edited the suggestion. The entry is now your reviewed version; compare it with the source before posting in real Tally.';
  }

  function updateGstFromControls() {
    if (!state.result?.gst) return;
    const gst = state.result.gst;
    gst.scenario = byId('coachGstScenario').value;
    gst.rate = Number(byId('coachGstRate').value) || 0;
    gst.calculated = GST.calculate({ scenario: gst.scenario, rate: gst.rate, taxable: gst.taxable, kind: gst.kind });
    if (!gst.totalParsed && gst.calculated.hasTax) state.result.amount = gst.calculated.total;
    renderGst(state.result);
    byId('coachEntryAmount').textContent = money(state.result.amount);
    byId('coachReviewNote').textContent = 'You edited the GST treatment. Confirm the supplier state, place of supply, rate and tax invoice before posting in real Tally.';
  }

  function analyze() {
    const text = normalized(byId('coachText').value);
    if (!text && !state.fileName) { setStatus('Add a source first', 'Upload, paste, or choose a sample'); byId('coachText').focus(); return; }
    setStatus('Reading document…', 'Matching event words and amounts', 'busy');
    byId('coachAnalyze').disabled = true;
    window.setTimeout(() => {
      try {
        if (!GST) throw new Error('GST model is unavailable');
        state.text = text; state.result = classify(text, state.fileName);
        renderResult();
      } catch (error) {
        console.error('Ledgerly document analysis failed:', error);
        state.result = null;
        byId('coachResult').hidden = true;
        byId('coachEmpty').hidden = false;
        byId('coachEmpty').querySelector('h5').textContent = 'Analysis could not finish';
        byId('coachEmpty').querySelector('p').textContent = `${error.message || 'The document could not be analyzed.'} You can paste the visible invoice text into the capture box and try again.`;
        setStatus('Analysis could not finish', 'Paste the visible bill text into quick capture');
      } finally {
        byId('coachAnalyze').disabled = false;
      }
    }, 320);
  }

  async function readFile(file) {
    if (file.size > 10 * 1024 * 1024) { setStatus('File is too large', 'Choose a document under 10 MB'); return; }
    state.file = file; state.fileName = file.name; setFilePreview(file); setStatus('Document loaded', 'Preparing the source for analysis', 'done');
    byId('coachText').value = '';
    let text = '';
    try {
      if (file.type.startsWith('text/') || /\.(txt|csv|json)$/i.test(file.name)) {
        text = await file.text();
        if (/\.json$/i.test(file.name)) { try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* Keep the raw editable text. */ } }
      } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
        text = await readImageText(file);
      } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        try { text = await readPdfText(file); } catch { text = ''; }
        if (!text || !/(?:invoice|bill|date|amount|total|gst|customer|supplier)/i.test(text)) text = await readPdfScanText(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(file.name)) {
        text = await readWordText(file);
      } else if (file.type === 'application/msword' || /\.doc$/i.test(file.name)) {
        text = await readLegacyWordText(file);
      }
    } catch (error) {
      console.error('Ledgerly document reading failed:', error);
      setStatus('Document loaded', `${error.message || 'OCR could not read this file'} · use quick capture`, 'done');
      byId('coachManualFallback').open = true;
      text = '';
    }
    if (!text && (file.type === 'application/pdf' || /\.(pdf|doc|docx)$/i.test(file.name))) byId('coachManualFallback').open = true;
    if (text) byId('coachText').value = text.slice(0, 20000);
    updateCount(); analyze();
  }

  function clearCoach() {
    state.text = ''; state.fileName = ''; state.file = null; state.result = null;
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); state.objectUrl = null;
    byId('coachFileInput').value = ''; byId('coachText').value = ''; byId('coachFilePreview').replaceChildren(); byId('coachFilePreview').hidden = true;
    byId('coachManualFallback').open = false;
    byId('coachResult').hidden = true; byId('coachEmpty').hidden = false;
    byId('coachEmpty').querySelector('h5').textContent = 'Your answer will appear here';
    byId('coachEmpty').querySelector('p').textContent = 'Upload a source or choose a sample. Then challenge the suggestion by changing the voucher or either ledger.';
    updateCount(); setStatus('Ready to inspect', 'Nothing uploaded yet');
  }

  function copyEntry() {
    if (!state.result) return;
    const debit = catalog.find(item => item.id === state.result.debitId)?.name || state.result.debitId;
    const credit = catalog.find(item => item.id === state.result.creditId)?.name || state.result.creditId;
    const data = voucherById(state.result.voucherId);
    const tax = state.result.gst?.calculated;
    const debitAmount = tax?.hasTax && ['sales', 'debit-note'].includes(state.result.voucherId) ? tax.total : tax?.hasTax && ['purchase', 'credit-note'].includes(state.result.voucherId) ? tax.taxable : state.result.amount;
    const creditAmount = tax?.hasTax && ['sales', 'debit-note'].includes(state.result.voucherId) ? tax.taxable : tax?.hasTax && ['purchase', 'credit-note'].includes(state.result.voucherId) ? tax.total : state.result.amount;
    const value = `${data.name} voucher\n${debit} Dr ${money(debitAmount)}\nTo ${credit} ${money(creditAmount)}\n${state.result.reference ? `Reference: ${state.result.reference}\n` : ''}${state.result.party ? `Party: ${state.result.party}\n` : ''}Reason: ${data.use}`;
    const taxLines = tax?.hasTax ? [
      tax.cgst ? `${state.result.gst.kind === 'purchase' ? 'Input' : 'Output'} CGST ${state.result.voucherId === 'credit-note' ? 'Dr' : 'Cr'} ${money(tax.cgst)}` : '',
      tax.sgst ? `${state.result.gst.kind === 'purchase' ? 'Input' : 'Output'} SGST ${state.result.voucherId === 'credit-note' ? 'Dr' : 'Cr'} ${money(tax.sgst)}` : '',
      tax.igst ? `${state.result.gst.kind === 'purchase' ? 'Input' : 'Output'} IGST ${state.result.voucherId === 'credit-note' ? 'Dr' : 'Cr'} ${money(tax.igst)}` : ''
    ].filter(Boolean).join('\n') : '';
    const fullValue = taxLines ? `${value}\nTax lines:\n${taxLines}\nGST scenario: ${tax.details.label} at ${tax.rate}%` : value;
    const clipboardWrite = navigator.clipboard?.writeText(fullValue);
    if (!clipboardWrite) { showToast('Clipboard access is unavailable here. Select and copy the entry from the coach.'); return; }
    clipboardWrite.then(() => showToast('Reviewed entry copied to your clipboard.')).catch(() => showToast('Select and copy the entry from the coach.'));
  }

  function useInTally() {
    if (!state.result) return;
    const result = state.result;
    const tallyTab = byId('tally-tab-entry');
    tallyTab?.click();
    window.setTimeout(() => {
      const ribbon = document.querySelector(`#tallyVoucherRibbon button[data-voucher="${escapeRegExp(result.voucherId)}"]`);
      ribbon?.click();
      const date = byId('tallyDate'); const debit = byId('tallyDebit'); const credit = byId('tallyCredit');
      if (date && result.date) date.value = result.date;
      if (debit) debit.value = result.debitId;
      if (credit) credit.value = result.creditId;
      byId('tallyDebitAmount').value = result.amount || '';
      byId('tallyCreditAmount').value = result.amount || '';
      byId('tallyNarration').value = `${result.reference || 'Document'} · ${result.party || 'source reviewed by Document Coach'}`;
      ['tallyDate', 'tallyDebit', 'tallyCredit', 'tallyDebitAmount', 'tallyCreditAmount', 'tallyNarration'].forEach(id => byId(id)?.dispatchEvent(new Event('input', { bubbles: true })));
      byId('tallySimulator')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(result.gst?.calculated?.hasTax ? 'Base voucher opened. Keep the CGST/SGST/IGST lines from the coach visible while entering Tally.' : 'Entry copied into the Tally trainer. Check the fields, then post when ready.');
    }, 120);
  }

  const input = byId('coachText');
  input.addEventListener('input', updateCount);
  byId('coachAnalyze').addEventListener('click', analyze);
  byId('coachClear').addEventListener('click', clearCoach);
  byId('coachFileInput').addEventListener('change', event => { if (event.target.files[0]) readFile(event.target.files[0]); });
  ['dragenter', 'dragover'].forEach(type => byId('coachDropzone').addEventListener(type, event => { event.preventDefault(); byId('coachDropzone').classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(type => byId('coachDropzone').addEventListener(type, event => { event.preventDefault(); byId('coachDropzone').classList.remove('dragging'); }));
  byId('coachDropzone').addEventListener('drop', event => { if (event.dataTransfer.files[0]) readFile(event.dataTransfer.files[0]); });
  byId('coachDropzone').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); byId('coachFileInput').click(); } });
  $$('#coachSamples button').forEach(button => button.addEventListener('click', () => { const sample = samples[button.dataset.coachSample]; state.fileName = sample.name; byId('coachText').value = sample.text; updateCount(); setFilePreview({ name: sample.name, size: new Blob([sample.text]).size, type: 'text/plain' }); analyze(); }));
  byId('coachVoucherSelect').addEventListener('change', applyVoucherChange);
  ['coachDebitSelect', 'coachCreditSelect', 'coachAmount', 'coachDate', 'coachReference'].forEach(id => byId(id).addEventListener('input', updateEntryFromControls));
  byId('coachGstScenario').addEventListener('change', updateGstFromControls);
  byId('coachGstRate').addEventListener('input', updateGstFromControls);
  byId('coachUseTally').addEventListener('click', useInTally);
  byId('coachCopyEntry').addEventListener('click', copyEntry);
  updateCount();
})();
