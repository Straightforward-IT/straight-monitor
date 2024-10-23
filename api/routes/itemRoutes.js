const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Item = require('../models/Item');
const Monitoring = require('../models/Monitoring');

// Variables
const cities = ['Hamburg', 'Berlin', 'Koeln'];

// Helper function to find or create user
async function findOrCreateUser(userID) {
    let user = await User.findById(userID);
    if (!user) {
        user = new User({
            name: "unknown",
            email: "-",
            password: "-",
            location: "-"
        });
    }
    return user;
}

// Helper function to log monitoring actions
async function logMonitoring({ user, standort, items, art, anmerkung }) {
    const logEntry = new Monitoring({
        benutzer: user._id,
        benutzerMail: user.email,
        standort,
        art,
        items,
        anmerkung,
        timestamp: new Date(),
    });
    await logEntry.save();
}

// POST /api/items/addNew
router.post('/addNew', auth, async (req, res) => {
    const { userID, bezeichnung, groesse, anzahl, standort, anmerkung } = req.body;
    try {
        const user = await findOrCreateUser(userID);

        const existingItem = await Item.findOne({ bezeichnung, groesse, standort });
        if (existingItem) {
            return res.status(400).json({ msg: 'Item already exists' });
        }

        const newItem = new Item({ bezeichnung, groesse, anzahl, standort });
        const savedItem = await newItem.save();

        await logMonitoring({
            user,
            standort,
            items: [{ itemId: savedItem._id, bezeichnung: savedItem.bezeichnung, groesse: savedItem.groesse, anzahl: savedItem.anzahl }],
            art: 'zugabe',
            anmerkung,
        });

        res.json(savedItem);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// PUT /api/items/updateMultiple
router.put('/updateMultiple', auth, async (req, res) => {
    const { userID, items, count, anmerkung } = req.body;
    try {
        const user = await findOrCreateUser(userID);
        const updatedItems = [];

        // Prepare an array for logging the changes to multiple items
        const itemsForLog = [];

        for (let itemId of items) {
            const item = await Item.findById(itemId);
            if (!item) {
                return res.status(404).json({ msg: `Item with id ${itemId} not found` });
            }

            item.anzahl += count;
            if (item.anzahl < 0) item.anzahl = 0;

            await item.save();

            // Prepare the item data for logging
            itemsForLog.push({
                itemId: item._id,
                bezeichnung: item.bezeichnung,
                groesse: item.groesse,
                anzahl: Math.abs(count),
            });

            updatedItems.push(item);
        }

        // Log the action for all updated items
        await logMonitoring({
            user,
            standort: updatedItems[0].standort, // Assuming all items share the same location for simplicity
            items: itemsForLog,
            art: count > 0 ? 'zugabe' : 'entnahme',
            anmerkung,
        });

        res.json(updatedItems);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// PUT /api/items/name/:id
router.put('/name/:id', auth, async (req, res) => {
    const { userID, bezeichnung, anmerkung } = req.body;
    if (!bezeichnung || bezeichnung.trim() === '') {
        return res.status(400).json({ msg: 'Name cannot be empty' });
    }

    try {
        const user = await findOrCreateUser(userID);
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ msg: 'Item not found' });
        }

        const oldName = item.bezeichnung;
        const newName = bezeichnung;

        const existingItem = await Item.findOne({ bezeichnung, groesse: item.groesse, standort: item.standort });
        if (existingItem) {
            return res.status(400).json({ msg: 'Item with the same attributes already exists' });
        }

        item.bezeichnung = newName;
        await item.save();

        await logMonitoring({
            user,
            standort: item.standort,
            items: [{ itemId: item._id, bezeichnung: newName, groesse: item.groesse, anzahl: 0 }],
            art: 'änderung',
            anmerkung: `Name geändert von ${oldName} zu ${newName}. ${anmerkung || ''}`
        });

        res.json(item);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// PUT /api/items/add/:id
router.put('/add/:id', auth, async (req, res) => {
    const { userID, anzahl, anmerkung } = req.body;
    try {
        const user = await findOrCreateUser(userID);
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ msg: 'Item not found' });
        }

        item.anzahl += anzahl;
        await item.save();

        await logMonitoring({
            user,
            standort: item.standort,
            items: [{ itemId: item._id, bezeichnung: item.bezeichnung, groesse: item.groesse, anzahl }],
            art: 'zugabe',
            anmerkung
        });

        res.json(item);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// PUT /api/items/remove/:id
router.put('/remove/:id', auth, async (req, res) => {
    const { userID, anzahl, anmerkung } = req.body;
    try {
        const user = await findOrCreateUser(userID);
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ msg: 'Item not found' });
        }

        item.anzahl -= anzahl;
        if (item.anzahl < 0) item.anzahl = 0;
        await item.save();

        await logMonitoring({
            user,
            standort: item.standort,
            items: [{ itemId: item._id, bezeichnung: item.bezeichnung, groesse: item.groesse, anzahl }],
            art: 'entnahme',
            anmerkung
        });

        res.json(item);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// GET /api/items/ - Get all items
router.get('/', auth, async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// GET /api/items/find/:id - Get a single item by ID
router.get('/find/:id', auth, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ msg: 'Item not found' });
        }
        res.json(item);
    } catch (err) {
        console.error(err.message);

        if (err.kind === 'ObjectId') {
            return res.status(400).json({ msg: 'Invalid Item ID' });
        }
        res.status(500).send('Server error');
    }
});

// GET /api/items/findByLocation - Get items by location
router.get('/findByLocation', auth, async (req, res) => {
    try {
        const locationQuery = req.query.locationQuery;
        if (!cities.includes(locationQuery)) {
            return res.status(400).json({ msg: `Location must be one of: ${cities.join(', ')}` });
        }

        const items = await Item.find({ standort: locationQuery });
        if (!items.length) {
            return res.status(404).json({ msg: 'No items found in this location' });
        }

        res.json(items);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
