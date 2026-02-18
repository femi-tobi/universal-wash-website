// New sale creation logic
checkAuth();

let itemCounter = 0;

// ─── Full Price List ────────────────────────────────────────────────────────
// Prices: [hanging, pressing, express]  (null = not available)
const PRICE_LIST = {
    male: [
        { name: "Shirts (Colored)",         prices: [1100,  700,  1500] },
        { name: "Shirts (White)",            prices: [1300,  700,  1700] },
        { name: "Trousers",                  prices: [1100,  700,  1500] },
        { name: "Jeans",                     prices: [1100,  700,  1500] },
        { name: "Chinos",                    prices: [1100,  700,  1500] },
        { name: "Night Robes",               prices: [900,   700,  1000] },
        { name: "Suit",                      prices: [3100,  2000, 4500] },
        { name: "Native",                    prices: [1600,  1000, 2000] },
        { name: "White Native",              prices: [1800,  1000, 2200] },
        { name: "Native Ankara",             prices: [1600,  700,  1700] },
        { name: "Agbada (Color)",            prices: [3600,  2500, 4500] },
        { name: "Agbada (White)",            prices: [4100,  2500, 5000] },
        { name: "Table Cloth (Small)",       prices: [null,  700,  1500] },
        { name: "Table Cloth (Big)",         prices: [null,  null, 3200] },
        { name: "Danshiki (Complete)",       prices: [1300,  null, 900]  },
        { name: "Jacket",                    prices: [1100,  700,  1100] },
        { name: "Jalabia (Long)",            prices: [1100,  700,  1200] },
        { name: "Hoodie",                    prices: [1100,  700,  1000] },
        { name: "Kaftan",                    prices: [1100,  700,  1500] },
        { name: "T-Shirts (Colored)",        prices: [800,   700,  1300] },
        { name: "T-Shirts (White)",          prices: [800,   700,  900]  },
        { name: "Sweater",                   prices: [1100,  700,  1500] },
        { name: "Face Cap",                  prices: [600,   200,  800]  },
        { name: "Tie",                       prices: [600,   200,  600]  },
        { name: "Singlet",                   prices: [600,   300,  500]  },
        { name: "A Pair of Socks",           prices: [600,   null, null] },
        { name: "Shorts",                    prices: [600,   500,  600]  },
        { name: "Duvet (Big)",               prices: [null,  null, 4000] },
        { name: "Duvet Cover",               prices: [null,  null, 3000] },
        { name: "Center Rug",                prices: [null,  null, 2500] },
        { name: "Bedsheet (Big) - Color",    prices: [null,  1000, 1500] },
        { name: "Bedsheet (Big) - White",    prices: [null,  1000, 2000] },
        { name: "Bedsheet (Small) - Col",    prices: [null,  700,  1000] },
        { name: "Bedsheet (Small) - White",  prices: [null,  700,  1200] },
        { name: "Towel (Small/Color)",       prices: [null,  200,  1700] },
        { name: "Towel (Small/White)",       prices: [null,  300,  1700] },
        { name: "Towel (Big/Color)",         prices: [1300,  null, 1700] },
        { name: "Towel (Big/White)",         prices: [1600,  null, 2500] },
    ],
    female: [
        { name: "Shirts (Colored)",          prices: [500,   1000, null] },
        { name: "Shirts (White)",            prices: [500,   1100, null] },
        { name: "Trousers",                  prices: [500,   null, 800]  },
        { name: "Jeans",                     prices: [500,   null, 700]  },
        { name: "Chinos",                    prices: [500,   null, 800]  },
        { name: "Skirt Suit",                prices: [1000,  null, null] },
        { name: "Cap",                       prices: [250,   null, 3500] },
        { name: "Skirt Only",                prices: [500,   null, 600]  },
        { name: "Blouse Only",               prices: [500,   null, 600]  },
        { name: "Native",                    prices: [600,   null, 600]  },
        { name: "Jacket",                    prices: [600,   null, 700]  },
        { name: "Jalabia (Big)",             prices: [500,   null, 1000] },
        { name: "Jalabia (Small)",           prices: [200,   null, 900]  },
        { name: "Kaftan",                    prices: [500,   null, 600]  },
        { name: "T-Shirts (Colored)",        prices: [400,   null, 700]  },
        { name: "T-Shirts (White)",          prices: [500,   null, 750]  },
        { name: "Sweater",                   prices: [500,   null, 800]  },
        { name: "Iro & Buba (White)",        prices: [100,   null, 300]  },
        { name: "Iro & Buba (Color)",        prices: [1000,  null, 1200] },
        { name: "Iro & Buba Lace (White)",   prices: [2500,  null, 2600] },
        { name: "Iro & Buba Lace (Color)",   prices: [2000,  null, 2600] },
        { name: "Gele",                      prices: [500,   null, 1200] },
        { name: "Day Dress/Gown (Long) White",  prices: [900, null, null] },
        { name: "Day Dress/Gown (Short) Color", prices: [800, null, 700]  },
        { name: "Day Dress/Gown (Long) Lace",   prices: [1000,null, 1200] },
        { name: "Day Dress/Gown (Short) Lace",  prices: [900, null, 1000] },
        { name: "Shorts",                    prices: [300,   null, 600]  },
        { name: "Ankara",                    prices: [600,   null, 800]  },
        { name: "Shorts (Alt)",              prices: [500,   null, 600]  },
        { name: "Wedding Gown",              prices: [200,   null, 5000] },
        { name: "Socks",                     prices: [400,   null, null] },
        { name: "Agbada (Complete)",         prices: [1500,  null, 3500] },
        { name: "Iro",                       prices: [250,   null, null] },
        { name: "Joggers",                   prices: [500,   null, 750]  },
        { name: "Suit",                      prices: [null,  null, 3500] },
        { name: "Curtain (Heavy)",           prices: [null,  null, 3000] },
        { name: "Curtain (Light)",           prices: [null,  null, 2500] },
        { name: "Travelling Bag",            prices: [null,  null, 600]  },
        { name: "Boxers",                    prices: [600,   350,  500]  },
        { name: "Hijab",                     prices: [800,   400,  800]  },
        { name: "Tracksuit",                 prices: [1800,  600,  2000] },
        { name: "Joggers (Alt)",             prices: [1100,  600,  1400] },
        { name: "Graduation Gown",           prices: [2600,  1000, 3500] },
        { name: "Choir Gown",               prices: [2100,  600,  2500] },
    ]
};

