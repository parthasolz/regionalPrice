class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();

      const cartItems =
        this.closest('cart-items') ||
        this.closest('cart-drawer-items');

      if (cartItems) {
        cartItems.updateQuantity(
          this.dataset.index,
          0,
          event
        );
      }
    });
  }
}

customElements.define(
  'cart-remove-button',
  CartRemoveButton
);


class CartItems extends window.StandardEvents.createViewEventElement(HTMLElement) {

  constructor() {
    super();

    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') ||
      document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce(
      (event) => {
        this.onChange(event);
      },
      ON_CHANGE_DEBOUNCE_TIMER
    );

    this.addEventListener(
      'change',
      debouncedOnChange.bind(this)
    );
  }


  cartUpdateUnsubscriber = undefined;

  static pendingCartDataPromise = null;


  connectedCallback() {

    super.connectedCallback();

    this.cartUpdateUnsubscriber =
      subscribe(
        PUB_SUB_EVENTS.cartUpdate,
        (event) => {

          if (event.source === 'cart-items') {
            return;
          }

          return this.onCartUpdate();

        }
      );

  }


  static fetchCartData() {

    if (!CartItems.pendingCartDataPromise) {

      const pendingCartDataPromise =
        fetch(`${routes.cart_url}.json`)
          .then((response) => response.json())
          .catch(() => null)
          .finally(() => {

            if (
              CartItems.pendingCartDataPromise ===
              pendingCartDataPromise
            ) {
              CartItems.pendingCartDataPromise = null;
            }

          });

      CartItems.pendingCartDataPromise =
        pendingCartDataPromise;
    }

    return CartItems.pendingCartDataPromise;
  }


  disconnectedCallback() {

    if (this.cartUpdateUnsubscriber) {

      this.cartUpdateUnsubscriber();

      this.cartUpdateUnsubscriber = undefined;

    }

  }


  resetQuantityInput(id) {

    const input =
      this.querySelector(`#Quantity-${id}`);

    if (!input) {
      return;
    }

    input.value =
      input.getAttribute('value');

    this.isEnterPressed = false;

  }


  setValidity(event, index, message) {

    event.target.setCustomValidity(message);

    event.target.reportValidity();

    this.resetQuantityInput(index);

    event.target.select();

  }


