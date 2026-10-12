const categories = [
  { id: "devices", name: "Home Medical Devices", photo: "digital,blood,pressure,monitor" },
  { id: "accessories", name: "Medical Accessories", photo: "medical,device,accessories" },
  { id: "clothing", name: "Medical Clothing", photo: "medical,scrubs,uniform" },
  { id: "consumables", name: "Medical Consumables", photo: "medical,gloves,supplies" },
  { id: "professional", name: "Equipment for Professionals", photo: "stethoscope,medical,equipment" }
];

let products = [
  ["Digital Blood Pressure Monitor", "devices", "Automatic upper-arm monitor with an easy-to-read digital display.", 34.90, "digital,blood,pressure,monitor", true],
  ["Blood Glucose Meter", "devices", "Compact blood glucose meter for everyday home monitoring.", 18.50, "blood,glucose,meter", true],
  ["Fingertip Pulse Oximeter", "devices", "Portable fingertip device with a clear digital screen.", 15.75, "pulse,oximeter,medical", true],
  ["Digital Thermometer", "devices", "Digital thermometer with a simple, clear display.", 6.90, "digital,thermometer,medical", true],
  ["Compressor Nebulizer", "devices", "Home nebulizer system supplied with a mask and tubing.", 29.00, "nebulizer,medical,device", true],
  ["Oxygen Concentrator", "devices", "Stationary oxygen concentrator for home care settings.", 685.00, "oxygen,concentrator,medical", true],
  ["Portable Oxygen Equipment", "devices", "Portable oxygen equipment designed for easier transport.", 920.00, "portable,oxygen,concentrator", false],
  ["Digital Weighing Scale", "devices", "Digital body scale with a large platform display.", 19.90, "digital,medical,scale", true],
  ["Blood Pressure Monitor Cuff", "accessories", "Replacement cuff designed for compatible blood pressure monitors.", 11.50, "blood,pressure,monitor,cuff", true],
  ["Glucose Test Strips · 50 pack", "accessories", "Pack of glucose test strips for compatible meters.", 14.25, "glucose,test,strips", true],
  ["Safety Lancets · 100 pack", "accessories", "Single-use safety lancets for blood sampling devices.", 8.50, "medical,lancets", true],
  ["Thermometer Probe Covers · 20 pack", "accessories", "Disposable probe covers for compatible thermometers.", 3.75, "thermometer,probe,covers", true],
  ["Nebulizer Mask & Tubing Set", "accessories", "Replacement mask and tubing set for compatible nebulizers.", 7.90, "nebulizer,mask,tubing", true],
  ["Classic White Lab Coat", "clothing", "Long-sleeve lab coat with a classic professional cut.", 27.00, "white,medical,lab,coat", true],
  ["Unisex Medical Scrubs", "clothing", "Comfortable two-piece scrub set for clinical settings.", 32.00, "medical,scrubs,uniform", true],
  ["Nursing Uniform Set", "clothing", "Practical nursing uniform set with functional pockets.", 29.50, "nurse,medical,uniform", true],
  ["Professional Medical Shoes", "clothing", "Lightweight work shoes for long shifts.", 38.00, "medical,shoes,clogs", false],
  ["Disposable Surgical Caps · 10 pack", "clothing", "Disposable bouffant caps for clinical environments.", 4.50, "surgical,caps,medical", true],
  ["Nitrile Medical Gloves · 100 pack", "consumables", "Powder-free nitrile examination gloves.", 8.75, "nitrile,medical,gloves", true],
  ["Latex Medical Gloves · 100 pack", "consumables", "Disposable latex examination gloves.", 7.50, "latex,medical,gloves", true],
  ["Surgical Masks · 50 pack", "consumables", "Disposable medical masks supplied in a 50-piece pack.", 5.90, "surgical,medical,masks", true],
  ["Disposable Isolation Gown", "consumables", "Single-use protective gown for clinical environments.", 3.25, "disposable,medical,gown", true],
  ["Sterile Gauze Pads · 25 pack", "consumables", "Individually wrapped sterile gauze pads.", 4.80, "sterile,medical,gauze", true],
  ["Elastic Bandage Roll", "consumables", "Stretch bandage roll for first-aid supply kits.", 2.25, "elastic,medical,bandage", true],
  ["Disposable Syringes · 10 pack", "consumables", "Sterile, individually packaged disposable syringes.", 3.50, "disposable,medical,syringe", true],
  ["Medical Paper Tape · 3 rolls", "consumables", "Paper medical tape supplied in a three-roll pack.", 2.90, "medical,tape,roll", true],
  ["Wound Dressing Set", "consumables", "Selection of wound dressings for a first-aid cabinet.", 9.25, "wound,dressing,medical", true],
  ["Dual-Head Stethoscope", "professional", "Classic dual-head stethoscope for clinical examination.", 24.50, "stethoscope,medical", true],
  ["Portable Otoscope Set", "professional", "Handheld otoscope supplied with a selection of specula.", 42.00, "otoscope,medical", true],
  ["LED Medical Examination Light", "professional", "Adjustable examination light for clinical workspaces.", 78.00, "medical,examination,light", true],
  ["Diagnostic Set", "professional", "Portable diagnostic set with otoscope and ophthalmoscope heads.", 119.00, "medical,diagnostic,set", true],
  ["Medical Instrument Kit", "professional", "Reusable stainless-steel instrument kit in a storage case.", 36.50, "medical,instrument,kit", true]
].map(([name, category, description, price, photo, inStock], index) => ({
  id: index + 1, name, category, description, price, inStock,
  image: "",
  rating: null, reviews: null
}));

