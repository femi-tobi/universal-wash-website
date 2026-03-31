// New sale creation logic
checkAuth();

let itemCounter = 0;
let PRICE_LIST = { male: [], female: [] };
let BULK_DISCOUNTS = [];

// Added 'Washing' as an additional service type; appended to keep existing indexes stable.
const SERVICE_TYPES = ['Hanging', 'Pressing', 'Express', 'Washing'];
const SERVICE_ICONS = ['👔', '♨️', '⚡', '🧺'];

// ─── Load price list from server ─────────────────────────────────────────────
async function loadPricelist() {
    try {
        const res = await fetch('/api/pricelist?_t=' + Date.now(), { headers: getAuthHeaders(), cache: 'no-store' });
        const data = await res.json();
        PRICE_LIST = { male: data.male || [], female: data.female || [] };
        BULK_DISCOUNTS = data.bulkDiscounts || [];
    } catch (e) {
        console.error('Failed to load price list:', e);
        showAlert('Failed to load price list from server', 'error');
    }
    addItemRow(); // Add first row after prices are loaded
}

// ─── Build item dropdown options ──────────────────────────────────────────────
function buildItemOptions(gender, serviceTypeIndex) {
    const list = PRICE_LIST[gender] || [];
    let opts = `<option value="">Select item...</option>`;
    list.forEach((item, idx) => {
        // Prefer explicit service price when available. If serviceTypeIndex points to
        // Washing (new index) or the price is missing/null, fall back to the item's base price.
        let price = (item.prices && item.prices[serviceTypeIndex] !== undefined) ? item.prices[serviceTypeIndex] : null;
        if (price === null || price === undefined) {
            // Use base price for Washing or any missing service price
            price = item.base !== undefined ? item.base : null;
        }
        if (price !== null && price !== undefined && price > 0) {
            opts += `<option value="${idx}" data-price="${price}">${item.name} — NGN ${Number(price).toLocaleString()}</option>`;
        }
    });
    return opts;
}

// ─── Refresh a single row's dropdown when its service type changes ─────────────
function refreshItemDropdown(itemId) {
    const gender = document.getElementById('globalGender')?.value || 'male';
    const svcInput = document.querySelector(`.item-service-type[data-item="${itemId}"]`);
    const serviceTypeIndex = parseInt(svcInput?.value ?? '0');
    const select = document.querySelector(`.item-select[data-item="${itemId}"]`);
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = buildItemOptions(gender, serviceTypeIndex);
    if (currentVal) select.value = currentVal;
    select.dispatchEvent(new Event('change'));
}

// ─── Refresh all rows when gender changes ─────────────────────────────────────
function refreshAllItemDropdowns() {
    document.querySelectorAll('.item-select').forEach(select => {
        refreshItemDropdown(select.dataset.item);
    });
}

// ─── Select per-item service type ─────────────────────────────────────────────
function selectItemService(itemId, index) {
    const hiddenInput = document.querySelector(`.item-service-type[data-item="${itemId}"]`);
    if (hiddenInput) hiddenInput.value = index;

    document.querySelectorAll(`.svc-pill[data-item="${itemId}"]`).forEach(pill => {
        pill.classList.toggle('active', parseInt(pill.dataset.svc) === index);
    });

    refreshItemDropdown(itemId);
}