  validateQuantity(event) {

    const inputValue =
      parseInt(event.target.value);

    const index =
      event.target.dataset.index;

    let message = '';


    if (
      inputValue <
      parseInt(event.target.dataset.min)
    ) {

      message =
        window.quickOrderListStrings.min_error
          .replace(
            '[min]',
            event.target.dataset.min
          );

    }

    else if (
      event.target.max &&
      inputValue >
      parseInt(event.target.max)
    ) {

      message =
        window.quickOrderListStrings.max_error
          .replace(
            '[max]',
            event.target.max
          );

    }

    else if (
      event.target.step &&
      inputValue %
      parseInt(event.target.step) !== 0
    ) {

      message =
        window.quickOrderListStrings.step_error
          .replace(
            '[step]',
            event.target.step
          );

    }


    if (message) {

      this.setValidity(
        event,
        index,
        message
      );

    }

    else {

      event.target.setCustomValidity('');

      event.target.reportValidity();

      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement?.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );

    }

  }


  onChange(event) {

    if (
      !event.target.matches(
        '.quantity__input'
      )
    ) {
      return;
    }

    this.validateQuantity(event);

  }


  onCartUpdate() {

    /* ========================================================
       CART DRAWER
       ======================================================== */

    if (
      this.tagName ===
      'CART-DRAWER-ITEMS'
    ) {

      return fetch(
        `${routes.cart_url}?section_id=cart-drawer`
      )

        .then(
          (response) =>
            response.text()
        )

        .then((responseText) => {

          const html =
            new DOMParser()
              .parseFromString(
                responseText,
                'text/html'
              );

          const selectors = [
            'cart-drawer-items',
            '.cart-drawer__footer'
          ];


          for (
            const selector of selectors
          ) {

            const targetElement =
              document.querySelector(
                selector
              );

            const sourceElement =
              html.querySelector(
                selector
              );


            if (
              targetElement &&
              sourceElement
            ) {

              targetElement.replaceWith(
                sourceElement
              );

            }

          }

        })

        .catch((error) => {

          console.error(
            'Cart drawer update error:',
            error
          );

        });

    }


    /* ========================================================
       MAIN COMBINED CART
       ======================================================== */

    const sectionId =
      this.dataset.id;

    if (!sectionId) {

      console.warn(
        'Cart section ID is missing.'
      );

      return Promise.resolve();

    }


    return fetch(
      `${routes.cart_url}?section_id=${sectionId}`
    )

      .then(
        (response) =>
          response.text()
      )

      .then((responseText) => {

        const html =
          new DOMParser()
            .parseFromString(
              responseText,
              'text/html'
            );


        const sourceCart =
          html.querySelector(
            'cart-items'
          );

        const targetContents =
          this.querySelector(
            '.js-contents'
          );


        if (
          sourceCart &&
          targetContents
        ) {

          const sourceContents =
            sourceCart.querySelector(
              '.js-contents'
            );


          if (sourceContents) {

            targetContents.innerHTML =
              sourceContents.innerHTML;

          }

        }

      })

      .catch((error) => {

        console.error(
          'Cart update error:',
          error
        );

      });

  }


  getSectionsToRender() {

    const mainCart =
      document.getElementById(
        'main-cart-items'
      );


    return [

      {
        id: 'main-cart-items',

        section:
          mainCart
            ? mainCart.dataset.id
            : '',

        selector:
          '.js-contents',
      },


      {
        id: 'cart-icon-bubble',

        section:
          'cart-icon-bubble',

        selector:
          '.shopify-section',
      }

    ].filter(
      (section) =>
        section.section
    );

  }


  updateQuantity(
    line,
    quantity,
    event,
    name,
    variantId
  ) {

    const eventTarget =
      event.currentTarget instanceof CartRemoveButton
        ? 'clear'
        : 'change';


    const cartPerformanceUpdateMarker =
      CartPerformance.createStartingMarker(
        `${eventTarget}:user-action`
      );


    this.enableLoading(line);


    const action =
      quantity === 0
        ? 'remove'
        : 'update';


    const quantityInput =
      this.querySelector(
        `#Quantity-${line}`
      ) ||
      this.querySelector(
        `#Drawer-quantity-${line}`
      );


    const lineVariantId =
      variantId ||
      quantityInput?.dataset.quantityVariantId;


    const lineKey =
      quantityInput?.dataset.quantityLineKey;


    const linesUpdateDeferred =
      this.createCartLinesUpdateEvent(
        action,
        lineVariantId,
        quantity,
        lineKey
      );


    const sectionsToRender =
      this.getSectionsToRender();


    const body =
      JSON.stringify({

        line,

        quantity,

        sections:
          sectionsToRender.map(
            (section) =>
              section.section
          ),

        sections_url:
          window.location.pathname

      });


    fetch(
      `${routes.cart_change_url}`,
      {
        ...fetchConfig(),
        ...{
          body
        }
      }
    )

      .then(
        (response) =>
          response.text()
      )

      .then((state) => {

        const parsedState =
          JSON.parse(state);


        if (parsedState.errors) {

          this.dispatchCartErrorEvent(
            parsedState.errors,
            'INVALID'
          );

          linesUpdateDeferred?.reject(
            new Error(
              parsedState.errors
            )
          );

        }

        else {

          this.resolveCartLinesUpdate(
            linesUpdateDeferred,
            parsedState
          );

        }


        CartPerformance.measure(
          `${eventTarget}:paint-updated-sections`,
          () => {


            const quantityElement =
              document.getElementById(
                `Quantity-${line}`
              ) ||
              document.getElementById(
                `Drawer-quantity-${line}`
              );


            const items =
              document.querySelectorAll(
                '.cart-item'
              );


            if (parsedState.errors) {

              if (quantityElement) {

                quantityElement.value =
                  quantityElement.getAttribute(
                    'value'
                  );

              }

              this.updateLiveRegions(
                line,
                parsedState.errors
              );

              return;

            }


            this.classList.toggle(
              'is-empty',
              parsedState.item_count === 0
            );


            const cartDrawerWrapper =
              document.querySelector(
                'cart-drawer'
              );


            if (cartDrawerWrapper) {

              cartDrawerWrapper.classList.toggle(
                'is-empty',
                parsedState.item_count === 0
              );

            }


            /* ==================================================
               REPLACE CART SECTIONS
               ================================================== */

            sectionsToRender.forEach(
              (section) => {

                const targetElement =
                  document.getElementById(
                    section.id
                  );


                if (!targetElement) {
                  return;
                }


                const sourceHTML =
                  parsedState.sections[
                    section.section
                  ];


                if (!sourceHTML) {
                  return;
                }


                const parsedHTML =
                  new DOMParser()
                    .parseFromString(
                      sourceHTML,
                      'text/html'
                    );


                const sourceElement =
                  parsedHTML.querySelector(
                    section.selector
                  );


                if (!sourceElement) {
                  return;
                }


                const elementToReplace =
                  targetElement.querySelector(
                    section.selector
                  ) ||
                  targetElement;


                elementToReplace.innerHTML =
                  sourceElement.innerHTML;

              }
            );


            /* ==================================================
               QUANTITY VALIDATION MESSAGE
               ================================================== */

            const updatedValue =
              parsedState.items[line - 1]
                ? parsedState.items[line - 1].quantity
                : undefined;


            let message = '';


            if (
              items.length ===
              parsedState.items.length &&
              quantityElement &&
              updatedValue !==
              parseInt(
                quantityElement.value
              )
            ) {

              if (
                typeof updatedValue ===
                'undefined'
              ) {

                message =
                  window.cartStrings.error;

              }

              else {

                message =
                  window.cartStrings.quantityError
                    .replace(
                      '[quantity]',
                      updatedValue
                    );

              }

            }


            this.updateLiveRegions(
              line,
              message
            );


            /* ==================================================
               FOCUS RESTORATION
               ================================================== */

            const lineItem =
              document.getElementById(
                `CartItem-${line}`
              ) ||
              document.getElementById(
                `CartDrawer-Item-${line}`
              );


            if (
              lineItem &&
              name &&
              lineItem.querySelector(
                `[name="${name}"]`
              )
            ) {

              const focusElement =
                lineItem.querySelector(
                  `[name="${name}"]`
                );


              if (cartDrawerWrapper) {

                trapFocus(
                  cartDrawerWrapper,
                  focusElement
                );

              }

              else {

                focusElement.focus();

              }

            }

            else if (
              parsedState.item_count === 0 &&
              cartDrawerWrapper?.querySelector(
                '.drawer__inner-empty'
              )
            ) {

              trapFocus(
                cartDrawerWrapper.querySelector(
                  '.drawer__inner-empty'
                ),
                cartDrawerWrapper.querySelector(
                  'a'
                )
              );

            }

            else if (
              document.querySelector(
                '.cart-item'
              ) &&
              cartDrawerWrapper
            ) {

              trapFocus(
                cartDrawerWrapper,
                document.querySelector(
                  '.cart-item__name'
                )
              );

            }

          }
        );


        publish(
          PUB_SUB_EVENTS.cartUpdate,
          {
            source: 'cart-items',
            cartData: parsedState,
            variantId: variantId
          }
        );

      })

      .catch((error) => {

        this.querySelectorAll(
          '.loading__spinner'
        ).forEach(
          (overlay) =>
            overlay.classList.add(
              'hidden'
            )
        );


        const errors =
          document.getElementById(
            'cart-errors'
          ) ||
          document.getElementById(
            'CartDrawer-CartErrors'
          );


        if (errors) {

          errors.textContent =
            window.cartStrings.error;

        }


        this.dispatchCartErrorEvent(
          window.cartStrings.error,
          'SERVICE_UNAVAILABLE'
        );


        linesUpdateDeferred?.reject(
          error
        );

      })

      .finally(() => {

        this.disableLoading(line);

        CartPerformance.measureFromMarker(
          `${eventTarget}:user-action`,
          cartPerformanceUpdateMarker
        );

      });

  }


  createCartLinesUpdateEvent(
    action,
    variantId,
    quantity,
    lineKey
  ) {

    const {
      CartLinesUpdateEvent
    } =
      window.StandardEvents || {};


    if (
      !CartLinesUpdateEvent ||
      !variantId
    ) {

      return null;

    }


    if (!lineKey) {

      return null;

    }


    const deferred =
      CartLinesUpdateEvent.createPromise();


    this.dispatchEvent(
      new CartLinesUpdateEvent({

        action,

        context: 'cart',

        lines: [
          {
            id: lineKey,
            quantity
          }
        ],

        promise:
          deferred.promise

      })
    );


    return deferred;

  }


  resolveCartLinesUpdate(
    deferred,
    parsedState
  ) {

    if (!deferred) {
      return;
    }


    const {
      CartLinesUpdateEvent
    } =
      window.StandardEvents || {};


    if (!CartLinesUpdateEvent) {
      return;
    }


    deferred.resolve({

      cart:
        CartLinesUpdateEvent
          .createCartFromAjaxResponse(
            parsedState
          )

    });

  }


  dispatchCartErrorEvent(
    message,
    code
  ) {

    const {
      CartErrorEvent
    } =
      window.StandardEvents || {};


    if (!CartErrorEvent) {
      return;
    }


    this.dispatchEvent(
      new CartErrorEvent({

        error: message,

        code

      })
    );

  }


  updateLiveRegions(
    line,
    message
  ) {

    const lineItemError =
      document.getElementById(
        `Line-item-error-${line}`
      ) ||
      document.getElementById(
        `CartDrawer-LineItemError-${line}`
      );


    if (lineItemError) {

      const errorText =
        lineItemError.querySelector(
          '.cart-item__error-text'
        );

      if (errorText) {
        errorText.textContent = message;
      }

    }


    const lineItemStatusElement =
      document.getElementById(
        'shopping-cart-line-item-status'
      ) ||
      document.getElementById(
        'CartDrawer-LineItemStatus'
      );


    if (lineItemStatusElement) {

      lineItemStatusElement.setAttribute(
        'aria-hidden',
        true
      );

    }


    const cartStatus =
      document.getElementById(
        'cart-live-region-text'
      ) ||
      document.getElementById(
        'CartDrawer-LiveRegionText'
      );


    if (!cartStatus) {
      return;
    }


    cartStatus.setAttribute(
      'aria-hidden',
      false
    );


    cartStatus.textContent =
      message || '';


    setTimeout(() => {

      cartStatus.setAttribute(
        'aria-hidden',
        true
      );

    }, 1000);

  }


  getSectionInnerHTML(
    html,
    selector
  ) {

    const parsedHTML =
      new DOMParser()
        .parseFromString(
          html,
          'text/html'
        );


    const element =
      parsedHTML.querySelector(
        selector
      );


    return element
      ? element.innerHTML
      : '';

  }


  enableLoading(line) {

    const mainCartItems =
      document.getElementById(
        'main-cart-items'
      ) ||
      document.getElementById(
        'CartDrawer-CartItems'
      );


    if (mainCartItems) {

      mainCartItems.classList.add(
        'cart__items--disabled'
      );

    }


    const cartItemElements =
      this.querySelectorAll(
        `#CartItem-${line} .loading__spinner`
      );


    const cartDrawerItemElements =
      this.querySelectorAll(
        `#CartDrawer-Item-${line} .loading__spinner`
      );


    [
      ...cartItemElements,
      ...cartDrawerItemElements
    ].forEach(
      (overlay) =>
        overlay.classList.remove(
          'hidden'
        )
    );


    if (
      document.activeElement &&
      typeof document.activeElement.blur ===
        'function'
    ) {

      document.activeElement.blur();

    }


    const statusElement =
      document.getElementById(
        'shopping-cart-line-item-status'
      ) ||
      document.getElementById(
        'CartDrawer-LineItemStatus'
      );


    if (statusElement) {

      statusElement.setAttribute(
        'aria-hidden',
        false
      );

    }

  }


  disableLoading(line) {

    const mainCartItems =
      document.getElementById(
        'main-cart-items'
      ) ||
      document.getElementById(
        'CartDrawer-CartItems'
      );


    if (mainCartItems) {

      mainCartItems.classList.remove(
        'cart__items--disabled'
      );

    }


    const cartItemElements =
      this.querySelectorAll(
        `#CartItem-${line} .loading__spinner`
      );


    const cartDrawerItemElements =
      this.querySelectorAll(
        `#CartDrawer-Item-${line} .loading__spinner`
      );


    [
      ...cartItemElements,
      ...cartDrawerItemElements
    ].forEach(
      (overlay) =>
        overlay.classList.add(
          'hidden'
        )
    );

  }

}


