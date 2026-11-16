// One Euro filter: smooths jitter when still, stays responsive when moving fast.
// https://gery.casiez.net/1euro/

function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuro {
  constructor(minCutoff = 1.0, beta = 0.0, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.x = null;
    this.dx = 0;
    this.t = null;
  }

  filter(value, tMs) {
    if (this.x === null || this.t === null) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    // A long gap (tracking lost, tab hidden) – jump straight to the new value.
    if (dt > 0.5) {
      this.x = value;
      this.dx = 0;
      return value;
    }
    const dxRaw = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (dxRaw - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

// A bag of named filters that share the same settings.
export class FilterBank {
  constructor(minCutoff, beta) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.filters = new Map();
  }

  f(name, value, t) {
    let flt = this.filters.get(name);
    if (!flt) {
      flt = new OneEuro(this.minCutoff, this.beta);
      this.filters.set(name, flt);
    }
    return flt.filter(value, t);
  }

  reset() {
    this.filters.forEach((f) => f.reset());
  }
}
