/* Shared GST calculations for the document coach and the learning decision desk. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.LedgerlyGST = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const scenarios = {
    intra: {
      label: 'Intra-state', shortLabel: 'CGST + SGST',
      explanation: 'The supplier and place of supply are in the same state. Split the GST equally between Central GST and State GST.'
    },
    inter: {
      label: 'Inter-state', shortLabel: 'IGST',
      explanation: 'The supplier and place of supply are in different states. Use Integrated GST instead of CGST and SGST.'
    },
    none: {
      label: 'Exempt / nil-rated', shortLabel: 'No GST',
      explanation: 'The supply is exempt, nil-rated, outside GST, or otherwise does not carry CGST, SGST or IGST.'
    },
    unknown: {
      label: 'Choose the scenario', shortLabel: 'GST scenario needed',
      explanation: 'Check the supplier state and place of supply before choosing the tax ledgers.'
    }
  };

  // Practice defaults live in one place so a future admin/API master can replace
  // rates, forms and dates without changing calculation or screen logic.
  const config = Object.freeze({
    rateMaster: [0, 5, 12, 18, 28],
    returnForms: ['GSTR-1', 'GSTR-3B', 'GSTR-9', 'CMP-08'],
    demoDueDates: {
      'GSTR-1': '11 May 2026', 'GSTR-2B': '14 May 2026', 'GSTR-3B': '20 May 2026'
    },
    source: 'Illustrative practice configuration — verify current law and portal data before use.'
  });

  function round(value) { return Math.round((Number(value) || 0) * 100) / 100; }

  function stateFromGSTIN(gstin = '') {
    const match = String(gstin).trim().match(/^(\d{2})/);
    return match ? match[1] : '';
  }

  function resolveScenario({ scenario, supplierState = '', placeOfSupply = '', supplierGSTIN = '', recipientGSTIN = '' } = {}) {
    if (scenario && Object.hasOwn(scenarios, scenario)) return scenario;
    const sellerState = String(supplierState || stateFromGSTIN(supplierGSTIN)).trim().toLowerCase();
    const placeState = String(placeOfSupply || stateFromGSTIN(recipientGSTIN)).trim().toLowerCase();
    if (!sellerState || !placeState) return 'unknown';
    return sellerState === placeState ? 'intra' : 'inter';
  }

  function calculate({ scenario = 'unknown', rate = 0, taxable = 0, kind = 'sale', cessRate = 0, reverseCharge = false, discount = 0 } = {}) {
    const safeScenario = Object.hasOwn(scenarios, scenario) ? scenario : 'unknown';
    const taxableValue = round(Math.max(0, Number(taxable) - Math.max(0, Number(discount) || 0)));
    const percentage = round(Math.max(0, rate));
    const cessPercentage = round(Math.max(0, cessRate));
    const taxTotal = safeScenario === 'unknown' || safeScenario === 'none' ? 0 : round(taxableValue * percentage / 100);
    const cgst = safeScenario === 'intra' ? round(taxTotal / 2) : 0;
    const sgst = safeScenario === 'intra' ? round(taxTotal - cgst) : 0;
    const igst = safeScenario === 'inter' ? taxTotal : 0;
    const cess = safeScenario === 'unknown' || safeScenario === 'none' ? 0 : round(taxableValue * cessPercentage / 100);
    return {
      scenario: safeScenario, kind, taxable: taxableValue, rate: percentage, cessRate: cessPercentage,
      cgst, sgst, igst, cess, taxTotal: round(cgst + sgst + igst + cess),
      total: round(taxableValue + taxTotal + cess), hasTax: taxTotal + cess > 0,
      reverseCharge: Boolean(reverseCharge), details: scenarios[safeScenario]
    };
  }

  function calculateInvoice({ lines = [], supplierState = '', placeOfSupply = '', supplierGSTIN = '', recipientGSTIN = '', scenario, kind = 'sale', reverseCharge = false } = {}) {
    const resolved = resolveScenario({ scenario, supplierState, placeOfSupply, supplierGSTIN, recipientGSTIN });
    const safeLines = Array.isArray(lines) ? lines : [];
    const calculatedLines = safeLines.map((line, index) => {
      const quantity = round(Math.max(0, line.quantity ?? 1));
      const ratePerUnit = round(Math.max(0, line.rate ?? 0));
      const gross = round(quantity * ratePerUnit);
      const discount = round(Math.max(0, line.discount ?? 0));
      const result = calculate({ scenario: resolved, rate: line.gstRate ?? line.ratePercent ?? 0, taxable: gross, discount, cessRate: line.cessRate ?? 0, kind, reverseCharge });
      return { ...line, id: line.id || `line-${index + 1}`, quantity, ratePerUnit, gross, discount, ...result };
    });
    const sum = field => round(calculatedLines.reduce((total, line) => total + (Number(line[field]) || 0), 0));
    const totalTaxable = sum('taxable');
    const totalCgst = sum('cgst');
    const totalSgst = sum('sgst');
    const totalIgst = sum('igst');
    const totalCess = sum('cess');
    const totalTax = sum('taxTotal');
    return {
      scenario: resolved, kind, reverseCharge: Boolean(reverseCharge), lines: calculatedLines,
      taxable: totalTaxable, cgst: totalCgst, sgst: totalSgst, igst: totalIgst, cess: totalCess,
      taxTotal: totalTax, total: round(totalTaxable + totalTax), hasTax: totalTax > 0,
      details: scenarios[resolved]
    };
  }

  return { scenarios, config, stateFromGSTIN, resolveScenario, calculate, calculateInvoice };
});
