const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { settings } = require('../storage');

const router = express.Router();

// Public endpoint — your site reads non-sensitive settings from here
router.get('/public', (_req, res) => {
    const s = settings.get();
    res.json({
        general:      s.general,
        seo:          s.seo,
        social:       s.social,
        features:     { maintenanceMode: s.features.maintenanceMode, showAds: s.features.showAds },
        analytics:    { googleAnalyticsId: s.analytics.googleAnalyticsId, facebookPixelId: s.analytics.facebookPixelId, customHeadHtml: s.analytics.customHeadHtml, customBodyHtml: s.analytics.customBodyHtml },
        announcement: s.announcement || {},
        hero:         s.hero         || {},
    });
});

// Admin — full settings read/write
router.get('/',  requireAuth, (_req, res) => res.json(settings.get()));
router.put('/',  requireAuth, (req, res) => {
    const updated = settings.update(req.body);
    res.json(updated);
});

module.exports = router;
