let mongoose = require("mongoose")

let trainerNotification = new mongoose.Schema({
    trainerId: Number,
    bookingId: String,
    type: {type: String, enum : ['new','canceled']},
    dateCreated: Date,
    isRead: { type: Boolean, default: false }
})

module.exports = mongoose.model("TrainerNotification", trainerNotification, "TrainerNotification")