const cartStorageKey = "careplusCart";
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
    return new Map(saved.map(item => {
      const id = String(item.product?.id ?? item.id);
      const product = products.find(entry => String(entry.id) === id) || item.product;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      return product ? [id, { product, quantity }] : null;
    }).filter(Boolean));
  } catch { return new Map(); }
}
const cart = loadCart();
let toastTimer;
const $ = selector => document.querySelector(selector);
const categoryName = id => categories.find(item => item.id === id)?.name || "Medical Supplies";
const money = value => `JOD ${Number(value).toFixed(2)}`;
const categoryPhotos = {
  devices: "https://taghareedstore.com/cdn/shop/collections/medical-devices.png?v=1776847208",
  accessories: "https://mostessential.nl/cdn/shop/articles/What_sintheBox_N_1_900x_58f6df3a-0b81-47d8-9c1a-26d3f5ef0b29.webp?v=1728406816",
  clothing: "https://scrubsplus.ae/cdn/shop/files/Scrubs_Male-3616.jpg?v=1711432167&width=1200",
  consumables: "https://image.ec21.com/image/jascor/oimg_GC00131863_CA00131864/SURGICAL-DRESSINGS--DISPOSABLE-MEDICAL-GOODS-AND-OTHER-ITEMS.jpg",
  professional: "https://media.praxisdienst.com/praxident-prod-public-files/media/f6/72/15/1740372985/38214-3%281%29.jpg"
};
const PRODUCT_PHOTOS = [
  "https://biosmedical.com/cdn/shop/products/3AL1-3E_1024x1024_2x_864c12e3-5bae-4a79-9ad6-6ba9a393541c_2048x.jpg?v=1765395950",
  "https://shop.accu-chek.com.tr/on/demandware.static/-/Sites-roche-master-catalog/default/dw23c5a50d/images/09221816078_Accu-Chek_Instant_Set_720x720.webp",
  "https://www.physiotherapie.com/media/catalog/product/cache/a3abe921082216fca48191a0885599b3/o/x/oxymetre-de-pouls.jpg",
  "https://beautyboxjo.com/cdn/shop/files/Beurer_Thermometer_white_-_FT_09.jpg?v=1757853774&width=370",
  "https://media.myaster.com/images/products/1046504/wol-pro-compressor-nebulizer-wd03-with-complete-nebulizer-kit/1046504_1new.jpg?height=700&width=700",
  "https://maytaooxy.vn/uploads/cp_sanpham/201908/2min1567135246.nv.png",
  "https://dedakjoxygenconcentrators.com/cdn/shop/files/3_RESPIREASY_Home_9L_Adjustable_Continuous_Flow_Oxygen_Concentrator_6a78a05d-9a2e-4421-a4a9-6150a35baec6.jpg?v=1763459361&width=1445",
  "https://www.hmgdirect.com.au/cdn/shop/products/LOG507ProfessionalScales_1000x.png?v=1669076234",
  "https://static-data2.manualslib.com/product-images/640/1592689/citizen-chud514-blood-pressure-monitor.jpg",
  "https://shop.accu-chek.com.tr/on/demandware.static/-/Sites-roche-master-catalog/default/dw23c5a50d/images/09221816078_Accu-Chek_Instant_Set_720x720.webp",
  "https://smartdeal.com.bd/public/uploads/all/HQNX73oYWrTQLc3BRQ7bm0vk9DzN6oFHiba2Jtcp.jpg",
  "https://www.verdementa.es/media/products/t/e/termometro-digital-lcd-memoria_4.jpg",
  "https://surgicalwale.com/33763-large_default/nebulizer-mask-for-effective-breathing-therapy-comfortable-oxygen-therapy-mask-support.jpg",
  "https://scrubsplus.ae/cdn/shop/files/Scrubs_Male-3616.jpg?v=1711432167&width=1200",
  "https://image.made-in-china.com/2f0j00KWokqeunSCcV/Ly-Workwear-Cotton-Doctors-Scrub-Uniform.webp",
  "https://cdn.salla.sa/GqyAV/GJvdUOhJ3xDlyw1iKdoRibO4dCFXkKTzLjh5kB3v.jpg",
  "https://i.ebayimg.com/images/g/KxUAAOxyI8lR9Tj6/s-l400.jpg",
  "https://image.ec21.com/image/jascor/oimg_GC00131863_CA00131864/SURGICAL-DRESSINGS--DISPOSABLE-MEDICAL-GOODS-AND-OTHER-ITEMS.jpg",
  "https://www.varle.lt/static/uploads/products/426/blo/blow-melynos-nitrilo-pirstines-m-100vnt_GGXhKp6.jpg",
  "https://image.ec21.com/image/jascor/oimg_GC00131863_CA00131864/SURGICAL-DRESSINGS--DISPOSABLE-MEDICAL-GOODS-AND-OTHER-ITEMS.jpg",
  "https://cpimg.tistatic.com/06394742/b/4/Health-Care.jpg",
  "https://image.made-in-china.com/2f0j00PUEoSlQqFRgT/Surgical-Packing-Surgical-Avental-Sterile-Standard-Disposable-Surgical-Gowns-Clothes.webp",
  "https://image.ec21.com/image/jascor/oimg_GC00131863_CA00131864/SURGICAL-DRESSINGS--DISPOSABLE-MEDICAL-GOODS-AND-OTHER-ITEMS.jpg",
  "https://image.ec21.com/image/jascor/oimg_GC00131863_CA00131864/SURGICAL-DRESSINGS--DISPOSABLE-MEDICAL-GOODS-AND-OTHER-ITEMS.jpg",
  "https://image.ec21.com/image/jascor/oimg_GC00131863_CA00131864/SURGICAL-DRESSINGS--DISPOSABLE-MEDICAL-GOODS-AND-OTHER-ITEMS.jpg",
  "https://image.ec21.com/image/jascor/oimg_GC00131863_CA00131864/SURGICAL-DRESSINGS--DISPOSABLE-MEDICAL-GOODS-AND-OTHER-ITEMS.jpg",
  "https://tiendadeequipomedicolanceta.com.mx/img/lv-cats/curacion-e-insumos.jpg?v=2026072401",
  "https://ae01.alicdn.com/kf/H375db1eff207404eab04053060d2566ec/Portable-Single-Head-Stethoscope-Professional-Doctor-Medical-Heart-Echometer-Nurse-Student-First-Aid-Kit-Equipment-Device.jpg",
  "https://i5.walmartimages.com/seo/Stethoscope-Set-With-Eye-Chart-Taylor-Hammer-Tape-Measure-LED-Penlight-Otoscope_3c2cfbf8-cbde-41d8-bcdf-8f66dd70a2ab_1.3e4ade97ca1e2c40bd927ad7c115d1a6.jpeg",
  "https://iirorwxhmkkolm5m-static.micyjz.com/cloud/lpBpnKollnSRkjjolikkio/ECOG054-LED-Examination-Light.jpg",
  "https://media.praxisdienst.com/praxident-prod-public-files/media/f6/72/15/1740372985/38214-3%281%29.jpg?ts=1782594137",
  "https://images-cdn.ubuy.co.in/66d3e3997496e07cea114eaf-dual-head-stethoscope-w-snellen-eye.jpg"
];
// Keep each listing paired with a photograph of the named item.
PRODUCT_PHOTOS[8] = "https://www.steroplast.co.uk/media/catalog/product/cache/bc90adbefc6dc2e50e469af3d247af0a/o/m/omron_easy_cuff_1.jpg";
PRODUCT_PHOTOS[9] = "https://mostessential.nl/cdn/shop/articles/What_sintheBox_N_1_900x_58f6df3a-0b81-47d8-9c1a-26d3f5ef0b29.webp?v=1728406816";
PRODUCT_PHOTOS[10] = "https://drive.gianhangvn.com/image/greetmed-gt043-302-2439233j29408.jpg";
PRODUCT_PHOTOS[11] = "https://i5.walmartimages.com/seo/iProven-PC-11-Digital-Thermometer-Probe-Covers-50pcs_5e2af406-f172-4576-8be7-f3ea6e88a610.c3c102df92947a3336cbfcaf9576f044.jpeg?odnBg=FFFFFF&odnHeight=580&odnWidth=580";
PRODUCT_PHOTOS[12] = "https://surgicalwale.com/33763-large_default/nebulizer-mask-for-effective-breathing-therapy-comfortable-oxygen-therapy-mask-support.jpg";
PRODUCT_PHOTOS[14] = "https://www.uniformadvantage.com/dw/image/v2/BGPS_PRD/on/demandware.static/-/Sites-UAMasterCatalog/default/dw391ce680/GA71166/GA71166_BLACK_2.jpg?sh=890&sm=fit&sw=600";
PRODUCT_PHOTOS[15] = "https://www.eldoctorcito.com.mx/cdn/shop/files/6155_NAVY_alt1_1800x1800_23b7bb92-d145-4b19-994f-d90f5acb40ea.webp?v=1752603997";
PRODUCT_PHOTOS[16] = "https://laboutiquedesinfirmieres.com/cdn/shop/products/SabotevaBestlightOxypas-BLANCs_1024x1024.jpg?v=1634839497";
PRODUCT_PHOTOS[17] = "https://tiimg.tistatic.com/fp/1/008/178/12-inches-surgical-grade-disposable-non-woven-bouffant-cap-for-unisex-006.jpg";
PRODUCT_PHOTOS[19] = "https://www.bodfeld-apotheke.de/documents/products/Zoom/ixxilon/frontal/500/00990238.jpg?ver=1774255477";
PRODUCT_PHOTOS[20] = "https://flexsolver-ttsh-production.s3.ap-southeast-1.amazonaws.com/8980fb1b-ae6c-45fe-b55b-b3e18bd9575e-PDS-Healthcare-Disposable-3-Ply-Surgical-Mask-50s-005616059R-F001.png";
PRODUCT_PHOTOS[22] = "https://cdn11.bigcommerce.com/s-r80ysxw79r/images/stencil/1280x1280/products/1511/10731/3354-gauze-pad-sterile-ind-pkg_sv3swpkn9u4wtwg0__32833.1703272510.jpg?c=2&imbypass=on";
PRODUCT_PHOTOS[23] = "https://cdn11.bigcommerce.com/s-4wt7dtwxiw/images/stencil/500x659/products/1011/2146/elastic-bandage-4146-10_1__92244.1621288957.jpg?c=1";
PRODUCT_PHOTOS[24] = "https://jmi.com.bd/storage/app/public/products/hover/CN5QLUF3_hover_67a1cb2222da9.png";
PRODUCT_PHOTOS[25] = "https://cdn11.bigcommerce.com/s-j7315y43lw/images/stencil/1280x1280/products/1583/4874/15301__65552.1689363099.png?c=1";
PRODUCT_PHOTOS[26] = "https://tiendadeequipomedicolanceta.com.mx/img/lv-cats/curacion-e-insumos.jpg?v=2026072401";
PRODUCT_PHOTOS[28] = "https://www.girodmedical.es/media/catalog/product/cache/5b155edbcf0169fd7cec967d14c80ba5/3/6/36588-removebg-preview.png";
PRODUCT_PHOTOS[30] = "https://gilgalmedical.com/cdn/shop/files/1188030_pkit_1200x630.jpg?v=1767376852";
PRODUCT_PHOTOS[31] = "https://www.lojaroster.com.br/media/catalog/product/cache/13/image/1000x1231/4648e8fa899f1575903b33dc39eb6705/r/o/ro-22_kit-instrumentais.jpg";
products.forEach((product, index) => { product.image = PRODUCT_PHOTOS[index] || categoryPhotos[product.category]; });
window.CarePlusData.seed("products", products.map(product => ({ ...product, quantity: product.inStock ? 20 : 0, status: product.inStock ? "Available" : "Unavailable" })));
products = window.CarePlusData.list("products").map(product => ({ ...product, inStock: product.inStock ?? (Number(product.quantity) > 0 && product.status !== "Unavailable"), image: product.image || categoryPhotos[product.category] }));
window.CarePlusData.subscribe(() => {
  products = window.CarePlusData.list("products").map(product => ({ ...product, inStock: product.inStock ?? (Number(product.quantity) > 0 && product.status !== "Unavailable"), image: product.image || categoryPhotos[product.category] }));
  cart.forEach((item, id) => { const current = products.find(product => String(product.id) === String(id)); if (current) item.product = current; else cart.delete(id); });
  renderCategories(); renderProducts(); renderCart();
});

