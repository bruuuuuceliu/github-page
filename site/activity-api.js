(() => {
  function normalize(payload) {
    const sources = { account: 'https://api.github.com/graphql', public: 'https://github.com/users/bruuuuuceliu/contributions' };
    if (!payload || !sources[payload.scope] || payload.source !== sources[payload.scope] || !Number.isFinite(Date.parse(payload.updatedAt))) throw new Error('Calendar sync unavailable');
    function validate(days) {
      if (!Array.isArray(days) || days.length < 365) throw new Error('Incomplete calendar');
      let previous;
      for (const day of days) {
        const time = Date.parse(day.date + 'T00:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== day.date || !Number.isInteger(day.count) || day.count < 0 || !Number.isInteger(day.level) || day.level < 0 || day.level > 4 || (previous !== undefined && time - previous !== 86400000)) throw new Error('Invalid daily data');
        previous = time;
      }
      return days.reduce((sum, day) => sum + day.count, 0);
    }
    if (validate(payload.days) !== payload.total || validate(payload.allDays) !== payload.allTotal) throw new Error('Mismatched totals');
    const totals = {};
    const counts = new Map();
    for (const day of payload.allDays) {
      const year = day.date.slice(0, 4);
      totals[year] = (totals[year] || 0) + day.count;
      counts.set(day.date, day.count);
    }
    if (JSON.stringify(Object.entries(totals).sort()) !== JSON.stringify(Object.entries(payload.totals || {}).sort()) || payload.days.some(day => counts.get(day.date) !== day.count)) throw new Error('Calendar periods disagree');
    return payload;
  }
  async function fetchLatest() {
    // Fetch our validated build output; scope identifies public versus authenticated counts.
    if (location.protocol !== 'file:') {
      const response = await fetch('activity.json?t=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(15000), credentials: 'omit' });
      if (!response.ok) throw new Error('Snapshot unavailable');
      return normalize(await response.json());
    }
    // Direct file previews cannot fetch JSON. Reload the same local aggregate snapshot as a script.
    const previous = window.githubActivity;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('Snapshot timed out')), 15000);
      function finish(error) {
        clearTimeout(timer); script.remove();
        const latest = window.githubActivity;
        window.githubActivity = previous;
        if (error) return reject(error);
        try { resolve(normalize(latest)); } catch (failure) { reject(failure); }
      }
      script.src = 'activity-data.js?t=' + Date.now();
      script.onload = () => finish();
      script.onerror = () => finish(new Error('Snapshot unavailable'));
      document.head.appendChild(script);
    });
  }
  window.ActivityFeed = { normalize, fetchLatest };
})();
