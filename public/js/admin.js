/* Admin panel: tabs, add product, update stock, delete product, update order status */
(function () {
  'use strict';
  const { $, $$, toast, api } = window.Aura;
  const BADGE = {
    Processing: 'bg-amber-100 text-amber-800',
    Shipped: 'bg-blue-100 text-blue-800',
    Delivered: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
  };

  // ---- tabs (remembered in the URL hash)
  function showTab(name) {
    if (!$('[data-panel="' + name + '"]')) name = 'overview';
    $$('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== name));
    $$('[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
    history.replaceState(null, '', '#' + name);
  }
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  showTab(location.hash.replace('#', '') || 'overview');

  // ---- add product
  const form = $('#product-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {};
    new FormData(form).forEach((v, k) => (body[k] = v));
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const r = await api('/admin/api/products', { method: 'POST', body: body });
      toast(r.message, 'success');
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });

  // ---- stock / delete (event delegation on the table)
  document.addEventListener('click', async (e) => {
    const save = e.target.closest('[data-stock-save]');
    if (save) {
      const id = save.dataset.stockSave;
      const input = $('[data-stock-input="' + id + '"]');
      try {
        const r = await api('/admin/api/products/' + id, { method: 'PATCH', body: { stockCount: input.value } });
        input.classList.toggle('text-red-600', Number(input.value) <= 5);
        toast(r.message, 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
    const del = e.target.closest('[data-delete-product]');
    if (del) {
      if (!confirm('Delete "' + del.dataset.name + '"? This cannot be undone.')) return;
      try {
        const r = await api('/admin/api/products/' + del.dataset.deleteProduct, { method: 'DELETE' });
        const row = $('[data-product-row="' + del.dataset.deleteProduct + '"]');
        if (row) row.remove();
        toast(r.message, 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  // ---- order status
  document.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-order-status]');
    if (!sel) return;
    const id = sel.dataset.orderStatus;
    sel.disabled = true;
    try {
      const r = await api('/admin/api/orders/' + id + '/status', { method: 'PATCH', body: { status: sel.value } });
      const badge = $('[data-status-badge="' + id + '"]');
      badge.textContent = r.status;
      badge.className = 'px-3 py-1 text-xs font-medium rounded-full ' + (BADGE[r.status] || 'bg-neutral-100');
      toast(r.message, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      sel.disabled = false;
    }
  });
})();