function renderCategories() {
  $("#category-filter").innerHTML = `<option value="all">All categories</option>` + categories.map(category => `<option value="${category.id}">${category.name}</option>`).join("");
  $("#category-cards").innerHTML = categories.map((category, index) => `
    <button class="category-card" data-category-card="${category.id}" type="button">
      <img data-category="${category.id}" src="${categoryPhotos[category.id]}" alt="${category.name}" loading="lazy">
      <span class="category-card-shade"></span><span class="category-card-title">${category.name}<b aria-hidden="true">→</b></span>
    </button>`).join("");
}

function getVisibleProducts() {
  const query = $("#product-search").value.trim().toLowerCase();
  const category = $("#category-filter").value;
  const minValue = $("#min-price").value;
  const maxValue = $("#max-price").value;
  const min = minValue === "" ? 0 : Number(minValue);
  const max = maxValue === "" ? Infinity : Number(maxValue);
  const stock = $("#stock-filter").value;
  const sort = $("#sort-filter").value;
  const result = products.filter(product => {
    const matchesSearch = `${product.name} ${product.description} ${categoryName(product.category)}`.toLowerCase().includes(query);
    return matchesSearch && (category === "all" || product.category === category) && product.price >= min && product.price <= max && (stock === "all" || (stock === "in" ? product.inStock : !product.inStock));
  });
  if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
  if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function ratingMarkup(product) {
  return product.rating ? `<span class="rating"><span aria-hidden="true">★</span> ${product.rating.toFixed(1)} <small>(${product.reviews} reviews)</small></span>` : "";
}

function renderProducts() {
  const visible = getVisibleProducts();
  $("#product-count").textContent = `${visible.length} ${visible.length === 1 ? "product" : "products"}`;
  $("#product-grid").innerHTML = visible.length ? visible.map(product => `
    <article class="product-card" data-product="${product.id}">
      <div class="product-image-wrap"><img class="product-image" data-category="${product.category}" src="${product.image}" alt="${product.name}" loading="lazy"><span class="stock-badge ${product.inStock ? "in-stock" : "out-stock"}">${product.inStock ? "In Stock" : "Out of Stock"}</span></div>
      <div class="product-info"><span class="product-category">${categoryName(product.category)}</span><h3>${product.name}</h3><p class="product-description">${product.description}</p>
        <div class="product-meta">${ratingMarkup(product)}<strong class="product-price">${money(product.price)}</strong></div>
        <div class="product-actions"><label class="quantity-picker" aria-label="Quantity for ${product.name}"><button type="button" data-qty="${product.id}" data-delta="-1" aria-label="Decrease quantity">−</button><input type="number" min="1" value="1" id="qty-${product.id}" aria-label="Quantity"><button type="button" data-qty="${product.id}" data-delta="1" aria-label="Increase quantity">+</button></label><button type="button" class="add-button" data-add="${product.id}" ${product.inStock ? "" : "disabled"}>Add to Cart</button></div>
        <button type="button" class="details-button" data-details="${product.id}">View Details</button>
      </div>
    </article>`).join("") : `<div class="empty-state"><strong>No products found</strong><span>Try changing your search or filters.</span></div>`;
}

function renderCart() {
  persistCart();
  const count = [...cart.values()].reduce((sum, item) => sum + item.quantity, 0);
  const total = [...cart.values()].reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  $("#cart-count").textContent = count;
  $("#cart-total").textContent = money(total);
  $("#cart-items").innerHTML = cart.size ? [...cart.values()].map(({ product, quantity }) => `
    <div class="cart-row"><img class="cart-thumb" data-category="${product.category}" src="${product.image}" alt="" loading="lazy"><div><h3>${product.name}</h3><small>${money(product.price)} each</small><div class="quantity-control"><button type="button" data-cart-qty="${product.id}" data-change="-1" aria-label="Remove one">−</button><span>${quantity}</span><button type="button" data-cart-qty="${product.id}" data-change="1" aria-label="Add one">+</button></div></div><span class="cart-row-price">${money(product.price * quantity)}</span></div>`).join("") : `<div class="cart-empty">Your cart is empty.</div>`;
}

function persistCart() {
  localStorage.setItem(cartStorageKey, JSON.stringify([...cart.values()]));
}

function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}

