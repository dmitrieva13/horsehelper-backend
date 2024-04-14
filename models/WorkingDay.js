let mongoose = require("mongoose")

let workingDay = new mongoose.Schema({
    date: Date,
    trainerId: Number
})

module.exports = mongoose.model("WorkingDay", workingDay, "WorkingDay")