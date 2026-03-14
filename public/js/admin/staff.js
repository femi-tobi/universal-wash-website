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
                <td>${member.phone || ''}<br><small style="color:#666">${member.address || ''}</small></td>
                <td>
                    ${member.is_active ? `
                        <button class="btn btn-primary" style="min-height: auto; padding: 6px 12px; font-size: 13px;margin-right:6px;" onclick="editStaff(${member.id})">
                            ✏️ Edit
                        </button>
                        <button class="btn btn-danger" style="min-height: auto; padding: 6px 12px; font-size: 13px;" onclick="deactivateStaff(${member.id})">
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
    const phone = document.getElementById('staffPhone').value.trim();
    const address = document.getElementById('staffAddress').value.trim();
    
    try {
        const response = await fetch('/api/staff', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ username, full_name, password, role, phone, address })
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

// Edit staff
async function editStaff(id){
    try{
        const res = await fetch(`/api/staff/${id}`, { headers: getAuthHeaders() });
        if(!res.ok) { showAlert('Failed to load staff details', 'error'); return; }
        const member = await res.json();

        // build edit panel
        let panel = document.getElementById('editPanel');
        if (!panel) {
            panel = document.createElement('div'); panel.id = 'editPanel'; panel.className = 'card';
            panel.innerHTML = `<h2 class="mb-2">Edit Staff</h2>`;
            document.querySelector('.container').insertBefore(panel, document.querySelector('.container').firstChild.nextSibling);
        }
        panel.innerHTML = `
            <h2 class="mb-2">Edit Staff</h2>
            <form id="editStaffForm">
                <div class="grid grid-2">
                    <div class="form-group"><label>Username</label><input id="eUsername"></div>
                    <div class="form-group"><label>Full Name</label><input id="eFullName"></div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group"><label>Phone</label><input id="ePhone"></div>
                    <div class="form-group"><label>Address</label><input id="eAddress"></div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group"><label>Role</label><select id="eRole"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
                    <div class="form-group"><label>Password (leave blank to keep)</label><input type="password" id="ePassword"></div>
                </div>
                <div style="display:flex;gap:8px;margin-top:8px">
                    <button class="btn btn-primary" type="submit">Save</button>
                    <button class="btn" type="button" id="cancelEdit">Cancel</button>
                </div>
            </form>
        `;

        document.getElementById('eUsername').value = member.username || '';
        document.getElementById('eFullName').value = member.full_name || '';
        document.getElementById('ePhone').value = member.phone || '';
        document.getElementById('eAddress').value = member.address || '';
        document.getElementById('eRole').value = member.role || 'staff';

        document.getElementById('cancelEdit').addEventListener('click', ()=>{ panel.remove(); });

        document.getElementById('editStaffForm').addEventListener('submit', async (ev)=>{
            ev.preventDefault();
            const payload = {
                username: document.getElementById('eUsername').value.trim(),
                full_name: document.getElementById('eFullName').value.trim(),
                phone: document.getElementById('ePhone').value.trim(),
                address: document.getElementById('eAddress').value.trim(),
                role: document.getElementById('eRole').value,
            };
            const pwd = document.getElementById('ePassword').value;
            if (pwd) payload.password = pwd;

            try{
                const pr = await fetch(`/api/staff/${id}`, { method: 'PUT', headers: Object.assign({ 'Content-Type':'application/json' }, getAuthHeaders()), body: JSON.stringify(payload) });
                const jr = await pr.json();
                if (pr.ok) { showAlert('Staff updated', 'success'); panel.remove(); loadStaff(); }
                else showAlert(jr.error || 'Failed to update', 'error');
            }catch(err){ console.error(err); showAlert('Connection error','error'); }
        });

    }catch(err){ console.error(err); showAlert('Failed to load staff', 'error'); }
}

// Initialize
loadStaff();