function setCartOpen(open) {
  $("#cart-drawer").classList.toggle("open", open); $("#cart-drawer").setAttribute("aria-hidden", String(!open));
  $("#cart-scrim").classList.toggle("open", open); document.body.classList.toggle("cart-open", open);
  if (open) $("#cart-close").focus();
}

function addToCart(id, quantity = 1) {
  const product = products.find(item => String(item.id) === String(id));
  if (!product?.inStock) return;
  const item = cart.get(id) || { product, quantity: 0 }; item.quantity += quantity; cart.set(id, item); renderCart(); showToast(`${product.name} added to your cart`);
}

function showDetails(id) {
  const product = products.find(item => String(item.id) === String(id));
  $("#details-content").innerHTML = `<img src="${product.image}" data-category="${product.category}" alt="${product.name}" class="details-image"><div class="details-copy"><span class="product-category">${categoryName(product.category)}</span><h2>${product.name}</h2><p>${product.description}</p><span class="stock-badge ${product.inStock ? "in-stock" : "out-stock"}">${product.inStock ? "In Stock" : "Out of Stock"}</span>${ratingMarkup(product)}<strong class="details-price">${money(product.price)}</strong><button class="add-button details-add" data-add="${product.id}" ${product.inStock ? "" : "disabled"}>Add to Cart</button></div>`;
  $("#details-dialog").showModal();
}

