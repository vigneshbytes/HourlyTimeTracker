import { h } from './dom.js';
import { sessionDuration, sessionTime } from '../logic/tasks.js';
import { dayKey, fmtDuration, fmtDate, fmtTime, startOfDay } from '../logic/time.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

// Session graph: x axis = days (only days with sessions; skipped days are
// marked with a gap), one vertical line per session, height = duration.
export function sessionGraph(sessions, { now = Date.now() } = {}) {
  const wrap = h('div', { class: 'graph-wrap' });
  if (!sessions.length) {
    wrap.append(h('p', { class: 'muted graph-empty' }, 'No sessions yet.'));
    return wrap;
  }
  const days = new Map();
  for (const ses of [...sessions].sort((a, b) => sessionTime(a) - sessionTime(b))) {
    const k = dayKey(sessionTime(ses));
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(ses);
  }
  const maxMs = Math.max(...sessions.map((x) => sessionDuration(x, now)), 60000);

  const BAR = 8, BAR_GAP = 5, DAY_PAD = 14, GAP_W = 22, TOP = 18, H = 150, LABEL = 34;
  const svg = s('svg', { class: 'graph', role: 'img', 'aria-label': `Graph of ${sessions.length} sessions` });
  const g = s('g');
  svg.append(g);
  let x = 8, prevDay = null;
  const tip = h('div', { class: 'graph-tip', role: 'tooltip', hidden: true });

  // Baseline + scale label
  for (const [k, list] of days) {
    const dayStart = startOfDay(sessionTime(list[0]));
    if (prevDay != null && Math.round((dayStart - prevDay) / 86400000) > 1) {
      g.append(Object.assign(s('text', { x: x + GAP_W / 2 - 6, y: TOP + H - 4, class: 'graph-gap' }), { textContent: '⋯' }));
      x += GAP_W;
    }
    prevDay = dayStart;
    const colW = list.length * BAR + (list.length - 1) * BAR_GAP;
    const colX = x;
    list.forEach((ses, i) => {
      const dur = sessionDuration(ses, now);
      const bh = Math.max(3, (dur / maxMs) * H);
      const bx = colX + i * (BAR + BAR_GAP);
      const kind = ses.running === 1 ? 'running' : ses.manual && !ses.dateProvided ? 'manual-nodate' : ses.manual ? 'manual' : 'timed';
      const bar = s('rect', { x: bx, y: TOP + H - bh, width: BAR, height: bh, rx: BAR / 2, class: `bar bar-${kind}`, tabindex: 0 });
      const label = [
        fmtDuration(dur),
        ses.manual ? (ses.dateProvided ? `Manual session · ${fmtDate(ses.start)}${ses.timeProvided ? ` ${fmtTime(ses.start)}` : ''}` : `Manual session (no date) · added ${fmtDate(ses.createdAt)}`)
          : `${fmtDate(ses.start)} · ${fmtTime(ses.start)}–${ses.end ? fmtTime(ses.end) : 'now'}`,
      ];
      const show = () => {
        tip.replaceChildren(h('strong', null, label[0]), h('span', null, label[1]));
        tip.hidden = false;
        const wr = wrap.getBoundingClientRect(), br = bar.getBoundingClientRect();
        const left = Math.min(Math.max(4, br.left - wr.left + BAR / 2 - tip.offsetWidth / 2), wr.width - tip.offsetWidth - 4);
        tip.style.left = `${left}px`;
        tip.style.top = `${Math.max(0, br.top - wr.top - tip.offsetHeight - 6)}px`;
        svg.querySelectorAll('.bar.active').forEach((b) => b.classList.remove('active'));
        bar.classList.add('active');
      };
      bar.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(); });
      bar.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { tip.hidden = true; bar.classList.remove('active'); } });
      bar.addEventListener('click', (e) => { e.stopPropagation(); show(); });
      bar.addEventListener('focus', show);
      bar.addEventListener('blur', () => { tip.hidden = true; bar.classList.remove('active'); });
      g.append(bar);
    });
    const d = new Date(dayStart);
    const lbl = s('text', { x: colX + colW / 2, y: TOP + H + 16, 'text-anchor': 'middle', class: 'graph-label' });
    lbl.textContent = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const cnt = s('text', { x: colX + colW / 2, y: TOP + H + 29, 'text-anchor': 'middle', class: 'graph-sub' });
    cnt.textContent = list.length > 1 ? `${list.length} sessions` : '';
    g.append(lbl, cnt);
    x += Math.max(colW, 40) + DAY_PAD;
  }
  const width = x + 8;
  g.prepend(s('line', { x1: 0, x2: width, y1: TOP + H + 0.5, y2: TOP + H + 0.5, class: 'graph-axis' }));
  const scale = s('text', { x: 4, y: 12, class: 'graph-scale' });
  scale.textContent = `max ${fmtDuration(maxMs)}`;
  svg.append(scale);
  svg.setAttribute('width', width);
  svg.setAttribute('height', TOP + H + LABEL);
  svg.setAttribute('viewBox', `0 0 ${width} ${TOP + H + LABEL}`);

  const scroller = h('div', { class: 'graph-scroll' }, svg);
  wrap.append(scroller, tip,
    h('div', { class: 'graph-legend' },
      h('span', null, h('i', { class: 'lg lg-timed' }), 'Timed'),
      h('span', null, h('i', { class: 'lg lg-manual' }), 'Manual'),
      h('span', null, h('i', { class: 'lg lg-manual-nodate' }), 'Manual, no date'),
      h('span', null, h('i', { class: 'lg lg-running' }), 'Running')));
  wrap.addEventListener('click', () => { tip.hidden = true; svg.querySelectorAll('.bar.active').forEach((b) => b.classList.remove('active')); });
  requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });
  return wrap;
}
