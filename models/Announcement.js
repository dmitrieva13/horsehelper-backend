let mongoose = require("mongoose")

let announcement = new mongoose.Schema({
    id: String,
    date: Date,
    title: String,
    body: String
})

module.exports = mongoose.model("Announcement", announcement, "Announcement")