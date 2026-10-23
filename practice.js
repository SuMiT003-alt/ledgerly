(() => {
  const SESSION_SIZE = 10;
  const STORAGE_KEY = 'ledgerly-practice-v1';
  const topicLabels = {
    all: 'Mixed practice', 'golden-rules': 'Golden rules', 'debit-credit': 'Debit & credit',
    'journal-entries': 'Journal entries', ledgers: 'Ledgers & balances',
    'tally-prime': 'Tally Prime', fundamentals: 'Accounting basics'
  };
  let stored = {};
  try { stored = JSON.parse(readStorage(STORAGE_KEY)) || {}; } catch {}
  const history = Array.isArray(stored.history) ? stored.history.filter(record =>
    record && typeof record.id === 'string' && Object.hasOwn(topicLabels, record.topic)
    && Number.isInteger(record.score) && record.score >= 0 && record.score <= SESSION_SIZE
    && Number.isFinite(Date.parse(record.date))
  ).slice(0, 20) : [];
  let mistakeNotebook = Array.isArray(stored.mistakes) ? stored.mistakes.filter(record =>
    record && typeof record.questionId === 'string' && typeof record.question === 'string'
      && typeof record.correct === 'string' && typeof record.explanation === 'string'
  ).slice(0, 30) : [];
  const topicStats = {};
  Object.keys(topicLabels).filter(topic => topic !== 'all').forEach(topic => {
    const saved = stored.topicStats?.[topic];
    topicStats[topic] = saved && Number.isInteger(saved.total) && saved.total >= 0
      && Number.isInteger(saved.correct) && saved.correct >= 0 && saved.correct <= saved.total
      ? { total: saved.total, correct: saved.correct } : { total: 0, correct: 0 };
  });
  let sessionCount = Number.isInteger(stored.sessionCount) && stored.sessionCount >= history.length
    ? stored.sessionCount : history.length;
  let bestScore = Number.isInteger(stored.bestScore) && stored.bestScore >= 0 && stored.bestScore <= SESSION_SIZE
    ? stored.bestScore : history.length ? Math.max(...history.map(record => record.score)) : null;
  let previousIds = Array.isArray(stored.previousIds)
    ? stored.previousIds.filter(id => typeof id === 'string').slice(0, SESSION_SIZE) : [];
  let bank = null;
  let session = null;
  let questionIndex = 0;
  let selectedOption = null;
  let answers = [];
  let loading = false;
  let active = false;
  let mistakesOnly = false;
  let storageAvailable = true;

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ history, mistakes: mistakeNotebook, topicStats, sessionCount, bestScore, previousIds }));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
    $('#quizBest').textContent = storageAvailable
      ? 'Scores stay on this browser · Basic examples state their GST and inventory assumptions'
      : 'Browser storage is unavailable — results will remain visible until you close or refresh this page.';
    window.dispatchEvent(new CustomEvent('ledgerly-practice-updated', { detail: { history, mistakes: mistakeNotebook, topicStats, sessionCount, bestScore } }));
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(new URL(`api/practice/${endpoint}`, document.baseURI), {
        ...options, signal: controller.signal, cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Question-bank request failed (${response.status}).`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function setNotice(message, error = false) {
    $('#practiceNotice').textContent = message;
    $('#practiceNotice').classList.toggle('error', error);
  }

  function renderStats() {
    $('#sessionCount').textContent = sessionCount;
    $('#practiceBest').textContent = bestScore ?? '—';
    $('#historyCount').textContent = `${history.length} saved`;
    $('#historyEmpty').hidden = history.length > 0;
    $('#historyTableWrap').hidden = history.length === 0;
    $('#historyBody').replaceChildren(...history.map(record => {
      const row = element('tr');
      const date = new Date(record.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      row.append(element('td', '', date), element('td', '', topicLabels[record.topic]), element('td', 'history-score', `${record.score} / ${SESSION_SIZE}`));
      return row;
    }));
    renderNotebook();
  }

  function renderNotebook() {
    $('#notebookCount').textContent = `${mistakeNotebook.length} to retry`;
    const questions = mistakeNotebook.map(mistake => {
      const article = element('article', 'notebook-question');
      article.append(element('span', 'section-kicker', mistake.topicLabel || 'Practice'), element('h5', '', mistake.question));
      const feedback = element('p', 'notebook-feedback');
      feedback.setAttribute('aria-live', 'polite');
      if (Array.isArray(mistake.options) && mistake.options.length === 4 && mistake.options.includes(mistake.correct)) {
        const choices = element('div', 'notebook-options');
        mistake.options.forEach(option => {
          const choice = element('button', '', option);
          choice.type = 'button';
          choice.addEventListener('click', () => {
            const correct = option === mistake.correct;
            feedback.textContent = correct ? `Mastered ✓ ${mistake.explanation}` : `Not yet. ${mistake.explanation}`;
            feedback.classList.toggle('error', !correct);
            if (correct) {
              mistakeNotebook = mistakeNotebook.filter(item => item.questionId !== mistake.questionId);
              [...choices.children].forEach(button => { button.disabled = true; });
              article.classList.add('mastered');
              $('#notebookCount').textContent = `${mistakeNotebook.length} to retry`;
              persist();
            }
          });
          choices.append(choice);
        });
        article.append(choices);
      } else {
        article.append(element('p', '', `Correct answer: ${mistake.correct}`), element('p', '', mistake.explanation));
        const archive = element('button', 'tiny-link', 'Reviewed — archive ✓');
        archive.type = 'button';
        archive.addEventListener('click', () => { mistakeNotebook = mistakeNotebook.filter(item => item.questionId !== mistake.questionId); persist(); renderNotebook(); });
        article.append(archive);
      }
      article.append(feedback);
      return article;
    });
    $('#notebookQuestions').replaceChildren(...(questions.length ? questions : [element('p', 'dashboard-empty', 'All clear. Missed questions from your next session will appear here.')]));
  }

  function updateControls() {
    $('#practiceTopic').disabled = active || loading || !bank;
    $('#practiceStart').disabled = active || loading;
    $('#practiceAgain').disabled = loading;
    $('#practiceStart').innerHTML = loading ? 'Loading your session…'
      : active ? 'Session in progress'
      : !bank ? 'Retry question bank <span>↻</span>'
      : session ? 'New random session <span>↻</span>' : 'Start 10-question session <span>→</span>';
  }

  async function loadBank() {
    const data = await request('bank');
    if (!Number.isInteger(data.total) || data.total < SESSION_SIZE || !Array.isArray(data.topics) || data.sessionSize !== SESSION_SIZE) {
      throw new Error('Invalid question bank.');
    }
    bank = data;
    $('#bankCount').textContent = data.total;
    $('#practiceTopic').replaceChildren(new Option(`Mixed practice · ${data.total} questions`, 'all'));
    $('#practiceTopics').replaceChildren(...data.topics.map(topic => {
      $('#practiceTopic').append(new Option(`${topic.label} · ${topic.count} questions`, topic.id));
      const chip = element('span', 'topic-chip');
      chip.append(element('span', '', topic.label), element('b', '', topic.count));
      return chip;
    }));
    setNotice('Mixed sessions cover all six topics. Each new session leaves out the previous set and shuffles the choices.');
  }

  function validSession(data) {
    return data && typeof data.id === 'string' && Array.isArray(data.questions) && data.questions.length === SESSION_SIZE
      && new Set(data.questions.map(question => question.id)).size === SESSION_SIZE
      && data.questions.every(question => typeof question.question === 'string' && typeof question.explanation === 'string'
        && Array.isArray(question.options) && question.options.length === 4 && question.options.every(option => typeof option === 'string')
        && Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
  }

  async function startSession() {
    if (loading || active) return;
    loading = true;
    updateControls();
    try {
      if (!bank) await loadBank();
      const topic = $('#practiceTopic').value;
      const data = await request('session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, excludeIds: previousIds })
      });
      if (!validSession(data)) throw new Error('Invalid practice session.');
      session = data;
      questionIndex = 0;
      answers = [];
      previousIds = session.questions.map(question => question.id);
      active = true;
      mistakesOnly = false;
      persist();
      $('#quizScore').textContent = '0';
      $('#practiceIntro').hidden = true;
      $('#sessionResults').hidden = true;
      $('#sessionPanel').hidden = false;
      setNotice(`${topicLabels[topic]} · 10 unique questions · Take your time and use the explanations.`);
      renderQuestion(true);
    } catch {
      setNotice('Could not connect to the practice database. Check the Ledgerly server is running, then retry.', true);
    } finally {
      loading = false;
      updateControls();
    }
  }

  function renderSteps() {
    $('#sessionSteps').replaceChildren(...session.questions.map((question, index) => {
      const answer = answers[index];
      const step = element('li', answer ? (answer.correct ? 'correct' : 'incorrect') : index === questionIndex ? 'current' : '', String(index + 1));
      step.setAttribute('aria-label', `Question ${index + 1}: ${answer ? (answer.correct ? 'correct' : 'incorrect') : index === questionIndex ? 'current' : 'not answered'}`);
      if (index === questionIndex) step.setAttribute('aria-current', 'step');
      return step;
    }));
    $('#quizProgress').style.width = `${answers.length / SESSION_SIZE * 100}%`;
    $('#sessionProgress').setAttribute('aria-valuenow', String(answers.length));
  }

  function selectOption(index) {
    if (!active || answers[questionIndex]) return;
    selectedOption = index;
    $$('.quiz-option').forEach((button, buttonIndex) => {
      const selected = index === buttonIndex;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('#nextQuestion').disabled = false;
  }

  function renderQuestion(focus = false) {
    const question = session.questions[questionIndex];
    selectedOption = null;
    $('#questionNumber').textContent = String(questionIndex + 1).padStart(2, '0');
    $('#quizTag').textContent = question.topicLabel;
    $('#quizQuestion').textContent = question.question;
    $('#quizOptions').replaceChildren(...question.options.map((option, index) => {
      const button = element('button', 'quiz-option');
      button.type = 'button';
      button.dataset.option = index;
      button.setAttribute('aria-pressed', 'false');
      button.append(element('span', 'option-letter', String.fromCharCode(65 + index)), element('span', 'option-text', option));
      button.addEventListener('click', () => selectOption(index));
      return button;
    }));
    $('#quizFeedback').textContent = '';
    $('#quizFeedback').className = 'quiz-feedback';
    $('#nextQuestion').disabled = true;
    $('#nextQuestion').innerHTML = 'Check answer <span>→</span>';
    renderSteps();
    if (focus) {
      $('#quizQuestion').focus({ preventScroll: true });
      $('#sessionPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function advanceSession() {
    if (!active) return;
    const question = session.questions[questionIndex];
    if (!answers[questionIndex]) {
      if (selectedOption === null) return;
      const correct = selectedOption === question.answer;
      answers.push({ selected: selectedOption, correct });
      $('#quizScore').textContent = answers.filter(answer => answer.correct).length;
      $$('.quiz-option').forEach((button, index) => {
        button.disabled = true;
        button.classList.toggle('correct', index === question.answer);
        button.classList.toggle('incorrect', index === selectedOption && !correct);
      });
      $('#quizFeedback').textContent = `${correct ? 'Correct!' : 'Not quite.'} ${question.explanation}`;
      $('#quizFeedback').classList.toggle('error', !correct);
      $('#nextQuestion').innerHTML = questionIndex === SESSION_SIZE - 1 ? 'See my results <span>✓</span>' : 'Next question <span>→</span>';
      renderSteps();
    } else if (questionIndex < SESSION_SIZE - 1) {
      questionIndex += 1;
      renderQuestion(true);
    } else {
      finishSession();
    }
  }

  function renderReview() {
    $('#reviewAll').setAttribute('aria-pressed', String(!mistakesOnly));
    $('#reviewMistakes').setAttribute('aria-pressed', String(mistakesOnly));
    const rows = session.questions.flatMap((question, index) => {
      const answer = answers[index];
      if (mistakesOnly && answer.correct) return [];
      const row = element('article', `review-item ${answer.correct ? 'correct' : 'incorrect'}`);
      const heading = element('div', 'review-item-heading');
      heading.append(element('span', 'review-number', String(index + 1).padStart(2, '0')), element('h5', '', question.question), element('span', 'review-result', answer.correct ? 'Correct ✓' : 'Review ↺'));
      row.append(heading, element('p', 'review-selected', `Your answer: ${question.options[answer.selected]}`));
      if (!answer.correct) row.append(element('p', 'review-correct', `Correct answer: ${question.options[question.answer]}`));
      row.append(element('p', 'review-explanation', question.explanation));
      return [row];
    });
    $('#answerReview').replaceChildren(...rows);
    $('#perfectReview').hidden = rows.length > 0;
  }

  function finishSession() {
    active = false;
    const score = answers.filter(answer => answer.correct).length;
    sessionCount += 1;
    bestScore = Math.max(bestScore ?? 0, score);
    history.unshift({ id: session.id, date: new Date().toISOString(), topic: session.topic, score });
    history.splice(20);
    const newMistakes = session.questions.flatMap((question, index) => {
      const answer = answers[index];
      if (answer.correct) return [];
      return [{
        questionId: question.id,
        topic: question.topic,
        topicLabel: question.topicLabel,
        question: question.question,
        selected: question.options[answer.selected],
        correct: question.options[question.answer],
        explanation: question.explanation,
        options: question.options.slice(),
        date: new Date().toISOString()
      }];
    });
    const answeredIds = new Set(session.questions.map(item => item.id));
    mistakeNotebook = [...newMistakes, ...mistakeNotebook.filter(item => !answeredIds.has(item.questionId))].slice(0, 30);
    session.questions.forEach((question, index) => {
      if (!topicStats[question.topic]) return;
      topicStats[question.topic].total += 1;
      if (answers[index].correct) topicStats[question.topic].correct += 1;
    });
    persist();
    renderStats();
    completeMilestone('quiz');
    $('#sessionPanel').hidden = true;
    $('#sessionResults').hidden = false;
    $('#resultTitle').textContent = score === 10 ? 'Beautifully balanced!' : score >= 7 ? 'Your confidence is growing.' : 'Every explanation is a step forward.';
    $('#resultSummary').textContent = `You answered ${score} of ${SESSION_SIZE} correctly in ${topicLabels[session.topic].toLowerCase()}. Review the explanations, then try a fresh set.`;
    $('#resultPercent').textContent = `${score * 10}%`;
    const topicScores = {};
    session.questions.forEach((question, index) => {
      const group = topicScores[question.topicLabel] ||= { correct: 0, total: 0 };
      group.total += 1;
      if (answers[index].correct) group.correct += 1;
    });
    $('#resultTopics').replaceChildren(...Object.entries(topicScores).map(([topic, scores]) => {
      const chip = element('span', 'topic-chip');
      chip.append(element('span', '', topic), element('b', '', `${scores.correct} / ${scores.total}`));
      return chip;
    }));
    mistakesOnly = false;
    renderReview();
    updateControls();
    setNotice(storageAvailable ? 'Session complete — your score is saved on this browser.' : 'Session complete — review your results below. Browser storage is unavailable.');
    $('#resultTitle').tabIndex = -1;
    $('#resultTitle').focus({ preventScroll: true });
    $('#sessionResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#practiceStart').addEventListener('click', startSession);
  $('#practiceAgain').addEventListener('click', startSession);
  $('#nextQuestion').addEventListener('click', advanceSession);
  $('#reviewAll').addEventListener('click', () => { mistakesOnly = false; renderReview(); });
  $('#reviewMistakes').addEventListener('click', () => { mistakesOnly = true; renderReview(); });
  window.addEventListener('keydown', event => {
    if (!active || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (!$('#sessionPanel').contains(document.activeElement)) return;
    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      selectOption(Number(event.key) - 1);
    } else if (event.key === 'Enter' && !['BUTTON', 'INPUT', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      advanceSession();
    }
  });

  async function initialize() {
    renderStats();
    persist();
    loading = true;
    updateControls();
    try {
      await loadBank();
    } catch {
      setNotice('The practice database is not reachable. Start Ledgerly with “python3 server.py”, then retry.', true);
    } finally {
      loading = false;
      updateControls();
    }
  }
  initialize();
})();
