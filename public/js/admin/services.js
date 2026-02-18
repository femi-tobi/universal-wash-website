// Service management logic
checkAuth();

const user = getCurrentUser();
if (user.role !== 'admin') {
    alert('Access denied');
    window.location.href = '/';
}

// Load services
async function loadServices() {
    try {
        const response = await fetch('/api/services', {
            headers: getAuthHeaders()
        });
        const services = await response.json();
        
        const tbody = document.getElementById('servicesBody');
        
        if (services.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No services found</td></tr>';
            return;
        }
        
        tbody.innerHTML = services.map(service => `
            <tr>
                <td><strong>${service.name}</strong></td>
                <td>${service.description || '-'}</td>
                <td>$${parseFloat(service.base_price).toFixed(2)}</td>
                <td>
                    <span class="badge ${service.is_active ? 'badge-paid' : 'badge-unpaid'}">
                        ${service.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-primary" style="min-height: auto; padding: 8px 16px; font-size: 14px; margin-right: 8px;" onclick="editService(${service.id}, '${service.name}', ${service.base_price}, '${service.description || ''}')">
                        ✏️ Edit
                    </button>
                    ${service.is_active ? `
                        <button class="btn btn-danger" style="min-height: auto; padding: 8px 16px; font-size: 14px;" onclick="deactivateService(${service.id})">
                            🗑️ Deactivate
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

// Add service
document.getElementById('addServiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('serviceName').value.trim();
    const price = parseFloat(document.getElementById('servicePrice').value);
    const description = document.getElementById('serviceDesc').value.trim();
    
    try {
        const response = await fetch('/api/services', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, base_price: price, description })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Service added successfully!', 'success');
            document.getElementById('addServiceForm').reset();
            loadServices();
        } else {
            showAlert(data.error || 'Failed to add service', 'error');
        }
    } catch (error) {
        console.error('Error adding service:', error);
        showAlert('Connection error', 'error');
    }
});

// Edit service
function editService(id, currentName, currentPrice, currentDesc) {
    const name = prompt('Service Name:', currentName);
    if (!name) return;
    
    const price = prompt('Base Price:', currentPrice);
    if (!price) return;
    
    const description = prompt('Description:', currentDesc);
    
    updateService(id, name, parseFloat(price), description);
}

async function updateService(id, name, price, description) {
    try {
        const response = await fetch(`/api/services/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, base_price: price, description })
        });
        
        if (response.ok) {
            showAlert('Service updated successfully!', 'success');
            loadServices();
        } else {
            showAlert('Failed to update service', 'error');
        }
    } catch (error) {
        console.error('Error updating service:', error);
        showAlert('Connection error', 'error');
    }
}

// Deactivate service
async function deactivateService(id) {
    if (!confirm('Are you sure you want to deactivate this service?')) return;
    
    try {
        const response = await fetch(`/api/services/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            showAlert('Service deactivated!', 'success');
            loadServices();
        } else {
            showAlert('Failed to deactivate service', 'error');
        }
    } catch (error) {
        console.error('Error deactivating service:', error);
        showAlert('Connection error', 'error');
    }
}

// Initialize
loadServices();
