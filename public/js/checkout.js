/* Checkout: Shipping -> Payment (simulated) -> POST /api/checkout -> confirmation page */
(function () {
  'use strict';
  const { $, $$, toast, api } = window.Aura;

  const shippingForm = $('#shipping-form');
  const paymentForm = $('#payment-form');
  const placeBtn = $('#place-order');

  function showStep(n) {
    shippingForm.classList.toggle('hidden', n !== 1);
    paymentForm.classList.toggle('hidden', n !== 2);
    $$('[data-step-indicator]').forEach((el) => {
      const step = Number(el.dataset.stepIndicator);
      el.classList.toggle('is-current', step === n);
      el.classList.toggle('is-done', step < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function shippingData() {
    const f = new FormData(shippingForm);
    const out = {};
    ['name', 'phone', 'line1', 'line2', 'city', 'state', 'postalCode', 'country'].forEach((k) => (out[k] = String(f.get(k) || '').trim()));
    return out;
  }

  // ---- step 1 -> 2
  $('#to-payment').addEventListener('click', () => {
    let firstBad = null;
    $$('[required]', shippingForm).forEach((input) => {
      const bad = !input.value.trim();
      input.classList.toggle('is-invalid', bad);
      if (bad && !firstBad) firstBad = input;
    });
    if (firstBad) {
      firstBad.focus();
      return toast('Please fill in all required fields', 'error');
    }
    if (!/^[0-9+\-\s()]{7,20}$/.test($('#s-phone').value.trim())) {
      $('#s-phone').classList.add('is-invalid');
      return toast('Please enter a valid phone number', 'error');
    }
    showStep(2);
  });
  shippingForm.addEventListener('input', (e) => e.target.classList.remove('is-invalid'));
  $('#back-to-shipping').addEventListener('click', () => showStep(1));

  // ---- payment method toggles the card fields
  const cardFields = $('#card-fields');
  const method = () => $('input[name=payment]:checked', paymentForm).value;
  paymentForm.addEventListener('change', () => cardFields.classList.toggle('hidden', !method().startsWith('Card')));

  // format card number as 4-4-4-4 and expiry as MM/YY while typing
  $('#c-number').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  });
  $('#c-exp').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    e.target.value = v;
  });

  function validCard() {
    const num = $('#c-number').value.replace(/\s/g, '');
    if (num.length < 13) return 'Enter a valid card number (demo: 4242 4242 4242 4242)';
    const m = /^(\d{2})\/(\d{2})$/.exec($('#c-exp').value);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return 'Enter the expiry as MM/YY';
    if (!/^\d{3,4}$/.test($('#c-cvv').value)) return 'Enter the 3 or 4 digit CVV';
    return null;
  }

  // ---- place the order (server runs the SQL transaction)
  placeBtn.addEventListener('click', async () => {
    if (method().startsWith('Card')) {
      const problem = validCard();
      if (problem) return toast(problem, 'error');
    }
    placeBtn.disabled = true;
    const label = placeBtn.innerHTML;
    placeBtn.textContent = 'PROCESSING PAYMENT…';
    try {
      await new Promise((r) => setTimeout(r, 900)); // simulated payment gateway delay
      const r = await api('/api/checkout', {
        method: 'POST',
        body: { shipping: shippingData(), paymentMethod: method(), saveAddress: $('#save-address').checked },
      });
      toast('Order placed!', 'success');
      location.href = r.redirect;
    } catch (e) {
      toast(e.message, 'error');
      placeBtn.disabled = false;
      placeBtn.innerHTML = label;
      // stock / cart problems: send the user back to fix the cart
      if (e.status === 409 || /cart is empty/i.test(e.message)) setTimeout(() => (location.href = '/shop'), 2500);
    }
  });
})();
