/* Separates the learning desk from the practical tool workspace. */
(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const toolsWorkspace = $('#toolsWorkspace');
  const workWorkspace = $('#workWorkspace');
  const toolsPanels = $('#toolsPanels');
  const toolsTallyTabs = $('#toolsTallyTabs');
  const learningTabs = $('#learningTabs');
  const moduleOrientation = $('#moduleOrientation');
  const moduleNavigation = $('#moduleNavigation');
  const learningScreens = $$('[data-screen]');
  const toolTitles = { calculator: 'GST calculator', invoice: 'Invoice studio', reconciliation: 'Reconciliation desk', returns: 'Return preparation', registration: 'Registration desk', compliance: 'Compliance desk', coach: 'Document coach', entry: 'Tally entry trainer', shortcuts: 'Shortcut desk' };
  let mode = 'learn';

  function moveToolParts() {
    const tallySectionTabs = $('#tallySectionTabs');
    if (!tallySectionTabs || !toolsTallyTabs || !toolsPanels) return;
    $$('[data-tally-tab]', tallySectionTabs).filter(button => button.dataset.tallyTab !== 'guide').forEach(button => toolsTallyTabs.append(button));
    ['tallyEntryPanel', 'tallyCoachPanel', 'tallyShortcutsPanel', 'tallyMasterDialog'].forEach(id => {
      const element = document.getElementById(id);
      if (element) toolsPanels.append(element);
    });
  }

  function selectTool(tool) {
    const button = $(`#toolsTallyTabs [data-tally-tab="${tool}"]`);
    if (button) button.click();
    $$('.tool-launch-card').forEach(card => card.classList.toggle('active', card.dataset.toolLaunch === tool));
    $('#toolsSelectedTitle').textContent = toolTitles[tool] || 'Ledgerly tool';
  }

  function show(modeName) {
    mode = ['tools', 'work'].includes(modeName) ? modeName : 'learn';
    const tools = mode === 'tools';
    const work = mode === 'work';
    document.body.dataset.workspace = mode;
    toolsWorkspace.hidden = !tools;
    if (workWorkspace) workWorkspace.hidden = !work;
    learningTabs.hidden = tools || work;
    moduleOrientation.hidden = tools || work || !moduleOrientation.dataset.wasVisible;
    moduleNavigation.hidden = tools || work || !moduleNavigation.dataset.wasVisible;
    $('#learnModeButton').setAttribute('aria-selected', String(!tools && !work));
    $('#toolsModeButton').setAttribute('aria-selected', String(tools));
    $('#workModeButton')?.setAttribute('aria-selected', String(work));
    if (tools) {
      $('#currentModuleLabel').textContent = 'Practice';
      document.title = 'Practice — Ledgerly';
      learningScreens.forEach(screen => { screen.hidden = true; });
      selectTool('calculator');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (work) {
      $('#currentModuleLabel').textContent = 'Work';
      document.title = 'Work — Ledgerly';
      learningScreens.forEach(screen => { screen.hidden = true; });
      if (typeof window.openLedgerlyWork === 'function') window.openLedgerlyWork();
      else workWorkspace?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const active = $('.learning-tab.active')?.dataset.section || 'overview';
      $('#currentModuleLabel').textContent = $('.learning-tab.active .tab-label')?.textContent || 'Start here';
      document.title = `${$('#currentModuleLabel').textContent} — Ledgerly`;
      $('#tally-tab-guide')?.click();
      learningScreens.forEach(screen => { screen.hidden = screen.dataset.screen !== active; });
      if (active !== 'overview') {
        moduleOrientation.hidden = false;
        moduleNavigation.hidden = false;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  moveToolParts();
  moduleOrientation.dataset.wasVisible = 'false';
  moduleNavigation.dataset.wasVisible = 'false';
  $('#learnModeButton').addEventListener('click', () => show('learn'));
  $('#toolsModeButton').addEventListener('click', () => show('tools'));
  $('#workModeButton')?.addEventListener('click', () => show('work'));
  $$('.tool-launch-card').forEach(card => card.addEventListener('click', () => { show('tools'); selectTool(card.dataset.toolLaunch); }));
  $$('#toolsTallyTabs [data-tally-tab]').forEach(button => button.addEventListener('click', () => {
    const tool = button.dataset.tallyTab;
    $$('.tool-launch-card').forEach(card => card.classList.toggle('active', card.dataset.toolLaunch === tool));
    $('#toolsSelectedTitle').textContent = toolTitles[tool] || 'Ledgerly tool';
  }));
  window.showLedgerlyWorkspace = show;
})();
