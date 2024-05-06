let mongoose = require("mongoose")

let studentsList = new mongoose.Schema({
    trainerId: Number,
    students: [String]
})

module.exports = mongoose.model("StudentsList", studentsList, "StudentsList")