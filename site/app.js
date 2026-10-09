(() => {
  const zh = {
    skip:'跳转到项目', homeLabel:'Bruce Liu，首页', navLabel:'主导航', languageLabel:'页面语言', navProjects:'项目', navFocus:'技术方向', navAbout:'关于', heroTitle:'Bruce Liu', heroIntro:'Python 服务、AI Agent，以及让它们真正有用的系统。这里记录开源项目、原型和实验。', seeProjects:'查看项目', githubProfile:'GitHub 主页', projectsKicker:'01 / 项目', projectsTitle:'开源贡献。', projectsNote:'为开源 Agent 生态贡献工具与工作流。', openSource:'开源项目', evoDescription:'一个自我演进的 AI Agent 生态。我的主要开源贡献方向，覆盖工具、工作流、记忆、MCP 与检索。', viewOnGithub:'在 GitHub 查看', activityKicker:'02 / 活跃记录', activityTitle:'GitHub 活动', refreshActivity:'刷新', activitySource:'在 GitHub 查看 ↗', graphLabel:'GitHub 贡献日历', focusKicker:'03 / 技术方向', focusTitle:'技术方向', focusNote:'这些方向贯穿我的仓库与实验项目。', focusAgent:'Agent 工程', focusRag:'检索系统', focusBackend:'Python 后端', focusPlatform:'平台与交付', aboutKicker:'04 / 关于', aboutTitle:'你好，我是 Bruce。', aboutText:'我主要使用 Python 构建服务、AI Agent 工作流和检索系统，也关注支撑它们的后端基础设施。这个页面记录我公开分享的项目与实验。', backToTop:'返回顶部 ↑'
  };
  const textNodes = [...document.querySelectorAll('[data-i18n]')];
  const ariaNodes = [...document.querySelectorAll('[data-i18n-aria]')];
  const en = Object.fromEntries(textNodes.map(n => [n.dataset.i18n, n.innerHTML]));
  for (const n of ariaNodes) en[n.dataset.i18nAria] = n.getAttribute('aria-label');
  let currentLanguage = 'en';
  let feedStatus = 'snapshot';
  let refreshing = false;
  let lastAttempt = 0;
  const refreshButton = document.getElementById('activity-refresh');
  function setLanguage(lang, updateUrl = false) {
    currentLanguage = lang;
    const dict = lang === 'zh' ? zh : en;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    for (const n of textNodes) if (dict[n.dataset.i18n] !== undefined) n.innerHTML = dict[n.dataset.i18n];
    for (const n of ariaNodes) if (dict[n.dataset.i18nAria] !== undefined) n.setAttribute('aria-label', dict[n.dataset.i18nAria]);
    for (const b of document.querySelectorAll('[data-language]')) b.setAttribute('aria-pressed', String(b.dataset.language === lang));
    document.title = lang === 'zh' ? 'Bruce Liu — GitHub 项目' : 'Bruce Liu — GitHub projects';
    document.querySelector('meta[name="description"]').content = lang === 'zh' ? 'Bruce Liu — AI Agent、RAG 与 Python 后端系统项目。' : 'Bruce Liu — GitHub projects in AI agents, RAG, and Python backend systems.';
    renderActivity(lang);
    try { localStorage.setItem('portfolio-language', lang); } catch {}
    if (updateUrl) { const u = new URL(location.href); u.searchParams.set('lang', lang); try { history.replaceState(null, '', u); } catch {} }
  }
  function renderActivity(lang) {
    const graph = document.querySelector('.activity-graph');
    const caption = document.querySelector('.activity-caption');
    const data = window.githubActivity;
    const days = data?.days;
    const summary = document.querySelector('.activity-summary');
    refreshButton.disabled = refreshing;
    graph.replaceChildren();
    if (!data || !Array.isArray(days) || !days.length) {
      caption.textContent = lang === 'zh' ? '暂时无法加载活动记录，请查看 GitHub 主页。' : 'Activity unavailable; visit my GitHub profile.';
      return;
    }
    const first = new Date(days[0].date + 'T00:00:00Z');
    const offset = first.getUTCDay();
    graph.style.setProperty('--weeks', Math.ceil((offset + days.length) / 7));
    for (let i = 0; i < offset; i++) {
      const blank = document.createElement('i'); blank.className = 'calendar-blank'; graph.appendChild(blank);
    }
    for (const day of days) {
      const cell = document.createElement('i');
      cell.dataset.level = day.level;
      cell.dataset.date = day.date;
      cell.dataset.count = day.count;
      cell.title = day.date + ': ' + day.count + (lang === 'zh' ? ' 次贡献' : ' contributions');
      graph.appendChild(cell);
    }
    const validScope = data.scope === 'account' || data.scope === 'public';
    const range = days[0].date + ' – ' + days[days.length - 1].date;
    const total = days.reduce((sum, day) => sum + day.count, 0);
    summary.textContent = lang === 'zh' ? total.toLocaleString('zh-CN') + ' 次贡献 · 最近一年' : total.toLocaleString('en-US') + ' contributions in the past year';
    if (data.scope === 'public') summary.textContent = lang === 'zh' ? total.toLocaleString('zh-CN') + ' 次公开贡献 · 最近一年' : total.toLocaleString('en-US') + ' public contributions in the past year';
    const updated = new Date(data.updatedAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {timeZone:'Asia/Shanghai', dateStyle:'medium', timeStyle:'short'});
    caption.textContent = range + ' · ' + (lang === 'zh' ? '数据更新于 ' : 'Data updated ') + updated + ' (UTC+8)';
    if (feedStatus === 'offline') caption.textContent += lang === 'zh' ? ' · 已保存快照' : ' · Saved snapshot';
    if (refreshing) caption.textContent += lang === 'zh' ? ' · 刷新中' : ' · Refreshing';
    graph.hidden = !validScope;
    if (!validScope) {
      summary.textContent = lang === 'zh' ? '当前记录不完整 · 等待包含私有贡献的同步' : 'Incomplete calendar · awaiting sync with private contributions';
      caption.textContent = lang === 'zh' ? '需要 GitHub 授权才能同步完整的贡献日历。' : 'GitHub authorization is required to sync the complete contribution calendar.';
    }
    graph.setAttribute('aria-label', summary.textContent + ' · ' + caption.textContent);
  }
  const query = new URLSearchParams(location.search).get('lang');
  let saved = 'en'; try { saved = localStorage.getItem('portfolio-language') || 'en'; } catch {}
  setLanguage(query === 'zh' || (!query && saved === 'zh') ? 'zh' : 'en');
  for (const b of document.querySelectorAll('[data-language]')) b.addEventListener('click', () => setLanguage(b.dataset.language, true));

  async function refreshActivity() {
    if (refreshing) return;
    lastAttempt = Date.now();
    refreshing = true;
    renderActivity(currentLanguage);
    try {
      const latest = await window.ActivityFeed.fetchLatest();
      window.githubActivity = latest;
      feedStatus = 'live';
    } catch {
      feedStatus = 'offline';
    } finally {
      refreshing = false;
      renderActivity(currentLanguage);
    }
  }
  refreshButton.addEventListener('click', refreshActivity);
  const refreshIfDue = () => {
    if (!document.hidden && Date.now() - lastAttempt >= 3600000) refreshActivity();
  };
  document.addEventListener('visibilitychange', refreshIfDue);
  setInterval(refreshIfDue, 60000);
  refreshActivity();
})();
