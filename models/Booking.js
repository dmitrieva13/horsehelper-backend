let mongoose = require("mongoose")

let booking = new mongoose.Schema({
    studentId: Number,
    studentName: String,
    studentPhone: String,
    trainerId: Number,
    trainerName: String,
    trainerPhone: String,
    trainerPhoto: String,
    horseId: String,
    horseName: String,
    horsePhoto: String,
    date: Date,
    type: String,
    comment: String,
    durationMinutes: Number,
    isCancelled: Boolean,
    createdDate: Date
})

module.exports = mongoose.model("Booking", booking, "Booking")