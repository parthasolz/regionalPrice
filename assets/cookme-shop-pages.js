/* ============================================================
   COOKME — shop pages JS (collection / product detail)
   v2 — robust init, per-element loaders, Add→View state,
        variant→gallery switch + unit price + Save %, price min
   ============================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

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

  /* ---------- Mobile filter drawer ---------- */
  function initFilterDrawer() {
    var btn = document.getElementById('mobileFilterBtn');
    var panel = document.getElementById('filterPanel');
    var backdrop = document.getElementById('filterBackdrop');
    var closeBtn = document.getElementById('filterCloseBtn');
    if (!btn || !panel || !backdrop) return;
    function open() { panel.classList.add('open'); backdrop.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { panel.classList.remove('open'); backdrop.classList.remove('open'); document.body.style.overflow = ''; }
    if (btn.dataset.ckInit) return;
    btn.dataset.ckInit = '1';
    btn.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
  }

  /* ---------- Filter accordions ---------- */
  function initFilterAccordions() {
    document.querySelectorAll('[data-filter-accordion]').forEach(function (item) {
      var btn = item.querySelector('.filter-block-heading');
      var body = item.querySelector('.filter-block-body');
      if (!btn || !body || btn.dataset.ckInit) return;
      btn.dataset.ckInit = '1';
      btn.addEventListener('click', function () {
        var collapsed = item.classList.toggle('is-collapsed');
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    });
  }

  /* ---------- PLP filter AJAX / URL sync ---------- */
  function initPlpFilterAjax() {
    var root = document.querySelector('.filter-panel');
    var main = document.querySelector('.plp-main');
    var grid = main && main.querySelector('[id^="ProductGrid-"]');
    if (!root || !main || !grid || root.dataset.ckAjaxInit) return;
    root.dataset.ckAjaxInit = '1';

    var sectionId = grid.id.replace(/^ProductGrid-/, '');
    var requestId = 0;
    var controller = null;
    var priceTimer = null;

    function getUrl() {
      return new URL(window.location.href);
    }

    function setLoading(on) {
      main.classList.toggle('is-filter-loading', !!on);
      var loader = main.querySelector('.ck-plp-filter-loader');
      if (!loader) {
        loader = document.createElement('div');
        loader.className = 'ck-plp-filter-loader';
        loader.innerHTML = '<span></span><span></span><span></span>';
        main.appendChild(loader);
      }
      loader.hidden = !on;
    }

    function applyCategoryFilter() {
      var raw = getUrl().searchParams.get('ck_category') || '';
      var selected = raw.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
      var selectedSet = {};
      selected.forEach(function (h) { selectedSet[h] = true; });

      root.querySelectorAll('[data-category-filter-input]').forEach(function (input) {
        input.checked = !!selectedSet[input.getAttribute('data-category-handle')];
      });
      var clear = root.querySelector('[data-category-filter-clear]');
      if (clear) clear.hidden = selected.length === 0;
    }

    function categoryUrlsFor(selected) {
      var urls = [];
      selected.forEach(function (handle) {
        var input = root.querySelector('[data-category-filter-input][data-category-handle="' + CSS.escape(handle) + '"]');
        var href = input && input.getAttribute('data-category-url');
        if (href) urls.push(new URL(href, window.location.origin));
      });
      return urls;
    }

    function fetchCategorySections(params, push) {
      var raw = params.get('ck_category') || '';
      var selected = raw.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
      if (!selected.length) return fetchSection(params, push);

      var id = ++requestId;
      if (controller && controller.abort) controller.abort();
      controller = window.AbortController ? new AbortController() : null;
      setLoading(true);

      var baseParams = new URLSearchParams(params.toString());
      baseParams.delete('ck_category');
      baseParams.delete('page');
      baseParams.delete('section_id');
      var urls = categoryUrlsFor(selected);
      if (!urls.length) {
        return fetchSection(baseParams, push);
      }

      return Promise.all(urls.map(function (collectionUrl) {
        collectionUrl.search = baseParams.toString();
        collectionUrl.searchParams.set('section_id', sectionId);
        return fetch(collectionUrl.toString(), {
          method: 'GET',
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'text/html' },
          signal: controller ? controller.signal : undefined
        }).then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.text();
        });
      }))
        .then(function (htmlList) {
          if (id !== requestId) return;
          var seen = {};
          var fragments = [];
          htmlList.forEach(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var freshGrid = doc.getElementById(grid.id);
            if (!freshGrid) return;
            Array.prototype.forEach.call(freshGrid.children, function (card) {
              var data = card.querySelector('[id^="QuickAddData-"]');
              var key = data ? data.id : (card.innerHTML || '').slice(0, 120);
              if (!seen[key]) {
                seen[key] = true;
                fragments.push(card.cloneNode(true));
              }
            });
          });

          grid.innerHTML = '';
          fragments.forEach(function (node) { grid.appendChild(node); });

          /* A combined multi-collection result has no reliable single
             pagination cursor, so hide load-more while category mode is on. */
          var pager = main.querySelector('[data-ck-pagination]');
          if (pager) pager.remove();

          if (push) {
            var clean = new URL(window.location.href);
            clean.search = params.toString();
            clean.hash = '';
            window.history.pushState({ ckPlp: true }, '', clean.pathname + (clean.search || ''));
          }

          applyCategoryFilter();
          syncPriceLabels();
          if (window.ckSyncCardButtons) window.ckSyncCardButtons();
          initPagination();
          checkLocationEmptyGrids();
        })
        .catch(function (error) {
          if (error && error.name === 'AbortError') return;
          console.error('[Cookme] Category filter AJAX failed:', error);
          /* Keep the current page intact instead of forcing a full reload. */
          if (window.ckShowToast) window.ckShowToast('Could not update products');
        })
        .finally(function () {
          if (id === requestId) setLoading(false);
        });
    }

    function syncPriceLabels() {
      root.querySelectorAll('[data-dual-range]').forEach(function (wrap) {
        var minEl = wrap.querySelector('[data-price-slider-min]');
        var maxEl = wrap.querySelector('[data-price-slider-max]');
        if (!minEl || !maxEl) return;
        var minBound = parseFloat(minEl.min) || 0;
        var maxBound = parseFloat(maxEl.max) || 0;
        var min = parseFloat(minEl.value) || minBound;
        var max = parseFloat(maxEl.value) || maxBound;
        if (min > max) {
          if (document.activeElement === minEl) max = min;
          else min = max;
          minEl.value = min;
          maxEl.value = max;
        }
        var span = Math.max(1, maxBound - minBound);
        wrap.style.setProperty('--price-active-left', (((min - minBound) / span) * 100) + '%');
        wrap.style.setProperty('--price-active-right', (((max - minBound) / span) * 100) + '%');
        var form = wrap.closest('form');
        var minLabel = form && form.querySelector('[data-price-min]');
        var maxLabel = form && form.querySelector('[data-price-max]');
        if (minLabel) minLabel.textContent = '₹' + Math.round(min);
        if (maxLabel) maxLabel.textContent = '₹' + Math.round(max);
      });
    }

    function fetchSection(params, push) {
      if (params.get('ck_category')) return fetchCategorySections(params, push);
      var id = ++requestId;
      if (controller && controller.abort) controller.abort();
      controller = window.AbortController ? new AbortController() : null;

      params.delete('page');
      params.delete('section_id');
      var url = new URL(window.location.href);
      url.search = params.toString();
      url.searchParams.set('section_id', sectionId);
      url.hash = '';

      setLoading(true);
      return fetch(url.toString(), {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'text/html' },
        signal: controller ? controller.signal : undefined
      })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.text();
        })
        .then(function (html) {
          if (id !== requestId) return;
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var freshGrid = doc.getElementById(grid.id);
          if (!freshGrid) throw new Error('Product grid not found');

          grid.innerHTML = freshGrid.innerHTML;

          var currentPager = main.querySelector('[data-ck-pagination]');
          var freshPager = doc.querySelector('[data-ck-pagination]');
          if (currentPager && freshPager) currentPager.outerHTML = freshPager.outerHTML;
          else if (currentPager && !freshPager) currentPager.remove();
          else if (!currentPager && freshPager) main.appendChild(freshPager.cloneNode(true));

          if (push) {
            var clean = new URL(window.location.href);
            clean.search = params.toString();
            clean.hash = '';
            window.history.pushState({ ckPlp: true }, '', clean.pathname + (clean.search || ''));
          }

          syncPriceLabels();
          applyCategoryFilter();
          if (window.ckSyncCardButtons) window.ckSyncCardButtons();
          if (window.ckApplyPlpFilters) window.ckApplyPlpFilters();
          initPagination();
          checkLocationEmptyGrids();
        })
        .catch(function (error) {
          if (error && error.name === 'AbortError') return;
          console.error('[Cookme] PLP filter AJAX failed:', error);
          /* Only fall back to normal navigation if AJAX itself failed. */
          var fallback = new URL(window.location.href);
          fallback.search = params.toString();
          window.location.href = fallback.pathname + (fallback.search || '');
        })
        .finally(function () {
          if (id === requestId) setLoading(false);
        });
    }

    function paramsFromUrl() {
      var params = new URLSearchParams(getUrl().search);
      params.delete('section_id');
      params.delete('page');
      return params;
    }

    function submitFilterInput(input) {
      var block = input.closest('.filter-block');
      var param = input.getAttribute('data-filter-param');
      if (!block || !param) return;
      var params = paramsFromUrl();
      params.delete(param);
      block.querySelectorAll('[data-multi-filter-input][data-filter-param]').forEach(function (el) {
        if (el.getAttribute('data-filter-param') === param && el.checked) {
          params.append(param, el.getAttribute('data-filter-value') || '');
        }
      });
      fetchSection(params, true);
    }

    function bindEvents() {
      /* Event delegation keeps filters working after any section/grid refresh. */
      if (root.dataset.ckDelegated) return;
      root.dataset.ckDelegated = '1';

      root.addEventListener('change', function (event) {
        var input = event.target;
        if (input.matches('[data-multi-filter-input]')) {
          submitFilterInput(input);
          return;
        }
        if (input.matches('[data-category-filter-input]')) {
          var selected = [];
          root.querySelectorAll('[data-category-filter-input]:checked').forEach(function (el) {
            selected.push(el.getAttribute('data-category-handle'));
          });
          var params = paramsFromUrl();
          params.delete('ck_category');
          if (selected.length) params.set('ck_category', selected.join(','));
          fetchSection(params, true);
          return;
        }
        if (input.matches('[data-price-slider-min], [data-price-slider-max]')) {
          syncPriceLabels();
          clearTimeout(priceTimer);
          priceTimer = setTimeout(function () {
            var range = input.closest('[data-dual-range]');
            if (!range) return;
            var minEl = range.querySelector('[data-price-slider-min]');
            var maxEl = range.querySelector('[data-price-slider-max]');
            if (!minEl || !maxEl) return;
            var params = paramsFromUrl();
            params.delete('filter.v.price.gte');
            params.delete('filter.v.price.lte');
            params.set('filter.v.price.gte', minEl.value);
            params.set('filter.v.price.lte', maxEl.value);
            fetchSection(params, true);
          }, 120);
        }
      });

      root.addEventListener('input', function (event) {
        if (event.target.matches('[data-price-slider-min], [data-price-slider-max]')) syncPriceLabels();
      });

      root.addEventListener('click', function (event) {
        var clearCategory = event.target.closest('[data-category-filter-clear]');
        if (clearCategory) {
          event.preventDefault();
          root.querySelectorAll('[data-category-filter-input]').forEach(function (el) { el.checked = false; });
          var params = paramsFromUrl();
          params.delete('ck_category');
          fetchSection(params, true);
          return;
        }

        var swatch = event.target.closest('a.swatch');
        if (swatch && root.contains(swatch)) {
          event.preventDefault();
          var target = new URL(swatch.href, window.location.origin);
          var params = new URLSearchParams(target.search);
          var category = getUrl().searchParams.get('ck_category');
          if (category) params.set('ck_category', category);
          fetchSection(params, true);
          return;
        }
      });
    }

    bindEvents();
    syncPriceLabels();
    applyCategoryFilter();

    /* Sort: change the product grid only, preserving active filters. */
    var sortForm = document.querySelector('.plp-sort form');
    var sortSelect = sortForm && sortForm.querySelector('select[name="sort_by"]');
    if (sortSelect && !sortSelect.dataset.ckAjaxBound) {
      sortSelect.dataset.ckAjaxBound = '1';
      sortSelect.addEventListener('change', function (event) {
        event.preventDefault();
        var params = paramsFromUrl();
        params.set('sort_by', sortSelect.value);
        fetchSection(params, true);
      });
    }

    /* Clear-all in the filter header should also be AJAX. */
    var clearAll = root.querySelector('.filter-clear-all');
    if (clearAll && !clearAll.dataset.ckAjaxBound) {
      clearAll.dataset.ckAjaxBound = '1';
      clearAll.addEventListener('click', function (event) {
        event.preventDefault();
        fetchSection(new URLSearchParams(), true);
      });
    }

    window.addEventListener('popstate', function () {
      fetchSection(paramsFromUrl(), false);
    });

    window.ckApplyPlpFilters = applyCategoryFilter;
  }

  /* ---------- Location-aware empty grid handler ---------- */
  function checkLocationEmptyGrids() {
    document.querySelectorAll('[id^="ProductGrid-"]').forEach(function (grid) {
      var cards = grid.querySelectorAll('[data-ck-location]');
      if (!cards.length) return;
      var hasVisible = false;
      cards.forEach(function (card) {
        if (window.getComputedStyle(card).display !== 'none') {
          hasVisible = true;
        }
      });
      var emptyEl = grid.querySelector('.ck-location-empty-msg');
      if (!hasVisible) {
        if (!emptyEl) {
          emptyEl = document.createElement('div');
          emptyEl.className = 'col-12 ck-location-empty-msg';
          emptyEl.innerHTML = '<p class="ck-tab-empty">No products in this collection are currently available for delivery to your selected location.</p>';
          grid.appendChild(emptyEl);
        }
        emptyEl.style.display = 'block';
      } else if (emptyEl) {
        emptyEl.style.display = 'none';
      }
    });
  }

  window.addEventListener('ck:pincode-changed', function () {
    setTimeout(function () {
      checkLocationEmptyGrids();
      if (window.ckSyncPdpLocation) {
        window.ckSyncPdpLocation();
      }
    }, 50);
  });
  window.ckCheckLocationGrids = checkLocationEmptyGrids;

  /* ---------- Collection AJAX load-more pagination ---------- */
  function initPagination() {
    var wrap = document.querySelector('[data-ck-pagination]');
    if (!wrap) return;
    var loader = wrap.querySelector('.plp-loader');
    var sectionId = wrap.getAttribute('data-section');
    var page = wrap.getAttribute('data-page');
    var loading = false;
    var pendingProducts = [];
    var observer = null;
    function urlFor(p) {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('page', p);
        url.searchParams.set('section_id', sectionId);
        return url.pathname + '?' + url.searchParams.toString();
      } catch (e) {
        var base = wrap.getAttribute('data-url') || '/collections/all';
        var sep = base.indexOf('?') > -1 ? '&' : '?';
        return base + sep + 'page=' + p + '&section_id=' + sectionId;
      }
    }
    function appendBatch() {
      var grid = document.getElementById('ProductGrid-' + sectionId);
      var batch = pendingProducts.splice(0, 6);
      if (grid) {
        batch.forEach(function (productNode) { grid.appendChild(productNode); });
      }
      if (window.ckSyncCardButtons) window.ckSyncCardButtons();
      if (window.ckApplyPlpFilters) window.ckApplyPlpFilters();
      checkLocationEmptyGrids();
      return batch.length;
    }
    function refreshObserver() {
      if (!observer) return;
      observer.unobserve(wrap);
      if (page || pendingProducts.length) observer.observe(wrap);
    }
    function loadNext() {
      if (loading) return;
      if (pendingProducts.length) {
        appendBatch();
        wrap.style.display = page || pendingProducts.length ? '' : 'none';
        refreshObserver();
        return;
      }
      if (!page) return;
      loading = true;
      var loaded = false;
      wrap.classList.add('active');
      if (loader) loader.style.display = 'flex';
      fetch(urlFor(page), { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var gridId = 'ProductGrid-' + sectionId;
          var grid = document.getElementById(gridId);
          var newGrid = doc.getElementById(gridId);
          if (!grid || !newGrid) throw new Error('Product grid not found');
          pendingProducts = Array.prototype.slice.call(newGrid.children);
          var newWrap = doc.querySelector('[data-ck-pagination]');
          if (newWrap) { page = newWrap.getAttribute('data-page') || ''; wrap.setAttribute('data-page', page); }
          else { page = ''; }
          appendBatch();
          wrap.style.display = page || pendingProducts.length ? '' : 'none';
          loaded = true;
        })
        .catch(function (error) {
          console.error('[Cookme] Load more failed:', error);

          if (window.ckShowToast) {
            window.ckShowToast('Could not load more products');
          }
        })
        .then(function () {
          loading = false;
          if (loader) loader.style.display = 'none';
          wrap.classList.remove('active');
          if (loaded) refreshObserver();
        });
    }
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) loadNext(); });
      }, { rootMargin: '0px 0px 200px 0px' });
      if (page) observer.observe(wrap);
    }
  }

  /* ============================================================
     PRODUCT GALLERY — thumbs / zoom / drag / swipe / lightbox
     (mirrors the reference product-detail.html behaviour)
  ============================================================ */
  var pdpDocBound = false;

  function initPdpGallery() {
    var dataEl = document.getElementById('ckPdpMedia');
    if (!dataEl) return;
    var images = [];
    try { images = JSON.parse(dataEl.textContent || '[]'); } catch (e) { images = []; }
    var mainImage = document.getElementById('mainImage');
    if (!images.length && mainImage && mainImage.getAttribute('src')) {
      images = [{ src: mainImage.getAttribute('src'), full: mainImage.getAttribute('src'), alt: mainImage.getAttribute('alt') || '' }];
    }
    var viewport = document.getElementById('pdpZoomViewport');
    var galleryMain = document.getElementById('pdpGalleryMain');
    var dashRow = document.getElementById('pdpDashRow');
    var thumbs = document.getElementById('pdpThumbs');
    var tPrev = document.getElementById('pdpThumbsPrev');
    var tNext = document.getElementById('pdpThumbsNext');
    var lightbox = document.getElementById('pdpLightbox');
    var lbTrack = document.getElementById('pdpLightboxTrack');
    var lbClose = document.getElementById('pdpLightboxClose');
    var lbPrev = document.getElementById('pdpLightboxPrev');
    var lbNext = document.getElementById('pdpLightboxNext');
    var lbBd = document.getElementById('pdpLightboxBackdrop');
    var current = 0;
    var lbBuilt = false;

    function galleryBusy(b) { if (galleryMain) galleryMain.classList.toggle('is-loading', b); }

    function isVideoItem(item) {
      if (!item) return false;
      return item.type === 'video' || item.type === 'external_video' || !!item.video_url || !!item.url && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(item.url);
    }

    function renderDashes() {
      if (!dashRow) return;
      dashRow.innerHTML = '';
      images.forEach(function (im, i) {
        var d = document.createElement('span');
        d.className = 'pdp-dash' + (i === current ? ' active' : '');
        dashRow.appendChild(d);
      });
    }

    function buildThumbs() {
      if (!thumbs) return;
      thumbs.innerHTML = '';
      images.forEach(function (im, i) {
        var isVideo = isVideoItem(im);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pdp-thumb' + (i === current ? ' active' : '') + (isVideo ? ' pdp-thumb-video' : '');
        b.setAttribute('aria-label', 'View ' + (isVideo ? 'video' : 'image') + ' ' + (i + 1));

        var img = document.createElement('img');
        img.src = im.full || im.src || '';
        img.alt = im.alt || '';
        img.loading = 'lazy';
        b.appendChild(img);

        if (isVideo) {
          var play = document.createElement('span');
          play.className = 'pdp-video-play';
          play.textContent = '▶';
          b.appendChild(play);

          // var tag = document.createElement('span');
          // tag.className = 'pdp-video-tag';
          // tag.textContent = 'VIDEO';
          // b.appendChild(tag);
        }

        b.addEventListener('click', function () { setImage(i, 'forward'); });
        thumbs.appendChild(b);
      });
      renderDashes();
    }

    function setImage(i, dir) {
      if (!images.length) return;
      if (i < 0) i = images.length - 1;
      if (i > images.length - 1) i = 0;
      current = i;
      var im = images[i];
      var slide = document.getElementById('pdpImgSlide');

      if (slide) {
        slide.innerHTML = '';

        if (isVideoItem(im)) {
          var video = document.createElement('video');
          video.id = 'mainImage';
          video.className = 'pdp-main-video';
          video.src = im.video_url || im.src || '';
          video.poster = im.full || im.src || '';
          video.muted = true;
          video.autoplay = true;
          video.playsInline = true;
          video.loop = true;
          video.controls = false;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          slide.appendChild(video);
          mainImage = video;
          video.play().catch(function () {});
        } else {
          var img = document.createElement('img');
          img.id = 'mainImage';
          img.src = im.src;
          img.alt = im.alt || '';
          slide.appendChild(img);
          mainImage = img;
        }
      }

      if (thumbs) Array.prototype.forEach.call(thumbs.querySelectorAll('.pdp-thumb'), function (t, idx) { t.classList.toggle('active', idx === i); });
      renderDashes();
      if (thumbs) { var act = thumbs.children[i]; if (act) act.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }
    }
    window.ckPdpSetImage = setImage;
    window.ckPdpDefaultMedia = images.slice();
    window.ckPdpSetGallery = function (nextImages) {
      if (!Array.isArray(nextImages)) {
        nextImages = [];
      }

      images = nextImages.filter(function (image) {
        return image && image.src;
      });

      current = 0;
      lbBuilt = false;

      if (lbTrack) {
        lbTrack.innerHTML = '';
      }

      galleryBusy(true);

      buildThumbs();

      if (images.length) {
        setImage(0, 'forward');
      } else if (mainImage) {
        mainImage.removeAttribute('src');
      }

      setTimeout(function () {
        galleryBusy(false);
      }, 360);
    };

    /* zoom (desktop) */
    var zoomActive = false;
    if (viewport && !viewport.dataset.ckInit) {
      viewport.dataset.ckInit = '1';
      viewport.addEventListener('mouseenter', function () {
        if (window.innerWidth < 992) return;
        zoomActive = true;
        if (mainImage) mainImage.classList.add('zoomed');
      });
      viewport.addEventListener('mousemove', function (e) {
        if (!zoomActive) return;
        var rect = viewport.getBoundingClientRect();
        var x = ((e.clientX - rect.left) / rect.width) * 100;
        var y = ((e.clientY - rect.top) / rect.height) * 100;
        if (mainImage) { mainImage.style.transformOrigin = x + '% ' + y + '%'; }
      });
      viewport.addEventListener('mouseleave', function () {
        zoomActive = false;
        if (mainImage) { mainImage.classList.remove('zoomed'); mainImage.style.transformOrigin = ''; }
      });
    }

    /* drag on main image (desktop) */
    if (viewport) {
      var dragging = false, startX = 0;
      viewport.addEventListener('mousedown', function (e) {
        if (window.innerWidth < 992) { zoomActive = false; return; }
        dragging = true; startX = e.clientX; zoomActive = false;
        if (mainImage) mainImage.classList.remove('zoomed');
        viewport.classList.add('dragging');
        e.preventDefault();
      });
      window.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        if (Math.abs(e.clientX - startX) > 6) { dragging = false; }
      });
      window.addEventListener('mouseup', function (e) {
        if (!dragging) return;
        dragging = false;
        viewport.classList.remove('dragging');
        var d = e.clientX - startX;
        if (d < -40) setImage(current + 1, 'forward');
        else if (d > 40) setImage(current - 1, 'backward');
      });
      /* swipe (mobile) */
      var ts = 0;
      viewport.addEventListener('touchstart', function (e) { ts = e.touches[0].clientX; }, { passive: true });
      viewport.addEventListener('touchend', function (e) {
        var d = e.changedTouches[0].clientX - ts;
        if (d < -40) setImage(current + 1, 'forward');
        else if (d > 40) setImage(current - 1, 'backward');
      });
    }
    if (thumbs && tPrev && tNext && !tPrev.dataset.ckInit) {
      tPrev.dataset.ckInit = '1';
      tPrev.addEventListener('click', function () { thumbs.scrollBy({ left: -180, behavior: 'smooth' }); });
      tNext.addEventListener('click', function () { thumbs.scrollBy({ left: 180, behavior: 'smooth' }); });
    }

    /* lightbox */
    function buildLightbox() {
      if (lbBuilt || !lbTrack) return;
      lbTrack.innerHTML = '';
      images.forEach(function (im) {
        var s = document.createElement('div');
        s.className = 'pdp-lightbox-slide';
        var img = document.createElement('img');
        img.src = im.full || im.src;
        img.alt = im.alt || '';
        s.appendChild(img);
        lbTrack.appendChild(s);
      });
      lbBuilt = true;
    }
    function openLightbox(idx) {
      if (!lightbox) return;
      buildLightbox();
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
      scrollTo(idx, false);
    }
    window.ckPdpOpenLightbox = openLightbox;
    function closeLB() { if (!lightbox) return; lightbox.classList.remove('open'); document.body.style.overflow = ''; }
    function scrollTo(idx, smooth) {
      if (!lbTrack) return;
      idx = Math.max(0, Math.min(images.length - 1, idx));
      var s = lbTrack.children[idx];
      if (s) lbTrack.scrollTo({ left: s.offsetLeft - (lbTrack.clientWidth - s.clientWidth) / 2, behavior: smooth === false ? 'auto' : 'smooth' });
      setImage(idx, 'forward');
    }
    if (!pdpDocBound) {
      pdpDocBound = true;
      if (lbClose) lbClose.addEventListener('click', closeLB);
      if (lbBd) lbBd.addEventListener('click', closeLB);
      if (lbPrev) lbPrev.addEventListener('click', function () { scrollTo(current - 1, true); });
      if (lbNext) lbNext.addEventListener('click', function () { scrollTo(current + 1, true); });
      document.addEventListener('keydown', function (e) {
        if (!lightbox || !lightbox.classList.contains('open')) return;
        if (e.key === 'Escape') closeLB();
        if (e.key === 'ArrowLeft') scrollTo(current - 1, true);
        if (e.key === 'ArrowRight') scrollTo(current + 1, true);
      });
    }
    buildThumbs();
  }

  /* ---------- PDP Location Serviceability Checker ---------- */
  function isPdpDeliverable() {
    var pdpPage = document.querySelector('[data-pdp-location]');
    if (!pdpPage) return true;
    var reqLoc = pdpPage.getAttribute('data-pdp-location') || 'all';
    if (reqLoc === 'all') return true;

    var isOutOfWb = false;
    if (window.ckPincode && typeof window.ckPincode.isOutOfWestBengal === 'function') {
      isOutOfWb = window.ckPincode.isOutOfWestBengal();
    } else if (document.documentElement.classList.contains('ck-loc-india')) {
      isOutOfWb = true;
    } else if (document.documentElement.classList.contains('ck-loc-wb')) {
      isOutOfWb = false;
    }

    if (reqLoc === 'wb') {
      return !isOutOfWb;
    }
    if (reqLoc === 'india') {
      return !!isOutOfWb;
    }
    return true;
  }
  window.ckIsPdpDeliverable = isPdpDeliverable;

  /* ---------- Variant / pack-size selector ---------- */
  /* ============================================================
    PDP VARIANT + GALLERY + CART STATE
    Same behaviour as Quick Add popup
 ============================================================ */
  function initVariants() {
    var opts = document.querySelectorAll('.weight-opt');
    var hid = document.getElementById('ckPdpVariantId');
    var priceEl = document.getElementById('ckPdpPrice');
    var oldEl = document.getElementById('ckPdpCompare');
    var selEl = document.getElementById('ckSelTitle');
    var variantMediaEl = document.getElementById('ckPdpVariantMedia');

    if (!opts.length) return;

    var variantMap = {};
    try {
      variantMap = JSON.parse(
        variantMediaEl ? variantMediaEl.textContent : '{}'
      );
    } catch (e) {
      variantMap = {};
    }

    var defaultGallery =
      Array.isArray(window.ckPdpDefaultMedia)
        ? window.ckPdpDefaultMedia.slice()
        : [];

    function getVariant(id) {
      return variantMap[String(id)] || {};
    }

    function getCartItem(variantId) {
      return (window.ckCart.items || []).find(function (item) {
        return String(item.variant_id) === String(variantId);
      });
    }

    function getCartQty(variantId) {
      var item = getCartItem(variantId);
      return item ? (parseInt(item.quantity, 10) || 0) : 0;
    }

    function getMaxQty(variant) {
      if (!variant) return null;

      var inventory = variant.inventory_quantity;

      if (
        inventory !== null &&
        inventory !== undefined &&
        inventory !== ''
      ) {
        inventory = Number(inventory);

        if (isFinite(inventory)) {
          return Math.max(0, Math.floor(inventory));
        }
      }

      return null;
    }

    function syncQtyUI(quantity, maxQty) {
      quantity = Math.max(0, parseInt(quantity, 10) || 0);
      var isDeliverable = isPdpDeliverable();

      var desktop = document.querySelector('.qty-stepper-lg');
      var mobile = document.querySelector('.qty-stepper-mob');

      [desktop, mobile].forEach(function (stepper) {
        if (!stepper) return;

        var val = stepper.querySelector('.val');
        var minus = stepper.querySelector('button:first-child');
        var plus = stepper.querySelector('button:last-child');

        if (val) val.textContent = String(quantity);

        if (!isDeliverable) {
          stepper.classList.add('is-disabled');
          if (minus) minus.disabled = true;
          if (plus) plus.disabled = true;
          return;
        }

        stepper.classList.remove('is-disabled');

        if (minus) {
          minus.disabled = quantity <= 0;
        }

        if (plus) {
          plus.disabled =
            maxQty !== null && quantity >= maxQty;
        }
      });

      var qtyInput = document.getElementById('ckPdpQty');
      if (qtyInput) {
        qtyInput.value = quantity;
        qtyInput.disabled = !isDeliverable;
      }

      var mobQty = document.getElementById('mobQtyVal');
      if (mobQty) {
        mobQty.textContent = String(quantity);
      }
    }

    function syncButtonState(variant) {
      var id = variant && variant.id
        ? variant.id
        : hid && hid.value;

      var isDeliverable = isPdpDeliverable();
      var item = getCartItem(id);
      var qty = item ? parseInt(item.quantity, 10) || 0 : 0;

      var isAvailable =
        variant && String(variant.available) !== 'false';

      var buttons = document.querySelectorAll(
        '#ckPdpAddBtn, #mobAddToCart'
      );

      Array.prototype.forEach.call(buttons, function (btn) {
        if (!btn) return;

        if (!isDeliverable) {
          btn.disabled = true;
          btn.classList.add('is-disabled');
          btn.classList.remove('is-added');
          btn.classList.remove('is-loading');

          if (btn.id === 'ckPdpAddBtn') {
            btn.innerHTML =
              '<i class="bi bi-geo-alt-fill"></i> Not Deliverable';
          } else {
            btn.textContent = 'Not Deliverable';
          }

          return;
        }

        if (!isAvailable) {
          btn.disabled = true;
          btn.classList.add('is-disabled');
          btn.classList.remove('is-added');
          btn.classList.remove('is-loading');

          if (btn.id === 'ckPdpAddBtn') {
            btn.textContent = 'Sold Out';
          } else {
            btn.textContent = 'Sold Out';
          }

          return;
        }

        btn.disabled = false;
        btn.classList.remove('is-disabled');

        if (qty > 0) {
          btn.classList.add('is-added');

          if (btn.id === 'ckPdpAddBtn') {
            btn.textContent = 'Update Cart';
          } else {
            btn.textContent = 'Update Cart';
          }
        } else {
          btn.classList.remove('is-added');

          if (btn.id === 'ckPdpAddBtn') {
            btn.innerHTML =
              '<i class="bi bi-bag"></i> Add to Cart';
          } else {
            btn.textContent = 'Add to cart';
          }
        }
      });

      syncQtyUI(qty > 0 ? qty : 1, getMaxQty(variant));
    }

    window.ckSyncPdpCart = function () {
      var currentVar = window.ckPdpCurrentVariant;
      if (!currentVar) {
        var currentOpt =
          document.querySelector('.weight-opt.selected') ||
          opts[0];
        if (currentOpt) {
          var vid = currentOpt.getAttribute('data-variant-id');
          currentVar = variantMap[String(vid)] || {
            id: vid,
            available: currentOpt.getAttribute('data-available') !== 'false'
          };
        }
      }
      syncButtonState(currentVar);
    };
    window.ckSyncPdpLocation = window.ckSyncPdpCart;

    function applyVariant(optionBtn) {
      if (!optionBtn) return;

      Array.prototype.forEach.call(opts, function (item) {
        item.classList.remove('selected');
      });

      optionBtn.classList.add('selected');

      var variantId = String(
        optionBtn.getAttribute('data-variant-id') || ''
      );

      var variant = variantMap[variantId];

      if (!variant) {
        console.warn(
          '[Cookme PDP] Variant data not found:',
          variantId
        );
        return;
      }

      /*
       * Keep variant ID synced with form
       */
      if (hid) {
        hid.value = variantId;
      }

      /*
       * Product information
       */
      if (priceEl) {
        priceEl.textContent =
          optionBtn.getAttribute('data-price-display') ||
          variant.price_display ||
          '';
      }

      var compareCents = parseInt(
        optionBtn.getAttribute('data-compare-cents') || '0',
        10
      );
      var priceCents = parseInt(
        optionBtn.getAttribute('data-price-cents') || '0',
        10
      );

      if (oldEl) {
        var compare =
          optionBtn.getAttribute('data-compare-display') ||
          variant.compare_display ||
          '';

        oldEl.style.display = compare ? 'inline' : 'none';

        if (compare) {
          oldEl.textContent = compare;
        }
      }

      /*
       * Save %
       */
      var offEl = document.getElementById('ckPdpOff');

      if (offEl) {

        if (compareCents > priceCents && priceCents > 0) {
          offEl.textContent =
            'Save ' +
            Math.round(
              ((compareCents - priceCents) / compareCents) * 100
            ) +
            '%';

          offEl.style.display = 'inline-block';
        } else {
          offEl.style.display = 'none';
        }
      }

      /*
       * Unit price
       */
      var unitEl = document.getElementById('ckPdpUnit');

      if (unitEl) {
        var unit =
          optionBtn.getAttribute('data-unit-price-display') ||
          variant.unit_price_display ||
          '';

        unitEl.textContent = unit;
        unitEl.style.display = unit ? '' : 'none';
      }

      /*
       * Selected variant title
       */
      if (selEl) {
        selEl.textContent =
          optionBtn.getAttribute('data-title') ||
          variant.title ||
          '';
      }

      /*
       * Stock
       */
      var isAvailable =
        String(
          optionBtn.getAttribute('data-available')
        ) !== 'false';

      var stockEl =
        document.getElementById('ckPdpStockStatus');

      if (stockEl) {
        stockEl.classList.toggle(
          'is-out',
          !isAvailable
        );

        stockEl.innerHTML = isAvailable
          ? '<i class="bi bi-check-circle-fill"></i> In stock'
          : '<i class="bi bi-x-circle-fill"></i> Out of stock';
      }

      var badgeEl = document.getElementById('ckPdpBadge');
      if (badgeEl) {
        var badgeText = '';
        var customBadge = badgeEl.getAttribute('data-custom-badge') || '';
        var isBestseller = badgeEl.getAttribute('data-bestseller') === 'true';

        if (!isAvailable) {
          badgeText = 'Sold Out';
        } else if (customBadge.trim()) {
          badgeText = customBadge;
        } else if (isBestseller) {
          badgeText = 'Bestseller';
        } else if (compareCents > priceCents) {
          badgeText = 'Sale';
        }

        badgeEl.textContent = badgeText;
        badgeEl.hidden = !badgeText;
        badgeEl.classList.toggle('out', badgeText === 'Sold Out');
      }

      /*
       * ========================================================
       * VARIANT GALLERY
       * Same behaviour as Quick Add popup
       * ========================================================
       */
      var gallery = [];

      if (variant && Array.isArray(variant.gallery)) {
        gallery = variant.gallery.filter(function (image) {
          return image && image.src;
        });
      }

      if (!gallery.length && variant && variant.featured_image) {
        gallery = [{
          src: variant.featured_image,
          full: variant.featured_image,
          alt: variant.title || ''
        }];
      }

      if (window.ckPdpSetGallery) {
        window.ckPdpSetGallery(gallery);
      }

      /*
       * ========================================================
       * EXISTING CART QUANTITY
       * ========================================================
       */
      var existingQty = getCartQty(variantId);
      var maxQty = getMaxQty(variant);

      if (existingQty > 0) {
        syncQtyUI(existingQty, maxQty);
      } else {
        syncQtyUI(1, maxQty);
      }

      syncButtonState(variant);

      /*
       * Store selected variant for other functions
       */
      window.ckPdpCurrentVariant = variant;
    }

    opts.forEach(function (option) {
      if (option.dataset.ckInit) return;

      option.dataset.ckInit = '1';

      option.addEventListener('click', function () {
        applyVariant(option);
      });
    });

    var initial =
      document.querySelector('.weight-opt.selected') ||
      opts[0];

    if (initial) {
      applyVariant(initial);
    }
  }


  /* ============================================================
     PDP QUANTITY
     Existing cart quantity aware
     ============================================================ */
  function initQty() {
    function bind(scope) {
      var stepper = document.querySelector(scope);

      if (!stepper || stepper.dataset.ckInit) return;

      stepper.dataset.ckInit = '1';

      var val = stepper.querySelector('.val');
      var buttons = stepper.querySelectorAll('button');

      if (buttons.length !== 2 || !val) return;

      function getVariantId() {
        var el =
          document.getElementById('ckPdpVariantId');

        return el ? el.value : '';
      }

      function getVariantData() {
        var variantEl =
          document.getElementById('ckPdpVariantMedia');

        if (!variantEl) return {};

        try {
          var map = JSON.parse(
            variantEl.textContent || '{}'
          );

          return map[String(getVariantId())] || {};
        } catch (e) {
          return {};
        }
      }

      function getCurrentQty() {
        return Math.max(
          0,
          parseInt(val.textContent, 10) || 0
        );
      }

      function getMaxQty() {
        var variant = getVariantData();
        var inventory = variant.inventory_quantity;

        if (
          inventory !== null &&
          inventory !== undefined &&
          inventory !== ''
        ) {
          inventory = Number(inventory);

          if (isFinite(inventory)) {
            return Math.max(0, Math.floor(inventory));
          }
        }

        return null;
      }

      function set(n) {
        if (!isPdpDeliverable()) return;
        n = Math.max(0, parseInt(n, 10) || 0);

        var maxQty = getMaxQty();

        if (maxQty !== null) {
          n = Math.min(n, maxQty);
        }

        val.textContent = String(n);

        var qtyInput =
          document.getElementById('ckPdpQty');

        if (qtyInput) {
          qtyInput.value = String(n);
        }

        var mobileQty =
          document.getElementById('mobQtyVal');

        if (mobileQty) {
          mobileQty.textContent = String(n);
        }

        /*
         * Minus can reach zero.
         */
        buttons[0].disabled = n <= 0;

        buttons[1].disabled =
          maxQty !== null && n >= maxQty;

        /*
         * Existing cart item = Update Cart
         * Zero = Add to Cart after removal
         */
        var cartItem =
          (window.ckCart.items || []).find(function (item) {
            return String(item.variant_id) ===
              String(getVariantId());
          });

        var addButtons = document.querySelectorAll(
          '#ckPdpAddBtn, #mobAddToCart'
        );

        Array.prototype.forEach.call(
          addButtons,
          function (btn) {
            if (!btn) return;

            if (n > 0) {
              btn.classList.add('is-added');
              btn.disabled = false;
              btn.textContent = 'Update Cart';
            } else {
              btn.classList.remove('is-added');
              btn.disabled = false;

              if (btn.id === 'ckPdpAddBtn') {
                btn.innerHTML =
                  '<i class="bi bi-bag"></i> Add to Cart';
              } else {
                btn.textContent = 'Add to cart';
              }
            }
          }
        );
      }

      buttons[0].addEventListener('click', function () {
        if (!isPdpDeliverable()) return;
        set(getCurrentQty() - 1);
      });

      buttons[1].addEventListener('click', function () {
        if (!isPdpDeliverable()) return;
        set(getCurrentQty() + 1);
      });
    }

    bind('.qty-stepper-lg');
    bind('.qty-stepper-mob');
  }

  /* ============================================================
     PDP ADD / UPDATE CART
     Add new variant
     Update existing variant
     Quantity 0 = remove
  ============================================================ */
  function initPdpAdd() {
    var form = document.getElementById('ckPdpForm');

    if (!form || form.dataset.ckInit) return;

    form.dataset.ckInit = '1';

    function getVariantId() {
      var el =
        document.getElementById('ckPdpVariantId');

      return el ? el.value : '';
    }

    function getQty() {
      var el =
        document.getElementById('ckPdpQty');

      return el
        ? Math.max(0, parseInt(el.value, 10) || 0)
        : 0;
    }

    function getCartItem(variantId) {
      return (window.ckCart.items || []).find(function (item) {
        return String(item.variant_id) ===
          String(variantId);
      });
    }

    function getVariantData(variantId) {
      var el =
        document.getElementById('ckPdpVariantMedia');

      if (!el) return {};

      try {
        var map = JSON.parse(
          el.textContent || '{}'
        );

        return map[String(variantId)] || {};
      } catch (e) {
        return {};
      }
    }

    function syncAfterCart() {
      if (!window.ckCart) return Promise.resolve();

      return window.ckCart.load().then(function () {
        if (window.ckSyncCardButtons) {
          window.ckSyncCardButtons();
        }

        var variantId = getVariantId();
        var item = getCartItem(variantId);

        /*
         * Reload current quantity from live cart
         */
        var qty = item
          ? parseInt(item.quantity, 10) || 0
          : 0;

        var desktop =
          document.querySelector('.qty-stepper-lg');

        var mobile =
          document.querySelector('.qty-stepper-mob');

        [desktop, mobile].forEach(function (stepper) {
          if (!stepper) return;

          var val = stepper.querySelector('.val');

          if (val) {
            val.textContent = String(qty);
          }
        });

        var qtyInput =
          document.getElementById('ckPdpQty');

        if (qtyInput) {
          qtyInput.value = String(qty);
        }

        var mobQty =
          document.getElementById('mobQtyVal');

        if (mobQty) {
          mobQty.textContent = String(qty);
        }

        /*
         * Update button state
         */
        var buttons = document.querySelectorAll(
          '#ckPdpAddBtn, #mobAddToCart'
        );

        Array.prototype.forEach.call(
          buttons,
          function (btn) {
            if (!btn) return;

            if (qty > 0) {
              btn.classList.add('is-added');
              btn.disabled = false;
              btn.textContent = 'Update Cart';
            } else {
              btn.classList.remove('is-added');
              btn.disabled = false;

              if (btn.id === 'ckPdpAddBtn') {
                btn.innerHTML =
                  '<i class="bi bi-bag"></i> Add to Cart';
              } else {
                btn.textContent = 'Add to cart';
              }
            }
          }
        );
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (!isPdpDeliverable()) {
        if (window.ckShowToast) {
          window.ckShowToast('This product is not deliverable to your selected location');
        }
        return;
      }

      var variantId = getVariantId();

      if (!variantId) return;

      var requestedQty = getQty();

      var variant =
        getVariantData(variantId);

      /*
       * Inventory limit
       */
      var maxQty = null;

      if (
        variant.inventory_quantity !== null &&
        variant.inventory_quantity !== undefined &&
        variant.inventory_quantity !== ''
      ) {
        maxQty = Number(
          variant.inventory_quantity
        );

        if (isFinite(maxQty)) {
          maxQty = Math.max(
            0,
            Math.floor(maxQty)
          );

          requestedQty =
            Math.min(requestedQty, maxQty);
        }
      }

      var existingItem =
        getCartItem(variantId);

      var buttons = document.querySelectorAll(
        '#ckPdpAddBtn, #mobAddToCart'
      );

      Array.prototype.forEach.call(
        buttons,
        function (btn) {
          if (btn) {
            btn.classList.add('is-loading');
            btn.disabled = true;
          }
        }
      );

      /*
       * ========================================================
       * EXISTING ITEM
       * /cart/change.js = absolute quantity
       * ========================================================
       */
      if (existingItem && existingItem.key) {
        var changeFd = new FormData();

        changeFd.append(
          'id',
          existingItem.key
        );

        changeFd.append(
          'quantity',
          requestedQty
        );

        fetch('/cart/change.js', {
          method: 'POST',
          body: changeFd,
          headers: {
            'X-Requested-With':
              'XMLHttpRequest'
          }
        })
          .then(function (response) {
            return response.json();
          })
          .then(function () {
            return syncAfterCart();
          })
          .then(function () {
            if (window.ckShowToast) {
              window.ckShowToast(
                requestedQty > 0
                  ? 'Cart updated'
                  : 'Removed from cart'
              );
            }
          })
          .catch(function () {
            if (window.ckShowToast) {
              window.ckShowToast(
                'Could not update cart'
              );
            }
          })
          .finally(function () {
            Array.prototype.forEach.call(
              buttons,
              function (btn) {
                if (btn) {
                  btn.classList.remove(
                    'is-loading'
                  );
                  btn.disabled = false;
                }
              }
            );
          });

        return;
      }

      /*
       * ========================================================
       * NEW ITEM
       * /cart/add.js
       * ========================================================
       */
      if (requestedQty <= 0) {
        requestedQty = 1;
      }

      var addFd = new FormData();

      addFd.append(
        'id',
        variantId
      );

      addFd.append(
        'quantity',
        requestedQty
      );

      fetch('/cart/add.js', {
        method: 'POST',
        body: addFd,
        headers: {
          'X-Requested-With':
            'XMLHttpRequest'
        }
      })
        .then(function (response) {
          return response.json();
        })
        .then(function () {
          return syncAfterCart();
        })
        .then(function () {
          if (window.ckShowToast) {
            window.ckShowToast(
              'Added to cart'
            );
          }
        })
        .catch(function () {
          if (window.ckShowToast) {
            window.ckShowToast(
              'Could not add to cart'
            );
          }
        })
        .finally(function () {
          Array.prototype.forEach.call(
            buttons,
            function (btn) {
              if (btn) {
                btn.classList.remove(
                  'is-loading'
                );
                btn.disabled = false;
              }
            }
          );
        });
    });

    window.ckBuyNow = function () {
      if (!isPdpDeliverable()) {
        if (window.ckShowToast) {
          window.ckShowToast(
            'This product is not deliverable to your selected location'
          );
        }
        return;
      }
      var variantId = getVariantId();
      var qty = getQty();

      var fd = new FormData();

      fd.append('id', variantId);
      fd.append('quantity', qty || 1);

      fetch('/cart/add.js', {
        method: 'POST',
        body: fd,
        headers: {
          'X-Requested-With':
            'XMLHttpRequest'
        }
      })
        .then(function () {
          window.location.href =
            '/checkout';
        })
        .catch(function () {
          if (window.ckShowToast) {
            window.ckShowToast(
              'Could not add to cart'
            );
          }
        });
    };
  }

  /* ---------- Description expand ---------- */
  (function () {

    'use strict';


    function initPdpDescription() {

        var desc =
            document.getElementById('productDesc');

        var toggle =
            document.getElementById('productDescToggle');


        if (!desc || !toggle) {
            return;
        }


        /* Prevent duplicate initialization */

        if (desc.dataset.ckDescriptionInit === '1') {
            return;
        }

        desc.dataset.ckDescriptionInit = '1';


        /* =====================================================
           CHECK 2-LINE OVERFLOW
        ===================================================== */

        function checkDescription() {

            /*
             * Always measure collapsed version
             */

            desc.classList.remove('expanded');
            desc.classList.add('collapsed');


            /*
             * Force browser to calculate layout
             */

            void desc.offsetHeight;


            /*
             * Actual content height > visible height
             * means content is more than 2 lines.
             */

            var hasMore =
                desc.scrollHeight >
                desc.clientHeight + 2;


            /*
             * More button only when required
             */

            toggle.hidden = !hasMore;


            /*
             * Initial state
             */

            toggle.textContent = 'More';
        }


        /* =====================================================
           MORE / LESS
        ===================================================== */

        toggle.addEventListener(
            'click',
            function (event) {

                event.preventDefault();


                var isExpanded =
                    desc.classList.contains('expanded');


                if (isExpanded) {

                    /*
                     * LESS
                     */

                    desc.classList.remove('expanded');
                    desc.classList.add('collapsed');

                    toggle.textContent = 'More';


                } else {

                    /*
                     * MORE
                     */

                    desc.classList.remove('collapsed');
                    desc.classList.add('expanded');

                    toggle.textContent = 'Less';

                }

            }
        );


        /* =====================================================
           RESPONSIVE SCREEN SIZE
        ===================================================== */

        var resizeTimer;

        window.addEventListener(
            'resize',
            function () {

                clearTimeout(resizeTimer);

                resizeTimer = setTimeout(
                    function () {

                        /*
                         * Don't collapse while expanded
                         */

                        if (
                            desc.classList.contains('expanded')
                        ) {
                            return;
                        }


                        checkDescription();

                    },
                    150
                );

            }
        );


        /* =====================================================
           WEB FONT LOAD
        ===================================================== */

        if (
            document.fonts &&
            document.fonts.ready
        ) {

            document.fonts.ready.then(
                function () {

                    if (
                        !desc.classList.contains('expanded')
                    ) {
                        checkDescription();
                    }

                }
            );

        }


        /* =====================================================
           INITIAL CHECK
        ===================================================== */

        checkDescription();

    }


    /* =========================================================
       DOM READY
    ========================================================= */

    if (
        document.readyState === 'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            initPdpDescription
        );

    } else {

        initPdpDescription();

    }

})();

  /* ---------- Accordions ---------- */
  function initAccordions() {
    var items = document.querySelectorAll('.acc-item');
    if (!items.length) return;
    function closeItem(item) {
      item.classList.remove('acc-open');
      var body = item.querySelector('.acc-body');
      if (!body) { item.open = false; return; }
      var start = body.scrollHeight;
      body.style.height = start + 'px';
      void body.offsetHeight;
      body.style.transition = 'height .3s ease';
      body.style.height = '0px';
      body.addEventListener('transitionend', function done(e) {
        if (e.propertyName !== 'height') return;
        item.open = false;
        body.style.height = '';
        body.style.transition = '';
        body.removeEventListener('transitionend', done);
      });
    }
    function openItem(item) {
      item.classList.add('acc-open');
      var body = item.querySelector('.acc-body');
      if (!body) { item.open = true; return; }
      item.open = true;
      var end = body.scrollHeight;
      body.style.height = '0px';
      void body.offsetHeight;
      body.style.transition = 'height .3s ease';
      body.style.height = end + 'px';
      body.addEventListener('transitionend', function done(e) {
        if (e.propertyName !== 'height') return;
        body.style.height = '';
        body.style.transition = '';
        body.removeEventListener('transitionend', done);
      });
    }
    items.forEach(function (item) {
      var summary = item.querySelector('summary');
      if (!summary || summary.dataset.ckInit) return;
      summary.dataset.ckInit = '1';
      summary.addEventListener('click', function (e) {
        e.preventDefault();
        if (item.open) closeItem(item);
        else {
          Array.prototype.forEach.call(items, function (o) { if (o !== item && o.open) closeItem(o); });
          openItem(item);
        }
      });
    });
  }

  /* ---------- Drag carousels (related + reviews) ---------- */
  window.initDragCarousel = function (track, prev, next) {
    if (!track) return;
    var isDown = false, startX = 0, scrollStart = 0, moved = false;
    track.addEventListener('mousedown', function (e) { isDown = true; moved = false; startX = e.clientX; scrollStart = track.scrollLeft; track.classList.add('dragging'); });
    window.addEventListener('mousemove', function (e) { if (!isDown) return; if (Math.abs(e.clientX - startX) > 4) moved = true; track.scrollLeft = scrollStart - (e.clientX - startX); });
    window.addEventListener('mouseup', function () { isDown = false; track.classList.remove('dragging'); });
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -track.clientWidth * 0.75, behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: track.clientWidth * 0.75, behavior: 'smooth' }); });
  };
  window.initDragCarousel(document.getElementById('relatedTrack'), document.getElementById('relatedPrev'), document.getElementById('relatedNext'));
  window.initDragCarousel(document.getElementById('reviewTrack'), document.getElementById('reviewPrev'), document.getElementById('reviewNext'));

  /* ---------- See all reviews (static) ---------- */
  function initReviewCtas() {
    ['seeAllReviewsBtn', 'seeAllReviewsBtnM', 'writeReviewBtn'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b && !b.dataset.ckInit) { b.dataset.ckInit = '1'; b.addEventListener('click', function (e) { e.preventDefault(); }); }
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initFilterDrawer();
    initFilterAccordions();
    initPlpFilterAjax();
    initPagination();
    initPdpGallery();
    initVariants();
    initQty();
    initPdpAdd();
    initAccordions();
    initReviewCtas();
    checkLocationEmptyGrids();
  }

  ready(boot);

  /* re-run PDP bits when the product section re-renders (theme editor /
     section reload) without double-binding document-level listeners */
  document.addEventListener('shopify:section:load', function () {
    if (document.getElementById('ckPdpMedia')) {
      initPdpGallery();
      initVariants();
      initPdpAdd();
    }
    if (window.ckSyncCardButtons) window.ckSyncCardButtons();
  });
})();
