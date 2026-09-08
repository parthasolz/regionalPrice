/**
 * Cookme Regional Indian State Selector & Auto-Discount Client Script
 */

(function () {
  const STORAGE_KEY = "cookme_regional_customer_state";
  const STORAGE_CODE_KEY = "cookme_regional_customer_state_code";

  // Pre-configured default discount state highlights (e.g. West Bengal: 50% OFF)
  let activeStateDiscounts = {
    "West Bengal": { badge: "50% OFF 🔥", discount: "50% OFF", message: "50% off discount will be auto-applied at checkout!" },
    "WB": { badge: "50% OFF 🔥", discount: "50% OFF", message: "50% off discount will be auto-applied at checkout!" },
  };

  function getStoredState() {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }

  function setStoredState(name, code) {
    try {
      localStorage.setItem(STORAGE_KEY, name);
      if (code) localStorage.setItem(STORAGE_CODE_KEY, code);
    } catch (e) {
      console.warn("Unable to save to localStorage", e);
    }
  }

  // Update Shopify Cart Attributes via Ajax API
  async function syncCartAttribute(stateName) {
    try {
      const response = await fetch("/cart/update.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          attributes: {
            _customer_state: stateName,
            State: stateName,
          },
        }),
      });

      if (!response.ok) {
        console.warn("Failed to update cart attributes:", response.statusText);
      }
    } catch (err) {
      console.error("Error updating cart attribute for regional discount:", err);
    }
  }

  // Fetch current cart state on load
  async function fetchCartState() {
    try {
      const response = await fetch("/cart.js");
      if (response.ok) {
        const cart = await response.json();
        const cartState = cart.attributes && (cart.attributes["_customer_state"] || cart.attributes["State"]);
        return cartState || null;
      }
    } catch (err) {
      console.warn("Could not read cart.js:", err);
    }
    return null;
  }

  // Fetch live discount configurations if available from app endpoint
  async function fetchLiveDiscounts() {
    try {
      const shopDomain = (window.Shopify && window.Shopify.shop) ? window.Shopify.shop : "";
      const res = await fetch(`/api/state-discounts?shop=${encodeURIComponent(shopDomain)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.rules && Array.isArray(data.rules)) {
          activeStateDiscounts = {};
          data.rules.forEach((r) => {
            if (r.isActive && r.discountValue > 0) {
              const label = r.discountType === "FIXED_AMOUNT" ? `₹${r.discountValue} OFF` : `${r.discountValue}% OFF`;
              const discountObj = {
                badge: `${label} 🔥`,
                discount: label,
                message: r.customMessage || `${label} discount will be automatically applied at checkout!`,
              };
              if (r.stateName) activeStateDiscounts[r.stateName] = discountObj;
              if (r.stateCode) activeStateDiscounts[r.stateCode] = discountObj;
            }
          });
          refreshStateListBadges();
          const currentState = getStoredState();
          if (currentState) {
            updateUI(currentState);
          }
        }
      }
    } catch {
      // Fallback to default in-memory rules
    }
  }

  function showToast(message) {
    const toast = document.getElementById("regional-toast");
    const msgEl = document.getElementById("regional-toast-msg");
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    toast.style.display = "flex";

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.display = "none";
    }, 4000);
  }

  function updateUI(stateName) {
    // 1. Update launcher label
    const currentLabel = document.getElementById("regional-current-state-label");
    if (currentLabel) {
      currentLabel.textContent = stateName || "Select State";
    }

    // 2. Check for active discount info
    const discountInfo = activeStateDiscounts[stateName];
    const pill = document.getElementById("regional-active-pill");
    const pillText = document.getElementById("regional-pill-text");

    if (pill && pillText) {
      if (discountInfo) {
        pillText.textContent = discountInfo.discount;
        pill.style.display = "inline-flex";
      } else {
        pill.style.display = "none";
      }
    }

    // 3. Update Modal active notice
    const notice = document.getElementById("regional-discount-notice");
    const noticeTitle = document.getElementById("regional-notice-title");
    const noticeDesc = document.getElementById("regional-notice-desc");

    if (notice && noticeTitle && noticeDesc) {
      if (discountInfo) {
        noticeTitle.textContent = `Special offer for ${stateName}! 🎉`;
        noticeDesc.textContent = discountInfo.message;
        notice.style.display = "flex";
      } else if (stateName) {
        noticeTitle.textContent = `Delivering to ${stateName} 📍`;
        noticeDesc.textContent = "Standard delivery & regional pricing applied.";
        notice.style.display = "flex";
      } else {
        notice.style.display = "none";
      }
    }

    // 4. Highlight state item in list
    const items = document.querySelectorAll(".regional-state-item");
    items.forEach((item) => {
      const itemName = item.getAttribute("data-name");
      if (itemName === stateName) {
        item.classList.add("regional-item-selected");
      } else {
        item.classList.remove("regional-item-selected");
      }
    });

    // 5. Update any banner block on the page
    const bannerMsg = document.getElementById("regional-banner-dynamic-msg");
    const bannerBtnText = document.getElementById("regional-banner-btn-text");
    if (bannerMsg && stateName) {
      if (discountInfo) {
        bannerMsg.innerHTML = `Delivering to <strong>${stateName}</strong>: Enjoy <strong>${discountInfo.discount}</strong> automatically applied at checkout!`;
      } else {
        bannerMsg.innerHTML = `Delivering to <strong>${stateName}</strong>. Standard rates apply.`;
      }
    }
    if (bannerBtnText && stateName) {
      bannerBtnText.textContent = stateName;
    }

    // 6. Update Product Page and Storefront Prices dynamically
    updateStorefrontPrices(stateName, discountInfo);

    // Dispatch global event for theme integration
    document.dispatchEvent(
      new CustomEvent("regional:state-changed", {
        detail: { state: stateName, discount: discountInfo || null },
      })
    );
  }

  function updateStorefrontPrices(stateName, discountInfo) {
    // Select standard Shopify theme price containers (Dawn, Debut, Sense, Refresh, Craft, etc.)
    const priceSelectors = [
      ".price__regular .price-item--regular",
      ".price__sale .price-item--sale",
      ".product__price .price-item--regular",
      ".product__price .price-item--sale",
      ".product__price",
      "[data-product-price]",
      ".price-item--regular",
      ".price-item--last",
      ".cart-item__price",
      ".cart-item__discounted-prices",
    ];

    const priceEls = document.querySelectorAll(priceSelectors.join(", "));

    priceEls.forEach((el) => {
      // Don't modify elements inside our own widget or badges
      if (el.closest("#regional-state-widget") || el.classList.contains("regional-processed-price")) return;

      // Cache original HTML if not yet stored
      if (!el.hasAttribute("data-regional-original-html")) {
        el.setAttribute("data-regional-original-html", el.innerHTML);
        el.setAttribute("data-regional-original-text", el.textContent.trim());
      }

      const originalHtml = el.getAttribute("data-regional-original-html");
      const originalText = el.getAttribute("data-regional-original-text") || "";

      if (!discountInfo) {
        // Restore original price
        el.innerHTML = originalHtml;
        const existingBadge = el.parentElement?.querySelector(".regional-price-discount-callout");
        if (existingBadge) existingBadge.remove();
        return;
      }

      // Extract currency symbol and numeric price (e.g. ₹1,000.00 or Rs. 1,000 or $50.00)
      const matches = originalText.match(/([^\d.,\s]*)\s*([\d,]+(?:\.\d+)?)/);
      if (!matches) return;

      const currencySymbol = matches[1] || "₹";
      const rawNumberStr = matches[2].replace(/,/g, "");
      const originalNumber = parseFloat(rawNumberStr);

      if (isNaN(originalNumber) || originalNumber <= 0) return;

      // Extract discount percent or fixed value
      let discountedPrice = originalNumber;
      let discountTag = discountInfo.discount;

      const percentMatch = discountInfo.discount.match(/(\d+(?:\.\d+)?)\s*%/);
      const fixedMatch = discountInfo.discount.match(/₹?\s*(\d+(?:\.\d+)?)\s*OFF/i);

      if (percentMatch) {
        const percent = parseFloat(percentMatch[1]);
        discountedPrice = Math.max(0, originalNumber * (1 - percent / 100));
      } else if (fixedMatch) {
        const fixed = parseFloat(fixedMatch[1]);
        discountedPrice = Math.max(0, originalNumber - fixed);
      }

      const formattedOriginal = originalNumber.toLocaleString("en-IN", {
        minimumFractionDigits: originalNumber % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });

      const formattedDiscounted = discountedPrice.toLocaleString("en-IN", {
        minimumFractionDigits: discountedPrice % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });

      el.innerHTML = `
        <span class="regional-price-container">
          <span class="regional-discounted-price-highlight">${currencySymbol}${formattedDiscounted}</span>
          <s class="regional-price-original-strike">${currencySymbol}${formattedOriginal}</s>
          <span class="regional-state-pill-tag">${discountTag} (${stateName})</span>
        </span>
      `;

      // Also ensure parent container doesn't have duplicate badge
      const parent = el.parentElement;
      if (parent && !parent.querySelector(".regional-price-discount-callout")) {
        const callout = document.createElement("div");
        callout.className = "regional-price-discount-callout";
        callout.innerHTML = `<span>⚡ <strong>${discountTag}</strong> auto-applies at checkout for <strong>${stateName}</strong></span>`;
        if (!parent.querySelector(".regional-price-discount-callout")) {
          parent.appendChild(callout);
        }
      }
    });
  }

  function refreshStateListBadges() {
    const items = document.querySelectorAll(".regional-state-item");
    items.forEach((item) => {
      const name = item.getAttribute("data-name");
      const code = item.getAttribute("data-code");
      const badgeEl = item.querySelector(".regional-state-badge");
      const discount = activeStateDiscounts[name] || activeStateDiscounts[code];

      if (badgeEl) {
        if (discount) {
          badgeEl.textContent = discount.badge;
          badgeEl.className = "regional-state-badge regional-badge-hot";
          badgeEl.style.display = "inline-block";
        } else {
          badgeEl.style.display = "none";
        }
      }
    });
  }

  function openModal() {
    const modal = document.getElementById("regional-state-modal");
    const backdrop = document.getElementById("regional-modal-backdrop");
    const launcher = document.getElementById("regional-state-launcher");
    if (modal && backdrop) {
      modal.style.display = "flex";
      backdrop.style.display = "block";
      if (launcher) launcher.setAttribute("aria-expanded", "true");
      const searchInput = document.getElementById("regional-state-search");
      if (searchInput) {
        searchInput.value = "";
        filterStates("");
        setTimeout(() => searchInput.focus(), 50);
      }
    }
  }

  function closeModal() {
    const modal = document.getElementById("regional-state-modal");
    const backdrop = document.getElementById("regional-modal-backdrop");
    const launcher = document.getElementById("regional-state-launcher");
    if (modal && backdrop) {
      modal.style.display = "none";
      backdrop.style.display = "none";
      if (launcher) launcher.setAttribute("aria-expanded", "false");
    }
  }

  function filterStates(query) {
    const normalized = query.toLowerCase().trim();
    const items = document.querySelectorAll(".regional-state-item");
    items.forEach((item) => {
      const name = (item.getAttribute("data-name") || "").toLowerCase();
      const code = (item.getAttribute("data-code") || "").toLowerCase();
      if (!normalized || name.includes(normalized) || code.includes(normalized)) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  }

  function handleStateSelection(stateName, stateCode) {
    setStoredState(stateName, stateCode);
    updateUI(stateName);
    syncCartAttribute(stateName);

    const discountInfo = activeStateDiscounts[stateName];
    if (discountInfo) {
      showToast(`🎉 ${stateName} selected! ${discountInfo.discount} auto-applied at checkout.`);
    } else {
      showToast(`📍 Delivery state set to ${stateName}`);
    }

    closeModal();
  }

  function init() {
    const widget = document.getElementById("regional-state-widget");
    if (!widget) return;

    const launcher = document.getElementById("regional-state-launcher");
    const closeBtn = document.getElementById("regional-modal-close");
    const backdrop = document.getElementById("regional-modal-backdrop");
    const doneBtn = document.getElementById("regional-modal-done-btn");
    const searchInput = document.getElementById("regional-state-search");
    const bannerTrigger = document.getElementById("regional-banner-trigger-btn");

    if (launcher) launcher.addEventListener("click", openModal);
    if (bannerTrigger) bannerTrigger.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (backdrop) backdrop.addEventListener("click", closeModal);
    if (doneBtn) doneBtn.addEventListener("click", closeModal);

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        filterStates(e.target.value);
      });
    }

    // State list item click handlers
    const list = document.getElementById("regional-state-list");
    if (list) {
      list.addEventListener("click", (e) => {
        const item = e.target.closest(".regional-state-item");
        if (item) {
          const name = item.getAttribute("data-name");
          const code = item.getAttribute("data-code");
          if (name) handleStateSelection(name, code);
        }
      });
    }

    // Keyboard navigation (Escape to close)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    // Initial state resolution
    (async () => {
      let activeState = getStoredState();
      const cartState = await fetchCartState();

      if (cartState && !activeState) {
        activeState = cartState;
        setStoredState(cartState);
      } else if (activeState && (!cartState || cartState !== activeState)) {
        await syncCartAttribute(activeState);
      } else if (!activeState && !cartState) {
        // Default to West Bengal (as user requested e.g. 50% off for West Bengal) or leave unselected
        const defaultState = widget.getAttribute("data-default-state") || "West Bengal";
        activeState = defaultState;
        setStoredState(defaultState);
        await syncCartAttribute(defaultState);
      }

      updateUI(activeState);
      fetchLiveDiscounts();
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
