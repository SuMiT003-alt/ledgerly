/* Small interactive GST decision desk embedded in the journal learning screen. */
(() => {
  const GST = window.LedgerlyGST;
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
  const $ = id => document.getElementById(id);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };
  let scenario = 'intra';

  function render() {
    const result = GST.calculate({ scenario, kind: $('gstLearningKind').value, taxable: Number($('gstLearningAmount').value) || 0, rate: Number($('gstLearningRate').value) || 0 });
    const purchase = result.kind === 'purchase';
    const taxPill = $('gstLearningTaxPill');
    taxPill.textContent = result.details.shortLabel;
    taxPill.className = `gst-learning-tax-pill ${scenario}`;
    $('gstLearningTotal').textContent = money(result.total);
    $('gstLearningResultLabel').textContent = purchase ? 'Purchase entry preview' : 'Sales entry preview';
    $('gstLearningCallout').replaceChildren(
      node('strong', '', scenario === 'intra' ? 'Same state = split the tax.' : scenario === 'inter' ? 'Different state = one integrated tax.' : 'Exempt / nil-rated = no GST line.'),
      node('p', '', scenario === 'intra'
        ? `Use CGST for the Centre and SGST for the State. At ${result.rate}%, each side is ${result.rate / 2}%.`
        : scenario === 'inter'
          ? `Use IGST at the full ${result.rate}% rate. Do not add CGST or SGST to the same supply.`
          : 'Record the sale or purchase at its actual value. Confirm that the item or service is genuinely exempt or nil-rated.')
    );
    const lines = [];
    if (purchase) {
      lines.push(['Purchases / expense', 'Dr', result.taxable]);
      if (result.cgst) lines.push(['Input CGST', 'Dr', result.cgst]);
      if (result.sgst) lines.push(['Input SGST', 'Dr', result.sgst]);
      if (result.igst) lines.push(['Input IGST', 'Dr', result.igst]);
      lines.push(['Supplier / Cash / Bank', 'Cr', result.total]);
    } else {
      lines.push(['Customer / Cash / Bank', 'Dr', result.total]);
      lines.push(['Sales / income', 'Cr', result.taxable]);
      if (result.cgst) lines.push(['Output CGST', 'Cr', result.cgst]);
      if (result.sgst) lines.push(['Output SGST', 'Cr', result.sgst]);
      if (result.igst) lines.push(['Output IGST', 'Cr', result.igst]);
    }
    $('gstLearningLines').replaceChildren(...lines.map(([label, side, amount]) => {
      const row = node('div', 'gst-learning-line');
      row.append(node('span', '', label), node('b', side === 'Dr' ? 'gst-debit' : 'gst-credit', side), node('strong', '', money(amount)));
      return row;
    }));
    $('gstLearningWhy').textContent = scenario === 'intra'
      ? `CGST and SGST are used because the ${purchase ? 'purchase' : 'supply'} stays within one state. GST is collected in two equal parts.`
      : scenario === 'inter'
        ? `IGST is used because the ${purchase ? 'purchase' : 'supply'} crosses a state boundary. The full tax goes through the integrated-tax ledger.`
        : 'No CGST, SGST or IGST is posted because this scenario is exempt or nil-rated.';
  }

  $$('[data-gst-scenario]').forEach(button => button.addEventListener('click', () => {
    scenario = button.dataset.gstScenario;
    $$('[data-gst-scenario]').forEach(item => item.setAttribute('aria-selected', String(item === button)));
    render();
  }));
  ['gstLearningKind', 'gstLearningAmount', 'gstLearningRate'].forEach(id => $(id).addEventListener('input', render));
  render();
})();