$("#product-grid").addEventListener("click", event => {
  const add = event.target.closest("[data-add]");
  if (add) { const id = add.dataset.add; const qty = Number($("#qty-" + id)?.value || 1); addToCart(id, Math.max(1, qty)); return; }
  const details = event.target.closest("[data-details]"); if (details) showDetails(details.dataset.details);
  const qty = event.target.closest("[data-qty]");
  if (qty) { const input = $("#qty-" + qty.dataset.qty); input.value = Math.max(1, Number(input.value || 1) + Number(qty.dataset.delta)); }
});
$("#details-content").addEventListener("click", event => { const button = event.target.closest("[data-add]"); if (button) addToCart(button.dataset.add); });
$("#category-cards").addEventListener("click", event => { const card = event.target.closest("[data-category-card]"); if (!card) return; $("#category-filter").value = card.dataset.categoryCard; renderProducts(); $("#products").scrollIntoView({ behavior: "smooth" }); });
$("#cart-items").addEventListener("click", event => { const button = event.target.closest("[data-cart-qty]"); if (!button) return; const id = String(button.dataset.cartQty); const item = cart.get(id); if (!item) return; item.quantity += Number(button.dataset.change); if (item.quantity <= 0) cart.delete(id); renderCart(); });
["#product-search", "#min-price", "#max-price"].forEach(selector => $(selector).addEventListener("input", renderProducts));
["#category-filter", "#stock-filter", "#sort-filter"].forEach(selector => $(selector).addEventListener("change", renderProducts));
document.addEventListener("error", event => {
  const image = event.target;
  if (image.tagName !== "IMG" || !image.dataset.category || image.dataset.fallback) return;
  image.dataset.fallback = "true";
  image.src = categoryPhotos[image.dataset.category];
}, true);
$("#clear-filters").addEventListener("click", () => { $("#product-search").value = ""; $("#category-filter").value = "all"; $("#min-price").value = ""; $("#max-price").value = ""; $("#stock-filter").value = "all"; $("#sort-filter").value = "featured"; renderProducts(); });
$("#cart-toggle").addEventListener("click", () => setCartOpen(true)); $("#cart-close").addEventListener("click", () => setCartOpen(false)); $("#cart-scrim").addEventListener("click", () => setCartOpen(false));
$("#details-close").addEventListener("click", () => $("#details-dialog").close()); $("#details-dialog").addEventListener("click", event => { if (event.target === $("#details-dialog")) $("#details-dialog").close(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") setCartOpen(false); });
$("#checkout-button").addEventListener("click", () => {
  if (!cart.size) { showToast("Add a product to get started."); return; }
  window.location.href = "Basket/checkout.html";
});

fetch("../Nav/index.html").then(response => response.text()).then(html => { $("#nav-container").innerHTML = html; const link = [...document.querySelectorAll("#nav-container nav a")].find(item => item.textContent.trim() === "Medical Store"); if (link) { link.href = "../Store/index.html"; link.classList.add("active"); } }).catch(error => console.error("Could not load CarePlus navigation:", error));
fetch("../Footer/index.html").then(response => response.text()).then(html => { $("#footer-container").innerHTML = html; const link = [...document.querySelectorAll("#footer-container a")].find(item => item.textContent.trim() === "Medical Store"); if (link) link.href = "../Store/index.html"; }).catch(error => console.error("Could not load CarePlus footer:", error));

renderCategories(); renderProducts(); renderCart();
if (new URLSearchParams(window.location.search).get("cart") === "open") setCartOpen(true);
