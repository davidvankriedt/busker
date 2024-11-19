var crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const MongoDBSession = require('connect-mongodb-session')(session);
var path = require('path');
const bodyParser = require('body-parser');
const bytes = require('bytes');
const multer = require("multer");
const fs = require('fs');
const request = require('request');
const mongoose = require('mongoose');
const app = express();

// require models
const userInfo = require("./models/userInfo");
const event = require("./models/event");

const foundUser = {};

app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.set('view engine', 'ejs');
mongoose.set("strictQuery", false);
app.use(bodyParser.json({ limit: bytes('10MB') }));
app.use(bodyParser.urlencoded({ limit: bytes('10MB'), extended: true }))

const sha256 = require('crypto-js/sha256');

// storage for multer
const storage = multer.diskStorage({
  destination: './public/uploads',
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// multer instance
const uploadMiddleware = multer({
  storage: storage,
  limits: { fileSize: 100000 }
}).single('profilePic');

app.use(uploadMiddleware);

// database connection string
const db =
  "mongodb+srv://davidvankriedt:Password123@cluster0.5le3z5h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const store = new MongoDBSession({
  uri: db,
  collection: "mySessions",
});

app.use(
  session({
    secret: 'password123',
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

//connect to the database
mongoose
  .connect(db, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false
  })
  .then(() => {
    console.log('MongoDB Connected');
  })
  .catch(err => {
    console.log(err);
    console.log('MongoDB Not Connected');
  });


// rendering pages

// home page
app.get('/', (req, res) => {
  event.find({}, function(error, events) {
    if (error) {
      console.log("There was a problem getting data");
      console.log(error);
    } else {
      res.render('index', {
        events: events
      });
    }
  });
});

// middleware to check user is logged in
async function loggedInCheck(req, res, next) {
  if (req.session.isLoggedIn) {
    try {
      const user = await userInfo.findOne({ email: req.session.userEmail })
        .populate('followers')
        .populate('following')
        .populate('friends');

      req.user = user;

      next();
    } catch (error) {
      console.log(error);
      res.redirect('/login');
    }
  } else {
    console.log('User is not logged in');
    res.redirect('/login');
  }
}

// REGISTER PAGE ROUTES

// register page
app.get('/register', (req, res) => {
  res.render('register', {});
});

// user register
app.post('/register', async function(req, res) {
  var formData = req.body;
  var hashPassword = sha256(req.body.password);
  try {
    // check if user already exists
    let user = await userInfo.findOne({ email: req.body.email });

    if (user) {
      console.log('Email is already registered');
      res.render('register', {
        error: 'Email is already registered'
      });
    } else {
      res.redirect('/login');
      console.log("User does not exist");
      userInfo.create({
        firstName: formData.fname,
        lastName: formData.lname,
        dateOfBirth: formData.dob,
        username: formData.username,
        email: formData.email,
        password: hashPassword,
        location: formData.location,
        followers: [],
        following: [],
        friends: []
      });
      console.log("User created:", newUser);
    }
  }

  catch (error) {
    console.log('There was an error finding user')
    console.log(error);
  }
});

// -----------------------------------------------------

// LOGIN PAGE ROUTES 

// login page 
app.get('/login', (req, res) => {
  res.render('login', {});
});

// Function to hash the password using SHA256
function hashPassword(password) {
  const hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
}


// handling user login
app.post("/login", async function(req, res) {
  try {
    // check if the user exists
    const user = await userInfo.findOne({ email: req.body.email });
    if (user) {
      // check if password matches
      const hashedPassword = hashPassword(req.body.password); // Hash the inputted password
      const result = hashedPassword === user.password;
      if (result) {
        // create a new session
        req.session.isLoggedIn = true;
        req.session.userEmail = user.email;
        req.session.save()

        const redirectUrl = `/profile?name=${encodeURIComponent(user.username)}`;
        return res.redirect(redirectUrl);

      } else {
        console.log("password doesn't match");
        req.session.isLoggedIn = false;
        req.session.userEmail = null;
        console.log(`Inputted password = ${req.body.password}`);
        console.log(`Actual password = ${user.password}`);
        res.render('login')
      }
    } else {
      console.log("user doesn't exist");
      req.session.isLoggedIn = false;
      req.session.userEmail = null;
    }
  } catch (error) {
    console.log(error);
  }
  console.log(`State of LoggedIn user:${req.session.isLoggedIn} `)
});

// -----------------------------------------------------

// EVENTS PAGE ROUTES

// events page 
app.get("/events", async (req, res) => {
  try {
    const searchTerm = req.query.search || "";

    const searchQuery = searchTerm ? { $text: { $search: searchTerm } } : {};

    const eventsData = await event.find(searchQuery).populate("createdBy");
    res.render("events",
      { events: eventsData, searchTerm: searchTerm });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error fetching events");
  }
});

app.get("/createEvent", (req, res) => {
  res.render("createEvent", {});
});

// storing eventId
app.param("eventId", (req, res, next, eventId) => {
  req.eventId = eventId;
  console.log(`Event ID is ${eventId}`)
  next()
});

// create event
app.post("/createEvent", loggedInCheck, async (req, res) => {
  try {
    const { eventTitle, date, time, eventLocation, description, capacity } = req.body;
    console.log(req.body);
    const createdBy = req.session.userEmail;
    const foundUser = await userInfo.findOne({ email: createdBy });
    const newEvent = await event.create({
      eventTitle,
      date,
      time,
      eventLocation,
      description,
      capacity,
      createdBy: foundUser._id,
    });
    res.redirect(`/events/${newEvent._id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating event")
  }
});

// delete event
app.delete("/events/:id", loggedInCheck, async (req, res) => {
  const eventId = req.params.id;

  try {
    const deletedEvent = await event.findByIdAndDelete(eventId);
    res.redirect("/profile");
  } catch (error) {
    console.log(error)
    res.status(500).send("Error deleting event");
  }
});

// find all documents in the collection
app.get('/allEvents', (req, res) => {
  event.find({}, function(error, events) {
    if (error) {
      console.log("There was a problem getting events");
      console.log(error);
    } else {
      console.log("Here is the data received: ");
      res.render('allEvents', { events: events });
    }
  });
});

//diplay event 
app.get('/events/:id', (req, res) => {
  var id = req.params.id;
  console.log(id);
  event.findById(id, function(error, selectedEvent) {

    if (error) {
      console.log("Unable to get id of event");
      res.render('events', {
        error: "can't find that event id"
      });
    }
    else {
      res.render('event', { event: selectedEvent, events: [selectedEvent] });
    }
  });
});

// -----------------------------------------------------

// ABOUT PAGE ROUTES

// about page
app.get('/about', (req, res) => {
  res.render('about', {});
});

// -----------------------------------------------------

// USER PROFILE ROUTES

// user profile page
app.get("/profile", loggedInCheck, async (req, res) => {
  try {
    if (req.session.isLoggedIn) {
      const userEmail = req.session.userEmail;
      const foundUser = await userInfo
        .findOne({ email: userEmail })
        .populate("followers")
        .populate("friends")
        .populate("following");
      const userId = foundUser._id;
      const events = await event.find({ createdBy: userId });

      let profilePic;

      if (foundUser) {
        profilePic = foundUser.profilePic;
      }

      const followers = foundUser.followers || [];
      const following = foundUser.following || [];
      const friends = foundUser.friends || [];

      res.render("profile", {
        foundUser: foundUser,
        email: userEmail,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
        username: foundUser.username,
        profilePic: profilePic,
        followers: followers,
        following: following,
        friends: friends,
        events: events,
      });
    } else {
      res.redirect("/login");
      console.log("User not logged in");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Error fetching user profile");
  }
});

// post profile picture
app.post('/profile/upload', async (req, res) => {
  const userEmail = req.session.userEmail;
  const base64String = req.body.base64String;

  try {
    const updatedUser = await userInfo.findOneAndUpdate(
      { email: userEmail },
      { profilePic: base64String },
      { new: true }
    );

    if (updatedUser) {
      res.redirect('/profile');
    } else {
      console.log('User not found');
      res.status(500).send('Error updating profile picture.');
    }
  } catch (error) {
    console.log(error);
    res.status(500).send('Error updating profile picture.');
  }
});


// -----------------------------------------------------

// USER LOGOUT ROUTE

// user logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    }
    res.redirect('/');
  });
});

// -----------------------------------------------------

// OTHER USER PROFILE ROUTES

// other user's profile
app.get("/otherProfile/:userId", loggedInCheck, async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await userInfo.findById(userId)
      .populate('followers')
      .populate('following')
      .populate('friends');

    if (!user) {
      return res.status(404).send("User not found");
    }

    const currentUserEmail = req.session.userEmail;
    const currentUser = await userInfo.findOne({ email: currentUserEmail })
      .populate('followers')
      .populate('following')
      .populate('friends');

    const followers = user.followers.map(follower => follower.username) || [];
    const following = user.following.map(followingUser => followingUser.username) || [];
    const friends = user.friends.map(friend => friend.username) || [];

    const otherUserEvents = await event.find({ createdBy: userId });

    res.render("otherProfile", { user, currentUser, followers, following, friends, events: otherUserEvents });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error fetching user profile");
  }
});

// -----------------------------------------------------

// FOLLOWNG/UNFOLLOWING USERS ROUTES

// post route for following user
app.post('/follow/:userId', loggedInCheck, async (req, res) => {
  const currentUserId = foundUser._id;
  const targetUserId = await userInfo.findById(req.params.userId);

  try {
    const currentUser = await userInfo.findById(currentUserId);
    const targetUser = await userInfo.findById(targetUserId);

    if (!targetUser) {
      console.log("User not found")
    }

    if (currentUser.following.includes(targetUserId)) {
      // user already following, so unfollow
      currentUser.following.pull(targetUserId);
      userToFollow.followers.pull(currentUserId);


      console.log("success: true, isFollowing: false");
    } else {
      // user is not following, so follow
      currentUser.following.push(targetUserId);
      userToFollow.followers.push(currentUserId);

    }

    await currentUser.save();
    await userToFollow.save();

    const followerCount = targetUser.followers.length;
    console.log("success: true, isFollowing: true");
    res.redirect(`/otherProfile/${targetUserId}`);
  } catch (error) {
    console.log(error);
    console.log('Error following/unfollowing user');
  }
});

// unfollowing user
app.delete('/users/:userId/follow', loggedInCheck, async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUser = req.user;

    const userToUnfollow = await userInfo.findById(userId);
    if (!userToUnfollow) {
      console.log("User not found");
    }

    const isFollowing = currentUser.following.includes(userId);
    if (!isFollowing) {
      console.log("User is not being followed")
    }

    currentUser.following = currentUser.following.filter((followedId) => followedId !== userId);

    userToUnfollow.followers = userToUnfollow.followers.filter((followerId) => followerId !== currentUser._id);

    await currentUser.save();
    await userToUnfollow.save();

    const followerCount = userToUnfollow.followers.length;
    return res.json({ success: true, isFollowing: false, followerCount });
  } catch (error) {
    console.error(error);
  }
});