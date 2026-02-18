const db = require('../config/database');

// Get all active services
exports.getAllServices = async (req, res) => {
    try {
        const [services] = await db.query(
            'SELECT * FROM services WHERE is_active = 1 ORDER BY name'
        );

        res.json(services);
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
};

// Create new service (Admin only)
exports.createService = async (req, res) => {
    try {
        const { name, description, base_price } = req.body;

        if (!name || !base_price) {
            return res.status(400).json({ error: 'Name and base price are required' });
        }

        const [result] = await db.query(
            'INSERT INTO services (name, description, base_price) VALUES (?, ?, ?)',
            [name, description, base_price]
        );

        res.json({
            success: true,
            service_id: result.insertId,
            message: 'Service created successfully'
        });
    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({ error: 'Failed to create service' });
    }
};

// Update service (Admin only)
exports.updateService = async (req, res) => {
    try {
        const serviceId = req.params.id;
        const { name, description, base_price } = req.body;

        await db.query(
            'UPDATE services SET name = ?, description = ?, base_price = ? WHERE id = ?',
            [name, description, base_price, serviceId]
        );

        res.json({ success: true, message: 'Service updated successfully' });
    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({ error: 'Failed to update service' });
    }
};

// Deactivate service (Admin only)
exports.deleteService = async (req, res) => {
    try {
        const serviceId = req.params.id;

        await db.query(
            'UPDATE services SET is_active = 0 WHERE id = ?',
            [serviceId]
        );

        res.json({ success: true, message: 'Service deactivated successfully' });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ error: 'Failed to deactivate service' });
    }
};
