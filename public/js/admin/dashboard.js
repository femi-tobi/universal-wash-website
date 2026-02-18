// Admin dashboard logic
checkAuth();

const user = getCurrentUser();
if (user.role !== 'admin') {
    alert('Access denied');
    window.location.href = '/views/staff/dashboard.html';
}

document.getElementById('adminName').textContent = `Welcome, ${user.full_name}`;

// Load dashboard data
async function loadDashboard() {
    await Promise.all([
        loadRevenueStats(),
        loadOutstandingPayments(),
        loadServiceBreakdown()
    ]);
}

// Load revenue statistics
async function loadRevenueStats() {
    try {
        // Daily revenue
        const dailyRes = await fetch('/api/dashboard/revenue/daily', {
            headers: getAuthHeaders()
        });
        const daily = await dailyRes.json();
        document.getElementById('dailyRevenue').textContent = '$' + (daily.revenue || 0).toFixed(2);
        document.getElementById('dailySales').textContent = `${daily.sales_count || 0} sales`;
        
        // Weekly revenue
        const weeklyRes = await fetch('/api/dashboard/revenue/weekly', {
            headers: getAuthHeaders()
        });
        const weekly = await weeklyRes.json();
        const weeklyTotal = weekly.reduce((sum, day) => sum + parseFloat(day.revenue), 0);
        document.getElementById('weeklyRevenue').textContent = '$' + weeklyTotal.toFixed(2);
        
        // Monthly revenue
        const monthlyRes = await fetch('/api/dashboard/revenue/monthly', {
            headers: getAuthHeaders()
        });
        const monthly = await monthlyRes.json();
        const monthlyTotal = monthly.reduce((sum, week) => sum + parseFloat(week.revenue), 0);
        document.getElementById('monthlyRevenue').textContent = '$' + monthlyTotal.toFixed(2);
    } catch (error) {
        console.error('Error loading revenue stats:', error);
    }
}

// Load outstanding payments
async function loadOutstandingPayments() {
    try {
        const response = await fetch('/api/dashboard/outstanding', {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        document.getElementById('outstandingCount').textContent = data.summary.total_unpaid;
        document.getElementById('outstandingAmount').textContent = '$' + parseFloat(data.summary.total_unpaid_amount).toFixed(2);
        
        const tbody = document.getElementById('outstandingBody');
        
        if (data.outstanding.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No outstanding payments</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.outstanding.map(sale => `
            <tr>
                <td>#${sale.sale_id}</td>
                <td>${sale.customer_name}</td>
                <td>${sale.customer_phone}</td>
                <td>$${parseFloat(sale.total_amount).toFixed(2)}</td>
                <td>${new Date(sale.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-success" style="min-height: auto; padding: 8px 16px; font-size: 14px;" onclick="markAsPaid(${sale.sale_id})">
                        Mark Paid
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading outstanding payments:', error);
    }
}

// Load service breakdown chart
async function loadServiceBreakdown() {
    try {
        const response = await fetch('/api/dashboard/sales-by-service', {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.length === 0) return;
        
        const ctx = document.getElementById('serviceChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(s => s.service_name),
                datasets: [{
                    label: 'Revenue ($)',
                    data: data.map(s => parseFloat(s.total_revenue)),
                    backgroundColor: '#2563eb',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading service breakdown:', error);
    }
}

// Mark sale as paid
async function markAsPaid(saleId) {
    if (!confirm('Mark this sale as paid?')) return;
    
    try {
        const response = await fetch(`/api/sales/${saleId}/payment`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ payment_status: 'paid' })
        });
        
        if (response.ok) {
            showAlert('Payment status updated!', 'success');
            loadOutstandingPayments();
            loadRevenueStats();
        } else {
            showAlert('Failed to update payment status', 'error');
        }
    } catch (error) {
        console.error('Error updating payment:', error);
        showAlert('Connection error', 'error');
    }
}

// Initialize
loadDashboard();
