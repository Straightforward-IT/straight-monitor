const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth"); // Import the auth middleware
const User = require("../models/User"); // Import the User model
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require('dotenv').config(); // Load environment variables from .env

// GET /api/users/me
router.get("/me", auth, async (req, res) => {
  try {
    // Find the user by ID
    const user = await User.findById(req.user.id).select("-password"); // Exclude the password
    res.json(user);
  } catch (err) {
    console.error(err.message);
    console.log("hello");
    res.status(500).send("Server error");
  }
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PUT /api/users/:id
router.put("/update/:id", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Update fields
    user.name = name || user.name;
    user.email = email || user.email;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/users/register
router.post("/register", async (req, res) => {
  const { name, email, password, location } = req.body;

  try {
    // Check if the user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    // Check if company email @straightforward.email
    if (!email.includes("@straightforward.email")) {
      return res.status(401).json({ msg: "Please use a company email" });
    }

    // Create a new user instance
    user = new User({
      name,
      email,
      password,
      location
    });

    // Save the new user
    await user.save();

    // Create and sign JWT
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Use the JWT secret from .env
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/users/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    // Compare the provided password with the hashed password stored in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    // Generate a JWT token for the user
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Use the JWT secret from .env
      { expiresIn: 360000 }, // Set token expiry time as needed
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;