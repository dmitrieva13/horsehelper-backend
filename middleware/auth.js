const jwt = require("jsonwebtoken")

const verifyToken = (req, res, next) => {
    let accessToken = req.body.accessToken
    let refreshToken = req.body.refreshToken
  
    if (!accessToken) {
        return res.status(403).json({errorMessage: "An access token is required for authentication"})
    }
  
    try {
        const accessDecoded = jwt.verify(accessToken, process.env.TOKEN_STRING || "secret string")
        req.user = {accessToken, refreshToken, id: accessDecoded.id, phone: accessDecoded.phone,
            role: accessDecoded.role, name: accessDecoded.name, trainerType: accessDecoded.trainerType}
    } catch (err) {
        if (err.name == "TokenExpiredError" && !refreshToken) {
            return res.status(401).json({errorMessage: "Token is expired"});
        }
        
        try {
            const refreshDecoded = jwt.verify(refreshToken, process.env.TOKEN_STRING || "secret string")
            console.log("refreshing both")
            console.log(refreshDecoded)
            
            accessToken = jwt.sign({
                id: refreshDecoded.id, phone: refreshDecoded.phone, role: refreshDecoded.role,
                name: refreshDecoded.name, trainerType: refreshDecoded.trainerType
            }, process.env.TOKEN_STRING || "secret string", {expiresIn: '2h'});
            refreshToken = jwt.sign({
                id: refreshDecoded.id, phone: refreshDecoded.phone, role: refreshDecoded.role,
                name: refreshDecoded.name, trainerType: refreshDecoded.trainerType
            }, process.env.TOKEN_STRING || "secret string", { expiresIn: '100d' });
            
            req.user = { accessToken, refreshToken, id: refreshDecoded.id, phone: refreshDecoded.phone,
                role: refreshDecoded.role, name: refreshDecoded.name, trainerType: refreshDecoded.trainerType }
        }
        catch (err) {
            console.log(err)
            return res.status(401).json({errorMessage: "Invalid Token"});
        }
    }
    return next();
};

module.exports = verifyToken;