const SERVICE_TYPES = ['Hanging', 'Pressing', 'Express'];

// ─── Build item dropdown options for given gender & service type ─────────────
function buildItemOptions(gender, serviceTypeIndex) {
    const list = PRICE_LIST[gender] || [];
    let opts = `<option value="">Select item...</option>`;
    list.forEach((item, idx) => {
        const price = item.prices[serviceTypeIndex];
        if (price !== null && price !== undefined) {
            opts += `<option value="${idx}" data-price="${price}">${item.name} — NGN ${price.toLocaleString()}</option>`;
        }
    });
    return opts;
}

// ─── Refresh all item dropdowns when gender/service type changes ─────────────
function refreshAllItemDropdowns() {
    const gender = document.getElementById('globalGender')?.value || 'male';
    const serviceTypeIndex = parseInt(document.getElementById('globalServiceType')?.value ?? '0');

    document.querySelectorAll('.item-select').forEach(select => {
        const currentVal = select.value;
        select.innerHTML = buildItemOptions(gender, serviceTypeIndex);
        // Try to restore selection
        if (currentVal) {
            select.value = currentVal;
        }
        // Recalculate subtotal
        select.dispatchEvent(new Event('change'));
    });
}

// ─── Add item row ─────────────────────────────────────────────────────────────
function addItemRow() {
    itemCounter++;
    const container = document.getElementById('itemsContainer');
    const gender = document.getElementById('globalGender')?.value || 'male';
    const serviceTypeIndex = parseInt(document.getElementById('globalServiceType')?.value ?? '0');

    const row = document.createElement('div');
    row.className = 'card';
    row.id = `item-${itemCounter}`;
    row.style.background = '#f8fafc';
    row.style.marginBottom = '16px';

    row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0;">Item #${itemCounter}</h3>
            <button type="button" class="btn btn-danger" onclick="removeItem(${itemCounter})" style="min-height: auto; padding: 8px 16px; font-size: 14px;">
                🗑️ Remove
            </button>
        </div>

        <div class="grid grid-2">
            <div class="form-group">
                <label>Clothing Item *</label>
                <select class="item-select" data-item="${itemCounter}" required>
                    ${buildItemOptions(gender, serviceTypeIndex)}
                </select>
            </div>

            <div class="form-group">
                <label>Quantity *</label>
                <input type="number" class="quantity" data-item="${itemCounter}" min="1" value="1" required>
            </div>
        </div>

        <div class="form-group">
            <label>Subtotal</label>
            <input type="text" class="subtotal" data-item="${itemCounter}" readonly
                style="background: #e2e8f0; font-weight: 700; font-size: 18px;" value="NGN 0">
        </div>
    `;

    container.appendChild(row);

    row.querySelector('.item-select').addEventListener('change', calculateItemTotal);
    row.querySelector('.quantity').addEventListener('input', calculateItemTotal);
}

// ─── Remove item row ──────────────────────────────────────────────────────────
function removeItem(id) {
    const row = document.getElementById(`item-${id}`);
    if (row) {
        row.remove();
        calculateTotal();
    }
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

// ─── Calculate grand total ────────────────────────────────────────────────────
function calculateTotal() {
    let total = 0;
    document.querySelectorAll('.subtotal').forEach(input => {
        const value = parseFloat(input.value.replace('NGN ', '').replace(/,/g, '')) || 0;
        total += value;
    });
    document.getElementById('totalAmount').textContent =
        `NGN ${total.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
}

// ─── Submit sale form ─────────────────────────────────────────────────────────
document.getElementById('saleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const paymentStatus = document.getElementById('paymentStatus').value;
    const gender = document.getElementById('globalGender').value;
    const serviceTypeIndex = parseInt(document.getElementById('globalServiceType').value);
    const serviceTypeName = SERVICE_TYPES[serviceTypeIndex];

    const items = [];
    document.querySelectorAll('.item-select').forEach(select => {
        const itemId = select.dataset.item;
        const selectedOption = select.options[select.selectedIndex];
        if (!select.value || !selectedOption) return;

        const itemName = selectedOption.text.split(' —')[0];
        const unitPrice = parseFloat(selectedOption.dataset.price) || 0;
        const quantity = parseInt(document.querySelector(`.quantity[data-item="${itemId}"]`).value) || 1;
        const subtotal = unitPrice * quantity;

        items.push({
            service_id: 1, // default service_id (backend still needs one)
            item_type: `[${gender.toUpperCase()}] ${itemName} (${serviceTypeName})`,
            quantity,
            unit_price: unitPrice,
            subtotal
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
                items,
                payment_status: paymentStatus
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
        const response = await fetch('/api/customers', { headers: getAuthHeaders() });
        const customers = await response.json();
        const existing = customers.find(c => c.phone === phone);
        if (existing) {
            document.getElementById('customerName').value = existing.name;
            showAlert(`Customer found: ${existing.name}`, 'success');
        }
    } catch (error) {
        console.error('Error looking up customer:', error);
    }
});

// ─── Initialize ───────────────────────────────────────────────────────────────
addItemRow();
