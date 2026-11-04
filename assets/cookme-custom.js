/* ============================================================
   COOKME — global theme JS
   Sticky header · pincode · mobile drawer · hero · category carousel
   bestsellers · AJAX cart drawer · wishlist (localStorage) · toast · loader
   ============================================================ */
(function () {
  'use strict';

  var moneyFormat = document.body.getAttribute('data-money') || '\u20B9{{amount}}';
  function fmtMoney(cents) {
    var s = moneyFormat;
    try {
      s = s.replace(/\{\{amount_with_comma_separator\}\}/g, (cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } catch (e) { }
    return s.replace(/\{\{amount\}\}/g, (cents / 100).toFixed(2));
  }

  /* ---------- Shopify native unit-price formatter ----------
     Uses the unit_price and unit_price_measurement values supplied by Shopify.
     No calculation is performed from the variant title or product price. */
  function formatNativeUnitPrice(priceCents, measurement) {
    var cents = Number(priceCents);
    if (!isFinite(cents) || cents < 0 || !measurement) return '';
    var referenceValue = Number(measurement.reference_value || 1);
    var referenceUnit = String(measurement.reference_unit || '').trim();
    if (!referenceUnit) return '';
    return fmtMoney(cents) + '/' + (referenceValue !== 1 ? referenceValue : '') + referenceUnit;
  }
  window.ckFormatNativeUnitPrice = formatNativeUnitPrice;

  var toastTimer;
  function showToast(msg) {
    var t = document.getElementById('ckToast');
    var m = document.getElementById('ckToastMsg');
    if (!t) return;
    m.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  window.ckShowToast = showToast;

  function setCartBadge(n) {
    ['cartCount', 'mobCartCount'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.textContent = n; el.style.display = n > 0 ? 'grid' : 'none'; }
    });
  }

  /* ---------- Busy / loader helpers (per-element only) ---------- */
  function setBusy(el, busy) {
    if (!el) return;
    if (busy) {
      el.classList.add('is-loading');
      if (el.tagName === 'BUTTON') el.disabled = true;
    } else {
      el.classList.remove('is-loading');
      if (el.tagName === 'BUTTON') el.disabled = false;
    }
  }

  /* ---------- Add → View state (derived from live /cart.js) ---------- */
  function variantIdsForCard(btn) {
    var ids = [];
    try {
      var el = document.getElementById('QuickAddData-' + btn.getAttribute('data-product-id'));
      if (el) {
        var data = JSON.parse(el.textContent || '{}');
        if (data && Array.isArray(data.variants)) {
          data.variants.forEach(function (vv) { ids.push(String(vv.id)); });
          return ids;
        }
      }
    } catch (e) { }
    ids.push(String(btn.getAttribute('data-id')));
    return ids;
  }
  function getCardCartItems(productId) {
    var items = [];
    (window.ckCart.items || []).forEach(function (it) {
      if (String(it.product_id) === String(productId)) items.push(it);
    });
    return items;
  }

  function syncCardButtons() {
    document.querySelectorAll('[data-quick-add]').forEach(function (btn) {
      var productId = btn.getAttribute('data-product-id');
      var items = getCardCartItems(productId);
      var qty = items.reduce(function (sum, it) { return sum + (parseInt(it.quantity, 10) || 0); }, 0);
      var control = getCardControl(productId);
      var isMulti = btn.getAttribute('data-has-multi-variants') === 'true' || btn.getAttribute('data-has-multi-variants') === 'True';

      /* Preserve the selected cart line for subsequent +/- clicks. */
      if (control && items.length) {
        var currentVariant = control.getAttribute('data-variant-id');
        var selectedItem = items.find(function (it) { return String(it.variant_id) === String(currentVariant); }) || items[0];
        control.setAttribute('data-variant-id', String(selectedItem.variant_id));
      }

      /* If a quantity update is still in flight, don't let a stale cart
         response switch the card back to ADD mode. */
      var pendingQty = 0;
      var hasPending = false;
      items.forEach(function (it) {
        var q = ckQtyQueues[it.key];
        if (q) {
          hasPending = true;
          pendingQty += Math.max(0, q.target);
        } else {
          pendingQty += parseInt(it.quantity, 10) || 0;
        }
      });
      if (hasPending) qty = pendingQty;

      setCardQuantityState(productId, qty);
      if (control && !items.length && !hasPending) {
        control.hidden = true;
      }
    });

    var pdpBtn = document.getElementById('ckPdpAddBtn');
    if (pdpBtn) {
      if (window.ckIsPdpDeliverable && !window.ckIsPdpDeliverable()) {
        pdpBtn.disabled = true;
        pdpBtn.classList.add('is-disabled');
        pdpBtn.classList.remove('is-added');
        pdpBtn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Not Deliverable';
      } else {
        var activeId0 = (document.getElementById('ckPdpVariantId') || {}).value;
        var activeItem0 = (window.ckCart.items || []).find(function (it) { return String(it.variant_id) === String(activeId0); });
        if (activeId0 && activeItem0) { pdpBtn.classList.add('is-added'); pdpBtn.textContent = 'Update Cart'; }
        else if (!pdpBtn.classList.contains('is-disabled')) { pdpBtn.classList.remove('is-added'); pdpBtn.innerHTML = '<i class="bi bi-bag"></i> Add to Cart'; }
      }
    }
    var mobBtn = document.getElementById('mobAddToCart');
    if (mobBtn) {
      if (window.ckIsPdpDeliverable && !window.ckIsPdpDeliverable()) {
        mobBtn.disabled = true;
        mobBtn.classList.add('is-disabled');
        mobBtn.classList.remove('is-added');
        mobBtn.textContent = 'Not Deliverable';
      } else {
        var activeId1 = (document.getElementById('ckPdpVariantId') || {}).value;
        var activeItem1 = (window.ckCart.items || []).find(function (it) { return String(it.variant_id) === String(activeId1); });
        if (activeId1 && activeItem1) { mobBtn.classList.add('is-added'); mobBtn.textContent = 'View Cart'; }
        else if (!mobBtn.classList.contains('is-disabled')) { mobBtn.classList.remove('is-added'); mobBtn.textContent = 'Add to cart'; }
      }
    }
    if (typeof window.ckSyncPdpCart === 'function') {
      window.ckSyncPdpCart();
    }
  }
  window.ckSyncCardButtons = syncCardButtons;

  /* ---------- Product-card quantity control ---------- */
  var ckQtyQueues = {};

  function getCardControl(productId) {
    return document.querySelector('[data-qty-control][data-product-id="' + productId + '"]');
  }

  function getCardAddButton(productId) {
    return document.querySelector('[data-quick-add][data-product-id="' + productId + '"]');
  }

  function getCardMaxQty(productId) {
    var control = getCardControl(productId);
    if (!control) return null;
    var raw = control.getAttribute('data-max-quantity');
    if (raw === null || raw === '') return null;
    var max = Number(raw);
    return isFinite(max) ? Math.max(0, Math.floor(max)) : null;
  }

  function setCardQuantityState(productId, quantity) {
    var control = getCardControl(productId);
    var addBtn = getCardAddButton(productId);
    var qty = Math.max(0, parseInt(quantity, 10) || 0);

    if (control) {
      control.hidden = qty <= 0;
      var num = control.querySelector('.qty-num');
      if (num) num.textContent = String(qty);
      var minus = control.querySelector('[aria-label="Decrease quantity"]');
      var plus = control.querySelector('[aria-label="Increase quantity"]');
      var cardMaxQty = getCardMaxQty(productId);
      if (minus) minus.disabled = qty <= 0;
      if (plus) plus.disabled = cardMaxQty !== null && qty >= cardMaxQty;
    }

    /* ADD is available ONLY when this product has no quantity in cart. */
    if (addBtn) {
      addBtn.hidden = qty > 0;
      addBtn.disabled = qty > 0;
      if (qty > 0) {
        addBtn.classList.add('is-added');
        addBtn.setAttribute('aria-hidden', 'true');
      } else {
        addBtn.classList.remove('is-added');
        addBtn.removeAttribute('aria-hidden');
      }
    }
  }

  window.chQty = function (event, button, delta) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    var control = button && button.closest('[data-qty-control]');
    if (!control) return;

    var productId = control.getAttribute('data-product-id');

    /*
    * MULTI-VARIANT PRODUCT
    * Any click on +/- quantity buttons should open the
    * variant popup instead of directly changing the cart.
    */
    var isMultiVariant =
      control.getAttribute('data-has-multi-variants') === 'true' ||
      control.getAttribute('data-has-multi-variants') === 'True';

    if (isMultiVariant) {
      openQuickView(
        productId,
        control.getAttribute('data-variant-id')
      );
      return;
    }

    /*
    * SINGLE-VARIANT PRODUCT
    * Keep the existing direct quantity update behaviour.
    */
    var items = getCardCartItems(productId);

    if (!items.length) {
      setCardQuantityState(productId, 0);
      return;
    }

    var variantId = control.getAttribute('data-variant-id');
    var item = items.find(function (it) {
      return String(it.variant_id) === String(variantId);
    }) || items[0];

    if (!item) return;

    var key = item.key;
    var queue = ckQtyQueues[key];

    if (!queue) {
      queue = {
        target: parseInt(item.quantity, 10) || 0,
        running: false,
        productId: productId
      };

      ckQtyQueues[key] = queue;
    }

    queue.target = Math.max(
      0,
      queue.target + (parseInt(delta, 10) || 0)
    );

    var cardMaxQty = getCardMaxQty(productId);

    if (cardMaxQty !== null) {
      queue.target = Math.min(
        queue.target,
        cardMaxQty
      );
    }

    var otherQty = items.reduce(function (sum, it) {
      if (String(it.key) === String(key)) return sum;

      return sum + (parseInt(it.quantity, 10) || 0);
    }, 0);

    setCardQuantityState(
      productId,
      otherQty + queue.target
    );

    function process() {
      if (queue.running) return;

      queue.running = true;

      var target = queue.target;
      var fd = new FormData();

      fd.append('id', key);
      fd.append('quantity', target);

      fetch('/cart/change.js', {
        method: 'POST',
        body: fd,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (cart) {
          window.ckCart.items = cart.items || [];
          window.ckCart.quantity = cart.item_count || 0;
          window.ckCart.subtotal =
            cart.items_subtotal_price || 0;

          setCartBadge(window.ckCart.quantity);
          window.ckCart.render();

          if (queue.target !== target) {
            queue.running = false;
            process();
            return;
          }

          delete ckQtyQueues[key];
          syncCardButtons();
        })
        .catch(function () {
          delete ckQtyQueues[key];
          window.ckCart.load();
          showToast('Could not update quantity');
        });
    }

    process();
  };

  /* ---------- Cart (AJAX) ---------- */
  window.ckCart = {
    items: [], quantity: 0, subtotal: 0,
    load: function () {
      var self = this;
      return fetch('/cart.js', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          self.items = cart.items || [];
          self.quantity = cart.item_count || 0;
          self.subtotal = cart.items_subtotal_price || 0;
          setCartBadge(self.quantity);
          self.render();
          syncCardButtons();
        }).catch(function () { });
    },
    render: function () {
      var wrap = document.getElementById('ckCartItems');
      if (!wrap) return;
      var foot = document.getElementById('ckCartFoot');
      var empty = document.getElementById('ckCartEmpty');
      var sub = document.getElementById('ckCartSubtotal');
      wrap.innerHTML = '';
      if (!this.items.length) {
        if (empty) empty.style.display = 'block';
        if (foot) foot.style.display = 'none';
        return;
      }
      if (empty) empty.style.display = 'none';
      if (foot) foot.style.display = 'flex';
      if (sub) sub.textContent = fmtMoney(this.subtotal);
      var self = this;
      this.items.forEach(function (it) {
        var card = document.createElement('div');
        card.className = 'ck-cart-item';
        var img = '';

        if (it.featured_image && it.featured_image.url) {
          img =
            '<img src="' +
            it.featured_image.url +
            '" alt="' +
            (it.product_title || '') +
            '" loading="lazy">';
        }
        var variant = (it.variant_title && it.variant_title !== 'Default Title') ? '<div class="ck-ci-variant">' + it.variant_title + '</div>' : '';
        card.innerHTML = img +
          '<div class="ck-ci-info"><div class="ck-ci-title">' + (it.product_title || '') + '</div>' + variant +
          '<div class="ck-ci-price">' + fmtMoney(it.final_line_price) + '</div>' + (formatNativeUnitPrice(it.unit_price, it.unit_price_measurement) ? '<small class="unit-price caption"><span class="price-item price-item--last">' + formatNativeUnitPrice(it.unit_price, it.unit_price_measurement) + '</span></small>' : '') + '</div>' +
          '<div class="ck-ci-qty">' +
          '<button type="button" data-change="-1" data-key="' + it.key + '" aria-label="Decrease">\u2212</button>' +
          '<span>' + it.quantity + '</span>' +
          '<button type="button" data-change="1" data-key="' + it.key + '" aria-label="Increase">+</button>' +
          '</div>' +
          '<button type="button" class="ck-ci-remove" data-remove="' + it.key + '" aria-label="Remove">&times;</button>';
        wrap.appendChild(card);
      });
    },
    change: function (key, delta, evtEl) {
      var self = this;
      var it = this.items.find(function (x) { return x.key === key; });
      if (!it) return;
      var q = it.quantity + delta;
      if (q <= 0) { this.remove(key, evtEl); return; }
      setBusy(evtEl, true);
      var fd = new FormData();
      fd.append('id', key); fd.append('quantity', q);
      fetch('/cart/change.js', { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.json(); })
        .then(function (c) {
          self.items = c.items || [];
          self.quantity = c.item_count || 0;
          self.subtotal = c.items_subtotal_price || 0;
          setCartBadge(self.quantity);
          self.render();
          syncCardButtons();
          setBusy(evtEl, false);
        })
        .catch(function () { setBusy(evtEl, false); });
    },
    remove: function (key, evtEl) {
      var self = this;
      setBusy(evtEl, true);
      var fd = new FormData();
      fd.append('id', key); fd.append('quantity', 0);
      fetch('/cart/change.js', { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.json(); })
        .then(function (c) {
          self.items = c.items || [];
          self.quantity = c.item_count || 0;
          self.subtotal = c.items_subtotal_price || 0;
          setCartBadge(self.quantity);
          self.render();
          syncCardButtons();
          setBusy(evtEl, false);
        })
        .catch(function () { setBusy(evtEl, false); });
    }
  };

  /* ---------- Add to cart helper (with per-button loader) ---------- */
  function addToCart(variantId, qty, btn) {
    qty = qty || 1;
    setBusy(btn, true);
    var fd = new FormData();
    fd.append('id', variantId);
    fd.append('quantity', qty);
    return fetch('/cart/add.js', { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function (r) { return r.json(); })
      .then(function () {
        setBusy(btn, false);
        return window.ckCart.load();
      })
      .then(function () {
        /* Card buttons are synchronized from the live cart. Quick-view's
           Add to Cart button intentionally stays Add to Cart. */
        showToast('Added to cart');
        syncCardButtons();
      })
      .catch(function () { setBusy(btn, false); showToast('Could not add to cart'); });
  }
  window.ckAddToCart = addToCart;
  window.addToCart = function (evt, btn) {
    if (evt) { evt.preventDefault(); evt.stopPropagation(); }
    var id = btn && (btn.getAttribute('data-id') || btn.dataset.id);
    if (id) addToCart(id, 1, btn);
  };

  var quickView = {
    root: document.getElementById('ckQuickAddModal'),
    title: document.getElementById('ckQvTitle'),
    rating: document.getElementById('ckQvRating'),
    thumbs: document.getElementById('ckQvThumbs'),
    main: document.getElementById('ckQvMain'),
    variants: document.getElementById('ckQvVariants'),
    qty: document.getElementById('ckQvQty'),
    price: document.getElementById('ckQvPrice'),
    unit: document.getElementById('ckQvUnit'),
    addBtn: document.getElementById('ckQvAddBtn'),
    message: document.getElementById('ckQvAddedMessage'),
    stock: document.getElementById('ckQvStock'),
    state: { product: null, variant: null, images: [], imageIndex: 0, qty: 1 }
  };

  function getQuickAddData(productId) {
    var el = document.getElementById('QuickAddData-' + productId);
    if (!el) return null;
    try { return JSON.parse(el.textContent || '{}'); } catch (e) { return null; }
  }

  function getVariantCartQty(variantId) {
    var item = (window.ckCart.items || []).find(function (it) { return String(it.variant_id) === String(variantId); });
    return item ? (parseInt(item.quantity, 10) || 0) : 0;
  }

  function quickViewUnitPrice(variant) {
    if (!variant) return '';
    return variant.unit_price_display || formatNativeUnitPrice(variant.unit_price, variant.unit_price_measurement);
  }

  function quickViewGalleryFor(variant, product) {
    if (variant && Array.isArray(variant.gallery) && variant.gallery.length) return variant.gallery;
    if (product && Array.isArray(product.fallback_gallery) && product.fallback_gallery.length) return product.fallback_gallery;
    if (variant && variant.featured_image) {
      return [{ src: variant.featured_image, full: variant.featured_image, alt: (product && product.title) || '' }];
    }
    return [];
  }

  function isQuickViewVideoItem(item) {
    if (!item) return false;
    return item.type === 'video' || item.type === 'external_video' || !!item.video_url || !!item.url && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(item.url);
  }

  function renderQuickViewImage(index) {
    if (!quickView.main) return;
    var images = quickView.state.images || [];
    if (!images.length) {
      quickView.main.innerHTML = '';
      return;
    }
    if (index < 0) index = images.length - 1;
    if (index > images.length - 1) index = 0;
    quickView.state.imageIndex = index;
    var im = images[index];
    if (isQuickViewVideoItem(im)) {
      var video = document.createElement('video');
      video.className = 'ck-qv-main-video';
      video.src = im.video_url || im.src || '';
      video.poster = im.full || im.src || '';
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      quickView.main.innerHTML = '';
      quickView.main.appendChild(video);
      video.play().catch(function () {});
    } else {
      quickView.main.innerHTML = '<img src="' + (im.src || '') + '" alt="' + (im.alt || '') + '">';
    }
    
    if (quickView.thumbs) {
      Array.prototype.forEach.call(quickView.thumbs.querySelectorAll('button'), function (btn, idx) {
        btn.classList.toggle('active', idx === index);
      });
    }
  }

  function getVariantMaxQty(variant) {
    if (!variant) return null;
    var max = null;
    /* Shopify-managed inventory with policy=deny must never exceed the
       inventory quantity shown in Admin. */
    if (variant.inventory_management === 'shopify' && variant.inventory_policy !== 'continue') {
      var inventory = Number(variant.inventory_quantity);
      if (isFinite(inventory)) max = Math.max(0, Math.floor(inventory));
    }
    /* Also respect an explicit Shopify quantity-rule maximum when present. */
    var ruleMax = Number(variant.quantity_rule_max);
    if (isFinite(ruleMax) && ruleMax > 0) {
      max = max === null ? Math.floor(ruleMax) : Math.min(max, Math.floor(ruleMax));
    }
    return max;
  }

  function renderQuickView(product, variantId) {
    if (!quickView.root || !product || !Array.isArray(product.variants)) return;
    /* renderQuickView is also used when the customer switches variants inside
       the popup, so an explicit variantId must always win. The initial
       openQuickView call resolves an already-carted variant before reaching
       here, which preserves the previous selection when reopening. */
    var selected = product.variants.find(function (v) { return String(v.id) === String(variantId); })
      || product.variants.find(function (v) { return v.available; })
      || product.variants[0];
    quickView.state.product = product;
    quickView.state.variant = selected;
    quickView.state.images = quickViewGalleryFor(selected, product);
    /* Keep the real cart quantity when reopening/changing variants. */
    var selectedCartQty = getVariantCartQty(selected && selected.id);
    var maxQty = getVariantMaxQty(selected);
    if (selectedCartQty > 0) {
      quickView.state.qty = maxQty !== null ? Math.min(selectedCartQty, maxQty) : selectedCartQty;
    } else {
      quickView.state.qty = maxQty !== null ? Math.min(1, maxQty) : 1;
    }
    quickView.state.imageIndex = 0;
    var qvShellBusy = quickView.main ? quickView.main.closest('.ck-qv-main-shell') : null;
    if (qvShellBusy) qvShellBusy.classList.add('is-loading');
    if (quickView.qty) quickView.qty.textContent = String(quickView.state.qty);
    if (quickView.message) { quickView.message.hidden = true; quickView.message.textContent = ''; }
    if (quickView.title) quickView.title.textContent = product.title || '';
    if (quickView.price) quickView.price.textContent = selected && selected.price_display ? selected.price_display : '';
    if (quickView.unit) {
      var unitText = quickViewUnitPrice(selected);
      quickView.unit.textContent = unitText;
      quickView.unit.hidden = !unitText;
    }
    if (quickView.rating) {
      if (product.rating_text) {
        quickView.rating.hidden = false;
        quickView.rating.innerHTML = '<span class="stars">★★★★★</span><span>' + product.rating_text + '</span>';
      } else {
        quickView.rating.hidden = true;
        quickView.rating.innerHTML = '';
      }
    }
    if (quickView.stock) {
      quickView.stock.innerHTML = selected && selected.available ? '<i class="bi bi-check-circle-fill"></i> In Stock' : '<i class="bi bi-x-circle-fill"></i> Sold Out';
      quickView.stock.classList.toggle('is-out', !(selected && selected.available));
    }
    if (quickView.addBtn) {
      quickView.addBtn.disabled = !(selected && selected.available) || (maxQty !== null && quickView.state.qty === 0);
      quickView.addBtn.textContent = selected && selected.available ? (selectedCartQty > 0 ? 'Update Cart' : 'Add to Cart') : 'Sold Out';
    }
    var qvPlus = quickView.root ? quickView.root.querySelector('[data-ck-qv-qty="plus"]') : null;
    var qvMinus = quickView.root ? quickView.root.querySelector('[data-ck-qv-qty="minus"]') : null;
    if (qvMinus) qvMinus.disabled = quickView.state.qty <= 0 || selectedCartQty <= 0;
    if (qvPlus) qvPlus.disabled = maxQty !== null && quickView.state.qty >= maxQty;
    if (quickView.variants) {
      quickView.variants.innerHTML = '';
      product.variants.forEach(function (variant) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ck-qv-variant' + (selected && String(selected.id) === String(variant.id) ? ' active' : '');
        btn.setAttribute('data-ck-qv-variant', variant.id);
        if (!variant.available) btn.classList.add('is-sold-out');
        btn.innerHTML = '<span>' + (variant.title || '') + '</span>' + (variant.price_display ? '<small>' + variant.price_display + '</small>' : '');
        quickView.variants.appendChild(btn);
      });
    }
    if (quickView.thumbs) {
      quickView.thumbs.innerHTML = '';
      (quickView.state.images || []).forEach(function (image, index) {
        var isVideo = isQuickViewVideoItem(image);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-ck-qv-thumb', index);
        if (isVideo) btn.classList.add('ck-qv-thumb-video');

        var thumbMarkup = '<img src="' + (image.full || image.src || '') + '" alt="' + (image.alt || '') + '">';
        if (isVideo) {
          thumbMarkup += '<span class="ck-qv-video-play">▶</span>';
        }

        btn.innerHTML = thumbMarkup;
        quickView.thumbs.appendChild(btn);
      });
    }
    renderQuickViewImage(0);
    if (qvShellBusy) setTimeout(function () { qvShellBusy.classList.remove('is-loading'); }, 340);
  }

  function openQuickView(productId, variantId) {
    var product = getQuickAddData(productId);
    if (!product || !quickView.root) return false;
    /* If this product already has a cart line, reopen the popup on that exact
       variant so the customer can continue changing its quantity. */
    var cartItems = getCardCartItems(productId);
    if (cartItems.length) {
      var matching = variantId && cartItems.find(function (it) { return String(it.variant_id) === String(variantId); });
      var selectedCartItem = matching || cartItems[0];
      if (selectedCartItem) variantId = selectedCartItem.variant_id;
    }
    renderQuickView(product, variantId);
    quickView.root.classList.add('open');
    quickView.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ck-qv-open');
    return true;
  }

  function closeQuickView() {
    if (!quickView.root) return;
    quickView.root.classList.remove('open');
    quickView.root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ck-qv-open');
  }

  /* quick-add delegation (product cards) */
  document.addEventListener('click', function (e) {
    var qc = e.target.closest('[data-qty-control]');
    if (qc) {
      e.preventDefault();
      e.stopPropagation();
      if (qc.getAttribute('data-has-multi-variants') === 'true' || qc.getAttribute('data-has-multi-variants') === 'True') {
        openQuickView(qc.getAttribute('data-product-id'), qc.getAttribute('data-variant-id'));
      }
      return;
    }

    var qa = e.target.closest('[data-quick-add]');
    if (qa) {
      e.preventDefault();
      e.stopPropagation();
      if (qa.classList.contains('is-added')) { openCart(); return; }
      if (qa.getAttribute('data-has-multi-variants') === 'true' || qa.getAttribute('data-has-multi-variants') === 'True') {
        if (openQuickView(qa.getAttribute('data-product-id'), qa.getAttribute('data-id'))) return;
      }
      addToCart(qa.getAttribute('data-id'), 1, qa);
    }

    if (
      e.target.closest('[data-ck-qv-close], #ckQvClose') ||
      (quickView.root && e.target === quickView.root)
    ) closeQuickView();

    var qvThumb = e.target.closest('[data-ck-qv-thumb]');
    if (qvThumb) {
      e.preventDefault();
      renderQuickViewImage(parseInt(qvThumb.getAttribute('data-ck-qv-thumb'), 10) || 0);
    }

    var qvVariant = e.target.closest('[data-ck-qv-variant]');
    if (qvVariant && quickView.state.product) {
      e.preventDefault();
      renderQuickView(quickView.state.product, qvVariant.getAttribute('data-ck-qv-variant'));
    }

    var qvQty = e.target.closest('[data-ck-qv-qty]');
    if (qvQty && quickView.qty) {
      e.preventDefault();
      var isPlus = qvQty.getAttribute('data-ck-qv-qty') === 'plus';
      var next = quickView.state.qty + (isPlus ? 1 : -1);
      var existingQty = getVariantCartQty(quickView.state.variant && quickView.state.variant.id);
      var maxQty = getVariantMaxQty(quickView.state.variant);
      /* A variant already in the cart can be reduced to zero. New variants
         start at 1. Never allow the popup quantity above Admin inventory. */
      if (existingQty > 0) {
        quickView.state.qty = Math.max(0, next);
      } else {
        quickView.state.qty = Math.max(1, next);
      }
      if (maxQty !== null) quickView.state.qty = Math.min(quickView.state.qty, maxQty);
      quickView.qty.textContent = String(quickView.state.qty);
      var qvMaxAfter = getVariantMaxQty(quickView.state.variant);
      var qvPlusAfter = quickView.root ? quickView.root.querySelector('[data-ck-qv-qty="plus"]') : null;
      var qvMinusAfter = quickView.root ? quickView.root.querySelector('[data-ck-qv-qty="minus"]') : null;
      if (qvPlusAfter) qvPlusAfter.disabled = qvMaxAfter !== null && quickView.state.qty >= qvMaxAfter;
      if (qvMinusAfter) qvMinusAfter.disabled = quickView.state.qty <= 0 || existingQty <= 0;
      if (quickView.addBtn) {
        quickView.addBtn.textContent = quickView.state.qty === 0 ? 'Add to Cart' : 'Update Cart';
      }
    }

    if (e.target.closest('#ckQvAddBtn') && quickView.state.variant) {
      e.preventDefault();
      e.stopPropagation();
      var qvBtn = document.getElementById('ckQvAddBtn');
      var variant = quickView.state.variant;
      var requestedQty = parseInt(quickView.state.qty, 10);
      if (!isFinite(requestedQty)) requestedQty = 1;
      var existingItem = (window.ckCart.items || []).find(function (it) { return String(it.variant_id) === String(variant.id); });
      var desiredQty = existingItem ? Math.max(0, requestedQty) : Math.max(1, requestedQty);
      var maxQty = getVariantMaxQty(variant);
      if (maxQty !== null) desiredQty = Math.min(desiredQty, maxQty);
      if (!existingItem && desiredQty < 1) { showToast('This variant is out of stock'); return; }
      if (!variant.available && desiredQty > 0) return;

      /* IMPORTANT: the popup quantity is an absolute cart quantity.
         If 6 are already in the cart and the popup shows 8, clicking
         Add to Cart must SET 8, not add another 8 (which would make 14).
         Setting it to 0 removes that exact variant line. */
      var request;
      if (existingItem && existingItem.key) {
        var changeFd = new FormData();
        changeFd.append('id', existingItem.key);
        changeFd.append('quantity', desiredQty);
        if (qvBtn) setBusy(qvBtn, true);
        request = fetch('/cart/change.js', {
          method: 'POST',
          body: changeFd,
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
      } else {
        request = addToCart(variant.id, desiredQty, qvBtn);
      }

      Promise.resolve(request)
        .then(function (result) {
          /* addToCart already reloads the cart; cart/change returns the cart. */
          if (result && result.items && window.ckCart) {
            window.ckCart.items = result.items || [];
            window.ckCart.quantity = result.item_count || 0;
            window.ckCart.subtotal = result.items_subtotal_price || 0;
            setCartBadge(window.ckCart.quantity);
            window.ckCart.render();
          }
          return (existingItem ? window.ckCart.load() : Promise.resolve());
        })
        .then(function () {
          quickView.state.qty = getVariantCartQty(variant.id);
          if (quickView.qty) quickView.qty.textContent = String(quickView.state.qty);

          var wasRemoved = quickView.state.qty === 0;
          if (quickView.message) {
            quickView.message.hidden = false;
            quickView.message.innerHTML = wasRemoved
              ? '<i class="bi bi-check-circle-fill"></i> Removed from cart'
              : '<i class="bi bi-check-circle-fill"></i> Updated cart';
          }
          if (qvBtn) {
            setBusy(qvBtn, false);
            qvBtn.textContent = wasRemoved ? 'Add to Cart' : 'Update Cart';
          }
        })
        .catch(function () {
          if (qvBtn) setBusy(qvBtn, false);
          showToast('Could not update cart');
        });
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeQuickView();
  });

  /* ---------- Cart drawer ---------- */
  function openCart() {
    var d = document.getElementById('ckCartDrawer');
    if (!d) return;
    d.classList.add('open');
    d.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.ckCart.load();
  }
  window.openCart = openCart;
  function closeCart() {
    var d = document.getElementById('ckCartDrawer');
    if (!d) return;
    d.classList.remove('open');
    d.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  window.closeCart = closeCart;

  document.addEventListener('click', function (e) {
    if (e.target.closest('#cartBtn') || e.target.closest('#mobCartBtn')) { e.preventDefault(); openCart(); return; }
    var cartDrawer = document.getElementById('ckCartDrawer');
    if (e.target.closest('#ckCartClose') || (cartDrawer && cartDrawer.classList.contains('open') && !e.target.closest('.ck-drawer-panel'))) closeCart();
    var ch = e.target.closest('[data-change]');
    if (ch) { var qrow = ch.closest('.ck-ci-qty'); window.ckCart.change(ch.getAttribute('data-key'), parseInt(ch.getAttribute('data-change'), 10), qrow); }
    var rm = e.target.closest('[data-remove]');
    if (rm) { window.ckCart.remove(rm.getAttribute('data-remove'), rm); }
  });

  /* ---------- Wishlist - Account Specific ---------- */

var WL_KEY_PREFIX = 'ck_wish_';
var WL_PENDING_KEY = 'ck_pending_wish';


/* ---------- Customer ---------- */

function isCustomerLoggedIn() {

  var body = document.body;

  if (!body) return false;

  return body.getAttribute(
    'data-customer-logged-in'
  ) === 'true';
}


function getCustomerId() {

  var body = document.body;

  if (!body) return '';

  return body.getAttribute(
    'data-customer-id'
  ) || '';
}


/* ---------- Account Specific Wishlist Key ---------- */

function getWishlistKey() {

  var customerId =
    getCustomerId();

  if (!customerId) {
    return null;
  }

  return WL_KEY_PREFIX +
    String(customerId);
}


/* ---------- Get Wishlist ---------- */

function getWish() {

  /*
   * NEVER show wishlist to guest.
   */

  if (!isCustomerLoggedIn()) {
    return [];
  }


  var key =
    getWishlistKey();


  if (!key) {
    return [];
  }


  try {

    return JSON.parse(
      localStorage.getItem(key) || '[]'
    );

  } catch (e) {

    return [];
  }
}


/* ---------- Save Wishlist ---------- */

function setWish(a) {

  /*
   * Never save wishlist without
   * a logged-in customer.
   */

  if (!isCustomerLoggedIn()) {
    return;
  }


  var key =
    getWishlistKey();


  if (!key) {
    return;
  }


  localStorage.setItem(
    key,
    JSON.stringify(a)
  );


  updateWishBadges();
}


/* ---------- Clear Visible Wishlist ---------- */

function clearGuestWishlistUI() {

  var wrap =
    document.getElementById(
      'ckWishItems'
    );

  var empty =
    document.getElementById(
      'ckWishEmpty'
    );


  if (wrap) {
    wrap.innerHTML = '';
  }


  if (empty) {
    empty.style.display =
      'block';
  }


  updateWishBadges();
}


/* ---------- Wishlist Badge ---------- */

function updateWishBadges() {

  var n =
    isCustomerLoggedIn()
      ? getWish().length
      : 0;


  [
    'wishCount',
    'mobWishCount'
  ].forEach(
    function (id) {

      var el =
        document.getElementById(id);


      if (el) {

        el.textContent = n;

        el.style.display =
          n > 0
            ? 'grid'
            : 'none';
      }

    }
  );
}


/* ---------- Login Redirect ---------- */

function redirectToLoginForWishlist(btn) {

  if (!btn) return;


  var pending = {

    id:
      String(
        btn.getAttribute(
          'data-id'
        ) || ''
      ),

    variantId:
      String(
        btn.getAttribute(
          'data-variant-id'
        ) || ''
      ),

    available:
      btn.getAttribute(
        'data-available'
      ) === 'true',

    title:
      btn.getAttribute(
        'data-title'
      ) || '',

    price:
      btn.getAttribute(
        'data-price'
      ) || '',

    image:
      btn.getAttribute(
        'data-image'
      ) || '',

    url:
      btn.getAttribute(
        'data-url'
      ) || ''
  };


  try {

    sessionStorage.setItem(
      WL_PENDING_KEY,
      JSON.stringify(
        pending
      )
    );

  } catch (e) {}


  var returnUrl =
    window.location.pathname +
    window.location.search +
    window.location.hash;


  window.location.href =
    '/account/login?return_url=' +
    encodeURIComponent(
      returnUrl
    );
}


/* ---------- Process Pending Wishlist ---------- */

function processPendingWishlist() {

  if (!isCustomerLoggedIn()) {
    return;
  }


  var raw = null;


  try {

    raw =
      sessionStorage.getItem(
        WL_PENDING_KEY
      );

  } catch (e) {

    return;
  }


  if (!raw) {
    return;
  }


  var pending;


  try {

    pending =
      JSON.parse(raw);

  } catch (e) {

    try {

      sessionStorage.removeItem(
        WL_PENDING_KEY
      );

    } catch (err) {}

    return;
  }


  if (
    !pending ||
    !pending.id
  ) {

    try {

      sessionStorage.removeItem(
        WL_PENDING_KEY
      );

    } catch (e) {}

    return;
  }


  /*
   * IMPORTANT:
   *
   * getWish() now automatically uses
   * the CURRENT customer's ID.
   *
   * So pending item is added only
   * to the account that just logged in.
   */

  var wishlist =
    getWish();


  var exists =
    wishlist.some(
      function (item) {

        return String(
          item.id
        ) === String(
          pending.id
        );

      }
    );


  if (!exists) {

    wishlist.push({

      id:
        String(
          pending.id
        ),

      variantId:
        String(
          pending.variantId || ''
        ),

      available:
        pending.available === true,

      title:
        pending.title || '',

      price:
        pending.price || '',

      image:
        pending.image || '',

      url:
        pending.url || ''
    });


    setWish(
      wishlist
    );
  }


  try {

    sessionStorage.removeItem(
      WL_PENDING_KEY
    );

  } catch (e) {}


  markWishActive();

  updateWishBadges();

  showToast(
    'Added to wishlist'
  );
}


/* ---------- Toggle Wishlist ---------- */

function toggleWish(btn) {

  if (!btn) return;


  /*
   * Login required.
   */

  if (!isCustomerLoggedIn()) {

    redirectToLoginForWishlist(
      btn
    );

    return;
  }


  var id =
    btn.getAttribute(
      'data-id'
    );


  var variantId =
    btn.getAttribute(
      'data-variant-id'
    );


  var available =
    btn.getAttribute(
      'data-available'
    ) === 'true';


  var wishlist =
    getWish();


  var index =
    wishlist.findIndex(
      function (item) {

        return String(
          item.id
        ) === String(
          id
        );

      }
    );


  /*
   * REMOVE
   */

  if (index > -1) {

    wishlist.splice(
      index,
      1
    );


    btn.classList.remove(
      'active'
    );


    showToast(
      'Removed from wishlist'
    );
  }


  /*
   * ADD
   */

  else {

    wishlist.push({

      id:
        String(id),

      variantId:
        String(
          variantId || ''
        ),

      available:
        available,

      title:
        btn.getAttribute(
          'data-title'
        ) || '',

      price:
        btn.getAttribute(
          'data-price'
        ) || '',

      image:
        btn.getAttribute(
          'data-image'
        ) || '',

      url:
        btn.getAttribute(
          'data-url'
        ) || ''
    });


    btn.classList.add(
      'active'
    );


    showToast(
      'Added to wishlist'
    );
  }


  setWish(
    wishlist
  );


  renderWish();
}


window.toggleWish =
  toggleWish;


/* ---------- Check Current Cart ---------- */

function isWishlistVariantInCart(
  variantId
) {

  if (!variantId) {
    return false;
  }


  var items =
    window.ckCart &&
    Array.isArray(
      window.ckCart.items
    )
      ? window.ckCart.items
      : [];


  return items.some(
    function (item) {

      return String(
        item.variant_id
      ) === String(
        variantId
      );

    }
  );
}


/* ---------- Render Wishlist ---------- */

function renderWish() {

  var wrap =
    document.getElementById(
      'ckWishItems'
    );


  if (!wrap) return;


  var empty =
    document.getElementById(
      'ckWishEmpty'
    );


  /*
   * Guest = empty.
   */

  if (!isCustomerLoggedIn()) {

    wrap.innerHTML = '';

    if (empty) {
      empty.style.display =
        'block';
    }

    updateWishBadges();

    return;
  }


  var wishlist =
    getWish();


  wrap.innerHTML = '';


  if (empty) {

    empty.style.display =
      wishlist.length
        ? 'none'
        : 'block';
  }


  wishlist.forEach(
    function (item) {

      var card =
        document.createElement(
          'div'
        );


      card.className =
        'ck-wish-item';


      var variantId =
        String(
          item.variantId || ''
        );


      var alreadyInCart =
        isWishlistVariantInCart(
          variantId
        );


      var available =
        item.available === true;


      var buttonHTML;


      /*
       * OUT OF STOCK
       */

      if (
        !variantId ||
        !available
      ) {

        buttonHTML =
          '<button type="button" ' +
          'class="ck-wi-add ck-wi-out-of-stock" ' +
          'disabled>' +
          '<span>Out of stock</span>' +
          '</button>';
      }


      /*
       * ALREADY IN CART
       */

      else if (
        alreadyInCart
      ) {

        buttonHTML =
          '<button type="button" ' +
          'class="ck-wi-add ck-wi-already-cart" ' +
          'disabled>' +
          '<span>Already in cart</span>' +
          '</button>';
      }


      /*
       * AVAILABLE
       */

      else {

        buttonHTML =
          '<button type="button" ' +
          'class="ck-wi-add" ' +
          'data-add-variant="' +
          variantId +
          '">' +
          '<span>Add to cart</span>' +
          '</button>';
      }


      card.innerHTML =

        (
          item.image
            ? '<img src="' +
              item.image +
              '" alt="">'
            : ''
        ) +

        '<div class="ck-wi-info">' +

        '<a class="ck-wi-title" href="' +
        (
          item.url ||
          '#'
        ) +
        '">' +
        (
          item.title ||
          ''
        ) +
        '</a>' +

        '<div class="ck-wi-price">' +
        (
          item.price ||
          ''
        ) +
        '</div>' +

        buttonHTML +

        '</div>' +

        '<button type="button" ' +
        'class="ck-ci-remove" ' +
        'data-remove-wish="' +
        String(item.id) +
        '" ' +
        'aria-label="Remove">' +
        '&times;' +
        '</button>';


      wrap.appendChild(
        card
      );
    }
  );


  updateWishBadges();
}


/* ---------- Wishlist Add To Cart ---------- */

function wishlistAddToCart(
  button
) {

  if (!button) return;


  var variantId =
    button.getAttribute(
      'data-add-variant'
    );


  if (!variantId) {

    showToast(
      'This item is unavailable'
    );

    return;
  }


  /*
   * Prevent double click.
   */

  if (
    button.disabled ||
    button.classList.contains(
      'is-loading'
    )
  ) {

    return;
  }


  /*
   * LIVE CART CHECK
   */

  if (
    isWishlistVariantInCart(
      variantId
    )
  ) {

    button.disabled =
      true;


    button.innerHTML =
      '<span>Already in cart</span>';


    showToast(
      'Already in cart'
    );


    return;
  }


  /*
   * Existing site's loader.
   */

  if (
    typeof addToCart !==
    'function'
  ) {

    showToast(
      'Unable to add this item'
    );

    return;
  }


  /*
   * Existing addToCart()
   * handles the same loader
   * used by the website.
   */

  addToCart(
    variantId,
    1,
    button
  )
  .then(
    function () {

      /*
       * Refresh wishlist button
       * based on live cart state.
       */

      renderWish();
    }
  );
}


/* ---------- Wishlist Click Handler ---------- */

document.addEventListener(
  'click',
  function (e) {

    var wish =
      e.target.closest(
        '[data-wish]'
      );


    if (wish) {

      e.preventDefault();

      e.stopPropagation();

      toggleWish(
        wish
      );

      return;
    }


    var add =
      e.target.closest(
        '[data-add-variant]'
      );


    if (add) {

      e.preventDefault();

      e.stopPropagation();

      wishlistAddToCart(
        add
      );

      return;
    }


    var remove =
      e.target.closest(
        '[data-remove-wish]'
      );


    if (remove) {

      e.preventDefault();

      e.stopPropagation();


      var id =
        remove.getAttribute(
          'data-remove-wish'
        );


      setWish(
        getWish().filter(
          function (item) {

            return String(
              item.id
            ) !== String(
              id
            );

          }
        )
      );


      renderWish();

      markWishActive();

      return;
    }

  }
);


/* ---------- Open Wishlist ---------- */

function openWish() {

  /*
   * Guest cannot see wishlist.
   */

  if (!isCustomerLoggedIn()) {

    var returnUrl =
      window.location.pathname +
      window.location.search +
      window.location.hash;


    window.location.href =
      '/account/login?return_url=' +
      encodeURIComponent(
        returnUrl
      );


    return;
  }


  var drawer =
    document.getElementById(
      'ckWishDrawer'
    );


  if (!drawer) return;


  /*
   * Load current cart first.
   * This ensures "Already in cart"
   * is accurate.
   */

  if (
    window.ckCart &&
    typeof window.ckCart.load ===
      'function'
  ) {

    window.ckCart.load()
      .then(
        function () {

          renderWish();

        }
      )
      .catch(
        function () {

          renderWish();

        }
      );

  }

  else {

    renderWish();

  }


  drawer.classList.add(
    'open'
  );


  drawer.setAttribute(
    'aria-hidden',
    'false'
  );


  document.body.style.overflow =
    'hidden';
}


window.openWish =
  openWish;


/* ---------- Close Wishlist ---------- */

function closeWish() {

  var drawer =
    document.getElementById(
      'ckWishDrawer'
    );


  if (!drawer) return;


  drawer.classList.remove(
    'open'
  );


  drawer.setAttribute(
    'aria-hidden',
    'true'
  );


  document.body.style.overflow =
    '';
}


window.closeWish =
  closeWish;


/* ---------- Wishlist Drawer Buttons ---------- */

document.addEventListener(
  'click',
  function (e) {

    if (
      e.target.closest(
        '#wishBtn'
      ) ||
      e.target.closest(
        '#mobWishBtn'
      )
    ) {

      e.preventDefault();

      openWish();
    }


    if (
      e.target.closest(
        '#ckWishClose'
      ) ||
      e.target.closest(
        '#ckWishBd'
      )
    ) {

      closeWish();
    }

  }
);


/* ---------- Mark Wishlist Active ---------- */

function markWishActive() {

  var wishlist =
    getWish();


  document
    .querySelectorAll(
      '[data-wish]'
    )
    .forEach(
      function (button) {

        var id =
          button.getAttribute(
            'data-id'
          );


        var exists =
          wishlist.some(
            function (item) {

              return String(
                item.id
              ) === String(
                id
              );

            }
          );


        button.classList.toggle(
          'active',
          exists
        );
      }
    );
}

  /* ---------- Loader ---------- */
  var loader = document.getElementById('cookmeLoader');
  if (loader) {
    function hideLoader() { loader.classList.add('hide'); setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 650); }
    window.addEventListener('load', hideLoader);
    setTimeout(function () { if (!loader.classList.contains('hide')) hideLoader(); }, 3000);
  }

  /* ---------- Sticky header ---------- */
  var nav = document.getElementById('mainNav');
  if (nav) {
    window.addEventListener('scroll', function () { nav.classList.toggle('scrolled', window.scrollY > 50); }, { passive: true });
  }

  /* ---------- Dynamic Pincode & Delivery Checker ---------- */
  var CK_PIN_KEY = 'ck_pincode';
  var CK_LOC_KEY = 'ck_pincode_location';
  var CK_STATE_KEY = 'ck_pincode_state';

  var ckPincode = {
    get: function () {
      return {
        pincode: localStorage.getItem(CK_PIN_KEY) || '',
        location: localStorage.getItem(CK_LOC_KEY) || '',
        state: localStorage.getItem(CK_STATE_KEY) || ''
      };
    },
    isWestBengal: function (pin, state) {
      if (state && typeof state === 'string') {
        var s = state.trim().toLowerCase();
        if (s === 'west bengal' || s.indexOf('west bengal') !== -1 || s === 'wb') {
          return true;
        }
        if (s.length > 0) {
          return false;
        }
      }
      if (!pin) return null;
      var clean = String(pin).replace(/\D/g, '').slice(0, 6);
      if (clean.length !== 6) return null;
      var p2 = clean.slice(0, 2);
      var p3 = clean.slice(0, 3);
      if (p2 === '70' || p2 === '71' || p2 === '72') {
        return true;
      }
      if (p2 === '73' && p3 !== '737') {
        return true;
      }
      if (p2 === '74' && p3 !== '744') {
        return true;
      }
      return false;
    },
    isOutOfWestBengal: function (pin, state) {
      var outOfWb = localStorage.getItem('ck_out_of_wb');
      if (typeof pin === 'undefined' && typeof state === 'undefined' && outOfWb !== null) {
        return outOfWb === 'true';
      }
      var saved = this.get();
      var p = (typeof pin !== 'undefined' && pin !== null) ? pin : saved.pincode;
      var s = (typeof state !== 'undefined' && state !== null) ? state : saved.state;
      if (!p && !s) {
        if (outOfWb !== null) return outOfWb === 'true';
        return false;
      }
      var wb = this.isWestBengal(p, s);
      if (wb === null) return false;
      return wb === false;
    },
    checkAndRedirect: function (isOutOfWB) {
      if (typeof isOutOfWB === 'undefined') {
        isOutOfWB = this.isOutOfWestBengal();
      }
      var pathname = window.location.pathname.replace(/\/+$/, '');
      if (isOutOfWB === true) {
        if (pathname === '/collections/all' || pathname.indexOf('/collections/all/') === 0 || pathname === '/collections/west-bengal' || pathname.indexOf('/collections/west-bengal/') === 0) {
          var target = pathname.replace(/^\/collections\/(all|west-bengal)(?=[\/?#]|$)/i, '/collections/india') + window.location.search + window.location.hash;
          window.location.replace(target);
        }
      } else {
        if (pathname === '/collections/india' || pathname.indexOf('/collections/india/') === 0 || pathname === '/collections/all' || pathname.indexOf('/collections/all/') === 0) {
          var target = pathname.replace(/^\/collections\/(india|all)(?=[\/?#]|$)/i, '/collections/west-bengal') + window.location.search + window.location.hash;
          window.location.replace(target);
        }
      }
    },
    redirectOnLocationSet: function (isOutOfWB) {
      if (typeof isOutOfWB === 'undefined') {
        isOutOfWB = this.isOutOfWestBengal();
      }
      var pathname = window.location.pathname.replace(/\/+$/, '');
      if (isOutOfWB === true) {
        if (pathname === '/collections/all' || pathname.indexOf('/collections/all/') === 0 || pathname === '/collections/west-bengal' || pathname.indexOf('/collections/west-bengal/') === 0) {
          var target = pathname.replace(/^\/collections\/(all|west-bengal)(?=[\/?#]|$)/i, '/collections/india') + window.location.search + window.location.hash;
          if (window.location.pathname !== '/collections/india') {
            window.location.href = target;
          }
        }
      } else {
        if (pathname === '/collections/india' || pathname.indexOf('/collections/india/') === 0 || pathname === '/collections/all' || pathname.indexOf('/collections/all/') === 0) {
          var target = pathname.replace(/^\/collections\/(india|all)(?=[\/?#]|$)/i, '/collections/west-bengal') + window.location.search + window.location.hash;
          if (window.location.pathname !== '/collections/west-bengal') {
            window.location.href = target;
          }
        }
      }
    },
    updateLocationClasses: function (isOutOfWB) {
      if (typeof isOutOfWB === 'undefined') {
        isOutOfWB = this.isOutOfWestBengal();
      }
      if (isOutOfWB === true) {
        document.documentElement.classList.add('ck-loc-india');
        document.documentElement.classList.remove('ck-loc-wb');
      } else {
        document.documentElement.classList.add('ck-loc-wb');
        document.documentElement.classList.remove('ck-loc-india');
      }
      if (window.ckCheckLocationGrids) {
        window.ckCheckLocationGrids();
      }
    },
    updateLinks: function () {
      var isOut = this.isOutOfWestBengal();
      var links = document.querySelectorAll('a[href*="/collections/all"], a[href*="/collections/india"], a[href*="/collections/west-bengal"]');
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        var href = link.getAttribute('href');
        if (!href) continue;
        if (!link.dataset.ckOriginalHref) {
          link.dataset.ckOriginalHref = href;
        }
        var orig = link.dataset.ckOriginalHref;
        if (isOut === true) {
          link.setAttribute('href', orig.replace(/\/collections\/(all|west-bengal)(?=[\/?#]|$)/i, '/collections/india'));
        } else {
          link.setAttribute('href', orig.replace(/\/collections\/(all|india)(?=[\/?#]|$)/i, '/collections/west-bengal'));
        }
      }
    },
    setLabel: function (text) {
      var lbl = document.getElementById('locLabel');
      if (lbl) {
        lbl.innerHTML = text + ' <i class="bi bi-chevron-down" style="font-size:11px"></i>';
      }
      var toggle = document.getElementById('locToggle');
      if (toggle) {
        toggle.classList.add('has-pin');
        var pinIcon = toggle.querySelector('.bi-geo-alt-fill');
        if (pinIcon) pinIcon.style.color = 'var(--red2)';
      }
    },
    resetLabel: function () {
      var wrap = document.getElementById('locWrap');
      var def = (wrap && wrap.getAttribute('data-default-label')) || 'Select Pincode';
      var lbl = document.getElementById('locLabel');
      if (lbl) {
        lbl.innerHTML = def + ' <i class="bi bi-chevron-down" style="font-size:11px"></i>';
      }
      var toggle = document.getElementById('locToggle');
      if (toggle) {
        toggle.classList.remove('has-pin');
        var pinIcon = toggle.querySelector('.bi-geo-alt-fill');
        if (pinIcon) pinIcon.style.color = '';
      }
    },
    setStatus: function (statusEl, type, html) {
      if (!statusEl) return;
      if (!type) {
        statusEl.style.display = 'none';
        statusEl.className = 'loc-status';
        statusEl.innerHTML = '';
        return;
      }
      statusEl.className = 'loc-status loc-status--' + type;
      statusEl.innerHTML = html;
      statusEl.style.display = 'block';
    },
    isServiceable: function (pin) {
      var wrap = document.getElementById('locWrap');
      var raw = wrap ? (wrap.getAttribute('data-serviceable') || '').trim() : '';
      if (!raw || raw === '*') return true;
      var list = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!list.length) return true;
      for (var i = 0; i < list.length; i++) {
        var pattern = list[i];
        if (pattern.endsWith('*')) {
          var prefix = pattern.slice(0, -1);
          if (pin.indexOf(prefix) === 0) return true;
        } else if (pattern === pin) {
          return true;
        }
      }
      return false;
    },
    lookupPostalInfo: function (pin) {
      return new Promise(function (resolve) {
        /* Regex check for 6 digits Indian postal code */
        if (!/^[1-9][0-9]{5}$/.test(pin)) {
          resolve({ valid: false, message: 'Please enter a valid 6-digit Indian pincode.' });
          return;
        }

        var controller = window.AbortController ? new AbortController() : null;
        var timeoutId = setTimeout(function () {
          if (controller) controller.abort();
        }, 4500);

        fetch('https://api.postalpincode.in/pincode/' + pin, {
          signal: controller ? controller.signal : undefined
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            clearTimeout(timeoutId);
            if (Array.isArray(data) && data[0] && data[0].Status === 'Success' && Array.isArray(data[0].PostOffice) && data[0].PostOffice.length > 0) {
              var po = data[0].PostOffice[0];
              var locName = po.District || po.Division || po.Name || '';
              var state = po.State || '';
              resolve({
                valid: true,
                pincode: pin,
                location: locName,
                state: state,
                fullDetails: po
              });
            } else {
              /* If postal API explicitly says no record */
              resolve({ valid: true, pincode: pin, location: '', fallback: true });
            }
          })
          .catch(function () {
            clearTimeout(timeoutId);
            /* Network/CORS/offline fallback — valid 6-digit syntax */
            resolve({ valid: true, pincode: pin, location: '', fallback: true });
          });
      });
    },
    apply: function (pincode, isMob) {
      var self = this;
      var cleanPin = String(pincode || '').replace(/\D/g, '').slice(0, 6);
      var statusEl = document.getElementById(isMob ? 'mobLocStatus' : 'locStatus');
      var btn = document.getElementById(isMob ? 'mobPinApplyBtn' : 'locApplyBtn');
      var inputEl = document.getElementById(isMob ? 'mobPinIn' : 'locIn');
      var wrap = document.getElementById('locWrap');
      var deliveryMsg = (wrap && wrap.getAttribute('data-delivery-msg')) || 'Delivery available in 1-2 business days';

      if (cleanPin.length !== 6 || !/^[1-9][0-9]{5}$/.test(cleanPin)) {
        self.setStatus(statusEl, 'error', '<i class="bi bi-exclamation-triangle-fill"></i> Enter a valid 6-digit pincode');
        showToast('Please enter a valid 6-digit pincode');
        return;
      }

      if (inputEl) inputEl.value = cleanPin;
      var otherInput = document.getElementById(isMob ? 'locIn' : 'mobPinIn');
      if (otherInput) otherInput.value = cleanPin;

      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
        var spinner = btn.querySelector('.btn-spinner');
        var btnText = btn.querySelector('.btn-text');
        if (spinner) spinner.style.display = 'inline-block';
        if (btnText) btnText.style.display = 'none';
      }

      self.setStatus(statusEl, 'loading', '<span class="spinner-border spinner-border-sm"></span> Checking availability...');

      self.lookupPostalInfo(cleanPin).then(function (result) {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('is-loading');
          var spinner = btn.querySelector('.btn-spinner');
          var btnText = btn.querySelector('.btn-text');
          if (spinner) spinner.style.display = 'none';
          if (btnText) btnText.style.display = 'inline-block';
        }

        if (!result.valid) {
          self.setStatus(statusEl, 'error', '<i class="bi bi-x-circle-fill"></i> ' + (result.message || 'Invalid pincode'));
          showToast(result.message || 'Invalid pincode');
          return;
        }

        if (!self.isServiceable(cleanPin)) {
          self.setStatus(statusEl, 'error', '<i class="bi bi-x-circle-fill"></i> Sorry, delivery is currently not available to <strong>' + cleanPin + '</strong>');
          showToast('Delivery not available for ' + cleanPin);
          return;
        }

        /* Success & Serviceable */
        var resolvedLoc = result.location || '';
        var resolvedState = result.state || '';
        var displayLabel = resolvedLoc ? (resolvedLoc + ' - ' + cleanPin) : cleanPin;

        localStorage.setItem(CK_PIN_KEY, cleanPin);
        if (resolvedLoc) localStorage.setItem(CK_LOC_KEY, resolvedLoc);
        else localStorage.removeItem(CK_LOC_KEY);

        if (resolvedState) localStorage.setItem(CK_STATE_KEY, resolvedState);
        else localStorage.removeItem(CK_STATE_KEY);

        var isOutOfWB = self.isOutOfWestBengal(cleanPin, resolvedState);
        localStorage.setItem('ck_out_of_wb', isOutOfWB ? 'true' : 'false');

        self.setLabel(displayLabel);

        /* Update active chips */
        document.querySelectorAll('.loc-chip').forEach(function (c) {
          c.classList.toggle('active', c.getAttribute('data-code') === cleanPin);
        });

        /* Show clear button */
        ['locClearBtn', 'mobPinClearBtn'].forEach(function (id) {
          var cb = document.getElementById(id);
          if (cb) cb.style.display = 'inline-block';
        });

        self.setStatus(statusEl, 'success',
          '<div class="loc-success-title"><i class="bi bi-check-circle-fill"></i> Delivering to <strong>' +
          (resolvedLoc ? (resolvedLoc + ' (' + cleanPin + ')') : cleanPin) + '</strong></div>' +
          '<div class="loc-success-sub">' + deliveryMsg + '</div>'
        );

        showToast('✓ Delivering to ' + (resolvedLoc || cleanPin));

        window.dispatchEvent(new CustomEvent('ck:pincode-changed', {
          detail: { pincode: cleanPin, location: resolvedLoc, state: resolvedState, isServiceable: true, isOutOfWestBengal: isOutOfWB }
        }));

        self.updateLinks();
        self.updateLocationClasses(isOutOfWB);

        setTimeout(function () {
          var locDrop = document.getElementById('locDrop');
          if (locDrop && !isMob) locDrop.classList.remove('open');
          if (isMob) closeDrawer();
          self.redirectOnLocationSet(isOutOfWB);
        }, 500);
      });
    },
    applyFromInput: function () {
      var inp = document.getElementById('locIn');
      this.apply(inp ? inp.value.trim() : '', false);
    },
    applyFromMobInput: function () {
      var inp = document.getElementById('mobPinIn');
      this.apply(inp ? inp.value.trim() : '', true);
    },
    detectLocation: function (isMob) {
      var self = this;
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser');
        return;
      }

      var statusEl = document.getElementById(isMob ? 'mobLocStatus' : 'locStatus');

      function setDetecting(loading) {
        ['locDetectBtn', 'mobLocDetectBtn'].forEach(function (id) {
          var btn = document.getElementById(id);
          if (!btn) return;
          btn.disabled = loading;
          var sp = btn.querySelector('.loc-detect-spinner');
          var tx = btn.querySelector('.loc-detect-text') || btn.querySelector('span:not(.loc-detect-spinner)');
          if (sp) sp.style.display = loading ? 'inline-block' : 'none';
          if (tx) tx.textContent = loading ? 'Detecting location...' : 'Use my current location';
        });
      }

      setDetecting(true);
      self.setStatus(statusEl, 'loading', '<span class="spinner-border spinner-border-sm"></span> Accessing GPS location...');

      function resolvePinFromCoords(lat, lon) {
        /* 1. Try Nominatim reverse geocode (accurate Indian postal codes) */
        var nomUrl = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&addressdetails=1&accept-language=en';
        var bdcUrl = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=en';

        return fetch(nomUrl, { headers: { 'Accept': 'application/json' } })
          .then(function (res) { return res.json(); })
          .then(function (nomData) {
            var pin = (nomData && nomData.address && nomData.address.postcode) || '';
            var clean = String(pin).replace(/\D/g, '').slice(0, 6);
            if (clean.length === 6 && /^[1-9][0-9]{5}$/.test(clean)) {
              return { pincode: clean, city: (nomData.address && (nomData.address.city || nomData.address.town || nomData.address.suburb || nomData.address.state_district)) || '' };
            }
            throw new Error('No postcode in Nominatim');
          })
          .catch(function () {
            /* 2. Fallback to BigDataCloud */
            return fetch(bdcUrl)
              .then(function (res) { return res.json(); })
              .then(function (bdcData) {
                var pin = (bdcData && bdcData.postcode) || '';
                var clean = String(pin).replace(/\D/g, '').slice(0, 6);
                if (clean.length === 6 && /^[1-9][0-9]{5}$/.test(clean)) {
                  return { pincode: clean, city: bdcData.city || bdcData.locality || '' };
                }
                var city = (bdcData && (bdcData.city || bdcData.locality || bdcData.principalSubdivision)) || '';
                if (city) {
                  /* 3. Try India Post API for city name */
                  return fetch('https://api.postalpincode.in/postoffice/' + encodeURIComponent(city))
                    .then(function (r) { return r.json(); })
                    .then(function (poData) {
                      if (Array.isArray(poData) && poData[0] && poData[0].Status === 'Success' && Array.isArray(poData[0].PostOffice) && poData[0].PostOffice[0]) {
                        var poPin = poData[0].PostOffice[0].Pincode;
                        if (poPin && /^[1-9][0-9]{5}$/.test(poPin)) {
                          return { pincode: poPin, city: city };
                        }
                      }
                      throw new Error('Cannot resolve postcode');
                    });
                }
                throw new Error('No location detected');
              });
          });
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          var lat = position.coords.latitude;
          var lon = position.coords.longitude;

          resolvePinFromCoords(lat, lon)
            .then(function (res) {
              setDetecting(false);
              if (res && res.pincode) {
                self.apply(res.pincode, isMob);
              } else {
                self.setStatus(statusEl, 'error', 'Could not detect postal code. Please enter manually.');
                showToast('Could not detect pincode. Please enter manually.');
              }
            })
            .catch(function () {
              setDetecting(false);
              self.setStatus(statusEl, 'error', 'Could not detect postal code for this location. Please enter manually.');
              showToast('Could not detect postal code automatically');
            });
        },
        function (err) {
          setDetecting(false);
          var msg = err.code === 1
            ? 'Location permission was denied. Please allow location access.'
            : (err.code === 2 ? 'Location position unavailable.' : 'Location request timed out.');
          self.setStatus(statusEl, 'error', '<i class="bi bi-exclamation-triangle-fill"></i> ' + msg);
          showToast(msg);
        },
        { timeout: 12000, enableHighAccuracy: true, maximumAge: 60000 }
      );
    },
    clear: function () {
      localStorage.removeItem(CK_PIN_KEY);
      localStorage.removeItem(CK_LOC_KEY);
      localStorage.removeItem(CK_STATE_KEY);
      localStorage.removeItem('ck_out_of_wb');
      this.updateLinks();
      this.updateLocationClasses(false);
      this.resetLabel();

      ['locIn', 'mobPinIn'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });

      ['locStatus', 'mobLocStatus'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.innerHTML = ''; }
      });

      ['locClearBtn', 'mobPinClearBtn'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      document.querySelectorAll('.loc-chip').forEach(function (c) {
        c.classList.remove('active');
      });

      showToast('Delivery location cleared');
      window.dispatchEvent(new CustomEvent('ck:pincode-changed', {
        detail: { pincode: null, location: null, state: null, isServiceable: null, isOutOfWestBengal: null }
      }));
    },
    init: function () {
      var self = this;
      var saved = self.get();
      if (saved.pincode) {
        var displayLabel = saved.location ? (saved.location + ' - ' + saved.pincode) : saved.pincode;
        self.setLabel(displayLabel);

        ['locIn', 'mobPinIn'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.value = saved.pincode;
        });

        ['locClearBtn', 'mobPinClearBtn'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.style.display = 'inline-block';
        });

        document.querySelectorAll('.loc-chip').forEach(function (c) {
          c.classList.toggle('active', c.getAttribute('data-code') === saved.pincode);
        });
      }

      self.updateLocationClasses();
      self.updateLinks();
      self.checkAndRedirect();

      /* Document-level click interceptor for /collections/ links based on location */
      document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!a || !a.href) return;
        var isOut = self.isOutOfWestBengal();
        try {
          var url = new URL(a.href, window.location.origin);
          if (url.origin === window.location.origin) {
            if (isOut === true && /^\/collections\/(all|west-bengal)(\/.*)?$/i.test(url.pathname)) {
              url.pathname = url.pathname.replace(/^\/collections\/(all|west-bengal)(?=[\/?#]|$)/i, '/collections/india');
              a.href = url.toString();
            } else if (isOut === false && /^\/collections\/(all|india)(\/.*)?$/i.test(url.pathname)) {
              url.pathname = url.pathname.replace(/^\/collections\/(all|india)(?=[\/?#]|$)/i, '/collections/west-bengal');
              a.href = url.toString();
            }
          }
        } catch (err) {}
      }, true);

      var locToggle = document.getElementById('locToggle');
      var locDrop = document.getElementById('locDrop');
      if (locToggle && locDrop) {
        locToggle.addEventListener('click', function (e) {
          e.stopPropagation();
          var isOpen = locDrop.classList.toggle('open');
          locToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          if (isOpen) {
            var inp = document.getElementById('locIn');
            if (inp) setTimeout(function () { inp.focus(); }, 120);
          }
        });
        document.addEventListener('click', function () {
          locDrop.classList.remove('open');
          if (locToggle) locToggle.setAttribute('aria-expanded', 'false');
        });
        locDrop.addEventListener('click', function (e) {
          e.stopPropagation();
        });
      }

      /* Enter key handling */
      var locIn = document.getElementById('locIn');
      if (locIn) {
        locIn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            self.applyFromInput();
          }
        });
        locIn.addEventListener('input', function () {
          this.value = this.value.replace(/\D/g, '').slice(0, 6);
        });
      }

      var mobPinIn = document.getElementById('mobPinIn');
      if (mobPinIn) {
        mobPinIn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            self.applyFromMobInput();
          }
        });
        mobPinIn.addEventListener('input', function () {
          this.value = this.value.replace(/\D/g, '').slice(0, 6);
        });
      }
    }
  };

  window.ckPincode = ckPincode;
  window.setPin = function (p) { ckPincode.apply(p, false); };
  window.setMobPin = function (p) { ckPincode.apply(p, true); };
  window.applyPin = function () { ckPincode.applyFromInput(); };
  window.applyMobPin = function () { ckPincode.applyFromMobInput(); };

  /* ---------- Mobile drawer ---------- */
  var hamBtn = document.getElementById('hamBtn');
  var mobDrawer = document.getElementById('mobDrawer');
  var mobBd = document.getElementById('mobBd');
  var drawerOpen = false;
  window.openDrawer = function () {
    drawerOpen = true;
    if (hamBtn) { hamBtn.classList.add('open'); hamBtn.setAttribute('aria-expanded', 'true'); }
    if (mobDrawer) mobDrawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.closeDrawer = function () {
    drawerOpen = false;
    if (hamBtn) { hamBtn.classList.remove('open'); hamBtn.setAttribute('aria-expanded', 'false'); }
    if (mobDrawer) mobDrawer.classList.remove('open');
    document.body.style.overflow = '';
  };
  if (hamBtn) hamBtn.addEventListener('click', function () { drawerOpen ? closeDrawer() : openDrawer(); });
  if (mobBd) mobBd.addEventListener('click', closeDrawer);

  /* ---------- Hero slide animation ---------- */
  function animateSlide(slide) {
    if (!slide) return;
    ['hero-kicker', 'hero-title', 'hero-sub', 'hero-cta-row'].forEach(function (cls) {
      var el = slide.querySelector('.' + cls);
      if (!el) return;
      el.classList.remove('animate');
      void el.offsetWidth;
      el.classList.add('animate');
    });
  }
  document.querySelectorAll('.hero .carousel, #carouselExampleIndicators').forEach(function (carousel) {
    setTimeout(function () { animateSlide(carousel.querySelector('.carousel-item.active')); }, 60);
    carousel.addEventListener('slid.bs.carousel', function () {
      animateSlide(carousel.querySelector('.carousel-item.active'));
    });
  });

  /* ---------- Category carousel ---------- */
  (function () {
    var track = document.getElementById('catTrack');
    var prev = document.getElementById('catPrev');
    var next = document.getElementById('catNext');
    var dotsWrap = document.getElementById('catDots');
    if (!track || !prev || !next || !dotsWrap) return;
    function cards() { return Array.prototype.slice.call(track.children); }
    function step() {
      var c = cards();
      if (c.length < 2) return c[0] ? c[0].getBoundingClientRect().width : track.clientWidth;
      return c[1].getBoundingClientRect().left - c[0].getBoundingClientRect().left;
    }
    function perView() { var s = step() || 1; return Math.max(1, Math.round(track.clientWidth / s)); }
    function buildDots() {
      var total = cards().length, pv = perView(), pages = Math.max(1, Math.ceil(total / pv));
      dotsWrap.innerHTML = '';
      if (pages <= 1) return;
      for (var i = 0; i < pages; i++) {
        (function (idx) {
          var d = document.createElement('button');
          d.className = 'cat-dot' + (idx === 0 ? ' active' : '');
          d.type = 'button';
          d.setAttribute('aria-label', 'Go to category slide ' + (idx + 1));
          d.addEventListener('click', function () { track.scrollTo({ left: idx * pv * step(), behavior: 'smooth' }); });
          dotsWrap.appendChild(d);
        })(i);
      }
    }
    function update() {
      var max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
      var idx = Math.round(track.scrollLeft / (perView() * step()));
      Array.prototype.forEach.call(dotsWrap.querySelectorAll('.cat-dot'), function (d, i) { d.classList.toggle('active', i === idx); });
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    var st;
    track.addEventListener('scroll', function () { clearTimeout(st); st = setTimeout(update, 60); }, { passive: true });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { buildDots(); update(); }, 150); });
    window.addEventListener('load', function () { buildDots(); update(); });
    buildDots();
    update();
  })();

  /* ---------- Product tabs (mobile) ---------- */
  window.changeTab = function (id, el) {
    Array.prototype.forEach.call(document.querySelectorAll('.category'), function (i) { i.classList.remove('active'); });
    if (el) el.classList.add('active');
    Array.prototype.forEach.call(document.querySelectorAll('.product-tab'), function (i) { i.classList.remove('active'); });
    var t = document.getElementById(id);
    if (t) t.classList.add('active');
  };

  /* ---------- Bestsellers view more ---------- */
  (function () {
    var btn = document.getElementById('bestLoadMore');
    var track = document.getElementById('bestTrack');
    if (!btn || !track) return;
    var items = Array.prototype.slice.call(track.children).filter(function (el) { return el.querySelector('.product-card'); });
    var INITIAL = 8, STEP = 4;
    var visible = Math.min(INITIAL, items.length);
    function isMobile() { return window.innerWidth < 768; }
    function apply() { items.forEach(function (c, i) { c.style.display = i < visible ? '' : 'none'; }); }
    function label(open) {
      btn.innerHTML = open
        ? 'View Less <span class="bc"><i class="bi bi-chevron-up"></i></span>'
        : 'View More <span class="bc"><i class="bi bi-chevron-down"></i></span>';
    }
    btn.addEventListener('click', function () {
      if (visible >= items.length) { visible = INITIAL; label(false); }
      else { visible = Math.min(visible + STEP, items.length); label(visible >= items.length); }
      apply();
    });
    function onResize() {
      if (!isMobile()) { visible = items.length; label(true); }
      else { if (visible >= items.length) visible = INITIAL; }
      apply();
    }
    window.addEventListener('resize', onResize);
    if (isMobile()) { visible = Math.min(INITIAL, items.length); apply(); }
    else { visible = items.length; label(true); }
  })();

  /* ---------- Init ---------- */
  function init() {
    window.ckCart.load();

    updateWishBadges();
    renderWish();
    markWishActive();

    processPendingWishlist();

    updateWishBadges();
    renderWish();
    markWishActive();

    if (
      window.ckPincode &&
      typeof window.ckPincode.init === 'function'
    ) {
      window.ckPincode.init();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function () {
    if (window.ckPincode && typeof window.ckPincode.init === 'function') {
      window.ckPincode.init();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (document.getElementById('ckCartDrawer') && document.getElementById('ckCartDrawer').classList.contains('open')) closeCart();
      if (document.getElementById('ckWishDrawer') && document.getElementById('ckWishDrawer').classList.contains('open')) closeWish();
      if (drawerOpen) closeDrawer();
    }
  });
})();


// Cetfication
(function () {
  function initCertificationAccordion() {
    const sections =
      document.querySelectorAll('.cert-strip');
    sections.forEach(function (section) {
      const toggle =
        section.querySelector(
          '.cert-mobile-toggle'
        );

      const content =
        section.querySelector(
          '.cert-mobile-content'
        );

      if (!toggle || !content) {
        return;
      }

      if (
        toggle.dataset.certInitialized === 'true'
      ) {
        return;
      }

      toggle.dataset.certInitialized = 'true';

      toggle.addEventListener(
        'click',
        function () {

          const isOpen =
            toggle.getAttribute(
              'aria-expanded'
            ) === 'true';


          if (isOpen) {

            toggle.setAttribute(
              'aria-expanded',
              'false'
            );

            content.hidden = true;

            section.classList.remove(
              'cert-open'
            );

          } else {

            toggle.setAttribute(
              'aria-expanded',
              'true'
            );

            content.hidden = false;

            section.classList.add(
              'cert-open'
            );

          }

        }
      );

    });

  }



  /* =======================================================
     POPUP
  ======================================================= */

  function initCertificationPopups() {

    const triggers =
      document.querySelectorAll(
        '[data-cert-popup-open]'
      );


    triggers.forEach(function (trigger) {

      if (
        trigger.dataset.popupInitialized === 'true'
      ) {
        return;
      }


      trigger.dataset.popupInitialized = 'true';


      trigger.addEventListener(
        'click',
        function (event) {

          event.preventDefault();

          event.stopPropagation();


          const popupId =
            trigger.getAttribute(
              'data-cert-popup-open'
            );


          const popup =
            document.getElementById(
              popupId
            );


          if (!popup) {
            return;
          }


          openCertificationPopup(
            popup
          );

        }
      );

    });



    /* CLOSE BUTTONS + BACKDROP */

    const closeButtons =
      document.querySelectorAll(
        '[data-cert-popup-close]'
      );


    closeButtons.forEach(
      function (closeButton) {

        if (
          closeButton.dataset
            .popupCloseInitialized === 'true'
        ) {
          return;
        }


        closeButton.dataset
          .popupCloseInitialized = 'true';


        closeButton.addEventListener(
          'click',
          function (event) {

            event.preventDefault();


            const popup =
              closeButton.closest(
                '.cert-popup'
              );


            if (!popup) {
              return;
            }


            closeCertificationPopup(
              popup
            );

          }
        );

      }
    );

  }



  /* =======================================================
     OPEN POPUP
  ======================================================= */

  function openCertificationPopup(
    popup
  ) {

    popup.classList.add(
      'is-open'
    );


    popup.setAttribute(
      'aria-hidden',
      'false'
    );


    document.body.classList.add(
      'cert-popup-open'
    );


    document.body.style.overflow =
      'hidden';


    const closeButton =
      popup.querySelector(
        '.cert-popup-close'
      );


    if (closeButton) {

      setTimeout(
        function () {

          closeButton.focus();

        },
        100
      );

    }

  }



  /* =======================================================
     CLOSE POPUP
  ======================================================= */

  function closeCertificationPopup(
    popup
  ) {

    popup.classList.remove(
      'is-open'
    );


    popup.setAttribute(
      'aria-hidden',
      'true'
    );


    document.body.classList.remove(
      'cert-popup-open'
    );


    document.body.style.overflow =
      '';

  }



  /* =======================================================
     ESC KEY
  ======================================================= */

  function initCertificationEscapeKey() {

    if (
      document.body.dataset
        .certPopupKeyInitialized === 'true'
    ) {
      return;
    }


    document.body.dataset
      .certPopupKeyInitialized = 'true';


    document.addEventListener(
      'keydown',
      function (event) {

        if (event.key !== 'Escape') {
          return;
        }


        const openPopup =
          document.querySelector(
            '.cert-popup.is-open'
          );


        if (openPopup) {

          closeCertificationPopup(
            openPopup
          );

        }

      }
    );

  }



  /* =======================================================
     INITIALIZE
  ======================================================= */

  function initCookmeCertifications() {

    initCertificationAccordion();

    initCertificationPopups();

    initCertificationEscapeKey();

  }



  if (
    document.readyState === 'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initCookmeCertifications
    );

  } else {

    initCookmeCertifications();

  }



  /* =======================================================
     SHOPIFY THEME EDITOR SUPPORT
  ======================================================= */

  document.addEventListener(
    'shopify:section:load',
    function () {

      initCookmeCertifications();

    }
  );


})();


/* =====================================================
   COOKME WISHLIST PAGE
===================================================== */

(function () {

    function renderCookmeWishlistPage() {

        var grid =
            document.getElementById(
                'cookmeWishlistGrid'
            );

        if (!grid) return;


        var empty =
            document.getElementById(
                'cookmeWishlistEmpty'
            );


        var count =
            document.getElementById(
                'cookmeWishlistCount'
            );


        /* Get existing wishlist */

        var wishlist =
            typeof getWish === 'function'
                ? getWish()
                : [];


        grid.innerHTML = '';


        /* Count */

        if (count) {

            count.textContent =
                wishlist.length +
                (
                    wishlist.length === 1
                        ? ' item'
                        : ' items'
                );

        }


        /* Empty */

        if (!wishlist.length) {

            grid.style.display = 'none';

            if (empty) {
                empty.hidden = false;
            }

            return;
        }


        grid.style.display = 'grid';

        if (empty) {
            empty.hidden = true;
        }


        /* Render products */

        wishlist.forEach(function (item) {

            var card =
                document.createElement('article');

            card.className =
                'cookme-wishlist-card';


            var image =
                item.image
                    ? '<img src="' +
                      item.image +
                      '" alt="' +
                      escapeHtml(item.title || '') +
                      '" loading="lazy">'
                    : '';


            var addButton =
                item.variantId

                    ? '<button type="button" ' +
                      'class="cookme-wishlist-add" ' +
                      'data-wishlist-add="' +
                      item.variantId +
                      '">' +
                      'Add to Cart' +
                      '</button>'

                    : '<button type="button" ' +
                      'class="cookme-wishlist-add" ' +
                      'disabled>' +
                      'Unavailable' +
                      '</button>';


            card.innerHTML =

                '<a href="' +
                (item.url || '#') +
                '" class="cookme-wishlist-card-image">' +

                    image +

                '</a>' +


                '<button type="button" ' +
                'class="cookme-wishlist-remove" ' +
                'aria-label="Remove from wishlist" ' +
                'data-wishlist-remove="' +
                item.id +
                '">' +

                    '♡' +

                '</button>' +


                '<div class="cookme-wishlist-card-content">' +

                    '<a href="' +
                    (item.url || '#') +
                    '" class="cookme-wishlist-card-title">' +

                        escapeHtml(
                            item.title || ''
                        ) +

                    '</a>' +


                    '<div class="cookme-wishlist-card-price">' +

                        escapeHtml(
                            item.price || ''
                        ) +

                    '</div>' +


                    addButton +

                '</div>';


            grid.appendChild(card);

        });

    }


    /* Safe HTML */

    function escapeHtml(value) {

        var div =
            document.createElement('div');

        div.textContent =
            value == null
                ? ''
                : String(value);

        return div.innerHTML;

    }


    /* Remove */

    document.addEventListener(
        'click',
        function (event) {

            var remove =
                event.target.closest(
                    '[data-wishlist-remove]'
                );


            if (!remove) return;


            event.preventDefault();


            var id =
                remove.getAttribute(
                    'data-wishlist-remove'
                );


            var wishlist =
                typeof getWish === 'function'
                    ? getWish()
                    : [];


            wishlist =
                wishlist.filter(function (item) {

                    return String(item.id) !==
                        String(id);

                });


            if (
                typeof setWish === 'function'
            ) {

                setWish(wishlist);

            }


            renderCookmeWishlistPage();


            if (
                typeof markWishActive ===
                'function'
            ) {

                markWishActive();

            }


            if (
                typeof showToast ===
                'function'
            ) {

                showToast(
                    'Removed from wishlist'
                );

            }

        }
    );


    /* Add to cart */

    document.addEventListener(
        'click',
        function (event) {

            var button =
                event.target.closest(
                    '[data-wishlist-add]'
                );


            if (!button) return;


            event.preventDefault();


            var variantId =
                button.getAttribute(
                    'data-wishlist-add'
                );


            if (!variantId) return;


            if (
                typeof addToCart !==
                'function'
            ) {

                return;

            }


            button.disabled = true;


            Promise.resolve(
                addToCart(
                    variantId,
                    1,
                    button
                )
            )
            .finally(function () {

                button.disabled = false;

                renderCookmeWishlistPage();

            });

        }
    );


    /* Initial render */

    document.addEventListener(
        'DOMContentLoaded',
        function () {
            renderCookmeWishlistPage();
        }
    );


    /* Re-render when storage changes */

    window.addEventListener(
        'storage',
        function () {
            renderCookmeWishlistPage();
        }
    );


    /* Re-render when wishlist changes in same page */

    window.addEventListener(
        'cookme:wishlist-updated',
        function () {
            renderCookmeWishlistPage();
        }
    );

})();

// Remove #categories from the URL when clicking the Categories link.
document.querySelectorAll('a[href="#categories"]').forEach(link => {
  link.addEventListener('click', function () {
    setTimeout(() => {
      history.replaceState(null, '', location.pathname + location.search);
    }, 0);
  });
});