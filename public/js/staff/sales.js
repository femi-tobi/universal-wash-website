// New sale creation logic
checkAuth();

let itemCounter = 0;
let PRICE_LIST = { male: [], female: [] };
let BULK_DISCOUNTS = [];

// Service types: Hanging, Pressing, Washing & Press, Pressing & Hang
const SERVICE_TYPES = ['Hanging', 'Pressing', 'Washing & Press', 'Pressing & Hang'];
const SERVICE_ICONS = ['👔', '♨️', '🧺♨️', '♨️👔'];

// Helper to present human-friendly error messages (e.g. offline/network loss)
function getReadableError(err, fallbackMsg) {
    if (!navigator.onLine || (err && (err.message === 'Failed to fetch' || err.name === 'TypeError'))) {
        return '📶 No internet connection or server unreachable. Please check your network and try again.';
    }
    return (err && err.message) ? `${fallbackMsg}: ${err.message}` : fallbackMsg;
}

// ─── Load price list from server ─────────────────────────────────────────────
async function loadPricelist() {
    try {
        const res = await fetch('/api/pricelist?_t=' + Date.now(), { headers: getAuthHeaders(), cache: 'no-store' });
        const data = await res.json();
        PRICE_LIST = { male: data.male || [], female: data.female || [] };
        BULK_DISCOUNTS = data.bulkDiscounts || [];
    } catch (e) {
        console.error('Failed to load price list:', e);
        showAlert(getReadableError(e, 'Failed to load price list from server'), 'error');
    }
    addItemRow(); // Add first row after prices are loaded
}

// ─── Build item dropdown options ──────────────────────────────────────────────
function buildItemOptions(gender, serviceTypeIndex) {
    const list = PRICE_LIST[gender] || [];
    let opts = `<option value="">Select item...</option>`;
    list.forEach((item, idx) => {
        let price = 0;

        // Helper to get a price by index safely
        const getPrice = (i) => (item.prices && item.prices[i] !== undefined && item.prices[i] !== null && item.prices[i] !== "") ? Number(item.prices[i]) : Number(item.base || 0);

        if (serviceTypeIndex === 0) { // Hanging
            price = getPrice(0);
        } else if (serviceTypeIndex === 1) { // Pressing
            price = getPrice(1);
        } else if (serviceTypeIndex === 2) { // Washing & Press
            price = getPrice(2);
        } else if (serviceTypeIndex === 3) { // Pressing & Hang
            price = getPrice(3);
        }

        if (price > 0) {
            opts += `<option value="${idx}" data-price="${price}">${item.name} — NGN ${price.toLocaleString()}</option>`;
        }
    });
    return opts;
}

// ─── Refresh a single row's dropdown when its service type or gender changes ─────
function refreshItemDropdown(itemId) {
    const genderSelect = document.querySelector(`.item-gender[data-item="${itemId}"]`);
    const gender = genderSelect ? genderSelect.value : 'male';
    const svcInput = document.querySelector(`.item-service-type[data-item="${itemId}"]`);
    const serviceTypeIndex = parseInt(svcInput?.value ?? '0');
    const select = document.querySelector(`.item-select[data-item="${itemId}"]`);
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = buildItemOptions(gender, serviceTypeIndex);
    if (currentVal) select.value = currentVal;
    select.dispatchEvent(new Event('change'));
}

// ─── Refresh all rows ─────────────────────────────────────────────────────────
function refreshAllItemDropdowns() {
    document.querySelectorAll('.item-select').forEach(select => {
        refreshItemDropdown(select.dataset.item);
    });
}

// ─── Select per-item service type ─────────────────────────────────────────────
function selectItemService(itemId, index) {
    // Left for backwards compatibility if needed, but logic is handled by 'change' event listener on the select
    refreshItemDropdown(itemId);
}

