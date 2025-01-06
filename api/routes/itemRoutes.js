const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Item = require("../models/Item");
const Monitoring = require("../models/Monitoring");
const xlsx = require("xlsx");
// Variables
const cities = ["Hamburg", "Berlin", "Köln"];

// Helper function to find or create user
async function findOrCreateUser(userID) {
  let user = await User.findById(userID);
  if (!user) {
    user = new User({
      name: "unknown",
      email: "-",
      password: "-",
      location: "-",
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
router.post("/addNew", auth, async (req, res) => {
  const { userID, bezeichnung, groesse, anzahl, soll, standort, anmerkung } =
    req.body;
  try {
    const user = await findOrCreateUser(userID);

    const existingItem = await Item.findOne({ bezeichnung, groesse, standort });
    if (existingItem) {
      return res.status(400).json({ msg: "Item already exists" });
    }

    const newItem = new Item({ bezeichnung, groesse, anzahl, soll, standort });
    const savedItem = await newItem.save();

    await logMonitoring({
      user,
      standort,
      items: [
        {
          itemId: savedItem._id,
          bezeichnung: savedItem.bezeichnung,
          groesse: savedItem.groesse,
          anzahl: savedItem.anzahl,
        },
      ],
      art: "zugabe",
      anmerkung,
    });

    res.json(savedItem);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PUT /api/items/updateMultiple
router.put("/updateMultiple", auth, async (req, res) => {
  const { userID, items, count, anmerkung } = req.body;
  try {
    const user = await findOrCreateUser(userID);
    const updatedItems = [];

    // Prepare an array for logging the changes to multiple items
    const itemsForLog = [];

    for (let itemId of items) {
      const item = await Item.findById(itemId);
      if (!item) {
        return res
          .status(404)
          .json({ msg: `Item with id ${itemId} not found` });
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
      art: count > 0 ? "zugabe" : "entnahme",
      anmerkung,
    });

    res.json(updatedItems);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PUT /api/items/name/:id
router.put("/edit/:id", auth, async (req, res) => {
    const { userID, bezeichnung, anzahl, soll} = req.body;
  
    if (!bezeichnung || bezeichnung.trim() === "") {
      return res.status(400).json({ msg: "Name cannot be empty" });
    }
  
    if (anzahl < 0) {
      return res.status(400).json({ msg: "Anzahl kann nicht negativ sein" });
    }
    
    if (soll < 0) {
      return res.status(400).json({ msg: "Anzahl kann nicht negativ sein" });
    }

    try {
      const user = await findOrCreateUser(userID);
      const item = await Item.findById(req.params.id);
  
      if (!item) {
        return res.status(404).json({ msg: "Item not found" });
      }
  
      const oldName = item.bezeichnung;
      const oldAnzahl = item.anzahl;
      const oldSoll = item.soll;

      let anmerkung = "";
  
      // Case handling based on changes to bezeichnung and anzahl
      if (oldName === bezeichnung && oldAnzahl === anzahl && oldSoll === soll) {
        return res.status(200).json({ msg: "No changes detected." });
      }
  
      // Check if bezeichnung has changed and needs validation for uniqueness
      if (oldName !== bezeichnung) {
        const existingItem = await Item.findOne({
          bezeichnung,
          groesse: item.groesse,
          standort: item.standort,
        });
  
        if (existingItem) {
          return res.status(400).json({
            msg: `Item with Name "${bezeichnung}", Size "${item.groesse}", and Location "${item.standort}" already exists.`,
          });
        }
        
        // Update name and note the change
        anmerkung += `[Name: ${oldName} -> ${bezeichnung}] `;
        item.bezeichnung = bezeichnung;
      }
  
      // Check if anzahl has changed and note the change
      if (oldAnzahl !== anzahl) {
        anmerkung += `[Anzahl: ${oldAnzahl} -> ${anzahl}] `;
        item.anzahl = anzahl;
      }

      if (oldSoll !== soll) {
        anmerkung += `[Soll: ${oldSoll} -> ${soll}]`;
        item.soll = soll;
      }
  
      await item.save();
  
      await logMonitoring({
        user,
        standort: item.standort,
        items: [
          {
            itemId: item._id,
            bezeichnung: item.bezeichnung,
            groesse: item.groesse,
            anzahl: Math.abs(oldAnzahl - anzahl),
            soll: item.soll,
          },
        ],
        art: "änderung",
        anmerkung: `Geändert: ${anmerkung.trim()}`,
      });
  
      res.json(item);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  });
  
// PUT /api/items/add/:id
router.put("/add/:id", auth, async (req, res) => {
  const { userID, anzahl, anmerkung } = req.body;
  try {
    const user = await findOrCreateUser(userID);
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ msg: "Item not found" });
    }

    item.anzahl += anzahl;
    await item.save();

    await logMonitoring({
      user,
      standort: item.standort,
      items: [
        {
          itemId: item._id,
          bezeichnung: item.bezeichnung,
          groesse: item.groesse,
          anzahl,
          soll: item.soll,
        },
      ],
      art: "zugabe",
      anmerkung,
    });

    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PUT /api/items/remove/:id
router.put("/remove/:id", auth, async (req, res) => {
  const { userID, anzahl, anmerkung } = req.body;
  try {
    const user = await findOrCreateUser(userID);
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ msg: "Item not found" });
    }

    item.anzahl -= anzahl;
    if (item.anzahl < 0) item.anzahl = 0;
    await item.save();

    await logMonitoring({
      user,
      standort: item.standort,
      items: [
        {
          itemId: item._id,
          bezeichnung: item.bezeichnung,
          groesse: item.groesse,
          anzahl,
          soll: item.soll
        },
      ],
      art: "entnahme",
      anmerkung,
    });

    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// GET /api/items/ - Get all items
router.get("/", auth, async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// GET /api/items/find/:id - Get a single item by ID
router.get("/find/:id", auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ msg: "Item not found" });
    }
    res.json(item);
  } catch (err) {
    console.error(err.message);

    if (err.kind === "ObjectId") {
      return res.status(400).json({ msg: "Invalid Item ID" });
    }
    res.status(500).send("Server error");
  }
});

// GET /api/items/findByLocation - Get items by location
router.get("/findByLocation", auth, async (req, res) => {
  try {
    const locationQuery = req.query.locationQuery;
    if (!cities.includes(locationQuery)) {
      return res
        .status(400)
        .json({ msg: `Location must be one of: ${cities.join(", ")}` });
    }

    const items = await Item.find({ standort: locationQuery });
    if (!items.length) {
      return res.status(404).json({ msg: "No items found in this location" });
    }

    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// GET /api/items/getExcel - Get Excel Document
router.get("/getExcel", auth, async (req, res) => {
  try {
    const items = await Item.find();
    const monitorings = await Monitoring.find().populate("benutzer", "name email");

    const workbook = xlsx.utils.book_new();

    const itemData = items.map(item => ({
        Bezeichnung: item.bezeichnung,
        Groesse: item.groesse || "Onesize",
        Soll: item.soll,
        Anzahl: item.anzahl,
        Standort: item.standort,
        ID: item._id
    }));

    const monitoringData = monitorings.map(log => ({
        Benutzer: log.benutzer ? log.benutzer.name: log.benutzerMail,
        Standort: log.standort,
        Art: log.art,
        Datum: log.timestamp,
        Items: log.items.map(item => 
            `${item.bezeichnung}, Groesse: ${item.groesse || "Onesize"}, 
            Anzahl: ${item.anzahl}`).join("; "), Anmerkung: log.anmerkung || " ", ID: log._id
        
    }));

    const worksheet_item = xlsx.utils.json_to_sheet(itemData);
    const worksheet_monitoring = xlsx.utils.json_to_sheet(monitoringData);
    xlsx.utils.book_append_sheet(workbook, worksheet_item, "Items");
    xlsx.utils.book_append_sheet(workbook, worksheet_monitoring, "Verlauf");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="data.xlsx"');
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);

  } catch (err) {
    console.error("Error generating Excel file: ", err.msg);
    res.status(500).send("Server-Error");
  }
});

module.exports = router;
