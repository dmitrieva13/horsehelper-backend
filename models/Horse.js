let mongoose = require("mongoose")

let horse = new mongoose.Schema({
    id: String,
    name: String,
    photo: String,
    description: String,
    types: [String]
})

module.exports = mongoose.model("Horse", horse, "Horse")