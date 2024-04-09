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

// Middleware
const auth = require("./middleware/auth");
const HorseUnavailable = require("./models/HorseUnavailable")

const cyrillicToTranslit = new ctt();


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
                "process.env.TOKEN_KEY", {expiresIn: "2h"}
            );
            const refreshToken = jwt.sign({  id: newId, phone: req.body.phone, role, name: req.body.name }, 
                "process.env.TOKEN_KEY", { expiresIn: '100d' }
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
    console.log(req.body)
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
                { id: data.id, phone: data.phone, role: data.role, name: data.name },
                "process.env.TOKEN_KEY", {expiresIn: "2h"}
            );
          
            const refreshToken = jwt.sign(
                { id: data.id, phone: data.phone, role: data.role, name: data.name }, 
                "process.env.TOKEN_KEY", { expiresIn: '100d' }
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
        return res.status(401).json({ message: "not permitted" })
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
                phone: req.body.phone, password: req.body.password, id: newId, role: "trainer", name: req.body.name
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
        return res.status(401).json({ message: "not permitted" })
    }

    let { accessToken, refreshToken } = req.user
    
    let newId = cyrillicToTranslit.transform(req.body.name, '-').toLowerCase();
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

app.post("/get_horse", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ message: "not permitted" })
    }

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

app.post("/make_horse_unavailable", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ message: "not permitted" })
    }
    
    Horse.findOne({
        id: req.body.id
    }).then((data) => {
        if (!data) { return res.status(401).json({ message: "no horse with such id" }) }
        else {
            
            let date = new Date(req.body.date)
            const horseUnavailable = new HorseUnavailable({
                id: req.body.id, date: date
            })
            horseUnavailable.save().then(() => console.log('Unavilable entry added!'))

            res.status(200).json({
                id: req.body.id,
                date: date,
                accessToken,
                refreshToken
            })
        }
    })
})

app.post("/get_unavailable_days", auth, (req, res) => {
    if (req.user.role != "admin") {
        return res.status(401).json({ message: "not permitted" })
    }
    
    // HorseUnavailable.findOne({
    //     id: req.body.id
    // }).then((data) => {
    //     if (!data) { return res.status(401).json({ message: "no horse with such id" }) }
    //     else {
            
    //         let date = new Date(req.body.date)
    //         const horseUnavailable = new HorseUnavailable({
    //             id: req.body.id, date: date
    //         })
    //         horseUnavailable.save().then(() => console.log('Unavilable entry added!'))

    //         res.status(200).json({
    //             id: req.body.id,
    //             date: date,
    //             accessToken,
    //             refreshToken
    //         })
    //     }
    // })
})

app.listen(3001)