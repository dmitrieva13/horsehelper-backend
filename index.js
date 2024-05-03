const   cors        = require("cors"),
        express     = require("express"),
        mongoose    = require("mongoose"),
        bodyParser  = require("body-parser"),
        jwt         = require("jsonwebtoken")
        ctt         = require("cyrillic-to-translit-js");
        

const app = express()

app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

var corsOptions = { origin: '*', optionsSuccessStatus: 200 }
app.use(cors(corsOptions));  

mongoose.connect("mongodb+srv://michaelismur:iND7HQhat01Qtwbp@horsehelper.g1dwcs9.mongodb.net/")
const User = require("./models/User.js")
const Horse = require("./models/Horse.js")
const HorseUnavailable = require("./models/HorseUnavailable")
const Announcement = require("./models/Announcement")
const WorkingDay = require("./models/WorkingDay")
const Booking = require("./models/Booking.js");

// Middleware
const auth = require("./middleware/auth");

const cyrillicToTranslit = new ctt();


const durations = [{
    type: "Общая",
    minutes: 60
}, {
    type: "Выездка",
    minutes: 60
}, {
    type: "Конкур",
    minutes: 60
}]

app.get("/", (req, res) => {
    res.send("Get / ")
})

app.post("/register", (req, res) => {

    if (!req.body.phone || !req.body.password || req.body.phone.length != 12
            || req.body.password.length < 4 || req.body.password.length > 30) {
        return res.status(401).json({ message: "wrong credentials" })
    }

    User.findOne({
        phone: req.body.phone
    }).then((data) => {
        // phone is already registered
        if (data) { return res.status(401).json({ message: "user is already registered" }) }
        else {

            let role = "student"
            if (req.body.phone == "+70000000000" ) {
                role = "admin"
            }

            let newId = Math.floor(Math.random() * 9000000) + 1000000
            const accessToken = jwt.sign({  id: newId, phone: req.body.phone, role, name: req.body.name },
                "secret string", {expiresIn: "2h"}
            );
            const refreshToken = jwt.sign({  id: newId, phone: req.body.phone, role, name: req.body.name }, 
                "secret string", { expiresIn: '100d' }
            );

            const user = new User({
                phone: req.body.phone, password: req.body.password, id: newId, role, name: req.body.name
            })
            user.save().then(() => console.log('User added!'))
          
            res.status(200).json({
                message: "New User added!",
                accessToken,
                refreshToken
            })
        }
    })
})

app.post("/login", (req, res) => {
    User.findOne({
        phone: req.body.phone
    }).then((data) => {
        console.log(data)
        // No user found
        if (!data) { res.sendStatus(404) }
        else {
            if (req.body.password != data.password) {
                return res.status(401).json({ message: "wrong password" })
            }

            const accessToken = jwt.sign(
                { id: data.id, phone: data.phone, role: data.role, name: data.name,
                    trainerType: data.trainerType },
                "secret string", {expiresIn: "2h"}
            );
          
            const refreshToken = jwt.sign(
                { id: data.id, phone: data.phone, role: data.role, name: data.name,
                    trainerType: data.trainerType }, 
                "secret string", { expiresIn: '100d' }
            );
          
            res.status(200).json({
                message: "User logged in",
                accessToken,
                refreshToken
            })
        }
    })
})

app.post("/register_trainer", auth, (req, res) => {

    if (!req.body.phone || !req.body.password || req.body.phone.length != 12
            || req.body.password.length < 4 || req.body.password.length > 30) {
        return res.status(401).json({ message: "wrong credentials" })
    }

    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }

    let { accessToken, refreshToken } = req.user
    User.findOne({
        phone: req.body.phone
    }).then((data) => {
        // No user found
        if (data) { return res.status(401).json({ message: "user is already registered" }) }
        else {

            let newId = Math.floor(Math.random() * 9000000) + 1000000
            const user = new User({
                phone: req.body.phone, password: req.body.password, id: newId, role: "trainer",
                name: req.body.name, trainerPhoto: req.body.trainerPhoto,
                trainerDescription: req.body.trainerDescription, trainerType: req.body.trainerType
            })
            user.save().then(() => console.log('Trainer added!'))
          
            res.status(200).json({
                message: "New trainer added",
                phone: req.body.phone,
                accessToken,
                refreshToken
            })
        }
    })
})