customElements.define(
  'cart-items',
  CartItems
);


/* ============================================================
   CART NOTE
   ============================================================ */

if (!customElements.get('cart-note')) {

  customElements.define(
    'cart-note',

    class CartNote extends HTMLElement {

      constructor() {

        super();


        this.addEventListener(
          'input',

          debounce(
            (event) => {

              const newNote =
                event.target.value;


              const noteDeferred =
                this.dispatchNoteUpdateEvent(
                  newNote
                );


              const body =
                JSON.stringify({
                  note: newNote
                });


              fetch(
                `${routes.cart_update_url}`,
                {
                  ...fetchConfig(),
                  ...{
                    body
                  }
                }
              )

                .then(
                  (response) =>
                    response.json()
                )

                .then((cart) => {

                  if (
                    !cart ||
                    cart.errors
                  ) {

                    throw Object.assign(
                      new Error(
                        cart?.errors
                      ),
                      {
                        code:
                          'INVALID'
                      }
                    );

                  }


                  if (noteDeferred) {

                    const {
                      CartNoteUpdateEvent
                    } =
                      window.StandardEvents || {};


                    if (
                      CartNoteUpdateEvent
                    ) {

                      noteDeferred.resolve({

                        cart:
                          CartNoteUpdateEvent
                            .createCartFromAjaxResponse(
                              cart
                            )

                      });

                    }

                  }


                  CartPerformance.measureFromEvent(
                    'note-update:user-action',
                    event
                  );

                })

                .catch((error) => {

                  noteDeferred?.reject(
                    error
                  );


                  const {
                    CartErrorEvent
                  } =
                    window.StandardEvents || {};


                  if (CartErrorEvent) {

                    this.dispatchEvent(
                      new CartErrorEvent({

                        error:
                          error.message ||
                          'Note update failed',

                        code:
                          error.code ||
                          'SERVICE_UNAVAILABLE'

                      })
                    );

                  }

                });

            },

            ON_CHANGE_DEBOUNCE_TIMER

          )
        );

      }


      dispatchNoteUpdateEvent(
        newNote
      ) {

        const {
          CartNoteUpdateEvent
        } =
          window.StandardEvents || {};


        if (!CartNoteUpdateEvent) {
          return null;
        }


        const context =
          this.closest('dialog') ||
          this.closest('cart-drawer')
            ? 'dialog'
            : 'cart';


        const deferred =
          CartNoteUpdateEvent.createPromise();


        this.dispatchEvent(
          new CartNoteUpdateEvent({

            context,

            note: newNote,

            promise:
              deferred.promise

          })
        );


        return deferred;

      }

    }
  );

}