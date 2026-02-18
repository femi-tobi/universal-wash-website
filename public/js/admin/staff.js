// Staff management logic
checkAuth();

const user = getCurrentUser();
if (user.role !== 'admin') {
    alert('Access denied');
    window.location.href = '/';
}

// Load staff
async function loadStaff() {
    try {
        const response = await fetch('/api/staff', {
            headers: getAuthHeaders()
        });
        const staff = await response.json();
        
        const tbody = document.getElementById('staffBody');
        
        if (staff.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No staff members found</td></tr>';
            return;
        }
        
        tbody.innerHTML = staff.map(member => `
            <tr>
                <td><strong>${member.username}</strong></td>
                <td>${member.full_name}</td>
                <td>
                    <span class="badge ${member.role === 'admin' ? 'badge-admin' : 'badge-staff'}">
                        ${member.role.toUpperCase()}
                    </span>
                </td>
                <td>
                    <span class="badge ${member.is_active ? 'badge-paid' : 'badge-unpaid'}">
                        ${member.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(member.created_at).toLocaleDateString()}</td>
                <td>
                    ${member.is_active ? `
                        <button class="btn btn-danger" style="min-height: auto; padding: 8px 16px; font-size: 14px;" onclick="deactivateStaff(${member.id})">
                            🗑️ Deactivate
                        </button>
                    ` : '<span style="color: var(--text-secondary);">Inactive</span>'}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading staff:', error);
    }
}

// Add staff
document.getElementById('addStaffForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('staffUsername').value.trim();
    const full_name = document.getElementById('staffFullName').value.trim();
    const password = document.getElementById('staffPassword').value;
    const role = document.getElementById('staffRole').value;
    
    try {
        const response = await fetch('/api/staff', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ username, full_name, password, role })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Staff member added successfully!', 'success');
            document.getElementById('addStaffForm').reset();
            loadStaff();
        } else {
            showAlert(data.error || 'Failed to add staff member', 'error');
        }
    } catch (error) {
        console.error('Error adding staff:', error);
        showAlert('Connection error', 'error');
    }
});

// Deactivate staff
async function deactivateStaff(id) {
    if (!confirm('Are you sure you want to deactivate this staff member?')) return;
    
    try {
        const response = await fetch(`/api/staff/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            showAlert('Staff member deactivated!', 'success');
            loadStaff();
        } else {
            showAlert('Failed to deactivate staff member', 'error');
        }
    } catch (error) {
        console.error('Error deactivating staff:', error);
        showAlert('Connection error', 'error');
    }
}

// Initialize
loadStaff();