app.post("/add_horse", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }

    let { accessToken, refreshToken } = req.user
    
    let newId = cyrillicToTranslit.transform(req.body.name, '-').toLowerCase()
    const horse = new Horse({
        id: newId, name: req.body.name, photo: req.body.photo, description: req.body.description,
        types: req.body.types
    })
    horse.save().then(() => console.log('Horse added!'))
  
    res.status(200).json({
        message: "New horse added",
        id: newId,
        accessToken,
        refreshToken
    })

})

app.post("/get_horse", (req, res) => {

    let { accessToken, refreshToken } = req.user
    
    Horse.findOne({
        id: req.body.id
    }).then((data) => {
        if (!data) { return res.status(401).json({ message: "no horse with such id" }) }
        else {
            res.status(200).json({
                name: data.name,
                photo: data.photo,
                description: data.description,
                types: data.types,
                accessToken,
                refreshToken
            })
        }
    })
})

app.post("/all_horses", (req, res) => {
    Horse.find({
    }).then((data) => {
        res.status(200).json({
            horses: data
        })
    })
})

app.post("/make_horse_unavailable", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    Horse.findOne({
        id: req.body.id
    }).then((data) => {
        if (!data) { return res.status(401).json({ message: "no horse with such id" }) }
        else {
            
            let date = new Date(req.body.date)
            const horseUnavailable = new HorseUnavailable({
                id: req.body.id, date: date
            })
            horseUnavailable.save().then(() => console.log('Unavailable entry added!'))

            res.status(200).json({
                id: req.body.id,
                date: date,
                accessToken,
                refreshToken
            })
        }
    })
})

app.post("/make_horse_available", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    let date
    try {
        date = new Date(req.body.date)
    }
    catch(e){
        return res.status(401).json({ message: "date is wrong" })
    }
    
    HorseUnavailable.deleteOne({
        id: req.body.id, date
    }).then((data) => {
        console.log(data)
        if (data.deletedCount == 0) { return res.status(401).json({ message: "no such entry" }) }
        else {
            res.status(200).json({
                message: "Entry was removed",
                accessToken,
                refreshToken
            })
        }
    })
})

app.post("/get_unavailable_days", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    HorseUnavailable.find({
        id: req.body.id
    }).then((data) => {
        res.status(200).json({
            unavailableDays: data,
            accessToken,
            refreshToken
        })
    })
})



app.post("/new_announcement", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
            
    let date = new Date()
    let id = cyrillicToTranslit.transform(req.body.title, '-').toLowerCase()

    const announcement = new Announcement({
        id, date: date, title: req.body.title, body: req.body.body
    })
    announcement.save().then(() => console.log('New announcement added!'))

    res.status(200).json({
        id,
        accessToken,
        refreshToken
    })
})

app.post("/announcements", (req, res) => {
    Announcement.find({}).then((data) => {
        res.status(200).json({
            announcements: data
        })
    })
})



app.post("/set_working_day", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    
    let date
    try {
        date = new Date(req.body.date)
    }
    catch(e){
        return res.status(401).json({ message: "date is wrong" })
    }

    const workingDay = new WorkingDay({
        trainerId: req.user.id, date, type: req.user.trainerType
    })
    workingDay.save().then(() => console.log('New working day added!'))

    res.status(200).json({
        message: "Working day is added",
        date: date,
        accessToken,
        refreshToken
    })
})


