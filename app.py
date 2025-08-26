#!/usr/bin/env python3
"""
Endpoints:
  GET  /            -> HTML form (simple)
  POST /api/sqrt    -> JSON API (application/json) returning high-precision results

Example API JSON body:
{
  "number": "2",
  "prec_digits": 200,
  "iterations": 20,
  "method": "heron",        # "heron" or "recip"
  "init_mode": "auto",      # "auto" or "manual"
  "init_value": "",         # string, used when init_mode=="manual"
  "include_iterations": true,
  "save_csv": false
}
"""

from flask import Flask, request, jsonify, send_file, abort, render_template_string
import mpmath as mp
import time
import io
import csv
import math

app = Flask(__name__)

# LIMIT
MAX_PREC_DIGITS = 5000
MAX_ITERATIONS = 2000
MAX_NUMBER_LENGTH = 20000
DEFAULT_PREC_DIGITS = 200
DEFAULT_ITERATIONS = 20

# Simpel demo kalau FE ga bisa
INDEX_HTML = """
<!doctype html>
<title>High-precision sqrt (Newton / Reciprocal)</title>
<style>
  body { font-family: system-ui, -apple-system, Roboto, "Segoe UI", Arial; padding: 24px; max-width: 900px; }
  label { display:block; margin-top: 8px; }
  input, select, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
  button { margin-top: 12px; padding: 10px 16px; }
  pre { background:#f7f7f8; padding:12px; overflow:auto }
</style>
<h2>High-precision sqrt (Newton / Reciprocal)</h2>
<form id="form">
  <label>Number (decimal)</label>
  <input id="number" value="2">

  <label>Precision (decimal digits)</label>
  <input id="prec_digits" value="{{default_prec}}">

  <label>Iterations</label>
  <input id="iterations" value="{{default_iter}}">

  <label>Method</label>
  <select id="method">
    <option value="heron">heron (Newton)</option>
    <option value="recip">reciprocal-sqrt</option>
  </select>

  <label>Initial guess mode</label>
  <select id="init_mode">
    <option value="auto">auto</option>
    <option value="manual">manual</option>
  </select>

  <label>Initial guess value (decimal string, used only if manual)</label>
  <input id="init_value" placeholder="optional">

  <label><input type="checkbox" id="include_iterations" checked> Include per-iteration table in response</label>
  <label><input type="checkbox" id="save_csv"> Return iteration CSV as downloadable attachment</label>

  <button type="button" onclick="submitForm()">Compute sqrt</button>
</form>

<h3>Result</h3>
<pre id="output">Waiting...</pre>

<script>
async function submitForm(){
  const body = {
    number: document.getElementById('number').value,
    prec_digits: parseInt(document.getElementById('prec_digits').value),
    iterations: parseInt(document.getElementById('iterations').value),
    method: document.getElementById('method').value,
    init_mode: document.getElementById('init_mode').value,
    init_value: document.getElementById('init_value').value,
    include_iterations: document.getElementById('include_iterations').checked,
    save_csv: document.getElementById('save_csv').checked
  };
  const output = document.getElementById('output');
  output.textContent = "Computing...";
  try {
    const resp = await fetch('/api/sqrt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      output.textContent = "ERROR: " + resp.status + " - " + txt;
      return;
    }
    // If CSV attachment requested and returned as file, the response is handled as blob
    const contentType = resp.headers.get('Content-Type') || '';
    if (contentType.startsWith('text/csv')) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'iterations.csv'; a.textContent = 'Download CSV';
      output.innerHTML = ''; output.appendChild(a);
      return;
    }
    const data = await resp.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    output.textContent = "Exception: " + e.toString();
  }
}
</script>
"""

def clamp_int(v, mn, mx):
    try:
        i = int(v)
    except Exception:
        return mn
    return max(mn, min(mx, i))

def auto_initial_guess(a):
    # For a>0: seed exponent ~ ceil((floor(log2(a))+1)/2) -> 2^seed_exp
    if a == 0:
        return mp.mpf(0)
    if a < 0:
        raise ValueError("negative input")
    # compute floor(log2(a))
    # Pake mp.log(a)/mp.log(2)
    log2a = mp.log(a) / mp.log(2)
    exp_floor = mp.floor(log2a)
    seed_exp = mp.floor((exp_floor + 2) / 2)
    x0 = mp.power(2, seed_exp)
    return mp.mpf(x0)

def newton_heron(a, x0, iterations):
    its = [mp.mpf(x0)]
    x = mp.mpf(x0)
    for i in range(iterations):
        if x == 0:
            its.append(mp.mpf(0))
            x = mp.mpf(0)
            continue
        xnext = (x + a / x) * mp.mpf('0.5')
        its.append(mp.mpf(xnext))
        x = xnext
    return mp.mpf(x), its

def reciprocal_sqrt(a, y0, iterations):
    its = [mp.mpf(y0)]
    y = mp.mpf(y0)
    for i in range(iterations):
        y2 = y * y
        ynext = y * (mp.mpf('1.5') - mp.mpf('0.5') * a * y2)
        its.append(mp.mpf(ynext))
        y = ynext
    sqrt_approx = a * y
    return mp.mpf(sqrt_approx), its

@app.route("/", methods=["GET"])
def index():
    return render_template_string(INDEX_HTML, default_prec=DEFAULT_PREC_DIGITS, default_iter=DEFAULT_ITERATIONS)

@app.route("/health", methods=["GET"])
def health():
    return "ok", 200

