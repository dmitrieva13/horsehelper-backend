let mongoose = require("mongoose")

let horseUnavailable = new mongoose.Schema({
    id: String,
    date: Date
})

module.exports = mongoose.model("HorseUnavailable", horseUnavailable, "HorseUnavailable")