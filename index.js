const   cors        = require("cors"),
        dotenv      = require('dotenv'),
        bcrypt      = require('bcrypt'),
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

dotenv.config();

mongoose.connect("mongodb://localhost:27017")
const User = require("./models/User.js")
const Horse = require("./models/Horse.js")
const HorseUnavailable = require("./models/HorseUnavailable")
const Announcement = require("./models/Announcement")
const WorkingDay = require("./models/WorkingDay")
const Booking = require("./models/Booking.js");
const TrainerNotification = require("./models/TrainerNotification.js");
const StudentsList = require("./models/StudentsList.js");

// Middleware
const auth = require("./middleware/auth");

const cyrillicToTranslit = new ctt();

let cryptPassword = function(password, callback) {
    bcrypt.genSalt(10, function(err, salt) {
        if (err) 
            return callback(err)
    
        bcrypt.hash(password, salt, function(err, hash) {
            return callback(err, hash)
        })
    })
}

let comparePassword = function(plainPass, hashword, callback) {
    bcrypt.compare(plainPass, hashword, function(err, isPasswordMatch) {
        return err == null ?
            callback(null, isPasswordMatch) :
            callback(err);
    });
};


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

app.post("/register", (req, res) => {

    if (!req.body.phone || !req.body.password || req.body.phone.length != 12
            || req.body.password.length < 4 || req.body.password.length > 30) {
        return res.status(401).json({ message: "wrong credentials" })
    }

    User.findOne({
        phone: req.body.phone
    }).then((data) => {
        if (data) { return res.status(401).json({ message: "user is already registered" }) }
        else {

            let role = "student"
            if (req.body.phone == "+70000000000" ) {
                role = "admin"
            }

            let newId = Math.floor(Math.random() * 9000000) + 1000000
            const accessToken = jwt.sign({  id: newId, phone: req.body.phone, role, name: req.body.name },
                process.env.TOKEN_STRING || "secret string", {expiresIn: '2h'}
            );
            const refreshToken = jwt.sign({  id: newId, phone: req.body.phone, role, name: req.body.name }, 
                process.env.TOKEN_STRING || "secret string", { expiresIn: '100d' }
            );

            let password
            cryptPassword(req.body.password, (err, hash) => {
                password = hash

                const user = new User({
                    phone: req.body.phone, password, id: newId, role, name: req.body.name
                })
                user.save().then(user => {
                    console.log('User added!')
                    console.log(user)
                    res.status(200).json({
                        message: "New User added!",
                        accessToken,
                        refreshToken
                    })
                })
            })

            
        }
    })
})