@app.route("/api/sqrt", methods=["POST"])
def api_sqrt():
    """
    Accepts JSON body as described above. Returns JSON with:
     - input, parameters
     - time_ns
     - reference, builtin, approx (strings)
     - abs_err, rel_err (strings)
     - iterations (list of dicts) if requested
    Or returns CSV file if save_csv==true (with 'text/csv' content-type).
    """
    payload = request.get_json(force=True, silent=True)
    if not payload:
        return "Invalid JSON body", 400

    # Parse dan validate inputs
    num_str = str(payload.get("number", "2"))
    if len(num_str) == 0 or len(num_str) > MAX_NUMBER_LENGTH:
        return f"Invalid 'number' length (max {MAX_NUMBER_LENGTH})", 400

    try:
        prec_digits = int(payload.get("prec_digits", DEFAULT_PREC_DIGITS))
    except Exception:
        prec_digits = DEFAULT_PREC_DIGITS
    if prec_digits < 2:
        return "prec_digits must be >= 2", 400
    if prec_digits > MAX_PREC_DIGITS:
        return f"prec_digits too large; max allowed is {MAX_PREC_DIGITS}", 400

    iterations = clamp_int(payload.get("iterations", DEFAULT_ITERATIONS), 0, MAX_ITERATIONS)
    method = payload.get("method", "heron")
    if method not in ("heron", "recip"):
        return "method must be 'heron' or 'recip'", 400

    init_mode = payload.get("init_mode", "auto")
    if init_mode not in ("auto", "manual"):
        return "init_mode must be 'auto' or 'manual'", 400
    init_value = payload.get("init_value", "")
    include_iterations = bool(payload.get("include_iterations", True))
    save_csv = bool(payload.get("save_csv", False))

    extra_ref = 20
    try:
        with mp.workdps(prec_digits + extra_ref):
            a = mp.mpf(num_str)
            if a < 0:
                return "Negative input: complex results are not supported by this API", 400
            # compute high-precision reference
            ref_sqrt_high = mp.sqrt(a)            
            ref_str = mp.nstr(ref_sqrt_high, prec_digits + 10)
    except Exception as e:
        return f"Failed to parse number or compute reference: {e}", 400

    # Main computation
    try:
        with mp.workdps(prec_digits):
            a_low = mp.mpf(num_str)  # re-create

            # initial guess
            if init_mode == "manual":
                if init_value is None or init_value == "":
                    return "init_mode=manual but init_value not provided", 400
                try:
                    init_mp = mp.mpf(init_value)
                except Exception as e:
                    return f"Failed to parse init_value: {e}", 400
                x0 = mp.mpf(init_mp)
            else:
                x0 = auto_initial_guess(a_low)
             
            if method == "recip":
                if init_mode == "manual":
                    if x0 == 0:
                        return "Zero initial guess invalid for reciprocal method", 400
                    y0 = 1 / x0
                else:
                    if x0 == 0:
                        y0 = mp.mpf(1)
                    else:
                        y0 = 1 / x0
            
            t0 = time.perf_counter_ns()
            if method == "heron":
                approx, iterations_list = newton_heron(a_low, x0, iterations)
                used_init = x0
            else:
                approx, iterations_list = reciprocal_sqrt(a_low, y0, iterations)
                used_init = y0
            t1 = time.perf_counter_ns()
            elapsed_ns = int(t1 - t0)
            
            builtin = mp.sqrt(a_low)

            reference = mp.mpf(ref_str)
            # Errors
            abs_err_final = mp.fabs(approx - reference)
            rel_err_final = mp.mpf(0) if reference == 0 else abs_err_final / mp.fabs(reference)

            def fmt(x):
                try:
                    return mp.nstr(x, prec_digits)
                except Exception:
                    return str(x)

            result = {
                "input": num_str,
                "prec_digits": prec_digits,
                "method": method,
                "iterations_requested": iterations,
                "initial_guess_used": fmt(used_init),
                "time_ns": elapsed_ns,
                "reference": fmt(reference),
                "builtin_sqrt": fmt(builtin),
                "approx": fmt(approx),
                "abs_err": fmt(abs_err_final),
                "rel_err": fmt(rel_err_final),
            }

            if include_iterations:
                it_out = []
                for i, val in enumerate(iterations_list):
                    aerr = mp.fabs(val - reference)
                    rerr = mp.mpf(0) if reference == 0 else aerr / mp.fabs(reference)
                    it_out.append({
                        "i": i,
                        "value": fmt(val),
                        "abs_err": fmt(aerr),
                        "rel_err": fmt(rerr)
                    })
                result["iterations"] = it_out

            if save_csv:
                csv_buf = io.StringIO()
                writer = csv.writer(csv_buf)
                writer.writerow(["iteration", "value", "abs_error", "rel_error"])
                for i, val in enumerate(iterations_list):
                    aerr = mp.fabs(val - reference)
                    rerr = mp.mpf(0) if reference == 0 else aerr / mp.fabs(reference)
                    writer.writerow([i, mp.nstr(val, prec_digits), mp.nstr(aerr, prec_digits), mp.nstr(rerr, prec_digits)])
                csv_bytes = csv_buf.getvalue().encode("utf-8")
                return send_file(
                    io.BytesIO(csv_bytes),
                    mimetype="text/csv",
                    as_attachment=True,
                    download_name="iterations.csv"
                )

            return jsonify(result), 200

    except Exception as e:        
        return f"Internal error during computation: {e}", 500

if __name__ == "__main__":
    # For local testing only. Use gunicorn in production.
    app.run(host="127.0.0.1", port=8080, debug=False)