app.post("/undo_working_day", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    let date
    try {
        date = new Date(req.body.date)
    }
    catch(e){
        return res.status(401).json({ message: "date is wrong" })
    }
    
    WorkingDay.deleteOne({
        trainerId: req.user.id, date
    }).then((data) => {
        console.log(data)
        if (data.deletedCount == 0) { return res.status(401).json({ message: "no such entry" }) }
        else {
            res.status(200).json({
                message: "Working day was removed",
                accessToken,
                refreshToken
            })
        }
    })
})

app.post("/get_working_days", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    WorkingDay.find({
        trainerId: req.user.id
    }).then((data) => {
        res.status(200).json({
            workingDays: data,
            accessToken,
            refreshToken
        })
    })
})

app.post("/all_trainers", (req, res) => {
    User.find({
        role: "trainer"
    }).then((data) => {
        res.status(200).json({
            trainers: data
        })
    })
})

app.post("/get_profile", (req, res) => {
    User.findOne({
        id: req.body.id
    }).then((data) => {
        if (!data) { return res.status(401).json({ message: "no user with such id" }) }
        else {
            res.status(200).json({
                name: data.name,
                userPic: data.userPic,
                userDescription: data.userDescription,
                role: data.role
            })
        }
    })
})

app.post("/change_profile", auth, (req, res) => {
    if (req.user.id != req.body.id) {
        return res.status(401).json({ error: "not permitted to change other's profile" })
    }

    let { accessToken, refreshToken } = req.user

    User.findOne({
        id: req.body.id
    }).then((data) => {
        if (!data) { return res.status(401).json({ message: "no user with such id" }) }
    else {
        User.updateOne({id: req.body.id},
        {
            $set: {
                userPic: req.body.userPic,
                userDescription: req.body.userDescription
            }
        }).then(() => {
                res.status(200).json({
                    accessToken,
                    refreshToken
                })
            })
        }
    })

})

app.post("/new_booking", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    let date
    try {
        date = new Date(req.body.date)
    }
    catch(e){
        return res.status(401).json({ message: "date is wrong" })
    }

    let durationMinutes = durations.find(d => d.type == req.body.type).minutes

    const booking = new Booking({
        studentId: req.user.id, trainerId: req.body.trainerId, horseId: req.body.horseId,
        date, type: req.body.type, comment: req.body.comment, durationMinutes,
        isCancelled: false, createdDate: new Date()
    })
    booking.save().then(() => console.log('New booking added!'))

    res.status(200).json({
        message: "Booking is added",
        date: date,
        accessToken,
        refreshToken
    })
})


let studentBookingsComplete = data => {
    let result = []

    data.forEach((el, index) => {

        let doc = el._doc
        User.findOne({
            id: doc.trainerId,
        }).then((trainer) => {
            doc.trainerName = trainer.name
            doc.trainerPhone = trainer.phone
            doc.trainerPhoto = trainer.trainerPhoto

            result.push(doc)
            if (index == data.length - 1) {
                
                result.forEach((el, index) => {
                    Horse.findOne({
                        id: el.horseId,
                    }).then((horse) => {
                        console.log(horse)
                        el.horseName = horse.name
                        el.horsePhoto = horse.photo

                        if (index == result.length - 1) {
                            return result
                        }
                    })
                })
            }
        })
    })
}

app.post("/get_current_bookings_student", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    let start = new Date()
    start.setHours(0,0,0,0)

    Booking.find({
        studentId: req.user.id,
        date: {$gte: start}
    }).then((data) => {
        res.status(200).json({
            bookings: studentBookingsComplete(data),
            accessToken,
            refreshToken
        })
    })
})

app.post("/get_archived_bookings_student", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    let start = new Date()
    start.setHours(0,0,0,0)

    Booking.find({
        studentId: req.user.id,
        date: {$lt: start}
    }).then((data) => {
        res.status(200).json({
            bookings: studentBookingsComplete(result),
            accessToken,
            refreshToken
        })
    })
})


