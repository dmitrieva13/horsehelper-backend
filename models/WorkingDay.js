let mongoose = require("mongoose")

let workingDay = new mongoose.Schema({
    date: Date,
    trainerId: Number,
    type: String
})

module.exports = mongoose.model("WorkingDay", workingDay, "WorkingDay")