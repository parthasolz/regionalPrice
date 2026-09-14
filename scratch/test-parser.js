import { JSDOM } from 'jsdom';

async function test() {
  const form = new URLSearchParams();
  form.append('form_type', 'storefront_password');
  form.append('utf8', '✓');
  form.append('password', 'apptst');
  const resLogin = await fetch('https://itzapptst.myshopify.com/password', { method: 'POST', body: form, redirect: 'manual' });
  const cookie = resLogin.headers.get('set-cookie');
  const resPage = await fetch('https://itzapptst.myshopify.com/collections/all', { headers: { 'Cookie': cookie || '' } });
  const html = await resPage.text();
  
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const PRICE_REGEX = /(₹|Rs\.?|INR|\$|€|£|¥|C\$|A\$)?\s*([\d,]+(?:\.\d+)?)\s*(INR|USD|EUR|GBP)?/i;

  const productPrices = document.querySelectorAll('product-price, .price, [ref="priceContainer"]');
  console.log('Found price containers count:', productPrices.length);

  productPrices.forEach((container, idx) => {
    const card = container.closest('product-card, .card, .product-card, .product-grid__item, li');
    const productId = card ? card.getAttribute('data-product-id') : null;
    console.log(`\n--- Container ${idx} (ProductID: ${productId}) ---`);

    const walker = dom.window.document.createTreeWalker(container, 4 /* NodeFilter.SHOW_TEXT */);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const parent = textNode.parentElement;
      if (parent.classList.contains('visually-hidden') || parent.closest('.visually-hidden')) continue;
      const val = textNode.nodeValue.trim();
      if (!PRICE_REGEX.test(val)) continue;

      const isCompare = parent.matches('s, del, .compare-at-price, [data-compare-at-price], .price-item--regular.compare-at-price') ||
                        parent.closest('s, del, .compare-at-price') !== null;
      
      console.log(`Text: "${val}", Parent: <${parent.tagName} class="${parent.className}">, isCompare: ${isCompare}`);
    }
  });
}

test().catch(console.error);