app.post("/login", (req, res) => {
    User.findOne({
        phone: req.body.phone
    }).then((data) => {
        if (!data) { res.sendStatus(404) }
        else {
            comparePassword(req.body.password, data.password, (err, passed) => {
                if (!passed || err) {
                    return res.status(401).json({ message: "wrong password" })
                }

                const accessToken = jwt.sign(
                    { id: data.id, phone: data.phone, role: data.role, name: data.name,
                        trainerType: data.trainerType },
                        process.env.TOKEN_STRING || "secret string", {expiresIn: '2h'}
                );
            
                const refreshToken = jwt.sign(
                    { id: data.id, phone: data.phone, role: data.role, name: data.name,
                        trainerType: data.trainerType }, 
                        process.env.TOKEN_STRING || "secret string", { expiresIn: '100d' }
                );
            
                res.status(200).json({
                    message: "User logged in",
                    accessToken,
                    refreshToken
                })
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

            let password
            cryptPassword(req.body.password, (err, hash) => {
                password = hash
                const user = new User({
                    phone: req.body.phone, password: password, id: newId, role: "trainer",
                    name: req.body.name, trainerPhoto: req.body.trainerPhoto,
                    trainerDescription: req.body.trainerDescription, trainerType: req.body.trainerType
                })
                user.save().then(() => console.log('Trainer added!'))

                const studentsList = new StudentsList({
                    trainerId: newId, students: []
                })
                studentsList.save().then(() => console.log("Students list created!"))
            
                res.status(200).json({
                    message: "New trainer added",
                    phone: req.body.phone,
                    accessToken,
                    refreshToken
                })
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

    let date = new Date(req.body.date)
    if (date.toString() == "Invalid Date") {
        return res.status(401).json({ message: "date is wrong" })
    }
    
    Horse.findOne({
        id: req.body.id
    }).then((data) => {
        if (!data) { return res.status(401).json({ message: "no horse with such id" }) }
        else {
            console.log("fired")
            const horseUnavailable = new HorseUnavailable({
                id: req.body.id, date: date
            })
            horseUnavailable.save().then(() => {
                let start = new Date(date)
                start.setHours(0,0,0,0)

                let end = new Date(date)
                end.setHours(23,59,99,99)

                console.log(start, end)

                Booking.find({
                    horseId: req.body.id,
                    date: {$gte: start, $lt: end},
                    isCancelled: false
                }).then((bookings) => {
                    console.log(bookings)
                    bookings.forEach((book) => {
                        const notification = new TrainerNotification({
                            bookingId: book._id,
                            type: "canceled",
                            trainerId: book.trainerId,
                            dateCreated: new Date()
                        })
                        notification.save()
                        console.log(notification)
                    })
                    
                    Booking.updateMany({
                        horseId: req.body.id,
                        date: {$gte: start, $lt: end},
                        isCancelled: false
                    },
                    {
                        $set: {
                            isCancelled: true
                        }
                    }).then(() => {
                        res.status(200).json({
                            id: req.body.id,
                            date: date,
                            accessToken,
                            refreshToken
                        })
                    })
                })
            })
        }
    })
})

app.post("/make_horse_available", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    let date = new Date(req.body.date)
    if (date.toString() == "Invalid Date") {
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
    
    if (!req.body.title || req.body.title == "") {
        return res.status(401).json({ error: "empty title" })
    }
            
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

    
    let date = new Date(req.body.date)
    if (date.toString() == "Invalid Date") {
        return res.status(401).json({ message: "date is wrong" })
    }

    WorkingDay.findOne({
        trainerId: req.user.id, date
    }).then((data) => {
        if (data) { return res.status(401).json({ message: "working day is already added" }) }

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
})


app.post("/undo_working_day", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    let date = new Date(req.body.date)
    if (date.toString() == "Invalid Date") {
        return res.status(401).json({ message: "date is wrong" })
    }
    
    WorkingDay.deleteOne({
        trainerId: req.user.id, date
    }).then((data) => {
        if (data.deletedCount == 0) {
            return res.status(401).json({ message: "no such entry" })
        }

        console.log("result")
        let start = new Date(date)
        start.setHours(0,0,0,0)

        let end = new Date(date)
        end.setHours(23,59,99,99)

        console.log(start, end)

        Booking.find({
            trainerId: req.user.id,
            date: {$gte: start, $lt: end},
            isCancelled: false
        }).then((bookings) => {
            console.log(bookings)
            bookings.forEach((book) => {
                const notification = new TrainerNotification({
                    bookingId: book._id,
                    type: "canceled",
                    trainerId: book.trainerId,
                    dateCreated: new Date()
                })
                notification.save()
                console.log(notification)
            })
            
            Booking.updateMany({
                trainerId: req.user.id,
                date: {$gte: start, $lt: end},
                isCancelled: false
            },
            {
                $set: {
                    isCancelled: true
                }
            }).then(() => {
                res.status(200).json({
                    message: "Working day was removed.",
                    accessToken,
                    refreshToken
                })
            })
        })
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
    
    let date = new Date(req.body.date)
    if (date.toString() == "Invalid Date") {
        return res.status(401).json({ message: "date is wrong" })
    }

    let durationMinutes = durations.find(d => d.type == req.body.type).minutes

    const booking = new Booking({
        studentId: req.user.id, trainerId: req.body.trainerId, horseId: req.body.horseId,
        date, type: req.body.type, comment: req.body.comment, durationMinutes,
        isCancelled: false, createdDate: new Date()
    })
    booking.save().then(book => {
        console.log("New booking added!")

        const notification = new TrainerNotification({
            bookingId: book._id,
            type: "new",
            trainerId: req.body.trainerId,
            dateCreated: new Date()
        })
        notification.save().then(() => {

            res.status(200).json({
                message: "Booking is added",
                date: date,
                accessToken,
                refreshToken
            })
        })
    })
})

app.post("/get_current_bookings_student", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    let start = new Date()
    start.setHours(0,0,0,0)

    Booking.find({
        studentId: req.user.id,
        date: {$gte: start},
        isCancelled: false
    }).then(bookings => {

        var result = []

        User.find({
            role: "trainer"
        }).then(trainers => {
            Horse.find().then(horses => {

                bookings.forEach((booking) => {
                    let bookingComplete = booking._doc

                    let trainerI = trainers.findIndex(t => t.id == booking.trainerId)
                    let trainer
                    if (trainerI > -1) {
                        trainer = trainers[trainerI]
                        bookingComplete.trainerName = trainer.name
                        bookingComplete.trainerPhone = trainer.phone
                        bookingComplete.trainerPhoto = trainer.trainerPhoto
                        bookingComplete.trainerType = trainer.trainerType
                        bookingComplete.trainerDescription = trainer.trainerDescription
                    }

                    let horseI = horses.findIndex(h => h.id == booking.horseId)
                    let horse
                    if (horseI > -1) {
                        horse = horses[horseI]
                        bookingComplete.horseName = horse.name
                        bookingComplete.horsePhoto = horse.photo
                        bookingComplete.horseTypes = horse.types
                        bookingComplete.horseDescription = horse.description
                    }
                    result.push(bookingComplete)
                })

                res.status(200).json({
                    bookings: result,
                    accessToken,
                    refreshToken
                })
            })
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

    Booking.find({$or: [{studentId: req.user.id, date: {$lt: start}},
        {studentId: req.user.id, isCancelled: true}
    ]}).then(bookings => {

        var result = []

        User.find({
            role: "trainer"
        }).then(trainers => {
            Horse.find().then(horses => {

                bookings.forEach((booking) => {
                    let bookingComplete = booking._doc

                    let trainerI = trainers.findIndex(t => t.id == booking.trainerId)
                    let trainer
                    if (trainerI > -1) {
                        trainer = trainers[trainerI]
                        bookingComplete.trainerName = trainer.name
                        bookingComplete.trainerPhone = trainer.phone
                        bookingComplete.trainerPhoto = trainer.trainerPhoto
                    }

                    let horseI = horses.findIndex(h => h.id == booking.horseId)
                    let horse
                    if (horseI > -1) {
                        horse = horses[horseI]
                        bookingComplete.horseName = horse.name
                        bookingComplete.horsePhoto = horse.photo
                    }
                    result.push(bookingComplete)
                })

                res.status(200).json({
                    bookings: result,
                    accessToken,
                    refreshToken
                })
            })
        })
    })
})


app.post("/get_current_bookings_trainer", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    let start = new Date()
    start.setHours(0,0,0,0)

    Booking.find({
        trainerId: req.user.id,
        date: {$gte: start},
        isCancelled: false
    }).then(bookings => {
        var result = []

        User.find({
            role: "student"
        }).then(students => {
            Horse.find().then(horses => {
                bookings.forEach((booking) => {
                    let bookingComplete = booking._doc

                    let studentI = students.findIndex(s => s.id == booking.studentId)
                    let student
                    if (studentI > -1) {
                        student = students[studentI]
                        bookingComplete.name = student.name
                        bookingComplete.phone = student.phone
                        bookingComplete.userPic = student.userPic
                    }

                    let horseI = horses.findIndex(h => h.id == booking.horseId)
                    let horse
                    if (horseI > -1) {
                        horse = horses[horseI]
                        bookingComplete.horseName = horse.name
                        bookingComplete.horsePhoto = horse.photo
                    }
                    result.push(bookingComplete)
                })

                res.status(200).json({
                    bookings: result,
                    accessToken,
                    refreshToken
                })
            })
        })
    })
})

app.post("/get_archived_bookings_trainer", auth, (req, res) => {

    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    let start = new Date()
    start.setHours(0,0,0,0)

    Booking.find({$or: [{isCancelled: true, trainerId: req.user.id},
            {trainerId: req.user.id, date: {$lt: start}}
        ]}).then(bookings => {
        var result = []

        User.find({
            role: "student"
        }).then(students => {
            Horse.find().then(horses => {
                bookings.forEach((booking) => {
                    let bookingComplete = booking._doc

                    let studentI = students.findIndex(s => s.id == booking.studentId)
                    let student
                    if (studentI > -1) {
                        student = students[studentI]
                        bookingComplete.name = student.name
                        bookingComplete.phone = student.phone
                        bookingComplete.userPic = student.userPic
                    }

                    let horseI = horses.findIndex(h => h.id == booking.horseId)
                    let horse
                    if (horseI > -1) {
                        horse = horses[horseI]
                        bookingComplete.horseName = horse.name
                        bookingComplete.horsePhoto = horse.photo
                    }
                    result.push(bookingComplete)
                })

                res.status(200).json({
                    bookings: result,
                    accessToken,
                    refreshToken
                })
            })
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
    end.setHours(23,59,99,99)

    Booking.find({
        trainerId: req.user.id,
        date: {$gte: start, $lt: end},
        isCancelled: false
    }).then(bookings => {
        var result = []

        User.find({
            role: "student"
        }).then(students => {
            Horse.find().then(horses => {
                bookings.forEach((booking) => {
                    let bookingComplete = booking._doc

                    let studentI = students.findIndex(s => s.id == booking.studentId)
                    let student
                    if (studentI > -1) {
                        student = students[studentI]
                        bookingComplete.name = student.name
                        bookingComplete.phone = student.phone
                        bookingComplete.userPic = student.userPic
                    }

                    let horseI = horses.findIndex(h => h.id == booking.horseId)
                    let horse
                    if (horseI > -1) {
                        horse = horses[horseI]
                        bookingComplete.horseName = horse.name
                        bookingComplete.horsePhoto = horse.photo
                    }
                    result.push(bookingComplete)
                })

                res.status(200).json({
                    bookings: result,
                    accessToken,
                    refreshToken
                })
            })
        })
    })
})


app.post("/get_bookings_by_horse", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    let start = new Date()
    start.setHours(0,0,0,0)

    Booking.find({
        horseId: req.body.id,
        date: {$gte: start},
        isCancelled: false
    }).then((bookings) => {
        var result = []
        
        User.find({
            role: "student"
        }).then((students) => {
            User.find({
                role: "trainer"
            }).then((trainers) => {
                bookings.forEach((booking) => {
                    let bookingComplete = booking._doc

                    let studentI = students.findIndex(s => s.id == booking.studentId)
                    let student
                    if (studentI > -1) {
                        student = students[studentI]
                        bookingComplete.name = student.name
                        bookingComplete.phone = student.phone
                        bookingComplete.userPic = student.userPic
                    }

                    let trainerI = trainers.findIndex(t => t.id == booking.trainerId)
                    let trainer
                    if (trainerI > -1) {
                        trainer = trainers[trainerI]
                        bookingComplete.trainerName = trainer.name
                        bookingComplete.trainerPhone = trainer.phone
                        bookingComplete.trainerPhoto = trainer.trainerPhoto
                    }
                    console.log(bookingComplete)
                    result.push(bookingComplete)
                })

                res.status(200).json({
                    bookings: result,
                    accessToken,
                    refreshToken
                })
            })
        })
    })
})

app.post("/get_all_bookings", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    let start = new Date()
    start.setHours(0,0,0,0)

    Booking.find({
        date: {$gte: start},
        isCancelled: false
    }).then((bookings) => {
        var result = []
        
        User.find({
            role: "student"
        }).then((students) => {
            User.find({
                role: "trainer"
            }).then((trainers) => {
                Horse.find({}).then(horses => {
                    bookings.forEach((booking) => {
                        let bookingComplete = booking._doc

                        let studentI = students.findIndex(s => s.id == booking.studentId)
                        let student
                        if (studentI > -1) {
                            student = students[studentI]
                            bookingComplete.name = student.name
                            bookingComplete.phone = student.phone
                            bookingComplete.userPic = student.userPic
                            bookingComplete.studentId = student.id
                        }

                        let trainerI = trainers.findIndex(t => t.id == booking.trainerId)
                        let trainer
                        if (trainerI > -1) {
                            trainer = trainers[trainerI]
                            bookingComplete.trainerName = trainer.name
                            bookingComplete.trainerPhone = trainer.phone
                            bookingComplete.trainerPhoto = trainer.trainerPhoto
                            bookingComplete.trainerId = trainer.id
                        }

                        let horseI = horses.findIndex(h => h.id == booking.horseId)
                        let horse
                        if (horseI > -1) {
                            horse = horses[horseI]
                            bookingComplete.horseId = horse.id
                            bookingComplete.horseName = horse.name
                            bookingComplete.horsePhoto = horse.photo
                        }

                        console.log(bookingComplete)
                        result.push(bookingComplete)
                    })
                    
                    res.status(200).json({
                        bookings: result,
                        accessToken,
                        refreshToken
                    })
                })
            })
        })
    })
})


app.post("/cancel_booking", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user
    
    let date = new Date(req.body.date)
    if (date.toString() == "Invalid Date") {
        return res.status(401).json({ message: "date is wrong" })
    }

    let book
    
    Booking.findOneAndUpdate({
        studentId: req.user.id,
        trainerId: req.body.trainerId,
        horseId: req.body.horseId,
        date,
        isCancelled: false
    },
    {
        $set: {
            isCancelled: true
        }
    },
    {
        lean: true
    }).then((data) => {
        if (!data || data == null) {
            return res.status(401).json({ message: "no such entry" }) 
        }
        book = data

        const notification = new TrainerNotification({
            bookingId: book._id,
            type: "canceled",
            trainerId: req.body.trainerId,
            dateCreated: new Date()
        })
        notification.save().then(() => {
        
            res.status(200).json({
                message: "Booking was canceled",
                accessToken,
                refreshToken
            })
        })
    })
})


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
    }).lean()
    .then(workingDays => {
        
        User.find({
            role: "trainer"
        }).lean().then(trainers => {


            let daysAndTrainers = []

            workingDays.forEach(day => {

                const trainerI = trainers.findIndex(e => e.id == day.trainerId)
                if (trainerI == -1) return

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


app.post("/trainer_notifications", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    let monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    TrainerNotification.find({
        trainerId: req.user.id,
        isRead: false
    }).then(notifications => {
        Booking.find({
            trainerId: req.user.id,
            createdDate: {$gte: monthAgo}
        }).then(bookings => {
            var result = []

            notifications.forEach((n, i) => {
                let notificationComplete = n._doc

                console.log(bookings)
                let bookingIndex = bookings.findIndex(e => e._id == n.bookingId)
                
                if(bookingIndex > -1) {
                    notificationComplete.booking = bookings[bookingIndex]
                    console.log("found")
                }
                result.push(notificationComplete)
            })

            console.log(result)

            res.status(200).json({
                notifications: result,
                accessToken,
                refreshToken
            })
        })
    })
})

app.post("/read_trainer_notifications", auth, (req, res) => {
    if (req.user.role != "trainer") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    TrainerNotification.updateMany({
        trainerId: req.user.id,
        isRead: false
    },
    {
        $set: {
            isRead: true
        }
    }).then(() => {
            res.status(200).json({
                message: "Trainer notifications are read",
                accessToken,
                refreshToken
            })
    })
})

app.post("/student_notifications", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    
    let start = new Date()

    let end = new Date()
    end.setHours(end.getHours() + 24)

    Booking.find({
        studentId: req.user.id,
        date: {$gte: start, $lt: end},
        isCancelled: false
    }).then((bookings) => {
        res.status(200).json({
            notifications: bookings,
            accessToken,
            refreshToken
        })
    })
})

app.post("/get_students_list", (req, res) => {
    StudentsList.findOne({
        trainerId: req.body.trainerId
    }).then(studentList => {
        
        User.find({
            role: "student"
        }).then(students => {
            
            let result = []
            if (studentList) {
                studentList.students.forEach(student => {
                    studentComplete = {
                        studentId: student
                    }

                    let studentI = students.findIndex(s => s.id == student)
                    if (studentI > -1) {
                        studentComplete.name = students[studentI].name
                        studentComplete.userPic = students[studentI].userPic
                    }

                    result.push(studentComplete)
                })
            }

            res.status(200).json({
                studentsList: result
            })
        })
    })
})

app.post("/add_student_list", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    StudentsList.findOne({
        trainerId: req.body.trainerId
    }).then(studentList => {
        if (studentList.students.findIndex((el) => el == req.user.id) > -1) {
            return res.status(401).json({ error: "student is already added" })
        }

        StudentsList.findOneAndUpdate({
            trainerId: req.body.trainerId
        },
        { $push: {students: req.user.id},
        },
        {new: true
        }).then(studentsList => {
            res.status(200).json({
                studentsList: studentsList,
                accessToken,
                refreshToken
            })
        })
    })
})

app.post("/delete_student_list", auth, (req, res) => {
    if (req.user.role != "student") {
        return res.status(401).json({ error: "not permitted" })
    }
    let { accessToken, refreshToken } = req.user

    StudentsList.findOneAndUpdate({
        trainerId: req.body.trainerId
    },
    { $pull: {students: req.user.id}
    },
    {new: true
    }).then(studentsList => {
        res.status(200).json({
            studentsList: studentsList,
            accessToken,
            refreshToken
        })
    })
})

app.listen(3001)