(() => {
  'use strict';

  /* ============================================================
     Helpers
  ============================================================ */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEY = 'craftly.v1';

  const CURRENCIES = {
    RUB: { symbol: '₽',  label: 'Рубль' },
    USD: { symbol: '$',  label: 'Доллар' },
    EUR: { symbol: '€',  label: 'Евро' },
    KZT: { symbol: '₸',  label: 'Тенге' },
    UAH: { symbol: '₴',  label: 'Гривна' },
    GBP: { symbol: '£',  label: 'Фунт' },
    CNY: { symbol: '¥',  label: 'Юань' },
  };

  const STATUSES = [
    { id: 'new',      label: 'Новый' },
    { id: 'progress', label: 'В работе' },
    { id: 'review',   label: 'На проверке' },
    { id: 'done',     label: 'Готово' },
    { id: 'paid',     label: 'Оплачено' },
  ];
  const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s]));
  const STATUS_TONE = {
    new: 'accent', progress: 'yellow', review: 'accent',
    done: 'green', paid: 'green',
  };

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const fmt = {
    money(amount, currency, settings) {
      const cur = currency || settings.currency || 'RUB';
      const sym = CURRENCIES[cur]?.symbol || '';
      const n = Number(amount) || 0;
      const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
        .format(n);
      return `${formatted} ${sym}`.trim();
    },
    date(iso, settings) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d)) return '—';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return settings.dateFormat === 'YYYY-MM-DD'
        ? `${yyyy}-${mm}-${dd}`
        : `${dd}.${mm}.${yyyy}`;
    },
    dateTime(iso, settings) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d)) return '—';
      const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      return `${fmt.date(iso, settings)} ${time}`;
    },
    relative(iso) {
      const d = new Date(iso);
      const now = Date.now();
      const diff = Math.round((now - d.getTime()) / 1000);
      if (diff < 60) return 'только что';
      if (diff < 3600) return `${Math.floor(diff/60)} мин назад`;
      if (diff < 86400) return `${Math.floor(diff/3600)} ч назад`;
      if (diff < 86400 * 7) return `${Math.floor(diff/86400)} дн назад`;
      return fmt.date(iso, state.settings);
    },
    monthKey(iso) {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    },
    monthName(iso) {
      const d = new Date(iso);
      const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
      return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
    },
    initials(name) {
      if (!name) return '?';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
    },
    deadlineTone(iso) {
      if (!iso) return 'gray';
      const today = new Date(); today.setHours(0,0,0,0);
      const d = new Date(iso); d.setHours(0,0,0,0);
      const diff = Math.round((d - today) / 86400000);
      if (diff < 0) return 'red';
      if (diff <= 2) return 'red';
      if (diff <= 7) return 'yellow';
      return 'green';
    },
    deadlineLabel(iso) {
      if (!iso) return '—';
      const today = new Date(); today.setHours(0,0,0,0);
      const d = new Date(iso); d.setHours(0,0,0,0);
      const diff = Math.round((d - today) / 86400000);
      if (diff < 0) return `просрочен на ${-diff} дн`;
      if (diff === 0) return 'сегодня';
      if (diff === 1) return 'завтра';
      if (diff <= 7) return `через ${diff} дн`;
      return fmt.date(iso, state.settings);
    },
  };

  const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]));

  /* ============================================================
     Icons
  ============================================================ */
  const icon = (name, size = 16) => {
    const paths = {
      plus:      '<path d="M12 5v14M5 12h14"/>',
      edit:      '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      trash:     '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
      arrowLeft: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
      arrowRight:'<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
      close:     '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
      check:     '<path d="M20 6 9 17l-5-5"/>',
      alert:     '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
      info:      '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
      search:    '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
      download:  '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
      upload:    '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/>',
      settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
      inbox:     '<path d="M3 12h4l2 3h6l2-3h4"/><path d="M5 5h14l2 7v7H3v-7Z"/>',
      users:     '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M17 11a4 4 0 0 1 0 8"/>',
      wallet:    '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14" r="1.5"/>',
      chart:     '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
      calendar:  '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/>',
      board:     '<rect x="3" y="4" width="7" height="16"/><rect x="14" y="4" width="7" height="10"/>',
      list:      '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  };

  /* ============================================================
     State
  ============================================================ */
  let state = {
    clients: [],
    orders: [],
    settings: { currency: 'RUB', dateFormat: 'DD.MM.YYYY', theme: 'light' },
    events: [],
  };

  let ui = {
    route: 'dashboard',
    ordersView: 'board',   // board | list
    filters: { status: 'all', clientId: 'all', sort: 'createdAt', dir: 'desc', query: '' },
    financeFilters: { clientId: 'all', from: '', to: '' },
    editingOrderId: null,
    editingClientId: null,
    draggingId: null,
    searchOpen: false,
  };

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        clients: state.clients,
        orders: state.orders,
        settings: state.settings,
        events: state.events.slice(0, 100),
      }));
    } catch (e) { console.warn('save failed', e); }
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.clients = Array.isArray(data.clients) ? data.clients : [];
      state.orders  = Array.isArray(data.orders) ? data.orders : [];
      state.settings = Object.assign({ currency: 'RUB', dateFormat: 'DD.MM.YYYY', theme: 'light' }, data.settings || {});
      state.events  = Array.isArray(data.events) ? data.events : [];
      return true;
    } catch (e) {
      console.warn('load failed', e);
      return false;
    }
  };

  const pushEvent = (type, payload) => {
    state.events.unshift({ id: uid(), type, payload, at: new Date().toISOString() });
    state.events = state.events.slice(0, 100);
  };

  /* ============================================================
     Business helpers
  ============================================================ */
  const clientById = id => state.clients.find(c => c.id === id);
  const orderById  = id => state.orders.find(o => o.id === id);

  const activeOrders = () => state.orders.filter(o => o.status !== 'paid');

  const monthRevenue = (date = new Date()) => {
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    return state.orders
      .filter(o => o.status === 'paid' && o.paidAt && fmt.monthKey(o.paidAt) === key)
      .reduce((s, o) => s + Number(o.amount || 0), 0);
  };

  const totalPaid = () => state.orders
    .filter(o => o.status === 'paid')
    .reduce((s, o) => s + Number(o.amount || 0), 0);

  const avgCheck = () => {
    const paid = state.orders.filter(o => o.status === 'paid');
    if (!paid.length) return 0;
    return paid.reduce((s, o) => s + Number(o.amount || 0), 0) / paid.length;
  };

  const clientStats = (clientId) => {
    const orders = state.orders.filter(o => o.clientId === clientId);
    const total = orders.filter(o => o.status === 'paid')
      .reduce((s, o) => s + Number(o.amount || 0), 0);
    const last = orders.length
      ? orders.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt
      : null;
    return { count: orders.length, total, last };
  };

  const monthKeyNow = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };

  /* ============================================================
     Progress / Toast / Modal
  ============================================================ */
  const progress = (() => {
    const el = $('#progress');
    const bar = $('.progress__bar', el);
    let timer;
    return {
      start() {
        el.classList.add('is-active');
        bar.style.width = '15%';
        clearInterval(timer);
        timer = setInterval(() => {
          const w = parseFloat(bar.style.width) || 15;
          bar.style.width = Math.min(w + Math.random() * 12, 90) + '%';
        }, 180);
      },
      done() {
        clearInterval(timer);
        bar.style.width = '100%';
        setTimeout(() => {
          el.classList.remove('is-active');
          bar.style.width = '0%';
        }, 300);
      },
    };
  })();

  const toast = (message, type = 'info') => {
    const root = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    const icons = { success: 'check', error: 'alert', info: 'info' };
    el.innerHTML = `
      <span class="toast__icon">${icon(icons[type] || 'info', 16)}</span>
      <span>${escapeHtml(message)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 220);
    }, 2600);
  };

  const modal = (() => {
    const root = $('#modals');
    let current = null;

    const close = () => {
      if (!current) return;
      const el = current;
      current = null;
      el.style.animation = 'fadeIn .15s reverse both';
      setTimeout(() => el.remove(), 140);
    };

    const open = (contentHTML, { onMount } = {}) => {
      close();
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = contentHTML;
      root.appendChild(wrap);
      current = wrap;

      wrap.addEventListener('mousedown', (e) => {
        if (e.target === wrap) close();
      });

      const first = wrap.querySelector('input, select, textarea, button');
      setTimeout(() => first && first.focus(), 50);

      onMount && onMount(wrap, close);
      return { close, wrap };
    };

    return { open, close, isOpen: () => !!current };
  })();

  /* ============================================================
     Router
  ============================================================ */
  const routes = ['dashboard', 'orders', 'clients', 'finance', 'settings'];

  const navigate = (route, opts = {}) => {
    if (!routes.includes(route)) route = 'dashboard';
    ui.route = route;
    if (opts.ordersView) ui.ordersView = opts.ordersView;
    if (opts.filters) ui.filters = Object.assign({}, ui.filters, opts.filters);
    if (opts.financeFilters) ui.financeFilters = Object.assign({}, ui.financeFilters, opts.financeFilters);
    history.replaceState(null, '', `#${route}`);
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ============================================================
     Reveal on scroll
  ============================================================ */
  const setupReveal = () => {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });
    els.forEach(el => io.observe(el));
  };

  /* ============================================================
     Renders — Dashboard
  ============================================================ */
  const renderDashboard = () => {
    const active = activeOrders();
    const monthRev = monthRevenue();
    const avg = avgCheck();
    const load = active.length;

    const statusCounts = STATUSES.map(s => ({
      ...s,
      count: state.orders.filter(o => o.status === s.id).length,
    }));
    const maxCount = Math.max(1, ...statusCounts.map(s => s.count));

    const upcoming = active
      .filter(o => o.deadline)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .slice(0, 5);

    const events = state.events.slice(0, 8);

    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">Дашборд</h1>
          <p class="page-sub">CRM для фрилансера: клиенты, заказы, деньги</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn--ghost" data-action="new-client">${icon('plus')} Клиент</button>
          <button class="btn btn--primary" data-action="new-order">${icon('plus')} Новый заказ</button>
        </div>
      </div>

      <div class="metrics">
        <div class="metric reveal">
          <div class="metric__label">Активные заказы</div>
          <div class="metric__value">${active.length}</div>
          <div class="metric__hint">Все, кроме оплаченных</div>
        </div>
        <div class="metric reveal">
          <div class="metric__label">Доход за месяц</div>
          <div class="metric__value">${fmt.money(monthRev, null, state.settings)}</div>
          <div class="metric__hint metric__hint--pos">оплачено в этом месяце</div>
        </div>
        <div class="metric reveal">
          <div class="metric__label">Средний чек</div>
          <div class="metric__value">${fmt.money(avg, null, state.settings)}</div>
          <div class="metric__hint">по оплаченным заказам</div>
        </div>
        <div class="metric reveal">
          <div class="metric__label">Загрузка</div>
          <div class="metric__value">${load} / 30</div>
          <div class="metric__hint">${load > 15 ? 'высокая' : load > 8 ? 'умеренная' : 'низкая'} загрузка</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel reveal">
          <div class="panel__head">
            <div>
              <div class="panel__title">Доход по месяцам</div>
              <div class="panel__sub">последние 12 месяцев</div>
            </div>
          </div>
          <div class="panel__body">${renderRevenueChart()}</div>
        </div>
        <div class="panel reveal">
          <div class="panel__head">
            <div class="panel__title">Воронка статусов</div>
            <div class="panel__sub">сколько заказов в каждом статусе</div>
          </div>
          <div class="panel__body">
            <div class="funnel">
              ${statusCounts.map(s => `
                <div class="funnel__row">
                  <div class="funnel__label">${s.label}</div>
                  <div class="funnel__bar"><div class="funnel__fill" style="width:${Math.round(s.count / maxCount * 100)}%"></div></div>
                  <div class="funnel__count">${s.count}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel reveal">
          <div class="panel__head">
            <div class="panel__title">Ближайшие дедлайны</div>
            <div class="panel__sub">топ-5 по срокам</div>
          </div>
          <div class="panel__body">
            ${upcoming.length ? `
              <div class="deadlines">
                ${upcoming.map(o => {
                  const c = clientById(o.clientId);
                  const tone = fmt.deadlineTone(o.deadline);
                  return `
                    <div class="deadline">
                      <div style="min-width:0;">
                        <div class="deadline__title">${escapeHtml(o.title)}</div>
                        <div class="deadline__meta">${c ? escapeHtml(c.name) : 'Без клиента'} · ${fmt.money(o.amount, o.currency, state.settings)}</div>
                      </div>
                      <span class="pill pill--${tone}">${fmt.deadlineLabel(o.deadline)}</span>
                    </div>`;
                }).join('')}
              </div>
            ` : emptyState('Нет активных дедлайнов', 'Создайте заказ с дедлайном', 'new-order', 'Создать заказ')}
          </div>
        </div>

        <div class="panel reveal">
          <div class="panel__head">
            <div class="panel__title">Лента событий</div>
            <div class="panel__sub">последние изменения</div>
          </div>
          <div class="panel__body">
            ${events.length ? `
              <div class="feed">
                ${events.map(e => `
                  <div class="feed__item">
                    <span class="feed__dot"></span>
                    <div>
                      <div class="feed__text">${describeEvent(e)}</div>
                      <div class="feed__time">${fmt.relative(e.at)}</div>
                    </div>
                  </div>`).join('')}
              </div>
            ` : emptyState('Пока нет событий', 'Создайте клиента или заказ', 'new-client', 'Добавить клиента')}
          </div>
        </div>
      </div>
    `;
  };

  const renderRevenueChart = () => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const sum = state.orders
        .filter(o => o.status === 'paid' && o.paidAt && fmt.monthKey(o.paidAt) === key)
        .reduce((s, o) => s + Number(o.amount || 0), 0);
      months.push({ key, label: fmt.monthName(d), sum });
    }
    const max = Math.max(1, ...months.map(m => m.sum));
    const W = 720, H = 260, padL = 44, padB = 34, padT = 16, padR = 14;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const stepX = innerW / months.length;
    const barW = Math.min(38, stepX * 0.6);

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => {
      const y = padT + innerH * (1 - p);
      return `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
    }).join('');

    const yLabels = [0, 0.25, 0.5, 0.75, 1].map(p => {
      const y = padT + innerH * (1 - p);
      const val = Math.round(max * p);
      return `<text x="${padL - 8}" y="${y + 3}" text-anchor="end">${val >= 1000 ? Math.round(val/1000) + 'k' : val}</text>`;
    }).join('');

    const bars = months.map((m, i) => {
      const x = padL + stepX * i + (stepX - barW) / 2;
      const h = (m.sum / max) * innerH;
      const y = padT + innerH - h;
      const isCurrent = i === months.length - 1;
      return `
        <rect class="bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="4" ${isCurrent ? 'fill-opacity="1"' : 'fill-opacity="0.85'"}>
          <title>${m.label}: ${fmt.money(m.sum, null, state.settings)}</title>
        </rect>
        <text x="${x + barW/2}" y="${H - 14}" text-anchor="middle">${m.label}</text>
      `;
    }).join('');

    if (!months.some(m => m.sum > 0)) {
      return `<div class="empty" style="padding:60px 20px;">
        ${icon('chart', 40)}
        <div class="empty__title">Нет данных о доходе</div>
        <div class="empty__text">Отметьте заказы как оплаченные</div>
      </div>`;
    }

    return `
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Доход по месяцам">
        ${gridLines}
        ${yLabels}
        ${bars}
      </svg>`;
  };

  const describeEvent = (e) => {
    const p = e.payload || {};
    switch (e.type) {
      case 'order.created':  return `Новый заказ: ${escapeHtml(p.title || '')}`;
      case 'order.status':   return `Заказ «${escapeHtml(p.title || '')}» → ${STATUS_MAP[p.status]?.label || p.status}`;
      case 'order.paid':     return `Заказ «${escapeHtml(p.title || '')}» оплачен`;
      case 'order.deleted':  return `Удалён заказ «${escapeHtml(p.title || '')}»`;
      case 'order.updated':  return `Изменён заказ «${escapeHtml(p.title || '')}»`;
      case 'client.created': return `Новый клиент: ${escapeHtml(p.name || '')}`;
      case 'client.updated': return `Изменён клиент: ${escapeHtml(p.name || '')}`;
      case 'client.archived':return `Клиент архивирован: ${escapeHtml(p.name || '')}`;
      default: return 'Событие';
    }
  };

  /* ============================================================
     Renders — Orders
  ============================================================ */
  const filterOrders = () => {
    let list = state.orders.slice();
    const f = ui.filters;
    if (f.status !== 'all') list = list.filter(o => o.status === f.status);
    if (f.clientId !== 'all') list = list.filter(o => o.clientId === f.clientId);
    if (f.query) {
      const q = f.query.toLowerCase();
      list = list.filter(o =>
        (o.title || '').toLowerCase().includes(q) ||
        (o.description || '').toLowerCase().includes(q) ||
        (o.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    const dir = f.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let av, bv;
      switch (f.sort) {
        case 'amount': av = Number(a.amount||0); bv = Number(b.amount||0); break;
        case 'deadline': av = a.deadline || '9999'; bv = b.deadline || '9999'; break;
        case 'status': av = STATUSES.findIndex(s=>s.id===a.status); bv = STATUSES.findIndex(s=>s.id===b.status); break;
        case 'title': av = (a.title||'').toLowerCase(); bv = (b.title||'').toLowerCase(); break;
        default: av = a.createdAt || ''; bv = b.createdAt || '';
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  };

  const renderOrders = () => {
    const list = filterOrders();
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">Заказы</h1>
          <p class="page-sub">${state.orders.length} всего · ${activeOrders().length} активных</p>
        </div>
        <button class="btn btn--primary" data-action="new-order">${icon('plus')} Новый заказ</button>
      </div>

      <div class="toolbar">
        <div class="seg" role="tablist" aria-label="Вид">
          <button class="seg__btn ${ui.ordersView==='board'?'is-active':''}" data-action="view-board" role="tab" aria-selected="${ui.ordersView==='board'}">${icon('board',14)} Доска</button>
          <button class="seg__btn ${ui.ordersView==='list'?'is-active':''}" data-action="view-list" role="tab" aria-selected="${ui.ordersView==='list'}">${icon('list',14)} Список</button>
        </div>
        <div class="toolbar__spacer"></div>
        <div class="field" style="min-width:180px;">
          <select class="select select--sm" data-action="filter-client" aria-label="Клиент">
            <option value="all">Все клиенты</option>
            ${state.clients.map(c => `<option value="${c.id}" ${ui.filters.clientId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="min-width:160px;">
          <select class="select select--sm" data-action="filter-status" aria-label="Статус">
            <option value="all">Все статусы</option>
            ${STATUSES.map(s => `<option value="${s.id}" ${ui.filters.status===s.id?'selected':''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>

      ${ui.ordersView === 'board'
        ? renderKanban(list)
        : renderOrdersTable(list)}
    `;
  };

  const renderKanban = (list) => {
    return `
      <div class="kanban" role="list">
        ${STATUSES.map(s => {
          const items = list.filter(o => o.status === s.id);
          return `
            <div class="column" data-status="${s.id}" role="listitem">
              <div class="column__head">
                <span class="column__title">${s.label}</span>
                <span class="column__count">${items.length}</span>
              </div>
              <div class="column__list" data-dropzone="${s.id}">
                ${items.map(o => renderCard(o)).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>
    `;
  };

  const renderCard = (o) => {
    const c = clientById(o.clientId);
    const tone = fmt.deadlineTone(o.deadline);
    return `
      <div class="card" draggable="true" data-order-id="${o.id}" tabindex="0" role="button" aria-label="Заказ ${escapeHtml(o.title)}">
        <div class="card__title">${escapeHtml(o.title)}</div>
        <div class="card__row">
          <span class="avatar">${fmt.initials(c?.name || '?')}</span>
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c?.name || 'Без клиента')}</span>
        </div>
        <div class="card__row">
          <span class="card__amount">${fmt.money(o.amount, o.currency, state.settings)}</span>
        </div>
        ${o.deadline ? `<div class="card__row"><span class="pill pill--${tone}">${icon('calendar',12)} ${fmt.deadlineLabel(o.deadline)}</span></div>` : ''}
        ${(o.tags && o.tags.length) ? `<div class="card__tags">${o.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="card__actions">
          <button class="icon-btn" data-action="move-prev" data-id="${o.id}" aria-label="Влево">${icon('arrowLeft',14)}</button>
          <button class="icon-btn" data-action="edit-order" data-id="${o.id}" aria-label="Редактировать">${icon('edit',14)}</button>
          <button class="icon-btn" data-action="move-next" data-id="${o.id}" aria-label="Вправо">${icon('arrowRight',14)}</button>
          <button class="icon-btn" data-action="delete-order" data-id="${o.id}" aria-label="Удалить">${icon('trash',14)}</button>
        </div>
      </div>
    `;
  };

  const renderOrdersTable = (list) => {
    if (!list.length) return emptyState('Заказов не найдено', 'Измените фильтры или создайте заказ', 'new-order', 'Создать заказ');
    const sortIcon = (key) => {
      if (ui.filters.sort !== key) return '';
      return ui.filters.dir === 'asc' ? ' ↑' : ' ↓';
    };
    return `
      <div class="panel">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th data-action="sort" data-key="title">Название${sortIcon('title')}</th>
                <th>Клиент</th>
                <th data-action="sort" data-key="status">Статус${sortIcon('status')}</th>
                <th class="num" data-action="sort" data-key="amount">Сумма${sortIcon('amount')}</th>
                <th data-action="sort" data-key="deadline">Дедлайн${sortIcon('deadline')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(o => {
                const c = clientById(o.clientId);
                const tone = fmt.deadlineTone(o.deadline);
                return `
                  <tr>
                    <td><strong>${escapeHtml(o.title)}</strong></td>
                    <td>
                      <span style="display:inline-flex;align-items:center;gap:8px;">
                        <span class="avatar">${fmt.initials(c?.name || '?')}</span>
                        ${escapeHtml(c?.name || '—')}
                      </span>
                    </td>
                    <td><span class="pill pill--${STATUS_TONE[o.status]}">${STATUS_MAP[o.status]?.label || o.status}</span></td>
                    <td class="num">${fmt.money(o.amount, o.currency, state.settings)}</td>
                    <td>${o.deadline ? `<span class="pill pill--${tone}">${fmt.date(o.deadline, state.settings)}</span>` : '—'}</td>
                    <td>
                      <div style="display:flex;gap:4px;">
                        <button class="icon-btn" data-action="edit-order" data-id="${o.id}" aria-label="Редактировать">${icon('edit',14)}</button>
                        <button class="icon-btn" data-action="delete-order" data-id="${o.id}" aria-label="Удалить">${icon('trash',14)}</button>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  /* ============================================================
     Renders — Clients
  ============================================================ */
  const renderClients = () => {
    const clients = state.clients.filter(c => !c.archived);
    const archived = state.clients.filter(c => c.archived);
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">Клиенты</h1>
          <p class="page-sub">${clients.length} активных · ${archived.length} в архиве</p>
        </div>
        <button class="btn btn--primary" data-action="new-client">${icon('plus')} Новый клиент</button>
      </div>

      ${clients.length ? `
        <div class="clients">
          ${clients.map(c => renderClientCard(c)).join('')}
        </div>
      ` : emptyState('Нет клиентов', 'Добавьте первого клиента, чтобы начать', 'new-client', 'Добавить клиента')}

      ${archived.length ? `
        <div class="panel reveal" style="margin-top:22px;">
          <div class="panel__head"><div class="panel__title">Архив</div><div class="panel__sub">${archived.length}</div></div>
          <div class="panel__body">
            <div class="clients">
              ${archived.map(c => renderClientCard(c, true)).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    `;
  };

  const renderClientCard = (c, isArchived = false) => {
    const stats = clientStats(c.id);
    return `
      <div class="client-card reveal">
        <div class="client-card__head">
          <span class="avatar avatar--lg">${fmt.initials(c.name)}</span>
          <div style="min-width:0;">
            <div class="client-card__name">${escapeHtml(c.name)}</div>
            ${c.company ? `<div class="client-card__company">${escapeHtml(c.company)}</div>` : ''}
          </div>
        </div>
        ${c.contact ? `<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;font-family:var(--mono);">${escapeHtml(c.contact)}</div>` : ''}
        <div class="client-card__stats">
          <div><div class="client-card__stat-label">Заказов</div><div class="client-card__stat-value">${stats.count}</div></div>
          <div><div class="client-card__stat-label">Оплачено</div><div class="client-card__stat-value">${fmt.money(stats.total, null, state.settings)}</div></div>
          <div style="grid-column:1/-1;"><div class="client-card__stat-label">Последний заказ</div><div class="client-card__stat-value">${stats.last ? fmt.date(stats.last, state.settings) : '—'}</div></div>
        </div>
        ${c.notes ? `<div style="font-size:12.5px;color:var(--text-2);margin-top:10px;border-left:2px solid var(--border);padding-left:8px;">${escapeHtml(c.notes)}</div>` : ''}
        <div class="client-card__actions">
          <button class="btn btn--ghost btn--sm" data-action="client-orders" data-id="${c.id}">Заказы</button>
          <button class="btn btn--ghost btn--sm" data-action="edit-client" data-id="${c.id}">${icon('edit',12)}</button>
          ${isArchived
            ? `<button class="btn btn--ghost btn--sm" data-action="unarchive-client" data-id="${c.id}">Вернуть</button>`
            : `<button class="btn btn--ghost btn--sm" data-action="archive-client" data-id="${c.id}">Архив</button>`}
        </div>
      </div>
    `;
  };

  /* ============================================================
     Renders — Finance
  ============================================================ */
  const renderFinance = () => {
    const ff = ui.financeFilters;
    let paid = state.orders.filter(o => o.status === 'paid' && o.paidAt);
    if (ff.clientId !== 'all') paid = paid.filter(o => o.clientId === ff.clientId);
    if (ff.from) paid = paid.filter(o => o.paidAt >= ff.from);
    if (ff.to)   paid = paid.filter(o => o.paidAt <= ff.to + 'T23:59:59');

    paid.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));

    const groups = {};
    paid.forEach(o => {
      const k = fmt.monthKey(o.paidAt);
      if (!groups[k]) groups[k] = { key: k, label: fmt.monthName(o.paidAt), items: [], sum: 0 };
      groups[k].items.push(o);
      groups[k].sum += Number(o.amount || 0);
    });
    const groupList = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));

    const totalAll = paid.reduce((s, o) => s + Number(o.amount||0), 0);
    const totalMonth = monthRevenue();

    // top-3 clients
    const clientTotals = {};
    state.orders.filter(o => o.status === 'paid').forEach(o => {
      if (!o.clientId) return;
      clientTotals[o.clientId] = (clientTotals[o.clientId] || 0) + Number(o.amount||0);
    });
    const top3 = Object.entries(clientTotals)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, sum]) => ({ client: clientById(id), sum }))
      .filter(x => x.client);

    // months chart
    const monthsData = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const sum = state.orders
        .filter(o => o.status === 'paid' && o.paidAt && fmt.monthKey(o.paidAt) === key)
        .reduce((s, o) => s + Number(o.amount || 0), 0);
      monthsData.push({ label: fmt.monthName(d), sum });
    }

    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">Финансы</h1>
          <p class="page-sub">Оплаченные заказы и доход</p>
        </div>
        <button class="btn btn--ghost" data-action="export-csv">${icon('download')} Экспорт CSV</button>
      </div>

      <div class="fin-summary">
        <div class="metric reveal">
          <div class="metric__label">За всё время</div>
          <div class="metric__value">${fmt.money(totalAll, null, state.settings)}</div>
          <div class="metric__hint">${paid.length} оплаченных заказов</div>
        </div>
        <div class="metric reveal">
          <div class="metric__label">Текущий месяц</div>
          <div class="metric__value">${fmt.money(totalMonth, null, state.settings)}</div>
          <div class="metric__hint">с начала месяца</div>
        </div>
        <div class="metric reveal">
          <div class="metric__label">Топ-клиент</div>
          <div class="metric__value" style="font-size:18px;">${top3[0] ? escapeHtml(top3[0].client.name) : '—'}</div>
          <div class="metric__hint">${top3[0] ? fmt.money(top3[0].sum, null, state.settings) : 'нет данных'}</div>
        </div>
      </div>

      <div class="panel reveal" style="margin-bottom:22px;">
        <div class="panel__head">
          <div class="panel__title">Доход по месяцам</div>
          <div class="panel__sub">12 месяцев</div>
        </div>
        <div class="panel__body">
          ${renderFinanceChart(monthsData)}
        </div>
      </div>

      <div class="panel reveal" style="margin-bottom:22px;">
        <div class="panel__head">
          <div class="panel__title">Фильтры</div>
        </div>
        <div class="panel__body">
          <div class="form-grid">
            <div class="field">
              <label class="field__label">Клиент</label>
              <select class="select" data-action="finance-client">
                <option value="all">Все клиенты</option>
                ${state.clients.map(c => `<option value="${c.id}" ${ff.clientId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field__label">С</label>
              <input class="input" type="date" data-action="finance-from" value="${ff.from || ''}" />
            </div>
            <div class="field">
              <label class="field__label">По</label>
              <input class="input" type="date" data-action="finance-to" value="${ff.to || ''}" />
            </div>
          </div>
        </div>
      </div>

      <div class="panel reveal">
        <div class="panel__head">
          <div class="panel__title">Оплаченные заказы</div>
          <div class="panel__sub">${paid.length}</div>
        </div>
        <div class="panel__body">
          ${groupList.length ? groupList.map(g => `
            <div class="month-group">
              <div class="month-group__head">
                <div class="month-group__name">${g.label}</div>
                <div class="month-group__sum">${fmt.money(g.sum, null, state.settings)}</div>
              </div>
              <div class="table-wrap">
                <table class="data">
                  <thead><tr><th>Заказ</th><th>Клиент</th><th>Оплачен</th><th class="num">Сумма</th></tr></thead>
                  <tbody>
                    ${g.items.map(o => {
                      const c = clientById(o.clientId);
                      return `
                        <tr>
                          <td>${escapeHtml(o.title)}</td>
                          <td>${c ? escapeHtml(c.name) : '—'}</td>
                          <td>${fmt.date(o.paidAt, state.settings)}</td>
                          <td class="num">${fmt.money(o.amount, o.currency, state.settings)}</td>
                        </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `).join('') : emptyState('Пока нет оплаченных заказов', 'Переведите заказ в статус «Оплачено»', 'new-order', 'Создать заказ')}
        </div>
      </div>

      ${top3.length ? `
        <div class="panel reveal" style="margin-top:22px;">
          <div class="panel__head"><div class="panel__title">Топ-3 клиента</div><div class="panel__sub">по сумме оплат</div></div>
          <div class="panel__body">
            ${top3.map((t, i) => `
              <div class="deadline">
                <div style="display:flex;align-items:center;gap:12px;">
                  <span class="avatar">${fmt.initials(t.client.name)}</span>
                  <div>
                    <div class="deadline__title">${i+1}. ${escapeHtml(t.client.name)}</div>
                    <div class="deadline__meta">${escapeHtml(t.client.company || '')}</div>
                  </div>
                </div>
                <div class="card__amount">${fmt.money(t.sum, null, state.settings)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  };

  const renderFinanceChart = (months) => {
    const max = Math.max(1, ...months.map(m => m.sum));
    const W = 720, H = 220, padL = 44, padB = 30, padT = 14, padR = 14;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const stepX = innerW / months.length;
    const barW = Math.min(34, stepX * 0.6);

    if (!months.some(m => m.sum > 0)) {
      return `<div class="empty" style="padding:40px 20px;">${icon('chart', 36)}<div class="empty__title">Нет оплат за период</div></div>`;
    }

    return `
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Доход">
        ${months.map((m, i) => {
          const x = padL + stepX * i + (stepX - barW) / 2;
          const h = (m.sum / max) * innerH;
          const y = padT + innerH - h;
          return `
            <rect class="bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="4"><title>${m.label}: ${fmt.money(m.sum, null, state.settings)}</title></rect>
            <text x="${x + barW/2}" y="${H - 10}" text-anchor="middle">${m.label}</text>
          `;
        }).join('')}
      </svg>`;
  };

  /* ============================================================
     Renders — Settings
  ============================================================ */
  const renderSettings = () => {
    const s = state.settings;
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">Настройки</h1>
          <p class="page-sub">Валюта, формат даты, тема и данные</p>
        </div>
      </div>

      <div class="settings-grid">
        <div class="panel reveal">
          <div class="panel__head"><div class="panel__title">Общие</div></div>
          <div class="panel__body">
            <div class="setting-row">
              <div><div class="setting-row__label">Валюта по умолчанию</div><div class="setting-row__hint">используется для новых заказов</div></div>
              <select class="select select--sm" data-action="setting-currency" style="width:auto;">
                ${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}" ${s.currency===k?'selected':''}>${v.label} (${v.symbol})</option>`).join('')}
              </select>
            </div>
            <div class="setting-row">
              <div><div class="setting-row__label">Формат даты</div></div>
              <select class="select select--sm" data-action="setting-dateformat" style="width:auto;">
                <option value="DD.MM.YYYY" ${s.dateFormat==='DD.MM.YYYY'?'selected':''}>ДД.ММ.ГГГГ</option>
                <option value="YYYY-MM-DD" ${s.dateFormat==='YYYY-MM-DD'?'selected':''}>ГГГГ-ММ-ДД</option>
              </select>
            </div>
            <div class="setting-row">
              <div><div class="setting-row__label">Тема</div></div>
              <div class="seg">
                <button class="seg__btn ${s.theme==='light'?'is-active':''}" data-action="setting-theme" data-theme="light">Светлая</button>
                <button class="seg__btn ${s.theme==='dark'?'is-active':''}" data-action="setting-theme" data-theme="dark">Тёмная</button>
              </div>
            </div>
          </div>
        </div>

        <div class="panel reveal">
          <div class="panel__head"><div class="panel__title">Данные</div></div>
          <div class="panel__body">
            <div class="setting-row">
              <div><div class="setting-row__label">Экспорт JSON</div><div class="setting-row__hint">полный слепок clients + orders + settings</div></div>
              <button class="btn btn--ghost btn--sm" data-action="export-json">${icon('download',14)} Скачать</button>
            </div>
            <div class="setting-row">
              <div><div class="setting-row__label">Импорт JSON</div><div class="setting-row__hint">заменить текущие данные</div></div>
              <label class="btn btn--ghost btn--sm" style="cursor:pointer;">
                ${icon('upload',14)} Загрузить
                <input type="file" accept="application/json" data-action="import-json" style="display:none;" />
              </label>
            </div>
            <div class="setting-row">
              <div><div class="setting-row__label" style="color:var(--red);">Сброс данных</div><div class="setting-row__hint">удалить всё без возможности восстановления</div></div>
              <button class="btn btn--danger btn--sm" data-action="reset-data">Сбросить</button>
            </div>
          </div>
        </div>

        <div class="panel reveal">
          <div class="panel__head"><div class="panel__title">Горячие клавиши</div></div>
          <div class="panel__body">
            <div class="kbd-list">
              <div class="kbd-row"><span>Новый заказ</span><kbd>N</kbd></div>
              <div class="kbd-row"><span>Новый клиент</span><kbd>K</kbd></div>
              <div class="kbd-row"><span>Закрыть модалку</span><kbd>Esc</kbd></div>
              <div class="kbd-row"><span>Поиск</span><kbd>/</kbd></div>
              <div class="kbd-row"><span>Разделы</span><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> <kbd>5</kbd></div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  /* ============================================================
     Empty state
  ============================================================ */
  const emptyState = (title, text, action, btnLabel) => `
    <div class="empty">
      ${icon('inbox', 44)}
      <div class="empty__title">${escapeHtml(title)}</div>
      <div class="empty__text">${escapeHtml(text)}</div>
      ${action ? `<button class="btn btn--primary" data-action="${action}">${icon('plus')} ${escapeHtml(btnLabel)}</button>` : ''}
    </div>
  `;

  /* ============================================================
     App render
  ============================================================ */
  const renderApp = () => {
    progress.start();
    const app = $('#app');
    let html = '';
    switch (ui.route) {
      case 'orders':  html = renderOrders(); break;
      case 'clients': html = renderClients(); break;
      case 'finance': html = renderFinance(); break;
      case 'settings':html = renderSettings(); break;
      default:        html = renderDashboard();
    }
    app.innerHTML = html;
    $$('.nav__link, .tabbar__link').forEach(b => {
      b.classList.toggle('is-active', b.dataset.nav === ui.route);
    });
    setupReveal();
    requestAnimationFrame(() => progress.done());
  };

  /* ============================================================
     Modals — Order
  ============================================================ */
  const openOrderModal = (orderId = null) => {
    const isEdit = !!orderId;
    const o = isEdit ? orderById(orderId) : null;
    const clients = state.clients.filter(c => !c.archived);

    const html = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="orderModalTitle">
        <div class="modal__head">
          <div class="modal__title" id="orderModalTitle">${isEdit ? 'Редактировать заказ' : 'Новый заказ'}</div>
          <button class="icon-btn" data-close aria-label="Закрыть">${icon('close')}</button>
        </div>
        <form class="modal__body" id="orderForm" novalidate>
          <div class="field field--full">
            <label class="field__label" for="o-title">Название *</label>
            <input class="input" id="o-title" name="title" required value="${o ? escapeHtml(o.title) : ''}" />
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="o-client">Клиент</label>
              <select class="select" id="o-client" name="clientId">
                <option value="">— без клиента —</option>
                ${clients.map(c => `<option value="${c.id}" ${o && o.clientId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="o-status">Статус</label>
              <select class="select" id="o-status" name="status">
                ${STATUSES.map(s => `<option value="${s.id}" ${(o ? o.status : 'new')===s.id?'selected':''}>${s.label}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="o-amount">Сумма *</label>
              <input class="input" id="o-amount" name="amount" type="number" min="0" step="0.01" required value="${o ? o.amount : ''}" />
            </div>
            <div class="field">
              <label class="field__label" for="o-currency">Валюта</label>
              <select class="select" id="o-currency" name="currency">
                ${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}" ${(o ? o.currency : state.settings.currency)===k?'selected':''}>${v.label} (${v.symbol})</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="o-deadline">Дедлайн</label>
              <input class="input" id="o-deadline" name="deadline" type="date" value="${o ? (o.deadline || '') : ''}" />
            </div>
            <div class="field">
              <label class="field__label" for="o-tags">Теги (через запятую)</label>
              <input class="input" id="o-tags" name="tags" value="${o && o.tags ? o.tags.join(', ') : ''}" placeholder="сайт, логотип, бот" />
            </div>
          </div>
          <div class="field field--full">
            <label class="field__label" for="o-desc">Описание</label>
            <textarea class="textarea" id="o-desc" name="description">${o ? escapeHtml(o.description || '') : ''}</textarea>
          </div>
          <div class="field field--full">
            <label class="field__label" for="o-links">Ссылки (по одной на строку)</label>
            <textarea class="textarea" id="o-links" name="links">${o ? escapeHtml(o.links || '') : ''}</textarea>
          </div>
          <div class="form-error" id="orderError"></div>
        </form>
        <div class="modal__foot">
          <button class="btn btn--ghost" type="button" data-close>Отмена</button>
          <button class="btn btn--primary" type="submit" form="orderForm">${isEdit ? 'Сохранить' : 'Создать'}</button>
        </div>
      </div>
    `;

    modal.open(html, {
      onMount(wrap, close) {
        const form = $('#orderForm', wrap);
        const errEl = $('#orderError', wrap);
        $$('[data-close]', wrap).forEach(b => b.addEventListener('click', close));

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(form).entries());
          const title = (data.title || '').trim();
          const amount = Number(data.amount);
          if (!title) { errEl.textContent = 'Укажите название'; return; }
          if (!data.amount || isNaN(amount) || amount < 0) { errEl.textContent = 'Укажите корректную сумму'; return; }

          if (!isEdit && data.deadline && data.deadline < todayISO()) {
            errEl.textContent = 'Дедлайн не может быть раньше сегодня';
            return;
          }

          const tags = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);

          if (isEdit) {
            const old = orderById(orderId);
            const oldStatus = old.status;
            Object.assign(old, {
              title, clientId: data.clientId || '', status: data.status,
              amount, currency: data.currency, deadline: data.deadline || '',
              tags, description: (data.description || '').trim(),
              links: (data.links || '').trim(),
            });
            if (oldStatus !== 'paid' && data.status === 'paid') {
              old.paidAt = new Date().toISOString();
              pushEvent('order.paid', { title });
            } else if (oldStatus === 'paid' && data.status !== 'paid') {
              old.paidAt = null;
              pushEvent('order.status', { title, status: data.status });
            } else if (oldStatus !== data.status) {
              pushEvent('order.status', { title, status: data.status });
            } else {
              pushEvent('order.updated', { title });
            }
            toast('Заказ обновлён', 'success');
          } else {
            const order = {
              id: uid(), clientId: data.clientId || '', title,
              amount, currency: data.currency,
              status: data.status || 'new',
              deadline: data.deadline || '',
              tags, description: (data.description || '').trim(),
              links: (data.links || '').trim(),
              createdAt: new Date().toISOString(),
              paidAt: data.status === 'paid' ? new Date().toISOString() : null,
            };
            state.orders.push(order);
            pushEvent('order.created', { title });
            if (order.status === 'paid') pushEvent('order.paid', { title });
            toast('Заказ создан', 'success');
          }
          save();
          close();
          renderApp();
        });
      }
    });
  };

  /* ============================================================
     Modals — Client
  ============================================================ */
  const openClientModal = (clientId = null) => {
    const isEdit = !!clientId;
    const c = isEdit ? clientById(clientId) : null;

    const html = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="clientModalTitle">
        <div class="modal__head">
          <div class="modal__title" id="clientModalTitle">${isEdit ? 'Редактировать клиента' : 'Новый клиент'}</div>
          <button class="icon-btn" data-close aria-label="Закрыть">${icon('close')}</button>
        </div>
        <form class="modal__body" id="clientForm" novalidate>
          <div class="form-grid">
            <div class="field field--full">
              <label class="field__label" for="c-name">Имя *</label>
              <input class="input" id="c-name" name="name" required value="${c ? escapeHtml(c.name) : ''}" />
            </div>
            <div class="field">
              <label class="field__label" for="c-company">Компания</label>
              <input class="input" id="c-company" name="company" value="${c ? escapeHtml(c.company || '') : ''}" />
            </div>
            <div class="field">
              <label class="field__label" for="c-contact">Контакт</label>
              <input class="input" id="c-contact" name="contact" value="${c ? escapeHtml(c.contact || '') : ''}" placeholder="телефон / email / tg" />
            </div>
          </div>
          <div class="field field--full">
            <label class="field__label" for="c-notes">Заметки</label>
            <textarea class="textarea" id="c-notes" name="notes">${c ? escapeHtml(c.notes || '') : ''}</textarea>
          </div>
          <div class="form-error" id="clientError"></div>
        </form>
        <div class="modal__foot">
          <button class="btn btn--ghost" type="button" data-close>Отмена</button>
          <button class="btn btn--primary" type="submit" form="clientForm">${isEdit ? 'Сохранить' : 'Создать'}</button>
        </div>
      </div>
    `;

    modal.open(html, {
      onMount(wrap, close) {
        const form = $('#clientForm', wrap);
        const errEl = $('#clientError', wrap);
        $$('[data-close]', wrap).forEach(b => b.addEventListener('click', close));

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(form).entries());
          const name = (data.name || '').trim();
          if (!name) { errEl.textContent = 'Укажите имя'; return; }

          if (isEdit) {
            Object.assign(c, {
              name,
              company: (data.company || '').trim(),
              contact: (data.contact || '').trim(),
              notes: (data.notes || '').trim(),
            });
            pushEvent('client.updated', { name });
            toast('Клиент обновлён', 'success');
          } else {
            state.clients.push({
              id: uid(), name,
              company: (data.company || '').trim(),
              contact: (data.contact || '').trim(),
              notes: (data.notes || '').trim(),
              archived: false,
              createdAt: new Date().toISOString(),
            });
            pushEvent('client.created', { name });
            toast('Клиент добавлен', 'success');
          }
          save();
          close();
          renderApp();
        });
      }
    });
  };

  /* ============================================================
     Confirm modal
  ============================================================ */
  const confirmModal = (title, text, onConfirm, danger = true) => {
    const html = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div class="modal__title">${escapeHtml(title)}</div>
          <button class="icon-btn" data-close aria-label="Закрыть">${icon('close')}</button>
        </div>
        <div class="modal__body"><p style="margin:0;color:var(--text-2);">${escapeHtml(text)}</p></div>
        <div class="modal__foot">
          <button class="btn btn--ghost" type="button" data-close>Отмена</button>
          <button class="btn ${danger?'btn--danger':'btn--primary'}" type="button" data-confirm>Подтвердить</button>
        </div>
      </div>
    `;
    modal.open(html, {
      onMount(wrap, close) {
        $$('[data-close]', wrap).forEach(b => b.addEventListener('click', close));
        $('[data-confirm]', wrap).addEventListener('click', () => { close(); onConfirm(); });
      }
    });
  };

  /* ============================================================
     Actions
  ============================================================ */
  const moveOrderStatus = (id, dir) => {
    const o = orderById(id);
    if (!o) return;
    const idx = STATUSES.findIndex(s => s.id === o.status);
    const nextIdx = Math.max(0, Math.min(STATUSES.length - 1, idx + dir));
    if (nextIdx === idx) return;
    const newStatus = STATUSES[nextIdx].id;
    const oldStatus = o.status;
    o.status = newStatus;
    if (newStatus === 'paid' && oldStatus !== 'paid') {
      o.paidAt = new Date().toISOString();
      pushEvent('order.paid', { title: o.title });
      toast('Заказ оплачен', 'success');
    } else if (oldStatus === 'paid' && newStatus !== 'paid') {
      o.paidAt = null;
      pushEvent('order.status', { title: o.title, status: newStatus });
      toast('Статус обновлён', 'info');
    } else {
      pushEvent('order.status', { title: o.title, status: newStatus });
      toast('Статус обновлён', 'info');
    }
    save();
    renderApp();
  };

  const setStatusDirect = (id, status) => {
    const o = orderById(id);
    if (!o || o.status === status) return;
    const old = o.status;
    o.status = status;
    if (status === 'paid' && old !== 'paid') {
      o.paidAt = new Date().toISOString();
      pushEvent('order.paid', { title: o.title });
      toast('Заказ оплачен', 'success');
    } else if (old === 'paid' && status !== 'paid') {
      o.paidAt = null;
      pushEvent('order.status', { title: o.title, status });
      toast('Статус обновлён', 'info');
    } else {
      pushEvent('order.status', { title: o.title, status });
      toast('Статус обновлён', 'info');
    }
    save();
    renderApp();
  };

  const deleteOrder = (id) => {
    const o = orderById(id);
    if (!o) return;
    confirmModal('Удалить заказ?', `«${o.title}» будет удалён безвозвратно.`, () => {
      state.orders = state.orders.filter(x => x.id !== id);
      pushEvent('order.deleted', { title: o.title });
      toast('Заказ удалён', 'info');
      save();
      renderApp();
    });
  };

  const archiveClient = (id) => {
    const c = clientById(id);
    if (!c) return;
    const hasOrders = state.orders.some(o => o.clientId === id);
    const doArchive = () => {
      c.archived = true;
      pushEvent('client.archived', { name: c.name });
      toast('Клиент в архиве', 'info');
      save();
      renderApp();
    };
    if (hasOrders) {
      confirmModal('У клиента есть заказы', 'Клиента нельзя удалить. Переместить в архив?', doArchive, false);
    } else {
      confirmModal('Переместить в архив?', `«${c.name}» будет скрыт из активных.`, doArchive, false);
    }
  };

  const exportCSV = () => {
    const paid = state.orders.filter(o => o.status === 'paid');
    const rows = [
      ['Дата оплаты','Заказ','Клиент','Сумма','Валюта'],
      ...paid.map(o => {
        const c = clientById(o.clientId);
        return [
          o.paidAt ? o.paidAt.slice(0,10) : '',
          o.title, c ? c.name : '', o.amount, o.currency,
        ];
      })
    ];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadBlob(new Blob(["\uFEFF"+csv], { type: 'text/csv;charset=utf-8' }), `craftly-finance-${todayISO()}.csv`);
    toast('Экспорт CSV готов', 'success');
  };

  const exportJSON = () => {
    const data = {
      clients: state.clients,
      orders: state.orders,
      settings: state.settings,
      exportedAt: new Date().toISOString(),
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `craftly-backup-${todayISO()}.json`);
    toast('Данные экспортированы', 'success');
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') throw new Error('bad');
        state.clients = Array.isArray(data.clients) ? data.clients : [];
        state.orders  = Array.isArray(data.orders)  ? data.orders  : [];
        if (data.settings) state.settings = Object.assign(state.settings, data.settings);
        state.events = [];
        pushEvent('client.created', { name: 'Импорт данных' });
        save();
        applyTheme();
        renderApp();
        toast('Данные импортированы', 'success');
      } catch (e) {
        toast('Ошибка импорта', 'error');
      }
    };
    reader.readAsText(file);
  };

  const resetData = () => {
    confirmModal('Сбросить все данные?', 'Все клиенты, заказы и события будут удалены.', () => {
      state.clients = [];
      state.orders = [];
      state.events = [];
      save();
      renderApp();
      toast('Данные сброшены', 'info');
    });
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ============================================================
     Theme
  ============================================================ */
  const applyTheme = () => {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
  };

  /* ============================================================
     Drag & Drop (HTML5)
  ============================================================ */
  const setupDragAndDrop = () => {
    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      ui.draggingId = card.dataset.orderId;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', ui.draggingId); } catch(_) {}
    });

    document.addEventListener('dragend', (e) => {
      const card = e.target.closest('.card');
      if (card) card.classList.remove('is-dragging');
      $$('.column.is-over').forEach(el => el.classList.remove('is-over'));
      ui.draggingId = null;
    });

    document.addEventListener('dragover', (e) => {
      const zone = e.target.closest('[data-dropzone]');
      if (!zone) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      $$('.column.is-over').forEach(el => el.classList.remove('is-over'));
      zone.closest('.column')?.classList.add('is-over');
    });

    document.addEventListener('dragleave', (e) => {
      const zone = e.target.closest('[data-dropzone]');
      if (!zone) return;
      if (!zone.contains(e.relatedTarget)) {
        zone.closest('.column')?.classList.remove('is-over');
      }
    });

    document.addEventListener('drop', (e) => {
      const zone = e.target.closest('[data-dropzone]');
      if (!zone) return;
      e.preventDefault();
      const status = zone.dataset.dropzone;
      const id = ui.draggingId || e.dataTransfer.getData('text/plain');
      if (id && status) setStatusDirect(id, status);
    });
  };

  /* ============================================================
     Global events (delegation)
  ============================================================ */
  const setupEvents = () => {
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('[data-nav]');
      if (navBtn) {
        e.preventDefault();
        closeMobileNav();
        navigate(navBtn.dataset.nav);
        return;
      }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'new-order':  openOrderModal(); break;
        case 'new-client': openClientModal(); break;
        case 'edit-order': openOrderModal(id); break;
        case 'edit-client':openClientModal(id); break;
        case 'delete-order': deleteOrder(id); break;
        case 'move-prev':  moveOrderStatus(id, -1); break;
        case 'move-next':  moveOrderStatus(id, +1); break;
        case 'archive-client': archiveClient(id); break;
        case 'unarchive-client': {
          const c = clientById(id);
          if (c) { c.archived = false; save(); renderApp(); toast('Клиент возвращён', 'success'); }
          break;
        }
        case 'client-orders':
          navigate('orders', { filters: { clientId: id, status: 'all' } });
          break;
        case 'view-board': ui.ordersView = 'board'; renderApp(); break;
        case 'view-list':  ui.ordersView = 'list';  renderApp(); break;
        case 'sort': {
          const key = btn.dataset.key;
          if (ui.filters.sort === key) ui.filters.dir = ui.filters.dir === 'asc' ? 'desc' : 'asc';
          else { ui.filters.sort = key; ui.filters.dir = 'asc'; }
          renderApp();
          break;
        }
        case 'export-csv':  exportCSV(); break;
        case 'export-json': exportJSON(); break;
        case 'reset-data':  resetData(); break;
        case 'setting-theme': {
          state.settings.theme = btn.dataset.theme;
          applyTheme(); save(); renderApp();
          break;
        }
      }
    });

    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      switch (action) {
        case 'filter-client':
          ui.filters.clientId = el.value;
          renderApp();
          break;
        case 'filter-status':
          ui.filters.status = el.value;
          renderApp();
          break;
        case 'finance-client':
          ui.financeFilters.clientId = el.value;
          renderApp();
          break;
        case 'finance-from':
          ui.financeFilters.from = el.value;
          renderApp();
          break;
        case 'finance-to':
          ui.financeFilters.to = el.value;
          renderApp();
          break;
        case 'setting-currency':
          state.settings.currency = el.value;
          save(); renderApp();
          break;
        case 'setting-dateformat':
          state.settings.dateFormat = el.value;
          save(); renderApp();
          break;
        case 'import-json':
          if (el.files && el.files[0]) importJSON(el.files[0]);
          break;
      }
    });

    // Theme toggle button
    $('#themeBtn').addEventListener('click', () => {
      state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
      applyTheme(); save();
      if (ui.route === 'settings') renderApp();
    });

    // Mobile nav
    $('#menuBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileNav();
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

      if (e.key === 'Escape') {
        if (modal.isOpen()) { modal.close(); return; }
        closeMobileNav();
        return;
      }

      if (typing) return;

      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openOrderModal(); }
      else if (e.key === 'k' || e.key === 'K') { e.preventDefault(); openClientModal(); }
      else if (e.key === '/') { e.preventDefault(); focusSearch(); }
      else if (['1','2','3','4','5'].includes(e.key)) {
        const map = ['dashboard','orders','clients','finance','settings'];
        navigate(map[parseInt(e.key, 10) - 1]);
      }
    });
  };

  const focusSearch = () => {
    navigate('orders');
    setTimeout(() => {
      const input = $('#ordersSearch');
      if (input) { input.focus(); return; }
      const q = prompt('Поиск по заказам:');
      if (q !== null) { ui.filters.query = q; renderApp(); }
    }, 60);
  };

  /* ============================================================
     Mobile nav
  ============================================================ */
  let mobileNavEl = null;
  const toggleMobileNav = () => {
    if (mobileNavEl) { closeMobileNav(); return; }
    const el = document.createElement('div');
    el.className = 'mobile-nav';
    el.innerHTML = `
      ${[['dashboard','Дашборд'],['orders','Заказы'],['clients','Клиенты'],['finance','Финансы'],['settings','Настройки']]
        .map(([k, l]) => `<button data-nav="${k}" class="${ui.route===k?'is-active':''}">${l}</button>`).join('')}
    `;
    document.body.appendChild(el);
    mobileNavEl = el;
    setTimeout(() => document.addEventListener('click', outsideMobileNav, { once: true }), 0);
  };
  const closeMobileNav = () => {
    if (mobileNavEl) { mobileNavEl.remove(); mobileNavEl = null; }
  };
  const outsideMobileNav = (e) => {
    if (mobileNavEl && !mobileNavEl.contains(e.target) && e.target.id !== 'menuBtn') closeMobileNav();
  };

  /* ============================================================
     Init
  ============================================================ */
  const init = () => {
    load();
    applyTheme();

    if (!state.clients.length && !state.orders.length) {
      seedDemo();
      save();
    }

    const hash = location.hash.replace('#','');
    if (routes.includes(hash)) ui.route = hash;

    setupEvents();
    setupDragAndDrop();
    renderApp();

    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#','');
      if (routes.includes(h) && h !== ui.route) navigate(h);
    });
  };

  /* ============================================================
     Demo seed (первый запуск)
  ============================================================ */
  const seedDemo = () => {
    const c1 = { id: uid(), name: 'Иван Петров', company: 'ООО «Ромашка»', contact: '+7 999 123-45-67', notes: 'Постоянный клиент', archived: false, createdAt: new Date(Date.now() - 86400000 * 40).toISOString() };
    const c2 = { id: uid(), name: 'Анна Смирнова', company: 'Studio AS', contact: 'anna@studio.as', notes: '', archived: false, createdAt: new Date(Date.now() - 86400000 * 25).toISOString() };
    const c3 = { id: uid(), name: 'Максим Орлов', company: '', contact: '@maxorlov', notes: 'Рекомендация от Ивана', archived: false, createdAt: new Date(Date.now() - 86400000 * 10).toISOString() };
    state.clients.push(c1, c2, c3);

    const mk = (clientId, title, amount, status, daysAgo, deadlineDays, tags, paidDaysAgo) => {
      const createdAt = new Date(Date.now() - 86400000 * daysAgo).toISOString();
      const deadline = new Date(Date.now() + 86400000 * deadlineDays).toISOString().slice(0,10);
      return {
        id: uid(), clientId, title, amount, currency: 'RUB', status,
        deadline, tags, description: '', links: '',
        createdAt,
        paidAt: status === 'paid' ? new Date(Date.now() - 86400000 * paidDaysAgo).toISOString() : null,
      };
    };

    state.orders.push(
      mk(c1.id, 'Редизайн корпоративного сайта', 150000, 'progress', 12, 8, ['сайт','дизайн']),
      mk(c1.id, 'Лендинг для продукта', 85000, 'paid', 40, 30, ['лендинг'], 32),
      mk(c2.id, 'Логотип и брендбук', 60000, 'paid', 30, 20, ['логотип','бренд'], 22),
      mk(c2.id, 'Telegram-бот для заявок', 95000, 'review', 10, 4, ['бот','разработка']),
      mk(c3.id, 'Серия постов для соцсетей', 35000, 'new', 3, 12, ['контент']),
      mk(c3.id, 'Аудит текущего сайта', 25000, 'done', 20, 2, ['аудит'], null),
      mk(c1.id, 'Поддержка сайта (март)', 45000, 'paid', 70, 60, ['поддержка'], 62),
      mk(c2.id, 'Презентация для инвесторов', 70000, 'paid', 55, 45, ['презентация'], 48)
    );

    pushEvent('client.created', { name: c1.name });
    pushEvent('client.created', { name: c2.name });
    pushEvent('client.created', { name: c3.name });
    pushEvent('order.created', { title: 'Редизайн корпоративного сайта' });
    pushEvent('order.paid', { title: 'Лендинг для продукта' });
  };

   if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