let trainerBookingsComplete = data => {
    let result = []

    data.forEach((el, index) => {

        let doc = el._doc
        User.findOne({
            id: doc.studentId,
        }).then((student) => {
            doc.name = student.name
            doc.phone = student.phone
            doc.userPic = student.userPic

            result.push(doc)
            if (index == data.length - 1) {
                
                result.forEach((el, index) => {
                    Horse.findOne({
                        id: el.horseId,
                    }).then((horse) => {
                        console.log(horse)
                        el.horseName = horse.name
                        el.horsePhoto = horse.photo

                        if (index == result.length - 1) {
                            return result
                        }
                    })
                })
            }
        })
    })
}

app.post("/get_current_bookings_trainer", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    Booking.find({
        trainerId: req.user.id,
        date: {$gte: start}
    }).then((data) => {
        res.status(200).json({
            bookings: trainerBookingsComplete(data),
            accessToken,
            refreshToken
        })
    })
})

app.post("/get_archived_bookings_trainer", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    Booking.find({
        trainerId: req.user.id,
        date: {$lt: start}
    }).then((data) => {
        res.status(200).json({
            bookings: trainerBookingsComplete(data),
            accessToken,
            refreshToken
        })
    })
})


app.post("/today_bookings", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    let start = new Date()
    start.setHours(0,0,0,0)

    let end = new Date()
    end.setHours(23,59,59,999)

    Booking.find({
        trainerId: req.user.id,
        date: {$gte: start, $lt: end}
    }).then((data) => {
        res.status(200).json({
            bookings: trainerBookingsComplete(data),
            accessToken,
            refreshToken
        })
    })
})


let adminBookingsComplete = data => {
    let result = []

    data.forEach((el, index) => {

        let doc = el._doc
        User.findOne({
            id: doc.studentId,
        }).then((student) => {
            console.log(student)
            doc.name = student.name
            doc.phone = student.phone
            doc.userPic = student.userPic

            result.push(doc)
            if (index == data.length - 1) {
                
                result.forEach((el, index) => {
                    User.findOne({
                        id: el.trainerId,
                    }).then((trainer) => {
                        doc.trainerName = trainer.name
                        doc.trainerPhone = trainer.phone
                        doc.trainerPhoto = trainer.trainerPhoto

                        if (index == result.length - 1) {
                            return result
                        }
                    })
                })
            }
        })
    })
}

app.post("/get_bookings_by_horse", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    Booking.find({
        horseId: req.body.id
    }).then((data) => {
        res.status(200).json({
            bookings: adminBookingsComplete(data),
            accessToken,
            refreshToken
        })
    })
})

app.post("/cancel_booking", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    let date
    try {
        date = new Date(req.body.date)
    }
    catch(e){
        return res.status(401).json({ message: "date is wrong" })
    }
    
    Booking.updateOne({
        studentId: req.user.id,
        trainerId: req.body.trainerId,
        horseId: req.body.horseId,
        date
    },
    {
        $set: {
            isCancelled: true
        }
    }).then((data) => {
        console.log(data)
        if (data.deletedCount == 0) { return res.status(401).json({ message: "no such entry" }) }
        else {
            res.status(200).json({
                message: "Booking was cancelled",
                accessToken,
                refreshToken
            })
        }
    })
})


// app.post("/get_slots_for_booking", auth, (req, res) => {
//     if (req.user.role != "student") {
//         return res.status(401).json({ error: "not permitted" })
//     }
//     let { accessToken, refreshToken } = req.user
    
//     let start = new Date()
//     start.setHours(0,0,0,0)

//     WorkingDay.find({
//         type: req.body.type,
//         date: {$gte: start}
//     }).then((workingDays) => {

//         let result = []
//         workingDays.forEach(day => {
            
//             let dayDoc = day._doc
//             getAvailableHorses(dayDoc.date, req.body.type)
//             dayDoc.horses = []

