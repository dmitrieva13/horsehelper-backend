let mongoose = require("mongoose")

let booking = new mongoose.Schema({
    studentId: Number,
    trainerId: Number,
    horseId: String,
    date: Date,
    type: String,
    comment: String,
    durationMinutes: Number,
    isCancelled: { type: Boolean, default: false },
    createdDate: Date
})

module.exports = mongoose.model("Booking", booking, "Booking")