const mongoose = require("mongoose");

const AuctionSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  currentBid: { type: Number, default: 0 },
  currentBidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: {
    type: String,
    enum: ["Pending", "Ongoing", "Completed"],
    default: "Pending",
  },
  bids: [
    {
      bidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      amount: { type: Number, required: true },
      time: { type: Date, default: Date.now },
    },
  ],
});

const Auction = mongoose.model("Auction", AuctionSchema);

module.exports = Auction;