// ─── Add item row ─────────────────────────────────────────────────────────────
function addItemRow() {
    itemCounter++;
    const container = document.getElementById('itemsContainer');
    const gender = document.getElementById('globalGender')?.value || 'male';
    const defaultSvc = 0; // Hanging by default

    const row = document.createElement('div');
    row.className = 'card';
    row.id = `item-${itemCounter}`;
    row.style.background = '#f8fafc';
    row.style.marginBottom = '16px';

    const pillsHtml = SERVICE_TYPES.map((name, i) => `
        <button type="button"
            class="svc-pill${i === defaultSvc ? ' active' : ''}"
            data-item="${itemCounter}"
            data-svc="${i}"
            onclick="selectItemService(${itemCounter}, ${i})">
            ${SERVICE_ICONS[i]} ${name}
        </button>
    `).join('');

    row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;">Item #${itemCounter}</h3>
            <button type="button" class="btn btn-danger" onclick="removeItem(${itemCounter})"
                style="min-height:auto;padding:8px 16px;font-size:14px;">
                🗑️ Remove
            </button>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
            <label>Service Type *</label>
            <div class="svc-pill-group">${pillsHtml}</div>
            <input type="hidden" class="item-service-type" data-item="${itemCounter}" value="${defaultSvc}">
        </div>

        <div class="grid grid-2">
            <div class="form-group">
                <label>Clothing Item *</label>
                <select class="item-select" data-item="${itemCounter}" required>
                    ${buildItemOptions(gender, defaultSvc)}
                </select>
            </div>
            <div class="form-group">
                <label>Quantity *</label>
                <input type="number" class="quantity" data-item="${itemCounter}" min="1" value="1" required>
            </div>
        </div>

        <div class="form-group">
            <label>Item Description (optional)</label>
            <input type="text" class="item-desc" data-item="${itemCounter}" placeholder="e.g. Red, no buttons, delicate" />
        </div>

        <div class="form-group">
            <label>Subtotal</label>
            <input type="text" class="subtotal" data-item="${itemCounter}" readonly
                style="background:#e2e8f0;font-weight:700;font-size:18px;" value="NGN 0">
        </div>
    `;

    container.appendChild(row);
    row.querySelector('.item-select').addEventListener('change', calculateItemTotal);
    row.querySelector('.quantity').addEventListener('input', calculateItemTotal);
}

// ─── Remove item row ──────────────────────────────────────────────────────────
function removeItem(id) {
    const row = document.getElementById(`item-${id}`);
    if (row) { row.remove(); calculateTotal(); }
}

// ─── Calculate item subtotal ──────────────────────────────────────────────────
function calculateItemTotal(e) {
    const itemId = e.target.dataset.item;
    const itemSelect = document.querySelector(`.item-select[data-item="${itemId}"]`);
    const quantity = parseInt(document.querySelector(`.quantity[data-item="${itemId}"]`).value) || 0;
    const subtotalInput = document.querySelector(`.subtotal[data-item="${itemId}"]`);

    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    const price = parseFloat(selectedOption?.dataset?.price) || 0;
    const subtotal = price * quantity;
    subtotalInput.value = `NGN ${subtotal.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;

    calculateTotal();
}

// ─── Calculate grand total with bulk discount ─────────────────────────────────
function calculateTotal() {
    let rawTotal = 0;
    let totalQty = 0;

    document.querySelectorAll('.subtotal').forEach(input => {
        rawTotal += parseFloat(input.value.replace('NGN ', '').replace(/,/g, '')) || 0;
    });
    document.querySelectorAll('.quantity').forEach(input => {
        totalQty += parseInt(input.value) || 0;
    });

    let discountPct = 0;
    let discountLabel = '';
    const sorted = [...BULK_DISCOUNTS].sort((a, b) => b.threshold - a.threshold);
    for (const rule of sorted) {
        if (totalQty >= rule.threshold) {
            discountPct = rule.discountPct;
            discountLabel = rule.label;
            break;
        }
    }

    const discountAmount = rawTotal * (discountPct / 100);
    const finalTotal = rawTotal - discountAmount;

    document.getElementById('totalAmount').textContent =
        `NGN ${finalTotal.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;

    const discountEl = document.getElementById('discountInfo');
    if (discountEl) {
        if (discountPct > 0) {
            discountEl.innerHTML = `
                <span style="color:#16a34a;font-weight:700;">
                    🎉 ${discountLabel} — ${discountPct}% off applied!
                    (Saved NGN ${discountAmount.toLocaleString('en-NG', { minimumFractionDigits: 0 })})
                </span>`;
            discountEl.style.display = 'block';
        } else {
            discountEl.style.display = 'none';
        }
    }

    window._saleDiscount = { pct: discountPct, amount: discountAmount, qty: totalQty };
}

// ─── Submit sale form ─────────────────────────────────────────────────────────
document.getElementById('saleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerAddress = document.getElementById('customerAddress').value.trim();
    const paymentStatus = document.getElementById('paymentStatus').value;
    const gender = document.getElementById('globalGender').value;
    const paymentMethod = document.getElementById('paymentMethod') ? document.getElementById('paymentMethod').value : null;

    const items = [];
    document.querySelectorAll('.item-select').forEach(select => {
        const itemId = select.dataset.item;
        const selectedOption = select.options[select.selectedIndex];
        if (!select.value || !selectedOption) return;

        // Read this row's own service type
        const svcInput = document.querySelector(`.item-service-type[data-item="${itemId}"]`);
        const svcIndex = parseInt(svcInput?.value ?? '0');
        const serviceTypeName = SERVICE_TYPES[svcIndex];

        const itemName = selectedOption.text.split(' —')[0];
        const unitPrice = parseFloat(selectedOption.dataset.price) || 0;
        const quantity = parseInt(document.querySelector(`.quantity[data-item="${itemId}"]`).value) || 1;

        const discountPct = window._saleDiscount?.pct || 0;
        const discountedUnit = unitPrice * (1 - discountPct / 100);
        const subtotal = discountedUnit * quantity;

        const descInput = document.querySelector(`.item-desc[data-item="${itemId}"]`);
        const description = descInput ? descInput.value.trim() : null;

        // Map the UI service index to the backend database service ID (1: Wash, 2: Iron, 3: Dry Clean, 4: Wash & Iron)
        const mappedServiceId = svcIndex + 1; 

        items.push({
            service_id: mappedServiceId,
            item_type: `[${gender.toUpperCase()}] ${itemName} (${serviceTypeName})`,
            quantity,
            unit_price: parseFloat(discountedUnit.toFixed(2)),
            subtotal: parseFloat(subtotal.toFixed(2)),
            description: description || null
        });
    });

    if (items.length === 0) {
        showAlert('Please add at least one item', 'error');
        return;
    }

    try {
        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_address: customerAddress || null,
                items,
                payment_status: paymentStatus,
                payment_method: paymentStatus === 'paid' ? (paymentMethod || null) : null
            })
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('Sale created successfully!', 'success');
            window.open(`/views/staff/receipt.html?id=${data.sale_id}`, '_blank');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
        } else {
            showAlert(data.error || 'Failed to create sale', 'error');
        }
    } catch (error) {
        console.error('Error creating sale:', error);
        showAlert('Connection error. Please try again.', 'error');
    }
});

// ─── Customer phone lookup ────────────────────────────────────────────────────
document.getElementById('customerPhone')?.addEventListener('blur', async function () {
    const phone = this.value.trim();
    if (!phone) return;
    try {
        const resp = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`, { headers: getAuthHeaders() });
        if (!resp.ok) {
            // Not found or forbidden — just silently ignore so staff can create a new customer on submit
            return;
        }
        const data = await resp.json();
        const existing = data && data.customer ? data.customer : null;
        if (existing) {
            document.getElementById('customerName').value = existing.name || '';
            if (existing.address) {
                document.getElementById('customerAddress').value = existing.address;
            }
            showAlert(`Customer found: ${existing.name}`, 'success');
        }
    } catch (error) {
        console.error('Error looking up customer:', error);
    }
});

// ─── Initialize ───────────────────────────────────────────────────────────────
loadPricelist();

// Show/hide payment method selector based on payment status
const paymentStatusEl = document.getElementById('paymentStatus');
function updatePaymentMethodVisibility() {
    const group = document.getElementById('paymentMethodGroup');
    if (!group || !paymentStatusEl) return;
    group.style.display = paymentStatusEl.value === 'paid' ? '' : 'none';
}
if (paymentStatusEl) {
    paymentStatusEl.addEventListener('change', updatePaymentMethodVisibility);
    // initialize
    updatePaymentMethodVisibility();
}