// ─── Add item row ─────────────────────────────────────────────────────────────
function addItemRow() {
    itemCounter++;
    const container = document.getElementById('itemsContainer');
    const defaultGender = 'male';
    const defaultSvc = 0; // Hanging by default

    const row = document.createElement('div');
    row.className = 'excel-row';
    row.id = `item-${itemCounter}`;

    const serviceOptionsHtml = SERVICE_TYPES.map((name, i) => `
        <option value="${i}" ${i === defaultSvc ? 'selected' : ''}>${SERVICE_ICONS[i]} ${name}</option>
    `).join('');

    row.innerHTML = `
        <div class="form-group">
            <label>Service Type *</label>
            <select class="item-service-type" data-item="${itemCounter}" required style="width: 100%;">
                ${serviceOptionsHtml}
            </select>
        </div>

        <div class="form-group">
            <label>Gender *</label>
            <select class="item-gender" data-item="${itemCounter}" required style="width: 100%;">
                <option value="male" ${defaultGender === 'male' ? 'selected' : ''}>👨 Male</option>
                <option value="female" ${defaultGender === 'female' ? 'selected' : ''}>👩 Female</option>
            </select>
        </div>

        <div class="form-group">
            <label>Clothing Item *</label>
            <select class="item-select" data-item="${itemCounter}" required style="width: 100%;">
                ${buildItemOptions(defaultGender, defaultSvc)}
            </select>
        </div>
        
        <div class="form-group">
            <label>Total Pieces *</label>
            <input type="number" class="total-pieces" data-item="${itemCounter}" min="1" value="1" required style="width: 100%;">
        </div>

        <div class="form-group">
            <label>Billing Quantity *</label>
            <input type="number" class="quantity" data-item="${itemCounter}" min="0.1" step="0.1" value="1" required style="width: 100%;">
        </div>

        <div class="form-group">
            <label>Stain Price</label>
            <input type="number" class="stain" data-item="${itemCounter}" min="0" step="1" placeholder="0" style="width: 100%;">
        </div>

        <div class="form-group">
            <label>Amendment Price</label>
            <input type="number" class="amend" data-item="${itemCounter}" min="0" step="1" placeholder="0" style="width: 100%;">
        </div>

        <div class="form-group">
            <label>Item Description (optional)</label>
            <input type="text" class="item-desc" data-item="${itemCounter}" placeholder="Optional info..." style="width: 100%;" />
        </div>

        <div class="form-group" style="display:flex; justify-content:center; align-items:center;">
            <label>Expr</label>
            <input type="checkbox" class="express-check" data-item="${itemCounter}" style="width:20px; height:20px;">
        </div>

        <div class="form-group">
            <label>Subtotal</label>
            <input type="text" class="subtotal" data-item="${itemCounter}" readonly
                style="background:#e2e8f0;font-weight:700;font-size:14px; width: 100%; text-align: center; border: none;" value="NGN 0">
        </div>
        
        <div>
            <button type="button" class="btn btn-danger" onclick="removeItem(${itemCounter})"
                style="min-height:auto;padding:8px;font-size:16px; border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 100%; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5;" title="Remove Item">
                ✕
            </button>
        </div>
    `;

    container.appendChild(row);
    row.querySelector('.item-service-type').addEventListener('change', (e) => refreshItemDropdown(e.target.dataset.item));
    row.querySelector('.item-gender').addEventListener('change', (e) => {
        // Reset the item select dropdown and clear previous selection so options match the chosen gender
        const itemId = e.target.dataset.item;
        const itemSelect = row.querySelector('.item-select');
        if (itemSelect) itemSelect.value = '';
        refreshItemDropdown(itemId);
    });
    row.querySelector('.item-select').addEventListener('change', calculateItemTotal);
    row.querySelector('.quantity').addEventListener('input', calculateItemTotal);
    row.querySelector('.total-pieces').addEventListener('input', calculateTotal);
    row.querySelector('.stain').addEventListener('input', calculateItemTotal);
    row.querySelector('.amend').addEventListener('input', calculateItemTotal);
    row.querySelector('.express-check').addEventListener('change', calculateItemTotal);
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
    const quantity = parseFloat(document.querySelector(`.quantity[data-item="${itemId}"]`).value) || 0;
    const stain = parseFloat(document.querySelector(`.stain[data-item="${itemId}"]`).value) || 0;
    const amend = parseFloat(document.querySelector(`.amend[data-item="${itemId}"]`).value) || 0;
    const subtotalInput = document.querySelector(`.subtotal[data-item="${itemId}"]`);

    const isExpress = document.querySelector(`.express-check[data-item="${itemId}"]`).checked;

    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    let price = parseFloat(selectedOption?.dataset?.price) || 0;

    if (isExpress) {
        price = price * 2;
    }

    // Subtotal = (price * quantity) + stain + amendment
    const subtotal = (price * quantity) + stain + amend;
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
    document.querySelectorAll('.total-pieces').forEach(input => {
        totalQty += parseInt(input.value) || 0;
    });

    const deliveryType = document.getElementById('deliveryType');
    let dispatchFee = 0;
    if (deliveryType && deliveryType.value === 'dispatch') {
        dispatchFee = parseFloat(document.getElementById('dispatchFee')?.value) || 0;
    }

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
    // Discount applies to raw total, then we add dispatch fee
    const finalTotal = (rawTotal - discountAmount) + dispatchFee;

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
    const paymentMethod = document.getElementById('paymentMethod') ? document.getElementById('paymentMethod').value : null;
    const amountPaidEl = document.getElementById('amountPaid');
    const amountPaid = amountPaidEl && paymentStatus === 'partpaid' ? parseFloat(amountPaidEl.value) : null;

    const deliveryType = document.getElementById('deliveryType')?.value || 'pickup';
    let dispatchFee = 0;
    if (deliveryType === 'dispatch') {
        dispatchFee = parseFloat(document.getElementById('dispatchFee')?.value) || 0;
    }

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
        let unitPrice = parseFloat(selectedOption.dataset.price) || 0;

        const isExpress = document.querySelector(`.express-check[data-item="${itemId}"]`).checked;
        if (isExpress) {
            unitPrice = unitPrice * 2;
        }

        const quantity = parseFloat(document.querySelector(`.quantity[data-item="${itemId}"]`).value) || 1;
        const totalPieces = parseInt(document.querySelector(`.total-pieces[data-item="${itemId}"]`).value) || 1;
        const stainPrice = parseFloat(document.querySelector(`.stain[data-item="${itemId}"]`).value) || 0;
        const amendPrice = parseFloat(document.querySelector(`.amend[data-item="${itemId}"]`).value) || 0;

        const discountPct = window._saleDiscount?.pct || 0;
        const discountedUnit = unitPrice * (1 - discountPct / 100);
        const subtotal = (discountedUnit * quantity) + stainPrice + amendPrice;

        const descInput = document.querySelector(`.item-desc[data-item="${itemId}"]`);
        const description = descInput ? descInput.value.trim() : null;

        const mappedServiceId = svcIndex + 1;

        const rowGenderSelect = document.querySelector(`.item-gender[data-item="${itemId}"]`);
        const itemGender = rowGenderSelect ? rowGenderSelect.value : 'male';

        let finalItemType = `[${itemGender.toUpperCase()}] ${itemName} (${serviceTypeName})`;
        if (isExpress) finalItemType += " [EXPRESS]";

        items.push({
            service_id: mappedServiceId,
            item_type: finalItemType,
            quantity,
            total_pieces: totalPieces,
            unit_price: parseFloat(discountedUnit.toFixed(2)),
            stain_price: stainPrice,
            amendment_price: amendPrice,
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
                payment_method: ['paid', 'partpaid'].includes(paymentStatus) ? (paymentMethod || null) : null,
                amount_paid: amountPaid,
                delivery_type: deliveryType,
                delivery_fee: dispatchFee
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
        showAlert(getReadableError(error, 'Could not complete sale. Please check your internet connection and try again.'), 'error');
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
const amountPaidEl = document.getElementById('amountPaid');

function updatePaymentMethodVisibility() {
    const group = document.getElementById('paymentMethodGroup');
    const amountPaidGroup = document.getElementById('amountPaidGroup');
    const owingGroup = document.getElementById('owingGroup');

    if (!paymentStatusEl) return;

    const status = paymentStatusEl.value;
    if (group) group.style.display = (status === 'paid' || status === 'partpaid') ? '' : 'none';
    if (amountPaidGroup) amountPaidGroup.style.display = status === 'partpaid' ? '' : 'none';
    if (owingGroup) owingGroup.style.display = status === 'partpaid' ? '' : 'none';

    if (status === 'partpaid' && amountPaidEl) {
        amountPaidEl.required = true;
    } else if (amountPaidEl) {
        amountPaidEl.required = false;
        amountPaidEl.value = '';
    }

    calculateOwing();
}

function calculateOwing() {
    const owingGroup = document.getElementById('owingGroup');
    if (owingGroup && owingGroup.style.display !== 'none') {
        const totalText = document.getElementById('totalAmount').textContent.replace('NGN ', '').replace(/,/g, '');
        const total = parseFloat(totalText) || 0;
        const paid = parseFloat(document.getElementById('amountPaid')?.value) || 0;
        const owing = Math.max(0, total - paid);
        document.getElementById('owingBalance').textContent = `NGN ${owing.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
    }
}

if (paymentStatusEl) {
    paymentStatusEl.addEventListener('change', updatePaymentMethodVisibility);
    updatePaymentMethodVisibility();
}

if (amountPaidEl) {
    amountPaidEl.addEventListener('input', calculateOwing);
}
// Also hook into calculateTotal to update owing when total changes
const origCalculateTotal = calculateTotal;
calculateTotal = function () {
    origCalculateTotal();
    calculateOwing();
};

