// New sale creation logic
checkAuth();

let services = [];
let itemCounter = 0;

// Load services on page load
async function loadServices() {
    try {
        const response = await fetch('/api/services', {
            headers: getAuthHeaders()
        });
        
        services = await response.json();
        addItemRow(); // Add first item row
    } catch (error) {
        console.error('Error loading services:', error);
        showAlert('Failed to load services', 'error');
    }
}

// Customer phone lookup
document.getElementById('customerPhone')?.addEventListener('blur', async function() {
    const phone = this.value.trim();
    if (!phone) return;
    
    try {
        const response = await fetch('/api/customers', {
            headers: getAuthHeaders()
        });
        
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

// Add item row
function addItemRow() {
    itemCounter++;
    const container = document.getElementById('itemsContainer');
    
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
                <label>Service Type *</label>
                <select class="service-select" data-item="${itemCounter}" required>
                    <option value="">Select service...</option>
                    ${services.map(s => `<option value="${s.id}" data-price="${s.base_price}">${s.name} - NGN ${Number(s.base_price).toLocaleString()}</option>`).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label>Item Type *</label>
                <input type="text" class="item-type" data-item="${itemCounter}" placeholder="e.g., Shirt, Pants, Dress" required>
            </div>
        </div>
        
        <div class="grid grid-2">
            <div class="form-group">
                <label>Quantity *</label>
                <input type="number" class="quantity" data-item="${itemCounter}" min="1" value="1" required>
            </div>
            
            <div class="form-group">
                <label>Subtotal</label>
                <input type="text" class="subtotal" data-item="${itemCounter}" readonly style="background: #e2e8f0; font-weight: 700; font-size: 18px;" value="$0.00">
            </div>
        </div>
    `;
    
    container.appendChild(row);
    
    // Attach event listeners
    row.querySelector('.service-select').addEventListener('change', calculateItemTotal);
    row.querySelector('.quantity').addEventListener('input', calculateItemTotal);
}

// Remove item row
function removeItem(id) {
    const row = document.getElementById(`item-${id}`);
    if (row) {
        row.remove();
        calculateTotal();
    }
}

// Calculate item subtotal
function calculateItemTotal(e) {
    const itemId = e.target.dataset.item;
    const serviceSelect = document.querySelector(`.service-select[data-item="${itemId}"]`);
    const quantity = document.querySelector(`.quantity[data-item="${itemId}"]`).value;
    const subtotalInput = document.querySelector(`.subtotal[data-item="${itemId}"]`);
    
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    const price = parseFloat(selectedOption.dataset.price) || 0;
    
    const subtotal = price * parseInt(quantity);
    subtotalInput.value = `NGN ${subtotal.toLocaleString('en-NG', {minimumFractionDigits: 0})}`;    
    
    calculateTotal();
}

// Calculate total amount
function calculateTotal() {
    let total = 0;
    document.querySelectorAll('.subtotal').forEach(input => {
        const value = parseFloat(input.value.replace('NGN ', '').replace(/,/g, '')) || 0;
        total += value;
    });
    
    document.getElementById('totalAmount').textContent = `NGN ${total.toLocaleString('en-NG', {minimumFractionDigits: 0})}`;    
}

// Submit sale form
document.getElementById('saleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collect form data
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const paymentStatus = document.getElementById('paymentStatus').value;
    
    // Collect items
    const items = [];
    document.querySelectorAll('.service-select').forEach(select => {
        const itemId = select.dataset.item;
        const serviceId = select.value;
        const itemType = document.querySelector(`.item-type[data-item="${itemId}"]`).value.trim();
        const quantity = parseInt(document.querySelector(`.quantity[data-item="${itemId}"]`).value);
        const subtotalText = document.querySelector(`.subtotal[data-item="${itemId}"]`).value;
        const subtotal = parseFloat(subtotalText.replace('NGN ', '').replace(/,/g, ''));
        
        const selectedOption = select.options[select.selectedIndex];
        const unitPrice = parseFloat(selectedOption.dataset.price);
        
        if (serviceId && itemType) {
            items.push({
                service_id: serviceId,
                item_type: itemType,
                quantity: quantity,
                unit_price: unitPrice,
                subtotal: subtotal
            });
        }
    });
    
    if (items.length === 0) {
        showAlert('Please add at least one item', 'error');
        return;
    }
    
    // Submit to API
    try {
        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                customer_name: customerName,
                customer_phone: customerPhone,
                items: items,
                payment_status: paymentStatus
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Sale created successfully!', 'success');
            
            // Open receipt automatically
            window.open(`/views/staff/receipt.html?id=${data.sale_id}`, '_blank');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showAlert(data.error || 'Failed to create sale', 'error');
        }
    } catch (error) {
        console.error('Error creating sale:', error);
        showAlert('Connection error. Please try again.', 'error');
    }
});

// Initialize
loadServices();
