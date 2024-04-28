let mongoose = require("mongoose")

let user = new mongoose.Schema({
    id: Number,
    role: String,
    phone: String,
    password: String,
    name: String,
    userPic: String,
    userDescription: String,
    trainerPhoto: String,
    trainerDescription: String,
    trainerType: String
})

module.exports = mongoose.model("User", user, "User")