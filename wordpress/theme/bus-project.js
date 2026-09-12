(function () {
  'use strict';
  const cards = [...document.querySelectorAll('.current-panel-body, .bus-card-body')];
  const appeal = document.querySelector('.appeal');
  if ((!cards.length && !appeal) || !window.bkwBusProject) return;
  const endpoint = new URL(window.bkwBusProject.endpoint, location.href);
  if (endpoint.origin !== location.origin) return;
  const money = cents => (cents / 100).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2
  });
  const statusLabels = {active: 'Spendenaktion läuft', funded: 'Spendenziel erreicht',
    closed: 'Spendenaktion beendet', paused: 'Spenden derzeit pausiert'};
  const links = [...document.querySelectorAll('a[href]')].filter(a => {
    const url = new URL(a.href);
    return url.hostname === 'www.betterplace.org' && url.pathname.startsWith('/de/projects/184020-');
  });
  const linkLabels = links.map(a => a.innerHTML);
  let lastData = null;
  let nextAttempt = 0;
  let running = false;
  function setText(root, selector, text) {
    const element = root && root.querySelector(selector);
    if (element) element.textContent = text;
  }
  function dateLabel(data) {
    return new Date(data.fetched_at).toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
  function update(data) {
    const timestamp = 'Stand ' + dateLabel(data);
    const suffix = data.stale ? ' · Aktualisierung derzeit nicht möglich' : '';
    cards.forEach(card => {
      const status = card.classList.contains('bus-card-body') ? ' · ' + statusLabels[data.status] : '';
      setText(card, '.mini, .launcher-label', 'Betterplace · ' + timestamp + status + suffix);
      setText(card, '.current-progress-head span, .bus-progress-head b', money(data.donated_cents) + ' finanziert');
      setText(card, '.current-progress-head strong, .bus-progress-head span', data.percentage + ' %');
      const stats = card.querySelectorAll('.current-stats b, .bus-stats b');
      [money(data.goal_cents), money(data.open_cents), data.donations_count.toLocaleString('de-DE')]
        .forEach((value, i) => { if (stats[i]) stats[i].textContent = value; });
      setText(card, '.donation-security', statusLabels[data.status]);
    });
    setText(appeal, '.campaign-meta p', timestamp + ' · ' + money(data.donated_cents) +
      ' von ' + money(data.goal_cents) + ' finanziert · ' + statusLabels[data.status] + suffix);
    const value = appeal && appeal.querySelector('.pct');
    if (value) {
      value.dataset.target = String(data.percentage);
      value.textContent = data.percentage + ' %';
      appeal.style.setProperty('--bkw-progress', data.percentage + '%');
    }
    document.querySelectorAll('.current-progress, .campaign-meter, .bus-progress').forEach(bar => {
      bar.setAttribute('aria-valuenow', String(data.percentage));
      bar.setAttribute('aria-label', 'Busprojekt zu ' + data.percentage + ' Prozent finanziert');
      if (!bar.classList.contains('campaign-meter')) bar.querySelector('i').style.width = data.percentage + '%';
    });
    links.forEach((link, i) => {
      if (data.can_donate && !data.stale) link.innerHTML = linkLabels[i];
      else link.textContent = 'Projekt bei Betterplace ansehen ↗';
    });
  }
  function valid(data) {
    return data && data.project_id === 184020 &&
      ['donated_cents', 'goal_cents', 'open_cents', 'donations_count', 'percentage'].every(
        key => Number.isSafeInteger(data[key]) && data[key] >= 0) &&
      data.percentage <= 100 && data.goal_cents === data.donated_cents + data.open_cents &&
      Object.hasOwn(statusLabels, data.status) && typeof data.can_donate === 'boolean' &&
      typeof data.stale === 'boolean' && Number.isFinite(Date.parse(data.fetched_at));
  }
  async function refresh() {
    if (running || document.hidden || Date.now() < nextAttempt) return;
    running = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {cache: 'no-store', credentials: 'omit', signal: controller.signal});
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (!valid(data)) throw new Error('Invalid project data');
      // Also guard against a proxy serving a stale response despite no-store.
      data.stale = data.stale || Date.now() - Date.parse(data.fetched_at) > 16 * 60000;
      lastData = data;
      update(data);
      nextAttempt = Date.now() + (data.stale ? 60000 : 15 * 60000);
    } catch (_) {
      if (lastData) update({...lastData, stale: true});
      else {
        cards.forEach(card => setText(card, '.mini, .launcher-label', 'Betterplace · Stand 28.08.2026 · Aktualisierung derzeit nicht möglich'));
        setText(appeal, '.campaign-meta p', 'Stand 28.08.2026 · 2.440 € von 8.000 € finanziert · Aktualisierung derzeit nicht möglich');
        links.forEach(link => { link.textContent = 'Projekt bei Betterplace ansehen ↗'; });
      }
      nextAttempt = Date.now() + 60000;
    } finally {
      clearTimeout(timeout);
      running = false;
    }
  }
  refresh();
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', refresh);
})();
