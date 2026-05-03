export class BehaviorTracker {
  constructor() {
    this.events = [];
    this.hoverStartTimes = new Map();
    this._onUpdate = null;
    this._mousemoveHandler = null;
    this._clickHandler = null;
  }

  startTracking() {
    let lastSample = 0;

    this._mousemoveHandler = (e) => {
      const now = Date.now();
      if (now - lastSample > 250) {
        lastSample = now;
        this._record('mousemove', { x: Math.round(e.clientX), y: Math.round(e.clientY) });
      }
    };

    this._clickHandler = (e) => {
      const t = e.target;
      const label = t.dataset.label || t.textContent.trim().slice(0, 40) || t.tagName;
      this._record('click', { x: Math.round(e.clientX), y: Math.round(e.clientY), target: label });
    };

    document.addEventListener('mousemove', this._mousemoveHandler);
    document.addEventListener('click', this._clickHandler);
  }

  hoverStart(id) {
    if (!this.hoverStartTimes.has(id)) {
      this.hoverStartTimes.set(id, Date.now());
    }
  }

  hoverEnd(id, label) {
    const start = this.hoverStartTimes.get(id);
    if (start !== undefined) {
      const duration = Date.now() - start;
      this._record('hover', { id, label, duration });
      this.hoverStartTimes.delete(id);
      return duration;
    }
    return 0;
  }

  recordDecision(label, timeMs) {
    this._record('decision', { label, timeMs });
  }

  _record(type, metadata) {
    const event = { type, timestamp: Date.now(), metadata };
    this.events.push(event);
    if (this._onUpdate) this._onUpdate(event, this.events);
  }

  onUpdate(fn) {
    this._onUpdate = fn;
  }

  getStats() {
    const byType = (t) => this.events.filter(e => e.type === t);
    const clicks     = byType('click');
    const hovers     = byType('hover');
    const decisions  = byType('decision');
    const moves      = byType('mousemove');

    const totalHoverMs   = hovers.reduce((s, e) => s + (e.metadata.duration || 0), 0);
    const avgDecisionMs  = decisions.length
      ? Math.round(decisions.reduce((s, e) => s + e.metadata.timeMs, 0) / decisions.length)
      : 0;

    // Count how many times each option was hovered (re-visits signal uncertainty)
    const hoverFreq = {};
    hovers.forEach(e => { hoverFreq[e.metadata.id] = (hoverFreq[e.metadata.id] || 0) + 1; });
    const maxRevisits = Math.max(0, ...Object.values(hoverFreq));

    const hesitationCount = hovers.filter(e => e.metadata.duration > 1500).length;
    const fastDecisions   = decisions.filter(e => e.metadata.timeMs < 600).length;
    const slowDecisions   = decisions.filter(e => e.metadata.timeMs > 2500).length;

    return {
      totalClicks: clicks.length,
      totalHoverMs,
      avgDecisionMs,
      hesitationCount,
      maxRevisits,
      fastDecisions,
      slowDecisions,
      mouseMovements: moves.length,
      decisions,
      hoverFreq,
    };
  }

  inferPersonality() {
    const s = this.getStats();

    // I vs E: fast + few hovers → extroverted instinct; slow + many → introverted reflection
    const ieScore = s.fastDecisions - s.slowDecisions - s.hesitationCount * 0.5;
    const ie = ieScore > 0 ? 'E' : 'I';
    const ieReason = ieScore > 0
      ? 'Fast responses and limited scanning suggest outward, instinctive processing typical of Extroverted types.'
      : 'Longer deliberation and scanning suggest inward, reflective processing typical of Introverted types.';

    // N vs S: revisiting options signals pattern-seeking (N); direct path signals concrete preference (S)
    const ns = s.maxRevisits >= 2 ? 'N' : 'S';
    const nsReason = s.maxRevisits >= 2
      ? 'Revisiting options suggests pattern-seeking and abstract evaluation, common in Intuitive types.'
      : 'Direct option selection suggests preference for concrete, immediate information typical of Sensing types.';

    // T vs F: high hover time per decision signals emotional weighting (F)
    const avgHoverPerDecision = s.totalHoverMs / Math.max(1, s.decisions.length);
    const tf = avgHoverPerDecision > 2000 ? 'F' : 'T';
    const tfReason = avgHoverPerDecision > 2000
      ? 'Extended hover time suggests emotional weighting of options, common in Feeling types.'
      : 'Efficient evaluation with less lingering suggests outcome-based reasoning, common in Thinking types.';

    // J vs P: consistent timing → structured (J); high variance → adaptive (P)
    const times = s.decisions.map(d => d.metadata.timeMs);
    const variance = times.length > 1
      ? Math.sqrt(times.reduce((acc, t) => acc + Math.pow(t - s.avgDecisionMs, 2), 0) / times.length)
      : 0;
    const jp = variance < 1500 ? 'J' : 'P';
    const jpReason = variance < 1500
      ? 'Consistent decision timing suggests a structured, planned approach typical of Judging types.'
      : 'Variable decision timing suggests an adaptive, situational response style typical of Perceiving types.';

    const mbti = `${ie}${ns}${tf}${jp}-like tendency`;

    let style = 'balanced';
    let risk  = 'risk-neutral';
    if (s.fastDecisions > s.slowDecisions)             { style = 'impulsive';  risk = 'risk-tolerant'; }
    else if (s.slowDecisions > 0 || s.hesitationCount > 1) { style = 'analytical'; risk = 'risk-averse';   }
    if (s.maxRevisits >= 3)                            { style = 'emotional';  risk = 'uncertain';     }

    return { mbti, ie, ieReason, ns, nsReason, tf, tfReason, jp, jpReason, risk, style };
  }

  stopTracking() {
    if (this._mousemoveHandler) document.removeEventListener('mousemove', this._mousemoveHandler);
    if (this._clickHandler)     document.removeEventListener('click',     this._clickHandler);
  }
}
