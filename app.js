const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { Strategy } = require("passport-local");
// require("dotenv").config();
// import { v4 as uuidv4 } from 'uuid';
const { v4: uuidv4 } = require("uuid");
let list = [];
var new_list = "";
var flash = require("express-flash-message");
let googleUsername = "";
let registerError = "";
let loginError = "";

// create findorcreate Method
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + "/public"));
// app.use(flash());

app.use(
  session({
    secret: "keyboard mouse.",
    resave: false,
    saveUninitialized: false,
  })
);

// app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/donorsDB");
// To get rid of Deprecation warning
// mongoose.set("useCreateIndex",true);
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
});
const donorsSchema = {
  name: String,
  contact: Number,
  city: String,
  bloodGroup: String,
  email: String,
};

userSchema.plugin(passportLocalMongoose);
// Add plugin for findOrCreate
userSchema.plugin(findOrCreate);

const Donor = mongoose.model("Donor", donorsSchema);
const User = new mongoose.model("User", userSchema);
passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

// Setup google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: "REPLACE_THIS_WITH_YOUR_CLIENT_ID", //enter your client ID
      clientSecret: "REPLACE_THIS_WITH_YOUR_CLIENT_SECRET", // enter your client secret key
      callbackURL: "http://localhost:3000/auth/google/profile",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate(
        { googleId: profile.id, username: profile._json.email },
        function (err, user) {
          googleUsername = profile._json.email;
          return cb(err, user);
        }
      );
    }
  )
);

app.get("/", function (req, res) {
  Donor.find({}, function (err, found) {
    if (err) {
      console.log(err);
    } else {
      res.render("blood-group-list", {
        listItems: found,
      });
    }
  });
});
app.get("/register", function (req, res) {
  res.render("register", { messages: registerError });
  registerError = "";
});
app.get("/login", function (req, res) {
  res.render("login", { messages: loginError });
  loginError = "";
});

// Route for OAuth
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Setup for authenciation google
app.get(
  "/auth/google/profile",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home
    console.log(googleUsername);
    res.redirect("/profile");
  }
);
app.get("/profile", function (req, res) {
  User.findOne({ username: googleUsername }, function (err, found) {
    if (err) {
      console.log(err);
    } else if (found) {
      res.redirect("/profile/" + found._id);
    } else {
      res.redirect("/login");
    }
  });
});

app.get("/profile/:id", function (req, res) {
  if (req.isAuthenticated()) {
    const id = req.params.id;

    console.log("Login");

    User.findOne({ _id: id }, function (err, found) {
      var status = "Non-Donor";

      if (found) {
        console.log(found);

        Donor.findOne({ email: found.username }, function (err, doner) {
          if (err) {
            console.log(err);
          } else if (doner) {
            status = "Donor";
            res.render("profile", { User: found, status: status });
          } else {
            res.render("profile", { User: found, status: status });
          }
        });
      } else {
        console.log("Not found", id);
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/", function (req, res) {
  const newUserName = req.body.name;
  const newUserBloodGroup = req.body.bloodGroup;
  const newUserContact = req.body.contact;
  const newUserEmail = req.body.email;
  const newUserCity = req.body.city;
  let newUser = {};
  newUser = new Donor({
    name: newUserName,
    bloodGroup: newUserBloodGroup,
    city: newUserCity,
    contact: newUserContact,
    email: newUserEmail,
  });
  newUser.save();
  res.redirect("/");
});

app.post("/delete/:id", function (req, res) {
  const id = req.body.id;
  User.findById(id, function (err, found) {
    if (err) {
      console.log(err);
    } else {
      const name = found.username;
      Donor.findOneAndDelete({ email: name }, function (err, found) {
        if (err) {
          console.log(err);
        } else {
          console.log(found, "deleted");
          console.log("found");
          res.redirect("/");
        }
      });
    }
  });
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        registerError = err;
        res.redirect("/register");
      } else {
        passport.authenticate("local", { failureFlash: true })(
          req,
          res,
          function () {
            res.redirect("/login");
          }
        );
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(user, function (err) {
    if (err) {
      console.log(err);
      loginError = err;
      res.redirect("/login");
    } else {
      passport.authenticate("local", { failureFlash: true })(
        req,
        res,
        function () {
          User.findOne({ username: user.username }, function (err, found) {
            if (err) {
              console.log(err);
              loginError = "Invalid username or password";
            } else if (found) {
              res.redirect("/profile/" + found.id);
            } else {
              loginError = "Invalid username or password";
              res.redirect("/login");
            }
          });
        }
      );
    }
  });
});
app.post("/list", function (req, res) {
  new_list = req.body.city;
  let blood = req.body.blood;
  list.push(blood);
  res.redirect("/list");

  console.log(req.body.blood);
  console.log(list);
});
app.get("/list", function (req, res) {
  Donor.find({}, function (err, found) {
    if (err) {
      console.log(err);
    } else if (found) {
      res.render("list", {
        listItems: found,
        desire: list,
        cityy: new_list,
      });
      list = [];
      console.log("List:", list);
    }
  });
});

app.listen(3000, function () {
  console.log("Server Started at port 3000");
});
