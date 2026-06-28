const express = require("express");
const router = express.Router();

const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const helmet     = require('helmet');
const { body, param, validationResult } = require('express-validator');

router.post("/register", async (req, res) => {
    const {email, password} = req.body;

    try {

        let user = await User.findOne({email});
        if ( user ) {
            return res.status(400).json({msg: "USer already exists"} );
        }

        const hashedpassword = await bcrypt.hash( password, 10 );
        user = new User ({
            email,
            password: hashedpassword
        });

        await user.save();

        const token = jwt.sign(
            { id: user._id},
            process.env.JWT_SECRET,
            {expiresIn : "24h"}
        )

        return res.status(201).json({
            msg: "Registered Successfully",
            token
        });
    } catch (err) {
        return res.status(500).json({ msg: err.message}); 
    }
});

router.post("/login", async (req, res) => {

    const {email,password} = req.body;
    try {

        let user = await User.findOne({email});
        if ( !user ) {
            return res.status(400).json({msg: "Entered Wrong Email"} );
        }

        let isMatch = await bcrypt.compare( password, user.password );
        if ( !isMatch) {
            return res.status(400).json({msg: "Entered Wrong Password"} );
        }

        const token = jwt.sign (
            { id: user._id},
            process.env.JWT_SECRET,
            {expiresIn: "24h" }
        );

        return res.status(201).json({
            msg: "Login successgully",
            token
        });

    } catch (err) {
        return res.status(500).json({msg: err.message} );
    }    
});

function middle(req, res, next ) {

    const header = req.header("Authorization");
    if ( !header ) {
        return res.status(401).json({msg: "Problem No Token found"} );
    }

    const token = header.split(" ")[1];
    try {

        const decode = jwt.verify( token, process.env.JWT_SECRET);
        req.user = decode;

        next();
    } catch (err) {
        return res.status(401).json({msg: "Invalid token"});
    }
}


router.post( "/click", middle, async (req, res) => {

    const userId = req.user.id; // 🔥 extracted from token

    const time = new Date();

    const user = await User.findByIdAndUpdate(
        userId,
        { lastClick: time },
        { returnDocument: "after" }
    );

    res.json({ time: user.lastClick });  
});

module.exports = router;