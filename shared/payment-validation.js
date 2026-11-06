/* Validate demo checkout input only. This is not payment-gateway verification.
 * Never log, send to the data adapter, or persist card numbers or security codes.
 */
(() => {
  function validateCard({ name, number, expiry, cvv }, now = new Date()) {
    if (String(name || '').trim().length < 2) return { ok: false, field: 'name', error: 'Enter the cardholder name.' };
    const raw = String(number || '').trim();
    const digits = raw.replace(/[\s-]/g, '');
    if (!/^[\d\s-]+$/.test(raw) || !/^\d{13,19}$/.test(digits)) return { ok: false, field: 'number', error: 'Enter a card number with 13 to 19 digits.' };
    const match = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/.exec(String(expiry || '').trim());
    if (!match) return { ok: false, field: 'expiry', error: 'Enter the expiry date in MM / YY format.' };
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Amman', year: 'numeric', month: 'numeric' }).formatToParts(now);
    const year = Number(parts.find(part => part.type === 'year').value), month = Number(parts.find(part => part.type === 'month').value);
    if (2000 + Number(match[2]) < year || 2000 + Number(match[2]) === year && Number(match[1]) < month) return { ok: false, field: 'expiry', error: 'This card expiry date has passed.' };
    if (!/^\d{3,4}$/.test(String(cvv || '').trim())) return { ok: false, field: 'cvv', error: 'Enter a 3 or 4 digit security code.' };
    return { ok: true };
  }
  window.CarePlusPaymentValidation = { validateCard };
})();
