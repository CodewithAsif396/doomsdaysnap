const express = require('express');
const { ads, settings } = require('../storage');

const router = express.Router();

// GET /api/ads — active ads, optionally filtered by placement or device
router.get('/', (req, res) => {
    const cfg = settings.get();
    if (!cfg.features.showAds) return res.json([]);

    const now = new Date();
    let list  = ads.getAll().filter(ad => {
        if (!ad.active)                                   return false;
        if (ad.startDate && new Date(ad.startDate) > now) return false;
        if (ad.endDate   && new Date(ad.endDate)   < now) return false;
        return true;
    });

    if (req.query.placement) list = list.filter(a => a.placement === req.query.placement);
    if (req.query.device)    list = list.filter(a => a.deviceTarget === 'all' || a.deviceTarget === req.query.device);

    // Sort by priority descending
    list.sort((a, b) => (b.priority || 5) - (a.priority || 5));

    // Strip internal stats from public response
    const safe = list.map(({ impressions: _i, clicks: _c, ...ad }) => ad);
    res.json(safe);
});

// Track impression
router.post('/:id/impression', (req, res) => {
    const ad = ads.getById(req.params.id);
    if (!ad || !ad.active) return res.status(404).json({ error: 'Ad not found.' });
    ads.update(req.params.id, { impressions: ad.impressions + 1 });
    res.json({ ok: true });
});

// Track click
router.post('/:id/click', (req, res) => {
    const ad = ads.getById(req.params.id);
    if (!ad || !ad.active) return res.status(404).json({ error: 'Ad not found.' });
    ads.update(req.params.id, { clicks: ad.clicks + 1 });
    res.json({ ok: true, linkUrl: ad.linkUrl });
});

module.exports = router;