//             result.push(doc)            
//         })
//     })
// })

app.post("/get_slots_for_booking", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    let start = new Date()
    start.setHours(0,0,0,0)

    WorkingDay.find({
            type: req.body.type,
            date: {$gte: start}
        }).lean().then(workingDays => {
            return workingDays
        })
        .then(workingDays => {
            
            User.find({
                role: "trainer"
            }).lean().then(trainers => {


                let daysAndTrainers = []

                workingDays.forEach(day => {

                    const trainerI = trainers.findIndex(e => e.id == day.trainerId)

                    let trainerToAdd = {
                        id: day.trainerId,
                        name: trainers[trainerI].name,
                        photo: trainers[trainerI].trainerPhoto,
                        description: trainers[trainerI].trainerDescription
                    }


                    const i = daysAndTrainers.findIndex(e => e.date.toString() == day.date.toString())
                    if (i > -1) {
                        daysAndTrainers[i].availableTrainers.push(trainerToAdd)
                    } else {
                        daysAndTrainers.push({
                            date: day.date,
                            availableTrainers: [trainerToAdd],
                            availableHorses: [],
                            bookings: [],
                            timeslots: []
                        })
                    }
                })
                return daysAndTrainers
            }).then(daysAndTrainers => {
                Horse.find({
                    types: req.body.type
                }).lean().then((horses) => {
                    return horses
                }).then(horses => {
                    HorseUnavailable.find().lean().then(unav => {

                        daysAndTrainers.forEach((day, index) => {
                    
                            horses.forEach(horse => {
                                let add = true
                                unav.forEach(un => {
                                    if (horse.id == un.id && un.date.toString() == day.date.toString()) {
                                        add = false
                                    }
                                })
                                if (add) {
                                    daysAndTrainers[index].availableHorses.push(horse)
                                }
                            })
    
                        })
                        return daysAndTrainers
                    })
                    .then(daysAndTrainersAndHorses => {

                        Booking.find({
                            type: req.body.type,
                            isCancelled: false,
                            date: {$gte: start}
                        }).then((bookings) => {

                            daysAndTrainersAndHorses.forEach((day, index) => {
                                bookings.forEach(booking => {
                                    if(booking.date.getDate() == day.date.getDate() &&
                                        booking.date.getMonth() == day.date.getMonth() &&
                                        booking.date.getYear() == day.date.getYear()
                                    ) {
                                        daysAndTrainersAndHorses[index].bookings.push(booking)
                                    }
                                })
                            })

                            daysAndTrainersAndHorses.forEach((day, index) => {
                                for (let i = 10; i <= 20; i++) {
                                    let trainersAtSlot = [...day.availableTrainers]
                                    let horsesAtSlot = [...day.availableHorses]

                                    let createdBookingI = day.bookings.findIndex(e => e.date.getUTCHours() + 3 == i)

                                    if (createdBookingI > -1) {
                                        let trainerIndexToDelete = 
                                            trainersAtSlot.findIndex(e => e.id == day.bookings[createdBookingI].trainerId)
                                            
                                        trainersAtSlot.splice(trainerIndexToDelete, 1)

                                        
                                        let horseIndexToDelete = 
                                        horsesAtSlot.findIndex(e => e.id == day.bookings[createdBookingI].horseId)
                                            
                                        horsesAtSlot.splice(horseIndexToDelete, 1)
                                    }

                                    daysAndTrainersAndHorses[index].timeslots.push({
                                        time: i,
                                        isAvailable: trainersAtSlot.length > 0 && horsesAtSlot.length > 0,
                                        trainersAtSlot,
                                        horsesAtSlot
                                    })
                                }
                            })

                            res.status(200).json({
                                message: daysAndTrainersAndHorses,
                                accessToken,
                                refreshToken
                            })
                        })
                    })
                })
            })
    })
})

app.listen(3001)