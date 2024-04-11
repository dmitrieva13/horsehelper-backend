const jwt = require("jsonwebtoken")

const verifyToken = (req, res, next) => {
    let accessToken = req.body.accessToken
    let refreshToken = req.body.refreshToken
  
    if (!accessToken) {
        return res.status(403).json({errorMessage: "An access token is required for authentication"})
    }
  
    try {
        const accessDecoded = jwt.verify(accessToken, "process.env.TOKEN_KEY")
        // console.log(accessDecoded)
        req.user = {accessToken, refreshToken, id: accessDecoded.id, phone: accessDecoded.phone,
            role: accessDecoded.role, name: accessDecoded.name}
    } catch (err) {
        if (err.name == "TokenExpiredError" && !refreshToken) {
            return res.status(401).json({errorMessage: "Token is expired"});
        }
        
        try {
            const refreshDecoded = jwt.verify(refreshToken, "process.env.TOKEN_KEY")
            console.log("refreshing both")
            console.log(refreshDecoded)
            
            accessToken = jwt.sign({
                id: refreshDecoded.id, phone: refreshDecoded.phone,
                role: refreshDecoded.role, name: refreshDecoded.name
            }, "process.env.TOKEN_KEY", {expiresIn: "2h"});
            refreshToken = jwt.sign({
                id: refreshDecoded.id, phone: refreshDecoded.phone, 
                role: refreshDecoded.role, name: refreshDecoded.name
            }, "process.env.TOKEN_KEY", { expiresIn: '100d' });

            
            req.user = { accessToken, refreshToken, id: refreshDecoded.id, phone: refreshDecoded.phone,
                role: refreshDecoded.role, name: refreshDecoded.name }
        }
        catch (err) {
            return res.status(401).json({errorMessage: "Invalid Token"});
        }
    }
    return next();
};

module.exports = verifyToken;
