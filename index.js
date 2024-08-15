const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("./models/User");
const Item = require("./models/Item");
const Auction = require("./models/Auction");
const Feedback = require("./models/Feedback");
const { check, validationResult } = require("express-validator");

app.use(express.json());

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

mongoose
  .connect(
    "mongodb+srv://adrianyumnam:p6UBZQPrHtczx6vr@cluster0.ry7aant.mongodb.net/spider-onsites?retryWrites=true&w=majority&appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err.message);
  });

app.get("/", (req, res) => {
  res.send("Welcome to the Auction Platform API");
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "newlamjingbayumnam1@gmail.com",
    pass: "uwby tumy pnhm wodg",
  },
});

app.post("/api/register", async (req, res) => {
  try {
    console.log("Req.body", req.body);
    const { username, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role,
    });
    console.log("New User", newUser);
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    const subject = "Please verify your email";
    const verificationLink = `http://localhost:5000/api/verify/${token}`;
    const text = `Hello ${newUser.username},\n\nPlease verify your email by clicking the link: ${verificationLink}\n\nBest regards,\nAuction Platform Team`;

    await sendEmailNotification(newUser.email, subject, text);

    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
    });
  } catch (error) {
    console.error("Error during registration:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/verify/:token", async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ message: "Invalid token" });
    }

    user.isVerified = true;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res
        .status(400)
        .json({ message: "Please verify your email first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

const authMiddleware = async (req, res, next) => {
  console.log("Headers:", req.headers);
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = authHeader.replace("Bearer ", "");
  console.log("token", token);
  try {
    console.log("inside try block item");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("decoded", decoded);
    req.user = await User.findById(decoded.id);
    console.log("req.user", req.user);
    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    res.status(401).json({ message: "Token is not valid" });
  }
};

app.use(authMiddleware);

app.post(
  "/api/items",
  [
    check("title").notEmpty().withMessage("Title is required"),
    check("description").notEmpty().withMessage("Description is required"),
    check("startingPrice")
      .isNumeric()
      .withMessage("Starting price must be a number"),
    check("auctionDuration")
      .isNumeric()
      .withMessage("Auction duration must be a number"),
    check("category").notEmpty().withMessage("Category is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { title, description, startingPrice, auctionDuration, category } =
        req.body;

      const newItem = new Item({
        title,
        description,
        startingPrice,
        auctionDuration,
        category,
        sellerId: req.user.id,
      });
      await newItem.save();
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating item:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

app.put("/api/items/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // current user is seller?
    if (item.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const {
      title,
      description,
      images,
      startingPrice,
      auctionDuration,
      category,
    } = req.body;

    item.title = title || item.title;
    item.description = description || item.description;
    item.images = images || item.images;
    item.startingPrice = startingPrice || item.startingPrice;
    item.auctionDuration = auctionDuration || item.auctionDuration;
    item.category = category || item.category;

    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/items/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // current user is seller?
    if (item.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await item.remove();
    res.json({ message: "Item removed" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auctions", authMiddleware, async (req, res) => {
  try {
    const { item, startTime, endTime } = req.body;

    const auction = new Auction({
      item,
      startTime,
      endTime,
      status: "Ongoing",
    });

    await auction.save();
    res.status(201).json(auction);
  } catch (error) {
    console.error("Error starting auction:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/auctions/:id/end", authMiddleware, async (req, res) => {
  try {
    const auctionId = req.params.id;
    const auction = await Auction.findById(auctionId);
    console.log("auction", auction);
    console.log("auctionId", auctionId);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    auction.status = "Completed";
    await auction.save();

    res.status(200).json({ message: "Auction ended successfully", auction });
  } catch (error) {
    console.error("Error ending auction:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auctions/:id/bid", authMiddleware, async (req, res) => {
  try {
    const auctionId = req.params.id;
    const { bidAmount } = req.body;

    const auction = await Auction.findById(auctionId).populate("item");

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.status !== "Ongoing") {
      return res.status(400).json({ message: "Auction is not ongoing" });
    }

    if (bidAmount <= auction.currentBid) {
      return res
        .status(400)
        .json({ message: "Bid amount must be higher than the current bid" });
    }

    auction.currentBid = bidAmount;
    auction.currentBidder = req.user._id;
    auction.bids.push({ bidder: req.user._id, amount: bidAmount });

    await auction.save();

    res.status(200).json(auction);
  } catch (error) {
    console.error("Error placing bid:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const sendEmailNotification = async (recipientEmail, subject, text) => {
  try {
    await transporter.sendMail({
      from: '"Auction Platform" newlamjingbayumnam1@gmail.com',
      to: recipientEmail,
      subject: subject,
      text: text,
    });
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

app.post("/api/feedback", authMiddleware, async (req, res) => {
  try {
    const { item, sellerId, rating, comment } = req.body;
    console.log("Feedback data:", { item, sellerId, rating, comment });
    // feedback valid?
    const feedback = new Feedback({
      item,
      sellerId,
      buyerId: req.user._id,
      rating,
      comment,
    });

    await feedback.save();
    console.log("Feedback saved:", feedback);

    // seller's email from database
    const seller = await User.findById(sellerId);
    console.log("Seller found:", seller);

    if (seller) {
      const subject = "You've Received New Feedback!";
      const text = `Hello ${seller.name},\n\nYou have received new feedback with a rating of ${rating}.\n\nComment: ${comment}\n\nBest regards,\nAuction Platform Team`;

      await sendEmailNotification(seller.email, subject, text);
      console.log("Email sent to:", seller.email);
    }

    res.status(201).json(feedback);
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/feedback/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const feedbacks = await Feedback.find({ sellerId: userId });

    if (!feedbacks) {
      return res
        .status(404)
        .json({ message: "No feedback found for this user" });
    }

    res.status(200).json(feedbacks);
  } catch (error) {
    console.error("Error retrieving feedback:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const calculateAverageRating = async (userId) => {
  const feedbacks = await Feedback.find({ sellerId: userId });

  if (feedbacks.length === 0) return 0;

  const totalRating = feedbacks.reduce(
    (sum, feedback) => sum + feedback.rating,
    0
  );
  return totalRating / feedbacks.length;
};

app.get("/api/feedback/:userId/average-rating", async (req, res) => {
  try {
    const userId = req.params.userId;
    const averageRating = await calculateAverageRating(userId);

    res.status(200).json({ userId, averageRating });
  } catch (error) {
    console.error("Error calculating average rating:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
